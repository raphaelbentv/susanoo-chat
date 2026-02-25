import type { IncomingMessage, ServerResponse } from 'http';
import { json, parseBody } from '../utils/http.js';
import { dbRead, dbWrite } from '../modules/database.js';
import { getAnySession as getSession } from '../modules/session.js';
import { hasPermission } from '../modules/rbac.js';
import { audit } from '../modules/audit.js';
import { sendToHashirama, compactHistory } from '../modules/bridge.js';
import { getConversation, saveCompaction } from '../modules/conversations.js';
import { log } from '../utils/logger.js';
import { validate, sanitize } from '../modules/validate.js';
import type { ChatRequest } from '../types/index.js';

export async function handleHistory(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_read')) {
    return json(res, 403, { error: 'forbidden' });
  }

  const db = dbRead();
  return json(res, 200, {
    profile: session.profile,
    role: session.role,
    items: db.memory[session.profile] || [],
  });
}

export async function handleMemoryAdd(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'memory_add')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    const bodyStr = await parseBody(req);
    const data = JSON.parse(bodyStr || '{}');
    const role = data.role === 'user' ? 'user' : 'ai';
    const text = String(data.text || '').slice(0, 8000);

    const db = dbRead();
    db.memory[session.profile] = db.memory[session.profile] || [];
    db.memory[session.profile].push({
      role,
      text,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    });
    db.memory[session.profile] = db.memory[session.profile].slice(-300);
    dbWrite(db);

    return json(res, 200, { ok: true });
  } catch (e) {
    log('error', 'memory_add_failed', { error: (e as Error).message });
    return json(res, 500, { error: 'memory_add_failed' });
  }
}

export async function handleMemoryClear(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'history_clear')) {
    return json(res, 403, { error: 'forbidden' });
  }

  const db = dbRead();
  db.memory[session.profile] = [];
  dbWrite(db);

  audit('memory_cleared', { profile: session.profile });
  return json(res, 200, { ok: true });
}

export async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const session = getSession(req.headers.authorization);
  if (!session) {
    return json(res, 401, { error: 'unauthorized' });
  }

  if (!hasPermission(session.role, 'chat')) {
    return json(res, 403, { error: 'forbidden' });
  }

  try {
    // Allow up to 15 MB for file uploads
    const bodyStr = await parseBody(req, 15e6);
    const data = JSON.parse(bodyStr || '{}') as ChatRequest;

    const { valid, errors } = validate(data as unknown as Record<string, unknown>, {
      message: { type: 'string', required: true, minLength: 1, maxLength: 50000 },
    });
    if (!valid) {
      return json(res, 400, { error: 'validation_failed', details: errors });
    }

    const message = sanitize(data.message, 50000);

    // Load conversation history with incremental compaction for long conversations
    let history: { role: string; content: string }[] = [];
    if (data.conversationId) {
      try {
        const conv = getConversation(data.conversationId, session.profile);
        if (conv) {
          const msgs = conv.messages;
          const COMPACT_THRESHOLD = 20;
          const RECENT_KEEP = 12;
          const INCREMENTAL_BATCH = 10; // Compact in batches of ~10 new messages

          if (msgs.length > COMPACT_THRESHOLD) {
            const summaryIndex = conv.summaryUpToIndex || 0;
            const existingSummary = conv.summary || '';
            const newMessagesSinceSummary = msgs.slice(summaryIndex);
            const newMessagesExcludingRecent = newMessagesSinceSummary.length - RECENT_KEEP;

            if (newMessagesExcludingRecent >= INCREMENTAL_BATCH) {
              // Incremental compaction: only summarize NEW messages since last summary
              const toCompact = newMessagesSinceSummary.slice(0, -RECENT_KEEP).map(m => ({
                role: m.role === 'ai' ? 'assistant' : m.role,
                content: m.content,
              }));

              const newSummary = compactHistory(toCompact, existingSummary);
              if (newSummary) {
                const newIndex = msgs.length - RECENT_KEEP;
                saveCompaction(data.conversationId, session.profile, newSummary, newIndex);
                log('info', 'conversation_compacted', {
                  conversationId: data.conversationId,
                  totalMessages: msgs.length,
                  compactedUpTo: newIndex,
                  summaryLength: newSummary.length,
                });

                history = [
                  { role: 'system', content: `[Contexte de la conversation]\n${newSummary}` },
                  ...msgs.slice(-RECENT_KEEP).map(m => ({
                    role: m.role === 'ai' ? 'assistant' : m.role,
                    content: m.content,
                  })),
                ];
              } else {
                // Compaction failed — use last valid summary if available
                if (existingSummary) {
                  log('warn', 'compaction_failed_using_existing', {
                    conversationId: data.conversationId,
                    fallbackSummaryLength: existingSummary.length,
                  });
                  history = [
                    { role: 'system', content: `[Contexte de la conversation]\n${existingSummary}` },
                    ...msgs.slice(-RECENT_KEEP).map(m => ({
                      role: m.role === 'ai' ? 'assistant' : m.role,
                      content: m.content,
                    })),
                  ];
                } else {
                  // No summary at all — send recent messages only
                  history = msgs.slice(-RECENT_KEEP).map(m => ({
                    role: m.role === 'ai' ? 'assistant' : m.role,
                    content: m.content,
                  }));
                }
              }
            } else if (existingSummary) {
              // Summary is still fresh — reuse it with all messages since
              history = [
                { role: 'system', content: `[Contexte de la conversation]\n${existingSummary}` },
                ...newMessagesSinceSummary.map(m => ({
                  role: m.role === 'ai' ? 'assistant' : m.role,
                  content: m.content,
                })),
              ];
            } else {
              // Over threshold but no summary yet — first compaction
              const toCompact = msgs.slice(0, -RECENT_KEEP).map(m => ({
                role: m.role === 'ai' ? 'assistant' : m.role,
                content: m.content,
              }));
              const newSummary = compactHistory(toCompact);
              if (newSummary) {
                const newIndex = msgs.length - RECENT_KEEP;
                saveCompaction(data.conversationId, session.profile, newSummary, newIndex);
                history = [
                  { role: 'system', content: `[Contexte de la conversation]\n${newSummary}` },
                  ...msgs.slice(-RECENT_KEEP).map(m => ({
                    role: m.role === 'ai' ? 'assistant' : m.role,
                    content: m.content,
                  })),
                ];
              } else {
                // First compaction failed — send recent messages
                history = msgs.slice(-RECENT_KEEP).map(m => ({
                  role: m.role === 'ai' ? 'assistant' : m.role,
                  content: m.content,
                }));
              }
            }
          } else {
            // Short conversation — send all messages
            history = msgs.map(m => ({
              role: m.role === 'ai' ? 'assistant' : m.role,
              content: m.content,
            }));
          }
        }
      } catch (e) {
        log('warn', 'history_load_failed', { conversationId: data.conversationId, error: (e as Error).message });
      }
    }

    // Validate files if present
    const files = Array.isArray(data.files) ? data.files.slice(0, 5).map(f => ({
      name: String(f.name || 'file').slice(0, 200),
      type: String(f.type || 'application/octet-stream'),
      data: String(f.data || ''),
    })) : [];

    const options = {
      model: data.model || 'claude-sonnet-4',
      temperature: Math.min(Math.max(data.temperature || 0.8, 0), 2),
      maxTokens: Math.min(Math.max(data.maxTokens || 8192, 1), 32768),
      deepSearch: data.deepSearch || false,
      contexts: Array.isArray(data.contexts) ? data.contexts.slice(0, 10).map(c => sanitize(c, 100)) : [],
      connectors: Array.isArray(data.connectors) ? data.connectors.slice(0, 10).map(c => sanitize(c, 100)) : [],
      files,
      history,
    };

    const reply = sendToHashirama(message, session.profile, options);
    return json(res, 200, {
      reply,
      model: options.model,
      tokensUsed: Math.round(reply.length * 0.3),
    });
  } catch (e) {
    log('error', 'chat_failed', { profile: session.profile, error: (e as Error).message });
    return json(res, 500, { error: 'chat_failed' });
  }
}
