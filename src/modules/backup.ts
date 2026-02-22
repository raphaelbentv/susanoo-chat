import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { encryptBackup } from './crypto.js';
import { dbRead } from './database.js';
import { audit } from './audit.js';
import { log } from '../utils/logger.js';

export function createBackup(): void {
  try {
    const db = dbRead();
    const json = JSON.stringify(db, null, 2);
    const { iv, data } = encryptBackup(json, CONFIG.BACKUP_PASSPHRASE);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.enc`;
    const filepath = path.join(CONFIG.BACKUP_DIR, filename);

    if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
      fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
    }

    fs.writeFileSync(filepath, JSON.stringify({ iv, data }));
    audit('backup_created', { file: filename, size: fs.statSync(filepath).size });
    log('info', 'backup_created', { file: filename });

    cleanOldBackups();
  } catch (e) {
    log('error', 'backup_failed', { error: (e as Error).message });
  }
}

export function listBackups(): Array<{ name: string; size: number; mtime: string }> {
  try {
    if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
      return [];
    }
    const files = fs.readdirSync(CONFIG.BACKUP_DIR);
    return files
      .filter(f => f.startsWith('backup-') && f.endsWith('.enc'))
      .map(name => {
        const filepath = path.join(CONFIG.BACKUP_DIR, name);
        const stats = fs.statSync(filepath);
        return {
          name,
          size: stats.size,
          mtime: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.mtime.localeCompare(a.mtime));
  } catch {
    return [];
  }
}

export function cleanOldBackups(): void {
  const backups = listBackups();
  if (backups.length > CONFIG.BACKUP_MAX_COUNT) {
    const toDelete = backups.slice(CONFIG.BACKUP_MAX_COUNT);
    for (const backup of toDelete) {
      try {
        fs.unlinkSync(path.join(CONFIG.BACKUP_DIR, backup.name));
        log('info', 'backup_deleted', { file: backup.name });
      } catch (e) {
        log('error', 'backup_delete_failed', { file: backup.name, error: (e as Error).message });
      }
    }
  }
}
