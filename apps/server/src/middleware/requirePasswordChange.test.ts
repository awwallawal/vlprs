import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requirePasswordChange } from './requirePasswordChange';
import { AppError } from '../lib/appError';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/api/users',
    user: undefined,
    ...overrides,
  } as unknown as Request;
}

const mockRes = {} as Response;

describe('requirePasswordChange', () => {
  it('calls next() when user does not need to change password', () => {
    const next = vi.fn();
    const req = mockReq({
      user: { userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null, mustChangePassword: false },
    });

    requirePasswordChange(req, mockRes, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when no user is set (pre-auth)', () => {
    const next = vi.fn();
    const req = mockReq({ user: undefined });

    requirePasswordChange(req, mockRes, next);
    expect(next).toHaveBeenCalled();
  });

  it('throws 403 when mustChangePassword is true and path is not allowed', () => {
    const next = vi.fn();
    const req = mockReq({
      path: '/api/users',
      user: { userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null, mustChangePassword: true },
    });

    expect(() => requirePasswordChange(req, mockRes, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows change-password endpoint when mustChangePassword is true', () => {
    const next = vi.fn();
    const req = mockReq({
      path: '/api/auth/change-password',
      user: { userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null, mustChangePassword: true },
    });

    requirePasswordChange(req, mockRes, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows logout endpoint when mustChangePassword is true', () => {
    const next = vi.fn();
    const req = mockReq({
      path: '/api/auth/logout',
      user: { userId: '1', email: 'a@b.com', role: 'super_admin', mdaId: null, mustChangePassword: true },
    });

    requirePasswordChange(req, mockRes, next);
    expect(next).toHaveBeenCalled();
  });
});
