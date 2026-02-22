import { useQuery } from '@tanstack/react-query';
import type { DashboardMetrics } from '@vlprs/shared';
import { MOCK_DASHBOARD_METRICS } from '@/mocks/dashboardMetrics';

/**
 * Fetches dashboard hero metrics.
 * @target GET /api/dashboard/metrics
 * @wire Sprint 5 (Epic 4: Executive Dashboard)
 */
export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => MOCK_DASHBOARD_METRICS,
    staleTime: 30_000,
  });
}
