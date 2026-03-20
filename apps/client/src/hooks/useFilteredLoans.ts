import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { LoanSearchResult } from '@vlprs/shared';

interface FilteredLoansResponse {
  data: LoanSearchResult[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Fetches loans with classification or attention item filter.
 * @target GET /api/loans?filter=X&mdaId=Y&classification=Z
 */
export function useFilteredLoans(
  filter?: string,
  mdaId?: string,
  sort?: string,
  classification?: string,
  page = 1,
) {
  const params = new URLSearchParams();
  if (filter) params.set('filter', filter);
  if (mdaId) params.set('mdaId', mdaId);
  if (classification) params.set('classification', classification);
  if (sort === 'outstanding-asc') {
    params.set('sortBy', 'outstandingBalance');
    params.set('sortOrder', 'asc');
  }
  params.set('page', String(page));
  params.set('pageSize', '25');

  const queryString = params.toString();

  return useQuery<FilteredLoansResponse>({
    queryKey: ['loans', 'filtered', filter, mdaId, classification, sort, page],
    queryFn: () => apiClient<FilteredLoansResponse>(`/loans?${queryString}`),
    staleTime: 30_000,
    enabled: !!(filter || classification),
  });
}
