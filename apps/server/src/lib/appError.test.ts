import { describe, it, expect } from 'vitest';
import { AppError } from './appError';

describe('AppError', () => {
  it('creates an error with statusCode, code, and message', () => {
    const err = new AppError(400, 'VALIDATION_FAILED', 'Bad input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.message).toBe('Bad input');
    expect(err.details).toBeUndefined();
  });

  it('includes details when provided', () => {
    const details = [{ field: 'email', message: 'Required' }];
    const err = new AppError(400, 'VALIDATION_FAILED', 'Bad input', details);
    expect(err.details).toEqual(details);
  });

  it('is an instance of Error', () => {
    const err = new AppError(500, 'INTERNAL_ERROR', 'Something broke');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of AppError (prototype chain)', () => {
    const err = new AppError(401, 'UNAUTHORIZED', 'No access');
    expect(err).toBeInstanceOf(AppError);
  });

  it('preserves stack trace', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Missing');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('appError.test.ts');
  });
});
