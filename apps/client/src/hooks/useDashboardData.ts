import { useQuery } from '@tanstack/react-query';
import type { DashboardMetrics } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';

/**
 * Fetches dashboard hero metrics.
 * @target GET /api/dashboard/metrics
 */
export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => apiClient<DashboardMetrics>('/dashboard/metrics'),
    staleTime: 30_000,
  });
}
