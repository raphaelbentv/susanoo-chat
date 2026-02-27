import { execFileSync, spawnSync, spawn } from 'child_process';
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
  // Limit input size to avoid timeouts — truncate individual messages more aggressively
  const MAX_INPUT_CHARS = 15000;
  let historyText = '';
  let charBudget = MAX_INPUT_CHARS;

  if (existingSummary) {
    // Existing summary gets priority — truncate if extremely long
    const summaryTruncated = existingSummary.length > 4000
      ? existingSummary.slice(0, 4000) + '...'
      : existingSummary;
    historyText += `[Résumé précédent de la conversation]\n${summaryTruncated}\n\n[Nouveaux messages à intégrer]\n`;
    charBudget -= historyText.length;
  }

  // Allocate remaining budget across messages, favoring recent ones
  const perMessageBudget = Math.max(500, Math.floor(charBudget / Math.max(messages.length, 1)));

  for (const m of messages) {
    const label = m.role === 'assistant' ? 'Assistant' : 'Utilisateur';
    const content = m.content.length > perMessageBudget
      ? m.content.slice(0, perMessageBudget) + '...'
      : m.content;
    historyText += `${label}: ${content}\n\n`;
  }

  const isIncremental = !!existingSummary;
  const prompt = isIncremental
    ? `Tu es un assistant de résumé de conversation. Tu reçois un RÉSUMÉ EXISTANT et de NOUVEAUX MESSAGES.
Fusionne-les en un seul résumé cohérent et à jour. Conserve TOUS les détails importants :
- Décisions prises et choix techniques
- Informations factuelles (noms, dates, chiffres, URLs)
- Préférences et demandes de l'utilisateur
- Contexte du projet et problèmes résolus/en cours
- Instructions spécifiques données
- Évolution des sujets de conversation

${historyText}

Produis un résumé structuré et dense (max 3000 caractères). Utilise des puces. Mets à jour les informations obsolètes plutôt que de les dupliquer. Ne perds aucun détail technique important.`
    : `Tu es un assistant de résumé de conversation. Résume la conversation suivante en conservant TOUS les détails importants :
- Décisions prises et choix techniques
- Informations factuelles mentionnées (noms, dates, chiffres)
- Préférences et demandes de l'utilisateur
- Contexte du projet et problèmes résolus
- Instructions spécifiques données

Conversation :
${historyText}

Produis un résumé structuré et dense (max 3000 caractères). Utilise des puces pour organiser l'information. Ne perds aucun détail technique important.`;

  try {
    return executeCommand(
      ['docker', 'exec', 'dev-workspace', 'claude', '-p', prompt],
      90000 // 90s — more time for incremental merges
    );
  } catch (e) {
    log('error', 'compaction_failed', {
      error: (e as Error).message,
      messageCount: messages.length,
      hadExistingSummary: !!existingSummary,
    });
    return '';
  }
}

// ── Shared prompt builder ───────────────────────────────────

function buildEnrichedMessage(
  message: string,
  options: ChatOptions,
): { enrichedMessage: string; tempFiles: string[] } {
  const tempFiles: string[] = [];
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

  // Ajouter l'historique de conversation avec troncature adaptative
  if (options.history && options.history.length > 0) {
    enrichedMessage += '\n--- Historique de la conversation ---\n';

    // Budget total pour l'historique : ~40k caractères
    const HISTORY_BUDGET = 40000;
    const historyCount = options.history.length;

    // Les messages système (résumés) ont un budget généreux
    // Les messages récents ont plus de budget que les anciens
    for (let i = 0; i < historyCount; i++) {
      const msg = options.history[i];
      const label = msg.role === 'system' ? 'Contexte' : msg.role === 'assistant' ? 'Assistant' : 'Utilisateur';

      let maxLen: number;
      if (msg.role === 'system') {
        // System messages (summaries) get generous budget
        maxLen = 6000;
      } else {
        // Recent messages get more space, older ones less
        const recency = i / historyCount; // 0 = oldest, ~1 = newest
        maxLen = Math.round(1500 + recency * 4500); // 1500 → 6000 chars
      }

      // Ensure we don't exceed total budget
      const remainingBudget = HISTORY_BUDGET - enrichedMessage.length;
      if (remainingBudget < 200) {
        enrichedMessage += `[... ${historyCount - i} messages antérieurs omis]\n`;
        break;
      }
      maxLen = Math.min(maxLen, remainingBudget - 100);

      const content = msg.content.length > maxLen ? msg.content.slice(0, maxLen) + '...' : msg.content;
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

  return { enrichedMessage, tempFiles };
}

// ── Synchronous bridge (kept for backward compat) ───────────

export function sendToHashirama(message: string, _profile: string, options: ChatOptions): string {
  const { enrichedMessage, tempFiles } = buildEnrichedMessage(message, options);

  try {
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

// ── Async streaming bridge ──────────────────────────────────

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: string) => void;
}

export function streamFromHashirama(
  message: string,
  _profile: string,
  options: ChatOptions,
  callbacks: StreamCallbacks,
): { abort: () => void } {
  const { enrichedMessage, tempFiles } = buildEnrichedMessage(message, options);

  const cleanup = () => {
    for (const f of tempFiles) {
      try { unlinkSync(f); } catch { /* ignore */ }
    }
  };

  let finished = false;
  const finish = (fn: () => void) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    cleanup();
    fn();
  };

  // Spawn child process
  const args = ['docker', 'exec', 'dev-workspace', 'claude', '-p', enrichedMessage];
  const child = useSSH
    ? spawn('ssh', [sshAlias, args.join(' ')])
    : spawn(args[0], args.slice(1));

  let fullText = '';
  let stderrText = '';

  child.stdout.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    fullText += text;
    callbacks.onChunk(text);
  });

  child.stderr.on('data', (chunk: Buffer) => {
    stderrText += chunk.toString('utf8');
  });

  child.on('close', (code) => {
    if (code === 0) {
      finish(() => callbacks.onDone(fullText.trim()));
    } else {
      log('error', 'stream_bridge_error', {
        exitCode: code,
        stderr: stderrText.slice(0, 500),
      });
      finish(() => callbacks.onError(code === null ? 'timeout' : 'bridge_failed'));
    }
  });

  child.on('error', (err) => {
    log('error', 'stream_spawn_error', { error: err.message });
    finish(() => callbacks.onError('bridge_failed'));
  });

  // Timeout: 5 minutes
  const timer = setTimeout(() => {
    if (!finished) {
      log('warn', 'stream_timeout', { elapsed: 300000 });
      child.kill('SIGTERM');
      // Force kill after 3s if still alive
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, 3000);
    }
  }, 300000);

  return {
    abort: () => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        cleanup();
        try { child.kill('SIGTERM'); } catch { /* ignore */ }
        setTimeout(() => {
          try { child.kill('SIGKILL'); } catch { /* ignore */ }
        }, 3000);
      }
    },
  };
}
