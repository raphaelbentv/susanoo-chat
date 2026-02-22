import { execSync } from 'child_process';
import { log } from '../utils/logger.js';

export function sendToHashirama(message: string, profile: string): string {
  try {
    const cmd = `docker exec hashirama hashirama chat --profile "${profile.replace(/"/g, '\\"')}" "${message.replace(/"/g, '\\"')}"`;
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 60000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return output.trim();
  } catch (e) {
    const error = e as Error & { stdout?: string; stderr?: string };
    log('error', 'bridge_error', {
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
    });
    throw new Error('bridge_failed');
  }
}
