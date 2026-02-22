import type { IncomingMessage, ServerResponse } from 'http';
import { json } from '../utils/http.js';
import { getSession } from '../modules/session.js';
import { hasPermission } from '../modules/rbac.js';
import { getHashiramaStatus } from '../modules/bridge.js';
import { log } from '../utils/logger.js';

// GET /api/hashirama/status - Get real Hashirama API consumption
export async function handleHashiramaStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'chat')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const status = getHashiramaStatus();
    return json(res, 200, { status });
  } catch (e) {
    log('error', 'hashirama_status_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}
