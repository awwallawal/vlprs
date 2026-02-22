import { useQuery } from '@tanstack/react-query';
import type { SubmissionRecord } from '@vlprs/shared';
import { MOCK_SUBMISSION_HISTORY } from '@/mocks/submissionHistory';

/**
 * Fetches submission history for a specific MDA.
 * @target GET /api/submissions?mdaId=
 * @wire Sprint 7 (Epic 5: MDA Monthly Submission)
 */
export function useSubmissionHistory(mdaId: string) {
  return useQuery<SubmissionRecord[]>({
    queryKey: ['submissions', mdaId],
    queryFn: async () => MOCK_SUBMISSION_HISTORY[mdaId] ?? [],
    enabled: !!mdaId,
    staleTime: 30_000,
  });
}
