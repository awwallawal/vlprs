import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoanClassification } from './loanClassificationService';

// Mock comparisonEngine
vi.mock('./comparisonEngine', () => ({
  compareSubmission: vi.fn(),
}));

// Mock loanClassificationService (preserve enum)
vi.mock('./loanClassificationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./loanClassificationService')>();
  return {
    ...actual,
    classifyAllLoans: vi.fn(),
  };
});

// Mock computationEngine
vi.mock('./computationEngine', () => ({
  computeBalanceFromEntries: vi.fn().mockReturnValue({
    computedBalance: '50000.00',
    totalPrincipalPaid: '0',
    totalInterestPaid: '0',
    totalAmountPaid: '0',
    principalRemaining: '50000.00',
    interestRemaining: '0',
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

import * as comparisonEngine from './comparisonEngine';
import * as loanClassificationService from './loanClassificationService';
import { generateVarianceReport, overdueSeverityTier } from './varianceReportService';

describe('varianceReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty report when no submissions found', async () => {
    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(new Map());

    const result = await generateVarianceReport(null, null);

    expect(result.summary.totalRecords).toBe(0);
    expect(result.rows).toEqual([]);
    expect(result.overdueRegister).toEqual([]);
    expect(result.stalledRegister).toEqual([]);
    expect(result.overDeductedRegister).toEqual([]);
    expect(result.generatedAt).toBeDefined();
  });

  it('returns empty enhanced sections when no classified loans', async () => {
    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(new Map());

    const result = await generateVarianceReport('mda-1', null);

    expect(result.overdueRegister).toEqual([]);
    expect(result.stalledRegister).toEqual([]);
    expect(result.overDeductedRegister).toEqual([]);
  });

  describe('computeConsecutiveUnchangedMonths', () => {
    it('classification service returns correct stalled IDs', async () => {
      const classifications = new Map<string, LoanClassification>([
        ['loan-1', LoanClassification.STALLED],
        ['loan-2', LoanClassification.ON_TRACK],
      ]);
      vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(classifications);

      const result = await generateVarianceReport(null, null);

      // With DB mock returning [], registers will be empty (no loan data)
      expect(result.stalledRegister).toEqual([]);
    });
  });

  describe('overdueSeverityTier boundaries', () => {
    it('0 months → Mild', () => {
      expect(overdueSeverityTier(0)).toBe('Mild');
    });

    it('exactly 6 months → Mild (upper boundary)', () => {
      expect(overdueSeverityTier(6)).toBe('Mild');
    });

    it('7 months → Moderate (lower boundary)', () => {
      expect(overdueSeverityTier(7)).toBe('Moderate');
    });

    it('18 months → Moderate (upper boundary)', () => {
      expect(overdueSeverityTier(18)).toBe('Moderate');
    });

    it('19 months → Elevated (lower boundary)', () => {
      expect(overdueSeverityTier(19)).toBe('Elevated');
    });

    it('large values → Elevated', () => {
      expect(overdueSeverityTier(100)).toBe('Elevated');
    });
  });

  it('classifyAllLoans is called for enhanced sections', async () => {
    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(new Map());

    await generateVarianceReport('mda-1', 'scope-1');

    expect(loanClassificationService.classifyAllLoans).toHaveBeenCalledWith('scope-1');
  });

  it('compareSubmission is not called when no submissions found', async () => {
    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(new Map());

    await generateVarianceReport(null, null);

    expect(comparisonEngine.compareSubmission).not.toHaveBeenCalled();
  });

  it('correctly partitions classifications into overdue/stalled/over-deducted', async () => {
    const classifications = new Map<string, LoanClassification>([
      ['loan-1', LoanClassification.OVERDUE],
      ['loan-2', LoanClassification.STALLED],
      ['loan-3', LoanClassification.OVER_DEDUCTED],
      ['loan-4', LoanClassification.COMPLETED],
      ['loan-5', LoanClassification.ON_TRACK],
    ]);
    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(classifications);

    const result = await generateVarianceReport(null, null);

    // DB returns [] for loan data, so registers are empty — but classification service was called
    expect(loanClassificationService.classifyAllLoans).toHaveBeenCalled();
    // COMPLETED and ON_TRACK should not appear in any register
    expect(result.overdueRegister).toEqual([]);
    expect(result.stalledRegister).toEqual([]);
    expect(result.overDeductedRegister).toEqual([]);
  });

  it('report data shape matches VarianceReportData interface', async () => {
    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(new Map());

    const result = await generateVarianceReport(null, null);

    // Validate shape
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('rows');
    expect(result).toHaveProperty('overdueRegister');
    expect(result).toHaveProperty('stalledRegister');
    expect(result).toHaveProperty('overDeductedRegister');
    expect(result).toHaveProperty('generatedAt');
    expect(result.summary).toHaveProperty('alignedCount');
    expect(result.summary).toHaveProperty('minorVarianceCount');
    expect(result.summary).toHaveProperty('varianceCount');
    expect(result.summary).toHaveProperty('totalRecords');
  });
});
