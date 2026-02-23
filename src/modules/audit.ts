import fs from 'fs';
import path from 'path';
import type { AuditEvent, AuditEntry, AuditLog } from '../types/index.js';
import { CONFIG } from '../config.js';
import { log } from '../utils/logger.js';

// Rotate when audit log exceeds 10 MB
const MAX_AUDIT_SIZE = 10 * 1024 * 1024;

function rotateIfNeeded(): void {
  try {
    if (!fs.existsSync(CONFIG.AUDIT_PATH)) return;
    const stats = fs.statSync(CONFIG.AUDIT_PATH);
    if (stats.size < MAX_AUDIT_SIZE) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = path.dirname(CONFIG.AUDIT_PATH);
    const rotatedPath = path.join(dir, `audit-${timestamp}.jsonl`);

    fs.renameSync(CONFIG.AUDIT_PATH, rotatedPath);
    log('info', 'audit_rotated', { rotatedTo: rotatedPath, size: stats.size });

    // Keep at most 5 rotated files
    const files = fs.readdirSync(dir)
      .filter(f => f.startsWith('audit-') && f.endsWith('.jsonl'))
      .sort()
      .reverse();

    for (const old of files.slice(5)) {
      try { fs.unlinkSync(path.join(dir, old)); } catch { /* ignore */ }
    }
  } catch (e) {
    log('error', 'audit_rotate_failed', { error: (e as Error).message });
  }
}

export function audit(event: AuditEvent, details: Record<string, unknown> = {}): void {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };
  const line = JSON.stringify(entry);
  console.log(`[audit] ${line}`);
  try {
    rotateIfNeeded();
    fs.appendFileSync(CONFIG.AUDIT_PATH, line + '\n');
  } catch (e) {
    log('error', 'audit_write_failed', { error: (e as Error).message });
  }
}

export function readAuditLog(limit = 100, offset = 0): AuditLog {
  try {
    const content = fs.readFileSync(CONFIG.AUDIT_PATH, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines
      .map(line => {
        try {
          return JSON.parse(line) as AuditEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is AuditEntry => e !== null);

    entries.reverse();
    return {
      total: entries.length,
      items: entries.slice(offset, offset + limit),
    };
  } catch {
    return { total: 0, items: [] };
  }
}
