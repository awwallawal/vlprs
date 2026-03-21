import { useQuery } from '@tanstack/react-query';
import type { SystemHealthResponse } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';

/**
 * Fetches system health metrics with 30s auto-refresh.
 * @target GET /api/system-health
 */
export function useSystemHealth() {
  const user = useAuthStore((s) => s.user);

  return useQuery<SystemHealthResponse>({
    queryKey: ['system-health'],
    queryFn: () => apiClient<SystemHealthResponse>('/system-health'),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: !!user,
  });
}
