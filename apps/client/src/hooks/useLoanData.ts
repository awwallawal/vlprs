import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoanDetail, LoanSearchResult } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';

/**
 * Fetches single loan detail by ID.
 * @target GET /api/loans/:id
 */
export function useLoanDetail(loanId: string) {
  return useQuery<LoanDetail>({
    queryKey: ['loan', loanId],
    queryFn: () => apiClient<LoanDetail>(`/loans/${loanId}`),
    enabled: !!loanId,
    staleTime: 30_000,
  });
}

/**
 * Searches loans by query string.
 * @target GET /api/loans?search=:query
 */
export function useLoanSearch(query: string) {
  return useQuery<LoanSearchResult[]>({
    queryKey: ['loan', 'search', query],
    queryFn: async () => {
      if (!query) return [];
      const result = await apiClient<{ data: LoanSearchResult[] }>(`/loans?search=${encodeURIComponent(query)}&pageSize=25`);
      return result.data;
    },
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}

/**
 * Update staff ID on a loan.
 */
export function useUpdateStaffId(loanId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ loanId: string; staffId: string }, Error, { staffId: string }>({
    mutationFn: ({ staffId }) =>
      apiClient<{ loanId: string; staffId: string }>(`/loans/${loanId}/staff-id`, {
        method: 'PATCH',
        body: JSON.stringify({ staffId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loan', loanId] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
    },
  });
}
