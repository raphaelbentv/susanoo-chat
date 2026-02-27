export interface Conversation {
  id: string;                    // UUID
  profile: string;               // Propriétaire
  title: string;                 // Auto-généré ou custom
  createdAt: number;             // Timestamp
  updatedAt: number;             // Timestamp
  messages: Message[];           // Messages complets
  metadata: ConversationMetadata;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  summary?: string;              // Résumé compacté des anciens messages
  summaryUpToIndex?: number;     // Index jusqu'où le résumé couvre
}

export interface Message {
  id: string;                    // UUID
  role: 'user' | 'ai' | 'system';
  content: string;
  timestamp: number;
  metadata: MessageMetadata;
}

export interface MessageMetadata {
  model?: string;
  tokensUsed?: number;
  temperature?: number;
  maxTokens?: number;
  deepSearch?: boolean;
  contexts?: string[];
  connectors?: string[];
  files?: string[];
}

export interface ConversationMetadata {
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  lastModel: string;
  contexts: string[];
}

export interface ConversationListItem {
  id: string;
  title: string;
  preview: string;              // Dernier message tronqué
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  pinned: boolean;
  archived: boolean;
  tags: string[];
}

export interface CreateConversationRequest {
  title?: string;
  tags?: string[];
}

export interface UpdateConversationRequest {
  title?: string;
  pinned?: boolean;
  archived?: boolean;
  tags?: string[];
}

export interface AddMessageRequest {
  role: 'user' | 'ai' | 'system';
  content: string;
  metadata?: MessageMetadata;
}
