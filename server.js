/* ══════════════════════════════════════════════════════════
   SUSANOO CHAT — Server v0.2.0
   P0: Sessions, RBAC, Audit, Password Policy, Backup, Observability
   ══════════════════════════════════════════════════════════ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

// ══════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════
const VERSION = '0.2.0';
const PORT = process.env.PORT || 8090;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'profiles.json');
const AUDIT_PATH = path.join(DATA_DIR, 'audit.jsonl');
const LOG_PATH = path.join(DATA_DIR, 'app.log');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Session
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 24 * 60 * 60 * 1000);
const SESSION_CLEANUP_MS = 5 * 60 * 1000;

// Rate limiting
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 15 * 60 * 1000);
const BLOCK_MS = Number(process.env.LOGIN_BLOCK_MS || 15 * 60 * 1000);

// Backup
const BACKUP_PASSPHRASE = process.env.BACKUP_PASSPHRASE || crypto.randomBytes(32).toString('hex');
const BACKUP_INTERVAL_MS = Number(process.env.BACKUP_INTERVAL_MS || 6 * 60 * 60 * 1000);
const BACKUP_MAX_COUNT = Number(process.env.BACKUP_MAX_COUNT || 10);

// Password policy
const PIN_MIN_LENGTH = 8;
const PIN_REQUIRE_UPPER = true;
const PIN_REQUIRE_LOWER = true;
const PIN_REQUIRE_DIGIT = true;
const PIN_MAX_AGE_DAYS = Number(process.env.PIN_MAX_AGE_DAYS || 90);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// ══════════════════════════════════════════════════════════
// RBAC — Roles & Permissions
// ══════════════════════════════════════════════════════════
const ROLES = ['readonly', 'user', 'manager', 'admin'];
const ROLE_LEVEL = { readonly: 0, user: 1, manager: 2, admin: 3 };
const PERMISSIONS = {
  chat:             'readonly',
  history_read:     'readonly',
  memory_add:       'user',
  history_clear:    'user',
  pin_change:       'user',
  profile_self_edit:'user',
  profiles_list:    'manager',
  profiles_manage:  'admin',
  audit_read:       'admin',
  backup_manage:    'admin',
  roles_manage:     'admin',
  pin_reset:        'admin',
};

function hasPermission(userRole, action) {
  const min = PERMISSIONS[action];
  if (!min) return false;
  return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[min] || 99);
}

// ══════════════════════════════════════════════════════════
// FILESYSTEM SETUP
// ══════════════════════════════════════════════════════════
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
ensureDir(DATA_DIR);
ensureDir(BACKUP_DIR);

// ══════════════════════════════════════════════════════════
// STRUCTURED LOGGER
// ══════════════════════════════════════════════════════════
const logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });

function log(level, event, details = {}) {
  const entry = JSON.stringify({ ts: new Date().toISOString(), level, event, ...details });
  console.log(`[${level}] ${entry}`);
  logStream.write(entry + '\n');
}

// ══════════════════════════════════════════════════════════
// AUDIT LOG (append-only JSONL)
// ══════════════════════════════════════════════════════════
function audit(event, details = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...details });
  console.log(`[audit] ${line}`);
  try { fs.appendFileSync(AUDIT_PATH, line + '\n'); } catch (e) { log('error', 'audit_write_failed', { error: e.message }); }
}

function readAuditLog(limit = 100, offset = 0) {
  try {
    const lines = fs.readFileSync(AUDIT_PATH, 'utf8').trim().split('\n').filter(Boolean);
    const entries = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    entries.reverse();
    return { total: entries.length, items: entries.slice(offset, offset + limit) };
  } catch { return { total: 0, items: [] }; }
}

// ══════════════════════════════════════════════════════════
// DATABASE
// ══════════════════════════════════════════════════════════
function dbRead() {
  try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
  catch { return { profiles: {}, memory: {} }; }
}
function dbWrite(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); }

// ══════════════════════════════════════════════════════════
// PASSWORD POLICY
// ══════════════════════════════════════════════════════════
function validatePin(pin) {
  const errors = [];
  if (typeof pin !== 'string') return ['Mot de passe requis'];
  if (pin.length < PIN_MIN_LENGTH) errors.push(`Minimum ${PIN_MIN_LENGTH} caractères`);
  if (PIN_REQUIRE_UPPER && !/[A-Z]/.test(pin)) errors.push('Au moins 1 majuscule');
  if (PIN_REQUIRE_LOWER && !/[a-z]/.test(pin)) errors.push('Au moins 1 minuscule');
  if (PIN_REQUIRE_DIGIT && !/[0-9]/.test(pin)) errors.push('Au moins 1 chiffre');
  return errors;
}

function isPinExpired(p) {
  if (!PIN_MAX_AGE_DAYS || PIN_MAX_AGE_DAYS <= 0) return false;
  const changedAt = p.pinChangedAt || p.createdAt;
  if (!changedAt) return false;
  return (Date.now() - new Date(changedAt).getTime()) > PIN_MAX_AGE_DAYS * 86400000;
}

// ══════════════════════════════════════════════════════════
// CRYPTO HELPERS
// ══════════════════════════════════════════════════════════
function hashPin(pin, salt) { return crypto.pbkdf2Sync(pin, salt, 120000, 32, 'sha256').toString('hex'); }
function genSalt() { return crypto.randomBytes(16).toString('hex'); }
function genToken() { return crypto.randomBytes(24).toString('hex'); }

// ══════════════════════════════════════════════════════════
// SESSION MANAGEMENT
// ══════════════════════════════════════════════════════════
const SESSIONS = new Map();
const ADMIN_SESSIONS = new Map();

function createSession(profileName, role) {
  const t = genToken();
  const now = Date.now();
  SESSIONS.set(t, { profile: profileName, role: role || 'user', createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return t;
}

function getSession(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t) return null;
  const s = SESSIONS.get(t);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { SESSIONS.delete(t); return null; }
  s._token = t;
  return s;
}

function refreshSession(oldToken) {
  const s = SESSIONS.get(oldToken);
  if (!s || Date.now() > s.expiresAt) { if (s) SESSIONS.delete(oldToken); return null; }
  SESSIONS.delete(oldToken);
  const t = genToken();
  const now = Date.now();
  SESSIONS.set(t, { profile: s.profile, role: s.role, createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return { token: t, expiresAt: now + SESSION_TTL_MS, profile: s.profile, role: s.role };
}

function createAdminSession(user) {
  const t = genToken();
  const now = Date.now();
  ADMIN_SESSIONS.set(t, { user, role: 'admin', createdAt: now, expiresAt: now + SESSION_TTL_MS });
  return t;
}

function getAdminSession(req) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t) return null;
  const s = ADMIN_SESSIONS.get(t);
  if (!s) return null;
  if (Date.now() > s.expiresAt) { ADMIN_SESSIONS.delete(t); return null; }
  s._token = t;
  return s;
}

function cleanExpiredSessions() {
  const now = Date.now();
  let cleaned = 0;
  for (const [t, s] of SESSIONS) { if (now > s.expiresAt) { SESSIONS.delete(t); cleaned++; } }
  for (const [t, s] of ADMIN_SESSIONS) { if (now > s.expiresAt) { ADMIN_SESSIONS.delete(t); cleaned++; } }
  if (cleaned > 0) log('info', 'sessions_cleaned', { count: cleaned, active: SESSIONS.size + ADMIN_SESSIONS.size });
}

// ══════════════════════════════════════════════════════════
// RATE LIMITING
// ══════════════════════════════════════════════════════════
const LOGIN_ATTEMPTS = new Map();

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function loginKey(kind, req, id) { return `${kind}:${getClientIp(req)}:${String(id || '').toLowerCase()}`; }

function getLimiterState(key, now = Date.now()) {
  const state = LOGIN_ATTEMPTS.get(key) || { count: 0, firstAt: now, blockedUntil: 0 };
  if (state.blockedUntil && now >= state.blockedUntil) { state.count = 0; state.firstAt = now; state.blockedUntil = 0; }
  if (now - state.firstAt > WINDOW_MS) { state.count = 0; state.firstAt = now; }
  LOGIN_ATTEMPTS.set(key, state);
  return state;
}

function limiterCheck(key, now = Date.now()) {
  const state = getLimiterState(key, now);
  if (state.blockedUntil && now < state.blockedUntil) return { blocked: true, retryAfterMs: state.blockedUntil - now };
  return { blocked: false, retryAfterMs: 0 };
}

function limiterFail(key, now = Date.now()) {
  const state = getLimiterState(key, now);
  state.count += 1;
  if (state.count >= MAX_ATTEMPTS) state.blockedUntil = now + BLOCK_MS;
  LOGIN_ATTEMPTS.set(key, state);
  return state;
}

function limiterReset(key) { LOGIN_ATTEMPTS.delete(key); }

// ══════════════════════════════════════════════════════════
// ENCRYPTED BACKUP
// ══════════════════════════════════════════════════════════
function deriveBackupKey() { return crypto.pbkdf2Sync(BACKUP_PASSPHRASE, 'susanoo-backup-salt', 100000, 32, 'sha256'); }

function createBackup() {
  try {
    const data = JSON.stringify(dbRead(), null, 2);
    const key = deriveBackupKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let enc = cipher.update(data, 'utf8', 'hex');
    enc += cipher.final('hex');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${ts}.enc`;
    fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify({ iv: iv.toString('hex'), data: enc }));
    // Cleanup old
    const all = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.enc')).sort().reverse();
    for (let i = BACKUP_MAX_COUNT; i < all.length; i++) fs.unlinkSync(path.join(BACKUP_DIR, all[i]));
    log('info', 'backup_created', { filename });
    audit('backup_created', { filename });
    return { filename };
  } catch (e) { log('error', 'backup_failed', { error: e.message }); return null; }
}

function listBackups() {
  try {
    return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.enc')).sort().reverse().map(f => {
      const st = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: st.size, createdAt: st.mtime.toISOString() };
    });
  } catch { return []; }
}

// ══════════════════════════════════════════════════════════
// HTTP HELPERS
// ══════════════════════════════════════════════════════════
function send(res, code, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(code, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function json(res, code, data) { send(res, code, JSON.stringify(data), MIME['.json']); }

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 1e6) reject(new Error('too_large')); });
    req.on('end', () => resolve(b));
    req.on('error', reject);
  });
}

function parseUrl(url) {
  const qi = url.indexOf('?');
  const pathname = qi >= 0 ? url.slice(0, qi) : url;
  const params = {};
  if (qi >= 0) { for (const p of url.slice(qi + 1).split('&')) { const [k, v] = p.split('='); if (k) params[decodeURIComponent(k)] = v ? decodeURIComponent(v) : ''; } }
  return { pathname, params };
}

// ══════════════════════════════════════════════════════════
// BRIDGE
// ══════════════════════════════════════════════════════════
function askHashirama(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', '-u', 'node', 'dev-workspace', 'claude', '--permission-mode', 'bypassPermissions', '-p', '-'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('timeout')); }, 90000);
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', c => { clearTimeout(timer); if (c === 0) resolve(out.trim()); else reject(new Error(err || ('exit ' + c))); });
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ══════════════════════════════════════════════════════════
// REQUEST HANDLER
// ══════════════════════════════════════════════════════════
const server = http.createServer(async (req, res) => {
  const { pathname, params } = parseUrl(req.url);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  // ─── PUBLIC ENDPOINTS ───────────────────────────────────

  // Health (enriched)
  if (req.method === 'GET' && pathname === '/api/health') {
    const db = dbRead();
    let dbSize = 0;
    try { dbSize = fs.statSync(DB_PATH).size; } catch {}
    const mem = process.memoryUsage();
    return json(res, 200, {
      status: 'ok',
      version: VERSION,
      service: 'susanoo-chat',
      uptimeSec: Math.floor(process.uptime()),
      now: new Date().toISOString(),
      profileCount: Object.keys(db.profiles || {}).length,
      activeSessionCount: SESSIONS.size + ADMIN_SESSIONS.size,
      dbSizeBytes: dbSize,
      memoryMB: { rss: Math.round(mem.rss / 1048576), heap: Math.round(mem.heapUsed / 1048576) },
    });
  }

  // Password policy (for frontend validation)
  if (req.method === 'GET' && pathname === '/api/password-policy') {
    return json(res, 200, {
      minLength: PIN_MIN_LENGTH,
      requireUpper: PIN_REQUIRE_UPPER,
      requireLower: PIN_REQUIRE_LOWER,
      requireDigit: PIN_REQUIRE_DIGIT,
      maxAgeDays: PIN_MAX_AGE_DAYS,
    });
  }

  // Frontend error logging
  if (req.method === 'POST' && pathname === '/api/log/error') {
    try {
      const d = JSON.parse(await parseBody(req) || '{}');
      log('error', 'frontend_error', {
        message: String(d.message || '').slice(0, 2000),
        stack: String(d.stack || '').slice(0, 4000),
        url: String(d.url || '').slice(0, 500),
        ip: getClientIp(req),
      });
    } catch {}
    return json(res, 200, { ok: true });
  }

  // ─── PROFILE LOGIN ─────────────────────────────────────

  if (req.method === 'POST' && pathname === '/api/profile/login') {
    try {
      const d = JSON.parse(await parseBody(req) || '{}');
      const profileName = String(d.profile || '').trim().toLowerCase();
      const pin = String(d.pin || '');
      if (!profileName || !pin) return json(res, 400, { error: 'profile_pin_required' });

      const key = loginKey('profile', req, profileName);
      const check = limiterCheck(key);
      if (check.blocked) {
        audit('login_blocked', { kind: 'profile', profile: profileName, ip: getClientIp(req) });
        return json(res, 429, { error: 'too_many_attempts', retryAfterMs: check.retryAfterMs });
      }

      const db = dbRead();

      // New profile → create
      if (!db.profiles[profileName]) {
        const pinErrors = validatePin(pin);
        if (pinErrors.length > 0) return json(res, 400, { error: 'pin_policy_failed', details: pinErrors });

        const salt = genSalt();
        const now = new Date().toISOString();
        db.profiles[profileName] = { salt, pinHash: hashPin(pin, salt), role: 'user', createdAt: now, pinChangedAt: now, disabled: false };
        db.memory[profileName] = [];
        dbWrite(db);
        audit('profile_created', { profile: profileName, ip: getClientIp(req) });
        limiterReset(key);
        const t = createSession(profileName, 'user');
        return json(res, 200, { token: t, profile: profileName, role: 'user', expiresAt: SESSIONS.get(t).expiresAt, created: true });
      }

      const p = db.profiles[profileName];
      if (p.disabled) {
        audit('login_disabled', { profile: profileName, ip: getClientIp(req) });
        return json(res, 403, { error: 'account_disabled' });
      }

      if (hashPin(pin, p.salt) !== p.pinHash) {
        const state = limiterFail(key);
        audit('login_failed', { profile: profileName, ip: getClientIp(req), attempts: state.count });
        return json(res, 401, { error: 'invalid_pin', attempts: state.count });
      }

      limiterReset(key);
      if (!p.role) p.role = 'user';
      p.lastLogin = new Date().toISOString();
      dbWrite(db);

      const t = createSession(profileName, p.role);
      audit('login_success', { profile: profileName, role: p.role, ip: getClientIp(req) });
      return json(res, 200, { token: t, profile: profileName, role: p.role, expiresAt: SESSIONS.get(t).expiresAt, pinExpired: isPinExpired(p) });
    } catch (e) {
      log('error', 'profile_login_error', { error: e.message });
      return json(res, 500, { error: 'login_failed' });
    }
  }

  // ─── ADMIN LOGIN ────────────────────────────────────────

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    try {
      const d = JSON.parse(await parseBody(req) || '{}');
      const user = String(d.user || '').trim();
      const pass = String(d.pass || '');
      const key = loginKey('admin', req, user || 'unknown');
      const check = limiterCheck(key);
      if (check.blocked) {
        audit('login_blocked', { kind: 'admin', user, ip: getClientIp(req) });
        return json(res, 429, { error: 'too_many_attempts', retryAfterMs: check.retryAfterMs });
      }

      const db = dbRead();
      if (!db.admin || !user || !pass || user !== db.admin.user || hashPin(pass, db.admin.salt) !== db.admin.passHash) {
        limiterFail(key);
        return json(res, 401, { error: 'invalid_admin' });
      }

      limiterReset(key);
      const t = createAdminSession(user);
      audit('admin_login_success', { user, ip: getClientIp(req) });
      return json(res, 200, { token: t, user, role: 'admin', expiresAt: ADMIN_SESSIONS.get(t).expiresAt });
    } catch (e) {
      log('error', 'admin_login_error', { error: e.message });
      return json(res, 500, { error: 'admin_login_failed' });
    }
  }

  // ─── ADMIN ENDPOINTS ───────────────────────────────────

  if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/login') {
    const a = getAdminSession(req);
    if (!a) return json(res, 401, { error: 'unauthorized' });

    // List profiles
    if (req.method === 'GET' && pathname === '/api/admin/profiles') {
      const db = dbRead();
      const items = Object.keys(db.profiles || {}).map(name => {
        const p = db.profiles[name];
        return {
          name, role: p.role || 'user', disabled: !!p.disabled,
          messages: (db.memory?.[name] || []).length,
          createdAt: p.createdAt || null, lastLogin: p.lastLogin || null,
          pinExpired: isPinExpired(p),
        };
      });
      audit('admin_profiles_list', { user: a.user, count: items.length });
      return json(res, 200, { items });
    }

    // Change role
    if (req.method === 'POST' && pathname === '/api/admin/role') {
      const d = JSON.parse(await parseBody(req) || '{}');
      const target = String(d.profile || '').trim().toLowerCase();
      const newRole = String(d.role || '');
      if (!target || !ROLES.includes(newRole)) return json(res, 400, { error: 'invalid_params', validRoles: ROLES });
      const db = dbRead();
      if (!db.profiles[target]) return json(res, 404, { error: 'profile_not_found' });
      const oldRole = db.profiles[target].role || 'user';
      db.profiles[target].role = newRole;
      dbWrite(db);
      // Update active sessions for this profile
      for (const [, s] of SESSIONS) { if (s.profile === target) s.role = newRole; }
      audit('role_changed', { actor: a.user, target, oldRole, newRole });
      return json(res, 200, { ok: true, profile: target, role: newRole });
    }

    // Reset pin
    if (req.method === 'POST' && pathname === '/api/admin/reset-pin') {
      const d = JSON.parse(await parseBody(req) || '{}');
      const target = String(d.profile || '').trim().toLowerCase();
      const newPin = String(d.pin || '');
      if (!target) return json(res, 400, { error: 'profile_required' });
      const pinErrors = validatePin(newPin);
      if (pinErrors.length > 0) return json(res, 400, { error: 'pin_policy_failed', details: pinErrors });
      const db = dbRead();
      if (!db.profiles[target]) return json(res, 404, { error: 'profile_not_found' });
      const salt = genSalt();
      db.profiles[target].salt = salt;
      db.profiles[target].pinHash = hashPin(newPin, salt);
      db.profiles[target].pinChangedAt = new Date().toISOString();
      dbWrite(db);
      for (const [t, s] of SESSIONS) { if (s.profile === target) SESSIONS.delete(t); }
      audit('pin_reset', { actor: a.user, target });
      return json(res, 200, { ok: true, profile: target });
    }

    // Disable / enable
    if (req.method === 'POST' && pathname === '/api/admin/disable') {
      const d = JSON.parse(await parseBody(req) || '{}');
      const target = String(d.profile || '').trim().toLowerCase();
      const disabled = d.disabled !== false;
      if (!target) return json(res, 400, { error: 'profile_required' });
      const db = dbRead();
      if (!db.profiles[target]) return json(res, 404, { error: 'profile_not_found' });
      db.profiles[target].disabled = disabled;
      dbWrite(db);
      if (disabled) { for (const [t, s] of SESSIONS) { if (s.profile === target) SESSIONS.delete(t); } }
      audit(disabled ? 'profile_disabled' : 'profile_enabled', { actor: a.user, target });
      return json(res, 200, { ok: true, profile: target, disabled });
    }

    // Delete profile
    if (req.method === 'POST' && pathname === '/api/admin/delete-profile') {
      const d = JSON.parse(await parseBody(req) || '{}');
      const target = String(d.profile || '').trim().toLowerCase();
      if (!target) return json(res, 400, { error: 'profile_required' });
      const db = dbRead();
      if (!db.profiles[target]) return json(res, 404, { error: 'profile_not_found' });
      delete db.profiles[target];
      delete db.memory[target];
      dbWrite(db);
      for (const [t, s] of SESSIONS) { if (s.profile === target) SESSIONS.delete(t); }
      audit('profile_deleted', { actor: a.user, target });
      return json(res, 200, { ok: true, profile: target });
    }

    // Audit log
    if (req.method === 'GET' && pathname === '/api/admin/audit') {
      const limit = Math.min(parseInt(params.limit || '100', 10), 500);
      const offset = parseInt(params.offset || '0', 10);
      return json(res, 200, readAuditLog(limit, offset));
    }

    // Backup — create
    if (req.method === 'POST' && pathname === '/api/admin/backup') {
      const result = createBackup();
      if (result) return json(res, 200, result);
      return json(res, 500, { error: 'backup_failed' });
    }

    // Backup — list
    if (req.method === 'GET' && pathname === '/api/admin/backups') {
      return json(res, 200, { items: listBackups() });
    }

    return json(res, 404, { error: 'not_found' });
  }

  // ─── AUTHENTICATED USER ENDPOINTS ──────────────────────

  if (pathname.startsWith('/api/')) {
    const s = getSession(req);
    if (!s) return json(res, 401, { error: 'unauthorized' });

    // Session info
    if (req.method === 'GET' && pathname === '/api/session/info') {
      return json(res, 200, {
        profile: s.profile, role: s.role,
        createdAt: s.createdAt, expiresAt: s.expiresAt,
        remainingMs: Math.max(0, s.expiresAt - Date.now()),
      });
    }

    // Session refresh
    if (req.method === 'POST' && pathname === '/api/session/refresh') {
      const result = refreshSession(s._token);
      if (!result) return json(res, 401, { error: 'session_expired' });
      log('info', 'session_refreshed', { profile: s.profile });
      return json(res, 200, result);
    }

    // Change own pin
    if (req.method === 'POST' && pathname === '/api/profile/change-pin') {
      if (!hasPermission(s.role, 'pin_change')) return json(res, 403, { error: 'forbidden' });
      try {
        const d = JSON.parse(await parseBody(req) || '{}');
        const currentPin = String(d.currentPin || '');
        const newPin = String(d.newPin || '');
        const db = dbRead();
        const p = db.profiles[s.profile];
        if (!p) return json(res, 404, { error: 'profile_not_found' });
        if (hashPin(currentPin, p.salt) !== p.pinHash) return json(res, 401, { error: 'invalid_current_pin' });
        const pinErrors = validatePin(newPin);
        if (pinErrors.length > 0) return json(res, 400, { error: 'pin_policy_failed', details: pinErrors });
        const salt = genSalt();
        p.salt = salt;
        p.pinHash = hashPin(newPin, salt);
        p.pinChangedAt = new Date().toISOString();
        dbWrite(db);
        audit('pin_changed', { profile: s.profile });
        return json(res, 200, { ok: true });
      } catch (e) { return json(res, 500, { error: 'pin_change_failed' }); }
    }

    // History
    if (req.method === 'GET' && pathname === '/api/history') {
      if (!hasPermission(s.role, 'history_read')) return json(res, 403, { error: 'forbidden' });
      const db = dbRead();
      return json(res, 200, { profile: s.profile, role: s.role, items: db.memory[s.profile] || [] });
    }

    // Memory add
    if (req.method === 'POST' && pathname === '/api/memory/add') {
      if (!hasPermission(s.role, 'memory_add')) return json(res, 403, { error: 'forbidden' });
      const d = JSON.parse(await parseBody(req) || '{}');
      const role = d.role === 'user' ? 'user' : 'ai';
      const text = String(d.text || '').slice(0, 8000);
      const db = dbRead();
      db.memory[s.profile] = db.memory[s.profile] || [];
      db.memory[s.profile].push({ role, text, time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) });
      db.memory[s.profile] = db.memory[s.profile].slice(-300);
      dbWrite(db);
      return json(res, 200, { ok: true });
    }

    // Memory clear
    if (req.method === 'POST' && pathname === '/api/memory/clear') {
      if (!hasPermission(s.role, 'history_clear')) return json(res, 403, { error: 'forbidden' });
      const db = dbRead();
      db.memory[s.profile] = [];
      dbWrite(db);
      audit('memory_cleared', { profile: s.profile });
      return json(res, 200, { ok: true });
    }

    // Chat
    if (req.method === 'POST' && pathname === '/api/chat') {
      if (!hasPermission(s.role, 'chat')) return json(res, 403, { error: 'forbidden' });
      try {
        const d = JSON.parse(await parseBody(req) || '{}');
        const message = String(d.message || '').trim();
        if (!message) return json(res, 400, { error: 'message_required' });
        const db = dbRead();
        const hist = (db.memory[s.profile] || []).slice(-12).map(m => `${m.role}: ${m.text}`).join('\n');
        const prompt = `Tu es Hashirama. Profil: ${s.profile}. Réponds en français, concret.\nContexte récent:\n${hist}\n\nMessage: ${message}`;
        const reply = await askHashirama(prompt);
        return json(res, 200, { reply });
      } catch (e) {
        log('error', 'chat_failed', { profile: s.profile, error: e.message });
        return json(res, 500, { error: 'chat_failed' });
      }
    }

    return json(res, 404, { error: 'not_found' });
  }

  // ─── STATIC FILES ──────────────────────────────────────

  const safe = pathname === '/' ? '/index.html' : pathname;
  const full = path.normalize(path.join(ROOT, safe));
  if (!full.startsWith(ROOT)) return send(res, 403, 'Forbidden');
  fs.readFile(full, (err, buf) => {
    if (err) return send(res, 404, 'Not found');
    const ext = path.extname(full).toLowerCase();
    send(res, 200, buf, MIME[ext] || 'application/octet-stream');
  });
});

// ══════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════
server.listen(PORT, () => {
  log('info', 'server_started', { port: PORT, version: VERSION });
  console.log(`Susanoo v${VERSION} listening on :${PORT}`);
});

setInterval(cleanExpiredSessions, SESSION_CLEANUP_MS);
setInterval(createBackup, BACKUP_INTERVAL_MS);
setTimeout(createBackup, 5000);
