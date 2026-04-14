import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export interface PendingMdaActionRow {
  mdaId: string;
  mdaCode: string;
  mdaName: string;
  flagged: number;
  notBaselined: number;
  flaggedExposure: string;
  oldestFlagged: string | null;
  nextDeadline: string | null;
}

export interface PendingMdaActionData {
  totalPending: number;
  mdaCount: number;
  totalExposure: string;
  overdeductions: number;
  withinFileDuplicates: number;
  negativeBalances: number;
  perMda: PendingMdaActionRow[];
}

/**
 * Aggregated backlog of records awaiting MDA action.
 * Used by the AG Dashboard banner + drill-down page.
 */
export function usePendingMdaAction() {
  return useQuery<PendingMdaActionData>({
    queryKey: ['dashboard', 'pending-mda-action'],
    queryFn: () => apiClient<PendingMdaActionData>('/dashboard/pending-mda-action'),
    staleTime: 30_000,
  });
}
