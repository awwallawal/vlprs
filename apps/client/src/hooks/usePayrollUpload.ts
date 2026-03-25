import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';
import type {
  PayrollDelineationSummary,
  PayrollUploadResponse,
  PayrollUploadListItem,
} from '@vlprs/shared';

/**
 * Upload payroll file for preview (delineation summary).
 */
export function usePayrollPreview() {
  return useMutation<PayrollDelineationSummary, Error & { code?: string; details?: unknown[] }, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authenticatedFetch('/payroll/upload', {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonResponse(res);
      return body.data as PayrollDelineationSummary;
    },
  });
}

/**
 * Confirm payroll upload after reviewing delineation summary.
 */
export function usePayrollConfirm() {
  const queryClient = useQueryClient();

  return useMutation<PayrollUploadResponse, Error & { code?: string }, { period: string }>({
    mutationFn: async ({ period }) => {
      return apiClient<PayrollUploadResponse>('/payroll/confirm', {
        method: 'POST',
        body: JSON.stringify({ period }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-uploads'] });
    },
  });
}

/**
 * List payroll uploads, optionally filtered by period.
 */
export function usePayrollList(period?: string) {
  const params = new URLSearchParams();
  if (period) params.set('period', period);

  return useQuery<PayrollUploadListItem[]>({
    queryKey: ['payroll-uploads', period ?? 'all'],
    queryFn: () => apiClient(`/payroll?${params.toString()}`),
    staleTime: 30_000,
  });
}
