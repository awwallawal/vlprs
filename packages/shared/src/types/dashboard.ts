export interface DashboardMetrics {
  // Primary Hero Row
  activeLoans: number;
  totalExposure: string;              // Outstanding balances of ACTIVE loans
  fundAvailable: string | null;       // null = not yet configured
  fundConfigured: boolean;            // false until AG enters scheme fund total
  monthlyRecovery: string;            // Actual last-period recovery
  recoveryPeriod: string;             // "2026-02" — which month the recovery is from

  // Analytics Row
  loansInWindow: number;              // All loans in 60-month window (any status/path)
  totalOutstandingReceivables: string; // Outstanding across ACTIVE + OVERDUE + STALLED
  monthlyCollectionPotential: string;  // Expected monthly (sum of active deductions)
  atRiskAmount: string;               // OVERDUE + STALLED outstanding
  loanCompletionRate: number;          // Rolling 60-month window (0-100)
  loanCompletionRateLifetime: number;  // All-time (0-100)

  // Secondary metrics
  pendingEarlyExits: number;
  earlyExitRecoveryAmount: string;
  gratuityReceivableExposure: string;
  staffIdCoverage: { covered: number; total: number };
}

export type AttentionItemType =
  | 'zero_deduction'           // (c) 60+ days no deduction
  | 'post_retirement_active'   // (e) active past retirement
  | 'missing_staff_id'         // (g) records without Staff ID
  | 'overdue_loans'            // (h) past expected completion
  | 'stalled_deductions'       // (i) unchanged balance 2+ months
  | 'quick_win'                // (j) ≤3 installments remaining
  | 'submission_variance'      // (a) future: Epic 5
  | 'overdue_submission'       // (b) future: Epic 5
  | 'pending_auto_stop'        // (d) future: Epic 8
  | 'pending_early_exit'       // (f) future: Epic 12
  | 'dark_mda'                 // (k) future: Epic 5
  | 'onboarding_lag';          // (l) future: Epic 5

export interface AttentionItem {
  id: string;
  type: AttentionItemType;
  description: string;
  mdaName: string;                 // MDA name or "Scheme-wide" for aggregate items
  category: 'review' | 'info' | 'complete';
  priority: number;                // sort order (lower = higher priority)
  count?: number;                  // e.g., "12 overdue loans"
  amount?: string;                 // e.g., "₦45,000,000.00" (string for decimal safety)
  drillDownUrl?: string;           // navigation target when tapped
  hasMore?: number;                // if set, description includes "and {hasMore} more MDAs"
  timestamp: string;               // ISO 8601 — when condition was last evaluated
}
