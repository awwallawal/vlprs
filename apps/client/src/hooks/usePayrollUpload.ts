import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getAuthHeaders } from '@/lib/fetchHelpers';
import { apiClient } from '@/lib/apiClient';
import type {
  PayrollDelineationSummary,
  PayrollUploadResponse,
  PayrollUploadListItem,
} from '@vlprs/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Upload payroll file for preview (delineation summary).
 * Uses raw fetch for FormData (not apiClient).
 */
export function usePayrollPreview() {
  return useMutation<PayrollDelineationSummary, Error & { code?: string; details?: unknown[] }, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/payroll/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: formData,
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        const err = Object.assign(
          new Error(body.error?.message || 'Upload needs attention'),
          { code: body.error?.code, details: body.error?.details },
        );
        throw err;
      }
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
