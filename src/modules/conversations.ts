import { randomBytes } from 'crypto';
import { dbRead, dbWrite } from './database.js';
import type {
  Conversation,
  Message,
  ConversationListItem,
  ConversationMetadata,
  MessageMetadata,
} from '../types/conversation.types.js';

// Generate UUID v4
function generateId(): string {
  return randomBytes(16).toString('hex');
}

// Generate conversation title from first user message
function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.trim();
  if (cleaned.length <= 50) return cleaned;
  return cleaned.substring(0, 47) + '...';
}

// Calculate conversation metadata
function calculateMetadata(messages: Message[]): ConversationMetadata {
  let totalTokens = 0;
  let lastModel = 'claude-sonnet-4';
  const contextsSet = new Set<string>();

  for (const msg of messages) {
    if (msg.metadata.tokensUsed) totalTokens += msg.metadata.tokensUsed;
    if (msg.metadata.model) lastModel = msg.metadata.model;
    if (msg.metadata.contexts) {
      msg.metadata.contexts.forEach(c => contextsSet.add(c));
    }
  }

  return {
    totalMessages: messages.length,
    totalTokens,
    totalCost: totalTokens * 0.000004, // Approximate
    lastModel,
    contexts: Array.from(contextsSet),
  };
}

// List all conversations for a profile
export function listConversations(profile: string, includeArchived = false): ConversationListItem[] {
  const db = dbRead();
  const conversationIds = db.conversations[profile] || [];
  const items: ConversationListItem[] = [];

  for (const id of conversationIds) {
    const conv = db.conversationsData[id];
    if (!conv) continue;
    if (!includeArchived && conv.archived) continue;

    const lastMessage = conv.messages[conv.messages.length - 1];
    const preview = lastMessage
      ? lastMessage.content.substring(0, 60) + (lastMessage.content.length > 60 ? '...' : '')
      : 'Pas de messages';

    items.push({
      id: conv.id,
      title: conv.title,
      preview,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messages.length,
      pinned: conv.pinned,
      archived: conv.archived,
      tags: conv.tags,
    });
  }

  // Sort: pinned first, then by updatedAt desc
  items.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });

  return items;
}

// Get conversation by ID
export function getConversation(conversationId: string, profile: string): Conversation | null {
  const db = dbRead();
  const conv = db.conversationsData[conversationId];

  if (!conv || conv.profile !== profile) return null;
  return conv;
}

// Create new conversation
export function createConversation(
  profile: string,
  title?: string,
  tags: string[] = []
): Conversation {
  const db = dbRead();
  const id = generateId();
  const now = Date.now();

  const conversation: Conversation = {
    id,
    profile,
    title: title || 'Nouvelle conversation',
    createdAt: now,
    updatedAt: now,
    messages: [],
    metadata: {
      totalMessages: 0,
      totalTokens: 0,
      totalCost: 0,
      lastModel: 'claude-sonnet-4',
      contexts: [],
    },
    pinned: false,
    archived: false,
    tags,
  };

  // Add to database
  if (!db.conversations[profile]) {
    db.conversations[profile] = [];
  }
  db.conversations[profile].unshift(id); // Add at beginning
  db.conversationsData[id] = conversation;

  dbWrite(db);
  return conversation;
}

// Update conversation
export function updateConversation(
  conversationId: string,
  profile: string,
  updates: {
    title?: string;
    pinned?: boolean;
    archived?: boolean;
    tags?: string[];
  }
): Conversation | null {
  const db = dbRead();
  const conv = db.conversationsData[conversationId];

  if (!conv || conv.profile !== profile) return null;

  if (updates.title !== undefined) conv.title = updates.title;
  if (updates.pinned !== undefined) conv.pinned = updates.pinned;
  if (updates.archived !== undefined) conv.archived = updates.archived;
  if (updates.tags !== undefined) conv.tags = updates.tags;

  conv.updatedAt = Date.now();

  dbWrite(db);
  return conv;
}

// Delete conversation
export function deleteConversation(conversationId: string, profile: string): boolean {
  const db = dbRead();
  const conv = db.conversationsData[conversationId];

  if (!conv || conv.profile !== profile) return false;

  // Remove from profile's conversation list
  db.conversations[profile] = (db.conversations[profile] || []).filter(id => id !== conversationId);

  // Remove conversation data
  delete db.conversationsData[conversationId];

  dbWrite(db);
  return true;
}

// Add message to conversation
export function addMessage(
  conversationId: string,
  profile: string,
  role: 'user' | 'ai' | 'system',
  content: string,
  metadata: MessageMetadata = {}
): Message | null {
  const db = dbRead();
  const conv = db.conversationsData[conversationId];

  if (!conv || conv.profile !== profile) return null;

  const message: Message = {
    id: generateId(),
    role,
    content,
    timestamp: Date.now(),
    metadata,
  };

  conv.messages.push(message);
  conv.updatedAt = message.timestamp;

  // Auto-generate title from first user message
  if (conv.messages.length === 1 && role === 'user' && conv.title === 'Nouvelle conversation') {
    conv.title = generateTitle(content);
  }

  // Recalculate metadata
  conv.metadata = calculateMetadata(conv.messages);

  dbWrite(db);
  return message;
}

// Get messages from conversation
export function getMessages(conversationId: string, profile: string): Message[] {
  const conv = getConversation(conversationId, profile);
  return conv ? conv.messages : [];
}
