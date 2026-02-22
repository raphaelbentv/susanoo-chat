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
const newConvBtn     = $('#newConvBtn');
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
const optionsToggle  = $('#optionsToggle');
const optionsModal   = $('#optionsModal');
const closeOptions   = $('#closeOptions');
const optionsModalContent = $('#optionsModalContent');

// ── STATE ───────────────────────────────────────────────────
let viewport         = 'desktop';
let sidebarOpen      = true;
let conversations    = [];              // Liste de toutes les conversations
let activeConversationId = '';          // UUID de la conversation active
let messages         = [];              // Messages de la conversation active
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
let selectedModel    = localStorage.getItem('hashirama_model') || 'claude-sonnet-4';
let deepSearchEnabled = localStorage.getItem('hashirama_deep_search') === 'true';
let activeConnectors = JSON.parse(localStorage.getItem('hashirama_connectors') || '[]');
let searchResults    = [];
let searchDebounce   = null;
let isSearchMode     = false;
let statistics       = null;
let statsLoaded      = false;
let notifications    = [];
let notificationId   = 0;

const ALL_TAGS = ["Venio","Creatio","Arrow","Kuro","MBWAY","EMA","Absys","Bangkok","Instagram","VPS"];

const THEMES = [
  { id: 'obsidian', name: 'Obsidian Sentinel', primary: '#bb1e00', bg: '#030303', accent: '#ff0000', icon: '🗡️' },
  { id: 'cyber', name: 'Electric Ronin', primary: '#00d2ff', bg: '#00050c', accent: '#00ffe0', icon: '⚡' },
  { id: 'emperor', name: 'Gilded Emperor', primary: '#c8a020', bg: '#050408', accent: '#ffd700', icon: '👑' },
  { id: 'ghost', name: 'White Ghost', primary: '#1a1a1a', bg: '#eeecea', accent: '#fff', icon: '👻' },
  { id: 'storm', name: 'Storm Deity', primary: '#8840ff', bg: '#040310', accent: '#9055ff', icon: '⚡' },
  { id: 'brutal', name: 'Brutalist Oracle', primary: '#fff', bg: '#090909', accent: '#000', icon: '▪️' },
];

const MODELS = [
  { id: 'claude-opus-4', name: 'Opus 4', desc: 'Le plus puissant · Raisonnement complexe', cost: 'high' },
  { id: 'claude-sonnet-4', name: 'Sonnet 4', desc: 'Équilibré · Performance/coût optimal', cost: 'medium' },
  { id: 'claude-haiku-4', name: 'Haiku 4', desc: 'Rapide · Tâches simples', cost: 'low' },
];

const CONNECTORS = [
  { id: 'calendar', name: 'Google Calendar', icon: '📅', desc: 'Accès agenda' },
  { id: 'drive', name: 'Google Drive', icon: '📁', desc: 'Documents et fichiers' },
  { id: 'gmail', name: 'Gmail', icon: '✉️', desc: 'Emails et contacts' },
  { id: 'notion', name: 'Notion', icon: '📝', desc: 'Notes et bases de données' },
  { id: 'github', name: 'GitHub', icon: '🐙', desc: 'Repos et code' },
  { id: 'linear', name: 'Linear', icon: '📊', desc: 'Issues et projets' },
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
  let sessionWarningShown = false;
  sessionCheckTimer = setInterval(() => {
    if (!token || !sessionExpiresAt) return;
    const remaining = sessionExpiresAt - Date.now();
    // Update display
    updateSessionDisplay();
    // Expired
    if (remaining <= 0) { handleSessionExpired(); return; }
    // Warning at 10min
    if (remaining < 600000 && !sessionWarningShown) {
      showNotification('warning', 'Session', 'Votre session expire dans 10 minutes. Rafraîchissez-la pour continuer.', 8000);
      sessionWarningShown = true;
    }
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
async function performSearch(query) {
  if (!query || query.length < 2) {
    isSearchMode = false;
    searchResults = [];
    renderConversations();
    return;
  }

  try {
    const r = await fetch('/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query, limit: 30 })
    });

    if (!r.ok) throw new Error('search_failed');

    const data = await r.json();
    searchResults = data.results || [];
    isSearchMode = true;
    renderConversations();
  } catch (e) {
    console.error('Search failed:', e);
  }
}

function renderConversations() {
  const q = convSearch.value.toLowerCase();

  // If in search mode, render search results
  if (isSearchMode && searchResults.length > 0) {
    let html = '<div class="conv-group-label">Résultats de recherche</div>';

    for (const result of searchResults) {
      const time = new Date(result.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const roleIcon = result.role === 'user' ? '👤' : '🤖';
      const snippet = escHtml(result.snippet);

      html += `<div class="conv-item" data-id="${result.conversationId}">
        <div class="conv-title">${escHtml(result.conversationTitle)}</div>
        <div class="conv-preview">${roleIcon} ${snippet}</div>
        <div class="conv-footer">
          <span class="conv-time">${time}</span>
        </div>
      </div>`;
    }

    convList.innerHTML = html;
    convList.querySelectorAll('.conv-item').forEach(el => {
      el.addEventListener('click', () => {
        switchConversation(el.dataset.id);
        if (viewport !== 'desktop') closeSidebar();
      });
    });
    return;
  }

  // Normal mode
  const now = Date.now();
  const oneDayAgo = now - 86400000;
  const oneWeekAgo = now - 7 * 86400000;

  // Group conversations by time
  const pinned = conversations.filter(c => c.pinned && !c.archived);
  const today = conversations.filter(c => !c.pinned && !c.archived && c.updatedAt > oneDayAgo);
  const thisWeek = conversations.filter(c => !c.pinned && !c.archived && c.updatedAt > oneWeekAgo && c.updatedAt <= oneDayAgo);
  const older = conversations.filter(c => !c.pinned && !c.archived && c.updatedAt <= oneWeekAgo);
  const archived = conversations.filter(c => c.archived);

  const groups = [
    { label: 'Épinglées', items: pinned },
    { label: 'Aujourd\'hui', items: today },
    { label: 'Cette semaine', items: thisWeek },
    { label: 'Plus ancien', items: older },
    { label: 'Archivées', items: archived },
  ];

  let html = '';
  for (const g of groups) {
    const items = g.items.filter(c => c.title.toLowerCase().includes(q) || c.preview.toLowerCase().includes(q));
    if (!items.length) continue;

    html += `<div class="conv-group-label">${g.label}</div>`;
    for (const c of items) {
      const active = c.id === activeConversationId ? ' active' : '';
      const time = new Date(c.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      html += `<div class="conv-item${active}" data-id="${c.id}">
        <div class="conv-title">${escHtml(c.title)}${c.pinned ? ' 📌' : ''}</div>
        <div class="conv-preview">${escHtml(c.preview)}</div>
        <div class="conv-footer">
          <span class="conv-time">${time}</span>
          ${c.messageCount ? `<span class="conv-badge">${c.messageCount}</span>` : ''}
        </div>
      </div>`;
    }
  }

  if (!html && !q) {
    html = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:11px;">Aucune conversation<br><br>Cliquez sur + pour démarrer</div>';
  } else if (!html && q) {
    html = '<div style="padding:20px;text-align:center;color:var(--text-faint);font-size:11px;">Aucun résultat</div>';
  }

  convList.innerHTML = html;
  convList.querySelectorAll('.conv-item').forEach(el => {
    el.addEventListener('click', (e) => {
      // Context menu on right click
      if (e.button === 2 || e.ctrlKey) {
        e.preventDefault();
        showConversationMenu(el.dataset.id, e.clientX, e.clientY);
        return;
      }

      // Normal click - switch conversation
      switchConversation(el.dataset.id);
      if (viewport !== 'desktop') closeSidebar();
    });

    // Right click menu
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showConversationMenu(el.dataset.id, e.clientX, e.clientY);
    });
  });
}

function showConversationMenu(conversationId, x, y) {
  const conv = conversations.find(c => c.id === conversationId);
  if (!conv) return;

  const menu = document.createElement('div');
  menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:var(--surface);border:1px solid var(--border);padding:4px;z-index:10000;min-width:150px;box-shadow:0 4px 20px rgba(0,0,0,0.5);`;

  const actions = [
    { label: '✏️ Renommer', action: () => renameConversation(conversationId) },
    { label: conv.pinned ? '📌 Désépingler' : '📌 Épingler', action: () => updateConversation(conversationId, { pinned: !conv.pinned }) },
    { label: conv.archived ? '📂 Désarchiver' : '📁 Archiver', action: () => updateConversation(conversationId, { archived: !conv.archived }) },
    { label: '💾 Exporter...', action: () => showExportMenu(conversationId, x + 160, y) },
    { label: '🗑️ Supprimer', action: () => deleteConversation(conversationId) },
  ];

  menu.innerHTML = actions.map(a =>
    `<div style="padding:6px 10px;cursor:pointer;font-size:12px;color:var(--text);" class="menu-item">${a.label}</div>`
  ).join('');

  menu.querySelectorAll('.menu-item').forEach((el, idx) => {
    el.addEventListener('click', () => {
      actions[idx].action();
      document.body.removeChild(menu);
    });
    el.addEventListener('mouseenter', () => el.style.background = 'var(--gold-faint)');
    el.addEventListener('mouseleave', () => el.style.background = 'transparent');
  });

  document.body.appendChild(menu);

  const closeMenu = () => {
    if (document.body.contains(menu)) document.body.removeChild(menu);
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

function renameConversation(conversationId) {
  const conv = conversations.find(c => c.id === conversationId);
  if (!conv) return;

  const newTitle = prompt('Nouveau titre:', conv.title);
  if (newTitle && newTitle.trim()) {
    updateConversation(conversationId, { title: newTitle.trim() });
  }
}

function showExportMenu(conversationId, x, y) {
  const menu = document.createElement('div');
  menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:var(--surface);border:1px solid var(--border);padding:4px;z-index:10001;min-width:120px;box-shadow:0 4px 20px rgba(0,0,0,0.5);`;

  const formats = [
    { label: '📄 Markdown', format: 'md' },
    { label: '📋 JSON', format: 'json' },
  ];

  menu.innerHTML = formats.map(f =>
    `<div style="padding:6px 10px;cursor:pointer;font-size:12px;color:var(--text);" class="menu-item" data-format="${f.format}">${f.label}</div>`
  ).join('');

  menu.querySelectorAll('.menu-item').forEach(el => {
    el.addEventListener('click', () => {
      exportConversation(conversationId, el.dataset.format);
      if (document.body.contains(menu)) document.body.removeChild(menu);
    });
    el.addEventListener('mouseenter', () => el.style.background = 'var(--gold-faint)');
    el.addEventListener('mouseleave', () => el.style.background = 'transparent');
  });

  document.body.appendChild(menu);

  const closeMenu = () => {
    if (document.body.contains(menu)) document.body.removeChild(menu);
    document.removeEventListener('click', closeMenu);
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

async function exportConversation(conversationId, format) {
  try {
    const url = `/api/conversations/${conversationId}/export?format=${format}`;
    const r = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!r.ok) throw new Error('export_failed');

    const blob = await r.blob();
    const disposition = r.headers.get('Content-Disposition');
    const filenameMatch = disposition?.match(/filename="(.+)"/);
    const filename = filenameMatch ? filenameMatch[1] : `export.${format}`;

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  } catch (e) {
    alert('Échec de l\'export. Vérifiez votre connexion.');
  }
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
  // Model selection
  const accModel = $('#accModelBody');
  if (accModel) {
    const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[1];
    accModel.innerHTML = `
      <div style="margin-bottom:12px;">
        ${MODELS.map(m => `
          <div class="model-card${m.id === selectedModel ? ' active' : ''}" data-model="${m.id}" style="padding:10px 12px;margin-bottom:8px;border:1px solid var(--border-dim);cursor:pointer;transition:all 0.15s;${m.id === selectedModel ? 'border-color:var(--gold);background:var(--gold-faint);' : ''}">
            <div class="model-card-name" style="font-size:11px;">${m.name}</div>
            <div class="model-card-desc" style="font-size:10px;">${m.desc}</div>
          </div>
        `).join('')}
      </div>
      <div class="gold-divider"></div>
      <div class="stat-row"><span class="stat-key">Température</span><span class="stat-val">${(temperature/100).toFixed(2)}</span></div>
      <input type="range" min="0" max="100" value="${temperature}" id="tempSlider">
      <div class="stat-row" style="margin-top:4px"><span class="stat-key">Max tokens</span><span class="stat-val">${Math.round(maxTokens*81.92).toLocaleString('fr-FR')}</span></div>
      <input type="range" min="10" max="100" value="${maxTokens}" id="maxTokSlider">`;

    accModel.querySelectorAll('.model-card').forEach(el => {
      el.addEventListener('click', () => {
        selectedModel = el.dataset.model;
        localStorage.setItem('hashirama_model', selectedModel);
        renderRightPanel();
      });
    });
    $('#tempSlider')?.addEventListener('input', e => { temperature = +e.target.value; renderRightPanel(); });
    $('#maxTokSlider')?.addEventListener('input', e => { maxTokens = +e.target.value; renderRightPanel(); });
  }

  // Context window
  const accCtx = $('#accContextBody');
  if (accCtx) {
    const remaining = sessionExpiresAt ? Math.max(0, sessionExpiresAt - Date.now()) : 0;
    let html =
      usageBarHtml('Tokens utilisés', tokenCount.toLocaleString('fr-FR'), '200k', (tokenCount/200000)*100) +
      statRowHtml('Input session', Math.round(tokenCount*0.7).toLocaleString('fr-FR')) +
      statRowHtml('Output session', Math.round(tokenCount*0.3).toLocaleString('fr-FR')) +
      statRowHtml('Messages', String(messages.length)) +
      '<div class="gold-divider"></div>' +
      statRowHtml('Coût session', `$${(tokenCount*0.000004).toFixed(3)}`) +
      statRowHtml('Session expire', formatRemaining(remaining), remaining < 7200000 ? '' : 'success') +
      statRowHtml('Rôle', role.toUpperCase(), role === 'admin' ? 'success' : '');

    // Statistics section
    if (statsLoaded && statistics) {
      html += '<div class="gold-divider" style="margin-top:14px;"></div>';
      html += '<div style="margin-top:10px;font-size:9px;color:var(--gold);opacity:0.5;text-transform:uppercase;letter-spacing:2px;">Statistiques globales</div>';
      html += statRowHtml('Conversations', String(statistics.totalConversations));
      html += statRowHtml('Messages totaux', statistics.totalMessages.toLocaleString('fr-FR'));
      html += statRowHtml('Tokens totaux', statistics.totalTokens.toLocaleString('fr-FR'));
      html += statRowHtml('Coût total', `$${statistics.totalCost.toFixed(2)}`);
      html += statRowHtml('Moy. msg/jour', statistics.averageMessagesPerDay.toFixed(1));

      // Model usage chart (simple bars)
      if (statistics.modelUsage.length > 0) {
        html += '<div class="gold-divider" style="margin-top:10px;"></div>';
        html += '<div style="margin-top:8px;font-size:9px;color:var(--gold);opacity:0.5;text-transform:uppercase;letter-spacing:2px;">Modèles utilisés</div>';
        for (const model of statistics.modelUsage) {
          html += `<div style="margin:6px 0;">
            <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px;">
              <span style="color:var(--text-faint);">${model.model}</span>
              <span style="color:var(--gold);">${model.percentage.toFixed(0)}%</span>
            </div>
            <div style="height:3px;background:rgba(170,120,25,0.1);">
              <div style="height:100%;width:${model.percentage}%;background:var(--gold);"></div>
            </div>
          </div>`;
        }
      }
    } else {
      html += '<div class="gold-divider" style="margin-top:14px;"></div>';
      html += '<button class="modify-btn" id="loadStatsBtn">Charger les statistiques</button>';
    }

    accCtx.innerHTML = html;

    // Add event listener for load stats button
    $('#loadStatsBtn')?.addEventListener('click', () => loadStatistics('all'));
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

  // Options
  const accOptions = $('#accOptionsBody');
  if (accOptions) {
    accOptions.innerHTML = `
      <div style="padding:10px 12px;border:1px solid var(--border-dim);margin-bottom:10px;cursor:pointer;transition:all 0.15s;${deepSearchEnabled ? 'border-color:var(--gold);background:var(--gold-faint);' : ''}" id="deepSearchToggle">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-family:var(--font-mono);font-size:9px;color:var(--gold);opacity:0.8;margin-bottom:3px;">RECHERCHE APPROFONDIE</div>
            <div style="font-size:10px;color:var(--text-faint);">Web search + analyse multi-sources</div>
          </div>
          <div style="font-size:18px;">${deepSearchEnabled ? '✓' : '○'}</div>
        </div>
      </div>
      ${statRowHtml('Streaming', 'Activé', 'success')}
      ${statRowHtml('Top-P', '0.95')}
      ${statRowHtml('Safety', 'Standard')}`;

    $('#deepSearchToggle')?.addEventListener('click', () => {
      deepSearchEnabled = !deepSearchEnabled;
      localStorage.setItem('hashirama_deep_search', String(deepSearchEnabled));
      renderRightPanel();
    });
  }

  // Connecteurs
  const accConnectors = $('#accConnectorsBody');
  if (accConnectors) {
    accConnectors.innerHTML = `
      <div style="display:grid;gap:8px;">
        ${CONNECTORS.map(c => `
          <div class="connector-card${activeConnectors.includes(c.id) ? ' active' : ''}" data-connector="${c.id}" style="padding:10px 12px;border:1px solid var(--border-dim);cursor:pointer;transition:all 0.15s;${activeConnectors.includes(c.id) ? 'border-color:var(--gold);background:var(--gold-faint);' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:16px;">${c.icon}</span>
                <div>
                  <div style="font-size:11px;color:var(--text);margin-bottom:2px;">${c.name}</div>
                  <div style="font-size:9px;color:var(--text-faint);">${c.desc}</div>
                </div>
              </div>
              <div style="font-size:14px;color:var(--gold);">${activeConnectors.includes(c.id) ? '✓' : '○'}</div>
            </div>
          </div>
        `).join('')}
      </div>`;

    accConnectors.querySelectorAll('.connector-card').forEach(el => {
      el.addEventListener('click', () => {
        const connectorId = el.dataset.connector;
        if (activeConnectors.includes(connectorId)) {
          activeConnectors = activeConnectors.filter(x => x !== connectorId);
        } else {
          activeConnectors.push(connectorId);
        }
        localStorage.setItem('hashirama_connectors', JSON.stringify(activeConnectors));
        renderRightPanel();
      });
    });
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

// ── CONVERSATIONS API ───────────────────────────────────────
async function loadConversations() {
  try {
    const r = await fetch('/api/conversations', { headers: authHeaders() });
    if (r.status === 401) { handleSessionExpired(); return; }
    const d = await r.json();
    if (r.ok) {
      conversations = d.items || [];
      renderConversations();
    }
  } catch (e) {
    console.error('[loadConversations]', e);
  }
}

async function createNewConversation(title = '') {
  try {
    const r = await fetch('/api/conversations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: title || undefined }),
    });
    if (r.status === 401) { handleSessionExpired(); return null; }
    const d = await r.json();
    if (r.ok) {
      const conv = d.conversation;
      conversations.unshift(conv);
      renderConversations();
      return conv;
    }
  } catch (e) {
    console.error('[createNewConversation]', e);
  }
  return null;
}

async function switchConversation(conversationId) {
  try {
    activeConversationId = conversationId;
    const r = await fetch(`/api/conversations/${conversationId}/messages`, { headers: authHeaders() });
    if (r.status === 401) { handleSessionExpired(); return; }
    const d = await r.json();
    if (r.ok) {
      messages = d.messages.map(m => ({
        role: m.role,
        text: m.content,
        time: new Date(m.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        meta: m.metadata.model ? `${m.metadata.tokensUsed || 0} tokens · ${m.metadata.model}` : '',
      }));
      tokenCount = d.messages.reduce((sum, m) => sum + (m.metadata.tokensUsed || 0), 0);
      renderMessages();
      renderConversations();
      renderRightPanel();
    }
  } catch (e) {
    console.error('[switchConversation]', e);
  }
}

async function updateConversation(conversationId, updates) {
  try {
    const r = await fetch(`/api/conversations/${conversationId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (r.status === 401) { handleSessionExpired(); return false; }
    const d = await r.json();
    if (r.ok) {
      const idx = conversations.findIndex(c => c.id === conversationId);
      if (idx !== -1) conversations[idx] = { ...conversations[idx], ...updates };
      renderConversations();
      return true;
    }
  } catch (e) {
    console.error('[updateConversation]', e);
  }
  return false;
}

async function deleteConversation(conversationId) {
  if (!confirm('Supprimer cette conversation?')) return false;

  try {
    const r = await fetch(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (r.status === 401) { handleSessionExpired(); return false; }
    if (r.ok) {
      conversations = conversations.filter(c => c.id !== conversationId);
      if (activeConversationId === conversationId) {
        activeConversationId = '';
        messages = [];
        renderMessages();
      }
      renderConversations();
      return true;
    }
  } catch (e) {
    console.error('[deleteConversation]', e);
  }
  return false;
}

async function loadStatistics(period = 'all') {
  try {
    const r = await fetch(`/api/statistics?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!r.ok) throw new Error('stats_failed');

    const data = await r.json();
    statistics = data.statistics;
    statsLoaded = true;
    renderRightPanel();
  } catch (e) {
    console.error('Failed to load statistics:', e);
  }
}

async function loadHistory() {
  // Load conversations instead of old memory system
  await loadConversations();

  // If no conversations, welcome message
  if (conversations.length === 0) {
    messages = [{
      role: 'ai',
      text: 'Je suis prêt à vous servir, Maître. Que désirez-vous accomplir aujourd\'hui ?',
      time: nowLabel(),
      meta: ''
    }];
    renderMessages();
  } else {
    // Load most recent conversation
    const recent = conversations[0];
    if (recent) {
      await switchConversation(recent.id);
    }
  }

  renderRightPanel();
  renderStatusWidget();
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

  // Create new conversation if none is active
  if (!activeConversationId) {
    const newConv = await createNewConversation();
    if (!newConv) return;
    activeConversationId = newConv.id;
  }

  addMessage('user', text);
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Add user message to conversation
  await fetch(`/api/conversations/${activeConversationId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      role: 'user',
      content: text,
      metadata: {
        contexts: activeTags,
        connectors: activeConnectors,
      },
    }),
  }).catch(() => {});

  typing = true;
  renderMessages();
  sendBtn.disabled = true;

  try {
    const payload = {
      message: text,
      model: selectedModel,
      temperature: temperature / 100,
      maxTokens: Math.round(maxTokens * 81.92),
      deepSearch: deepSearchEnabled,
      contexts: activeTags,
      connectors: activeConnectors,
    };

    const r = await fetch('/api/chat', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    if (r.status === 401) { handleSessionExpired(); return; }
    const d = await r.json().catch(() => ({}));
    typing = false;
    sendBtn.disabled = false;
    if (!r.ok) throw new Error(d.error || 'chat_error');

    const reply = d.reply || 'Réponse vide.';
    const toks = d.tokensUsed || Math.round(reply.length * 0.3);
    const modelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel;
    addMessage('ai', reply, `${toks} tokens · ${modelName}`);
    tokenCount += toks;

    // Add AI message to conversation
    await fetch(`/api/conversations/${activeConversationId}/messages`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        role: 'ai',
        content: reply,
        metadata: {
          model: selectedModel,
          tokensUsed: toks,
          temperature: temperature / 100,
          maxTokens: Math.round(maxTokens * 81.92),
          deepSearch: deepSearchEnabled,
          contexts: activeTags,
          connectors: activeConnectors,
        },
      }),
    }).catch(() => {});

    // Reload conversations to update preview
    await loadConversations();

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

// ── NOTIFICATIONS ───────────────────────────────────────────
function showNotification(type, title, message, duration = 5000) {
  const id = ++notificationId;
  const notification = { id, type, title, message, timestamp: Date.now() };
  notifications.push(notification);

  const toast = document.createElement('div');
  toast.id = `toast-${id}`;
  toast.style.cssText = `
    position:fixed;top:${20 + notifications.length * 10}px;right:20px;
    min-width:300px;max-width:400px;
    background:var(--surface);border:1px solid var(--border);
    padding:12px 16px;z-index:9999;
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
    animation:slideInRight 0.3s ease-out;
  `;

  const colors = {
    info: 'var(--gold)',
    success: 'var(--success)',
    warning: '#f39c12',
    error: 'var(--danger)',
  };

  const icons = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠️',
    error: '✕',
  };

  toast.innerHTML = `
    <div style="display:flex;gap:10px;align-items:start;">
      <div style="font-size:18px;">${icons[type] || 'ℹ️'}</div>
      <div style="flex:1;">
        <div style="font-family:var(--font-display);font-size:11px;color:${colors[type]};margin-bottom:4px;letter-spacing:1px;text-transform:uppercase;">${title}</div>
        <div style="font-size:10px;color:var(--text-dim);line-height:1.5;">${message}</div>
      </div>
      <button style="background:none;border:none;color:var(--text-faint);cursor:pointer;font-size:14px;padding:0;width:16px;height:16px;" onclick="document.body.removeChild(document.getElementById('toast-${id}'))">✕</button>
    </div>
  `;

  document.body.appendChild(toast);

  // Auto-dismiss
  if (duration > 0) {
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
          if (document.body.contains(toast)) document.body.removeChild(toast);
        }, 300);
      }
      notifications = notifications.filter(n => n.id !== id);
    }, duration);
  }
}

// Add CSS animation
if (!document.getElementById('toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes slideInRight {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ── KEYBOARD SHORTCUTS ──────────────────────────────────────
function handleGlobalShortcuts(e) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdKey = isMac ? e.metaKey : e.ctrlKey;

  // Ignore if typing in input/textarea (except specific shortcuts)
  const target = e.target;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

  // Esc: Close modals
  if (e.key === 'Escape') {
    if (!loginModal.classList.contains('hidden')) loginModal.classList.add('hidden');
    if (optionsModal && !optionsModal.classList.contains('hidden')) optionsModal.classList.add('hidden');
    return;
  }

  // Don't interfere with typing (except global shortcuts)
  if (isInput && !cmdKey) return;

  // Ctrl/Cmd + K: Focus search
  if (cmdKey && e.key === 'k') {
    e.preventDefault();
    convSearch.focus();
    return;
  }

  // Ctrl/Cmd + N: New conversation
  if (cmdKey && e.key === 'n') {
    e.preventDefault();
    createNewConversation().then(conv => {
      if (conv) {
        activeConversationId = conv.id;
        messages = [];
        renderConversations();
        renderMessages();
      }
    });
    return;
  }

  // Ctrl/Cmd + E: Export active conversation
  if (cmdKey && e.key === 'e') {
    e.preventDefault();
    if (activeConversationId) {
      exportConversation(activeConversationId, 'md');
    }
    return;
  }

  // Ctrl/Cmd + B: Toggle sidebar
  if (cmdKey && e.key === 'b') {
    e.preventDefault();
    toggleSidebar();
    return;
  }

  // Ctrl/Cmd + /: Show shortcuts
  if (cmdKey && e.key === '/') {
    e.preventDefault();
    showShortcutsHelp();
    return;
  }
}

function showShortcutsHelp() {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmd = isMac ? '⌘' : 'Ctrl';

  const shortcuts = [
    { keys: `${cmd} + K`, action: 'Focus recherche' },
    { keys: `${cmd} + N`, action: 'Nouvelle conversation' },
    { keys: `${cmd} + E`, action: 'Exporter la conversation' },
    { keys: `${cmd} + B`, action: 'Afficher/masquer sidebar' },
    { keys: `${cmd} + /`, action: 'Afficher les raccourcis' },
    { keys: 'Esc', action: 'Fermer les modaux' },
    { keys: 'Enter', action: 'Envoyer le message' },
    { keys: 'Shift + Enter', action: 'Nouvelle ligne' },
  ];

  const html = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;" id="shortcutsModal">
      <div style="background:var(--surface);border:1px solid var(--border);padding:24px;max-width:500px;width:90%;">
        <div style="font-family:var(--font-display);font-size:16px;color:var(--gold);margin-bottom:16px;text-transform:uppercase;letter-spacing:3px;">Raccourcis Clavier</div>
        ${shortcuts.map(s => `
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-dim);">
            <span style="color:var(--text-faint);font-size:11px;">${s.action}</span>
            <span style="color:var(--gold);font-family:var(--font-mono);font-size:10px;border:1px solid var(--border-dim);padding:2px 8px;background:var(--gold-faint);">${s.keys}</span>
          </div>
        `).join('')}
        <button class="modify-btn" style="margin-top:16px;" id="closeShortcuts">Fermer</button>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.innerHTML = html;
  document.body.appendChild(modal);

  const closeBtn = $('#closeShortcuts');
  closeBtn?.addEventListener('click', () => document.body.removeChild(modal));
  $('#shortcutsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'shortcutsModal') document.body.removeChild(modal);
  });
}

// ══════════════════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════════════════
document.addEventListener('keydown', handleGlobalShortcuts);
sidebarToggle.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
convSearch.addEventListener('input', (e) => {
  const query = e.target.value.trim();

  // Clear previous debounce
  if (searchDebounce) clearTimeout(searchDebounce);

  // If query is empty, reset to normal mode
  if (query.length === 0) {
    isSearchMode = false;
    searchResults = [];
    renderConversations();
    return;
  }

  // Debounce search (wait 500ms after typing stops)
  searchDebounce = setTimeout(() => {
    performSearch(query);
  }, 500);
});
newConvBtn.addEventListener('click', async () => {
  const newConv = await createNewConversation();
  if (newConv) {
    activeConversationId = newConv.id;
    messages = [];
    renderConversations();
    renderMessages();
  }
});

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

// Options modal (mobile/tablet)
function renderOptionsModal() {
  if (!optionsModalContent) return;

  optionsModalContent.innerHTML = `
    <div class="acc-section">
      <div class="acc-header" style="cursor:default;">
        <span>Modèle IA</span>
      </div>
      <div class="acc-body" id="modalAccModelBody"></div>
    </div>
    <div class="acc-section">
      <div class="acc-header" style="cursor:default;">
        <span>Options Avancées</span>
      </div>
      <div class="acc-body" id="modalAccOptionsBody"></div>
    </div>
    <div class="acc-section">
      <div class="acc-header" style="cursor:default;">
        <span>Connecteurs</span>
      </div>
      <div class="acc-body" id="modalAccConnectorsBody"></div>
    </div>
    <div class="acc-section">
      <div class="acc-header" style="cursor:default;">
        <span>Thème Visuel</span>
      </div>
      <div class="acc-body" id="modalAccThemeBody"></div>
    </div>`;

  // Copy content from right panel to modal
  const accModel = $('#accModelBody');
  const modalAccModel = $('#modalAccModelBody');
  if (accModel && modalAccModel) modalAccModel.innerHTML = accModel.innerHTML;

  const accOptions = $('#accOptionsBody');
  const modalAccOptions = $('#modalAccOptionsBody');
  if (accOptions && modalAccOptions) modalAccOptions.innerHTML = accOptions.innerHTML;

  const accConnectors = $('#accConnectorsBody');
  const modalAccConnectors = $('#modalAccConnectorsBody');
  if (accConnectors && modalAccConnectors) modalAccConnectors.innerHTML = accConnectors.innerHTML;

  const accTheme = $('#accThemeBody');
  const modalAccTheme = $('#modalAccThemeBody');
  if (accTheme && modalAccTheme) modalAccTheme.innerHTML = accTheme.innerHTML;

  // Re-attach event listeners (since we copied innerHTML, events are lost)
  setTimeout(() => {
    modalAccModel?.querySelectorAll('.model-card').forEach(el => {
      el.addEventListener('click', () => {
        selectedModel = el.dataset.model;
        localStorage.setItem('hashirama_model', selectedModel);
        renderRightPanel();
        renderOptionsModal();
      });
    });

    modalAccModel?.querySelector('#tempSlider')?.addEventListener('input', e => {
      temperature = +e.target.value;
      renderRightPanel();
      renderOptionsModal();
    });

    modalAccModel?.querySelector('#maxTokSlider')?.addEventListener('input', e => {
      maxTokens = +e.target.value;
      renderRightPanel();
      renderOptionsModal();
    });

    modalAccOptions?.querySelector('#deepSearchToggle')?.addEventListener('click', () => {
      deepSearchEnabled = !deepSearchEnabled;
      localStorage.setItem('hashirama_deep_search', String(deepSearchEnabled));
      renderRightPanel();
      renderOptionsModal();
    });

    modalAccConnectors?.querySelectorAll('.connector-card').forEach(el => {
      el.addEventListener('click', () => {
        const connectorId = el.dataset.connector;
        if (activeConnectors.includes(connectorId)) {
          activeConnectors = activeConnectors.filter(x => x !== connectorId);
        } else {
          activeConnectors.push(connectorId);
        }
        localStorage.setItem('hashirama_connectors', JSON.stringify(activeConnectors));
        renderRightPanel();
        renderOptionsModal();
      });
    });

    modalAccTheme?.querySelectorAll('.theme-card').forEach(el => {
      el.addEventListener('click', () => {
        const themeId = el.dataset.theme;
        applyTheme(themeId);
        renderOptionsModal();
      });
    });
  }, 10);
}

optionsToggle?.addEventListener('click', () => {
  renderOptionsModal();
  optionsModal.classList.remove('hidden');
});

closeOptions?.addEventListener('click', () => {
  optionsModal.classList.add('hidden');
});

optionsModal?.addEventListener('click', (e) => {
  if (e.target === optionsModal) optionsModal.classList.add('hidden');
});

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
