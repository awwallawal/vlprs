import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { ThreeWayReconciliationSummary, ThreeWayDashboardMetrics } from '@vlprs/shared';

/**
 * Fetch three-way reconciliation detail for a specific MDA + period.
 * @target GET /api/reconciliation/three-way?mdaId=X&period=YYYY-MM
 */
export function useThreeWayReconciliation(mdaId: string | undefined, period: string | undefined) {
  return useQuery<ThreeWayReconciliationSummary>({
    queryKey: ['three-way-reconciliation', mdaId, period],
    queryFn: () => {
      const params = new URLSearchParams({ mdaId: mdaId!, period: period! });
      return apiClient<ThreeWayReconciliationSummary>(
        `/reconciliation/three-way?${params.toString()}`,
      );
    },
    enabled: !!mdaId && !!period,
    staleTime: 30_000,
  });
}

/**
 * Fetch three-way dashboard metrics (overall match rate, top variance MDAs).
 * @target GET /api/reconciliation/three-way/dashboard
 */
export function useThreeWayDashboard() {
  return useQuery<ThreeWayDashboardMetrics>({
    queryKey: ['three-way-dashboard'],
    queryFn: () => apiClient<ThreeWayDashboardMetrics>('/reconciliation/three-way/dashboard'),
    staleTime: 30_000,
  });
}
