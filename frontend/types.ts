import type { Role } from '../src/types/index.js';

export interface Message {
  id: number;
  role: 'user' | 'ai';
  text: string;
  time: string;
  meta?: string;
}

export interface Conversation {
  id: number;
  title: string;
  preview: string;
  time: string;
  badge?: number;
  group: string;
}

export interface SessionState {
  token: string;
  profile: string;
  role: Role;
  expiresAt: number;
}

export interface PasswordPolicy {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  maxAgeDays: number;
}
