import type { IncomingMessage, ServerResponse } from 'http';
import { json, parseBody, parseUrl } from '../utils/http.js';
import { dbRead, dbWrite } from '../modules/database.js';
import { createAdminSession, getAdminOrIsAdminSession } from '../modules/session.js';
import { hashPin, genSalt, generatePassword } from '../modules/crypto.js';
import { sendWelcomeEmail } from '../modules/email.js';
import { limiterCheck, limiterFail, limiterReset, loginKey, getClientIp } from '../modules/ratelimit.js';
import { audit, readAuditLog } from '../modules/audit.js';
import { validatePin, isPinExpired } from '../modules/auth.js';
import { createBackup, listBackups } from '../modules/backup.js';
import { log } from '../utils/logger.js';
import { validate } from '../modules/validate.js';
import type { AdminLoginRequest, ChangeRoleRequest, ResetPinRequest, DisableProfileRequest, DeleteProfileRequest, Role } from '../types/index.js';

const ROLES: Role[] = ['readonly', 'user', 'manager', 'admin'];

export async function handleAdminLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as AdminLoginRequest;
    const user = String(data.user || '').trim();
    const pass = String(data.pass || '');

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
    const token = createAdminSession(user);
    audit('admin_login_success', { user, ip: getClientIp(req) });

    return json(res, 200, {
      adminToken: token,
      user,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });
  } catch (e) {
    log('error', 'admin_login_error', { error: (e as Error).message });
    return json(res, 500, { error: 'admin_login_failed' });
  }
}

export async function handleCreateProfile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}');

    const { valid, errors } = validate(data as Record<string, unknown>, {
      firstName: { type: 'string', required: true, minLength: 1, maxLength: 64 },
      email: { type: 'string', required: true, minLength: 5, maxLength: 128, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
      role: { type: 'string', required: true, oneOf: ['user', 'admin'] },
    });
    if (!valid) {
      return json(res, 400, { error: 'validation_failed', details: errors });
    }

    const firstName = String(data.firstName).trim();
    const email = String(data.email).trim().toLowerCase();
    const role = String(data.role) as Role;
    const profileKey = email;

    const db = dbRead();
    if (db.profiles[profileKey]) {
      return json(res, 409, { error: 'profile_already_exists' });
    }

    const password = generatePassword();

    const salt = genSalt();
    const now = new Date().toISOString();
    db.profiles[profileKey] = {
      salt,
      pinHash: hashPin(password, salt),
      role,
      createdAt: now,
      pinChangedAt: now,
      disabled: false,
      email,
      firstName,
      preferences: { theme: 'emperor' },
    };
    db.memory[profileKey] = [];
    dbWrite(db);

    let emailSent = false;
    try {
      emailSent = await sendWelcomeEmail(email, firstName, password);
      audit(emailSent ? 'welcome_email_sent' : 'welcome_email_failed', {
        actor: adminSession.user, profile: profileKey,
      });
    } catch (e) {
      audit('welcome_email_failed', { actor: adminSession.user, profile: profileKey, error: (e as Error).message });
    }

    audit('profile_created', { actor: adminSession.user, profile: profileKey, role, email, firstName });
    return json(res, 201, { ok: true, profile: profileKey, role, generatedPassword: password, emailSent });
  } catch (e) {
    log('error', 'create_profile_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'create_profile_failed' });
  }
}

export async function handleListProfiles(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  const db = dbRead();
  const items = Object.keys(db.profiles || {}).map(name => {
    const p = db.profiles[name];
    return {
      name,
      role: p.role || 'user',
      disabled: !!p.disabled,
      messages: (db.memory?.[name] || []).length,
      createdAt: p.createdAt || null,
      lastLogin: p.lastLogin || null,
      pinExpired: isPinExpired(p),
      email: p.email || null,
      firstName: p.firstName || null,
    };
  });

  audit('admin_profiles_list', { user: adminSession.user, count: items.length });
  return json(res, 200, { items });
}

export async function handleChangeRole(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as ChangeRoleRequest;

    const { valid, errors } = validate(data as unknown as Record<string, unknown>, {
      profile: { type: 'string', required: true, minLength: 1, maxLength: 64 },
      role: { type: 'string', required: true, oneOf: ROLES },
    });
    if (!valid) {
      return json(res, 400, { error: 'validation_failed', details: errors, validRoles: ROLES });
    }

    const target = String(data.profile).trim().toLowerCase();
    const newRole = String(data.role);

    const db = dbRead();
    if (!db.profiles[target]) {
      return json(res, 404, { error: 'profile_not_found' });
    }

    const oldRole = db.profiles[target].role || 'user';
    db.profiles[target].role = newRole as Role;
    dbWrite(db);

    audit('role_changed', { actor: adminSession.user, target, oldRole, newRole });
    return json(res, 200, { ok: true, profile: target, role: newRole });
  } catch (e) {
    log('error', 'role_change_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'role_change_failed' });
  }
}

export async function handleResetPin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as ResetPinRequest;
    const target = String(data.profile || '').trim().toLowerCase();
    const newPin = String(data.newPin || '');

    if (!target) {
      return json(res, 400, { error: 'profile_required' });
    }

    const pinErrors = validatePin(newPin);
    if (pinErrors.length > 0) {
      return json(res, 400, { error: 'pin_policy_failed', details: pinErrors });
    }

    const db = dbRead();
    if (!db.profiles[target]) {
      return json(res, 404, { error: 'profile_not_found' });
    }

    const salt = genSalt();
    db.profiles[target].salt = salt;
    db.profiles[target].pinHash = hashPin(newPin, salt);
    db.profiles[target].pinChangedAt = new Date().toISOString();
    dbWrite(db);

    audit('pin_reset', { actor: adminSession.user, target });
    return json(res, 200, { ok: true, profile: target });
  } catch (e) {
    log('error', 'pin_reset_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'pin_reset_failed' });
  }
}

export async function handleDisableProfile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as DisableProfileRequest;
    const target = String(data.profile || '').trim().toLowerCase();
    const disabled = data.disabled !== false;

    if (!target) {
      return json(res, 400, { error: 'profile_required' });
    }

    const db = dbRead();
    if (!db.profiles[target]) {
      return json(res, 404, { error: 'profile_not_found' });
    }

    db.profiles[target].disabled = disabled;
    dbWrite(db);

    audit(disabled ? 'profile_disabled' : 'profile_enabled', { actor: adminSession.user, target });
    return json(res, 200, { ok: true, profile: target, disabled });
  } catch (e) {
    log('error', 'disable_profile_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'disable_profile_failed' });
  }
}

export async function handleDeleteProfile(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as DeleteProfileRequest;
    const target = String(data.profile || '').trim().toLowerCase();

    if (!target) {
      return json(res, 400, { error: 'profile_required' });
    }

    const db = dbRead();
    if (!db.profiles[target]) {
      return json(res, 404, { error: 'profile_not_found' });
    }

    delete db.profiles[target];
    delete db.memory[target];
    dbWrite(db);

    audit('profile_deleted', { actor: adminSession.user, target });
    return json(res, 200, { ok: true, profile: target });
  } catch (e) {
    log('error', 'delete_profile_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'delete_profile_failed' });
  }
}

export async function handleAuditLog(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  const { params } = parseUrl(req.url || '');
  const limit = Math.min(parseInt(params.limit || '100', 10), 500);
  const offset = parseInt(params.offset || '0', 10);

  return json(res, 200, readAuditLog(limit, offset));
}

export async function handleCreateBackup(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  createBackup();
  return json(res, 200, { ok: true });
}

export async function handleListBackups(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const adminSession = getAdminOrIsAdminSession(req.headers.authorization);
  if (!adminSession) {
    return json(res, 401, { error: 'unauthorized' });
  }

  const backups = listBackups();
  return json(res, 200, { items: backups });
}
