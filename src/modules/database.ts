import fs from 'fs';
import type { Database } from '../types/index.js';
import { CONFIG } from '../config.js';

export function dbRead(): Database {
  try {
    const data = fs.readFileSync(CONFIG.DB_PATH, 'utf8');
    const db = JSON.parse(data) as Database;

    // Initialize new fields if they don't exist
    if (!db.conversations) db.conversations = {};
    if (!db.conversationsData) db.conversationsData = {};
    if (!db.memory) db.memory = {};

    return db;
  } catch {
    return {
      profiles: {},
      memory: {},
      conversations: {},
      conversationsData: {},
    };
  }
}

export function dbWrite(data: Database): void {
  fs.writeFileSync(CONFIG.DB_PATH, JSON.stringify(data, null, 2));
}
