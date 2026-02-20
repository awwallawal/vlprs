import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { scopeToMda } from './scopeToMda';
import { AppError } from '../lib/appError';

function mockReq(user?: Request['user']): Request {
  return { user } as Request;
}

const mockRes = {} as Response;

describe('scopeToMda middleware', () => {
  it('sets req.mdaScope to null for super_admin', () => {
    const req = mockReq({ userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null });
    const next = vi.fn();

    scopeToMda(req, mockRes, next);

    expect(req.mdaScope).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets req.mdaScope to null for dept_admin', () => {
    const req = mockReq({ userId: '1', email: 'a@b.com', role: 'dept_admin', mdaId: null });
    const next = vi.fn();

    scopeToMda(req, mockRes, next);

    expect(req.mdaScope).toBeNull();
    expect(next).toHaveBeenCalledOnce();
  });

  it('sets req.mdaScope to mdaId for mda_officer', () => {
    const req = mockReq({ userId: '1', email: 'a@b.com', role: 'mda_officer', mdaId: 'mda-123' });
    const next = vi.fn();

    scopeToMda(req, mockRes, next);

    expect(req.mdaScope).toBe('mda-123');
    expect(next).toHaveBeenCalledOnce();
  });

  it('throws 403 MDA_NOT_ASSIGNED for mda_officer without mdaId', () => {
    expect.assertions(3);
    const req = mockReq({ userId: '1', email: 'a@b.com', role: 'mda_officer', mdaId: null });

    try {
      scopeToMda(req, mockRes, vi.fn());
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).code).toBe('MDA_NOT_ASSIGNED');
    }
  });

  it('throws 401 when req.user is undefined', () => {
    expect.assertions(3);
    const req = mockReq(undefined);

    try {
      scopeToMda(req, mockRes, vi.fn());
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).code).toBe('AUTHENTICATION_REQUIRED');
    }
  });

  it('calls next() on success', () => {
    const req = mockReq({ userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null });
    const next = vi.fn();

    scopeToMda(req, mockRes, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
