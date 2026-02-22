import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { send, parseUrl, getMimeType } from './utils/http.js';
import { log } from './utils/logger.js';
import { cleanExpiredSessions } from './modules/session.js';
import { createBackup } from './modules/backup.js';

// Routes
import { handleHealth, handlePasswordPolicy, handleFrontendError } from './routes/health.js';
import { handleUnifiedLogin } from './routes/login.js';
import {
  handleProfileLogin,
  handleSessionInfo,
  handleSessionRefresh,
  handleChangePin,
  handleUpdatePreferences,
} from './routes/profile.js';
import {
  handleAdminLogin,
  handleListProfiles,
  handleChangeRole,
  handleResetPin,
  handleDisableProfile,
  handleDeleteProfile,
  handleAuditLog,
  handleCreateBackup,
  handleListBackups,
} from './routes/admin.js';
import {
  handleHistory,
  handleMemoryAdd,
  handleMemoryClear,
  handleChat,
} from './routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup data directories
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDir(CONFIG.DATA_DIR);
ensureDir(CONFIG.BACKUP_DIR);

// Main HTTP server
const server = http.createServer(async (req, res) => {
  const { pathname } = parseUrl(req.url || '/');

  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  // ─── PUBLIC ENDPOINTS ───────────────────────────────────

  if (req.method === 'GET' && pathname === '/api/health') {
    return handleHealth(req, res);
  }

  if (req.method === 'GET' && pathname === '/api/password-policy') {
    return handlePasswordPolicy(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/log/error') {
    return handleFrontendError(req, res);
  }

  // ─── UNIFIED LOGIN ─────────────────────────────────────

  if (req.method === 'POST' && pathname === '/api/login') {
    return handleUnifiedLogin(req, res);
  }

  // ─── LEGACY ENDPOINTS (backwards compatibility) ────────

  if (req.method === 'POST' && pathname === '/api/profile/login') {
    return handleProfileLogin(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/admin/login') {
    return handleAdminLogin(req, res);
  }

  // ─── ADMIN ENDPOINTS ───────────────────────────────────

  if (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/login') {
    if (req.method === 'GET' && pathname === '/api/admin/profiles') {
      return handleListProfiles(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/role') {
      return handleChangeRole(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/reset-pin') {
      return handleResetPin(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/disable') {
      return handleDisableProfile(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/delete-profile') {
      return handleDeleteProfile(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/admin/audit') {
      return handleAuditLog(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/backup') {
      return handleCreateBackup(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/admin/backups') {
      return handleListBackups(req, res);
    }

    return send(res, 404, JSON.stringify({ error: 'not_found' }), 'application/json');
  }

  // ─── AUTHENTICATED USER ENDPOINTS ──────────────────────

  if (pathname.startsWith('/api/')) {
    if (req.method === 'GET' && pathname === '/api/session/info') {
      return handleSessionInfo(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/session/refresh') {
      return handleSessionRefresh(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/profile/change-pin') {
      return handleChangePin(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/preferences') {
      return handleUpdatePreferences(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/history') {
      return handleHistory(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/memory/add') {
      return handleMemoryAdd(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/memory/clear') {
      return handleMemoryClear(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/chat') {
      return handleChat(req, res);
    }

    return send(res, 404, JSON.stringify({ error: 'not_found' }), 'application/json');
  }

  // ─── STATIC FILES ──────────────────────────────────────

  const safePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.normalize(path.join(__dirname, '..', safePath));

  if (!fullPath.startsWith(path.join(__dirname, '..'))) {
    return send(res, 403, 'Forbidden');
  }

  fs.readFile(fullPath, (err, buffer) => {
    if (err) {
      return send(res, 404, 'Not found');
    }
    const ext = path.extname(fullPath);
    send(res, 200, buffer, getMimeType(ext));
  });
});

// ══════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════
server.listen(CONFIG.PORT, () => {
  log('info', 'server_started', { port: CONFIG.PORT, version: CONFIG.VERSION });
  console.log(`✓ Hashirama Chat v${CONFIG.VERSION} (TypeScript)`);
  console.log(`✓ Listening on http://localhost:${CONFIG.PORT}`);
  console.log(`✓ Data directory: ${CONFIG.DATA_DIR}`);
});

setInterval(cleanExpiredSessions, CONFIG.SESSION_CLEANUP_MS);
setInterval(createBackup, CONFIG.BACKUP_INTERVAL_MS);
setTimeout(createBackup, 5000);
