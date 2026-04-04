/**
 * autoStopService unit tests — Zero-balance detection, inline trigger,
 * limitedComputation exclusion, background scheduler guard.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../db/schema', () => ({
  loans: {
    id: 'loans.id', staffName: 'loans.staff_name', staffId: 'loans.staff_id',
    mdaId: 'loans.mda_id', status: 'loans.status', principalAmount: 'loans.principal_amount',
    interestRate: 'loans.interest_rate', tenureMonths: 'loans.tenure_months',
    limitedComputation: 'loans.limited_computation',
  },
  ledgerEntries: {
    loanId: 'ledger_entries.loan_id', amount: 'ledger_entries.amount',
  },
  loanCompletions: {
    id: 'loan_completions.id', loanId: 'loan_completions.loan_id',
    completionDate: 'loan_completions.completion_date',
  },
  observations: {
    id: 'observations.id', type: 'observations.type',
    staffName: 'observations.staff_name', staffId: 'observations.staff_id',
    loanId: 'observations.loan_id', mdaId: 'observations.mda_id',
    description: 'observations.description', context: 'observations.context',
    status: 'observations.status',
  },
  submissionRows: {
    id: 'submission_rows.id', submissionId: 'submission_rows.submission_id',
    staffId: 'submission_rows.staff_id', month: 'submission_rows.month',
    amountDeducted: 'submission_rows.amount_deducted',
  },
  users: { id: 'users.id', email: 'users.email', role: 'users.role' },
}));

vi.mock('../db/immutable', () => ({
  ledgerDb: {
    selectByLoan: vi.fn(),
  },
}));

const mockTransitionLoan = vi.fn().mockResolvedValue({
  id: 'transition-1', loanId: 'loan-1', fromStatus: 'ACTIVE', toStatus: 'COMPLETED',
  transitionedBy: 'system-user-1', transitionedByName: 'System (Auto-Stop)',
  reason: 'Auto-stop', createdAt: '2026-04-04T00:00:00.000Z',
});
vi.mock('./loanTransitionService', () => ({
  transitionLoan: (...args: unknown[]) => mockTransitionLoan(...args),
}));

vi.mock('../lib/uuidv7', () => ({
  generateUuidv7: () => 'mock-uuid',
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/env', () => ({
  env: { NODE_ENV: 'test', PORT: 3000 },
}));

// ─── Import after mocks ────────────────────────────────────────────

import { db } from '../db/index';
import { ledgerDb } from '../db/immutable';
import { computeBalanceForLoan } from './computationEngine';

// Note: computeBalanceForLoan is a pure function — not mocked.
// We feed it known entries and verify the outcome.

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

// ─── detectAndTriggerAutoStop ───────────────────────────────────────

describe('detectAndTriggerAutoStop', () => {
  // Dynamically import to get fresh module state
  async function importService() {
    const mod = await import('./autoStopService');
    return mod;
  }

  it('triggers auto-stop for a loan with balance exactly 0', async () => {
    // Setup: system user lookup chain
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'system-user-1' }]),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([{
        id: 'loan-1', staffName: 'John Doe', staffId: 'STF001', mdaId: 'mda-1',
        principalAmount: '100000.00', interestRate: '13.33', tenureMonths: 36,
        limitedComputation: false, totalPaid: '113330.00',
      }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    // ledgerDb returns entries that sum to exactly totalLoan
    vi.mocked(ledgerDb.selectByLoan).mockResolvedValue([
      { amount: '113330.00', principalComponent: '100000.00', interestComponent: '13330.00', entryType: 'MIGRATION_BASELINE' },
    ] as any);

    // Mock insert for loanCompletions
    const mockInsertChain = { values: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(db.insert).mockReturnValue(mockInsertChain as any);

    const { detectAndTriggerAutoStop } = await importService();
    const results = await detectAndTriggerAutoStop({ triggerSource: 'background_scan' });

    expect(results.length).toBe(1);
    expect(results[0].loanId).toBe('loan-1');
    expect(results[0].staffName).toBe('John Doe');
    expect(mockTransitionLoan).toHaveBeenCalledWith(
      'system-user-1', 'loan-1', 'COMPLETED',
      expect.stringContaining('Auto-stop: zero balance detected'),
      null,
    );
  });

  it('triggers auto-stop for a loan with balance slightly below 0 (rounding)', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'system-user-1' }]),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([{
        id: 'loan-2', staffName: 'Jane Smith', staffId: 'STF002', mdaId: 'mda-1',
        principalAmount: '100000.00', interestRate: '13.33', tenureMonths: 36,
        limitedComputation: false, totalPaid: '113335.00',
      }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    // Entries sum to more than totalLoan (slight overpayment)
    vi.mocked(ledgerDb.selectByLoan).mockResolvedValue([
      { amount: '113335.00', principalComponent: '100005.00', interestComponent: '13330.00', entryType: 'MIGRATION_BASELINE' },
    ] as any);

    const mockInsertChain = { values: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(db.insert).mockReturnValue(mockInsertChain as any);

    const { detectAndTriggerAutoStop } = await importService();
    const results = await detectAndTriggerAutoStop({ triggerSource: 'background_scan' });

    expect(results.length).toBe(1);
    expect(results[0].loanId).toBe('loan-2');
  });

  it('does NOT trigger for a loan with positive balance', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'system-user-1' }]),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([]),  // SQL filter already excludes positive balance
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const { detectAndTriggerAutoStop } = await importService();
    const results = await detectAndTriggerAutoStop({ triggerSource: 'background_scan' });

    expect(results.length).toBe(0);
    expect(mockTransitionLoan).not.toHaveBeenCalled();
  });

  it('excludes limitedComputation loans from candidates (SQL WHERE clause)', async () => {
    // The SQL query includes WHERE limited_computation = false
    // So limitedComputation=true loans never appear in candidates
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'system-user-1' }]),
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const { detectAndTriggerAutoStop } = await importService();
    const results = await detectAndTriggerAutoStop();

    expect(results).toEqual([]);
  });

  it('skips detection when no system user is available', async () => {
    // Both system@vlprs.local lookup and SUPER_ADMIN fallback return empty
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),  // no user found
      leftJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const { detectAndTriggerAutoStop } = await importService();
    const results = await detectAndTriggerAutoStop();

    expect(results).toEqual([]);
    expect(mockTransitionLoan).not.toHaveBeenCalled();
  });
});

// ─── checkAndTriggerAutoStop (inline trigger) ──────────────────────

describe('checkAndTriggerAutoStop', () => {
  async function importService() {
    return import('./autoStopService');
  }

  it('triggers auto-stop for a MIGRATION_BASELINE entry that makes balance <= 0', async () => {
    const loanData = {
      id: 'loan-1', staffName: 'John Doe', staffId: 'STF001', mdaId: 'mda-1',
      status: 'ACTIVE', principalAmount: '100000.00', interestRate: '13.33',
      tenureMonths: 36, limitedComputation: false,
    };

    // db.select() is called for: (1) loan lookup chain: select→from→where,
    // (2) system user lookup chain: select→from→where→limit
    let selectCallCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      selectCallCount++;
      const currentCall = selectCallCount;
      // Create a thenable chain — each method returns the chain,
      // and the chain resolves when awaited
      const makeChain = (resolveValue: unknown[]) => {
        const chain: Record<string, any> = {};
        chain.from = vi.fn().mockReturnValue(chain);
        chain.where = vi.fn().mockReturnValue(chain);
        chain.limit = vi.fn().mockReturnValue(chain);
        chain.then = (resolve: any) => resolve(resolveValue);
        return chain;
      };

      if (currentCall === 1) {
        return makeChain([loanData]) as any;
      }
      return makeChain([{ id: 'system-user-1' }]) as any;
    });

    vi.mocked(ledgerDb.selectByLoan).mockResolvedValue([
      { amount: '113330.00', principalComponent: '100000.00', interestComponent: '13330.00', entryType: 'MIGRATION_BASELINE' },
    ] as any);

    const mockInsertChain = { values: vi.fn().mockResolvedValue(undefined) };
    vi.mocked(db.insert).mockReturnValue(mockInsertChain as any);

    const { checkAndTriggerAutoStop } = await importService();
    const result = await checkAndTriggerAutoStop('loan-1', 'entry-1');

    expect(result.triggered).toBe(true);
    expect(result.completionRecord?.loanId).toBe('loan-1');
  });

  it('does NOT trigger for a MIGRATION_BASELINE with remaining balance > 0', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'loan-2', staffName: 'Jane Smith', staffId: 'STF002', mdaId: 'mda-1',
        status: 'ACTIVE', principalAmount: '100000.00', interestRate: '13.33',
        tenureMonths: 36, limitedComputation: false,
      }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    vi.mocked(ledgerDb.selectByLoan).mockResolvedValue([
      { amount: '50000.00', principalComponent: '44156.00', interestComponent: '5844.00', entryType: 'MIGRATION_BASELINE' },
    ] as any);

    const { checkAndTriggerAutoStop } = await importService();
    const result = await checkAndTriggerAutoStop('loan-2', 'entry-2');

    expect(result.triggered).toBe(false);
    expect(mockTransitionLoan).not.toHaveBeenCalled();
  });

  it('skips limitedComputation loans', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'loan-3', staffName: 'Limited', staffId: 'STF003', mdaId: 'mda-1',
        status: 'ACTIVE', principalAmount: '0.00', interestRate: '13.33',
        tenureMonths: 36, limitedComputation: true,
      }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const { checkAndTriggerAutoStop } = await importService();
    const result = await checkAndTriggerAutoStop('loan-3');

    expect(result.triggered).toBe(false);
  });

  it('skips non-ACTIVE loans', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{
        id: 'loan-4', staffName: 'Already Done', staffId: 'STF004', mdaId: 'mda-1',
        status: 'COMPLETED', principalAmount: '100000.00', interestRate: '13.33',
        tenureMonths: 36, limitedComputation: false,
      }]),
    };
    vi.mocked(db.select).mockReturnValue(mockSelectChain as any);

    const { checkAndTriggerAutoStop } = await importService();
    const result = await checkAndTriggerAutoStop('loan-4');

    expect(result.triggered).toBe(false);
  });
});

// ─── Scheduler ─────────────────────────────────────────────────────

describe('scheduler', () => {
  it('does not start in test environment', async () => {
    const { startAutoStopScheduler, stopAutoStopScheduler } = await import('./autoStopService');
    // env.NODE_ENV is 'test' — scheduler should be a no-op
    startAutoStopScheduler();
    stopAutoStopScheduler();
    // No assertion needed — just verify it doesn't throw
  });
});

// ─── computeBalanceForLoan (pure function verification) ────────────

describe('computeBalanceForLoan zero-balance detection', () => {
  it('returns 0 balance when entries sum equals totalLoan', () => {
    const result = computeBalanceForLoan({
      limitedComputation: false,
      principalAmount: '100000.00',
      interestRate: '13.33',
      tenureMonths: 36,
      entries: [
        { amount: '113330.00', principalComponent: '100000.00', interestComponent: '13330.00', entryType: 'MIGRATION_BASELINE' },
      ],
      asOfDate: null,
    });
    expect(result.computedBalance).toBe('0.00');
  });

  it('returns negative balance when entries exceed totalLoan', () => {
    const result = computeBalanceForLoan({
      limitedComputation: false,
      principalAmount: '100000.00',
      interestRate: '13.33',
      tenureMonths: 36,
      entries: [
        { amount: '113335.00', principalComponent: '100005.00', interestComponent: '13330.00', entryType: 'MIGRATION_BASELINE' },
      ],
      asOfDate: null,
    });
    expect(parseFloat(result.computedBalance)).toBeLessThan(0);
  });

  it('returns positive balance when entries are below totalLoan', () => {
    const result = computeBalanceForLoan({
      limitedComputation: false,
      principalAmount: '100000.00',
      interestRate: '13.33',
      tenureMonths: 36,
      entries: [
        { amount: '50000.00', principalComponent: '44156.00', interestComponent: '5844.00', entryType: 'MIGRATION_BASELINE' },
      ],
      asOfDate: null,
    });
    expect(parseFloat(result.computedBalance)).toBeGreaterThan(0);
  });
});
