import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock db before importing auditLog
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

import { auditLog } from './auditLog';
import { db } from '../db';
import { logger } from '../lib/logger';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { userId: 'user-123', email: 'test@example.com', role: 'super_admin', mdaId: null },
    method: 'GET',
    originalUrl: '/api/users',
    path: '/users',
    route: { path: '/users' },
    body: undefined,
    ip: '127.0.0.1',
    get: vi.fn().mockReturnValue('test-agent'),
    socket: { remoteAddress: '127.0.0.1' },
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { _finishCallbacks: (() => void)[] } {
  const res = {
    statusCode: 200,
    _finishCallbacks: [] as (() => void)[],
    on: vi.fn().mockImplementation((event: string, cb: () => void) => {
      if (event === 'finish') res._finishCallbacks.push(cb);
    }),
  } as unknown as Response & { _finishCallbacks: (() => void)[] };
  return res;
}

describe('auditLog middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock chain
    const mockValues = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });
  });

  it('calls next() immediately (does not block)', () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    auditLog(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('captures userId, role, mdaId from req.user', async () => {
    const req = createMockReq({
      user: { userId: 'u-1', email: 'admin@test.com', role: 'dept_admin' as const, mdaId: 'mda-1' },
    } as Partial<Request>);
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    const mockValues = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    auditLog(req, res, next);
    // Simulate finish
    res._finishCallbacks.forEach(cb => cb());

    await vi.waitFor(() => {
      expect(mockValues).toHaveBeenCalledOnce();
    });

    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues.userId).toBe('u-1');
    expect(insertedValues.role).toBe('dept_admin');
    expect(insertedValues.mdaId).toBe('mda-1');
  });

  it('captures method, originalUrl, IP, user-agent', async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    const mockValues = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    auditLog(req, res, next);
    res._finishCallbacks.forEach(cb => cb());

    await vi.waitFor(() => {
      expect(mockValues).toHaveBeenCalledOnce();
    });

    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues.method).toBe('GET');
    expect(insertedValues.resource).toBe('/api/users');
    expect(insertedValues.ipAddress).toBe('127.0.0.1');
    expect(insertedValues.userAgent).toBe('test-agent');
  });

  it('hashes request body for POST requests', async () => {
    const req = createMockReq({
      method: 'POST',
      body: { email: 'new@test.com', password: 'secret' },
    } as Partial<Request>);
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    const mockValues = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    auditLog(req, res, next);
    res._finishCallbacks.forEach(cb => cb());

    await vi.waitFor(() => {
      expect(mockValues).toHaveBeenCalledOnce();
    });

    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues.requestBodyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sets null hash for GET requests', async () => {
    const req = createMockReq({ method: 'GET', body: undefined });
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    const mockValues = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    auditLog(req, res, next);
    res._finishCallbacks.forEach(cb => cb());

    await vi.waitFor(() => {
      expect(mockValues).toHaveBeenCalledOnce();
    });

    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues.requestBodyHash).toBeNull();
  });

  it('writes to DB on res.finish with correct responseStatus', async () => {
    const req = createMockReq();
    const res = createMockRes();
    res.statusCode = 201;
    const next = vi.fn() as unknown as NextFunction;

    const mockValues = vi.fn().mockResolvedValue(undefined);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    auditLog(req, res, next);
    res._finishCallbacks.forEach(cb => cb());

    await vi.waitFor(() => {
      expect(mockValues).toHaveBeenCalledOnce();
    });

    const insertedValues = mockValues.mock.calls[0][0];
    expect(insertedValues.responseStatus).toBe(201);
  });

  it('logs to pino if DB insert fails (does not throw)', async () => {
    const req = createMockReq();
    const res = createMockRes();
    const next = vi.fn() as unknown as NextFunction;

    const dbError = new Error('DB connection lost');
    const mockValues = vi.fn().mockReturnValue(
      Promise.reject(dbError),
    );
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: mockValues });

    auditLog(req, res, next);
    res._finishCallbacks.forEach(cb => cb());

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
