import fs from 'fs';
import type { Database } from '../types/index.js';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';

// In-memory cache — avoids sync disk reads on every request
let _cache: Database | null = null;
let _writeTimer: ReturnType<typeof setTimeout> | null = null;

const WRITE_DEBOUNCE_MS = 500;

function initDb(): Database {
  return {
    profiles: {},
    memory: {},
    conversations: {},
    conversationsData: {},
  };
}

function ensureFields(db: Database): Database {
  if (!db.conversations) db.conversations = {};
  if (!db.conversationsData) db.conversationsData = {};
  if (!db.memory) db.memory = {};
  return db;
}

export function dbRead(): Database {
  if (_cache) return _cache;

  try {
    const data = fs.readFileSync(CONFIG.DB_PATH, 'utf8');
    _cache = ensureFields(JSON.parse(data) as Database);
    return _cache;
  } catch {
    _cache = initDb();
    return _cache;
  }
}

export function dbWrite(data: Database): void {
  // Update cache immediately
  _cache = data;

  // Debounce disk writes — coalesce rapid successive writes
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    try {
      const json = JSON.stringify(data, null, 2);
      fs.writeFileSync(CONFIG.DB_PATH, json, { mode: 0o600 });
    } catch (e) {
      log('error', 'db_write_failed', { error: (e as Error).message });
    }
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Force an immediate synchronous write (for shutdown / backup).
 */
export function dbFlush(): void {
  if (_writeTimer) {
    clearTimeout(_writeTimer);
    _writeTimer = null;
  }
  if (_cache) {
    try {
      fs.writeFileSync(CONFIG.DB_PATH, JSON.stringify(_cache, null, 2), { mode: 0o600 });
    } catch (e) {
      log('error', 'db_flush_failed', { error: (e as Error).message });
    }
  }
}
