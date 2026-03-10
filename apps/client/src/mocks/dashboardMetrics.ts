// Target: GET /api/dashboard/metrics
// Wire: Sprint 6 (Epic 4: Executive Dashboard)
import type { DashboardMetrics } from '@vlprs/shared';

/** Default mock — scheme fund total configured, realistic Oyo State scale */
export const MOCK_DASHBOARD_METRICS: DashboardMetrics = {
  // Primary Hero Row
  activeLoans: 2847,
  totalExposure: '1876500000.00',       // Outstanding (less than principal — some paid)
  fundAvailable: '892000000.00',
  fundConfigured: true,
  monthlyRecovery: '45120000.00',       // Actual last month
  recoveryPeriod: '2026-02',

  // Analytics Row
  loansInWindow: 3451,                  // Includes completed within window
  totalOutstandingReceivables: '2156000000.00',
  monthlyCollectionPotential: '48250000.00',
  atRiskAmount: '312000000.00',
  loanCompletionRate: 17.5,
  loanCompletionRateLifetime: 22.3,

  // Secondary metrics
  pendingEarlyExits: 12,
  earlyExitRecoveryAmount: '18750000.00',
  gratuityReceivableExposure: '345000000.00',
  staffIdCoverage: { covered: 2564, total: 2847 },
};

/** Mock variant: scheme fund total NOT yet configured */
export const MOCK_DASHBOARD_METRICS_UNCONFIGURED: DashboardMetrics = {
  ...MOCK_DASHBOARD_METRICS,
  fundAvailable: null,
  fundConfigured: false,
};
