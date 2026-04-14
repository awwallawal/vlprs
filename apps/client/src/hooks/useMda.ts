import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { MdaListItem } from '@vlprs/shared';

// ─── Types ───────────────────────────────────────────────────────────

interface ResolveResult {
  input: string;
  status: 'auto_matched' | 'needs_review' | 'unknown';
  resolved: MdaListItem | null;
  candidates: Array<{ mda: MdaListItem; score: number; reason: string }>;
}

interface ResolveResponse {
  results: ResolveResult[];
}

interface MdaAlias {
  id: string;
  mdaId: string;
  alias: string;
  createdAt: string;
}

// ─── Hooks ───────────────────────────────────────────────────────────

export type { ResolveResult };

export function useMdaResolve() {
  return useMutation<ResolveResponse, Error, string[]>({
    mutationFn: (strings) =>
      apiClient<ResolveResponse>('/mdas/resolve', {
        method: 'POST',
        body: JSON.stringify({ strings }),
      }),
  });
}

export function useCreateMdaAlias() {
  const queryClient = useQueryClient();

  return useMutation<MdaAlias, Error, { alias: string; mdaId: string }>({
    mutationFn: ({ alias, mdaId }) =>
      apiClient<MdaAlias>('/mdas/aliases', {
        method: 'POST',
        body: JSON.stringify({ alias, mdaId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mdas'] });
    },
  });
}
