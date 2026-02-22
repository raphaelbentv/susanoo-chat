export interface StatisticsRequest {
  period?: '7d' | '30d' | '90d' | 'all';
}

export interface DailyMetric {
  date: string;
  messages: number;
  tokens: number;
  cost: number;
}

export interface ModelUsage {
  model: string;
  messages: number;
  tokens: number;
  percentage: number;
}

export interface ContextUsage {
  context: string;
  count: number;
}

export interface Statistics {
  period: string;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  totalConversations: number;
  averageMessagesPerDay: number;
  averageTokensPerMessage: number;
  dailyMetrics: DailyMetric[];
  modelUsage: ModelUsage[];
  contextUsage: ContextUsage[];
  topConversations: {
    id: string;
    title: string;
    messages: number;
  }[];
}
