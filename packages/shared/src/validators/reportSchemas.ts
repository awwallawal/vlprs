import { z } from 'zod/v4';

export const serviceStatusVerificationQuerySchema = z.object({
  mdaId: z.uuid().optional(),
  asOfDate: z.iso.date('asOfDate must be a valid ISO date (YYYY-MM-DD)').optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
});

// ─── Executive Summary Report (Story 6.1) ───────────────────────

export const executiveSummaryQuerySchema = z.object({});

// ─── MDA Compliance Report (Story 6.1) ──────────────────────────

export const mdaComplianceQuerySchema = z.object({
  mdaId: z.uuid().optional(),
  periodYear: z.coerce.number().int().min(2020).max(2100).optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
});

// ─── Response Schemas (for validateResponse middleware) ──────────

const trendMetricSchema = z.object({
  current: z.number(),
  previous: z.number(),
  changePercent: z.number(),
});

export const executiveSummaryReportSchema = z.object({
  schemeOverview: z.object({
    activeLoans: z.number(),
    totalExposure: z.string(),
    fundAvailable: z.string().nullable(),
    monthlyRecoveryRate: z.string(),
    recoveryPeriod: z.string(),
  }),
  portfolioStatus: z.array(z.object({
    classification: z.string(),
    count: z.number(),
    percentage: z.number(),
  })),
  mdaScorecard: z.object({
    topHealthy: z.array(z.object({
      mdaId: z.string(),
      mdaName: z.string(),
      mdaCode: z.string(),
      healthScore: z.number(),
      healthBand: z.enum(['healthy', 'attention', 'for-review']),
      totalOutstanding: z.string(),
      observationCount: z.number(),
    })),
    bottomForReview: z.array(z.object({
      mdaId: z.string(),
      mdaName: z.string(),
      mdaCode: z.string(),
      healthScore: z.number(),
      healthBand: z.enum(['healthy', 'attention', 'for-review']),
      totalOutstanding: z.string(),
      observationCount: z.number(),
    })),
  }),
  receivablesRanking: z.array(z.object({
    mdaId: z.string(),
    mdaName: z.string(),
    mdaCode: z.string(),
    totalOutstanding: z.string(),
    activeLoans: z.number(),
  })),
  recoveryPotential: z.array(z.object({
    tierName: z.string(),
    loanCount: z.number(),
    totalAmount: z.string(),
    monthlyProjection: z.string(),
  })),
  submissionCoverage: z.object({
    activeMdas: z.number(),
    spottyMdas: z.number(),
    darkMdas: z.number(),
    totalMdas: z.number(),
  }),
  onboardingPipeline: z.object({
    approvedNotCollectingCount: z.number(),
    revenueAtRisk: z.string(),
  }),
  exceptionSummary: z.object({
    openCount: z.number(),
    resolvedCount: z.number(),
    totalCount: z.number(),
  }),
  topVariances: z.array(z.object({
    staffName: z.string(),
    mdaName: z.string(),
    declaredAmount: z.string(),
    computedAmount: z.string(),
    difference: z.string(),
  })),
  monthOverMonthTrend: z.object({
    activeLoans: trendMetricSchema,
    totalExposure: trendMetricSchema,
    monthlyRecovery: trendMetricSchema,
    completionRate: trendMetricSchema,
  }),
  generatedAt: z.string(),
});

export const mdaComplianceReportSchema = z.object({
  rows: z.array(z.object({
    mdaId: z.string(),
    mdaName: z.string(),
    mdaCode: z.string(),
    submissionStatus: z.string(),
    lastSubmissionDate: z.string().nullable(),
    recordCount: z.number(),
    compliancePercent: z.number(),
    healthScore: z.number(),
    healthBand: z.enum(['healthy', 'attention', 'for-review']),
    coveragePercent: z.number().nullable(),
    totalOutstanding: z.string(),
    unresolvedObservationCount: z.number(),
  })),
  summary: z.object({
    totalMdas: z.number(),
    averageHealthScore: z.number(),
    totalOutstanding: z.string(),
    totalObservations: z.number(),
  }),
  periodYear: z.number(),
  periodMonth: z.number(),
  generatedAt: z.string(),
});
