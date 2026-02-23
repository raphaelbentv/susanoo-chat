import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Validate required environment variables
if (!process.env.BACKUP_PASSPHRASE) {
  console.error('[FATAL] BACKUP_PASSPHRASE environment variable is required.');
  console.error('        Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  process.exit(1);
}

export const CONFIG = {
  VERSION: '0.2.0',
  PORT: Number(process.env.PORT) || 8090,
  ROOT: __dirname,

  // Paths (computed from ROOT)
  get DATA_DIR(): string {
    return path.join(this.ROOT, '../data');
  },
  get DB_PATH(): string {
    return path.join(this.DATA_DIR, 'profiles.json');
  },
  get AUDIT_PATH(): string {
    return path.join(this.DATA_DIR, 'audit.jsonl');
  },
  get LOG_PATH(): string {
    return path.join(this.DATA_DIR, 'app.log');
  },
  get BACKUP_DIR(): string {
    return path.join(this.DATA_DIR, 'backups');
  },

  // Session
  SESSION_TTL_MS: Number(process.env.SESSION_TTL_MS) || 24 * 60 * 60 * 1000,
  SESSION_CLEANUP_MS: 5 * 60 * 1000,

  // Rate limiting
  MAX_ATTEMPTS: Number(process.env.LOGIN_MAX_ATTEMPTS) || 5,
  WINDOW_MS: Number(process.env.LOGIN_WINDOW_MS) || 15 * 60 * 1000,
  BLOCK_MS: Number(process.env.LOGIN_BLOCK_MS) || 15 * 60 * 1000,

  // Backup
  BACKUP_PASSPHRASE: process.env.BACKUP_PASSPHRASE,
  BACKUP_INTERVAL_MS: Number(process.env.BACKUP_INTERVAL_MS) || 6 * 60 * 60 * 1000,
  BACKUP_MAX_COUNT: Number(process.env.BACKUP_MAX_COUNT) || 10,

  // Password policy
  PASSWORD: {
    MIN_LENGTH: 8,
    REQUIRE_UPPER: true,
    REQUIRE_LOWER: true,
    REQUIRE_DIGIT: true,
    MAX_AGE_DAYS: Number(process.env.PIN_MAX_AGE_DAYS) || 90,
  },
} as const;
