/* ══════════════════════════════════════════════════════════
   HASHIRAMA — Interface Impériale · Script v0.2.0
   P0: Session mgmt, RBAC display, password policy, error logging
   ══════════════════════════════════════════════════════════ */

// ── DOM REFS ────────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const app            = $('#app');
const sidebar        = $('#sidebar');
const sidebarOverlay = $('#sidebarOverlay');
const sidebarToggle  = $('#sidebarToggle');
const convSearch     = $('#convSearch');
const convList       = $('#convList');
const statusToggle   = $('#statusToggle');
const statusBody     = $('#statusBody');
const chatMessages   = $('#chatMessages');
const chatInput      = $('#chatInput');
const sendBtn        = $('#sendBtn');
const sessionMarker  = $('#sessionMarker');
const statusLabel    = $('#statusLabel');
const navAvatar      = $('#navAvatar');
const sessionTime    = $('#sessionTime');
const ctxTokens      = $('#ctxTokens');
const loginModal     = $('#loginModal');
const loginForm      = $('#loginForm');
const identifierInput = $('#identifierInput');
const passwordInput   = $('#passwordInput');
const adminPanel     = $('#adminPanel');
const adminProfiles  = $('#adminProfiles');

// ── STATE ───────────────────────────────────────────────────
let viewport         = 'desktop';
let sidebarOpen      = true;
let activeConv       = 1;
let messages         = [];
let typing           = false;
let token            = sessionStorage.getItem('hashi_token') || '';
let profile          = sessionStorage.getItem('hashi_profile') || '';
let role             = sessionStorage.getItem('hashi_role') || 'user';
let adminToken       = sessionStorage.getItem('hashi_admin_token') || '';
let activeTags       = ['Venio'];
let temperature      = 80;
let maxTokens        = 60;
let statusWidgetOpen = true;
let sessionStart     = null;
let tokenCount       = 0;
let sessionExpiresAt = Number(sessionStorage.getItem('hashi_expires') || 0);
let passwordPolicy   = null;
let sessionCheckTimer = null;
let currentTheme     = localStorage.getItem('hashirama_theme') || 'emperor';
let loadedThemes     = new Set();

// ── MOCK CONVERSATIONS ──────────────────────────────────────
const CONVS = [
  { id:1, title:"Rapport mensuel Venio", preview:"Je compile Creatio, Decisio…", time:"14h32", badge:2, group:"Aujourd'hui" },
  { id:2, title:"Config Arrow — Auth JWT", preview:"Correction du middleware…", time:"11h08", group:"Aujourd'hui" },
  { id:3, title:"Plan de cours MBWAY UX/UI", preview:"Module 3 — Prototypage Figma…", time:"Hier", group:"Cette semaine" },
  { id:4, title:"Analyse SWOT Absys", preview:"Différenciation entrepreneuriale…", time:"20 fév", group:"Cette semaine" },
  { id:5, title:"Kuro — Prompt système v2", preview:"Révision des instructions…", time:"19 fév", group:"Cette semaine" },
  { id:6, title:"Script Instagram Reel", preview:"Contenu 53K — format vertical…", time:"19 fév", group:"Cette semaine" },
  { id:7, title:"Formatio — Qualiopi Q5", preview:"Critère 5 : évaluation…", time:"15 fév", group:"Plus ancien" },
  { id:8, title:"Hashirama — Design System", preview:"Tokens CSS, Gold Emperor…", time:"12 fév", group:"Plus ancien" },
  { id:9, title:"Bangkok — Projet immobilier", preview:"Analyse marché Sukhumvit…", time:"10 fév", group:"Plus ancien" },
];
const ALL_TAGS = ["Venio","Creatio","Arrow","Kuro","MBWAY","EMA","Absys","Bangkok","Instagram","VPS"];

const THEMES = [
  { id: 'obsidian', name: 'Obsidian Sentinel', primary: '#bb1e00', bg: '#030303', accent: '#ff0000', icon: '🗡️' },
  { id: 'cyber', name: 'Electric Ronin', primary: '#00d2ff', bg: '#00050c', accent: '#00ffe0', icon: '⚡' },
  { id: 'emperor', name: 'Gilded Emperor', primary: '#c8a020', bg: '#050408', accent: '#ffd700', icon: '👑' },
  { id: 'ghost', name: 'White Ghost', primary: '#1a1a1a', bg: '#eeecea', accent: '#fff', icon: '👻' },
  { id: 'storm', name: 'Storm Deity', primary: '#8840ff', bg: '#040310', accent: '#9055ff', icon: '⚡' },
  { id: 'brutal', name: 'Brutalist Oracle', primary: '#fff', bg: '#090909', accent: '#000', icon: '▪️' },
];

// ── HELPERS ─────────────────────────────────────────────────
function nowLabel() { return new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }); }
function authHeaders() { return { 'Content-Type':'application/json', 'Authorization':`Bearer ${token}` }; }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function formatRemaining(ms) {
  if (ms <= 0) return 'Expiré';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}`;
  return `${m}min`;
}

// ── HTML BUILDERS ───────────────────────────────────────────
function usageBarHtml(label, val, max, pct, color) {
  const c = color || 'var(--gold)';
  return `<div class="usage-bar">
    <div class="usage-bar-header">
      <span class="usage-bar-label">${label}</span>
      <span class="usage-bar-value" style="color:${c}">${val} / ${max}</span>
    </div>
    <div class="usage-bar-track"><div class="usage-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${c},var(--gold-dim))"></div></div>
  </div>`;
}

function statRowHtml(k, v, cls) {
  return `<div class="stat-row"><span class="stat-key">${k}</span><span class="stat-val ${cls||''}">${v}</span></div>`;
}

// ══════════════════════════════════════════════════════════
// FRONTEND ERROR LOGGING
// ══════════════════════════════════════════════════════════
function logFrontendError(message, stack) {
  try {
    fetch('/api/log/error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, stack, url: window.location.href }),
    }).catch(() => {});
  } catch {}
}

window.addEventListener('error', (e) => {
  logFrontendError(e.message, e.error?.stack || '');
});
window.addEventListener('unhandledrejection', (e) => {
  logFrontendError(String(e.reason), e.reason?.stack || '');
});

// ══════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════
function saveSession(t, p, r, expires) {
  token = t; profile = p; role = r; sessionExpiresAt = expires;
  sessionStorage.setItem('hashi_token', t);
  sessionStorage.setItem('hashi_profile', p);
  sessionStorage.setItem('hashi_role', r);
  sessionStorage.setItem('hashi_expires', String(expires));
}

function clearSession() {
  token = ''; profile = ''; role = 'user'; sessionExpiresAt = 0;
  sessionStorage.removeItem('hashi_token');
  sessionStorage.removeItem('hashi_profile');
  sessionStorage.removeItem('hashi_role');
  sessionStorage.removeItem('hashi_expires');
}

function showLogin() {
  loginModal.classList.remove('hidden');
}

function handleSessionExpired() {
  clearSession();
  showLogin();
  statusLabel.textContent = 'Session expirée';
}

async function refreshSessionToken() {
  try {
    const r = await fetch('/api/session/refresh', { method: 'POST', headers: authHeaders() });
    if (!r.ok) { handleSessionExpired(); return; }
    const d = await r.json();
    saveSession(d.token, d.profile, d.role, d.expiresAt);
  } catch { handleSessionExpired(); }
}

function startSessionTimer() {
  if (sessionCheckTimer) clearInterval(sessionCheckTimer);
  sessionCheckTimer = setInterval(() => {
    if (!token || !sessionExpiresAt) return;
    const remaining = sessionExpiresAt - Date.now();
    // Update display
    updateSessionDisplay();
    // Expired
    if (remaining <= 0) { handleSessionExpired(); return; }
    // Auto-refresh when < 2h remaining
    if (remaining < 2 * 3600000) refreshSessionToken();
  }, 60000);
}

function updateSessionDisplay() {
  if (!sessionExpiresAt) return;
  const remaining = sessionExpiresAt - Date.now();
  const label = remaining > 0 ? formatRemaining(remaining) : 'Expiré';
  if (sessionTime) sessionTime.textContent = label;
}

// ══════════════════════════════════════════════════════════
// PASSWORD POLICY
// ══════════════════════════════════════════════════════════
async function fetchPasswordPolicy() {
  try {
    const r = await fetch('/api/password-policy');
    if (r.ok) passwordPolicy = await r.json();
  } catch {}
}

function validatePinClient(pin) {
  if (!passwordPolicy) return [];
  const errors = [];
  if (pin.length < passwordPolicy.minLength) errors.push(`Min ${passwordPolicy.minLength} car.`);
  if (passwordPolicy.requireUpper && !/[A-Z]/.test(pin)) errors.push('1 majuscule');
  if (passwordPolicy.requireLower && !/[a-z]/.test(pin)) errors.push('1 minuscule');
  if (passwordPolicy.requireDigit && !/[0-9]/.test(pin)) errors.push('1 chiffre');
  return errors;
}

// ══════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ══════════════════════════════════════════════════════════

// ── CONVERSATIONS ───────────────────────────────────────────
function renderConversations() {
  const q = convSearch.value.toLowerCase();
  const groups = ["Aujourd'hui","Cette semaine","Plus ancien"];
  let html = '';
  for (const g of groups) {
    const items = CONVS.filter(c => c.group === g && c.title.toLowerCase().includes(q));
    if (!items.length) continue;
    html += `<div class="conv-group-label">${g}</div>`;
    for (const c of items) {
      const active = c.id === activeConv ? ' active' : '';
      html += `<div class="conv-item${active}" data-id="${c.id}">
        <div class="conv-title">${escHtml(c.title)}</div>
        <div class="conv-preview">${escHtml(c.preview)}</div>
        <div class="conv-footer">
          <span class="conv-time">${c.time}</span>
          ${c.badge ? `<span class="conv-badge">${c.badge}</span>` : ''}
        </div>
      </div>`;
    }
  }
  convList.innerHTML = html;
  convList.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', () => {
      activeConv = parseInt(el.dataset.id);
      renderConversations();
      if (viewport !== 'desktop') closeSidebar();
    });
  });
}

// ── STATUS WIDGET ───────────────────────────────────────────
function renderStatusWidget() {
  const remaining = sessionExpiresAt ? Math.max(0, sessionExpiresAt - Date.now()) : 0;
  const sessionPct = sessionExpiresAt ? ((remaining / (24*3600000)) * 100) : 0;

  statusBody.innerHTML =
    usageBarHtml('Tokens ce mois', '284k', '1M', 28.4) +
    usageBarHtml('Contexte session', tokenCount.toLocaleString('fr-FR'), '200k', (tokenCount/200000)*100) +
    usageBarHtml('Session TTL', formatRemaining(remaining), '24h', sessionPct, remaining < 7200000 ? 'var(--danger)' : 'var(--gold)') +
    '<div class="gold-divider"></div>' +
    statRowHtml('Modèle', 'Sonnet 4.6') +
    statRowHtml('Rôle', role.toUpperCase(), role === 'admin' ? 'success' : '') +
    statRowHtml('Requêtes/jour', '47 / 1000', 'success') +
    statRowHtml('Coût estimé', '$0.84') +
    statRowHtml('Latence moy.', '1.2s', 'success') +
    statRowHtml('VPS status', '● En ligne', 'success') +
    statRowHtml('Uptime', '14d 06h', 'success') +
    statRowHtml('Forfait', 'Pro · API');
}

// ── RIGHT PANEL ─────────────────────────────────────────────
function renderRightPanel() {
  // Model & Config
  const accModel = $('#accModelBody');
  if (accModel) {
    accModel.innerHTML = `
      <div class="model-card">
        <div class="model-card-name">SONNET 4.6</div>
        <div class="model-card-desc">Smart · Efficient · API</div>
      </div>
      <div class="stat-row"><span class="stat-key">Température</span><span class="stat-val">${(temperature/100).toFixed(2)}</span></div>
      <input type="range" min="0" max="100" value="${temperature}" id="tempSlider">
      <div class="stat-row" style="margin-top:4px"><span class="stat-key">Max tokens</span><span class="stat-val">${Math.round(maxTokens*81.92).toLocaleString('fr-FR')}</span></div>
      <input type="range" min="10" max="100" value="${maxTokens}" id="maxTokSlider">
      ${statRowHtml('Streaming', 'Activé', 'success')}
      ${statRowHtml('Top-P', '0.95')}`;
    $('#tempSlider').addEventListener('input', e => { temperature = +e.target.value; renderRightPanel(); });
    $('#maxTokSlider').addEventListener('input', e => { maxTokens = +e.target.value; renderRightPanel(); });
  }

  // Context window
  const accCtx = $('#accContextBody');
  if (accCtx) {
    const remaining = sessionExpiresAt ? Math.max(0, sessionExpiresAt - Date.now()) : 0;
    accCtx.innerHTML =
      usageBarHtml('Tokens utilisés', tokenCount.toLocaleString('fr-FR'), '200k', (tokenCount/200000)*100) +
      statRowHtml('Input session', Math.round(tokenCount*0.7).toLocaleString('fr-FR')) +
      statRowHtml('Output session', Math.round(tokenCount*0.3).toLocaleString('fr-FR')) +
      statRowHtml('Messages', String(messages.length)) +
      '<div class="gold-divider"></div>' +
      statRowHtml('Coût session', `$${(tokenCount*0.000004).toFixed(3)}`) +
      statRowHtml('Session expire', formatRemaining(remaining), remaining < 7200000 ? '' : 'success') +
      statRowHtml('Rôle', role.toUpperCase(), role === 'admin' ? 'success' : '');
  }

  // System prompt
  const accPrompt = $('#accPromptBody');
  if (accPrompt) {
    accPrompt.innerHTML = `
      <div class="system-prompt-text">Tu es Hashirama, assistant impérial de Raphael. Tu l'assistes dans la gestion de Groupe Venio, ses cours et ses projets tech.</div>
      <button class="modify-btn">Modifier</button>`;
  }

  // Context tags
  const accTags = $('#accTagsBody');
  if (accTags) {
    accTags.innerHTML = `<div class="tags-wrap">
      ${ALL_TAGS.map(t => `<span class="context-tag${activeTags.includes(t) ? ' active' : ''}" data-tag="${t}">${t}</span>`).join('')}
    </div>`;
    accTags.querySelectorAll('.context-tag').forEach(el => {
      el.addEventListener('click', () => {
        const tag = el.dataset.tag;
        if (activeTags.includes(tag)) activeTags = activeTags.filter(x => x !== tag);
        else activeTags.push(tag);
        renderRightPanel();
      });
    });
  }

  // Theme selector
  const accTheme = $('#accThemeBody');
  if (accTheme) {
    accTheme.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;">
        ${THEMES.map(t => `
          <div class="theme-card${currentTheme === t.id ? ' active' : ''}" data-theme="${t.id}" style="padding:12px;border:1px solid var(--border);cursor:pointer;transition:all 0.2s;${currentTheme === t.id ? 'border-color:var(--gold);background:var(--gold-faint);' : ''}">
            <div style="display:flex;gap:4px;height:24px;margin-bottom:8px;">
              <div style="flex:1;background:${t.primary};border-radius:2px;"></div>
              <div style="flex:1;background:${t.bg};border-radius:2px;"></div>
              <div style="flex:1;background:${t.accent};border-radius:2px;"></div>
            </div>
            <div style="font-size:10px;color:var(--text-dim);text-align:center;margin-bottom:4px;">${t.icon} ${t.name}</div>
          </div>
        `).join('')}
      </div>`;
    accTheme.querySelectorAll('.theme-card').forEach(el => {
      el.addEventListener('click', () => {
        const themeId = el.dataset.theme;
        applyTheme(themeId);
      });
    });
  }

  // VPS
  const accVps = $('#accVpsBody');
  if (accVps) {
    accVps.innerHTML = `
      <div class="vps-grid">
        <div class="vps-card"><span class="vps-card-val ok">●</span><span class="vps-card-label">Statut</span></div>
        <div class="vps-card"><span class="vps-card-val">23%</span><span class="vps-card-label">CPU</span></div>
        <div class="vps-card"><span class="vps-card-val">41%</span><span class="vps-card-label">RAM</span></div>
        <div class="vps-card"><span class="vps-card-val ok">14d</span><span class="vps-card-label">Uptime</span></div>
      </div>
      ${statRowHtml('IP', '••••••••')}
      ${statRowHtml('Port API', ':••••')}
      ${statRowHtml('SSL', 'Valide ✓', 'success')}
      ${statRowHtml('Traefik', 'Actif', 'success')}`;
  }

  // Shortcuts
  const accSc = $('#accShortcutsBody');
  if (accSc) {
    const shortcuts = [["Nouvelle conv.","⌘N"],["Palette cmd.","⌘K"],["Sidebar","⌘B"],["Exporter","⌘E"],["Régénérer","⌘R"],["Paramètres","⌘,"]];
    accSc.innerHTML = shortcuts.map(([a,k]) =>
      `<div class="shortcut-row"><span class="shortcut-action">${a}</span><span class="shortcut-key">${k}</span></div>`
    ).join('');
  }
}

// ── MESSAGES ────────────────────────────────────────────────
// ── THEME SYSTEM ────────────────────────────────────────────
function loadThemeCSS(themeId) {
  if (loadedThemes.has(themeId)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/styles/themes/${themeId}.css`;
  link.id = `theme-${themeId}`;
  document.head.appendChild(link);
  loadedThemes.add(themeId);
}

async function applyTheme(themeId) {
  // Validate theme
  if (!THEMES.find(t => t.id === themeId)) themeId = 'emperor';

  // Update DOM attribute
  document.documentElement.setAttribute('data-theme', themeId);

  // Load theme CSS if needed
  loadThemeCSS(themeId);

  // Save to localStorage
  localStorage.setItem('hashirama_theme', themeId);
  currentTheme = themeId;

  // Save to server if logged in
  if (token) {
    try {
      await fetch('/api/preferences', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ theme: themeId }),
      });
    } catch (e) {
      console.warn('[applyTheme] Failed to save to server:', e);
    }
  }

  // Re-render right panel to update active state
  renderRightPanel();
}

// ── MESSAGES ────────────────────────────────────────────────
function renderMessages() {
  const marker = chatMessages.querySelector('.session-marker');
  chatMessages.innerHTML = '';
  if (marker) chatMessages.appendChild(marker);
  for (const m of messages) chatMessages.appendChild(createMessageEl(m));
  if (typing) chatMessages.appendChild(createTypingEl());
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function createMessageEl(msg) {
  const isUser = msg.role === 'user';
  const div = document.createElement('div');
  div.className = `msg ${msg.role}`;
  div.innerHTML = `
    <div class="msg-avatar">${isUser ? (profile?profile[0].toUpperCase():'R') : 'S'}</div>
    <div class="msg-content">
      <div class="msg-bubble"></div>
      <div class="msg-meta">${msg.time || ''}${msg.meta ? ' · ' + msg.meta : ''}</div>
    </div>`;
  div.querySelector('.msg-bubble').textContent = msg.text;
  return div;
}

function createTypingEl() {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">S</div>
    <div class="typing-dots">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>`;
  return div;
}

function addMessage(r, text, meta) {
  messages.push({ id: Date.now(), role: r, text, time: nowLabel(), meta: meta || (r === 'ai' ? 'claude-sonnet-4-6' : undefined) });
  tokenCount += Math.round(text.length * 0.3);
  renderMessages();
  if (ctxTokens) ctxTokens.textContent = tokenCount.toLocaleString('fr-FR') + ' tk';
}

// ══════════════════════════════════════════════════════════
// SIDEBAR
// ══════════════════════════════════════════════════════════
function openSidebar() { sidebarOpen = true; sidebar.classList.remove('closed'); if (viewport !== 'desktop') sidebarOverlay.classList.add('visible'); }
function closeSidebar() { sidebarOpen = false; sidebar.classList.add('closed'); sidebarOverlay.classList.remove('visible'); }
function toggleSidebar() { if (sidebarOpen) closeSidebar(); else openSidebar(); }

// ══════════════════════════════════════════════════════════
// VIEWPORT
// ══════════════════════════════════════════════════════════
function setViewport(vp) {
  viewport = vp;
  app.className = `app viewport-${vp}`;
  $$('.vp-btn').forEach(b => b.classList.toggle('active', b.dataset.vp === vp));
  if (vp === 'desktop') { openSidebar(); sidebarOverlay.classList.remove('visible'); }
  else closeSidebar();
  if (sendBtn) sendBtn.textContent = vp === 'mobile' ? '↑' : 'Envoyer';
}

// ══════════════════════════════════════════════════════════
// ACCORDION
// ══════════════════════════════════════════════════════════
function setupAccordions() {
  $$('.acc-header').forEach(header => {
    header.addEventListener('click', () => {
      const arrow = header.querySelector('.acc-arrow');
      const body = header.nextElementSibling;
      if (!body) return;
      const isOpen = !body.classList.contains('hidden');
      body.classList.toggle('hidden', isOpen);
      arrow.classList.toggle('open', !isOpen);
    });
  });
}

function setupStatusToggle() {
  statusToggle.addEventListener('click', () => {
    statusWidgetOpen = !statusWidgetOpen;
    statusBody.classList.toggle('hidden', !statusWidgetOpen);
    statusToggle.querySelector('.acc-arrow').classList.toggle('open', statusWidgetOpen);
  });
}

// ══════════════════════════════════════════════════════════
// API
// ══════════════════════════════════════════════════════════
async function api(path, body) {
  const r = await fetch(path, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { handleSessionExpired(); throw new Error('unauthorized'); }
  if (r.status === 403) throw new Error(d.error || 'forbidden');
  if (!r.ok) throw new Error(d.error || 'api_error');
  return d;
}

async function loadHistory() {
  try {
    const r = await fetch('/api/history', { headers: { 'Authorization': `Bearer ${token}` } });
    if (r.status === 401) { handleSessionExpired(); return; }
    const d = await r.json();
    if (d.role) role = d.role;
    messages = (d.items || []).map((m, i) => ({
      id: i, role: m.role === 'user' ? 'user' : 'ai',
      text: m.text, time: m.time || '',
      meta: m.role === 'ai' ? 'claude-sonnet-4-6' : undefined,
    }));
    tokenCount = messages.reduce((acc, m) => acc + Math.round(m.text.length * 0.3), 0);
    if (!messages.length) addMessage('ai', `Je suis prêt à vous servir, Maître. Que désirez-vous accomplir aujourd'hui ?`);
    renderMessages();
    if (ctxTokens) ctxTokens.textContent = tokenCount.toLocaleString('fr-FR') + ' tk';
    renderRightPanel();
    renderStatusWidget();
  } catch (e) { console.error('[loadHistory]', e); }
}

async function login(identifier, password) {
  const r = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  const d = await r.json();

  if (!r.ok) {
    if (d.error === 'password_policy_failed') {
      throw new Error('Mot de passe invalide :\n' + (d.details || []).join('\n'));
    }
    if (d.error === 'account_disabled') throw new Error('Compte désactivé');
    if (d.error === 'too_many_attempts') throw new Error('Trop de tentatives. Réessayez plus tard.');
    if (d.error === 'invalid_credentials') throw new Error('Identifiant ou mot de passe incorrect');
    throw new Error(d.error || 'Erreur de connexion');
  }

  // Handle admin login
  if (d.type === 'admin') {
    adminToken = d.token;
    sessionStorage.setItem('hashi_admin_token', adminToken);
    await adminFetchProfiles();
    loginModal.classList.add('hidden');
    statusLabel.textContent = 'Admin · Actif';
    return;
  }

  // Handle profile login
  saveSession(d.token, d.identifier, d.role || 'user', d.expiresAt || Date.now() + 86400000);

  // Apply theme from server preferences
  if (d.preferences && d.preferences.theme) {
    await applyTheme(d.preferences.theme);
  }

  loginModal.classList.add('hidden');
  statusLabel.textContent = `${profile} · ${role}`;
  navAvatar.textContent = profile.charAt(0).toUpperCase();
  sessionStart = nowLabel();
  sessionTime.textContent = sessionStart;
  startSessionTimer();
  updateSessionDisplay();

  if (d.pinExpired) {
    setTimeout(() => alert('Votre mot de passe a expiré. Veuillez le changer.'), 500);
  }
  if (d.created) {
    setTimeout(() => alert(`Profil "${profile}" créé avec succès.`), 300);
  }

  await loadHistory();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || typing || !token) return;
  addMessage('user', text);
  chatInput.value = '';
  chatInput.style.height = 'auto';
  api('/api/memory/add', { role: 'user', text }).catch(() => {});
  typing = true;
  renderMessages();
  sendBtn.disabled = true;

  try {
    const r = await fetch('/api/chat', { method: 'POST', headers: authHeaders(), body: JSON.stringify({ message: text }) });
    if (r.status === 401) { handleSessionExpired(); return; }
    const d = await r.json().catch(() => ({}));
    typing = false;
    sendBtn.disabled = false;
    if (!r.ok) throw new Error(d.error || 'chat_error');
    const reply = d.reply || 'Réponse vide.';
    const toks = Math.round(reply.length * 0.3);
    addMessage('ai', reply, `${toks} tokens · claude-sonnet-4-6`);
    api('/api/memory/add', { role: 'ai', text: reply }).catch(() => {});
    renderRightPanel();
    renderStatusWidget();
  } catch (e) {
    typing = false;
    sendBtn.disabled = false;
    if (e.message !== 'unauthorized') addMessage('ai', 'Erreur de communication avec le bridge. Réessayez.');
    renderMessages();
  }
}

// ── ADMIN ───────────────────────────────────────────────────
async function adminFetchProfiles() {
  const r = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${adminToken}` } });
  const d = await r.json();
  if (!r.ok) throw new Error('admin_fail');
  adminPanel.style.display = 'block';
  adminProfiles.textContent = (d.items || []).map(p =>
    `${p.disabled?'[DISABLED] ':''}${p.name} | rôle=${p.role} | msgs=${p.messages} | login=${p.lastLogin||'jamais'}${p.pinExpired?' | ⚠ PIN EXPIRÉ':''}`
  ).join('\n') || 'Aucun profil';
}

// ── SESSION MARKER ──────────────────────────────────────────
function updateSessionMarker() {
  const now = new Date();
  const months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
  sessionMarker.textContent = `Session · ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} · ${nowLabel()}`;
}

// ══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════
sidebarToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
convSearch.addEventListener('input', renderConversations);

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
});
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click', sendMessage);

// Unified login form
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identifier = identifierInput.value.trim();
  const password = passwordInput.value;

  if (!identifier || !password) {
    alert('Veuillez renseigner l\'identifiant et le mot de passe');
    return;
  }

  try {
    await login(identifier, password);
  } catch (err) {
    alert(err.message || 'Connexion invalide');
  }
});

// Password strength indicator on input
passwordInput.addEventListener('input', () => {
  const errors = validatePinClient(passwordInput.value);
  if (errors.length > 0) {
    passwordInput.style.borderColor = 'rgba(192,57,43,0.5)';
    passwordInput.title = errors.join(' · ');
  } else if (passwordInput.value.length > 0) {
    passwordInput.style.borderColor = 'rgba(122,138,32,0.5)';
    passwordInput.title = 'Mot de passe conforme';
  } else {
    passwordInput.style.borderColor = '';
    passwordInput.title = '';
  }
});

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal && token) loginModal.classList.add('hidden');
});

navAvatar.addEventListener('click', () => { loginModal.classList.remove('hidden'); });

$$('.vp-btn').forEach(btn => {
  btn.addEventListener('click', () => setViewport(btn.dataset.vp));
});

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
async function init() {
  // Initialize theme from localStorage first (instant)
  await applyTheme(currentTheme);

  updateSessionMarker();
  renderConversations();
  renderStatusWidget();
  renderRightPanel();
  setupAccordions();
  setupStatusToggle();
  await fetchPasswordPolicy();
  sessionStart = nowLabel();
  if (sessionTime) sessionTime.textContent = sessionStart;

  if (token && profile) {
    loginModal.classList.add('hidden');
    statusLabel.textContent = `${profile} · ${role}`;
    navAvatar.textContent = profile.charAt(0).toUpperCase();
    startSessionTimer();
    updateSessionDisplay();
    loadHistory();

    // Sync theme with server
    try {
      const r = await fetch('/api/session/info', { headers: authHeaders() });
      const d = await r.json();
      if (r.ok && d.preferences && d.preferences.theme && d.preferences.theme !== currentTheme) {
        await applyTheme(d.preferences.theme);
      }
    } catch (e) {
      console.warn('[init] Theme sync failed:', e);
    }
  }
  if (adminToken) adminFetchProfiles().catch(() => {});
}

init();
