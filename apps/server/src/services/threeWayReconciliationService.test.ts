import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db before importing the service
vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(async (fn: (tx: { insert: ReturnType<typeof vi.fn> }) => Promise<void>) => {
      const tx = { insert: vi.fn() };
      // Wire tx.insert to behave like db.insert (returns chain with .values)
      tx.insert.mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        chain.values = vi.fn(self);
        chain.then = (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve);
        return chain;
      });
      await fn(tx);
    }),
  },
}));

vi.mock('../lib/uuidv7', () => ({
  generateUuidv7: vi.fn(() => 'mock-uuid-001'),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '../db/index';
import { reconcileThreeWay, autoPromoteVariances, getPendingState } from './threeWayReconciliationService';
import type { ThreeWayReconciliationSummary } from '@vlprs/shared';

// ─── Query Chain Helper ──────────────────────────────────────────

function mockQueryChain(result: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.where = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.orderBy = vi.fn(self);
  chain.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve);
  return chain;
}

// ─── Test Data ───────────────────────────────────────────────────

const MDA_ID = 'mda-001';
const PERIOD = '2026-03';
const MDA_NAME = 'Test MDA';

function setupThreeWayMocks(options: {
  mdaName?: string;
  declaredSubmissionId?: string | null;
  payrollSubmissionId?: string | null;
  declaredRows?: Array<{ staffId: string; amountDeducted: string }>;
  actualRows?: Array<{ staffId: string; amountDeducted: string }>;
  loanRows?: Array<{ staffId: string; staffName: string; monthlyDeductionAmount: string; limitedComputation: boolean }>;
}) {
  let callCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    callCount++;
    switch (callCount) {
      case 1: // MDA name query
        return mockQueryChain([{ name: options.mdaName ?? MDA_NAME }]);
      case 2: // Declared submission query
        return mockQueryChain(
          options.declaredSubmissionId !== null
            ? [{ id: options.declaredSubmissionId ?? 'sub-declared-001' }]
            : [],
        );
      case 3: // Payroll submission query
        return mockQueryChain(
          options.payrollSubmissionId !== null
            ? [{ id: options.payrollSubmissionId ?? 'sub-payroll-001' }]
            : [],
        );
      case 4: // Declared rows
        return mockQueryChain(options.declaredRows ?? []);
      case 5: // Actual (payroll) rows
        return mockQueryChain(options.actualRows ?? []);
      case 6: // Active loans (expected)
        return mockQueryChain(options.loanRows ?? []);
      default:
        return mockQueryChain([]);
    }
  });
}

// ─── Tests ───────────────────────────────────────────────────────

describe('threeWayReconciliationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('reconcileThreeWay', () => {
    it('returns Full Match when all three values agree within ₦1', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '14166.67', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.totalStaffCompared).toBe(1);
      expect(result.fullMatchCount).toBe(1);
      expect(result.rows[0].matchStatus).toBe('full_match');
      expect(result.rows[0].varianceCategory).toBeUndefined();
    });

    it('returns Full Match within ₦1 tolerance (rounding)', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '14167.00' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '14166.50', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].matchStatus).toBe('full_match');
    });

    it('returns Partial Match when exactly 2 of 3 pairs agree within ₦1', async () => {
      // expected=0, declared=1.50, actual=0.50
      // |exp-dec|=1.50 > 1 ✗, |exp-act|=0.50 ≤ 1 ✓, |dec-act|=1.00 ≤ 1 ✓ → 2 matches → partial_match
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '1.50' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '0.50' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '0.00', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].matchStatus).toBe('partial_match');
      expect(result.partialMatchCount).toBe(1);
    });

    it('returns Full Variance when all three differ', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '10000.00' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '12000.00' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '14166.67', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].matchStatus).toBe('full_variance');
      expect(result.fullVarianceCount).toBe(1);
    });

    it('categorizes ghost deduction (declared > 0, actual = 0)', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '0.00' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '14166.67', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].varianceCategory).toBe('ghost_deduction');
    });

    it('categorizes unreported deduction (actual > 0, declared = 0)', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '0.00' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '14166.67', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].varianceCategory).toBe('unreported_deduction');
    });

    it('categorizes amount mismatch (both > 0, differ by > ₦1)', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '12000.00' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '14166.67', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].varianceCategory).toBe('amount_mismatch');
    });

    it('categorizes Staff Not in Payroll when staff in declared set but not actual', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        actualRows: [], // S001 not in payroll
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '14166.67', limitedComputation: false }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].varianceCategory).toBe('staff_not_in_payroll');
    });

    it('returns pending state when only payroll exists', async () => {
      setupThreeWayMocks({
        declaredSubmissionId: null, // No declared submission
        payrollSubmissionId: 'sub-payroll-001',
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.pendingState).toContain('MDA submission pending');
      expect(result.totalStaffCompared).toBe(0);
    });

    it('returns pending state when only MDA submission exists', async () => {
      setupThreeWayMocks({
        declaredSubmissionId: 'sub-declared-001',
        payrollSubmissionId: null, // No payroll
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.pendingState).toContain('Payroll data pending');
      expect(result.totalStaffCompared).toBe(0);
    });

    it('computes reconciliation health as fullMatchCount / totalStaff × 100', async () => {
      setupThreeWayMocks({
        declaredRows: [
          { staffId: 'S001', amountDeducted: '14166.67' },
          { staffId: 'S002', amountDeducted: '10000.00' },
          { staffId: 'S003', amountDeducted: '8000.00' },
          { staffId: 'S004', amountDeducted: '12000.00' },
        ],
        actualRows: [
          { staffId: 'S001', amountDeducted: '14166.67' },
          { staffId: 'S002', amountDeducted: '10000.00' },
          { staffId: 'S003', amountDeducted: '5000.00' }, // mismatch
          { staffId: 'S004', amountDeducted: '12000.00' },
        ],
        loanRows: [
          { staffId: 'S001', staffName: 'A', monthlyDeductionAmount: '14166.67', limitedComputation: false },
          { staffId: 'S002', staffName: 'B', monthlyDeductionAmount: '10000.00', limitedComputation: false },
          { staffId: 'S003', staffName: 'C', monthlyDeductionAmount: '8000.00', limitedComputation: false },
          { staffId: 'S004', staffName: 'D', monthlyDeductionAmount: '12000.00', limitedComputation: false },
        ],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.totalStaffCompared).toBe(4);
      expect(result.fullMatchCount).toBe(3); // S001, S002, S004
      expect(result.reconciliationHealth).toBe('75.00');
    });

    it('handles limitedComputation loans with expected_unknown status', async () => {
      setupThreeWayMocks({
        declaredRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        actualRows: [{ staffId: 'S001', amountDeducted: '14166.67' }],
        loanRows: [{ staffId: 'S001', staffName: 'John Doe', monthlyDeductionAmount: '0.00', limitedComputation: true }],
      });

      const result = await reconcileThreeWay(MDA_ID, PERIOD);

      expect(result.rows[0].matchStatus).toBe('expected_unknown');
      expect(result.rows[0].expectedAmount).toBeNull();
    });
  });

  describe('autoPromoteVariances', () => {
    it('promotes variance ≥ ₦500 to exception queue', async () => {
      const summary: ThreeWayReconciliationSummary = {
        period: PERIOD,
        mdaId: MDA_ID,
        mdaName: MDA_NAME,
        totalStaffCompared: 1,
        fullMatchCount: 0,
        fullMatchPercent: '0.00',
        partialMatchCount: 0,
        fullVarianceCount: 1,
        aggregateDeclared: '14166.67',
        aggregateActual: '13000.00',
        reconciliationHealth: '0.00',
        rows: [{
          staffId: 'S001',
          staffName: 'John Doe',
          expectedAmount: '14166.67',
          declaredAmount: '14166.67',
          actualAmount: '13000.00',
          matchStatus: 'partial_match',
          varianceCategory: 'amount_mismatch',
          varianceAmount: '1166.67',
        }],
      };

      const count = await autoPromoteVariances(summary, 'user-001');

      expect(count).toBe(1);
      expect(db.transaction).toHaveBeenCalledTimes(1); // one variance → one transaction
    });

    it('does NOT promote variance < ₦500', async () => {
      const summary: ThreeWayReconciliationSummary = {
        period: PERIOD,
        mdaId: MDA_ID,
        mdaName: MDA_NAME,
        totalStaffCompared: 1,
        fullMatchCount: 0,
        fullMatchPercent: '0.00',
        partialMatchCount: 1,
        fullVarianceCount: 0,
        aggregateDeclared: '14166.67',
        aggregateActual: '14000.00',
        reconciliationHealth: '0.00',
        rows: [{
          staffId: 'S001',
          staffName: 'John Doe',
          expectedAmount: '14166.67',
          declaredAmount: '14166.67',
          actualAmount: '14000.00',
          matchStatus: 'partial_match',
          varianceCategory: 'amount_mismatch',
          varianceAmount: '166.67',
        }],
      };

      const count = await autoPromoteVariances(summary, 'user-001');

      expect(count).toBe(0);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('does NOT promote expected_unknown rows', async () => {
      const summary: ThreeWayReconciliationSummary = {
        period: PERIOD,
        mdaId: MDA_ID,
        mdaName: MDA_NAME,
        totalStaffCompared: 1,
        fullMatchCount: 0,
        fullMatchPercent: '0.00',
        partialMatchCount: 0,
        fullVarianceCount: 0,
        aggregateDeclared: '14166.67',
        aggregateActual: '10000.00',
        reconciliationHealth: '0.00',
        rows: [{
          staffId: 'S001',
          staffName: 'John Doe',
          expectedAmount: null,
          declaredAmount: '14166.67',
          actualAmount: '10000.00',
          matchStatus: 'expected_unknown',
          varianceCategory: 'amount_mismatch',
          varianceAmount: '4166.67',
        }],
      };

      const count = await autoPromoteVariances(summary, 'user-001');

      expect(count).toBe(0);
      expect(db.transaction).not.toHaveBeenCalled();
    });
  });

  describe('getPendingState', () => {
    it('returns pending message when only payroll exists', async () => {
      let callCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // checkDeclaredExists — no declared submission
          return mockQueryChain([]);
        }
        // checkPayrollExists — payroll exists
        return mockQueryChain([{ id: 'sub-001' }]);
      });

      const result = await getPendingState(MDA_ID, PERIOD);

      expect(result).toContain('MDA submission pending');
    });

    it('returns pending message when only MDA submission exists', async () => {
      let callCount = 0;
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // checkDeclaredExists — declared exists
          return mockQueryChain([{ id: 'sub-001' }]);
        }
        // checkPayrollExists — no payroll
        return mockQueryChain([]);
      });

      const result = await getPendingState(MDA_ID, PERIOD);

      expect(result).toContain('Payroll data pending');
    });

    it('returns null when both sources exist', async () => {
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(() =>
        mockQueryChain([{ id: 'sub-001' }]),
      );

      const result = await getPendingState(MDA_ID, PERIOD);

      expect(result).toBeNull();
    });
  });
});
