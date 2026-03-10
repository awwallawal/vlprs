import { z } from 'zod';

export const dashboardMetricsSchema = z.object({
  // Primary Hero Row
  activeLoans: z.number().int().min(0),
  totalExposure: z.string(),
  fundAvailable: z.string().nullable(),
  fundConfigured: z.boolean(),
  monthlyRecovery: z.string(),
  recoveryPeriod: z.string(),

  // Analytics Row
  loansInWindow: z.number().int().min(0),
  totalOutstandingReceivables: z.string(),
  monthlyCollectionPotential: z.string(),
  atRiskAmount: z.string(),
  loanCompletionRate: z.number().min(0).max(100),
  loanCompletionRateLifetime: z.number().min(0).max(100),

  // Secondary metrics
  pendingEarlyExits: z.number().int().min(0),
  earlyExitRecoveryAmount: z.string(),
  gratuityReceivableExposure: z.string(),
  staffIdCoverage: z.object({
    covered: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
});

export type DashboardMetricsResponse = z.infer<typeof dashboardMetricsSchema>;
