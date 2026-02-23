import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';

export type LogLevel = 'info' | 'warn' | 'error';

const MAX_LOG_SIZE = 10 * 1024 * 1024;

function rotateLogIfNeeded(): void {
  try {
    if (!fs.existsSync(CONFIG.LOG_PATH)) return;
    const stats = fs.statSync(CONFIG.LOG_PATH);
    if (stats.size < MAX_LOG_SIZE) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.dirname(CONFIG.LOG_PATH);
    fs.renameSync(CONFIG.LOG_PATH, path.join(dir, `app-${timestamp}.log`));

    // Keep at most 5 rotated files
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('app-') && f.endsWith('.log'))
      .sort()
      .reverse();

    for (const old of files.slice(5)) {
      try { fs.unlinkSync(path.join(dir, old)); } catch { /* ignore */ }
    }
  } catch {
    // Silent fail
  }
}

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
    rotateLogIfNeeded();
    fs.appendFileSync(CONFIG.LOG_PATH, line + '\n');
  } catch {
    // Silent fail if log write fails
  }
}
