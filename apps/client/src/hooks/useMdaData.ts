import { useQuery } from '@tanstack/react-query';
import type { MdaSummary, LoanSearchResult, ComplianceResponse } from '@vlprs/shared';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';

/**
 * Sentinel queryKey segment used by `useMdaDetail` when no MDA id is supplied.
 * Centralised so future maintainers can grep for it and so the value cannot
 * accidentally collide with a real MDA id by typo.
 */
const NO_MDA_KEY = '__none__';

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
 *
 * Both `undefined` and the empty string `''` are treated as "no MDA": the
 * query is disabled and the cache key collapses to a single shared sentinel
 * (`['mda', NO_MDA_KEY]`) so that non-MDA routes do not churn cache entries
 * on every render. We use `||` (not `??`) so the empty-string case is also
 * caught — that is the historical footgun that AI Review L2 had to clean up
 * downstream in `MdaOfficerDashboard`. Hardening it at the hook protects
 * against future regressions.
 *
 * @target GET /api/mdas/:id/summary
 * @wired Story 4.3
 */
export function useMdaDetail(mdaId: string | undefined) {
  return useQuery<MdaSummary>({
    queryKey: ['mda', mdaId || NO_MDA_KEY],
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
    queryFn: async () => {
      const res = await authenticatedFetch(`/loans?${params.toString()}`);
      const body = await parseJsonResponse(res);
      return {
        data: body.data as LoanSearchResult[],
        pagination: body.pagination as MdaLoansResponse['pagination'],
      };
    },
    enabled: !!mdaId,
    staleTime: 30_000,
  });
}
