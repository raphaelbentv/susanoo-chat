const msgs = document.getElementById('msgs');
const inp = document.getElementById('inp');
const btn = document.getElementById('btn');
const statusTxt = document.getElementById('statusTxt');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const adminBtn = document.getElementById('adminBtn');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const profileInput = document.getElementById('profileInput');
const pinInput = document.getElementById('pinInput');

const adminManage = document.getElementById('adminManage');
const adminCreateForm = document.getElementById('adminCreateForm');
const newProfileInput = document.getElementById('newProfileInput');
const newProfilePin = document.getElementById('newProfilePin');
const newProfileStatus = document.getElementById('newProfileStatus');
const newProfileIsAdmin = document.getElementById('newProfileIsAdmin');
const adminProfiles = document.getElementById('adminProfiles');

const endpoint = '/api/chat';
let token = sessionStorage.getItem('hashi_token') || '';
let profile = sessionStorage.getItem('hashi_profile') || '';
let isAdmin = sessionStorage.getItem('hashi_is_admin') === 'true';

function nowLabel(){ return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
function headers(){ return { 'Content-Type':'application/json', Authorization:`Bearer ${token}` }; }

function addMessage(role, text, time){
  time = time || nowLabel();
  const div=document.createElement('div'); div.className='msg'+(role==='user'?' u':'');
  const av=document.createElement('div'); av.className='av'; av.textContent=role==='user' ? (profile.charAt(0).toUpperCase()||'R') : 'S';
  const bub=document.createElement('div'); bub.className='bub';
  const p=document.createElement('span'); p.textContent=text;
  const t=document.createElement('time'); t.textContent=time;
  bub.appendChild(p); bub.appendChild(t); div.appendChild(av); div.appendChild(bub);
  msgs.appendChild(div); msgs.scrollTop=msgs.scrollHeight;
}
function showTyping(){
  const div=document.createElement('div'); div.className='msg'; div.id='typing';
  const av=document.createElement('div'); av.className='av'; av.textContent='S';
  const bub=document.createElement('div'); bub.className='bub'; bub.innerHTML='<div class="typing-indicator"><span></span><span></span><span></span></div>';
  div.appendChild(av); div.appendChild(bub); msgs.appendChild(div); msgs.scrollTop=msgs.scrollHeight;
}
function removeTyping(){ const t=document.getElementById('typing'); if(t) t.remove(); }

async function api(path, body){
  const r=await fetch(path,{method:'POST',headers:headers(),body:JSON.stringify(body||{})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||'api_error');
  return d;
}

async function loadHistory(){
  const r=await fetch('/api/history',{headers:{Authorization:`Bearer ${token}`}});
  const d=await r.json();
  msgs.innerHTML='';
  (d.items||[]).forEach(m=>addMessage(m.role,m.text,m.time));
  if(!d.items?.length) addMessage('ai',`Bienvenue, ${profile}. Je suis Susanoo.`);
}

async function login(profileName,pin){
  const d=await api('/api/profile/login',{profile:profileName,pin});
  token=d.token; profile=d.profile; isAdmin=!!d.isAdmin;
  sessionStorage.setItem('hashi_token',token);
  sessionStorage.setItem('hashi_profile',profile);
  sessionStorage.setItem('hashi_is_admin',String(isAdmin));
  loginModal.style.display='none';
  statusTxt.textContent = `Profil: ${profile}` + (isAdmin ? ' · ADMIN' : '');
  adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
  adminManage.style.display = 'none';
  await loadHistory();
}

async function askHashirama(message){
  const r=await fetch(endpoint,{method:'POST',headers:headers(),body:JSON.stringify({message})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(d.error||'bridge_error');
  return d.reply||'Réponse vide.';
}

loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{ await login(profileInput.value.trim(), pinInput.value); }
  catch{ alert('Identifiant ou mot de passe invalide, ou compte inexistant.'); }
});

inp.addEventListener('input',()=>{ inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,140)+'px'; });
inp.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();} });
btn.addEventListener('click',send);

async function send(){
  const text=inp.value.trim(); if(!text||!token) return;
  addMessage('user',text); inp.value=''; inp.style.height='auto';
  await api('/api/memory/add',{role:'user',text});
  showTyping();
  try{
    const response=await askHashirama(text);
    removeTyping(); addMessage('ai',response);
    await api('/api/memory/add',{role:'ai',text:response});
  }catch{
    removeTyping(); addMessage('ai','Erreur de connexion au bridge.');
  }
}

clearBtn.addEventListener('click', async ()=>{ if(!token) return; await api('/api/memory/clear',{}); await loadHistory(); });
exportBtn.addEventListener('click', async ()=>{
  if(!token) return;
  const r=await fetch('/api/history',{headers:{Authorization:`Bearer ${token}`}});
  const d=await r.json();
  const blob=new Blob([JSON.stringify(d.items||[],null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`susanoo-chat-${profile}-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
});

async function adminFetchProfiles(){
  const r=await fetch('/api/admin/profiles',{headers:{Authorization:`Bearer ${token}`}});
  const d=await r.json();
  if(!r.ok) throw new Error('admin_fail');
  adminProfiles.textContent=(d.items||[]).map(p=>`· ${p.name} | ${p.status} | admin=${p.isAdmin} | messages=${p.messages}`).join('\n') || 'Aucun profil';
}

adminBtn.addEventListener('click', async ()=>{
  if(!isAdmin) return;
  adminManage.style.display = adminManage.style.display==='none' ? 'block':'none';
  if(adminManage.style.display==='block') await adminFetchProfiles();
});

if(adminCreateForm) adminCreateForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!isAdmin) return;
  try{
    const d=await api('/api/admin/create-profile',{
      profile:newProfileInput.value.trim(),
      pin:newProfilePin.value,
      status:newProfileStatus.value,
      isAdmin:newProfileIsAdmin.checked
    });
    newProfileInput.value=''; newProfilePin.value=''; newProfileIsAdmin.checked=false; newProfileStatus.value='active';
    await adminFetchProfiles();
    alert(`Compte créé: ${d.profile}`);
  }catch{ alert('Création compte impossible'); }
});

if(token&&profile){
  loginModal.style.display='none';
  statusTxt.textContent = `Profil: ${profile}` + (isAdmin ? ' · ADMIN' : '');
  adminBtn.style.display = isAdmin ? 'inline-block' : 'none';
  loadHistory();
}else{
  loginModal.style.display='grid';
  adminBtn.style.display='none';
}

loginModal.addEventListener('click',(e)=>{ if(e.target===loginModal && token) loginModal.style.display='none'; });
