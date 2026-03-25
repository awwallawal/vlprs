import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';
import type { PersonListItem, PersonProfile } from '@vlprs/shared';

export function usePersonList(filters?: {
  page?: number;
  limit?: number;
  mdaFilter?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  return useQuery<{
    data: PersonListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ['persons', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.mdaFilter) params.set('mdaFilter', filters.mdaFilter);
      if (filters?.sortBy) params.set('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

      const res = await authenticatedFetch(`/migrations/persons?${params}`);
      const body = await parseJsonResponse(res);
      return { data: body.data as PersonListItem[], pagination: body.pagination as { page: number; limit: number; total: number; totalPages: number } };
    },
    staleTime: 30_000,
  });
}

export function usePersonProfile(personKey: string | undefined) {
  return useQuery<PersonProfile>({
    queryKey: ['persons', personKey],
    queryFn: () => apiClient<PersonProfile>(`/migrations/persons/${encodeURIComponent(personKey!)}`),
    enabled: !!personKey,
    staleTime: 30_000,
  });
}

export function useMatchPersons() {
  const queryClient = useQueryClient();

  return useMutation<
    { totalPersons: number; multiMdaPersons: number; autoMatched: number; pendingReview: number },
    Error
  >({
    mutationFn: () =>
      apiClient('/migrations/match-persons', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useConfirmMatch() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; status: string }, Error, string>({
    mutationFn: (matchId) =>
      apiClient(`/migrations/matches/${matchId}/confirm`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; status: string }, Error, string>({
    mutationFn: (matchId) =>
      apiClient(`/migrations/matches/${matchId}/reject`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
