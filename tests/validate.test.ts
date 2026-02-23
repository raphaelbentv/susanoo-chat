import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validate, sanitize } from '../src/modules/validate.js';

describe('validate', () => {
  it('should pass when all required fields are present', () => {
    const result = validate(
      { name: 'alice', age: 25 },
      {
        name: { type: 'string', required: true, minLength: 1 },
        age: { type: 'number', required: true, min: 0 },
      }
    );
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, []);
  });

  it('should fail on missing required field', () => {
    const result = validate(
      { name: '' },
      { name: { type: 'string', required: true } }
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.includes('name_required'));
  });

  it('should fail on string too short', () => {
    const result = validate(
      { name: 'ab' },
      { name: { type: 'string', minLength: 3 } }
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('min_3')));
  });

  it('should fail on string too long', () => {
    const result = validate(
      { name: 'a'.repeat(100) },
      { name: { type: 'string', maxLength: 50 } }
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('max_50')));
  });

  it('should fail on pattern mismatch', () => {
    const result = validate(
      { code: 'abc!@#' },
      { code: { type: 'string', pattern: /^[a-z0-9]+$/ } }
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('invalid_format')));
  });

  it('should fail on invalid oneOf value', () => {
    const result = validate(
      { role: 'superadmin' },
      { role: { type: 'string', oneOf: ['user', 'admin'] as const } }
    );
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('invalid_value')));
  });

  it('should pass on valid oneOf value', () => {
    const result = validate(
      { role: 'admin' },
      { role: { type: 'string', oneOf: ['user', 'admin'] as const } }
    );
    assert.equal(result.valid, true);
  });

  it('should fail on number out of range', () => {
    const result = validate(
      { temp: 3 },
      { temp: { type: 'number', min: 0, max: 2 } }
    );
    assert.equal(result.valid, false);
  });

  it('should skip optional fields when missing', () => {
    const result = validate(
      {},
      { name: { type: 'string' } }
    );
    assert.equal(result.valid, true);
  });
});

describe('sanitize', () => {
  it('should trim whitespace', () => {
    assert.equal(sanitize('  hello  '), 'hello');
  });

  it('should truncate to maxLength', () => {
    assert.equal(sanitize('a'.repeat(100), 10), 'a'.repeat(10));
  });

  it('should handle null/undefined', () => {
    assert.equal(sanitize(null), '');
    assert.equal(sanitize(undefined), '');
  });

  it('should convert non-strings', () => {
    assert.equal(sanitize(42), '42');
  });
});
