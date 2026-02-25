import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { immutableRoute } from './immutableRoute';
import { AppError } from '../lib/appError';

function createMockReq(method: string): Request {
  return { method } as Request;
}

function createMockRes(): Response {
  return { setHeader: vi.fn() } as unknown as Response;
}

describe('immutableRoute middleware (Layer 3)', () => {
  it('allows GET requests through', () => {
    const next = vi.fn() as NextFunction;
    immutableRoute(createMockReq('GET'), createMockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows POST requests through', () => {
    const next = vi.fn() as NextFunction;
    immutableRoute(createMockReq('POST'), createMockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects PUT with 405 and sets Allow header', () => {
    const next = vi.fn() as NextFunction;
    const res = createMockRes();
    try {
      immutableRoute(createMockReq('PUT'), res, next);
      expect.fail('Should have thrown AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(405);
      expect((err as AppError).code).toBe('METHOD_NOT_ALLOWED');
    }
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, POST, HEAD, OPTIONS');
  });

  it('rejects PATCH with 405 and sets Allow header', () => {
    const next = vi.fn() as NextFunction;
    const res = createMockRes();
    try {
      immutableRoute(createMockReq('PATCH'), res, next);
      expect.fail('Should have thrown AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(405);
    }
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, POST, HEAD, OPTIONS');
  });

  it('rejects DELETE with 405 and sets Allow header', () => {
    const next = vi.fn() as NextFunction;
    const res = createMockRes();
    try {
      immutableRoute(createMockReq('DELETE'), res, next);
      expect.fail('Should have thrown AppError');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(405);
    }
    expect(next).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET, POST, HEAD, OPTIONS');
  });
});
