import type { IncomingMessage } from 'http';
import { CONFIG } from '../config.js';

interface LimiterState {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const LOGIN_ATTEMPTS = new Map<string, LimiterState>();

export function getClientIp(req: IncomingMessage): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

export function loginKey(kind: string, req: IncomingMessage, id?: string): string {
  return `${kind}:${getClientIp(req)}:${String(id || '').toLowerCase()}`;
}

function getLimiterState(key: string, now = Date.now()): LimiterState {
  const state = LOGIN_ATTEMPTS.get(key) || {
    count: 0,
    firstAt: now,
    blockedUntil: 0,
  };

  if (state.blockedUntil && now >= state.blockedUntil) {
    state.count = 0;
    state.firstAt = now;
    state.blockedUntil = 0;
  }

  if (now - state.firstAt > CONFIG.WINDOW_MS) {
    state.count = 0;
    state.firstAt = now;
  }

  LOGIN_ATTEMPTS.set(key, state);
  return state;
}

export function limiterCheck(key: string, now = Date.now()): { blocked: boolean; retryAfterMs: number } {
  const state = getLimiterState(key, now);
  if (state.blockedUntil && now < state.blockedUntil) {
    return { blocked: true, retryAfterMs: state.blockedUntil - now };
  }
  return { blocked: false, retryAfterMs: 0 };
}

export function limiterFail(key: string, now = Date.now()): LimiterState {
  const state = getLimiterState(key, now);
  state.count += 1;
  if (state.count >= CONFIG.MAX_ATTEMPTS) {
    state.blockedUntil = now + CONFIG.BLOCK_MS;
  }
  LOGIN_ATTEMPTS.set(key, state);
  return state;
}

export function limiterReset(key: string): void {
  LOGIN_ATTEMPTS.delete(key);
}
