import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { PreSubmissionCheckpoint } from '@vlprs/shared';

/**
 * Fetches pre-submission checkpoint data for the given MDA.
 * @target GET /api/pre-submission/:mdaId
 */
export function usePreSubmissionCheckpoint(mdaId: string | undefined) {
  return useQuery<PreSubmissionCheckpoint>({
    queryKey: ['preSubmission', 'checkpoint', mdaId],
    queryFn: () => apiClient<PreSubmissionCheckpoint>(`/pre-submission/${mdaId}`),
    enabled: !!mdaId,
    staleTime: 30_000,
  });
}
