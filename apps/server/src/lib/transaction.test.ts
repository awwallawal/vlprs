import { describe, it, expect, vi } from 'vitest';

// Mock the db module before importing withTransaction
vi.mock('../db', () => {
  const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const mockTx = { isMockTx: true };
    return fn(mockTx);
  });
  return {
    db: { transaction: mockTransaction },
  };
});

import { withTransaction, type TxHandle } from './transaction';
import { db } from '../db';

describe('withTransaction', () => {
  it('opens new transaction when existingTx is not provided', async () => {
    const result = await withTransaction(async (tx) => {
      expect((tx as unknown as { isMockTx: boolean }).isMockTx).toBe(true);
      return 'result';
    });

    expect(result).toBe('result');
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('uses existingTx directly when provided (no new transaction)', async () => {
    const existingTx = { isExistingTx: true } as unknown as TxHandle;
    vi.mocked(db.transaction).mockClear();

    const result = await withTransaction(async (tx) => {
      expect((tx as unknown as { isExistingTx: boolean }).isExistingTx).toBe(true);
      return 'composed-result';
    }, existingTx);

    expect(result).toBe('composed-result');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('propagates errors (Drizzle auto-rollback)', async () => {
    await expect(
      withTransaction(async () => {
        throw new Error('test error');
      }),
    ).rejects.toThrow('test error');
  });
});
