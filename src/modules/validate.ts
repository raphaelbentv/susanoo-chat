/**
 * Lightweight input validation — no external dependencies.
 */

interface FieldRule {
  type: 'string' | 'number' | 'boolean';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  oneOf?: readonly (string | number | boolean)[];
}

type Schema = Record<string, FieldRule>;

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validate(data: Record<string, unknown>, schema: Schema): ValidationResult {
  const errors: string[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];

    if (value === undefined || value === null || value === '') {
      if (rule.required) {
        errors.push(`${field}_required`);
      }
      continue;
    }

    if (rule.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${field}_must_be_string`);
        continue;
      }
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push(`${field}_min_${rule.minLength}_chars`);
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push(`${field}_max_${rule.maxLength}_chars`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${field}_invalid_format`);
      }
      if (rule.oneOf && !rule.oneOf.includes(value)) {
        errors.push(`${field}_invalid_value`);
      }
    }

    if (rule.type === 'number') {
      const num = typeof value === 'number' ? value : Number(value);
      if (isNaN(num)) {
        errors.push(`${field}_must_be_number`);
        continue;
      }
      if (rule.min !== undefined && num < rule.min) {
        errors.push(`${field}_min_${rule.min}`);
      }
      if (rule.max !== undefined && num > rule.max) {
        errors.push(`${field}_max_${rule.max}`);
      }
    }

    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${field}_must_be_boolean`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitize a string: trim, collapse whitespace, limit length.
 */
export function sanitize(input: unknown, maxLength = 8000): string {
  return String(input ?? '').trim().slice(0, maxLength);
}
