import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { MdaBreakdownRow } from '@vlprs/shared';

/**
 * Fetches MDA breakdown for a given metric.
 * @target GET /api/dashboard/breakdown?metric=X
 */
export function useDrillDown(metric: string) {
  return useQuery<MdaBreakdownRow[]>({
    queryKey: ['dashboard', 'breakdown', metric],
    queryFn: () => apiClient<MdaBreakdownRow[]>(`/dashboard/breakdown?metric=${metric}`),
    staleTime: 30_000,
    enabled: !!metric,
  });
}
