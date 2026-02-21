import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { authorise } from './authorise';
import { AppError } from '../lib/appError';
import { ROLES, ALL_ROLES, VOCABULARY } from '@vlprs/shared';

function mockReq(user?: Request['user']): Request {
  return { user } as Request;
}

const mockRes = {} as Response;

describe('authorise middleware', () => {
  it('throws at startup if no roles are provided', () => {
    expect(() => authorise()).toThrow('authorise() requires at least one role');
  });

  it('calls next() for super_admin when SUPER_ADMIN is allowed', () => {
    const middleware = authorise(ROLES.SUPER_ADMIN);
    const next = vi.fn();

    middleware(
      mockReq({ userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null }),
      mockRes,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it('throws 403 for dept_admin when only SUPER_ADMIN is allowed', () => {
    const middleware = authorise(ROLES.SUPER_ADMIN);

    expect(() =>
      middleware(
        mockReq({ userId: '1', email: 'a@b.com', role: 'dept_admin', mdaId: null }),
        mockRes,
        vi.fn(),
      ),
    ).toThrow(AppError);

    try {
      middleware(
        mockReq({ userId: '1', email: 'a@b.com', role: 'dept_admin', mdaId: null }),
        mockRes,
        vi.fn(),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
      expect((err as AppError).code).toBe('INSUFFICIENT_PERMISSIONS');
    }
  });

  it('throws 403 for mda_officer when only SUPER_ADMIN is allowed', () => {
    expect.assertions(2);
    const middleware = authorise(ROLES.SUPER_ADMIN);

    try {
      middleware(
        mockReq({ userId: '1', email: 'a@b.com', role: 'mda_officer', mdaId: 'mda-1' }),
        mockRes,
        vi.fn(),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });

  it('calls next() for both super_admin and dept_admin when both are allowed', () => {
    const middleware = authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN);
    const next1 = vi.fn();
    const next2 = vi.fn();

    middleware(
      mockReq({ userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null }),
      mockRes,
      next1,
    );

    middleware(
      mockReq({ userId: '2', email: 'b@b.com', role: 'dept_admin', mdaId: null }),
      mockRes,
      next2,
    );

    expect(next1).toHaveBeenCalledOnce();
    expect(next2).toHaveBeenCalledOnce();
  });

  it('throws 403 for mda_officer when SUPER_ADMIN and DEPT_ADMIN are allowed', () => {
    expect.assertions(2);
    const middleware = authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN);

    try {
      middleware(
        mockReq({ userId: '1', email: 'a@b.com', role: 'mda_officer', mdaId: 'mda-1' }),
        mockRes,
        vi.fn(),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(403);
    }
  });

  it('calls next() for any valid role when ALL_ROLES is spread', () => {
    const middleware = authorise(...ALL_ROLES);
    const next = vi.fn();

    middleware(
      mockReq({ userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null }),
      mockRes,
      next,
    );
    middleware(
      mockReq({ userId: '2', email: 'b@b.com', role: 'dept_admin', mdaId: null }),
      mockRes,
      next,
    );
    middleware(
      mockReq({ userId: '3', email: 'c@b.com', role: 'mda_officer', mdaId: 'mda-1' }),
      mockRes,
      next,
    );

    expect(next).toHaveBeenCalledTimes(3);
  });

  it('throws 401 when req.user is undefined', () => {
    expect.assertions(3);
    const middleware = authorise(ROLES.SUPER_ADMIN);

    try {
      middleware(mockReq(undefined), mockRes, vi.fn());
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(401);
      expect((err as AppError).code).toBe('AUTHENTICATION_REQUIRED');
    }
  });

  it('uses VOCABULARY constants for error messages', () => {
    expect.assertions(1);
    const middleware = authorise(ROLES.SUPER_ADMIN);

    try {
      middleware(
        mockReq({ userId: '1', email: 'a@b.com', role: 'mda_officer', mdaId: 'mda-1' }),
        mockRes,
        vi.fn(),
      );
    } catch (err) {
      expect((err as AppError).message).toBe(VOCABULARY.INSUFFICIENT_PERMISSIONS);
    }
  });

  it('does not reveal required roles in error message', () => {
    expect.assertions(3);
    const middleware = authorise(ROLES.SUPER_ADMIN);

    try {
      middleware(
        mockReq({ userId: '1', email: 'a@b.com', role: 'mda_officer', mdaId: 'mda-1' }),
        mockRes,
        vi.fn(),
      );
    } catch (err) {
      const message = (err as AppError).message;
      expect(message).not.toContain('super_admin');
      expect(message).not.toContain('SUPER_ADMIN');
      expect(message).not.toContain('dept_admin');
    }
  });
});
