import { execFileSync, spawnSync } from 'child_process';
import { log } from '../utils/logger.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
let useSSH = false;
let sshAlias = 'vps';

try {
  const envPath = join(process.cwd(), '.env');
  const envContent = readFileSync(envPath, 'utf8');
  const envVars: Record<string, string> = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    }
  });

  // Use SSH if NODE_ENV is development or if we can't access Docker directly
  if (envVars.NODE_ENV === 'development' || envVars.USE_SSH === 'true') {
    useSSH = true;
    sshAlias = envVars.VPS_SSH_ALIAS || 'vps';
  }
} catch (e) {
  // No .env file, assume production (direct Docker access)
  useSSH = false;
}

/**
 * Execute a command safely using execFileSync (no shell interpolation).
 * Arguments are passed as an array, preventing command injection.
 */
function executeCommand(args: string[], timeout = 30000): string {
  if (useSSH) {
    // SSH mode: pass the full command as a single SSH argument
    const remoteCmd = args.join(' ');
    const result = spawnSync('ssh', [sshAlias, remoteCmd], {
      encoding: 'utf8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const err = new Error(`Command failed with exit code ${result.status}`) as Error & { stdout?: string; stderr?: string };
      err.stdout = result.stdout;
      err.stderr = result.stderr;
      throw err;
    }
    return result.stdout.trim();
  }

  // Local mode: execute directly without shell
  const [cmd, ...cmdArgs] = args;
  return execFileSync(cmd, cmdArgs, {
    encoding: 'utf8',
    timeout,
    maxBuffer: 10 * 1024 * 1024,
  }).trim();
}

interface ChatOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  deepSearch: boolean;
  contexts: string[];
  connectors: string[];
}

export function getHashiramaStatus(): any {
  try {
    // Check if dev-workspace container is running
    const containerStatus = executeCommand(
      ['docker', 'ps', '--filter', 'name=dev-workspace', '--format', '{{.Status}}'],
      5000
    );

    if (!containerStatus) {
      throw new Error('Container not running');
    }

    // Get Claude Code version
    const version = executeCommand(
      ['docker', 'exec', 'dev-workspace', 'claude', '--version'],
      5000
    );

    return {
      connected: true,
      containerStatus,
      version,
      service: 'Claude Code',
      mode: useSSH ? 'remote' : 'local',
    };
  } catch (e) {
    log('error', 'status_error', { error: (e as Error).message });
    return {
      connected: false,
      error: true,
      message: (e as Error).message,
    };
  }
}

export function sendToHashirama(message: string, _profile: string, options: ChatOptions): string {
  try {
    // Enrichir le message avec les métadonnées de contexte
    let enrichedMessage = message;

    // Ajouter les contextes actifs
    if (options.contexts && options.contexts.length > 0) {
      const contextPrefix = `[Contextes actifs : ${options.contexts.join(', ')}]\n`;
      enrichedMessage = contextPrefix + message;
    }

    // Ajouter les connecteurs disponibles
    if (options.connectors && options.connectors.length > 0) {
      const connectorPrefix = `[Connecteurs disponibles : ${options.connectors.join(', ')}]\n`;
      enrichedMessage = connectorPrefix + enrichedMessage;
    }

    // Ajouter le mode recherche approfondie
    if (options.deepSearch) {
      enrichedMessage = '[Mode : Recherche approfondie activée]\n' + enrichedMessage;
    }

    // Pass message as argument directly — no shell interpolation
    const output = executeCommand(
      ['docker', 'exec', 'dev-workspace', 'claude', '-p', enrichedMessage],
      120000
    );
    return output;
  } catch (e) {
    const error = e as Error & { stdout?: string; stderr?: string };
    log('error', 'bridge_error', {
      error: error.message,
      stdout: error.stdout,
      stderr: error.stderr,
      options,
    });
    throw new Error('bridge_failed');
  }
}
