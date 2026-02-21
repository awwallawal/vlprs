import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

import { logAuthEvent } from './auditService';
import { db } from '../db';
import { logger } from '../lib/logger';

describe('logAuthEvent', () => {
  let mockValues: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockValues = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });
  });

  it('inserts correct fields for login success', async () => {
    await logAuthEvent({
      userId: 'user-1',
      email: 'admin@test.com',
      role: 'super_admin',
      mdaId: null,
      action: 'AUTH_LOGIN_SUCCESS',
      resource: '/api/auth/login',
      responseStatus: 200,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    });

    expect(mockValues).toHaveBeenCalledOnce();
    const values = mockValues.mock.calls[0][0];
    expect(values.userId).toBe('user-1');
    expect(values.email).toBe('admin@test.com');
    expect(values.action).toBe('AUTH_LOGIN_SUCCESS');
    expect(values.responseStatus).toBe(200);
    expect(values.requestBodyHash).toBeNull();
  });

  it('inserts correct fields for login failure (no userId)', async () => {
    await logAuthEvent({
      email: 'unknown@test.com',
      action: 'AUTH_LOGIN_FAILED',
      resource: '/api/auth/login',
      responseStatus: 401,
      ipAddress: '10.0.0.1',
      userAgent: 'curl/7.68.0',
    });

    expect(mockValues).toHaveBeenCalledOnce();
    const values = mockValues.mock.calls[0][0];
    expect(values.userId).toBeNull();
    expect(values.email).toBe('unknown@test.com');
    expect(values.action).toBe('AUTH_LOGIN_FAILED');
    expect(values.responseStatus).toBe(401);
  });

  it('inserts correct fields for logout', async () => {
    await logAuthEvent({
      userId: 'user-1',
      email: 'admin@test.com',
      role: 'super_admin',
      action: 'AUTH_LOGOUT',
      resource: '/api/auth/logout',
      responseStatus: 200,
      ipAddress: '127.0.0.1',
    });

    expect(mockValues).toHaveBeenCalledOnce();
    const values = mockValues.mock.calls[0][0];
    expect(values.action).toBe('AUTH_LOGOUT');
    expect(values.userId).toBe('user-1');
  });

  it('inserts correct fields for account lockout', async () => {
    await logAuthEvent({
      email: 'locked@test.com',
      action: 'AUTH_ACCOUNT_LOCKED',
      resource: '/api/auth/login',
      responseStatus: 423,
      ipAddress: '192.168.1.1',
    });

    expect(mockValues).toHaveBeenCalledOnce();
    const values = mockValues.mock.calls[0][0];
    expect(values.action).toBe('AUTH_ACCOUNT_LOCKED');
    expect(values.userId).toBeNull();
    expect(values.responseStatus).toBe(423);
  });

  it('catches and logs DB errors (never throws)', async () => {
    const dbError = new Error('DB connection failed');
    mockValues.mockRejectedValueOnce(dbError);

    // Should not throw
    await expect(logAuthEvent({
      email: 'test@test.com',
      action: 'AUTH_LOGIN_SUCCESS',
      resource: '/api/auth/login',
      ipAddress: '127.0.0.1',
    })).resolves.not.toThrow();

    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS', email: 'test@test.com' }),
      'Failed to log auth event',
    );
  });
});
