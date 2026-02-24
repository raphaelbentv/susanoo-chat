import type { IncomingMessage, ServerResponse } from 'http';
import { json, parseBody } from '../utils/http.js';
import { getAnySession as getSession } from '../modules/session.js';
import { hasPermission } from '../modules/rbac.js';
import { log } from '../utils/logger.js';
import {
  listConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  addMessage,
  getMessages,
} from '../modules/conversations.js';
import { exportAsMarkdown, exportAsJSON, getExportFilename } from '../modules/export.js';
import type {
  CreateConversationRequest,
  UpdateConversationRequest,
  AddMessageRequest,
} from '../types/conversation.types.js';

// GET /api/conversations - List all conversations
export async function handleListConversations(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_read')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const includeArchived = url.searchParams.get('archived') === 'true';

    const conversations = listConversations(session.profile, includeArchived);
    return json(res, 200, { items: conversations });
  } catch (e) {
    log('error', 'list_conversations_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}

// POST /api/conversations - Create new conversation
export async function handleCreateConversation(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'chat')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as CreateConversationRequest;

    const conversation = createConversation(
      session.profile,
      data.title,
      data.tags || []
    );

    return json(res, 201, { conversation });
  } catch (e) {
    log('error', 'create_conversation_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}

// GET /api/conversations/:id - Get conversation details
export async function handleGetConversation(req: IncomingMessage, res: ServerResponse, conversationId: string): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_read')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const conversation = getConversation(conversationId, session.profile);

    if (!conversation) {
      return json(res, 404, { error: 'conversation_not_found' });
    }

    return json(res, 200, { conversation });
  } catch (e) {
    log('error', 'get_conversation_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}

// PUT /api/conversations/:id - Update conversation
export async function handleUpdateConversation(req: IncomingMessage, res: ServerResponse, conversationId: string): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'chat')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as UpdateConversationRequest;

    const conversation = updateConversation(conversationId, session.profile, data);

    if (!conversation) {
      return json(res, 404, { error: 'conversation_not_found' });
    }

    return json(res, 200, { conversation });
  } catch (e) {
    log('error', 'update_conversation_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}

// DELETE /api/conversations/:id - Delete conversation
export async function handleDeleteConversation(req: IncomingMessage, res: ServerResponse, conversationId: string): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_clear')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const success = deleteConversation(conversationId, session.profile);

    if (!success) {
      return json(res, 404, { error: 'conversation_not_found' });
    }

    return json(res, 200, { ok: true });
  } catch (e) {
    log('error', 'delete_conversation_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}

// POST /api/conversations/:id/messages - Add message
export async function handleAddMessage(req: IncomingMessage, res: ServerResponse, conversationId: string): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'memory_add')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}') as AddMessageRequest;

    const message = addMessage(
      conversationId,
      session.profile,
      data.role,
      data.content,
      data.metadata || {}
    );

    if (!message) {
      return json(res, 404, { error: 'conversation_not_found' });
    }

    return json(res, 201, { message });
  } catch (e) {
    log('error', 'add_message_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}

// GET /api/conversations/:id/messages - Get messages
export async function handleGetMessages(req: IncomingMessage, res: ServerResponse, conversationId: string): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_read')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const messages = getMessages(conversationId, session.profile);
    return json(res, 200, { messages });
  } catch (e) {
    log('error', 'get_messages_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}

// GET /api/conversations/:id/export?format=md|json - Export conversation
export async function handleExportConversation(req: IncomingMessage, res: ServerResponse, conversationId: string): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_read')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const format = url.searchParams.get('format') as 'md' | 'json' | null;

    if (!format || !['md', 'json'].includes(format)) {
      return json(res, 400, { error: 'invalid_format' });
    }

    const conversation = getConversation(conversationId, session.profile);

    if (!conversation) {
      return json(res, 404, { error: 'conversation_not_found' });
    }

    let content: string;
    let mimeType: string;

    if (format === 'md') {
      content = exportAsMarkdown(conversation, session.profile);
      mimeType = 'text/markdown';
    } else {
      content = exportAsJSON(conversation, session.profile);
      mimeType = 'application/json';
    }

    const filename = getExportFilename(conversation, format);

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(content);

    log('info', 'conversation_exported', { profile: session.profile, conversationId, format });
  } catch (e) {
    log('error', 'export_conversation_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'failed' });
  }
}
