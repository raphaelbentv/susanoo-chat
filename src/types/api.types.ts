import type { Role } from './profile.types.js';

export interface LoginRequest {
  profile: string;
  pin: string;
}

export interface LoginResponse {
  token: string;
  profile: string;
  role: Role;
  expiresAt: number;
  created?: boolean;
  pinExpired?: boolean;
}

export interface AdminLoginRequest {
  user: string;
  pass: string;
}

export interface AdminLoginResponse {
  adminToken: string;
  user: string;
  expiresAt: number;
}

export interface ChatFile {
  name: string;
  type: string;
  data: string; // base64
}

export interface ChatRequest {
  message: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  deepSearch?: boolean;
  contexts?: string[];
  connectors?: string[];
  files?: ChatFile[];
}

export interface ChatResponse {
  reply: string;
  model?: string;
  tokensUsed?: number;
}

export interface ChangePinRequest {
  oldPin: string;
  newPin: string;
}

export interface ChangeRoleRequest {
  profile: string;
  role: Role;
}

export interface ResetPinRequest {
  profile: string;
  newPin: string;
}

export interface DisableProfileRequest {
  profile: string;
  disabled: boolean;
}

export interface DeleteProfileRequest {
  profile: string;
}

export interface ApiError {
  error: string;
  details?: string[];
  retryAfterMs?: number;
  attempts?: number;
}

export interface HealthResponse {
  status: string;
  version: string;
  service: string;
  uptimeSec: number;
  now: string;
  profileCount: number;
  activeSessionCount: number;
  dbSizeBytes: number;
  memoryMB: {
    rss: number;
    heap: number;
  };
}

export interface PasswordPolicyResponse {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  maxAgeDays: number;
}

export interface SessionInfoResponse {
  profile: string;
  role: Role;
  createdAt: number;
  expiresAt: number;
  ttlMs: number;
}

export interface RefreshResponse {
  token: string;
  expiresAt: number;
  profile: string;
  role: Role;
}
