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

export function getHashiramaStatus(): any {
  try {
    const cmd = `docker exec hashirama hashirama status`;
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    });

    // Parse the status output to extract token usage info
    const lines = output.trim().split('\n');
    const status: any = {
      tokensUsed: 0,
      tokensLimit: 0,
      percentageUsed: 0,
      plan: 'unknown',
    };

    for (const line of lines) {
      // Look for token usage info in the output
      if (line.includes('Tokens') || line.includes('tokens')) {
        const match = line.match(/(\d+(?:,\d+)*)\s*\/\s*(\d+(?:,\d+)*)/);
        if (match) {
          status.tokensUsed = parseInt(match[1].replace(/,/g, ''));
          status.tokensLimit = parseInt(match[2].replace(/,/g, ''));
          status.percentageUsed = (status.tokensUsed / status.tokensLimit) * 100;
        }
      }
      if (line.toLowerCase().includes('plan') || line.toLowerCase().includes('abonnement')) {
        status.plan = line.split(':')[1]?.trim() || 'unknown';
      }
    }

    return status;
  } catch (e) {
    log('error', 'status_error', { error: (e as Error).message });
    return {
      tokensUsed: 0,
      tokensLimit: 0,
      percentageUsed: 0,
      plan: 'error',
      error: true,
    };
  }
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
