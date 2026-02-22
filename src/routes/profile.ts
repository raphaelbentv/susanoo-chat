import type { IncomingMessage, ServerResponse } from 'http';
import { json, parseBody } from '../utils/http.js';
import { dbRead, dbWrite } from '../modules/database.js';
import { createSession, getSession, refreshSession } from '../modules/session.js';
import { hashPin, genSalt } from '../modules/crypto.js';
import { limiterCheck, limiterFail, limiterReset, loginKey, getClientIp } from '../modules/ratelimit.js';
import { audit } from '../modules/audit.js';
import { validatePin, isPinExpired } from '../modules/auth.js';
import { hasPermission } from '../modules/rbac.js';
import { log } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import type { LoginRequest, ChangePinRequest, ThemeId } from '../types/index.js';

interface UpdatePreferencesRequest {
  theme?: ThemeId;
  fontSize?: 'small' | 'medium' | 'large';
}

export async function handleProfileLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const bodyStr = await parseBody(req);
    const body = JSON.parse(bodyStr || '{}') as LoginRequest;
    const profileName = String(body.profile || '').trim().toLowerCase();
    const pin = String(body.pin || '');

    if (!profileName || !pin) {
      return json(res, 400, { error: 'profile_pin_required' });
    }

    const key = loginKey('profile', req, profileName);
    const check = limiterCheck(key);

    if (check.blocked) {
      audit('login_blocked', { kind: 'profile', profile: profileName, ip: getClientIp(req) });
      return json(res, 429, { error: 'too_many_attempts', retryAfterMs: check.retryAfterMs });
    }

    const db = dbRead();

    // New profile creation
    if (!db.profiles[profileName]) {
      const pinErrors = validatePin(pin);
      if (pinErrors.length > 0) {
        return json(res, 400, { error: 'pin_policy_failed', details: pinErrors });
      }

      const salt = genSalt();
      const now = new Date().toISOString();
      db.profiles[profileName] = {
        salt,
        pinHash: hashPin(pin, salt),
        role: 'user',
        createdAt: now,
        pinChangedAt: now,
        disabled: false,
      };
      db.memory[profileName] = [];
      dbWrite(db);
      audit('profile_created', { profile: profileName, ip: getClientIp(req) });
      limiterReset(key);

      const token = createSession(profileName, 'user');
      return json(res, 200, {
        token,
        profile: profileName,
        role: 'user',
        expiresAt: Date.now() + CONFIG.SESSION_TTL_MS,
        created: true,
      });
    }

    // Existing profile login
    const profile = db.profiles[profileName];

    if (profile.disabled) {
      audit('login_disabled', { profile: profileName, ip: getClientIp(req) });
      return json(res, 403, { error: 'account_disabled' });
    }

    if (hashPin(pin, profile.salt) !== profile.pinHash) {
      const state = limiterFail(key);
      audit('login_failed', { profile: profileName, ip: getClientIp(req), attempts: state.count });
      return json(res, 401, { error: 'invalid_pin', attempts: state.count });
    }

    limiterReset(key);
    profile.lastLogin = new Date().toISOString();
    dbWrite(db);

    const token = createSession(profileName, profile.role);
    audit('login_success', { profile: profileName, role: profile.role, ip: getClientIp(req) });

    return json(res, 200, {
      token,
      profile: profileName,
      role: profile.role,
      expiresAt: Date.now() + CONFIG.SESSION_TTL_MS,
      pinExpired: isPinExpired(profile),
    });
  } catch (e) {
    log('error', 'profile_login_error', { error: (e as Error).message });
    return json(res, 500, { error: 'login_failed' });
  }
}

export async function handleSessionInfo(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  const db = dbRead();
  const profile = db.profiles[session.profile];
  const preferences = profile?.preferences || { theme: 'emperor' };

  return json(res, 200, {
    profile: session.profile,
    role: session.role,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    ttlMs: Math.max(0, session.expiresAt - Date.now()),
    preferences,
  });
}

export async function handleSessionRefresh(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session || !session._token) {
    return json(res, 401, { error: 'unauthorized' });
  }

  const result = refreshSession(session._token);
  if (!result) {
    return json(res, 401, { error: 'session_expired' });
  }

  log('info', 'session_refreshed', { profile: session.profile });
  return json(res, 200, result);
}

export async function handleChangePin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'pin_change')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as ChangePinRequest;
    const currentPin = String(data.oldPin || '');
    const newPin = String(data.newPin || '');

    const db = dbRead();
    const profile = db.profiles[session.profile];

    if (!profile) {
      return json(res, 404, { error: 'profile_not_found' });
    }

    if (hashPin(currentPin, profile.salt) !== profile.pinHash) {
      return json(res, 401, { error: 'invalid_current_pin' });
    }

    const pinErrors = validatePin(newPin);
    if (pinErrors.length > 0) {
      return json(res, 400, { error: 'pin_policy_failed', details: pinErrors });
    }

    const salt = genSalt();
    profile.salt = salt;
    profile.pinHash = hashPin(newPin, salt);
    profile.pinChangedAt = new Date().toISOString();
    dbWrite(db);

    audit('pin_changed', { profile: session.profile });
    return json(res, 200, { ok: true });
  } catch (e) {
    log('error', 'pin_change_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'pin_change_failed' });
  }
}

export async function handleUpdatePreferences(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as UpdatePreferencesRequest;

    const db = dbRead();
    const profile = db.profiles[session.profile];

    if (!profile) {
      return json(res, 404, { error: 'profile_not_found' });
    }

    // Initialize preferences if they don't exist
    if (!profile.preferences) {
      profile.preferences = { theme: 'emperor' };
    }

    // Update preferences
    if (data.theme) {
      const validThemes: ThemeId[] = ['obsidian', 'cyber', 'emperor', 'ghost', 'storm', 'brutal'];
      if (!validThemes.includes(data.theme)) {
        return json(res, 400, { error: 'invalid_theme' });
      }
      profile.preferences.theme = data.theme;
    }

    if (data.fontSize) {
      profile.preferences.fontSize = data.fontSize;
    }

    dbWrite(db);
    audit('preferences_updated', { profile: session.profile, theme: profile.preferences.theme });

    return json(res, 200, {
      ok: true,
      preferences: profile.preferences,
    });
  } catch (e) {
    log('error', 'preferences_update_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'preferences_update_failed' });
  }
}
