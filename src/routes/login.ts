import type { IncomingMessage, ServerResponse } from 'http';
import { json, parseBody } from '../utils/http.js';
import { dbRead, dbWrite } from '../modules/database.js';
import { createSession, createAdminSession } from '../modules/session.js';
import { hashPin, genSalt } from '../modules/crypto.js';
import { limiterCheck, limiterFail, limiterReset, loginKey, getClientIp } from '../modules/ratelimit.js';
import { audit } from '../modules/audit.js';
import { validatePin, isPinExpired } from '../modules/auth.js';
import { log } from '../utils/logger.js';
import { CONFIG } from '../config.js';

interface UnifiedLoginRequest {
  identifier: string;
  password: string;
}

export async function handleUnifiedLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const bodyStr = await parseBody(req);
    const body = JSON.parse(bodyStr || '{}') as UnifiedLoginRequest;
    const identifier = String(body.identifier || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!identifier || !password) {
      return json(res, 400, { error: 'identifier_password_required' });
    }

    const db = dbRead();

    // Check if this is an admin login attempt
    if (db.admin && identifier === db.admin.user) {
      const key = loginKey('admin', req, identifier);
      const check = limiterCheck(key);

      if (check.blocked) {
        audit('login_blocked', { kind: 'admin', user: identifier, ip: getClientIp(req) });
        return json(res, 429, { error: 'too_many_attempts', retryAfterMs: check.retryAfterMs });
      }

      if (hashPin(password, db.admin.salt) !== db.admin.passHash) {
        limiterFail(key);
        audit('login_failed', { kind: 'admin', user: identifier, ip: getClientIp(req) });
        return json(res, 401, { error: 'invalid_credentials' });
      }

      limiterReset(key);
      const token = createAdminSession(identifier);
      audit('admin_login_success', { user: identifier, ip: getClientIp(req) });

      return json(res, 200, {
        token,
        identifier,
        role: 'admin',
        type: 'admin',
        expiresAt: Date.now() + CONFIG.SESSION_TTL_MS,
      });
    }

    // Otherwise, treat as profile login
    const key = loginKey('profile', req, identifier);
    const check = limiterCheck(key);

    if (check.blocked) {
      audit('login_blocked', { kind: 'profile', profile: identifier, ip: getClientIp(req) });
      return json(res, 429, { error: 'too_many_attempts', retryAfterMs: check.retryAfterMs });
    }

    // New profile creation
    if (!db.profiles[identifier]) {
      const pinErrors = validatePin(password);
      if (pinErrors.length > 0) {
        return json(res, 400, { error: 'password_policy_failed', details: pinErrors });
      }

      const salt = genSalt();
      const now = new Date().toISOString();
      db.profiles[identifier] = {
        salt,
        pinHash: hashPin(password, salt),
        role: 'user',
        createdAt: now,
        pinChangedAt: now,
        disabled: false,
        preferences: {
          theme: 'emperor', // Default theme
        },
      };
      db.memory[identifier] = [];
      dbWrite(db);
      audit('profile_created', { profile: identifier, ip: getClientIp(req) });
      limiterReset(key);

      const token = createSession(identifier, 'user');
      return json(res, 200, {
        token,
        identifier,
        role: 'user',
        type: 'profile',
        expiresAt: Date.now() + CONFIG.SESSION_TTL_MS,
        created: true,
        preferences: { theme: 'emperor' },
      });
    }

    // Existing profile login
    const profile = db.profiles[identifier];

    if (profile.disabled) {
      audit('login_disabled', { profile: identifier, ip: getClientIp(req) });
      return json(res, 403, { error: 'account_disabled' });
    }

    if (hashPin(password, profile.salt) !== profile.pinHash) {
      const state = limiterFail(key);
      audit('login_failed', { profile: identifier, ip: getClientIp(req), attempts: state.count });
      return json(res, 401, { error: 'invalid_credentials', attempts: state.count });
    }

    limiterReset(key);
    profile.lastLogin = new Date().toISOString();

    // Ensure existing profiles have default preferences
    if (!profile.preferences) {
      profile.preferences = { theme: 'emperor' };
    }

    dbWrite(db);

    const token = createSession(identifier, profile.role);
    audit('login_success', { profile: identifier, role: profile.role, ip: getClientIp(req) });

    return json(res, 200, {
      token,
      identifier,
      role: profile.role,
      isAdmin: profile.isAdmin || false,
      type: 'profile',
      expiresAt: Date.now() + CONFIG.SESSION_TTL_MS,
      pinExpired: isPinExpired(profile),
      preferences: profile.preferences,
    });
  } catch (e) {
    log('error', 'unified_login_error', { error: (e as Error).message });
    return json(res, 500, { error: 'login_failed' });
  }
}
