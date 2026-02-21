const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 8090;
const ROOT = __dirname;
const DB_PATH = path.join(ROOT, 'data', 'profiles.json');
const SESS = new Map();

const MIME = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8' };

function send(res, code, body, type='text/plain; charset=utf-8'){
  res.writeHead(code, {'Content-Type':type,'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization'});
  res.end(body);
}
function body(req){ return new Promise((resolve,reject)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>resolve(b)); req.on('error',reject); }); }
function hashPin(pin,salt){ return crypto.pbkdf2Sync(pin,salt,120000,32,'sha256').toString('hex'); }
function token(){ return crypto.randomBytes(24).toString('hex'); }

function dbRead(){
  try {
    const d = JSON.parse(fs.readFileSync(DB_PATH,'utf8'));
    d.profiles = d.profiles || {};
    d.memory = d.memory || {};
    return d;
  } catch {
    return {profiles:{},memory:{}};
  }
}
function dbWrite(d){ fs.mkdirSync(path.dirname(DB_PATH), {recursive:true}); fs.writeFileSync(DB_PATH, JSON.stringify(d,null,2)); }

function migrateDb(){
  const d = dbRead();
  // migrate legacy admin block -> profile with isAdmin
  if (d.admin && d.admin.user && !d.profiles[d.admin.user]) {
    d.profiles[d.admin.user] = {
      salt: d.admin.salt,
      pinHash: d.admin.passHash,
      isAdmin: true,
      status: 'active',
      createdAt: d.admin.createdAt || new Date().toISOString(),
      migratedFrom: 'admin'
    };
    d.memory[d.admin.user] = d.memory[d.admin.user] || [];
  }
  // ensure raphael admin if account exists and no flag yet
  if (d.profiles.raphael && typeof d.profiles.raphael.isAdmin !== 'boolean') d.profiles.raphael.isAdmin = true;
  for (const k of Object.keys(d.profiles)) {
    if (!('status' in d.profiles[k])) d.profiles[k].status = 'active';
    d.memory[k] = d.memory[k] || [];
  }
  dbWrite(d);
}

function auth(req){
  const h=req.headers.authorization||'';
  const t=h.startsWith('Bearer ')?h.slice(7):'';
  return SESS.get(t)||null;
}

function askHashirama(prompt){
  return new Promise((resolve,reject)=>{
    const child = spawn('docker',['exec','-i','-u','node','dev-workspace','claude','--permission-mode','bypassPermissions','-p','-'],{stdio:['pipe','pipe','pipe']});
    let out='',err='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('timeout'));},90000);
    child.stdout.on('data',d=>out+=d.toString());
    child.stderr.on('data',d=>err+=d.toString());
    child.on('close',c=>{clearTimeout(timer); if(c===0) resolve(out.trim()); else reject(new Error(err||('exit '+c)));});
    child.stdin.write(prompt); child.stdin.end();
  });
}

migrateDb();

const server=http.createServer(async (req,res)=>{
  if(req.method==='OPTIONS') return send(res,204,'');

  if(req.method==='POST' && req.url==='/api/profile/login'){
    try{
      const d=JSON.parse(await body(req)||'{}');
      const profile=String(d.profile||'').trim().toLowerCase();
      const pin=String(d.pin||'');
      if(!profile||!pin) return send(res,400,JSON.stringify({error:'profile_pin_required'}),MIME['.json']);
      const db=dbRead();
      const p=db.profiles[profile];
      if(!p) return send(res,401,JSON.stringify({error:'unknown_profile'}),MIME['.json']);
      if((p.status||'active')!=='active') return send(res,403,JSON.stringify({error:'account_disabled'}),MIME['.json']);
      if(hashPin(pin,p.salt)!==p.pinHash) return send(res,401,JSON.stringify({error:'invalid_pin'}),MIME['.json']);
      const t=token();
      const session={profile,isAdmin:!!p.isAdmin,status:p.status||'active',createdAt:Date.now()};
      SESS.set(t,session);
      return send(res,200,JSON.stringify({token:t,profile,isAdmin:session.isAdmin,status:session.status}),MIME['.json']);
    }catch{ return send(res,500,JSON.stringify({error:'login_failed'}),MIME['.json']); }
  }

  if(req.url.startsWith('/api/admin/')){
    const s=auth(req);
    if(!s) return send(res,401,JSON.stringify({error:'unauthorized'}),MIME['.json']);
    if(!s.isAdmin) return send(res,403,JSON.stringify({error:'forbidden'}),MIME['.json']);

    if(req.method==='GET' && req.url==='/api/admin/profiles'){
      const db=dbRead();
      const items=Object.keys(db.profiles||{}).map(name=>({
        name,
        isAdmin: !!db.profiles[name].isAdmin,
        status: db.profiles[name].status || 'active',
        messages:(db.memory?.[name]||[]).length,
        createdAt:db.profiles[name].createdAt||null
      }));
      return send(res,200,JSON.stringify({items}),MIME['.json']);
    }

    if(req.method==='POST' && req.url==='/api/admin/create-profile'){
      try {
        const d=JSON.parse(await body(req)||'{}');
        const profile=String(d.profile||'').trim().toLowerCase();
        const pin=String(d.pin||'').trim();
        const status = String(d.status||'active').toLowerCase()==='disabled' ? 'disabled' : 'active';
        const isAdmin = !!d.isAdmin;
        if(!profile||!pin) return send(res,400,JSON.stringify({error:'profile_pin_required'}),MIME['.json']);
        const db=dbRead();
        if(db.profiles[profile]) return send(res,409,JSON.stringify({error:'profile_exists'}),MIME['.json']);
        const salt=crypto.randomBytes(12).toString('hex');
        db.profiles[profile]={salt,pinHash:hashPin(pin,salt),status,isAdmin,createdAt:new Date().toISOString(),createdBy:s.profile};
        db.memory[profile]=[];
        dbWrite(db);
        return send(res,200,JSON.stringify({ok:true,profile,status,isAdmin}),MIME['.json']);
      } catch { return send(res,500,JSON.stringify({error:'create_failed'}),MIME['.json']); }
    }

    return send(res,404,JSON.stringify({error:'not_found'}),MIME['.json']);
  }

  if(req.url.startsWith('/api/')){
    const s=auth(req);
    if(!s) return send(res,401,JSON.stringify({error:'unauthorized'}),MIME['.json']);

    if(req.method==='GET' && req.url==='/api/history'){
      const db=dbRead();
      return send(res,200,JSON.stringify({profile:s.profile,isAdmin:s.isAdmin,items:db.memory[s.profile]||[]}),MIME['.json']);
    }

    if(req.method==='POST' && req.url==='/api/memory/add'){
      const d=JSON.parse(await body(req)||'{}');
      const role=(d.role==='user'?'user':'ai');
      const text=String(d.text||'').slice(0,8000);
      const db=dbRead();
      db.memory[s.profile]=db.memory[s.profile]||[];
      db.memory[s.profile].push({role,text,time:new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})});
      db.memory[s.profile]=db.memory[s.profile].slice(-300);
      dbWrite(db);
      return send(res,200,JSON.stringify({ok:true}),MIME['.json']);
    }

    if(req.method==='POST' && req.url==='/api/memory/clear'){
      const db=dbRead(); db.memory[s.profile]=[]; dbWrite(db);
      return send(res,200,JSON.stringify({ok:true}),MIME['.json']);
    }

    if(req.method==='POST' && req.url==='/api/chat'){
      try{
        const d=JSON.parse(await body(req)||'{}');
        const message=String(d.message||'').trim();
        if(!message) return send(res,400,JSON.stringify({error:'message_required'}),MIME['.json']);
        const db=dbRead();
        const hist=(db.memory[s.profile]||[]).slice(-12).map(m=>`${m.role}: ${m.text}`).join('\n');
        const prompt=`Tu es Hashirama. Profil: ${s.profile}. Réponds en français, concret.\nContexte récent:\n${hist}\n\nMessage: ${message}`;
        const reply=await askHashirama(prompt);
        return send(res,200,JSON.stringify({reply}),MIME['.json']);
      }catch{ return send(res,500,JSON.stringify({error:'chat_failed'}),MIME['.json']); }
    }

    return send(res,404,JSON.stringify({error:'not_found'}),MIME['.json']);
  }

  const safe = req.url==='/'?'/index.html':req.url;
  const full = path.normalize(path.join(ROOT,safe));
  if(!full.startsWith(ROOT)) return send(res,403,'Forbidden');
  fs.readFile(full,(err,buf)=>{ if(err) return send(res,404,'Not found'); const ext=path.extname(full).toLowerCase(); send(res,200,buf,MIME[ext]||'application/octet-stream'); });
});

server.listen(PORT,()=>console.log('Hashirama chat UI listening on :'+PORT));
