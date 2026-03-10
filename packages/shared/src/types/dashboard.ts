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

export interface AttentionItem {
  id: string;
  description: string;
  mdaName: string;
  category: 'review' | 'info' | 'complete';
  timestamp: string;
}
