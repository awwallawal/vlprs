// Target: GET /api/dashboard/metrics
// Wire: Sprint 5 (Epic 4: Executive Dashboard)
import type { DashboardMetrics } from '@vlprs/shared';

export const MOCK_DASHBOARD_METRICS: DashboardMetrics = {
  activeLoans: 2847,
  totalExposure: '2418350000.00',
  fundAvailable: '892000000.00',
  monthlyRecovery: '48250000.00',
  pendingEarlyExits: 12,
  earlyExitRecoveryAmount: '18750000.00',
  gratuityReceivableExposure: '345000000.00',
  staffIdCoverage: { covered: 2564, total: 2847 },
};
