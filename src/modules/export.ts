import type { Conversation } from '../types/conversation.types.js';

/**
 * Export conversation as Markdown
 */
export function exportAsMarkdown(conversation: Conversation, profileName: string): string {
  const createdDate = new Date(conversation.createdAt).toLocaleString('fr-FR');
  const lines: string[] = [];

  lines.push(`# ${conversation.title}`);
  lines.push('');
  lines.push(`**Créée le** : ${createdDate}`);
  lines.push(`**Messages** : ${conversation.messages.length}`);
  lines.push(`**Profil** : ${profileName}`);

  if (conversation.tags.length > 0) {
    lines.push(`**Tags** : ${conversation.tags.join(', ')}`);
  }

  if (conversation.metadata.totalTokens > 0) {
    lines.push(`**Tokens utilisés** : ${conversation.metadata.totalTokens.toLocaleString('fr-FR')}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of conversation.messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const icon = msg.role === 'user' ? '👤' : '🤖';
    const name = msg.role === 'user' ? 'User' : 'Hashirama';

    let header = `## ${icon} ${name} (${time})`;

    if (msg.role === 'ai' && msg.metadata.model) {
      const modelShort = msg.metadata.model.replace('claude-', '').replace('-', ' ');
      header += ` · ${modelShort}`;
      if (msg.metadata.tokensUsed) {
        header += ` · ${msg.metadata.tokensUsed} tokens`;
      }
    }

    lines.push(header);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Exporté le ${new Date().toLocaleString('fr-FR')} depuis Hashirama Chat*`);

  return lines.join('\n');
}

/**
 * Export conversation as JSON
 */
export function exportAsJSON(conversation: Conversation, profileName: string): string {
  const data = {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      profile: profileName,
      tags: conversation.tags,
      pinned: conversation.pinned,
      archived: conversation.archived,
      messages: conversation.messages,
      metadata: conversation.metadata,
    },
    exportedAt: Date.now(),
    exportedBy: profileName,
    version: '1.0',
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Get filename for export
 */
export function getExportFilename(conversation: Conversation, format: 'md' | 'json'): string {
  const title = conversation.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);

  const date = new Date().toISOString().split('T')[0];
  const ext = format === 'md' ? 'md' : 'json';

  return `hashirama-${title}-${date}.${ext}`;
}
