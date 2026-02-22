import { execSync } from 'child_process';
import { log } from '../utils/logger.js';

interface ChatOptions {
  model: string;
  temperature: number;
  maxTokens: number;
  deepSearch: boolean;
  contexts: string[];
  connectors: string[];
}

export function sendToHashirama(message: string, profile: string, options: ChatOptions): string {
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

    const cmd = `docker exec hashirama hashirama chat --profile "${profile.replace(/"/g, '\\"')}" "${enrichedMessage.replace(/"/g, '\\"')}"`;
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
      options,
    });
    throw new Error('bridge_failed');
  }
}
