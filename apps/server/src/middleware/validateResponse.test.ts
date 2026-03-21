import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { validateResponse } from './validateResponse';
import { AppError } from '../lib/appError';

const testSchema = z.object({
  success: z.literal(true),
  data: z.object({ id: z.number(), name: z.string() }),
});

function createMockRes(statusCode = 200): Response {
  const res = {
    statusCode,
    json: vi.fn().mockReturnThis(),
    status: vi.fn(function (this: Response, code: number) {
      (this as Response & { statusCode: number }).statusCode = code;
      return this;
    }).mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('validateResponse', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('passes through valid response unchanged', () => {
    const middleware = validateResponse(testSchema);
    const req = {} as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    const validBody = { success: true as const, data: { id: 1, name: 'test' } };
    res.json(validBody);

    expect(next).toHaveBeenCalled();
  });

  it('throws 500 RESPONSE_VALIDATION_ERROR in test mode for invalid response', () => {
    const middleware = validateResponse(testSchema);
    const req = {} as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    const invalidBody = { success: true, data: { id: 'not-a-number', name: 123 } };
    expect(() => res.json(invalidBody)).toThrow(AppError);
    expect(() => res.json(invalidBody)).toThrow('Response failed schema validation');
  });

  it('logs warning in development mode but still sends response', () => {
    process.env.NODE_ENV = 'development';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const middleware = validateResponse(testSchema);
    const req = {} as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    const invalidBody = { success: true, data: { id: 'wrong' } };
    res.json(invalidBody);

    expect(warnSpy).toHaveBeenCalledWith(
      '[validateResponse] Schema violation:',
      expect.any(Array),
    );
    warnSpy.mockRestore();
  });

  it('passes through in production mode without throwing or logging', () => {
    process.env.NODE_ENV = 'production';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const middleware = validateResponse(testSchema);
    const req = {} as Request;
    const res = createMockRes();
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    const invalidBody = { success: true, data: { id: 'wrong' } };
    res.json(invalidBody);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips validation for error responses (4xx status)', () => {
    const middleware = validateResponse(testSchema);
    const req = {} as Request;
    const res = createMockRes(400);
    const next: NextFunction = vi.fn();

    middleware(req, res, next);

    const errorBody = { success: false, error: 'Bad request' };
    // Should not throw even with invalid body shape in test mode
    expect(() => res.json(errorBody)).not.toThrow();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });
});
