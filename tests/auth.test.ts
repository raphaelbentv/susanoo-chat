import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validatePin } from '../src/modules/auth.js';

describe('auth — validatePin', () => {
  it('should accept a valid password', () => {
    const errors = validatePin('StrongPass1');
    assert.deepEqual(errors, []);
  });

  it('should reject password shorter than 8 chars', () => {
    const errors = validatePin('Ab1');
    assert.ok(errors.some(e => e.includes('min_8')));
  });

  it('should reject password without uppercase', () => {
    const errors = validatePin('lowercase1');
    assert.ok(errors.some(e => e.includes('uppercase')));
  });

  it('should reject password without lowercase', () => {
    const errors = validatePin('UPPERCASE1');
    assert.ok(errors.some(e => e.includes('lowercase')));
  });

  it('should reject password without digit', () => {
    const errors = validatePin('NoDigitsHere');
    assert.ok(errors.some(e => e.includes('digit')));
  });

  it('should return multiple errors for very weak password', () => {
    const errors = validatePin('abc');
    assert.ok(errors.length >= 2);
  });
});
