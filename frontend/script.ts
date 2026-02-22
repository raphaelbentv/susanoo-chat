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
const hashiramaConnectionDot = $('#hashiramaConnectionDot');
const claudeToggle = $('#claudeToggle');
const claudeToggleInput = $('#claudeToggleInput') as HTMLInputElement;
const adminToggle = $('#adminToggle');
const artifactPanel = $('#artifactPanel');
const artifactFrame = $('#artifactFrame') as HTMLIFrameElement;
const artifactName = $('#artifactName');
const artifactCopy = $('#artifactCopy');
const artifactDownload = $('#artifactDownload');
const artifactClose = $('#artifactClose');
const accAdminSection = $('#accAdminSection');
const accAdminBody = $('#accAdminBody');

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
let isAdmin          = sessionStorage.getItem('hashi_is_admin') === 'true';
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
let hashiramaStatus  = null;
let claudeEnabled = false;
let currentArtifact = null; // { type: 'html'|'svg'|'react', code: string, title: string }
let adminUsers = []; // Liste des utilisateurs pour l'admin
let adminAuditLog = []; // Logs d'audit pour l'admin

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

  // Hashirama status data (real or placeholder)
  let claudeVersion = 'Chargement...';
  let claudeService = 'Claude Code';

  if (hashiramaStatus && hashiramaStatus.connected) {
    claudeVersion = hashiramaStatus.version || 'Unknown';
    claudeService = hashiramaStatus.service || 'Claude Code';
  } else if (hashiramaStatus && hashiramaStatus.error) {
    claudeVersion = 'Déconnecté';
    claudeService = 'Erreur';
  }

  statusBody.innerHTML =
    usageBarHtml('Contexte session', tokenCount.toLocaleString('fr-FR'), '200k', (tokenCount/200000)*100) +
    usageBarHtml('Session TTL', formatRemaining(remaining), '24h', sessionPct, remaining < 7200000 ? 'var(--danger)' : 'var(--gold)') +
    '<div class="gold-divider"></div>' +
    statRowHtml('Modèle actif', MODELS.find(m => m.id === selectedModel)?.name || selectedModel) +
    statRowHtml('Rôle', role.toUpperCase(), role === 'admin' ? 'success' : '') +
    statRowHtml('Service IA', claudeService) +
    statRowHtml('Version', claudeVersion) +
    (!hashiramaStatus ? '<button class="modify-btn" id="loadHashiramaBtn" style="margin-top:8px;font-size:9px;padding:4px 0;">Charger statut</button>' : '');

  // Add event listener for load button
  $('#loadHashiramaBtn')?.addEventListener('click', loadHashiramaStatus);
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
      </div>`;

    accModel.querySelectorAll('.model-card').forEach(el => {
      el.addEventListener('click', () => {
        selectedModel = el.dataset.model;
        localStorage.setItem('hashirama_model', selectedModel);
        console.log('[DEBUG] Model changed to:', selectedModel);
        renderRightPanel();
        renderStatusWidget();
      });
    });
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
      <div class="gold-divider" style="margin:12px 0;"></div>
      <div class="stat-row"><span class="stat-key">Température</span><span class="stat-val">${(temperature/100).toFixed(2)}</span></div>
      <input type="range" min="0" max="100" value="${temperature}" id="tempSlider" style="width:100%;margin-bottom:8px;">
      <div class="stat-row"><span class="stat-key">Max tokens</span><span class="stat-val">${Math.round(maxTokens*81.92).toLocaleString('fr-FR')}</span></div>
      <input type="range" min="10" max="100" value="${maxTokens}" id="maxTokSlider" style="width:100%;margin-bottom:8px;">
      <div class="gold-divider" style="margin:12px 0;"></div>
      ${statRowHtml('Streaming', 'Activé', 'success')}
      ${statRowHtml('Top-P', '0.95')}
      ${statRowHtml('Safety', 'Standard')}`;

    $('#deepSearchToggle')?.addEventListener('click', () => {
      deepSearchEnabled = !deepSearchEnabled;
      localStorage.setItem('hashirama_deep_search', String(deepSearchEnabled));
      renderRightPanel();
    });

    $('#tempSlider')?.addEventListener('input', e => {
      temperature = +e.target.value;
      renderRightPanel();
    });

    $('#maxTokSlider')?.addEventListener('input', e => {
      maxTokens = +e.target.value;
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

// ── MARKDOWN PARSER ─────────────────────────────────────────
function parseMarkdown(text: string): string {
  // Escape HTML first to prevent XSS
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (must be before inline code)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Unordered lists
  html = html.replace(/^[*-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

  // Line breaks (double newline = paragraph)
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

// ── ARTIFACT DETECTION ──────────────────────────────────────
function detectArtifact(text: string): { type: string; code: string; title: string; cleanText: string } | null {
  // Detect HTML artifacts
  const htmlMatch = text.match(/```html\n([\s\S]*?)```/);
  if (htmlMatch) {
    const code = htmlMatch[1].trim();
    // Only treat as artifact if it contains meaningful HTML structure
    if (code.includes('<html') || code.includes('<!DOCTYPE') || (code.includes('<div') && code.includes('<style'))) {
      return {
        type: 'html',
        code: code,
        title: 'HTML Artifact',
        cleanText: text.replace(htmlMatch[0], '[Voir l\'artefact →]')
      };
    }
  }

  // Detect SVG artifacts
  const svgMatch = text.match(/```svg\n([\s\S]*?)```/);
  if (svgMatch) {
    const code = svgMatch[1].trim();
    if (code.includes('<svg')) {
      return {
        type: 'svg',
        code: code,
        title: 'SVG Artifact',
        cleanText: text.replace(svgMatch[0], '[Voir l\'artefact →]')
      };
    }
  }

  // Detect standalone HTML/SVG in code blocks
  const codeBlockMatch = text.match(/```\n([\s\S]*?)```/);
  if (codeBlockMatch) {
    const code = codeBlockMatch[1].trim();
    if (code.startsWith('<!DOCTYPE') || code.startsWith('<html') || code.startsWith('<svg')) {
      return {
        type: code.startsWith('<svg') ? 'svg' : 'html',
        code: code,
        title: code.startsWith('<svg') ? 'SVG Artifact' : 'HTML Artifact',
        cleanText: text.replace(codeBlockMatch[0], '[Voir l\'artefact →]')
      };
    }
  }

  return null;
}

function showArtifact(artifact: { type: string; code: string; title: string }) {
  currentArtifact = artifact;
  artifactName.textContent = artifact.title;

  // Prepare the content based on type
  let content = artifact.code;

  if (artifact.type === 'svg') {
    // Wrap SVG in minimal HTML
    content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
    svg { max-width: 100%; height: auto; }
  </style>
</head>
<body>${artifact.code}</body>
</html>`;
  } else if (artifact.type === 'html' && !artifact.code.includes('<!DOCTYPE') && !artifact.code.includes('<html')) {
    // Wrap partial HTML
    content = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>${artifact.code}</body>
</html>`;
  }

  // Render in iframe
  const doc = artifactFrame.contentDocument || artifactFrame.contentWindow.document;
  doc.open();
  doc.write(content);
  doc.close();

  // Show panel
  artifactPanel.classList.remove('hidden');
}

function hideArtifact() {
  artifactPanel.classList.add('hidden');
  currentArtifact = null;
}

function copyArtifactCode() {
  if (!currentArtifact) return;
  navigator.clipboard.writeText(currentArtifact.code)
    .then(() => alert('Code copié dans le presse-papier'))
    .catch(() => alert('Erreur lors de la copie'));
}

function downloadArtifact() {
  if (!currentArtifact) return;

  const extension = currentArtifact.type === 'svg' ? 'svg' : 'html';
  const blob = new Blob([currentArtifact.code], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `artifact-${Date.now()}.${extension}`;
  a.click();
  URL.revokeObjectURL(url);
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

  // Detect artifacts in AI messages
  let artifact = null;
  let textToRender = msg.text;

  if (msg.role === 'ai') {
    artifact = detectArtifact(msg.text);
    if (artifact) {
      textToRender = artifact.cleanText;
    }
  }

  // Render markdown for AI messages, plain text for user messages
  const bubble = div.querySelector('.msg-bubble');
  if (msg.role === 'ai') {
    bubble.innerHTML = parseMarkdown(textToRender);

    // Add artifact button if detected
    if (artifact) {
      const artifactBtn = document.createElement('button');
      artifactBtn.className = 'artifact-preview-btn';
      artifactBtn.innerHTML = '⚡ Voir l\'artefact';
      artifactBtn.onclick = () => showArtifact(artifact);
      bubble.appendChild(artifactBtn);
    }
  } else {
    bubble.textContent = msg.text;
  }

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
  if (vp === 'desktop') { openSidebar(); sidebarOverlay.classList.remove('visible'); }
  else closeSidebar();
  if (sendBtn) sendBtn.textContent = vp === 'mobile' ? '↑' : 'Envoyer';
}

function detectViewport() {
  const width = window.innerWidth;
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
}

function updateViewportAuto() {
  const newViewport = detectViewport();
  if (newViewport !== viewport) {
    setViewport(newViewport);
  }
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
    console.log('[DEBUG] createNewConversation - Sending request...');
    const r = await fetch('/api/conversations', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title: title || undefined }),
    });
    console.log('[DEBUG] createNewConversation - Response:', r.status, r.statusText);
    if (r.status === 401) { handleSessionExpired(); return null; }
    const d = await r.json();
    console.log('[DEBUG] createNewConversation - Data:', d);
    if (r.ok) {
      const conv = d.conversation;
      conversations.unshift(conv);
      renderConversations();
      console.log('[DEBUG] createNewConversation - Success:', conv);
      return conv;
    } else {
      console.error('[DEBUG] createNewConversation - Error response:', d);
    }
  } catch (e) {
    console.error('[createNewConversation] Error:', e);
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

async function loadHashiramaStatus() {
  try {
    const r = await fetch('/api/hashirama/status', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!r.ok) throw new Error('status_failed');

    const data = await r.json();
    console.log('[DEBUG] Hashirama status:', data.status);
    hashiramaStatus = data.status;
    updateHashiramaConnectionStatus(data.status.connected || false);
    console.log('[DEBUG] Connection status updated');
    renderRightPanel();
  } catch (e) {
    console.error('Failed to load Hashirama status:', e);
    updateHashiramaConnectionStatus(false);
  }
}

function updateHashiramaConnectionStatus(isConnected: boolean) {
  if (!hashiramaConnectionDot) return;

  if (isConnected) {
    hashiramaConnectionDot.style.background = '#27ae60'; // Vert
    hashiramaConnectionDot.style.boxShadow = '0 0 8px rgba(39, 174, 96, 0.8)';
    hashiramaConnectionDot.title = 'Hashirama connecté';
  } else {
    hashiramaConnectionDot.style.background = '#e74c3c'; // Rouge
    hashiramaConnectionDot.style.boxShadow = '0 0 8px rgba(231, 76, 60, 0.8)';
    hashiramaConnectionDot.title = 'Hashirama déconnecté';
  }
}

function checkHashiramaConnection() {
  if (!token) return;

  fetch('/api/hashirama/status', { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => updateHashiramaConnectionStatus(data.status.connected || false))
    .catch(() => updateHashiramaConnectionStatus(false));
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

  // Handle profile login
  isAdmin = d.isAdmin || false;
  sessionStorage.setItem('hashi_is_admin', String(isAdmin));

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

  // Show Claude toggle for regular users
  console.log('[DEBUG] Login successful - showing Claude toggle');
  console.log('[DEBUG] claudeToggle element:', claudeToggle);
  if (claudeToggle) {
    claudeToggle.classList.remove("hidden");
    console.log('[DEBUG] Claude toggle display set to flex');
  } else {
    console.error('[DEBUG] claudeToggle element not found!');
  }

  // Show options button
  if (optionsToggle) {
    optionsToggle.style.display = 'flex';
  }

  if (d.pinExpired) {
    setTimeout(() => alert('Votre mot de passe a expiré. Veuillez le changer.'), 500);
  }
  if (d.created) {
    setTimeout(() => alert(`Profil "${profile}" créé avec succès.`), 300);
  }

  // Show admin section if user is admin
  console.log('[DEBUG] isAdmin value:', isAdmin);
  if (isAdmin) {
    console.log('[DEBUG] Showing admin section...');
    showAdminSection();
    console.log('[DEBUG] Loading admin data...');
    await loadAdminData();
    console.log('[DEBUG] Rendering admin panel...');
    renderAdminPanel();
    console.log('[DEBUG] Admin panel setup complete');
  }

  await loadHistory();
  loadHashiramaStatus(); // Load real API consumption
  checkHashiramaConnection(); // Check Hashirama connection

  // Check connection every 30 seconds
  setInterval(checkHashiramaConnection, 30000);
}

async function sendMessage() {
  console.log('[DEBUG] sendMessage called');
  const text = chatInput.value.trim();
  console.log('[DEBUG] text:', text, 'typing:', typing, 'token:', !!token);
  if (!text || typing || !token) {
    console.log('[DEBUG] sendMessage aborted - conditions not met');
    return;
  }

  // Create new conversation if none is active
  console.log('[DEBUG] activeConversationId:', activeConversationId);
  if (!activeConversationId) {
    console.log('[DEBUG] Creating new conversation...');
    const newConv = await createNewConversation();
    console.log('[DEBUG] New conversation created:', newConv);
    if (!newConv) {
      console.log('[DEBUG] Failed to create conversation!');
      return;
    }
    activeConversationId = newConv.id;
  }

  console.log('[DEBUG] Adding user message to UI...');
  addMessage('user', text);
  chatInput.value = '';
  chatInput.style.height = 'auto';

  console.log('[DEBUG] Saving user message to conversation...');
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

    console.log('[DEBUG] Sending to /api/chat with payload:', payload);
    const r = await fetch('/api/chat', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    console.log('[DEBUG] Received response:', r.status, r.statusText);
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
    console.error('[DEBUG] Error in sendMessage:', e);
    typing = false;
    sendBtn.disabled = false;
    if (e.message !== 'unauthorized') addMessage('ai', 'Erreur de communication avec le bridge. Réessayez.');
    renderMessages();
  }
  console.log('[DEBUG] sendMessage completed');
}

// ── ADMIN DASHBOARD ─────────────────────────────────────────
async function loadAdminData() {
  const r = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (!r.ok) throw new Error('admin_fail');

  adminUsers = d.items || [];
}

function renderAdminPanel() {
  if (!accAdminBody) return;

  accAdminBody.innerHTML = `
    <div class="admin-tabs" style="display:flex;gap:4px;margin-bottom:12px;border-bottom:1px solid var(--border-dim);padding-bottom:8px;">
      <button class="admin-tab-btn active" data-tab="users" style="flex:1;padding:6px 10px;background:rgba(170,120,25,0.1);border:1px solid var(--gold);color:var(--gold);font-family:var(--font-mono);font-size:9px;cursor:pointer;text-transform:uppercase;">👥 Utilisateurs</button>
      <button class="admin-tab-btn" data-tab="audit" style="flex:1;padding:6px 10px;background:transparent;border:1px solid var(--border-dim);color:var(--text-dim);font-family:var(--font-mono);font-size:9px;cursor:pointer;text-transform:uppercase;">📋 Audit</button>
      <button class="admin-tab-btn" data-tab="backups" style="flex:1;padding:6px 10px;background:transparent;border:1px solid var(--border-dim);color:var(--text-dim);font-family:var(--font-mono);font-size:9px;cursor:pointer;text-transform:uppercase;">💾 Backups</button>
    </div>
    <div id="adminTabContent"></div>
  `;

  // Setup tab switching
  accAdminBody.querySelectorAll('.admin-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      accAdminBody.querySelectorAll('.admin-tab-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.borderColor = 'var(--border-dim)';
        b.style.color = 'var(--text-dim)';
      });
      btn.style.background = 'rgba(170,120,25,0.1)';
      btn.style.borderColor = 'var(--gold)';
      btn.style.color = 'var(--gold)';

      const tab = btn.dataset.tab;
      if (tab === 'users') renderAdminUsers();
      else if (tab === 'audit') loadAdminAuditLog();
      else if (tab === 'backups') loadAdminBackups();
    });
  });

  renderAdminUsers();
}

function renderAdminUsers() {
  const adminTabContent = $('#adminTabContent');
  if (!adminTabContent) return;

  adminTabContent.innerHTML = `
    <div style="margin-bottom:12px;">
      <button class="admin-action-btn" onclick="adminCreateUser()" style="background:rgba(170,120,25,0.15);border-color:var(--gold);color:var(--gold);padding:6px 12px;font-size:9px;">➕ Créer un utilisateur</button>
    </div>
    <div style="display:grid;gap:10px;">
      ${adminUsers.map(user => `
        <div class="admin-user-card" data-user="${user.name}">
          <div class="admin-user-info">
            <div class="admin-user-name">
              ${user.name}
              ${user.disabled ? '<span class="admin-badge disabled">Désactivé</span>' : ''}
              ${user.pinExpired ? '<span class="admin-badge expired">PIN expiré</span>' : ''}
            </div>
            <div class="admin-user-meta">
              <span>Rôle: <strong>${user.role}</strong></span>
              <span>Messages: <strong>${user.messages}</strong></span>
              <span>Dernière connexion: <strong>${user.lastLogin ? new Date(user.lastLogin).toLocaleString('fr-FR') : 'Jamais'}</strong></span>
              <span>Créé: <strong>${user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'N/A'}</strong></span>
            </div>
          </div>
          <div class="admin-user-actions">
            <button class="admin-action-btn" onclick="adminChangeRole('${user.name}', '${user.role}')">🔧 Rôle</button>
            <button class="admin-action-btn" onclick="adminResetPin('${user.name}')">🔑 Reset PIN</button>
            <button class="admin-action-btn" onclick="adminToggleDisable('${user.name}', ${user.disabled})">${user.disabled ? '✓ Activer' : '⊗ Désactiver'}</button>
            <button class="admin-action-btn danger" onclick="adminDeleteUser('${user.name}')">🗑 Supprimer</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function adminChangeRole(username: string, currentRole: string) {
  const roles = ['readonly', 'user', 'manager', 'admin'];
  const newRole = prompt(`Changer le rôle de ${username}\nRôle actuel: ${currentRole}\n\nNouveau rôle (readonly/user/manager/admin):`, currentRole);

  if (!newRole || !roles.includes(newRole)) {
    alert('Rôle invalide');
    return;
  }

  try {
    const r = await fetch('/api/admin/change-role', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ profile: username, role: newRole })
    });

    const d = await r.json();
    if (r.ok) {
      alert(`Rôle de ${username} changé en ${newRole}`);
      await reloadAdminUsers();
    } else {
      alert(`Erreur: ${d.error || 'Échec du changement de rôle'}`);
    }
  } catch (e) {
    alert('Erreur réseau');
  }
}

async function adminResetPin(username: string) {
  const newPin = prompt(`Réinitialiser le PIN de ${username}\n\nNouveau PIN (min. 8 caractères, majuscule, minuscule, chiffre):`);

  if (!newPin) return;

  try {
    const r = await fetch('/api/admin/reset-pin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ profile: username, newPin })
    });

    const d = await r.json();
    if (r.ok) {
      alert(`PIN de ${username} réinitialisé avec succès`);
      await reloadAdminUsers();
    } else {
      alert(`Erreur: ${d.error || 'Échec de la réinitialisation'}`);
    }
  } catch (e) {
    alert('Erreur réseau');
  }
}

async function adminToggleDisable(username: string, currentlyDisabled: boolean) {
  const action = currentlyDisabled ? 'activer' : 'désactiver';
  if (!confirm(`Voulez-vous ${action} le compte de ${username} ?`)) return;

  try {
    const r = await fetch('/api/admin/disable-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ profile: username, disabled: !currentlyDisabled })
    });

    const d = await r.json();
    if (r.ok) {
      alert(`Compte ${username} ${currentlyDisabled ? 'activé' : 'désactivé'}`);
      await reloadAdminUsers();
    } else {
      alert(`Erreur: ${d.error || 'Échec'}`);
    }
  } catch (e) {
    alert('Erreur réseau');
  }
}

async function adminDeleteUser(username: string) {
  if (!confirm(`⚠️ ATTENTION ⚠️\n\nVoulez-vous vraiment SUPPRIMER définitivement le compte de ${username} ?\n\nCette action est IRRÉVERSIBLE.`)) return;

  const confirmation = prompt(`Pour confirmer, tapez le nom d'utilisateur: ${username}`);
  if (confirmation !== username) {
    alert('Suppression annulée');
    return;
  }

  try {
    const r = await fetch('/api/admin/delete-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ profile: username })
    });

    const d = await r.json();
    if (r.ok) {
      alert(`Compte ${username} supprimé définitivement`);
      await reloadAdminUsers();
    } else {
      alert(`Erreur: ${d.error || 'Échec de la suppression'}`);
    }
  } catch (e) {
    alert('Erreur réseau');
  }
}

async function adminCreateUser() {
  const username = prompt('Nom du nouvel utilisateur:\n(Sera converti en minuscules)');
  if (!username) return;

  const normalizedUsername = username.trim().toLowerCase();
  if (!normalizedUsername) {
    alert('Nom d\'utilisateur invalide');
    return;
  }

  const password = prompt(`Créer le mot de passe pour ${normalizedUsername}:\n\nExigences:\n- Min. 8 caractères\n- 1 majuscule\n- 1 minuscule\n- 1 chiffre`);
  if (!password) return;

  const confirmPassword = prompt('Confirmez le mot de passe:');
  if (password !== confirmPassword) {
    alert('Les mots de passe ne correspondent pas');
    return;
  }

  // Simulate profile creation by logging in with new credentials
  // This will auto-create the profile on the backend
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: normalizedUsername, password })
    });

    const d = await r.json();
    if (r.ok) {
      alert(`✅ Utilisateur ${normalizedUsername} créé avec succès!\n\nLe nouveau compte peut maintenant se connecter.`);
      await reloadAdminUsers();
    } else {
      if (d.error === 'password_policy_failed') {
        alert('Mot de passe invalide:\n' + (d.details || []).join('\n'));
      } else {
        alert(`Erreur: ${d.error || 'Échec de la création'}`);
      }
    }
  } catch (e) {
    alert('Erreur réseau');
  }
}

async function reloadAdminUsers() {
  const r = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (r.ok) {
    adminUsers = d.items || [];
    renderAdminUsers();
  }
}

// Expose functions to window for onclick handlers
(window as any).adminChangeRole = adminChangeRole;
(window as any).adminResetPin = adminResetPin;
(window as any).adminToggleDisable = adminToggleDisable;
(window as any).adminDeleteUser = adminDeleteUser;
(window as any).adminCreateUser = adminCreateUser;

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

navAvatar.addEventListener('click', () => {
  // Toujours ouvrir la modal de login (pour se déconnecter ou changer de profil)
  loginModal.classList.remove('hidden');
});

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

// Claude Toggle
claudeToggleInput?.addEventListener('change', async () => {
  claudeEnabled = claudeToggleInput.checked;
  console.log('[Claude Toggle] Enabled:', claudeEnabled);

  if (claudeEnabled) {
    // Force connection to Claude Code
    console.log('[Claude Toggle] Connecting to Claude Code...');
    await loadHashiramaStatus();

    // If not connected after load, show error
    if (!hashiramaStatus || !hashiramaStatus.connected) {
      alert('Impossible de se connecter à Claude Code. Vérifiez que le conteneur est actif.');
      claudeToggleInput.checked = false;
      claudeEnabled = false;
    } else {
      console.log('[Claude Toggle] Connected successfully!');
    }
  } else {
    console.log('[Claude Toggle] Claude disabled');
  }
});

// Artifact panel event listeners
artifactClose?.addEventListener('click', hideArtifact);
artifactCopy?.addEventListener('click', copyArtifactCode);
artifactDownload?.addEventListener('click', downloadArtifact);

// Admin section visibility on login
function showAdminSection() {
  console.log('[DEBUG] showAdminSection called - isAdmin:', isAdmin, 'accAdminSection:', !!accAdminSection);
  if (isAdmin && accAdminSection) {
    console.log('[DEBUG] Setting accAdminSection display to block');
    accAdminSection.style.display = 'block';
    console.log('[DEBUG] accAdminSection.style.display:', accAdminSection.style.display);
  } else {
    console.log('[DEBUG] NOT showing admin section - isAdmin:', isAdmin, 'accAdminSection exists:', !!accAdminSection);
  }
}

async function loadAdminAuditLog() {
  try {
    const r = await fetch('/api/admin/audit', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    if (r.ok) {
      $("#adminTabContent").innerHTML = `
        <div style="font-family:var(--font-mono);font-size:9px;line-height:1.6;">
          ${(d.logs || []).slice(0, 100).map(log =>
            `<div style="padding:4px 0;border-bottom:1px solid var(--border-dim);">
              <span style="color:var(--gold);">${new Date(log.ts).toLocaleString('fr-FR')}</span>
              <span style="color:var(--text-dim);margin:0 8px;">│</span>
              <span style="color:var(--text);">${log.event}</span>
              ${log.profile ? `<span style="color:var(--text-faint);margin-left:8px;">${log.profile}</span>` : ''}
            </div>`
          ).join('')}
        </div>
      `;
    }
  } catch (e) {
    $("#adminTabContent").innerHTML = '<div style="color:var(--error);">Erreur lors du chargement des logs</div>';
  }
}

async function loadAdminBackups() {
  try {
    const r = await fetch('/api/admin/backups', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    if (r.ok) {
      $("#adminTabContent").innerHTML = `
        <div style="margin-bottom:16px;">
          <button class="admin-action-btn" onclick="createAdminBackup()">💾 Créer un backup</button>
        </div>
        <div class="admin-user-grid">
          ${(d.backups || []).map(backup => `
            <div class="admin-user-card">
              <div class="admin-user-info">
                <div class="admin-user-name">${backup.name}</div>
                <div class="admin-user-meta">
                  <span>Taille: <strong>${(backup.size / 1024).toFixed(2)} KB</strong></span>
                  <span>Créé: <strong>${new Date(backup.created).toLocaleString('fr-FR')}</strong></span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
  } catch (e) {
    $("#adminTabContent").innerHTML = '<div style="color:var(--error);">Erreur lors du chargement des backups</div>';
  }
}

async function createAdminBackup() {
  try {
    const r = await fetch('/api/admin/backup/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = await r.json();
    if (r.ok) {
      alert('Backup créé avec succès');
      loadAdminBackups();
    } else {
      alert(`Erreur: ${d.error || 'Échec'}`);
    }
  } catch (e) {
    alert('Erreur réseau');
  }
}

(window as any).createAdminBackup = createAdminBackup;

// Auto-detect viewport on resize
window.addEventListener('resize', updateViewportAuto);

// ══════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════
async function init() {
  // Initialize theme from localStorage first (instant)
  await applyTheme(currentTheme);

  // Auto-detect and set initial viewport
  setViewport(detectViewport());

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
