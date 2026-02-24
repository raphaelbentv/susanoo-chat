import { execFileSync, spawnSync } from 'child_process';
import { log } from '../utils/logger.js';
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
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

interface ChatFile {
  name: string;
  type: string;
  data: string; // base64
}

interface ChatOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  deepSearch: boolean;
  contexts: string[];
  connectors: string[];
  files?: ChatFile[];
  history?: { role: string; content: string }[];
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

export function compactHistory(messages: { role: string; content: string }[], existingSummary?: string): string {
  let historyText = '';

  if (existingSummary) {
    historyText += `[Résumé précédent]\n${existingSummary}\n\n[Messages récents à intégrer au résumé]\n`;
  }

  for (const m of messages) {
    const label = m.role === 'assistant' ? 'Assistant' : 'Utilisateur';
    const content = m.content.length > 3000 ? m.content.slice(0, 3000) + '...' : m.content;
    historyText += `${label}: ${content}\n\n`;
  }

  const prompt = `Tu es un assistant de résumé de conversation. Résume la conversation suivante en conservant TOUS les détails importants :
- Décisions prises et choix techniques
- Informations factuelles mentionnées (noms, dates, chiffres)
- Préférences et demandes de l'utilisateur
- Contexte du projet et problèmes résolus
- Instructions spécifiques données

Conversation :
${historyText}

Produis un résumé structuré et dense (max 2000 caractères). Utilise des puces pour organiser l'information. Ne perds aucun détail technique important.`;

  try {
    return executeCommand(
      ['docker', 'exec', 'dev-workspace', 'claude', '-p', prompt],
      60000
    );
  } catch (e) {
    log('error', 'compaction_failed', { error: (e as Error).message });
    return '';
  }
}

export function sendToHashirama(message: string, _profile: string, options: ChatOptions): string {
  const tempFiles: string[] = [];

  try {
    // Build the full prompt with conversation history
    let enrichedMessage = '';

    // Ajouter les métadonnées de contexte en en-tête
    if (options.deepSearch) {
      enrichedMessage += '[Mode : Recherche approfondie activée]\n';
    }
    if (options.connectors && options.connectors.length > 0) {
      enrichedMessage += `[Connecteurs disponibles : ${options.connectors.join(', ')}]\n`;
    }
    if (options.contexts && options.contexts.length > 0) {
      enrichedMessage += `[Contextes actifs : ${options.contexts.join(', ')}]\n`;
    }

    // Ajouter l'historique de conversation
    if (options.history && options.history.length > 0) {
      enrichedMessage += '\n--- Historique de la conversation ---\n';
      for (const msg of options.history) {
        const label = msg.role === 'assistant' ? 'Assistant' : 'Utilisateur';
        // Tronquer les messages très longs dans l'historique
        const content = msg.content.length > 2000 ? msg.content.slice(0, 2000) + '...' : msg.content;
        enrichedMessage += `${label}: ${content}\n\n`;
      }
      enrichedMessage += '--- Fin de l\'historique ---\n\n';
    }

    // Ajouter le message actuel
    enrichedMessage += message;

    // Handle file attachments
    if (options.files && options.files.length > 0) {
      const tmpDir = join(process.cwd(), '.tmp', 'uploads');
      mkdirSync(tmpDir, { recursive: true });

      for (const file of options.files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
        const tmpPath = join(tmpDir, `${Date.now()}_${safeName}`);
        const buffer = Buffer.from(file.data, 'base64');
        writeFileSync(tmpPath, buffer);
        tempFiles.push(tmpPath);

        // For text-based files, inline content in the message
        if (file.type.startsWith('text/') || safeName.match(/\.(txt|csv|md|json|xml|html|css|js|ts)$/i)) {
          const textContent = buffer.toString('utf8').slice(0, 30000);
          enrichedMessage += `\n\n--- Fichier joint : ${file.name} ---\n${textContent}\n--- Fin du fichier ---`;
        } else {
          // For binary files (images, PDFs), note them in the message
          enrichedMessage += `\n\n[Fichier joint : ${file.name} (${file.type}, ${Math.round(buffer.length / 1024)} Ko)]`;
        }
      }
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
      options: { ...options, files: options.files?.map(f => ({ name: f.name, type: f.type })) },
    });
    throw new Error('bridge_failed');
  } finally {
    // Clean up temp files
    for (const f of tempFiles) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
  }
}
