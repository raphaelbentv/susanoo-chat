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
const newConvBtnFull = $('#newConvBtnFull');
const statusToggle   = $('#statusToggle');
const statusBody     = $('#statusBody');
const chatMessages   = $('#chatMessages');
const chatInput      = $('#chatInput');
const sendBtn        = $('#sendBtn');
const sessionMarker  = $('#sessionMarker');
const statusLabel    = $('#statusLabel');
const navAvatar      = $('#navAvatar');
const sessionTime    = $('#sessionTime');
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

// Mobile DOM refs
const mobileHeader = $('#mobileHeader');
const mobileBzone = $('#mobileBzone');
const mobileInput = $('#mobileInput') as HTMLTextAreaElement;
const mobileSendBtn = $('#mobileSendBtn');
const mobileAttachBtn = $('#mobileAttachBtn');
const fileInput = $('#fileInput') as HTMLInputElement;
const filePreviewBar = $('#filePreviewBar');
const mobileTabs = $('#mobileTabs');
const mobileBackdrop = $('#mobileBackdrop');
const mobileSheetSessions = $('#mobileSheetSessions');
const mobileSheetModel = $('#mobileSheetModel');
const mobileSheetStats = $('#mobileSheetStats');
const mobileSheetOptions = $('#mobileSheetOptions');
const mobileSessionsList = $('#mobileSessionsList');
const mobileModelList = $('#mobileModelList');
const mobileStatsContent = $('#mobileStatsContent');
const mobileOptionsContent = $('#mobileOptionsContent');
const mobileBadge = $('#mobileBadge');
const mobileStatusText = $('#mobileStatusText');

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
let activeTags       = [];
let temperature      = 80;
let maxTokens        = 60;
let statusWidgetOpen = true;
let sessionStart     = null;
let tokenCount       = 0;
let sessionExpiresAt = Number(sessionStorage.getItem('hashi_expires') || 0);
let passwordPolicy   = null;
let sessionCheckTimer = null;
let currentTheme     = localStorage.getItem('hashirama_theme') || 'emperor';
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
let mobileSheetCurrent = null; // Currently open mobile sheet id
let pendingFiles: { name: string; type: string; base64: string; size: number }[] = [];


const THEMES = [
  { id: 'obsidian', name: 'Obsidian Sentinel', primary: '#bb1e00', bg: '#030303', accent: '#ff0000', icon: '🗡️' },
  { id: 'cyber', name: 'Electric Ronin', primary: '#00d2ff', bg: '#00050c', accent: '#00ffe0', icon: '⚡' },
  { id: 'emperor', name: 'Gilded Emperor', primary: '#c8a020', bg: '#050408', accent: '#ffd700', icon: '👑' },
  { id: 'ghost', name: 'White Ghost', primary: '#1a1a1a', bg: '#eeecea', accent: '#fff', icon: '👻' },
  { id: 'storm', name: 'Storm Deity', primary: '#8840ff', bg: '#040310', accent: '#9055ff', icon: '⚡' },
  { id: 'brutal', name: 'Brutalist Oracle', primary: '#fff', bg: '#090909', accent: '#000', icon: '▪️' },
];

const MODELS = [
  { id: 'claude-opus-4', name: 'Opus 4.6', desc: 'Le plus puissant · Raisonnement complexe', cost: 'high' },
  { id: 'claude-sonnet-4', name: 'Sonnet 4.6', desc: 'Équilibré · Performance/coût optimal', cost: 'medium' },
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

// ── FILE UPLOAD ─────────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
];

function openFilePicker() {
  fileInput.value = '';
  fileInput.click();
}

function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  for (const file of Array.from(input.files)) {
    if (file.size > MAX_FILE_SIZE) {
      alert(`Fichier "${file.name}" trop volumineux (max 10 Mo)`);
      continue;
    }
    if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(txt|csv|md)$/i)) {
      alert(`Type non supporté : ${file.type || file.name.split('.').pop()}`);
      continue;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      pendingFiles.push({ name: file.name, type: file.type, base64, size: file.size });
      renderFilePreview();
    };
    reader.readAsDataURL(file);
  }
}

function removeFile(index: number) {
  pendingFiles.splice(index, 1);
  renderFilePreview();
}

function renderFilePreview() {
  if (!filePreviewBar) return;
  if (pendingFiles.length === 0) {
    filePreviewBar.classList.add('hidden');
    filePreviewBar.innerHTML = '';
    return;
  }
  filePreviewBar.classList.remove('hidden');
  filePreviewBar.innerHTML = pendingFiles.map((f, i) => {
    const icon = f.type.startsWith('image/') ? '🖼' : f.type === 'application/pdf' ? '📄' : '📎';
    const sizeLabel = f.size < 1024 ? `${f.size} o` : f.size < 1048576 ? `${(f.size / 1024).toFixed(0)} Ko` : `${(f.size / 1048576).toFixed(1)} Mo`;
    return `<div class="file-chip">
      <span class="file-chip-icon">${icon}</span>
      <span class="file-chip-name">${escHtml(f.name)}</span>
      <span class="file-chip-size">${sizeLabel}</span>
      <button class="file-chip-remove" data-idx="${i}" type="button">&times;</button>
    </div>`;
  }).join('');
  filePreviewBar.querySelectorAll('.file-chip-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number((e.currentTarget as HTMLElement).dataset.idx);
      removeFile(idx);
    });
  });
}

function clearPendingFiles() {
  pendingFiles = [];
  renderFilePreview();
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
  isAdmin = false; adminToken = '';
  sessionStorage.removeItem('hashi_token');
  sessionStorage.removeItem('hashi_profile');
  sessionStorage.removeItem('hashi_role');
  sessionStorage.removeItem('hashi_expires');
  sessionStorage.removeItem('hashi_is_admin');
  sessionStorage.removeItem('hashi_admin_token');
  if (accAdminSection) accAdminSection.style.display = 'none';
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

  // Also update mobile sessions if sheet is open
  if (mobileSheetCurrent === 'sessions') renderMobileSessions();
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

  // System prompt
  const accPrompt = $('#accPromptBody');
  if (accPrompt) {
    accPrompt.innerHTML = `
      <div class="system-prompt-text">Tu es Hashirama, assistant impérial de Raphael. Tu l'assistes dans la gestion de Groupe Venio, ses cours et ses projets tech.</div>
      <button class="modify-btn">Modifier</button>`;
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

  // Admin panel — always re-render if admin is logged in
  if (isAdmin && accAdminSection) {
    accAdminSection.style.display = 'block';
    renderAdminPanel();
  }
}

// ── MESSAGES ────────────────────────────────────────────────
// ── THEME SYSTEM ────────────────────────────────────────────
async function applyTheme(themeId) {
  // Validate theme
  if (!THEMES.find(t => t.id === themeId)) themeId = 'emperor';

  // Update DOM attribute (all theme CSS are preloaded in index.html)
  document.documentElement.setAttribute('data-theme', themeId);

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

  // Re-render panels to update active state
  renderRightPanel();
  if (viewport !== 'desktop') renderMobileOptions();
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

  // Tables — detect block of lines starting with |
  html = html.replace(/(?:^|\n)((?:\|.+\|[ ]*\n)+)/g, (_, tableBlock: string) => {
    const rows = tableBlock.trim().split('\n');
    if (rows.length < 2) return tableBlock;

    // Check that row 2 is a separator (|---|---|)
    const sepRow = rows[1];
    if (!/^\|[\s:-]+(\|[\s:-]+)+\|?$/.test(sepRow)) return tableBlock;

    // Parse alignment from separator row
    const alignCells = sepRow.split('|').filter(c => c.trim() !== '');
    const aligns = alignCells.map(c => {
      const t = c.trim();
      if (t.startsWith(':') && t.endsWith(':')) return 'center';
      if (t.endsWith(':')) return 'right';
      return 'left';
    });

    // Parse header cells
    const headerCells = rows[0].split('|').filter(c => c.trim() !== '');
    let thead = '<thead><tr>';
    headerCells.forEach((cell, i) => {
      const align = aligns[i] || 'left';
      thead += `<th style="text-align:${align}">${cell.trim()}</th>`;
    });
    thead += '</tr></thead>';

    // Parse data rows
    let tbody = '<tbody>';
    for (let r = 2; r < rows.length; r++) {
      const cells = rows[r].split('|').filter(c => c.trim() !== '');
      if (cells.length === 0) continue;
      tbody += '<tr>';
      cells.forEach((cell, i) => {
        const align = aligns[i] || 'left';
        tbody += `<td style="text-align:${align}">${cell.trim()}</td>`;
      });
      tbody += '</tr>';
    }
    tbody += '</tbody>';

    return `\n<div class="table-wrap"><table>${thead}${tbody}</table></div>\n`;
  });

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Horizontal rules (must be before bold/italic to avoid confusion with ---, ***)
  html = html.replace(/^(?:---|\*\*\*|___)[ ]*$/gm, '<hr>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Blockquotes — consecutive > lines grouped together
  html = html.replace(/(^&gt; .+(?:\n&gt; .+)*)/gm, (match) => {
    const inner = match.replace(/^&gt; /gm, '');
    return `<blockquote>${inner}</blockquote>`;
  });

  // Unordered lists
  html = html.replace(/(^[*-] .+(?:\n[*-] .+)*)/gm, (match) => {
    const items = match.split('\n').map(line => `<li>${line.replace(/^[*-] /, '')}</li>`).join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists — consecutive numbered lines grouped together
  html = html.replace(/(^\d+\. .+(?:\n\d+\. .+)*)/gm, (match) => {
    const items = match.split('\n').map(line => `<li>${line.replace(/^\d+\. /, '')}</li>`).join('');
    return `<ol>${items}</ol>`;
  });

  // Line breaks (double newline = paragraph)
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Clean up block elements wrapped in <p> tags
  html = html.replace(/<p>(<(?:table|div|blockquote|ul|ol|h[1-3]|hr|pre)[^>]*>)/g, '$1');
  html = html.replace(/(<\/(?:table|div|blockquote|ul|ol|h[1-3]|hr|pre)>)<\/p>/g, '$1');

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; min-height: 100dvh; background: #f5f5f5; }
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
  if (vp === 'desktop') {
    openSidebar();
    sidebarOverlay.classList.remove('visible');
    closeMobileSheet();
  } else {
    closeSidebar();
    updateMobileBadge();
  }
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
    renderStatusWidget();
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

  // Handle login — detect admin from type or isAdmin flag
  isAdmin = d.isAdmin || d.type === 'admin' || d.role === 'admin' || false;
  sessionStorage.setItem('hashi_is_admin', String(isAdmin));

  // Set admin token for admin API calls
  if (isAdmin) {
    adminToken = d.token;
    sessionStorage.setItem('hashi_admin_token', d.token);
  }

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

  // Default model: opus for admin, sonnet for others
  if (!localStorage.getItem('hashirama_model')) {
    selectedModel = isAdmin ? 'claude-opus-4' : 'claude-sonnet-4';
    localStorage.setItem('hashirama_model', selectedModel);
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
  updateMobileBadge();
  loadHashiramaStatus(); // Load real API consumption
  checkHashiramaConnection(); // Check Hashirama connection

  // Check connection every 30 seconds
  setInterval(checkHashiramaConnection, 30000);
}

async function sendMessage() {
  console.log('[DEBUG] sendMessage called');
  // Read from mobile input if on mobile/tablet, else desktop
  const isMobile = viewport === 'mobile' || viewport === 'tablet';
  const activeInput = (isMobile && mobileInput) ? mobileInput : chatInput;
  const text = activeInput.value.trim();
  const hasFiles = pendingFiles.length > 0;
  console.log('[DEBUG] text:', text, 'typing:', typing, 'token:', !!token, 'files:', pendingFiles.length);
  if ((!text && !hasFiles) || typing || !token) {
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

  // Capture files before clearing
  const filesToSend = [...pendingFiles];
  const fileNames = filesToSend.map(f => f.name);

  console.log('[DEBUG] Adding user message to UI...');
  const displayText = fileNames.length > 0
    ? (text ? text + '\n📎 ' + fileNames.join(', ') : '📎 ' + fileNames.join(', '))
    : text;
  addMessage('user', displayText);
  activeInput.value = '';
  activeInput.style.height = 'auto';
  clearPendingFiles();
  // Also clear the other input
  if (isMobile && chatInput) { chatInput.value = ''; chatInput.style.height = 'auto'; }
  else if (!isMobile && mobileInput) { mobileInput.value = ''; mobileInput.style.height = 'auto'; }

  console.log('[DEBUG] Saving user message to conversation...');
  // Add user message to conversation
  await fetch(`/api/conversations/${activeConversationId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      role: 'user',
      content: displayText,
      metadata: {
        contexts: activeTags,
        connectors: activeConnectors,
        files: fileNames,
      },
    }),
  }).catch(() => {});

  typing = true;
  renderMessages();
  sendBtn.disabled = true;

  try {
    const payload: any = {
      message: text || '(fichiers joints)',
      conversationId: activeConversationId,
      model: selectedModel,
      temperature: temperature / 100,
      maxTokens: Math.round(maxTokens * 81.92),
      deepSearch: deepSearchEnabled,
      contexts: activeTags,
      connectors: activeConnectors,
    };
    if (filesToSend.length > 0) {
      payload.files = filesToSend.map(f => ({ name: f.name, type: f.type, data: f.base64 }));
    }

    console.log('[DEBUG] Sending to /api/chat (SSE)...');
    const r = await fetch('/api/chat', { method: 'POST', headers: authHeaders(), body: JSON.stringify(payload) });
    console.log('[DEBUG] Received response:', r.status, r.statusText);
    if (r.status === 401) { handleSessionExpired(); return; }

    // Pre-stream errors (400, 403, 500) are still JSON
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || 'chat_error');
    }

    // ── SSE stream consumption ──────────────────────────────

    // Switch from typing indicator to streaming message
    typing = false;
    const aiMsg = { id: Date.now(), role: 'ai' as const, text: '', time: nowLabel(), meta: '' };
    messages.push(aiMsg);

    // Create the message DOM element and replace the typing indicator
    const msgEl = createMessageEl(aiMsg);
    const typingEl = chatMessages.querySelector('.typing-indicator');
    if (typingEl) typingEl.remove();
    chatMessages.appendChild(msgEl);
    const bubble = msgEl.querySelector('.msg-bubble') as HTMLElement;

    let fullText = '';
    let doneData: { model?: string; tokens?: number } | null = null;

    const reader = r.body!.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() || '';

        let currentEvent = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if (currentEvent === 'done') {
                doneData = parsed;
              } else if (currentEvent === 'error') {
                throw new Error(parsed.error || 'stream_error');
              } else {
                // Regular chunk
                if (parsed.t) {
                  fullText += parsed.t;
                  bubble.innerHTML = parseMarkdown(fullText);
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                }
              }
            } catch (parseErr) {
              // Re-throw stream errors, ignore JSON parse failures
              if ((parseErr as Error).message && !(parseErr as Error).message.includes('JSON')) {
                throw parseErr;
              }
            }
            currentEvent = '';
          } else if (line === '') {
            currentEvent = '';
          }
        }
      }
    } catch (streamErr) {
      console.error('[DEBUG] Stream error:', streamErr);
      if (!fullText) {
        // No text received at all — remove empty message and show error
        messages.pop();
        msgEl.remove();
        typing = false;
        sendBtn.disabled = false;
        addMessage('ai', 'Erreur de communication avec le bridge. Réessayez.');
        renderMessages();
        return;
      }
      // Partial text received — keep what we have
      fullText += '\n\n⚠ *Réponse interrompue*';
      bubble.innerHTML = parseMarkdown(fullText);
    }

    // ── Finalize the message ────────────────────────────────

    const reply = fullText || 'Réponse vide.';
    const toks = doneData?.tokens || Math.round(reply.length * 0.3);
    const modelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel;
    const meta = `${toks} tokens · ${modelName}`;

    // Update message object in the array
    aiMsg.text = reply;
    aiMsg.meta = meta;

    // Update meta display in DOM
    const metaEl = msgEl.querySelector('.msg-meta') as HTMLElement;
    if (metaEl) metaEl.textContent = `${aiMsg.time} · ${meta}`;

    // Final render with artifact detection
    const artifact = detectArtifact(reply);
    if (artifact) {
      bubble.innerHTML = parseMarkdown(artifact.cleanText);
      const artifactBtn = document.createElement('button');
      artifactBtn.className = 'artifact-preview-btn';
      artifactBtn.innerHTML = '⚡ Voir l\'artefact';
      artifactBtn.onclick = () => showArtifact(artifact);
      bubble.appendChild(artifactBtn);
    } else {
      bubble.innerHTML = parseMarkdown(reply);
    }

    tokenCount += toks;
    sendBtn.disabled = false;

    // Save AI message to conversation
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
    if ((e as any).message !== 'unauthorized') addMessage('ai', 'Erreur de communication avec le bridge. Réessayez.');
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
              ${user.firstName ? `${user.firstName} ` : ''}${!user.firstName ? user.name : ''}
              ${user.email ? `<span style="color:var(--text-dim);font-size:10px;margin-left:4px;">${user.email}</span>` : (!user.firstName ? '' : '')}
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
        'Authorization': `Bearer ${adminToken || token}`
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
        'Authorization': `Bearer ${adminToken || token}`
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
        'Authorization': `Bearer ${adminToken || token}`
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
        'Authorization': `Bearer ${adminToken || token}`
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
  const modalEl = document.createElement('div');
  modalEl.id = 'createUserModal';
  modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:9999;display:flex;align-items:center;justify-content:center;';

  modalEl.innerHTML = `
    <div style="background:var(--surface,#0a0805);border:1px solid var(--border,rgba(170,120,25,0.20));padding:28px 32px;max-width:440px;width:90%;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <div style="font-family:var(--font-display,'Cinzel',serif);font-size:14px;color:var(--gold,#c8a020);text-transform:uppercase;letter-spacing:3px;">
          Nouvel Utilisateur
        </div>
        <button id="createUserClose" style="background:none;border:1px solid var(--border-dim,rgba(170,120,25,0.10));width:28px;height:28px;cursor:pointer;color:var(--text-dim,rgba(255,255,255,0.5));font-size:14px;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <form id="createUserForm" style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="display:block;font-size:10px;color:var(--text-faint,rgba(255,255,255,0.35));text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Prénom</label>
          <input id="createUserFirstName" type="text" required autocomplete="off"
            style="width:100%;padding:10px 12px;background:var(--gold-faint,rgba(170,120,25,0.04));border:1px solid var(--border,rgba(170,120,25,0.20));color:var(--text,rgba(255,255,255,0.95));font-family:var(--font-body,'Inter',sans-serif);font-size:14px;outline:none;box-sizing:border-box;"
            placeholder="Jean">
        </div>
        <div>
          <label style="display:block;font-size:10px;color:var(--text-faint,rgba(255,255,255,0.35));text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Email</label>
          <input id="createUserEmail" type="email" required autocomplete="off"
            style="width:100%;padding:10px 12px;background:var(--gold-faint,rgba(170,120,25,0.04));border:1px solid var(--border,rgba(170,120,25,0.20));color:var(--text,rgba(255,255,255,0.95));font-family:var(--font-body,'Inter',sans-serif);font-size:14px;outline:none;box-sizing:border-box;"
            placeholder="jean@example.com">
        </div>
        <div>
          <label style="display:block;font-size:10px;color:var(--text-faint,rgba(255,255,255,0.35));text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;">Rôle</label>
          <select id="createUserRole"
            style="width:100%;padding:10px 12px;background:var(--gold-faint,rgba(170,120,25,0.04));border:1px solid var(--border,rgba(170,120,25,0.20));color:var(--text,rgba(255,255,255,0.95));font-family:var(--font-body,'Inter',sans-serif);font-size:14px;outline:none;box-sizing:border-box;">
            <option value="user">Utilisateur</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
        <div style="background:rgba(170,120,25,0.06);border:1px solid var(--border-dim,rgba(170,120,25,0.10));padding:10px 14px;margin-top:4px;">
          <div style="font-size:11px;color:var(--text-dim,rgba(255,255,255,0.5));line-height:1.5;">
            Un mot de passe sécurisé sera généré automatiquement et envoyé par email.
          </div>
        </div>
        <button id="createUserSubmit" type="submit"
          style="padding:12px;background:rgba(170,120,25,0.15);border:1px solid var(--gold,#c8a020);color:var(--gold,#c8a020);font-family:var(--font-display,'Cinzel',serif);font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;margin-top:4px;">
          Créer le compte
        </button>
      </form>
    </div>
  `;

  document.body.appendChild(modalEl);

  const closeModal = () => { if (modalEl.parentNode) modalEl.parentNode.removeChild(modalEl); };

  modalEl.addEventListener('click', (e) => { if ((e.target as HTMLElement).id === 'createUserModal') closeModal(); });
  document.getElementById('createUserClose')?.addEventListener('click', closeModal);

  document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const firstName = ((document.getElementById('createUserFirstName') as HTMLInputElement)?.value || '').trim();
    const email = ((document.getElementById('createUserEmail') as HTMLInputElement)?.value || '').trim();
    const role = ((document.getElementById('createUserRole') as HTMLSelectElement)?.value || 'user');

    if (!firstName || !email) {
      showNotification('error', 'Erreur', 'Veuillez remplir tous les champs.');
      return;
    }

    const submitBtn = document.getElementById('createUserSubmit') as HTMLButtonElement;
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Création en cours...'; }

    try {
      const r = await fetch('/api/admin/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken || token}` },
        body: JSON.stringify({ firstName, email, role })
      });

      const d = await r.json();

      if (r.ok) {
        const emailStatus = d.emailSent
          ? '<span style="color:var(--success,#4caf50);">Email envoyé avec succès</span>'
          : '<span style="color:#f39c12;">Email non envoyé — communiquez le mot de passe manuellement</span>';

        const modalContent = modalEl.querySelector('div') as HTMLElement;
        if (modalContent) {
          modalContent.innerHTML = `
            <div style="font-family:var(--font-display,'Cinzel',serif);font-size:14px;color:var(--gold,#c8a020);text-transform:uppercase;letter-spacing:3px;margin-bottom:20px;">
              Compte Créé
            </div>
            <div style="text-align:center;margin-bottom:20px;">
              <div style="font-size:28px;margin-bottom:8px;color:var(--success,#4caf50);">✓</div>
              <div style="color:var(--text,rgba(255,255,255,0.95));font-size:14px;">
                Le compte de <strong style="color:var(--gold,#c8a020);">${firstName}</strong> a été créé.
              </div>
            </div>
            <div style="background:rgba(170,120,25,0.06);border:1px solid rgba(170,120,25,0.15);padding:16px 20px;margin-bottom:16px;">
              <div style="margin-bottom:12px;">
                <div style="font-size:10px;color:var(--text-faint,rgba(255,255,255,0.35));text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Identifiant</div>
                <div style="font-family:var(--font-mono,'Courier New',monospace);font-size:13px;color:var(--gold,#c8a020);">${d.profile}</div>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text-faint,rgba(255,255,255,0.35));text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Mot de passe</div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <div id="generatedPwd" style="font-family:var(--font-mono,'Courier New',monospace);font-size:13px;color:var(--gold,#c8a020);flex:1;">${d.generatedPassword}</div>
                  <button id="copyPasswordBtn"
                    style="background:rgba(170,120,25,0.15);border:1px solid var(--border,rgba(170,120,25,0.20));color:var(--gold,#c8a020);padding:4px 10px;font-size:10px;cursor:pointer;">
                    Copier
                  </button>
                </div>
              </div>
            </div>
            <div style="font-size:11px;margin-bottom:16px;">${emailStatus}</div>
            <button id="createUserSuccessClose"
              style="width:100%;padding:12px;background:rgba(170,120,25,0.15);border:1px solid var(--gold,#c8a020);color:var(--gold,#c8a020);font-family:var(--font-display,'Cinzel',serif);font-size:11px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;">
              Fermer
            </button>
          `;

          document.getElementById('createUserSuccessClose')?.addEventListener('click', closeModal);
          document.getElementById('copyPasswordBtn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(d.generatedPassword).then(() => {
              showNotification('success', 'Copié', 'Mot de passe copié dans le presse-papiers.');
            });
          });
        }

        await reloadAdminUsers();
      } else {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Créer le compte'; }
        if (d.error === 'profile_already_exists') {
          showNotification('error', 'Erreur', 'Un compte avec cet email existe déjà.');
        } else {
          showNotification('error', 'Erreur', d.error || 'Échec de la création');
        }
      }
    } catch (err) {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Créer le compte'; }
      showNotification('error', 'Erreur', 'Erreur réseau');
    }
  });
}

async function reloadAdminUsers() {
  const r = await fetch('/api/admin/profiles', { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (r.ok) {
    adminUsers = d.items || [];
    renderAdminUsers();
    // Also refresh mobile admin modal if open
    const mobileAdminModal = document.getElementById('mobileAdminModal');
    if (mobileAdminModal) renderMobileAdminUsers(mobileAdminModal);
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

// ══════════════════════════════════════════════════════════
// MOBILE SHEETS & TABS
// ══════════════════════════════════════════════════════════
const mobileSheetMap = {
  sessions: mobileSheetSessions,
  model: mobileSheetModel,
  stats: mobileSheetStats,
  options: mobileSheetOptions,
};

function openMobileSheet(id) {
  if (mobileSheetCurrent === id) { closeMobileSheet(); return; }
  // Close any open sheet first
  if (mobileSheetCurrent && mobileSheetMap[mobileSheetCurrent]) {
    mobileSheetMap[mobileSheetCurrent].classList.remove('open');
  }
  mobileSheetCurrent = id;
  mobileBackdrop?.classList.add('open');
  // Render content before opening
  if (id === 'sessions') renderMobileSessions();
  if (id === 'model') renderMobileModels();
  if (id === 'stats') renderMobileStats();
  if (id === 'options') renderMobileOptions();
  // Open with rAF for smooth animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (mobileSheetMap[id]) mobileSheetMap[id].classList.add('open');
    });
  });
  setMobileTab(id);
}

function closeMobileSheet() {
  if (!mobileSheetCurrent) return;
  mobileBackdrop?.classList.remove('open');
  if (mobileSheetMap[mobileSheetCurrent]) {
    mobileSheetMap[mobileSheetCurrent].classList.remove('open');
  }
  mobileSheetCurrent = null;
  setMobileTab('chat');
}

function setMobileTab(id) {
  mobileTabs?.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
  const tabMap = { sessions: 0, chat: 1, model: 2, stats: 3, options: 4 };
  const tabs = mobileTabs?.querySelectorAll('.mobile-tab');
  if (tabs && tabs[tabMap[id] ?? 1]) {
    tabs[tabMap[id] ?? 1].classList.add('active');
  }
}

function renderMobileSessions() {
  if (!mobileSessionsList) return;
  let html = `
    <button class="mobile-new-session-btn" id="mobileNewConvBtn">
      <div class="mobile-new-session-plus">+</div>
      <div style="font-size:15px;font-weight:500;color:var(--m-gold);">Nouvelle session impériale</div>
    </button>`;

  if (conversations.length === 0) {
    html += `
      <div class="mobile-empty">
        <div class="mobile-empty-icon">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/></svg>
        </div>
        <div class="mobile-empty-title">Aucune session</div>
        <div class="mobile-empty-sub">Démarrez une nouvelle conversation avec Hashirama</div>
      </div>`;
  } else {
    for (const c of conversations.filter(x => !x.archived)) {
      const isActive = c.id === activeConversationId ? ' active' : '';
      const time = new Date(c.updatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const initial = c.title ? c.title.charAt(0).toUpperCase() : 'S';
      html += `
        <div class="mobile-conv-item${isActive}" data-id="${c.id}">
          <div class="mobile-conv-avt">${initial}</div>
          <div class="mobile-conv-info">
            <div class="mobile-conv-title">${escHtml(c.title || 'Sans titre')}</div>
            <div class="mobile-conv-preview">${escHtml(c.preview || '')}</div>
          </div>
          <div class="mobile-conv-time">${time}</div>
          <button class="mobile-conv-delete" data-id="${c.id}" title="Supprimer">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
          </button>
        </div>`;
    }
  }

  mobileSessionsList.innerHTML = html;

  // Attach event listeners
  mobileSessionsList.querySelector('#mobileNewConvBtn')?.addEventListener('click', async () => {
    closeMobileSheet();
    const newConv = await createNewConversation();
    if (newConv) {
      activeConversationId = newConv.id;
      messages = [];
      renderConversations();
      renderMessages();
    }
  });

  mobileSessionsList.querySelectorAll('.mobile-conv-item').forEach(el => {
    el.addEventListener('click', () => {
      switchConversation(el.dataset.id);
      closeMobileSheet();
    });
  });

  mobileSessionsList.querySelectorAll('.mobile-conv-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).dataset.id;
      if (id) {
        const ok = await deleteConversation(id);
        if (ok) renderMobileSessions();
      }
    });
  });
}

function renderMobileModels() {
  if (!mobileModelList) return;
  const modelIcons = {
    'claude-opus-4': { emoji: '🔮', bg: 'linear-gradient(135deg, #2A0A2E, #1A0420)' },
    'claude-sonnet-4': { emoji: '⚡', bg: 'linear-gradient(135deg, #1A1408, #2A1F0A)' },
    'claude-haiku-4': { emoji: '🌸', bg: 'linear-gradient(135deg, #0A1428, #061020)' },
  };

  let html = '';
  for (const m of MODELS) {
    const icon = modelIcons[m.id] || { emoji: '🤖', bg: 'var(--m-bg3)' };
    const isActive = m.id === selectedModel;
    html += `
      <div class="mobile-model-row" data-model="${m.id}">
        <div class="mobile-model-icon" style="background:${icon.bg}">${icon.emoji}</div>
        <div style="flex:1">
          <div class="mobile-model-name">${m.name}</div>
          <div class="mobile-model-desc">${m.desc}</div>
        </div>
        <div class="mobile-model-check${isActive ? ' active' : ''}"></div>
      </div>`;
  }
  mobileModelList.innerHTML = html;

  mobileModelList.querySelectorAll('.mobile-model-row').forEach(el => {
    el.addEventListener('click', () => {
      selectedModel = el.dataset.model;
      localStorage.setItem('hashirama_model', selectedModel);
      renderMobileModels();
      renderRightPanel();
      renderStatusWidget();
      setTimeout(closeMobileSheet, 280);
    });
  });
}

function renderMobileStats() {
  if (!mobileStatsContent) return;
  const remaining = sessionExpiresAt ? Math.max(0, sessionExpiresAt - Date.now()) : 0;
  const tokenPct = (tokenCount / 200000) * 100;
  const modelName = MODELS.find(m => m.id === selectedModel)?.name || selectedModel;

  mobileStatsContent.innerHTML = `
    <div style="padding:16px 20px 20px;display:flex;flex-direction:column;gap:10px;">
      <div class="mobile-stat-card">
        <div class="mobile-stat-label">Tokens utilisés</div>
        <div class="mobile-stat-value">${tokenCount.toLocaleString('fr-FR')}</div>
        <div class="mobile-stat-sub">sur 200 000 disponibles</div>
        <div class="mobile-stat-bar"><div class="mobile-stat-bar-fill" style="width:${Math.max(0.3, tokenPct)}%"></div></div>
      </div>
      <div class="mobile-stat-grid">
        <div class="mobile-stat-sm">
          <div class="mobile-stat-label">Messages</div>
          <div class="mobile-stat-sm-val">${messages.length}</div>
        </div>
        <div class="mobile-stat-sm">
          <div class="mobile-stat-label">Expire dans</div>
          <div class="mobile-stat-sm-val">${remaining > 0 ? formatRemaining(remaining) : '--'}</div>
        </div>
      </div>
      <div class="mobile-stat-session">
        <div class="mobile-badge-dot" style="width:6px;height:6px;"></div>
        <div style="flex:1;font-size:13px;color:var(--m-text2);">Session active · Rôle : ${role.toUpperCase()}</div>
        <div style="font-size:13px;color:var(--m-text3);font-weight:300;">${modelName}</div>
      </div>
    </div>`;
}

function renderMobileOptions() {
  if (!mobileOptionsContent) return;

  mobileOptionsContent.innerHTML = `
    <div class="mobile-setting-group">
      <div class="mobile-setting-item" id="mobileOptDeepSearch">
        <div class="mobile-setting-icon purple">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>
        </div>
        <div class="mobile-setting-text">
          <div class="mobile-setting-name">Recherche approfondie</div>
          <div class="mobile-setting-sub">Web search + analyse multi-sources</div>
        </div>
        <button class="mobile-toggle${deepSearchEnabled ? ' gold' : ''}" id="mobileToggleDeepSearch"></button>
      </div>
      <div class="mobile-setting-item">
        <div class="mobile-setting-icon blue">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>
        </div>
        <div class="mobile-setting-text">
          <div class="mobile-setting-name">Stream temps réel</div>
          <div class="mobile-setting-sub">Affichage progressif des réponses</div>
        </div>
        <button class="mobile-toggle on"></button>
      </div>
      <div class="mobile-setting-item">
        <div class="mobile-setting-icon green">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/></svg>
        </div>
        <div class="mobile-setting-text">
          <div class="mobile-setting-name">Mémoire contextuelle</div>
          <div class="mobile-setting-sub">Retenir les préférences</div>
        </div>
        <button class="mobile-toggle on"></button>
      </div>
    </div>
    <div class="mobile-setting-group" style="margin-top:12px;">
      <div class="mobile-setting-item">
        <div class="mobile-setting-icon orange">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z"/></svg>
        </div>
        <div class="mobile-setting-text">
          <div class="mobile-setting-name">Statut du service</div>
          <div class="mobile-setting-sub">API Anthropic · Opérationnel</div>
        </div>
        <div class="mobile-status-inline">
          <div class="mobile-badge-dot" style="width:5px;height:5px;"></div>
          <span>EN LIGNE</span>
        </div>
      </div>
    </div>
    ${isAdmin ? `
    <div class="mobile-setting-group" style="margin-top:12px;">
      <div class="mobile-setting-item" id="mobileAdminBtn">
        <div class="mobile-setting-icon" style="background:linear-gradient(135deg,#8B6A2E,#5A4420);">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"/></svg>
        </div>
        <div class="mobile-setting-text">
          <div class="mobile-setting-name" style="color:var(--m-gold);">Administration</div>
          <div class="mobile-setting-sub">Gérer les utilisateurs, audit, backups</div>
        </div>
        <div class="mobile-setting-arrow">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </div>
      </div>
    </div>` : ''}
    <div style="padding:12px 20px 0;">
      <div class="mobile-sheet-title" style="text-align:left;padding:0 0 8px;">THÈME VISUEL</div>
    </div>
    <div class="mobile-theme-grid" id="mobileThemeGrid">
      ${THEMES.map(t => `
        <div class="mobile-theme-card${currentTheme === t.id ? ' active' : ''}" data-theme="${t.id}">
          <div class="mobile-theme-colors">
            <div style="background:${t.primary}"></div>
            <div style="background:${t.bg}"></div>
            <div style="background:${t.accent}"></div>
          </div>
          <div class="mobile-theme-name">${t.icon} ${t.name}</div>
        </div>
      `).join('')}
    </div>
    <div class="mobile-setting-group last" style="margin-top:16px;">
      <div class="mobile-setting-item" id="mobileLogout">
        <div class="mobile-setting-icon red">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"/></svg>
        </div>
        <div class="mobile-setting-text">
          <div class="mobile-setting-name" style="color:var(--danger);">Déconnexion</div>
          <div class="mobile-setting-sub">${profile || 'non connecté'} · ${role}</div>
        </div>
        <div class="mobile-setting-arrow">
          <svg viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5"/></svg>
        </div>
      </div>
    </div>`;

  // Attach event listeners
  setTimeout(() => {
    $('#mobileToggleDeepSearch')?.addEventListener('click', () => {
      deepSearchEnabled = !deepSearchEnabled;
      localStorage.setItem('hashirama_deep_search', String(deepSearchEnabled));
      renderMobileOptions();
      renderRightPanel();
    });

    $('#mobileThemeGrid')?.querySelectorAll('.mobile-theme-card').forEach(el => {
      el.addEventListener('click', () => {
        applyTheme(el.dataset.theme);
        renderMobileOptions();
      });
    });

    $('#mobileLogout')?.addEventListener('click', () => {
      closeMobileSheet();
      clearSession();
      showLogin();
    });

    $('#mobileAdminBtn')?.addEventListener('click', () => {
      closeMobileSheet();
      openMobileAdminDashboard();
    });
  }, 10);
}

function updateMobileBadge() {
  if (!mobileStatusText) return;
  if (token && profile) {
    mobileStatusText.textContent = role === 'admin' ? 'ADMIN' : 'ACTIF';
  } else {
    mobileStatusText.textContent = 'HORS LIGNE';
    if (mobileBadge) {
      mobileBadge.style.background = 'rgba(255,69,58,0.1)';
      mobileBadge.style.borderColor = 'rgba(255,69,58,0.18)';
    }
    const dot = mobileBadge?.querySelector('.mobile-badge-dot');
    if (dot) {
      (dot as HTMLElement).style.background = 'var(--danger)';
      (dot as HTMLElement).style.boxShadow = '0 0 6px var(--danger)';
    }
    if (mobileStatusText) (mobileStatusText as HTMLElement).style.color = 'var(--danger)';
  }
}

function openMobileAdminDashboard() {
  if (!isAdmin) return;

  const modal = document.createElement('div');
  modal.id = 'mobileAdminModal';
  modal.style.cssText = 'position:fixed;inset:0;background:var(--bg,#06050A);z-index:9999;display:flex;flex-direction:column;overflow:hidden;';

  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0;">
      <div style="font-family:'Cinzel',serif;font-size:14px;color:var(--gold,#C8A96E);text-transform:uppercase;letter-spacing:2px;">Administration</div>
      <button id="mobileAdminClose" style="background:none;border:1px solid rgba(255,255,255,0.1);width:32px;height:32px;border-radius:8px;cursor:pointer;color:var(--text-dim,#9B9080);font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>
    <div style="display:flex;gap:4px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.05);flex-shrink:0;overflow-x:auto;">
      <button class="m-admin-tab active" data-tab="users" style="flex:1;min-width:80px;padding:8px 12px;background:rgba(200,169,110,0.12);border:1px solid var(--gold,#C8A96E);color:var(--gold,#C8A96E);font-family:'DM Sans',sans-serif;font-size:11px;cursor:pointer;border-radius:8px;white-space:nowrap;">👥 Utilisateurs</button>
      <button class="m-admin-tab" data-tab="audit" style="flex:1;min-width:80px;padding:8px 12px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:var(--text-dim,#9B9080);font-family:'DM Sans',sans-serif;font-size:11px;cursor:pointer;border-radius:8px;white-space:nowrap;">📋 Audit</button>
      <button class="m-admin-tab" data-tab="backups" style="flex:1;min-width:80px;padding:8px 12px;background:transparent;border:1px solid rgba(255,255,255,0.08);color:var(--text-dim,#9B9080);font-family:'DM Sans',sans-serif;font-size:11px;cursor:pointer;border-radius:8px;white-space:nowrap;">💾 Backups</button>
    </div>
    <div id="mobileAdminContent" style="flex:1;overflow-y:auto;padding:16px;-webkit-overflow-scrolling:touch;"></div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => { if (modal.parentNode) modal.parentNode.removeChild(modal); };
  document.getElementById('mobileAdminClose')?.addEventListener('click', closeModal);

  // Tab switching
  modal.querySelectorAll('.m-admin-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.m-admin-tab').forEach(b => {
        (b as HTMLElement).style.background = 'transparent';
        (b as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
        (b as HTMLElement).style.color = 'var(--text-dim,#9B9080)';
      });
      (btn as HTMLElement).style.background = 'rgba(200,169,110,0.12)';
      (btn as HTMLElement).style.borderColor = 'var(--gold,#C8A96E)';
      (btn as HTMLElement).style.color = 'var(--gold,#C8A96E)';

      const tab = (btn as HTMLElement).dataset.tab;
      if (tab === 'users') renderMobileAdminUsers(modal);
      else if (tab === 'audit') loadMobileAdminAudit(modal);
      else if (tab === 'backups') loadMobileAdminBackups(modal);
    });
  });

  // Initial render
  renderMobileAdminUsers(modal);
}

function renderMobileAdminUsers(modal: HTMLElement) {
  const content = modal.querySelector('#mobileAdminContent');
  if (!content) return;

  content.innerHTML = `
    <button onclick="adminCreateUser()" style="width:100%;padding:14px;background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.2);border-radius:14px;color:var(--gold,#C8A96E);font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;margin-bottom:16px;display:flex;align-items:center;gap:10px;justify-content:center;">
      <span style="font-size:18px;">+</span> Créer un utilisateur
    </button>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${adminUsers.map(user => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:14px 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <div style="font-size:15px;font-weight:500;color:var(--text,#EDE8DD);">
                ${user.firstName || user.name}
                ${user.disabled ? '<span style="color:#FF453A;font-size:10px;margin-left:6px;">DÉSACTIVÉ</span>' : ''}
              </div>
              ${user.email ? `<div style="font-size:12px;color:var(--m-text3,#4A4540);margin-top:2px;">${user.email}</div>` : ''}
            </div>
            <div style="font-size:11px;padding:3px 8px;background:rgba(200,169,110,0.1);border:1px solid rgba(200,169,110,0.15);border-radius:6px;color:var(--m-gold,#C8A96E);">${user.role}</div>
          </div>
          <div style="font-size:11px;color:var(--m-text3,#4A4540);margin-bottom:10px;">
            ${user.messages || 0} messages · Dernière connexion : ${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="adminChangeRole('${user.name}','${user.role}')" style="padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:var(--text-dim,#9B9080);font-size:11px;cursor:pointer;">🔧 Rôle</button>
            <button onclick="adminResetPin('${user.name}')" style="padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:var(--text-dim,#9B9080);font-size:11px;cursor:pointer;">🔑 Reset</button>
            <button onclick="adminToggleDisable('${user.name}',${user.disabled})" style="padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:var(--text-dim,#9B9080);font-size:11px;cursor:pointer;">${user.disabled ? '✓ Activer' : '⊗ Désactiver'}</button>
            <button onclick="adminDeleteUser('${user.name}')" style="padding:6px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,69,58,0.15);border-radius:8px;color:#FF453A;font-size:11px;cursor:pointer;">🗑 Suppr.</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadMobileAdminAudit(modal: HTMLElement) {
  const content = modal.querySelector('#mobileAdminContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:20px;color:var(--m-text3);">Chargement...</div>';
  try {
    const r = await fetch('/api/admin/audit', { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (r.ok) {
      content.innerHTML = (d.logs || []).slice(0, 100).map(log =>
        `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12px;">
          <div style="color:var(--m-gold,#C8A96E);font-size:11px;margin-bottom:2px;">${new Date(log.ts).toLocaleString('fr-FR')}</div>
          <div style="color:var(--text,#EDE8DD);">${log.event}${log.profile ? ` · <span style="color:var(--m-text3);">${log.profile}</span>` : ''}</div>
        </div>`
      ).join('') || '<div style="text-align:center;padding:20px;color:var(--m-text3);">Aucun log</div>';
    }
  } catch { content.innerHTML = '<div style="color:#FF453A;padding:20px;">Erreur</div>'; }
}

async function loadMobileAdminBackups(modal: HTMLElement) {
  const content = modal.querySelector('#mobileAdminContent');
  if (!content) return;
  content.innerHTML = '<div style="text-align:center;padding:20px;color:var(--m-text3);">Chargement...</div>';
  try {
    const r = await fetch('/api/admin/backups', { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if (r.ok) {
      content.innerHTML = `
        <button onclick="createAdminBackup()" style="width:100%;padding:12px;background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.2);border-radius:14px;color:var(--gold,#C8A96E);font-size:13px;cursor:pointer;margin-bottom:16px;">💾 Créer un backup</button>
        ${(d.backups || []).map(b => `
          <div style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:8px;">
            <div style="font-size:14px;color:var(--text);">${b.name}</div>
            <div style="font-size:11px;color:var(--m-text3);margin-top:4px;">${(b.size/1024).toFixed(2)} KB · ${new Date(b.created).toLocaleString('fr-FR')}</div>
          </div>
        `).join('')}
      `;
    }
  } catch { content.innerHTML = '<div style="color:#FF453A;padding:20px;">Erreur</div>'; }
}

// ── KEYBOARD SHORTCUTS ──────────────────────────────────────
function handleGlobalShortcuts(e) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdKey = isMac ? e.metaKey : e.ctrlKey;

  // Ignore if typing in input/textarea (except specific shortcuts)
  const target = e.target;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

  // Esc: Close modals and mobile sheets
  if (e.key === 'Escape') {
    if (mobileSheetCurrent) { closeMobileSheet(); return; }
    if (!loginModal.classList.contains('hidden')) loginModal.classList.add('hidden');
    if (optionsModal && !optionsModal.classList.contains('hidden')) optionsModal.classList.add('hidden');
    return;
  }

  // Don't interfere with typing (except global shortcuts)
  if (isInput && !cmdKey) return;

  // Cmd/Ctrl + K: Focus search
  if (cmdKey && e.key === 'k') {
    e.preventDefault();
    convSearch.focus();
    return;
  }

  // Cmd/Ctrl + Shift + N: New conversation
  if (cmdKey && e.shiftKey && e.key === 'N') {
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

  // Cmd/Ctrl + Shift + E: Export active conversation
  if (cmdKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    if (activeConversationId) {
      exportConversation(activeConversationId, 'md');
    }
    return;
  }

  // Cmd/Ctrl + Shift + B: Toggle sidebar
  if (cmdKey && e.shiftKey && e.key === 'B') {
    e.preventDefault();
    toggleSidebar();
    return;
  }

  // Cmd/Ctrl + Shift + /: Show shortcuts
  if (cmdKey && e.shiftKey && e.key === '?') {
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
    { keys: `${cmd} + ⇧ + N`, action: 'Nouvelle conversation' },
    { keys: `${cmd} + ⇧ + E`, action: 'Exporter la conversation' },
    { keys: `${cmd} + ⇧ + B`, action: 'Afficher/masquer sidebar' },
    { keys: `${cmd} + ⇧ + /`, action: 'Afficher les raccourcis' },
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
async function handleNewConversation() {
  const newConv = await createNewConversation();
  if (newConv) {
    activeConversationId = newConv.id;
    messages = [];
    renderConversations();
    renderMessages();
  }
}
newConvBtn.addEventListener('click', handleNewConversation);
newConvBtnFull?.addEventListener('click', handleNewConversation);

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
});
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click', sendMessage);

// File attach buttons
fileInput.addEventListener('change', handleFileSelect);
$('#attachBtn')?.addEventListener('click', openFilePicker);
mobileAttachBtn?.addEventListener('click', openFilePicker);

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
  clearSession();
  showLogin();
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

// ── MOBILE EVENT LISTENERS ──────────────────────────────────
// Mobile tab clicks
mobileTabs?.querySelectorAll('.mobile-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const sheet = (tab as HTMLElement).dataset.sheet;
    if (sheet === 'chat') {
      closeMobileSheet();
    } else {
      openMobileSheet(sheet);
    }
  });
});

// Mobile backdrop click closes sheet
mobileBackdrop?.addEventListener('click', closeMobileSheet);

// Mobile send button
mobileSendBtn?.addEventListener('click', sendMessage);

// Mobile input auto-resize
mobileInput?.addEventListener('input', () => {
  mobileInput.style.height = 'auto';
  mobileInput.style.height = Math.min(mobileInput.scrollHeight, 88) + 'px';
});

// Mobile input enter to send
mobileInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

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
    updateMobileBadge();
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
