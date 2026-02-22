import { execSync } from 'child_process';
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

function executeDockerCommand(cmd: string, timeout = 30000): string {
  const fullCmd = useSSH ? `ssh ${sshAlias} "${cmd.replace(/"/g, '\\"')}"` : cmd;
  return execSync(fullCmd, {
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
    const containerStatus = executeDockerCommand(
      'docker ps --filter name=dev-workspace --format "{{.Status}}"',
      5000
    );

    if (!containerStatus) {
      throw new Error('Container not running');
    }

    // Get Claude Code version
    const version = executeDockerCommand(
      'docker exec dev-workspace zsh -c "claude --version 2>&1"',
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

    // Escape single quotes for shell
    const escapedMessage = enrichedMessage.replace(/'/g, "'\\''");

    const cmd = `docker exec dev-workspace zsh -c 'claude -p "${escapedMessage}"'`;
    const output = executeDockerCommand(cmd, 120000);
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
