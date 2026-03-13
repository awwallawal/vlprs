import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/fetchHelpers';
import { apiClient } from '@/lib/apiClient';
import type { SubmissionRecord, SubmissionUploadResponse } from '@vlprs/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Upload a CSV submission file.
 * Uses raw fetch (NOT apiClient) because apiClient only supports JSON.
 */
export function useSubmissionUpload() {
  const queryClient = useQueryClient();

  return useMutation<SubmissionUploadResponse, Error & { code?: string; details?: unknown[] }, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/submissions/upload`, {
        method: 'POST',
        headers: getAuthHeaders(), // NO Content-Type — let browser set multipart boundary
        credentials: 'include',
        body: formData,
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        const err = Object.assign(
          new Error(body.error?.message || 'Upload needs attention'),
          {
            code: body.error?.code,
            details: body.error?.details,
          },
        );
        throw err;
      }
      return body.data as SubmissionUploadResponse;
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
export function useSubmissionHistory(mdaId: string, page = 1, pageSize = 20) {
  return useQuery<{ items: SubmissionRecord[]; total: number; page: number; pageSize: number }>({
    queryKey: ['submissions', mdaId, { page, pageSize }],
    queryFn: () =>
      apiClient(`/submissions?mdaId=${mdaId}&page=${page}&pageSize=${pageSize}`),
    enabled: !!mdaId,
    staleTime: 30_000,
  });
}
