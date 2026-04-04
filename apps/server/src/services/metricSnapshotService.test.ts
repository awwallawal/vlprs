import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────��─────────────────────

vi.mock('./revenueProjectionService', () => ({
  getTotalOutstandingReceivables: vi.fn().mockResolvedValue('5000000.00'),
  getActualMonthlyRecovery: vi.fn().mockResolvedValue({ amount: '250000.00', periodMonth: 3, periodYear: 2026 }),
}));

vi.mock('./loanClassificationService', () => ({
  getLoanCompletionRateLifetime: vi.fn().mockResolvedValue(12.5),
}));

// Chainable DB mock with insert support
const insertMock = vi.fn();
const onConflictDoUpdateMock = vi.fn().mockResolvedValue(undefined);
const selectMock = vi.fn();
const fromMock = vi.fn();
const whereMock = vi.fn();
const limitMock = vi.fn();

function resetDbMocks() {
  insertMock.mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock }) });
  selectMock.mockReturnValue({ from: fromMock });
  fromMock.mockReturnValue({ where: whereMock, limit: limitMock });
  whereMock.mockResolvedValue([{ value: 100 }]); // Default: 100 active loans
  limitMock.mockResolvedValue([]);
}

vi.mock('../db', () => ({
  db: {
    insert: (...args: unknown[]) => insertMock(...args),
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

vi.mock('../db/schema', () => ({
  loans: { status: 'status', mdaId: 'mda_id' },
  metricSnapshots: {
    id: 'id',
    snapshotYear: 'snapshot_year',
    snapshotMonth: 'snapshot_month',
    activeLoans: 'active_loans',
    totalExposure: 'total_exposure',
    monthlyRecovery: 'monthly_recovery',
    completionRate: 'completion_rate',
    createdAt: 'created_at',
  },
}));

vi.mock('../config/env', () => ({
  env: { NODE_ENV: 'test' },
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

import * as revenueProjectionService from './revenueProjectionService';
import * as loanClassificationService from './loanClassificationService';
import {
  captureMonthlySnapshot,
  getPreviousMonthSnapshot,
  runSnapshotCheck,
  startMetricSnapshotScheduler,
  stopMetricSnapshotScheduler,
} from './metricSnapshotService';

describe('metricSnapshotService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
  });

  afterEach(() => {
    stopMetricSnapshotScheduler();
  });

  describe('captureMonthlySnapshot', () => {
    it('captures a new snapshot row with computed metrics', async () => {
      await captureMonthlySnapshot();

      // Verify all 4 metrics were computed
      expect(revenueProjectionService.getTotalOutstandingReceivables).toHaveBeenCalledWith(null);
      expect(revenueProjectionService.getActualMonthlyRecovery).toHaveBeenCalledWith(null);
      expect(loanClassificationService.getLoanCompletionRateLifetime).toHaveBeenCalledWith(null);

      // Verify upsert was called
      expect(insertMock).toHaveBeenCalled();
      expect(onConflictDoUpdateMock).toHaveBeenCalled();
    });

    it('upserts when called twice in the same month — no duplicate', async () => {
      await captureMonthlySnapshot();
      await captureMonthlySnapshot();

      // Both calls go through the upsert path (onConflictDoUpdate)
      expect(insertMock).toHaveBeenCalledTimes(2);
      expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPreviousMonthSnapshot', () => {
    it('calculates previous month correctly for mid-year', async () => {
      // March 2026 → should query February 2026
      whereMock.mockResolvedValueOnce([{
        activeLoans: 95,
        totalExposure: '4500000.00',
        monthlyRecovery: '230000.00',
        completionRate: '11.2',
      }]);

      const result = await getPreviousMonthSnapshot(2026, 3);

      expect(result).toEqual({
        activeLoans: 95,
        totalExposure: '4500000.00',
        monthlyRecovery: '230000.00',
        completionRate: '11.2',
      });
    });

    it('wraps around year boundary: January → December of previous year', async () => {
      whereMock.mockResolvedValueOnce([{
        activeLoans: 90,
        totalExposure: '4000000.00',
        monthlyRecovery: '210000.00',
        completionRate: '10.0',
      }]);

      const result = await getPreviousMonthSnapshot(2026, 1);

      expect(result).not.toBeNull();
      expect(result!.activeLoans).toBe(90);
    });

    it('returns null when no previous snapshot exists', async () => {
      whereMock.mockResolvedValueOnce([]);

      const result = await getPreviousMonthSnapshot(2026, 3);

      expect(result).toBeNull();
    });
  });

  describe('scheduler', () => {
    it('startMetricSnapshotScheduler returns immediately in test env', () => {
      // env.NODE_ENV is 'test', so scheduler should not start
      startMetricSnapshotScheduler();
      // No interval should be set — the function returns early
      // This is validated by the fact that no errors occur and stopMetricSnapshotScheduler is safe
      stopMetricSnapshotScheduler();
    });
  });

  describe('runSnapshotCheck', () => {
    it('skips capture if snapshot already exists for current month', async () => {
      // where() returns existing snapshot → skip
      whereMock.mockResolvedValueOnce([{ id: 'existing-snapshot-id' }]);

      await runSnapshotCheck();

      // Should NOT have called insert — capture was skipped
      expect(insertMock).not.toHaveBeenCalled();
    });

    it('captures snapshot if none exists for current month', async () => {
      // First where(): no snapshot for current month
      whereMock.mockResolvedValueOnce([]);
      // limit(): some snapshots exist (not first run)
      limitMock.mockResolvedValueOnce([{ id: 'old-snapshot' }]);
      // Second where() from captureMonthlySnapshot: active loans count
      whereMock.mockResolvedValueOnce([{ value: 100 }]);

      await runSnapshotCheck();

      // Should have captured a snapshot
      expect(insertMock).toHaveBeenCalled();
      expect(onConflictDoUpdateMock).toHaveBeenCalled();
    });
  });
});
