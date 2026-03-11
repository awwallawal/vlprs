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

export const attentionItemTypeSchema = z.enum([
  'zero_deduction',
  'post_retirement_active',
  'missing_staff_id',
  'overdue_loans',
  'stalled_deductions',
  'quick_win',
  'submission_variance',
  'overdue_submission',
  'pending_auto_stop',
  'pending_early_exit',
  'dark_mda',
  'onboarding_lag',
]);

export const attentionItemSchema = z.object({
  id: z.string(),
  type: attentionItemTypeSchema,
  description: z.string(),
  mdaName: z.string(),
  category: z.enum(['review', 'info', 'complete']),
  priority: z.number().int(),
  count: z.number().int().optional(),
  amount: z.string().optional(),
  drillDownUrl: z.string().optional(),
  hasMore: z.number().int().optional(),
  timestamp: z.string(),
});

export const attentionItemsResponseSchema = z.object({
  items: z.array(attentionItemSchema),
  totalCount: z.number().int().min(0),
});

export type AttentionItemsResponse = z.infer<typeof attentionItemsResponseSchema>;
