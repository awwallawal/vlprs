import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoanClassification } from './loanClassificationService';

// Mock all dependent services
vi.mock('./loanClassificationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./loanClassificationService')>();
  return {
    ...actual,
    classifyAllLoans: vi.fn(),
  };
});

vi.mock('./revenueProjectionService', () => ({
  getActualMonthlyRecovery: vi.fn(),
  getTotalOutstandingReceivables: vi.fn(),
}));

vi.mock('./schemeConfigService', () => ({
  getSchemeConfig: vi.fn(),
}));

vi.mock('./attentionItemService', () => ({
  getAttentionItems: vi.fn(),
}));

// Recursive chainable mock: every method returns a new chain that is also a thenable (resolves to [])
function createDbChain(): Record<string, unknown> {
  const methods = ['select', 'from', 'where', 'orderBy', 'limit', 'innerJoin', 'groupBy'];
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

vi.mock('./computationEngine', () => ({
  computeBalanceForLoan: vi.fn().mockReturnValue({
    computedBalance: '5000.00',
    totalPrincipalPaid: '0',
    totalInterestPaid: '0',
    totalAmountPaid: '0',
    principalRemaining: '5000.00',
    interestRemaining: '0',
    installmentsCompleted: 0,
    installmentsRemaining: 60,
    entryCount: 0,
    asOfDate: null,
    derivation: { formula: '', totalLoan: '', entriesSum: '', isAnomaly: false },
  }),
}));

import * as loanClassificationService from './loanClassificationService';
import * as revenueProjectionService from './revenueProjectionService';
import * as schemeConfigService from './schemeConfigService';
import * as attentionItemService from './attentionItemService';

describe('weeklyAgReportService', () => {
  const mockClassifications = new Map<string, LoanClassification>([
    ['loan-1', LoanClassification.ON_TRACK],
    ['loan-2', LoanClassification.COMPLETED],
    ['loan-3', LoanClassification.OVERDUE],
    ['loan-4', LoanClassification.STALLED],
    ['loan-5', LoanClassification.OVER_DEDUCTED],
  ]);

  const mockAttentionItems = [
    {
      id: 'att-1',
      type: 'overdue_loans' as const,
      description: '3 loans past expected completion',
      mdaName: 'Scheme-wide',
      category: 'review' as const,
      priority: 10,
      count: 3,
      timestamp: '2026-03-28T00:00:00.000Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(mockClassifications);
    vi.mocked(revenueProjectionService.getActualMonthlyRecovery).mockResolvedValue({
      amount: '30000.00',
      periodMonth: 3,
      periodYear: 2026,
    });
    vi.mocked(revenueProjectionService.getTotalOutstandingReceivables).mockResolvedValue('700000.00');
    vi.mocked(schemeConfigService.getSchemeConfig).mockResolvedValue('5000000.00');
    vi.mocked(attentionItemService.getAttentionItems).mockResolvedValue(mockAttentionItems);
  });

  it('generates report with all 7 required sections', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    expect(report).toBeDefined();
    expect(report.generatedAt).toBeDefined();
    expect(report.periodStart).toBeDefined();
    expect(report.periodEnd).toBeDefined();
    expect(report.executiveSummary).toBeDefined();
    expect(report.complianceStatus).toBeDefined();
    expect(report.exceptionsResolved).toBeDefined();
    expect(report.outstandingAttentionItems).toBeDefined();
    expect(report.quickRecoveryOpportunities).toBeDefined();
    expect(report.observationActivity).toBeDefined();
    expect(report.portfolioSnapshot).toBeDefined();
  });

  it('computes 7-day period window correctly', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');
    const asOfDate = new Date('2026-03-28');

    const report = await generateWeeklyAgReport(null, asOfDate);

    expect(report.periodEnd).toBe('2026-03-28');
    expect(report.periodStart).toBe('2026-03-21');
  });

  it('shifts window correctly for custom asOfDate', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');
    const asOfDate = new Date('2026-01-15');

    const report = await generateWeeklyAgReport(null, asOfDate);

    expect(report.periodEnd).toBe('2026-01-15');
    expect(report.periodStart).toBe('2026-01-08');
  });

  it('computes executive summary with correct active loan count', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    // Active = ON_TRACK(1) + OVERDUE(1) + STALLED(1) = 3
    expect(report.executiveSummary.activeLoans).toBe(3);
    expect(report.executiveSummary.totalExposure).toBe('700000.00');
    expect(report.executiveSummary.fundAvailable).toBe('5000000.00');
    expect(report.executiveSummary.monthlyRecoveryRate).toBe('30000.00');
  });

  it('returns empty compliance status when no submissions in window', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    // db mock returns empty arrays → no submissions
    expect(report.complianceStatus.submissionsThisWeek).toEqual([]);
    expect(report.complianceStatus.totalSubmissions).toBe(0);
  });

  it('returns empty exceptions resolved when none in window', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    expect(report.exceptionsResolved).toEqual([]);
  });

  it('passes attention items through from attentionItemService', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    expect(report.outstandingAttentionItems).toEqual(mockAttentionItems);
    expect(attentionItemService.getAttentionItems).toHaveBeenCalledWith(null);
  });

  it('returns empty quick recovery when no active loans', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    // db mock returns empty loan array → no quick recovery
    expect(report.quickRecoveryOpportunities).toEqual([]);
  });

  it('returns observation activity counts (zeros when none in window)', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    expect(report.observationActivity).toEqual({
      newCount: 0,
      reviewedCount: 0,
      resolvedCount: 0,
    });
  });

  it('generates portfolio snapshot with non-punitive labels', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    expect(report.portfolioSnapshot).toHaveLength(5);
    const labels = report.portfolioSnapshot.map(p => p.classification);
    expect(labels).toContain('Completed');
    expect(labels).toContain('On Track');
    expect(labels).toContain('Past Expected Completion');
    expect(labels).toContain('Balance Unchanged');
    expect(labels).toContain('Balance Below Zero');
  });

  it('portfolio snapshot percentages sum to approximately 100%', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    const totalPct = report.portfolioSnapshot.reduce((sum, p) => sum + p.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });

  it('portfolio snapshot counts match classification map', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    const report = await generateWeeklyAgReport(null);

    const totalCount = report.portfolioSnapshot.reduce((sum, p) => sum + p.count, 0);
    expect(totalCount).toBe(mockClassifications.size);
  });

  it('passes mdaScope to all dependent services', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    await generateWeeklyAgReport('mda-123');

    expect(loanClassificationService.classifyAllLoans).toHaveBeenCalledWith('mda-123');
    expect(revenueProjectionService.getTotalOutstandingReceivables).toHaveBeenCalledWith('mda-123', mockClassifications);
    expect(revenueProjectionService.getActualMonthlyRecovery).toHaveBeenCalledWith('mda-123');
    expect(attentionItemService.getAttentionItems).toHaveBeenCalledWith('mda-123');
  });

  it('calls classifyAllLoans exactly once (pre-fetched, not per-section)', async () => {
    const { generateWeeklyAgReport } = await import('./weeklyAgReportService');

    await generateWeeklyAgReport(null);

    expect(loanClassificationService.classifyAllLoans).toHaveBeenCalledTimes(1);
  });
});
