import { describe, it, expect } from 'vitest';
import type {
  ExecutiveSummaryReportData,
  MdaComplianceReportData,
  VarianceReportData,
  LoanSnapshotReportData,
  WeeklyAgReportData,
  PdfReportMeta,
} from '@vlprs/shared';
import { generateReferenceNumber, formatNaira } from './reportPdfComponents';

// ─── Helpers ────────────────────────────────────────────────────

const baseMeta: PdfReportMeta = {
  referenceNumber: 'VLPRS-TEST-2026-ABCD1234',
  generatedAt: '2026-03-28T12:00:00.000Z',
  generatedBy: 'test@vlprs.gov.ng',
  reportTitle: 'Test Report',
  reportSubtitle: 'Test Period',
};

// ─── Reference Number ───────────────────────────────────────────

describe('generateReferenceNumber', () => {
  it('returns a reference number with the default prefix', () => {
    const ref = generateReferenceNumber();
    expect(ref).toMatch(/^VLPRS-RPT-\d{4}-[A-Z0-9]{8}$/);
  });

  it('returns a reference number with a custom prefix', () => {
    const ref = generateReferenceNumber('ES');
    expect(ref).toMatch(/^VLPRS-ES-\d{4}-[A-Z0-9]{8}$/);
  });

  it('generates unique reference numbers', () => {
    const refs = new Set(Array.from({ length: 100 }, () => generateReferenceNumber()));
    expect(refs.size).toBe(100);
  });
});

// ─── formatNaira ────────────────────────────────────────────────

describe('formatNaira', () => {
  it('formats positive numbers', () => {
    expect(formatNaira('1234567.89')).toBe('\u20A61,234,567.89');
  });

  it('formats negative numbers', () => {
    expect(formatNaira('-500.50')).toBe('-\u20A6500.50');
  });

  it('formats zero', () => {
    expect(formatNaira('0')).toBe('\u20A60.00');
  });

  it('returns input for invalid values', () => {
    expect(formatNaira('N/A')).toBe('N/A');
  });
});

// ─── Executive Summary PDF ──────────────────────────────────────

describe('generateExecutiveSummaryPdf', () => {
  it('returns a non-zero-length Buffer', async () => {
    const { generateExecutiveSummaryPdf } = await import('./executiveSummaryPdf');
    const data: ExecutiveSummaryReportData = {
      schemeOverview: { activeLoans: 100, totalExposure: '50000000', fundAvailable: '10000000', monthlyRecoveryRate: '2000000', recoveryPeriod: '25 months' },
      portfolioStatus: [{ classification: 'Active', count: 80, percentage: 80 }],
      mdaScorecard: {
        topHealthy: [{ mdaId: '1', mdaName: 'Education', mdaCode: 'EDU', healthScore: 85, healthBand: 'healthy', totalOutstanding: '5000000', observationCount: 2 }],
        bottomForReview: [],
      },
      receivablesRanking: [{ mdaId: '1', mdaName: 'Education', mdaCode: 'EDU', totalOutstanding: '5000000', activeLoans: 50 }],
      recoveryPotential: [{ tierName: 'Quick Recovery', loanCount: 10, totalAmount: '1000000', monthlyProjection: '100000' }],
      submissionCoverage: { activeMdas: 10, spottyMdas: 3, darkMdas: 2, totalMdas: 15 },
      onboardingPipeline: { approvedNotCollectingCount: 5, revenueAtRisk: '500000' },
      exceptionSummary: { openCount: 3, resolvedCount: 7, totalCount: 10 },
      topVariances: [],
      monthOverMonthTrend: {
        activeLoans: { current: 100, previous: 95, changePercent: 5.3 },
        totalExposure: { current: 50000000, previous: 48000000, changePercent: 4.2 },
        monthlyRecovery: { current: 2000000, previous: 1900000, changePercent: 5.3 },
        completionRate: { current: 8, previous: 6, changePercent: 33.3 },
      },
      generatedAt: '2026-03-28T12:00:00.000Z',
    };
    const buffer = await generateExecutiveSummaryPdf(data, baseMeta);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// ─── MDA Compliance PDF ─────────────────────────────────────────

describe('generateMdaCompliancePdf', () => {
  it('returns a non-zero-length Buffer', async () => {
    const { generateMdaCompliancePdf } = await import('./mdaCompliancePdf');
    const data: MdaComplianceReportData = {
      rows: [{
        mdaId: '1', mdaName: 'Education', mdaCode: 'EDU', submissionStatus: 'Submitted',
        lastSubmissionDate: '2026-03-15', recordCount: 50, compliancePercent: 85,
        healthScore: 80, healthBand: 'healthy', coveragePercent: 90,
        totalOutstanding: '5000000', unresolvedObservationCount: 1,
      }],
      summary: { totalMdas: 1, averageHealthScore: 80, totalOutstanding: '5000000', totalObservations: 1 },
      periodYear: 2026, periodMonth: 3, generatedAt: '2026-03-28T12:00:00.000Z',
    };
    const buffer = await generateMdaCompliancePdf(data, baseMeta);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// ─── Variance PDF ───────────────────────────────────────────────

describe('generateVariancePdf', () => {
  it('returns a non-zero-length Buffer', async () => {
    const { generateVariancePdf } = await import('./variancePdf');
    const data: VarianceReportData = {
      summary: { alignedCount: 40, minorVarianceCount: 5, varianceCount: 5, totalRecords: 50 },
      rows: [{
        staffId: 'S001', staffName: 'John Doe', declaredAmount: '50000', computedAmount: '48000',
        difference: '2000', category: 'minor_variance', explanation: 'Rounding difference',
      }],
      overdueRegister: [{ staffName: 'Jane Smith', staffId: 'S002', loanId: 'L001', monthsPastExpected: 3, outstandingBalance: '25000', severityTier: 'Mild' }],
      stalledRegister: [],
      overDeductedRegister: [],
      generatedAt: '2026-03-28T12:00:00.000Z',
    };
    const buffer = await generateVariancePdf(data, baseMeta);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// ─── Loan Snapshot PDF ──────────────────────────────────────────

describe('generateLoanSnapshotPdf', () => {
  it('returns a non-zero-length Buffer (landscape)', async () => {
    const { generateLoanSnapshotPdf } = await import('./loanSnapshotPdf');
    const data: LoanSnapshotReportData = {
      data: [{
        staffId: 'S001', staffName: 'John Doe', gradeLevel: 'GL10', principalAmount: '500000',
        interestRate: '13.33', tenureMonths: 60, moratoriumMonths: 0, monthlyDeductionAmount: '11110',
        installmentsPaid: 24, outstandingBalance: '233340', status: 'ACTIVE',
        lastDeductionDate: '2026-03-01', nextDeductionDate: '2026-04-01',
        approvalDate: '2024-03-15', loanReference: 'LR-001', mdaCode: 'EDU',
      }],
      summary: { totalLoans: 1, totalOutstanding: '233340', totalMonthlyDeduction: '11110', averageInterestRate: '13.33' },
      pagination: { page: 1, pageSize: 50, totalItems: 1, totalPages: 1 },
    };
    const buffer = await generateLoanSnapshotPdf(data, baseMeta);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// ─── Weekly AG PDF ──────────────────────────────────────────────

describe('generateWeeklyAgPdf', () => {
  it('returns a non-zero-length Buffer', async () => {
    const { generateWeeklyAgPdf } = await import('./weeklyAgPdf');
    const data: WeeklyAgReportData = {
      generatedAt: '2026-03-28T12:00:00.000Z',
      periodStart: '2026-03-21',
      periodEnd: '2026-03-28',
      executiveSummary: { activeLoans: 100, totalExposure: '50000000', fundAvailable: '10000000', monthlyRecoveryRate: '2000000' },
      complianceStatus: {
        submissionsThisWeek: [{ mdaName: 'Education', mdaCode: 'EDU', submissionDate: '2026-03-25', recordCount: 30, status: 'confirmed' }],
        totalSubmissions: 1,
      },
      exceptionsResolved: [],
      outstandingAttentionItems: [],
      quickRecoveryOpportunities: [],
      observationActivity: { newCount: 2, reviewedCount: 1, resolvedCount: 3 },
      portfolioSnapshot: [{ classification: 'Active', count: 80, percentage: 80 }],
    };
    const buffer = await generateWeeklyAgPdf(data, baseMeta);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
