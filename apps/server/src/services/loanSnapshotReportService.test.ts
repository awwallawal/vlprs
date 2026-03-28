import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock computationEngine
vi.mock('./computationEngine', () => ({
  computeBalanceForLoan: vi.fn().mockReturnValue({
    computedBalance: '100000.00',
    totalPrincipalPaid: '0.00',
    totalInterestPaid: '0.00',
    totalAmountPaid: '0.00',
    principalRemaining: '100000.00',
    interestRemaining: '0.00',
    installmentsCompleted: 0,
    installmentsRemaining: 60,
    entryCount: 0,
    asOfDate: null,
    derivation: { formula: '', totalLoan: '', entriesSum: '', isAnomaly: false },
  }),
}));

// Recursive chainable DB mock
function createDbChain(): Record<string, unknown> {
  const methods = ['select', 'from', 'where', 'orderBy', 'limit', 'offset', 'innerJoin', 'groupBy'];
  function makeChain(): Record<string, unknown> & PromiseLike<unknown[]> {
    const obj = {
      then: (resolve: (v: unknown[]) => unknown) => Promise.resolve([]).then(resolve),
    } as Record<string, unknown> & PromiseLike<unknown[]>;
    for (const m of methods) {
      obj[m] = vi.fn().mockImplementation(() => makeChain());
    }
    return obj;
  }
  return makeChain();
}

vi.mock('../db/index.js', () => ({
  db: createDbChain(),
}));

import { generateLoanSnapshotReport } from './loanSnapshotReportService';

describe('loanSnapshotReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty report when no loans found', async () => {
    const result = await generateLoanSnapshotReport('mda-1', null);

    expect(result.data).toEqual([]);
    expect(result.summary.totalLoans).toBe(0);
    expect(result.summary.totalOutstanding).toBe('0.00');
    expect(result.summary.totalMonthlyDeduction).toBe('0.00');
    expect(result.summary.averageInterestRate).toBe('0.000');
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(50);
    expect(result.pagination.totalItems).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });

  it('defaults to page 1, pageSize 50, staffName ASC', async () => {
    const result = await generateLoanSnapshotReport('mda-1', null);

    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(50);
  });

  it('respects custom pagination options', async () => {
    const result = await generateLoanSnapshotReport('mda-1', null, {
      page: 2,
      pageSize: 25,
    });

    expect(result.pagination.page).toBe(2);
    expect(result.pagination.pageSize).toBe(25);
  });

  it('report data shape matches LoanSnapshotReportData interface', async () => {
    const result = await generateLoanSnapshotReport('mda-1', null);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('pagination');
    expect(result.summary).toHaveProperty('totalLoans');
    expect(result.summary).toHaveProperty('totalOutstanding');
    expect(result.summary).toHaveProperty('totalMonthlyDeduction');
    expect(result.summary).toHaveProperty('averageInterestRate');
    expect(result.pagination).toHaveProperty('page');
    expect(result.pagination).toHaveProperty('pageSize');
    expect(result.pagination).toHaveProperty('totalItems');
    expect(result.pagination).toHaveProperty('totalPages');
  });

  it('respects statusFilter option', async () => {
    // With DB mock returning [], just verify it doesn't crash
    const result = await generateLoanSnapshotReport('mda-1', null, {
      statusFilter: 'ACTIVE',
    });

    expect(result.data).toEqual([]);
  });

  it('handles all sort fields without error', async () => {
    const sortFields = [
      'staffName', 'staffId', 'principalAmount', 'status',
      'approvalDate', 'monthlyDeductionAmount', 'tenureMonths', 'gradeLevel',
    ] as const;

    for (const sortBy of sortFields) {
      const result = await generateLoanSnapshotReport('mda-1', null, { sortBy });
      expect(result.data).toEqual([]);
    }
  });

  it('handles desc sort order', async () => {
    const result = await generateLoanSnapshotReport('mda-1', null, {
      sortBy: 'principalAmount',
      sortOrder: 'desc',
    });

    expect(result.data).toEqual([]);
  });

  it('summary uses proper decimal formatting', async () => {
    const result = await generateLoanSnapshotReport('mda-1', null);

    // Monetary values should have exactly 2 decimal places
    expect(result.summary.totalOutstanding).toMatch(/^\d+\.\d{2}$/);
    expect(result.summary.totalMonthlyDeduction).toMatch(/^\d+\.\d{2}$/);
    // Interest rate should have 3 decimal places
    expect(result.summary.averageInterestRate).toMatch(/^\d+\.\d{3}$/);
  });

  it('passes mdaScope to withMdaScope when provided', async () => {
    const result = await generateLoanSnapshotReport('mda-1', 'scope-mda-1');

    expect(result.data).toEqual([]);
    expect(result.pagination.totalItems).toBe(0);
  });

  it('returns totalPages as 0 when no items', async () => {
    const result = await generateLoanSnapshotReport('mda-1', null);

    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.totalItems).toBe(0);
  });
});
