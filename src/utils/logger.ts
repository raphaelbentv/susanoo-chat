import fs from 'fs';
import { CONFIG } from '../config.js';

export type LogLevel = 'info' | 'warn' | 'error';

export function log(level: LogLevel, event: string, details: Record<string, unknown> = {}): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...details,
  };
  const line = JSON.stringify(entry);
  console.log(`[${level}] ${line}`);
  try {
    fs.appendFileSync(CONFIG.LOG_PATH, line + '\n');
  } catch {
    // Silent fail if log write fails
  }
}
