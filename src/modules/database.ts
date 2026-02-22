import fs from 'fs';
import type { Database } from '../types/index.js';
import { CONFIG } from '../config.js';

export function dbRead(): Database {
  try {
    const data = fs.readFileSync(CONFIG.DB_PATH, 'utf8');
    return JSON.parse(data) as Database;
  } catch {
    return { profiles: {}, memory: {} };
  }
}

export function dbWrite(data: Database): void {
  fs.writeFileSync(CONFIG.DB_PATH, JSON.stringify(data, null, 2));
}
