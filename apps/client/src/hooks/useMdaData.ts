import { useQuery } from '@tanstack/react-query';
import type { MdaComplianceRow, MdaSummary, LoanSearchResult } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';
import { MOCK_MDA_COMPLIANCE } from '@/mocks/mdaComplianceGrid';

/**
 * Fetches MDA compliance grid data.
 * @target GET /api/dashboard/compliance
 * @wire Story 4.4 (not this story)
 */
export function useMdaComplianceGrid() {
  return useQuery<MdaComplianceRow[]>({
    queryKey: ['mda', 'compliance'],
    queryFn: async () => MOCK_MDA_COMPLIANCE,
    staleTime: 30_000,
  });
}

/**
 * Fetches MDA detail summary by ID.
 * @target GET /api/mdas/:id/summary
 * @wired Story 4.3
 */
export function useMdaDetail(mdaId: string) {
  return useQuery<MdaSummary>({
    queryKey: ['mda', mdaId],
    queryFn: () => apiClient<MdaSummary>(`/mdas/${mdaId}/summary`),
    enabled: !!mdaId,
    staleTime: 30_000,
  });
}

interface MdaLoansResponse {
  data: LoanSearchResult[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/**
 * Fetches loans for a specific MDA with optional classification filter.
 * @target GET /api/loans?mdaId=X&classification=Y
 * @wired Story 4.3
 */
export function useMdaLoans(mdaId: string, classification?: string, page = 1) {
  const params = new URLSearchParams();
  params.set('mdaId', mdaId);
  if (classification) params.set('classification', classification);
  params.set('page', String(page));
  params.set('pageSize', '25');

  return useQuery<MdaLoansResponse>({
    queryKey: ['mda', mdaId, 'loans', classification, page],
    queryFn: () => apiClient<MdaLoansResponse>(`/loans?${params.toString()}`),
    enabled: !!mdaId,
    staleTime: 30_000,
  });
}
