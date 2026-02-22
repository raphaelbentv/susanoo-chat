import type { Profile } from '../types/index.js';
import { CONFIG } from '../config.js';

export function validatePin(pin: string): string[] {
  const errors: string[] = [];

  if (pin.length < CONFIG.PASSWORD.MIN_LENGTH) {
    errors.push(`min_${CONFIG.PASSWORD.MIN_LENGTH}_chars`);
  }

  if (CONFIG.PASSWORD.REQUIRE_UPPER && !/[A-Z]/.test(pin)) {
    errors.push('require_uppercase');
  }

  if (CONFIG.PASSWORD.REQUIRE_LOWER && !/[a-z]/.test(pin)) {
    errors.push('require_lowercase');
  }

  if (CONFIG.PASSWORD.REQUIRE_DIGIT && !/\d/.test(pin)) {
    errors.push('require_digit');
  }

  return errors;
}

export function isPinExpired(profile: Profile): boolean {
  const pinAge = Date.now() - new Date(profile.pinChangedAt).getTime();
  const maxAge = CONFIG.PASSWORD.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return pinAge > maxAge;
}
