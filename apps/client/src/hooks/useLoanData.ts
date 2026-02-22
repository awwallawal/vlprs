import { useQuery } from '@tanstack/react-query';
import type { LoanSummary, LoanSearchResult } from '@vlprs/shared';
import { MOCK_LOAN_DETAILS } from '@/mocks/loanDetail';
import { MOCK_LOAN_SEARCH_RESULTS } from '@/mocks/loanSearch';

/**
 * Fetches single loan detail by ID.
 * @target GET /api/loans/:id
 * @wire Sprint 2 (Epic 2: Loan Data Management)
 */
export function useLoanDetail(loanId: string) {
  return useQuery<LoanSummary>({
    queryKey: ['loan', loanId],
    queryFn: async () => {
      const loan = MOCK_LOAN_DETAILS[loanId];
      if (!loan) throw new Error(`Loan ${loanId} not found`);
      return loan;
    },
    enabled: !!loanId,
    staleTime: 30_000,
  });
}

/**
 * Searches loans by query string.
 * @target GET /api/loans/search
 * @wire Sprint 2 (Epic 2: Loan Data Management)
 */
export function useLoanSearch(query: string) {
  return useQuery<LoanSearchResult[]>({
    queryKey: ['loan', 'search', query],
    queryFn: async () => {
      if (!query) return [];
      const q = query.toLowerCase();
      return MOCK_LOAN_SEARCH_RESULTS.filter(
        (r) =>
          r.borrowerName.toLowerCase().includes(q) ||
          r.staffId?.toLowerCase().includes(q) ||
          r.loanRef.toLowerCase().includes(q),
      );
    },
    enabled: query.length > 0,
    staleTime: 30_000,
  });
}
