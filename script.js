/* ── Susanoo · Gilded Emperor — Script ── */

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

const endpoint = '/api/chat';
let token = sessionStorage.getItem('hashi_token') || '';
let profile = sessionStorage.getItem('hashi_profile') || '';

function nowLabel() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function headers() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

/* ── Messages ── */
function addMessage(role, text, time) {
  time = time || nowLabel();
  const div = document.createElement('div');
  div.className = 'msg' + (role === 'user' ? ' u' : '');
  const av = document.createElement('div');
  av.className = 'av';
  av.textContent = role === 'user' ? profile.charAt(0).toUpperCase() || 'R' : 'S';
  const bub = document.createElement('div');
  bub.className = 'bub';
  const p = document.createElement('span');
  p.textContent = text;
  const t = document.createElement('time');
  t.textContent = time;
  bub.appendChild(p);
  bub.appendChild(t);
  div.appendChild(av);
  div.appendChild(bub);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg';
  div.id = 'typing';
  const av = document.createElement('div');
  av.className = 'av';
  av.textContent = 'S';
  const bub = document.createElement('div');
  bub.className = 'bub';
  bub.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
  div.appendChild(av);
  div.appendChild(bub);
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

/* ── API ── */
async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: headers(), body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'api_error');
  return d;
}

async function loadHistory() {
  const r = await fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } });
  const d = await r.json();
  msgs.innerHTML = '';
  (d.items || []).forEach(m => addMessage(m.role, m.text, m.time));
  if (!d.items?.length) addMessage('ai', `Bienvenue, ${profile}. Je suis Susanoo, votre interface impériale. Que désirez-vous accomplir ?`);
}

async function login(profileName, pin) {
  const d = await api('/api/profile/login', { profile: profileName, pin });
  token = d.token;
  profile = d.profile;
  sessionStorage.setItem('hashi_token', token);
  sessionStorage.setItem('hashi_profile', profile);
  loginModal.style.display = 'none';
  statusTxt.textContent = `Claude Sonnet · Profil: ${profile}`;
  await loadHistory();
}

async function askHashirama(message) {
  const r = await fetch(endpoint, { method: 'POST', headers: headers(), body: JSON.stringify({ message }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'bridge_error');
  return d.reply || 'Réponse vide.';
}

/* ── Login ── */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await login(profileInput.value.trim(), pinInput.value);
  } catch {
    alert('Identification invalide.');
  }
});

/* ── Textarea auto-resize ── */
inp.addEventListener('input', () => {
  inp.style.height = 'auto';
  inp.style.height = Math.min(inp.scrollHeight, 140) + 'px';
});

inp.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
});

btn.addEventListener('click', send);

/* ── Send ── */
async function send() {
  const text = inp.value.trim();
  if (!text || !token) return;
  addMessage('user', text);
  inp.value = '';
  inp.style.height = 'auto';
  await api('/api/memory/add', { role: 'user', text });

  showTyping();

  try {
    const response = await askHashirama(text);
    removeTyping();
    addMessage('ai', response);
    await api('/api/memory/add', { role: 'ai', text: response });
  } catch {
    removeTyping();
    addMessage('ai', 'Erreur de connexion au bridge. Veuillez réessayer.');
  }
}

/* ── Clear ── */
clearBtn.addEventListener('click', async () => {
  if (!token) return;
  await api('/api/memory/clear', {});
  await loadHistory();
});

/* ── Export ── */
exportBtn.addEventListener('click', async () => {
  if (!token) return;
  const r = await fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } });
  const d = await r.json();
  const blob = new Blob([JSON.stringify(d.items || [], null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `susanoo-chat-${profile}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

/* ── Auto-login si session existante ── */
if (token && profile) {
  loginModal.style.display = 'none';
  statusTxt.textContent = `Claude Sonnet · Profil: ${profile}`;
  loadHistory();
} else {
  loginModal.style.display = 'grid';
}

/* ── Admin ── */
const adminLoginForm = document.getElementById('adminLoginForm');
const adminUser = document.getElementById('adminUser');
const adminPass = document.getElementById('adminPass');
const adminPanel = document.getElementById('adminPanel');
const adminProfiles = document.getElementById('adminProfiles');
let adminToken = sessionStorage.getItem('hashi_admin_token') || '';

async function adminFetchProfiles() {
  const r = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${adminToken}` } });
  const d = await r.json();
  if (!r.ok) throw new Error('admin_fail');
  adminPanel.style.display = 'block';
  adminProfiles.textContent = (d.items || []).map(p =>
    `· ${p.name}  —  messages: ${p.messages}  —  créé: ${p.createdAt || 'n/a'}`
  ).join('\n') || 'Aucun profil enregistré.';
}

adminBtn.addEventListener('click', () => {
  loginModal.style.display = 'grid';
});

adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: adminUser.value.trim(), pass: adminPass.value })
    });
    const d = await r.json();
    if (!r.ok) throw new Error('invalid');
    adminToken = d.token;
    sessionStorage.setItem('hashi_admin_token', adminToken);
    await adminFetchProfiles();
    loginModal.style.display = 'none';
    statusTxt.textContent = 'Admin connecté';
  } catch {
    alert('Identification admin invalide.');
  }
});

if (adminToken) {
  adminFetchProfiles().catch(() => {});
}

/* ── Fermer modal au clic extérieur ── */
loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal && token) {
    loginModal.style.display = 'none';
  }
});

const adminCreateForm = document.getElementById('adminCreateForm');
const newProfileInput = document.getElementById('newProfileInput');
const newProfilePin = document.getElementById('newProfilePin');
if (adminCreateForm) adminCreateForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await fetch('/api/admin/create-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ profile: newProfileInput.value.trim(), pin: newProfilePin.value })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'create_failed');
    newProfileInput.value=''; newProfilePin.value='';
    await adminFetchProfiles();
    alert(`Profil créé: ${d.profile}`);
  } catch (e2) { alert('Création profil impossible'); }
});
