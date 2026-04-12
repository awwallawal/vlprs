import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch } from '@/lib/apiClient';
import type { MigrationMdaStatus, MigrationDashboardMetrics, CoverageMatrix, CoverageRecordsResponse, SupersedeResponse, SupersedeComparisonResult } from '@vlprs/shared';

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

export function useCoverageRecords(
  mdaId: string,
  year: number,
  month: number,
  page: number,
  sortBy: string,
  sortDir: 'asc' | 'desc',
) {
  return useQuery<CoverageRecordsResponse>({
    queryKey: ['migration', 'coverage', 'records', { mdaId, year, month, page, sortBy, sortDir }],
    queryFn: () =>
      apiClient<CoverageRecordsResponse>(
        `/migrations/coverage/records?mdaId=${mdaId}&year=${year}&month=${month}&page=${page}&limit=50&sortBy=${sortBy}&sortDir=${sortDir}`,
      ),
    staleTime: 30_000,
    enabled: !!mdaId && !!year && !!month,
  });
}

export function useCoverageRecordExport() {
  return useMutation<void, Error, { mdaId: string; year: number; month: number; format: 'csv' | 'xlsx'; mdaCode: string }>({
    mutationFn: async ({ mdaId, year, month, format, mdaCode }) => {
      const paddedMonth = String(month).padStart(2, '0');
      const res = await authenticatedFetch(
        `/migrations/coverage/records/export?mdaId=${mdaId}&year=${year}&month=${month}&format=${format}`,
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vlprs-${mdaCode}-${year}-${paddedMonth}-records.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });
}

export function useSupersedeComparison(
  oldUploadId: string | null,
  newUploadId: string | null,
) {
  return useQuery<SupersedeComparisonResult>({
    queryKey: ['supersede', 'compare', oldUploadId, newUploadId],
    queryFn: () =>
      apiClient<SupersedeComparisonResult>(
        `/migrations/${oldUploadId}/supersede/compare/${newUploadId}`,
      ),
    enabled: !!oldUploadId && !!newUploadId,
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
