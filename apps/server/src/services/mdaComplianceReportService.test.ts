import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoanClassification } from './loanClassificationService';
import type { MdaHealthResult } from './mdaAggregationService';

// Mock all dependent services
vi.mock('./mdaAggregationService', () => ({
  getMdaBreakdown: vi.fn(),
}));

vi.mock('./submissionCoverageService', () => ({
  getSubmissionCoverage: vi.fn(),
}));

vi.mock('./observationService', () => ({
  getObservationCountsByMda: vi.fn(),
}));

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}));

import { db } from '../db/index.js';
import * as mdaAggregationService from './mdaAggregationService';
import * as submissionCoverageService from './submissionCoverageService';
import * as observationService from './observationService';

describe('mdaComplianceReportService', () => {
  const mockMdas = [
    { id: 'mda-1', name: 'Ministry of Agriculture', code: 'AGR' },
    { id: 'mda-2', name: 'Ministry of Education', code: 'EDU' },
  ];

  const mockHealthResults: MdaHealthResult[] = [
    {
      mdaId: 'mda-1',
      healthScore: 75,
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
      healthScore: 35,
      healthBand: 'for-review',
      activeLoans: 3,
      totalExposure: '120000.00',
      monthlyRecovery: '5000.00',
      statusDistribution: {
        [LoanClassification.COMPLETED]: 0,
        [LoanClassification.ON_TRACK]: 1,
        [LoanClassification.OVERDUE]: 1,
        [LoanClassification.STALLED]: 1,
        [LoanClassification.OVER_DEDUCTED]: 0,
      },
    },
  ];

  const mockSubmissions = [
    { mdaId: 'mda-1', createdAt: new Date('2026-03-15'), recordCount: 20, alignedCount: 18 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(mdaAggregationService.getMdaBreakdown).mockResolvedValue(mockHealthResults);
    vi.mocked(submissionCoverageService.getSubmissionCoverage).mockResolvedValue([
      { mdaId: 'mda-1', coveragePercent: 80, isDark: false, stalenessMonths: null, lastSubmissionDate: '2026-03-01' },
      { mdaId: 'mda-2', coveragePercent: null, isDark: true, stalenessMonths: 6, lastSubmissionDate: null },
    ]);
    vi.mocked(observationService.getObservationCountsByMda).mockResolvedValue(
      new Map([['mda-1', 5], ['mda-2', 12]]),
    );

    // Mock db.select chain for fetchMdas
    const mockSelectChain = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };

    // First call: fetchMdas (returns MDA list)
    // Second call: fetchSubmissionDataByMda (returns submission data)
    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      const chain = { ...mockSelectChain };
      // fetchMdas returns MDA list, fetchSubmissions returns submission data
      if (callCount <= 1) {
        chain.where = vi.fn().mockResolvedValue(mockMdas);
      } else {
        chain.where = vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(mockSubmissions),
        });
      }
      return chain as unknown as ReturnType<typeof db.select>;
    });
  });

  it('generates compliance report with all MDAs', async () => {
    const { generateMdaComplianceReport } = await import('./mdaComplianceReportService');

    const report = await generateMdaComplianceReport({
      periodYear: 2026,
      periodMonth: 3,
      mdaScope: null,
    });

    expect(report).toBeDefined();
    expect(report.rows).toHaveLength(2);
    expect(report.periodYear).toBe(2026);
    expect(report.periodMonth).toBe(3);
    expect(report.generatedAt).toBeDefined();
  });

  it('includes correct health badges', async () => {
    const { generateMdaComplianceReport } = await import('./mdaComplianceReportService');

    const report = await generateMdaComplianceReport({
      periodYear: 2026,
      periodMonth: 3,
      mdaScope: null,
    });

    const agr = report.rows.find(r => r.mdaCode === 'AGR');
    const edu = report.rows.find(r => r.mdaCode === 'EDU');

    expect(agr?.healthBand).toBe('healthy');
    expect(agr?.healthScore).toBe(75);
    expect(edu?.healthBand).toBe('for-review');
    expect(edu?.healthScore).toBe(35);
  });

  it('computes summary totals correctly', async () => {
    const { generateMdaComplianceReport } = await import('./mdaComplianceReportService');

    const report = await generateMdaComplianceReport({
      periodYear: 2026,
      periodMonth: 3,
      mdaScope: null,
    });

    expect(report.summary.totalMdas).toBe(2);
    expect(report.summary.averageHealthScore).toBeCloseTo(55, 0);
    expect(report.summary.totalOutstanding).toBe('620000.00');
    expect(report.summary.totalObservations).toBe(17);
  });

  it('shows submission status per MDA', async () => {
    const { generateMdaComplianceReport } = await import('./mdaComplianceReportService');

    const report = await generateMdaComplianceReport({
      periodYear: 2026,
      periodMonth: 3,
      mdaScope: null,
    });

    const agr = report.rows.find(r => r.mdaCode === 'AGR');
    const edu = report.rows.find(r => r.mdaCode === 'EDU');

    expect(agr?.submissionStatus).toBe('Submitted');
    expect(agr?.recordCount).toBe(20);
    expect(edu?.submissionStatus).toBe('Pending');
    expect(edu?.recordCount).toBe(0);
  });

  it('includes observation counts per MDA', async () => {
    const { generateMdaComplianceReport } = await import('./mdaComplianceReportService');

    const report = await generateMdaComplianceReport({
      periodYear: 2026,
      periodMonth: 3,
      mdaScope: null,
    });

    const agr = report.rows.find(r => r.mdaCode === 'AGR');
    const edu = report.rows.find(r => r.mdaCode === 'EDU');

    expect(agr?.unresolvedObservationCount).toBe(5);
    expect(edu?.unresolvedObservationCount).toBe(12);
  });
});
