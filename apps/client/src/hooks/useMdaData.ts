import { useQuery } from '@tanstack/react-query';
import type { MdaComplianceRow, MdaSummary } from '@vlprs/shared';
import { MOCK_MDA_COMPLIANCE } from '@/mocks/mdaComplianceGrid';
import { MOCK_MDA_DETAILS } from '@/mocks/mdaDetail';

/**
 * Fetches MDA compliance grid data.
 * @target GET /api/dashboard/compliance
 * @wire Sprint 5 (Epic 4: Executive Dashboard)
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
 * @wire Sprint 5 (Epic 4: Executive Dashboard)
 */
export function useMdaDetail(mdaId: string) {
  return useQuery<MdaSummary>({
    queryKey: ['mda', mdaId],
    queryFn: async () => {
      const detail = MOCK_MDA_DETAILS[mdaId];
      if (!detail) throw new Error(`MDA ${mdaId} not found`);
      return detail;
    },
    enabled: !!mdaId,
    staleTime: 30_000,
  });
}
