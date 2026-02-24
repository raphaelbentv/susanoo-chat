import crypto from 'crypto';

export function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 120000, 32, 'sha256').toString('hex');
}

export function genSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function genToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export function generatePassword(length = 12): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const all = lower + upper + digits;

  const mandatory = [
    lower[crypto.randomInt(lower.length)],
    upper[crypto.randomInt(upper.length)],
    digits[crypto.randomInt(digits.length)],
  ];

  const remaining: string[] = [];
  for (let i = 0; i < length - mandatory.length; i++) {
    remaining.push(all[crypto.randomInt(all.length)]);
  }

  const combined = [...mandatory, ...remaining];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}

export function deriveBackupKey(passphrase: string): Buffer {
  return crypto.pbkdf2Sync(passphrase, 'susanoo-backup-salt', 100000, 32, 'sha256');
}

export function encryptBackup(data: string, passphrase: string): { iv: string; data: string } {
  const key = deriveBackupKey(passphrase);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return { iv: iv.toString('hex'), data: encrypted };
}

export function decryptBackup(encryptedData: string, iv: string, passphrase: string): string {
  const key = deriveBackupKey(passphrase);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
