const chat = document.getElementById('chat');
const form = document.getElementById('composer');
const input = document.getElementById('input');
const statusPill = document.getElementById('statusPill');
const clearBtn = document.getElementById('clearBtn');
const exportBtn = document.getElementById('exportBtn');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const profileInput = document.getElementById('profileInput');
const pinInput = document.getElementById('pinInput');

const endpoint = '/api/chat';
let token = sessionStorage.getItem('hashi_token') || '';
let profile = sessionStorage.getItem('hashi_profile') || '';

function nowLabel() { return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
function headers() { return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }; }

function addMessage(role, text, time = nowLabel()) {
  const wrap = document.createElement('article');
  wrap.className = `msg ${role}`;
  wrap.innerHTML = `<div class="avatar">${role === 'user' ? 'R' : 'H'}</div><div class="bubble"><p></p><time>${time}</time></div>`;
  wrap.querySelector('p').textContent = text;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
}

async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'api_error');
  return d;
}

async function loadHistory() {
  const r = await fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } });
  const d = await r.json();
  chat.innerHTML = '';
  (d.items || []).forEach(m => addMessage(m.role, m.text, m.time));
  if (!d.items?.length) addMessage('ai', `Konbanwa ${profile}. Je suis Hashirama.`);
}

async function login(profileName, pin) {
  const d = await api('/api/profile/login', { profile: profileName, pin });
  token = d.token; profile = d.profile;
  sessionStorage.setItem('hashi_token', token);
  sessionStorage.setItem('hashi_profile', profile);
  loginModal.style.display = 'none';
  statusPill.textContent = `Profil: ${profile}`;
  await loadHistory();
}

async function askHashirama(message) {
  const r = await fetch(endpoint, { method: 'POST', headers: headers(), body: JSON.stringify({ message }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'bridge_error');
  return d.reply || 'Réponse vide.';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await login(profileInput.value.trim(), pinInput.value); }
  catch { alert('Login profil invalide'); }
});

input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 180) + 'px'; });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || !token) return;
  addMessage('user', text);
  input.value = ''; input.style.height = 'auto';
  await api('/api/memory/add', { role: 'user', text });

  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.textContent = 'Hashirama est en train d’écrire...';
  chat.appendChild(typing); chat.scrollTop = chat.scrollHeight;

  try {
    const response = await askHashirama(text);
    typing.remove();
    addMessage('ai', response);
    await api('/api/memory/add', { role: 'ai', text: response });
  } catch {
    typing.remove();
    addMessage('ai', 'Erreur bridge, réessaie.');
  }
});

clearBtn.addEventListener('click', async () => {
  if (!token) return;
  await api('/api/memory/clear', {});
  await loadHistory();
});

exportBtn.addEventListener('click', async () => {
  if (!token) return;
  const r = await fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } });
  const d = await r.json();
  const blob = new Blob([JSON.stringify(d.items || [], null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `hashirama-chat-${profile}-${Date.now()}.json`; a.click();
  URL.revokeObjectURL(url);
});

if (token && profile) {
  loginModal.style.display = 'none';
  statusPill.textContent = `Profil: ${profile}`;
  loadHistory();
}

const adminBtn = document.getElementById("adminBtn");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminUser = document.getElementById("adminUser");
const adminPass = document.getElementById("adminPass");
const adminPanel = document.getElementById("adminPanel");
const adminProfiles = document.getElementById("adminProfiles");
let adminToken = sessionStorage.getItem("hashi_admin_token") || "";

async function adminFetchProfiles(){
  const r = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${adminToken}` } });
  const d = await r.json();
  if(!r.ok) throw new Error('admin_fail');
  adminPanel.style.display='block';
  adminProfiles.textContent = (d.items||[]).map(p => `- ${p.name} | messages=${p.messages} | created=${p.createdAt||'n/a'}`).join('\n') || 'Aucun profil';
}

if (adminBtn) adminBtn.addEventListener('click', ()=>{ loginModal.style.display='grid'; });
if (adminLoginForm) adminLoginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  try{
    const r = await fetch('/api/admin/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ user: adminUser.value.trim(), pass: adminPass.value }) });
    const d = await r.json();
    if(!r.ok) throw new Error('invalid');
    adminToken = d.token;
    sessionStorage.setItem('hashi_admin_token', adminToken);
    await adminFetchProfiles();
    loginModal.style.display = 'none';
    statusPill.textContent = 'Admin connecté';
  } catch { alert('Admin login invalide'); }
});
if (adminToken) { adminFetchProfiles().catch(()=>{}); }

loginModal.addEventListener('click', (e) => { if (e.target === loginModal) loginModal.style.display = 'none'; });
