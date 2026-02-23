import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { limiterCheck, limiterFail, limiterReset } from '../src/modules/ratelimit.js';

describe('ratelimit', () => {
  it('should not block on first attempt', () => {
    const key = `test-${Date.now()}`;
    const result = limiterCheck(key);
    assert.equal(result.blocked, false);
    assert.equal(result.retryAfterMs, 0);
  });

  it('should block after 5 failures', () => {
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      limiterFail(key);
    }
    const result = limiterCheck(key);
    assert.equal(result.blocked, true);
    assert.ok(result.retryAfterMs > 0);
  });

  it('should reset after limiterReset', () => {
    const key = `test-reset-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      limiterFail(key);
    }
    limiterReset(key);
    const result = limiterCheck(key);
    assert.equal(result.blocked, false);
  });

  it('should not block if failures are under threshold', () => {
    const key = `test-under-${Date.now()}`;
    for (let i = 0; i < 4; i++) {
      limiterFail(key);
    }
    const result = limiterCheck(key);
    assert.equal(result.blocked, false);
  });
});
