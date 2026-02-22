import { dbRead } from './database.js';
import type { SearchRequest, SearchResult } from '../types/search.types.js';

/**
 * Search in conversations full-text
 */
export function searchConversations(profile: string, searchReq: SearchRequest): SearchResult[] {
  const db = dbRead();
  const conversationIds = db.conversations[profile] || [];
  const results: SearchResult[] = [];

  const query = searchReq.query.toLowerCase().trim();
  if (!query) return results;

  const limit = searchReq.limit || 50;
  const filters = searchReq.filters || {};

  for (const convId of conversationIds) {
    const conversation = db.conversationsData[convId];
    if (!conversation) continue;

    // Apply filters
    if (filters.archived !== undefined && conversation.archived !== filters.archived) {
      continue;
    }

    if (filters.dateFrom && conversation.createdAt < filters.dateFrom) {
      continue;
    }

    if (filters.dateTo && conversation.createdAt > filters.dateTo) {
      continue;
    }

    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some(tag => conversation.tags.includes(tag));
      if (!hasTag) continue;
    }

    // Search in title
    if (conversation.title.toLowerCase().includes(query)) {
      results.push({
        conversationId: convId,
        conversationTitle: conversation.title,
        messageId: '',
        role: 'user',
        snippet: conversation.title,
        timestamp: conversation.createdAt,
        tags: conversation.tags,
        highlights: [query],
      });
    }

    // Search in messages
    for (const msg of conversation.messages) {
      if (msg.content.toLowerCase().includes(query)) {
        const snippet = extractSnippet(msg.content, query, 150);
        results.push({
          conversationId: convId,
          conversationTitle: conversation.title,
          messageId: msg.id,
          role: msg.role,
          snippet,
          timestamp: msg.timestamp,
          tags: conversation.tags,
          highlights: [query],
        });

        // Respect limit
        if (results.length >= limit) {
          return results.slice(0, limit);
        }
      }
    }
  }

  // Sort by timestamp desc (most recent first)
  results.sort((a, b) => b.timestamp - a.timestamp);

  return results.slice(0, limit);
}

/**
 * Extract snippet around query match
 */
function extractSnippet(text: string, query: string, maxLength: number): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text.substring(0, maxLength);

  const start = Math.max(0, index - Math.floor(maxLength / 2));
  const end = Math.min(text.length, start + maxLength);

  let snippet = text.substring(start, end);

  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}
