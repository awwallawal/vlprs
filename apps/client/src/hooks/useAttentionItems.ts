import { useQuery } from '@tanstack/react-query';
import type { AttentionItem } from '@vlprs/shared';
import { MOCK_ATTENTION_ITEMS } from '@/mocks/attentionItems';

/**
 * Fetches attention items for dashboard.
 * @target GET /api/dashboard/attention
 * @wire Sprint 5 (Epic 4: Executive Dashboard)
 */
export function useAttentionItems() {
  return useQuery<AttentionItem[]>({
    queryKey: ['dashboard', 'attention'],
    queryFn: async () => MOCK_ATTENTION_ITEMS,
    staleTime: 30_000,
  });
}
