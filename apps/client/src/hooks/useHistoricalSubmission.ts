import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';
import type { HistoricalUploadResponse, HistoricalReconciliationSummary } from '@vlprs/shared';

/**
 * Upload a historical CSV file.
 */
export function useHistoricalUpload() {
  const queryClient = useQueryClient();

  return useMutation<HistoricalUploadResponse, Error & { code?: string; details?: unknown[] }, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authenticatedFetch('/submissions/historical', {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonResponse(res);
      return body.data as HistoricalUploadResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });
}

/**
 * Fetches historical reconciliation summary for a submission.
 * @target GET /api/submissions/:id/historical-reconciliation
 */
export function useHistoricalReconciliation(submissionId: string) {
  return useQuery<HistoricalReconciliationSummary>({
    queryKey: ['historicalReconciliation', submissionId],
    queryFn: () => apiClient<HistoricalReconciliationSummary>(`/submissions/${submissionId}/historical-reconciliation`),
    enabled: !!submissionId,
    staleTime: 30_000,
  });
}

/**
 * Flag a discrepancy row for Department Admin review.
 * @target PATCH /api/submissions/:id/historical-reconciliation/flag
 */
export function useFlagDiscrepancy(submissionId: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error & { code?: string }, { staffId: string; reason: string }>({
    mutationFn: async ({ staffId, reason }) => {
      await apiClient(`/submissions/${submissionId}/historical-reconciliation/flag`, {
        method: 'PATCH',
        body: JSON.stringify({ staffId, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historicalReconciliation', submissionId] });
    },
  });
}
