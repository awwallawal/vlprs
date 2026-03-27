import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { EventEmitter } from 'node:events';
import supertest from 'supertest';
import app from '../app';
import { db } from '../db/index';
import { queryStorage, queryCounterLogger } from '../lib/queryContext';
import { queryCounter } from './queryCounter';
import type { Request, Response, NextFunction } from 'express';

/**
 * Query Counter Middleware Tests (Story 7.0c, AC 7).
 *
 * Validates:
 * 1. Counter increments on DB operations via Drizzle logger
 * 2. req.queryCount is set after response finish (direct middleware invocation)
 * 3. AsyncLocalStorage context propagates correctly (no cross-contamination)
 * 4. Production safety — logQuery is a no-op without active context
 * 5. Middleware integration doesn't break endpoints
 */

describe('queryCounter middleware', () => {
  beforeAll(async () => {
    // Warm DB connection
    await db.execute(sql`SELECT 1`);
  }, 15000);

  it('increments counter when queries are executed within AsyncLocalStorage context', async () => {
    let capturedCount = -1;

    await new Promise<void>((resolve) => {
      queryStorage.run({ count: 0 }, async () => {
        await db.execute(sql`SELECT 1`);
        await db.execute(sql`SELECT 2`);
        await db.execute(sql`SELECT 3`);

        const ctx = queryStorage.getStore();
        capturedCount = ctx?.count ?? -1;
        resolve();
      });
    });

    expect(capturedCount).toBe(3);
  });

  it('sets req.queryCount on response finish via direct middleware invocation', async () => {
    const mockReq = {} as Request;
    const mockRes = new EventEmitter() as unknown as Response;

    await new Promise<void>((resolve) => {
      queryCounter(mockReq, mockRes, (async () => {
        // Queries inside next() — ALS context propagates through the async chain
        await db.execute(sql`SELECT 1`);
        await db.execute(sql`SELECT 2`);

        // Trigger 'finish' after queries complete
        mockRes.emit('finish');
        resolve();
      }) as unknown as NextFunction);
    });

    // Middleware's res.on('finish') handler sets req.queryCount = ctx.count
    expect(mockReq.queryCount).toBe(2);
  });

  it('does not break health endpoint (integration smoke test)', async () => {
    const res = await supertest(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('context is isolated per-request — no cross-contamination', async () => {
    const counts: number[] = [];

    await Promise.all([
      new Promise<void>((resolve) => {
        queryStorage.run({ count: 0 }, async () => {
          await db.execute(sql`SELECT 1`);
          await db.execute(sql`SELECT 2`);
          counts.push(queryStorage.getStore()?.count ?? -1);
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        queryStorage.run({ count: 0 }, async () => {
          await db.execute(sql`SELECT 1`);
          counts.push(queryStorage.getStore()?.count ?? -1);
          resolve();
        });
      }),
    ]);

    expect(counts).toContain(2);
    expect(counts).toContain(1);
  });

  it('logQuery is a no-op when no AsyncLocalStorage context exists (production safety)', () => {
    // In production, middleware isn't registered → no queryStorage.run() → no store.
    // Verify the logger doesn't throw or have side effects when called outside a context.
    expect(() => queryCounterLogger.logQuery('SELECT 1', [])).not.toThrow();
    expect(queryStorage.getStore()).toBeUndefined();
  });
});
