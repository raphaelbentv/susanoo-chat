import type { Session, AdminSession, Role } from '../types/index.js';
import { genToken, encryptBackup, decryptBackup } from './crypto.js';
import { CONFIG } from '../config.js';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'fs';
import { join } from 'path';

const SESSIONS = new Map<string, Session>();
const ADMIN_SESSIONS = new Map<string, AdminSession>();
const SESSIONS_FILE = join(CONFIG.DATA_DIR, 'sessions.enc');

interface SessionsStore {
  sessions: Record<string, Session>;
  adminSessions: Record<string, AdminSession>;
}

function saveSessions(): void {
  try {
    const store: SessionsStore = {
      sessions: Object.fromEntries(SESSIONS),
      adminSessions: Object.fromEntries(ADMIN_SESSIONS),
    };
    const plaintext = JSON.stringify(store);
    const encrypted = encryptBackup(plaintext, CONFIG.BACKUP_PASSPHRASE);
    writeFileSync(SESSIONS_FILE, JSON.stringify(encrypted), 'utf8');
    try { chmodSync(SESSIONS_FILE, 0o600); } catch { /* Windows compat */ }
  } catch (e) {
    console.error('[ERROR] Failed to save sessions:', e);
  }
}

export function loadSessions(): void {
  try {
    // Migrate from old plaintext sessions.json if it exists
    const legacyFile = join(CONFIG.DATA_DIR, 'sessions.json');
    const fileToLoad = existsSync(SESSIONS_FILE) ? SESSIONS_FILE
      : existsSync(legacyFile) ? legacyFile
      : null;

    if (!fileToLoad) {
      console.log('[INFO] No sessions file found, starting fresh');
      return;
    }

    const raw = readFileSync(fileToLoad, 'utf8');
    let store: SessionsStore;

    if (fileToLoad === SESSIONS_FILE) {
      // Encrypted format: { iv, data }
      const envelope = JSON.parse(raw) as { iv: string; data: string };
      const plaintext = decryptBackup(envelope.data, envelope.iv, CONFIG.BACKUP_PASSPHRASE);
      store = JSON.parse(plaintext);
    } else {
      // Legacy plaintext format — migrate
      store = JSON.parse(raw);
      console.log('[INFO] Migrating sessions.json to encrypted sessions.enc');
    }

    const now = Date.now();
    let loaded = 0;
    let expired = 0;

    // Load sessions and remove expired ones
    for (const [token, session] of Object.entries(store.sessions || {})) {
      if (now <= session.expiresAt) {
        SESSIONS.set(token, session);
        loaded++;
      } else {
        expired++;
      }
    }

    for (const [token, session] of Object.entries(store.adminSessions || {})) {
      if (now <= session.expiresAt) {
        ADMIN_SESSIONS.set(token, session);
        loaded++;
      } else {
        expired++;
      }
    }

    console.log(`[INFO] Loaded ${loaded} session(s), cleaned ${expired} expired session(s)`);

    // Save in encrypted format (also handles migration)
    saveSessions();
  } catch (e) {
    console.error('[ERROR] Failed to load sessions:', e);
  }
}

export function createSession(profileName: string, role: Role): string {
  const token = genToken();
  const now = Date.now();
  SESSIONS.set(token, {
    profile: profileName,
    role,
    createdAt: now,
    expiresAt: now + CONFIG.SESSION_TTL_MS,
  });
  saveSessions();
  return token;
}

export function createAdminSession(user: string): string {
  const token = genToken();
  const now = Date.now();
  ADMIN_SESSIONS.set(token, {
    user,
    role: 'admin',
    createdAt: now,
    expiresAt: now + CONFIG.SESSION_TTL_MS,
  });
  saveSessions();
  return token;
}

export function getSession(authHeader?: string): Session | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const session = SESSIONS.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(token);
    saveSessions();
    return null;
  }
  session._token = token;
  return session;
}

export function getAdminSession(authHeader?: string): AdminSession | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const session = ADMIN_SESSIONS.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    ADMIN_SESSIONS.delete(token);
    saveSessions();
    return null;
  }
  session._token = token;
  return session;
}

/**
 * Get session for any authenticated user (regular or admin).
 * Returns a Session-compatible object so all routes work for admins too.
 */
export function getAnySession(authHeader?: string): Session | null {
  // Try regular session first
  const session = getSession(authHeader);
  if (session) return session;

  // Fall back to admin session, converting to Session shape
  const adminSession = getAdminSession(authHeader);
  if (adminSession) {
    return {
      profile: adminSession.user,
      role: 'admin' as Role,
      createdAt: adminSession.createdAt,
      expiresAt: adminSession.expiresAt,
      _token: adminSession._token,
    };
  }

  return null;
}

export function refreshSession(oldToken: string): { token: string; expiresAt: number; profile: string; role: Role } | null {
  const session = SESSIONS.get(oldToken);
  if (!session || Date.now() > session.expiresAt) {
    if (session) {
      SESSIONS.delete(oldToken);
      saveSessions();
    }
    return null;
  }
  SESSIONS.delete(oldToken);
  const newToken = genToken();
  const now = Date.now();
  const expiresAt = now + CONFIG.SESSION_TTL_MS;
  SESSIONS.set(newToken, {
    profile: session.profile,
    role: session.role,
    createdAt: now,
    expiresAt,
  });
  saveSessions();
  return { token: newToken, expiresAt, profile: session.profile, role: session.role };
}

export function cleanExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  for (const [token, session] of SESSIONS) {
    if (now > session.expiresAt) {
      SESSIONS.delete(token);
      cleaned++;
    }
  }
  for (const [token, session] of ADMIN_SESSIONS) {
    if (now > session.expiresAt) {
      ADMIN_SESSIONS.delete(token);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    saveSessions();
  }
  return cleaned;
}

export function destroySession(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const existed = SESSIONS.delete(token) || ADMIN_SESSIONS.delete(token);
  if (existed) saveSessions();
  return existed;
}

export function getActiveSessionCount(): number {
  return SESSIONS.size + ADMIN_SESSIONS.size;
}

/**
 * Check if user has admin privileges
 * Returns admin session OR user session with isAdmin: true
 */
export function getAdminOrIsAdminSession(authHeader?: string): { user: string; isUserSession: boolean } | null {
  // First try to get admin session
  const adminSession = getAdminSession(authHeader);
  if (adminSession) {
    return { user: adminSession.user, isUserSession: false };
  }

  // Then try user session with isAdmin check
  const userSession = getSession(authHeader);
  if (!userSession) return null;

  // Import dbRead to check isAdmin flag
  const { dbRead } = require('./database.js');
  const db = dbRead();
  const profile = db.profiles[userSession.profile];

  if (profile && (profile.isAdmin === true || profile.role === 'admin')) {
    return { user: userSession.profile, isUserSession: true };
  }

  return null;
}
