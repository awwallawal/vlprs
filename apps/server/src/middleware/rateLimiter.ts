import { rateLimit, MemoryStore } from 'express-rate-limit';
import { VOCABULARY } from '@vlprs/shared';

// Touch to reload — UAT
const authStore = new MemoryStore();
const writeStore = new MemoryStore();
const readStore = new MemoryStore();
const verificationStore = new MemoryStore();

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: authStore,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: VOCABULARY.RATE_LIMIT_EXCEEDED },
  },
});

export const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: writeStore,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: VOCABULARY.RATE_LIMIT_EXCEEDED },
  },
});

export const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: readStore,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: VOCABULARY.RATE_LIMIT_EXCEEDED },
  },
});

export const verificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: verificationStore,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: VOCABULARY.RATE_LIMIT_EXCEEDED },
  },
});

/** Reset all rate limiter stores — call in beforeEach for integration tests */
export function resetRateLimiters(): void {
  authStore.resetAll();
  writeStore.resetAll();
  readStore.resetAll();
  verificationStore.resetAll();
}
