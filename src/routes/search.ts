import type { IncomingMessage, ServerResponse } from 'http';
import { json, parseBody } from '../utils/http.js';
import { getSession } from '../modules/session.js';
import { hasPermission } from '../modules/rbac.js';
import { log } from '../utils/logger.js';
import { searchConversations } from '../modules/search.js';
import type { SearchRequest } from '../types/search.types.js';

// POST /api/search - Search in conversations
export async function handleSearch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_read')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const bodyStr = await parseBody(req);
    const searchReq = JSON.parse(bodyStr || '{}') as SearchRequest;

    if (!searchReq.query || searchReq.query.trim().length === 0) {
      return json(res, 400, { error: 'query_required' });
    }

    const results = searchConversations(session.profile, searchReq);

    return json(res, 200, {
      results,
      total: results.length,
      query: searchReq.query,
    });
  } catch (e) {
    log('error', 'search_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}
