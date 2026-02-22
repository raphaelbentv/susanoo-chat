import type { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import { json, parseBody } from '../utils/http.js';
import { dbRead } from '../modules/database.js';
import { getActiveSessionCount } from '../modules/session.js';
import { getClientIp } from '../modules/ratelimit.js';
import { log } from '../utils/logger.js';
import { CONFIG } from '../config.js';

export async function handleHealth(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const db = dbRead();
  let dbSize = 0;
  try {
    dbSize = fs.statSync(CONFIG.DB_PATH).size;
  } catch {}

  const mem = process.memoryUsage();

  json(res, 200, {
    status: 'ok',
    version: CONFIG.VERSION,
    service: 'susanoo-chat',
    uptimeSec: Math.floor(process.uptime()),
    now: new Date().toISOString(),
    profileCount: Object.keys(db.profiles || {}).length,
    activeSessionCount: getActiveSessionCount(),
    dbSizeBytes: dbSize,
    memoryMB: {
      rss: Math.round(mem.rss / 1048576),
      heap: Math.round(mem.heapUsed / 1048576),
    },
  });
}

export async function handlePasswordPolicy(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  json(res, 200, {
    minLength: CONFIG.PASSWORD.MIN_LENGTH,
    requireUpper: CONFIG.PASSWORD.REQUIRE_UPPER,
    requireLower: CONFIG.PASSWORD.REQUIRE_LOWER,
    requireDigit: CONFIG.PASSWORD.REQUIRE_DIGIT,
    maxAgeDays: CONFIG.PASSWORD.MAX_AGE_DAYS,
  });
}

export async function handleFrontendError(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}');
    log('error', 'frontend_error', {
      message: String(data.message || '').slice(0, 2000),
      stack: String(data.stack || '').slice(0, 4000),
      url: String(data.url || '').slice(0, 500),
      ip: getClientIp(req),
    });
  } catch {}
  json(res, 200, { ok: true });
}
