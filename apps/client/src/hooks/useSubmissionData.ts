import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';
import type { SubmissionRecord, SubmissionRow, SubmissionUploadResponse, SubmissionComparisonResponse, SubmissionDetail } from '@vlprs/shared';

/**
 * Upload a CSV submission file.
 */
export function useSubmissionUpload() {
  const queryClient = useQueryClient();

  return useMutation<SubmissionUploadResponse, Error & { code?: string; details?: unknown[] }, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authenticatedFetch('/submissions/upload', {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonResponse(res);
      return body.data as SubmissionUploadResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });
}

/**
 * Submit manual entry rows.
 * Uses apiClient which preserves error.details for inline form field mapping.
 */
export function useManualSubmission() {
  const queryClient = useQueryClient();
  return useMutation<
    SubmissionUploadResponse,
    Error & { code?: string; status?: number; details?: unknown[] },
    SubmissionRow[]
  >({
    mutationFn: async (rows: SubmissionRow[]) => {
      return apiClient<SubmissionUploadResponse>('/submissions/manual', {
        method: 'POST',
        body: JSON.stringify({ rows }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
    },
  });
}

/**
 * Fetches submission history for a specific MDA (or all MDAs for admins).
 * @target GET /api/submissions?mdaId=&page=&pageSize=
 */
export function useSubmissionHistory(mdaId?: string, page = 1, pageSize = 20) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (mdaId) params.set('mdaId', mdaId);
  return useQuery<{ items: SubmissionRecord[]; total: number; page: number; pageSize: number }>({
    queryKey: ['submissions', mdaId ?? 'all', { page, pageSize }],
    queryFn: () => apiClient(`/submissions?${params.toString()}`),
    staleTime: 30_000,
  });
}

/**
 * Fetches full submission detail (metadata + rows).
 * @target GET /api/submissions/:id
 */
export function useSubmissionDetail(submissionId: string) {
  return useQuery<SubmissionDetail>({
    queryKey: ['submissions', submissionId, 'detail'],
    queryFn: () => apiClient<SubmissionDetail>(`/submissions/${submissionId}`),
    enabled: !!submissionId,
    staleTime: 60_000,
  });
}

/**
 * Fetches comparison summary for a specific submission.
 * @target GET /api/submissions/:id/comparison
 */
export function useComparisonSummary(submissionId: string) {
  return useQuery<SubmissionComparisonResponse>({
    queryKey: ['submissions', submissionId, 'comparison'],
    queryFn: () => apiClient<SubmissionComparisonResponse>(`/submissions/${submissionId}/comparison`),
    enabled: !!submissionId,
    staleTime: 30_000,
  });
}
