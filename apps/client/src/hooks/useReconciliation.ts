import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { toast } from 'sonner';
import type { ReconciliationSummary, ResolveDiscrepancyRequest } from '@vlprs/shared';

/**
 * Fetches reconciliation summary for a specific submission.
 * @target GET /api/submissions/:submissionId/reconciliation
 */
export function useReconciliationSummary(submissionId: string) {
  return useQuery<ReconciliationSummary>({
    queryKey: ['reconciliation', submissionId],
    queryFn: () =>
      apiClient<ReconciliationSummary>(
        `/submissions/${submissionId}/reconciliation`,
      ),
    enabled: !!submissionId,
    staleTime: 30_000,
  });
}

/**
 * Resolve a DATE_DISCREPANCY for an employment event.
 * @target PATCH /api/employment-events/:id/reconciliation-status
 */
export function useResolveDiscrepancy(submissionId: string, mdaId?: string) {
  const queryClient = useQueryClient();

  return useMutation<
    { id: string; reconciliationStatus: string },
    Error & { code?: string },
    { eventId: string } & ResolveDiscrepancyRequest
  >({
    mutationFn: async ({ eventId, status, reason }) => {
      return apiClient<{ id: string; reconciliationStatus: string }>(
        `/employment-events/${eventId}/reconciliation-status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status, reason }),
        },
      );
    },
    onSuccess: () => {
      toast.success('Resolution recorded');
      queryClient.invalidateQueries({
        queryKey: ['reconciliation', submissionId],
      });
      if (mdaId) {
        queryClient.invalidateQueries({
          queryKey: ['preSubmission', 'checkpoint', mdaId],
        });
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to resolve discrepancy');
    },
  });
}
