import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config.js';
import { send, json, parseUrl, getMimeType } from './utils/http.js';
import { log } from './utils/logger.js';
import { cleanExpiredSessions, loadSessions } from './modules/session.js';
import { createBackup } from './modules/backup.js';

// Routes
import { handleHealth, handlePasswordPolicy, handleFrontendError } from './routes/health.js';
import { handleSetupStatus, handleSetup } from './routes/setup.js';
import { handleUnifiedLogin } from './routes/login.js';
import {
  handleProfileLogin,
  handleLogout,
  handleSessionInfo,
  handleSessionRefresh,
  handleChangePin,
  handleUpdatePreferences,
} from './routes/profile.js';
import {
  handleAdminLogin,
  handleCreateProfile,
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
import { handleSearch } from './routes/search.js';
import { handleStatistics } from './routes/statistics.js';
import { handleHashiramaStatus } from './routes/hashirama.js';
import {
  handleListConversations,
  handleCreateConversation,
  handleGetConversation,
  handleUpdateConversation,
  handleDeleteConversation,
  handleAddMessage,
  handleGetMessages,
  handleExportConversation,
} from './routes/conversations.js';

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

// ─── TLS CONFIGURATION ─────────────────────────────────
const tlsCert = process.env.TLS_CERT_PATH;
const tlsKey = process.env.TLS_KEY_PATH;
const useTLS = !!(tlsCert && tlsKey);

let tlsOptions: https.ServerOptions | undefined;
if (useTLS) {
  try {
    tlsOptions = {
      cert: fs.readFileSync(tlsCert),
      key: fs.readFileSync(tlsKey),
    };
    log('info', 'tls_enabled', { cert: tlsCert });
  } catch (e) {
    console.error(`[FATAL] Failed to load TLS certificates: ${(e as Error).message}`);
    process.exit(1);
  }
}

// Main request handler
const requestHandler = async (req: http.IncomingMessage, res: http.ServerResponse) => {
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

  // ─── INITIAL SETUP ──────────────────────────────────────

  if (req.method === 'GET' && pathname === '/api/setup/status') {
    return handleSetupStatus(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/setup') {
    return handleSetup(req, res);
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
    // Rate limit all admin actions
    const { adminActionCheck } = await import('./modules/ratelimit.js');
    const adminRateCheck = adminActionCheck(req);
    if (adminRateCheck.blocked) {
      return json(res, 429, { error: 'too_many_requests', retryAfterMs: adminRateCheck.retryAfterMs });
    }
    if (req.method === 'POST' && pathname === '/api/admin/create-profile') {
      return handleCreateProfile(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/admin/profiles') {
      return handleListProfiles(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/change-role') {
      return handleChangeRole(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/reset-pin') {
      return handleResetPin(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/admin/disable-profile') {
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
    if (req.method === 'POST' && pathname === '/api/logout') {
      return handleLogout(req, res);
    }

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

    if (req.method === 'POST' && pathname === '/api/search') {
      return handleSearch(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/statistics') {
      return handleStatistics(req, res);
    }

    if (req.method === 'GET' && pathname === '/api/hashirama/status') {
      return handleHashiramaStatus(req, res);
    }

    // ─── CONVERSATIONS ENDPOINTS ───────────────────────────

    if (req.method === 'GET' && pathname === '/api/conversations') {
      return handleListConversations(req, res);
    }

    if (req.method === 'POST' && pathname === '/api/conversations') {
      return handleCreateConversation(req, res);
    }

    // Routes with :id parameter
    const conversationMatch = pathname.match(/^\/api\/conversations\/([a-f0-9]+)$/);
    if (conversationMatch) {
      const conversationId = conversationMatch[1];

      if (req.method === 'GET') {
        return handleGetConversation(req, res, conversationId);
      }

      if (req.method === 'PUT') {
        return handleUpdateConversation(req, res, conversationId);
      }

      if (req.method === 'DELETE') {
        return handleDeleteConversation(req, res, conversationId);
      }
    }

    const messagesMatch = pathname.match(/^\/api\/conversations\/([a-f0-9]+)\/messages$/);
    if (messagesMatch) {
      const conversationId = messagesMatch[1];

      if (req.method === 'GET') {
        return handleGetMessages(req, res, conversationId);
      }

      if (req.method === 'POST') {
        return handleAddMessage(req, res, conversationId);
      }
    }

    const exportMatch = pathname.match(/^\/api\/conversations\/([a-f0-9]+)\/export$/);
    if (exportMatch) {
      const conversationId = exportMatch[1];

      if (req.method === 'GET') {
        return handleExportConversation(req, res, conversationId);
      }
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
};

// ══════════════════════════════════════════════════════════
// START
// ══════════════════════════════════════════════════════════

// Load persisted sessions before starting server
loadSessions();

// Warn if no admin account exists
import { dbRead, dbFlush } from './modules/database.js';
const _db = dbRead();
if (!_db.admin) {
  console.log('⚠ No admin account configured — POST /api/setup to create one');
}

// Create server with TLS if certificates are configured
const server = useTLS
  ? https.createServer(tlsOptions!, requestHandler)
  : http.createServer(requestHandler);

const protocol = useTLS ? 'https' : 'http';

server.listen(CONFIG.PORT, () => {
  log('info', 'server_started', { port: CONFIG.PORT, version: CONFIG.VERSION, tls: useTLS });
  console.log(`✓ Hashirama Chat v${CONFIG.VERSION} (TypeScript)`);
  console.log(`✓ Listening on ${protocol}://localhost:${CONFIG.PORT}`);
  if (!useTLS) {
    console.log(`⚠ TLS disabled — set TLS_CERT_PATH and TLS_KEY_PATH for HTTPS`);
  }
  console.log(`✓ Data directory: ${CONFIG.DATA_DIR}`);
});

setInterval(cleanExpiredSessions, CONFIG.SESSION_CLEANUP_MS);
setInterval(createBackup, CONFIG.BACKUP_INTERVAL_MS);
setTimeout(createBackup, 5000);

// Graceful shutdown — flush pending writes
function shutdown() {
  log('info', 'server_stopping', {});
  dbFlush();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
