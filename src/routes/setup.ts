import type { IncomingMessage, ServerResponse } from 'http';
import { json, parseBody } from '../utils/http.js';
import { dbRead, dbWrite } from '../modules/database.js';
import { hashPin, genSalt } from '../modules/crypto.js';
import { validatePin } from '../modules/auth.js';
import { audit } from '../modules/audit.js';
import { getClientIp } from '../modules/ratelimit.js';
import { log } from '../utils/logger.js';

interface SetupRequest {
  user: string;
  password: string;
}

/**
 * GET /api/setup/status — Check if initial setup is needed
 */
export async function handleSetupStatus(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = dbRead();
  json(res, 200, { needsSetup: !db.admin });
}

/**
 * POST /api/setup — Create the first admin account.
 * Only works when no admin exists. Locked permanently after first use.
 */
export async function handleSetup(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const db = dbRead();

    if (db.admin) {
      return json(res, 403, { error: 'setup_already_completed' });
    }

    const bodyStr = await parseBody(req);
    const body = JSON.parse(bodyStr || '{}') as SetupRequest;
    const user = String(body.user || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!user || user.length < 3) {
      return json(res, 400, { error: 'username_min_3_chars' });
    }

    if (!/^[a-z0-9_-]+$/.test(user)) {
      return json(res, 400, { error: 'username_alphanumeric_only' });
    }

    const pinErrors = validatePin(password);
    if (pinErrors.length > 0) {
      return json(res, 400, { error: 'password_policy_failed', details: pinErrors });
    }

    const salt = genSalt();
    db.admin = {
      user,
      salt,
      passHash: hashPin(password, salt),
    };
    dbWrite(db);

    audit('admin_setup_completed', { user, ip: getClientIp(req) });
    log('info', 'admin_setup', { user });
    console.log(`✓ Admin account "${user}" created via initial setup`);

    return json(res, 200, { ok: true, user });
  } catch (e) {
    log('error', 'setup_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'setup_failed' });
  }
}
