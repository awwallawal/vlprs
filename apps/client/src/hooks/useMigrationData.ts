import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { MigrationMdaStatus, MigrationDashboardMetrics, CoverageMatrix, SupersedeResponse } from '@vlprs/shared';

export function useMigrationStatus() {
  return useQuery<MigrationMdaStatus[]>({
    queryKey: ['migration', 'status'],
    queryFn: () => apiClient<MigrationMdaStatus[]>('/migrations/dashboard'),
    staleTime: 30_000,
  });
}

export function useMigrationDashboardMetrics() {
  return useQuery<MigrationDashboardMetrics>({
    queryKey: ['migration', 'dashboard', 'metrics'],
    queryFn: () => apiClient<MigrationDashboardMetrics>('/migrations/dashboard/metrics'),
    staleTime: 30_000,
  });
}

export function useMigrationCoverage(extended: boolean) {
  return useQuery<CoverageMatrix>({
    queryKey: ['migration', 'coverage', { extended }],
    queryFn: () => apiClient<CoverageMatrix>(`/migrations/coverage${extended ? '?extended=true' : ''}`),
    staleTime: 60_000,
  });
}

export function useSupersede() {
  const queryClient = useQueryClient();
  return useMutation<
    SupersedeResponse,
    Error,
    { supersededUploadId: string; replacementUploadId: string; reason: string }
  >({
    mutationFn: ({ supersededUploadId, replacementUploadId, reason }) =>
      apiClient<SupersedeResponse>(`/migrations/${supersededUploadId}/supersede`, {
        method: 'POST',
        body: JSON.stringify({ replacementUploadId, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration'] });
      queryClient.invalidateQueries({ queryKey: ['observations'] });
    },
  });
}
