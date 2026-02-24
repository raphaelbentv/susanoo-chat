import type { IncomingMessage, ServerResponse } from 'http';
import { json } from '../utils/http.js';
import { getAnySession as getSession } from '../modules/session.js';
import { hasPermission } from '../modules/rbac.js';
import { log } from '../utils/logger.js';
import { calculateStatistics } from '../modules/statistics.js';

// GET /api/statistics?period=7d|30d|90d|all
export async function handleStatistics(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_read')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const period = (url.searchParams.get('period') || 'all') as '7d' | '30d' | '90d' | 'all';

    const stats = calculateStatistics(session.profile, period);

    return json(res, 200, { statistics: stats });
  } catch (e) {
    log('error', 'statistics_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}
