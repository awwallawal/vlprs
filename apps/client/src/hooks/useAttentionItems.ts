import { useQuery } from '@tanstack/react-query';
import type { AttentionItem } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';

interface AttentionItemsResponse {
  items: AttentionItem[];
  totalCount: number;
}

/**
 * Fetches attention items for dashboard.
 * @target GET /api/dashboard/attention
 */
export function useAttentionItems() {
  return useQuery<AttentionItemsResponse>({
    queryKey: ['dashboard', 'attention'],
    queryFn: () => apiClient<AttentionItemsResponse>('/dashboard/attention'),
    staleTime: 30_000,
  });
}
