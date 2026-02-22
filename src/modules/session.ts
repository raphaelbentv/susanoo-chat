import type { Session, AdminSession, Role } from '../types/index.js';
import { genToken } from './crypto.js';
import { CONFIG } from '../config.js';

const SESSIONS = new Map<string, Session>();
const ADMIN_SESSIONS = new Map<string, AdminSession>();

export function createSession(profileName: string, role: Role): string {
  const token = genToken();
  const now = Date.now();
  SESSIONS.set(token, {
    profile: profileName,
    role,
    createdAt: now,
    expiresAt: now + CONFIG.SESSION_TTL_MS,
  });
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
  return token;
}

export function getSession(authHeader?: string): Session | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const session = SESSIONS.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    SESSIONS.delete(token);
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
    return null;
  }
  session._token = token;
  return session;
}

export function refreshSession(oldToken: string): { token: string; expiresAt: number; profile: string; role: Role } | null {
  const session = SESSIONS.get(oldToken);
  if (!session || Date.now() > session.expiresAt) {
    if (session) SESSIONS.delete(oldToken);
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
  return cleaned;
}

export function getActiveSessionCount(): number {
  return SESSIONS.size + ADMIN_SESSIONS.size;
}
