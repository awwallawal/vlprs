import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MdaHealthResult } from './mdaAggregationService';
import { LoanClassification } from './loanClassificationService';

// Mock all dependent services
vi.mock('./loanClassificationService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./loanClassificationService')>();
  return {
    ...actual,
    classifyAllLoans: vi.fn(),
    getLoanCompletionRate: vi.fn(),
  };
});

vi.mock('./mdaAggregationService', () => ({
  getMdaBreakdown: vi.fn(),
}));

vi.mock('./revenueProjectionService', () => ({
  getMonthlyCollectionPotential: vi.fn(),
  getActualMonthlyRecovery: vi.fn(),
  getTotalOutstandingReceivables: vi.fn(),
}));

vi.mock('./submissionCoverageService', () => ({
  getSubmissionCoverage: vi.fn(),
}));

vi.mock('./observationService', () => ({
  getObservationCounts: vi.fn(),
  getObservationCountsByMda: vi.fn(),
}));

vi.mock('./schemeConfigService', () => ({
  getSchemeConfig: vi.fn(),
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

import * as loanClassificationService from './loanClassificationService';
import * as mdaAggregationService from './mdaAggregationService';
import * as revenueProjectionService from './revenueProjectionService';
import * as submissionCoverageService from './submissionCoverageService';
import * as observationService from './observationService';
import * as schemeConfigService from './schemeConfigService';

describe('executiveSummaryReportService', () => {
  const mockClassifications = new Map<string, LoanClassification>([
    ['loan-1', LoanClassification.ON_TRACK],
    ['loan-2', LoanClassification.COMPLETED],
    ['loan-3', LoanClassification.OVERDUE],
    ['loan-4', LoanClassification.STALLED],
    ['loan-5', LoanClassification.OVER_DEDUCTED],
  ]);

  const mockMdaBreakdown: MdaHealthResult[] = [
    {
      mdaId: 'mda-1',
      healthScore: 85,
      healthBand: 'healthy',
      activeLoans: 10,
      totalExposure: '500000.00',
      monthlyRecovery: '25000.00',
      statusDistribution: {
        [LoanClassification.COMPLETED]: 5,
        [LoanClassification.ON_TRACK]: 3,
        [LoanClassification.OVERDUE]: 1,
        [LoanClassification.STALLED]: 1,
        [LoanClassification.OVER_DEDUCTED]: 0,
      },
    },
    {
      mdaId: 'mda-2',
      healthScore: 30,
      healthBand: 'for-review',
      activeLoans: 5,
      totalExposure: '200000.00',
      monthlyRecovery: '5000.00',
      statusDistribution: {
        [LoanClassification.COMPLETED]: 0,
        [LoanClassification.ON_TRACK]: 1,
        [LoanClassification.OVERDUE]: 2,
        [LoanClassification.STALLED]: 2,
        [LoanClassification.OVER_DEDUCTED]: 0,
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(mockClassifications);
    vi.mocked(loanClassificationService.getLoanCompletionRate).mockResolvedValue(40.0);
    vi.mocked(mdaAggregationService.getMdaBreakdown).mockResolvedValue(mockMdaBreakdown);
    vi.mocked(revenueProjectionService.getActualMonthlyRecovery).mockResolvedValue({
      amount: '30000.00',
      periodMonth: 3,
      periodYear: 2026,
    });
    vi.mocked(revenueProjectionService.getTotalOutstandingReceivables).mockResolvedValue('700000.00');
    vi.mocked(submissionCoverageService.getSubmissionCoverage).mockResolvedValue([
      { mdaId: 'mda-1', coveragePercent: 80, isDark: false, stalenessMonths: null, lastSubmissionDate: '2026-03-01' },
      { mdaId: 'mda-2', coveragePercent: null, isDark: true, stalenessMonths: 6, lastSubmissionDate: null },
    ]);
    vi.mocked(observationService.getObservationCounts).mockResolvedValue({
      total: 25,
      byType: {
        rate_variance: 5, stalled_balance: 3, negative_balance: 2, multi_mda: 1,
        no_approval_match: 4, consecutive_loan: 2, period_overlap: 1,
        grade_tier_mismatch: 3, three_way_variance: 2, manual_exception: 1, inactive_loan: 1,
      },
      byStatus: { unreviewed: 10, reviewed: 5, resolved: 8, promoted: 2 },
    });
    vi.mocked(observationService.getObservationCountsByMda).mockResolvedValue(
      new Map([['mda-1', 12], ['mda-2', 13]]),
    );
    vi.mocked(schemeConfigService.getSchemeConfig).mockResolvedValue('5000000.00');

    // db mock returns empty arrays by default via createDbChain()
  });

  it('generates report with all required sections', async () => {
    const { generateExecutiveSummaryReport } = await import('./executiveSummaryReportService');

    const report = await generateExecutiveSummaryReport(null);

    expect(report).toBeDefined();
    expect(report.schemeOverview).toBeDefined();
    expect(report.portfolioStatus).toBeDefined();
    expect(report.mdaScorecard).toBeDefined();
    expect(report.receivablesRanking).toBeDefined();
    expect(report.recoveryPotential).toBeDefined();
    expect(report.submissionCoverage).toBeDefined();
    expect(report.onboardingPipeline).toBeDefined();
    expect(report.exceptionSummary).toBeDefined();
    expect(report.topVariances).toBeDefined();
    expect(report.monthOverMonthTrend).toBeDefined();
    expect(report.generatedAt).toBeDefined();
  });

  it('computes portfolio status with non-punitive labels', async () => {
    const { generateExecutiveSummaryReport } = await import('./executiveSummaryReportService');

    const report = await generateExecutiveSummaryReport(null);

    expect(report.portfolioStatus).toHaveLength(5);
    const labels = report.portfolioStatus.map(p => p.classification);
    expect(labels).toContain('Completed');
    expect(labels).toContain('On Track');
    expect(labels).toContain('Past Expected Completion');
    expect(labels).toContain('Balance Unchanged');
    expect(labels).toContain('Balance Below Zero');

    // Verify percentages sum to ~100%
    const totalPct = report.portfolioStatus.reduce((sum, p) => sum + p.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });

  it('computes exception summary correctly', async () => {
    const { generateExecutiveSummaryReport } = await import('./executiveSummaryReportService');

    const report = await generateExecutiveSummaryReport(null);

    // Open = unreviewed(10) + reviewed(5) = 15
    expect(report.exceptionSummary.openCount).toBe(15);
    // Resolved = resolved(8) + promoted(2) = 10
    expect(report.exceptionSummary.resolvedCount).toBe(10);
    expect(report.exceptionSummary.totalCount).toBe(25);
  });

  it('includes scheme overview with fund available', async () => {
    const { generateExecutiveSummaryReport } = await import('./executiveSummaryReportService');

    const report = await generateExecutiveSummaryReport(null);

    expect(report.schemeOverview.fundAvailable).toBe('5000000.00');
    expect(report.schemeOverview.totalExposure).toBe('700000.00');
    expect(report.schemeOverview.monthlyRecoveryRate).toBe('30000.00');
    expect(report.schemeOverview.recoveryPeriod).toBe('2026-03');
  });

  it('computes submission coverage counts', async () => {
    const { generateExecutiveSummaryReport } = await import('./executiveSummaryReportService');

    const report = await generateExecutiveSummaryReport(null);

    expect(report.submissionCoverage.activeMdas).toBe(1);
    expect(report.submissionCoverage.darkMdas).toBe(1);
    expect(report.submissionCoverage.totalMdas).toBe(2);
  });

  it('returns empty recovery tiers when no at-risk loans', async () => {
    vi.mocked(loanClassificationService.classifyAllLoans).mockResolvedValue(
      new Map([['loan-1', LoanClassification.COMPLETED]]),
    );

    const { generateExecutiveSummaryReport } = await import('./executiveSummaryReportService');

    const report = await generateExecutiveSummaryReport(null);

    expect(report.recoveryPotential).toHaveLength(3);
    for (const tier of report.recoveryPotential) {
      expect(tier.loanCount).toBe(0);
      expect(tier.totalAmount).toBe('0.00');
    }
  });
});
