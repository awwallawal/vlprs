import { useQuery } from '@tanstack/react-query';
import type { MdaSummary, LoanSearchResult, ComplianceResponse } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';

/**
 * Fetches MDA compliance grid data including heatmap and summary.
 * @target GET /api/dashboard/compliance
 * @wired Story 4.4
 */
export function useMdaComplianceGrid() {
  return useQuery<ComplianceResponse>({
    queryKey: ['mda', 'compliance'],
    queryFn: () => apiClient<ComplianceResponse>('/dashboard/compliance'),
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
