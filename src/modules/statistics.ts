import { dbRead } from './database.js';
import type { Statistics, DailyMetric, ModelUsage, ContextUsage } from '../types/statistics.types.js';

/**
 * Calculate statistics for a user profile
 */
export function calculateStatistics(profile: string, period: '7d' | '30d' | '90d' | 'all' = 'all'): Statistics {
  const db = dbRead();
  const conversationIds = db.conversations[profile] || [];

  const now = Date.now();
  let periodStart = 0;

  if (period === '7d') periodStart = now - 7 * 86400000;
  else if (period === '30d') periodStart = now - 30 * 86400000;
  else if (period === '90d') periodStart = now - 90 * 86400000;

  // Collect all messages within period
  let totalMessages = 0;
  let totalTokens = 0;
  let totalCost = 0;
  const modelMap = new Map<string, { messages: number; tokens: number }>();
  const contextMap = new Map<string, number>();
  const dailyMap = new Map<string, { messages: number; tokens: number; cost: number }>();
  const conversationMetrics: { id: string; title: string; messages: number }[] = [];

  for (const convId of conversationIds) {
    const conversation = db.conversationsData[convId];
    if (!conversation) continue;

    if (periodStart > 0 && conversation.createdAt < periodStart) continue;

    let convMessages = 0;

    for (const msg of conversation.messages) {
      if (periodStart > 0 && msg.timestamp < periodStart) continue;

      totalMessages++;
      convMessages++;

      const tokens = msg.metadata.tokensUsed || 0;
      totalTokens += tokens;

      // Cost estimation: ~$3/M tokens for Sonnet, ~$15/M for Opus
      const cost = msg.metadata.model?.includes('opus') ? tokens * 15 / 1000000 : tokens * 3 / 1000000;
      totalCost += cost;

      // Track model usage
      const model = msg.metadata.model || 'unknown';
      const existing = modelMap.get(model) || { messages: 0, tokens: 0 };
      modelMap.set(model, {
        messages: existing.messages + 1,
        tokens: existing.tokens + tokens,
      });

      // Track context usage
      if (msg.metadata.contexts) {
        for (const ctx of msg.metadata.contexts) {
          contextMap.set(ctx, (contextMap.get(ctx) || 0) + 1);
        }
      }

      // Daily metrics
      const date = new Date(msg.timestamp).toISOString().split('T')[0];
      const dailyData = dailyMap.get(date) || { messages: 0, tokens: 0, cost: 0 };
      dailyMap.set(date, {
        messages: dailyData.messages + 1,
        tokens: dailyData.tokens + tokens,
        cost: dailyData.cost + cost,
      });
    }

    conversationMetrics.push({
      id: convId,
      title: conversation.title,
      messages: convMessages,
    });
  }

  // Convert maps to arrays
  const modelUsage: ModelUsage[] = [];
  for (const [model, data] of modelMap.entries()) {
    modelUsage.push({
      model: model.replace('claude-', '').replace('-', ' '),
      messages: data.messages,
      tokens: data.tokens,
      percentage: totalMessages > 0 ? (data.messages / totalMessages) * 100 : 0,
    });
  }
  modelUsage.sort((a, b) => b.messages - a.messages);

  const contextUsage: ContextUsage[] = [];
  for (const [context, count] of contextMap.entries()) {
    contextUsage.push({ context, count });
  }
  contextUsage.sort((a, b) => b.count - a.count);

  const dailyMetrics: DailyMetric[] = [];
  for (const [date, data] of dailyMap.entries()) {
    dailyMetrics.push({ date, ...data });
  }
  dailyMetrics.sort((a, b) => a.date.localeCompare(b.date));

  const topConversations = conversationMetrics
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 5);

  const daysInPeriod = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : Math.max(dailyMetrics.length, 1);

  return {
    period,
    totalMessages,
    totalTokens,
    totalCost,
    totalConversations: conversationIds.length,
    averageMessagesPerDay: totalMessages / daysInPeriod,
    averageTokensPerMessage: totalMessages > 0 ? totalTokens / totalMessages : 0,
    dailyMetrics,
    modelUsage,
    contextUsage,
    topConversations,
  };
}
