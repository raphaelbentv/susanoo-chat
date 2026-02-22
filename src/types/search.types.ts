export interface SearchRequest {
  query: string;
  filters?: {
    dateFrom?: number;
    dateTo?: number;
    tags?: string[];
    archived?: boolean;
  };
  limit?: number;
}

export interface SearchResult {
  conversationId: string;
  conversationTitle: string;
  messageId: string;
  role: 'user' | 'ai' | 'system';
  snippet: string;
  timestamp: number;
  tags: string[];
  highlights: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}
