import type { IncomingMessage } from 'http';
import { CONFIG } from '../config.js';

interface LimiterState {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

const LOGIN_ATTEMPTS = new Map<string, LimiterState>();
const ADMIN_ACTION_ATTEMPTS = new Map<string, LimiterState>();

// Admin action rate limit: 30 requests per 5 minutes per IP
const ADMIN_MAX_ACTIONS = 30;
const ADMIN_WINDOW_MS = 5 * 60 * 1000;
const ADMIN_BLOCK_MS = 10 * 60 * 1000;

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

function getLimiterState(store: Map<string, LimiterState>, key: string, windowMs: number, now = Date.now()): LimiterState {
  const state = store.get(key) || {
    count: 0,
    firstAt: now,
    blockedUntil: 0,
  };

  if (state.blockedUntil && now >= state.blockedUntil) {
    state.count = 0;
    state.firstAt = now;
    state.blockedUntil = 0;
  }

  if (now - state.firstAt > windowMs) {
    state.count = 0;
    state.firstAt = now;
  }

  store.set(key, state);
  return state;
}

export function limiterCheck(key: string, now = Date.now()): { blocked: boolean; retryAfterMs: number } {
  const state = getLimiterState(LOGIN_ATTEMPTS, key, CONFIG.WINDOW_MS, now);
  if (state.blockedUntil && now < state.blockedUntil) {
    return { blocked: true, retryAfterMs: state.blockedUntil - now };
  }
  return { blocked: false, retryAfterMs: 0 };
}

export function limiterFail(key: string, now = Date.now()): LimiterState {
  const state = getLimiterState(LOGIN_ATTEMPTS, key, CONFIG.WINDOW_MS, now);
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

/**
 * Rate limit for admin actions (not login — general admin endpoint usage).
 * Returns blocked status; increments count on every call.
 */
export function adminActionCheck(req: IncomingMessage, now = Date.now()): { blocked: boolean; retryAfterMs: number } {
  const key = `admin-action:${getClientIp(req)}`;
  const state = getLimiterState(ADMIN_ACTION_ATTEMPTS, key, ADMIN_WINDOW_MS, now);

  if (state.blockedUntil && now < state.blockedUntil) {
    return { blocked: true, retryAfterMs: state.blockedUntil - now };
  }

  state.count += 1;
  if (state.count > ADMIN_MAX_ACTIONS) {
    state.blockedUntil = now + ADMIN_BLOCK_MS;
    ADMIN_ACTION_ATTEMPTS.set(key, state);
    return { blocked: true, retryAfterMs: ADMIN_BLOCK_MS };
  }

  ADMIN_ACTION_ATTEMPTS.set(key, state);
  return { blocked: false, retryAfterMs: 0 };
}
