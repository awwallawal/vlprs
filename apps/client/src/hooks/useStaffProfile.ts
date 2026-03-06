import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import type { PersonListItem, PersonProfile } from '@vlprs/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getAuthHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const csrfMatch = document.cookie
    .split('; ')
    .find((row) => row.startsWith('__csrf='));
  if (csrfMatch) {
    headers['x-csrf-token'] = decodeURIComponent(csrfMatch.split('=')[1]);
  }
  return headers;
}

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

      const res = await fetch(`${API_BASE}/migrations/persons?${params}`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Failed to load persons');
      }
      return { data: body.data, pagination: body.pagination };
    },
    staleTime: 30_000,
  });
}

export function usePersonProfile(personKey: string | undefined) {
  return useQuery<PersonProfile>({
    queryKey: ['persons', personKey],
    queryFn: async () => {
      const encoded = encodeURIComponent(personKey!);
      const res = await fetch(`${API_BASE}/migrations/persons/${encoded}`, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Failed to load person profile');
      }
      return body.data;
    },
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
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/migrations/match-persons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Person matching failed');
      }
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useConfirmMatch() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; status: string }, Error, string>({
    mutationFn: async (matchId) => {
      const res = await fetch(`${API_BASE}/migrations/matches/${matchId}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Confirm failed');
      }
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();

  return useMutation<{ id: string; status: string }, Error, string>({
    mutationFn: async (matchId) => {
      const res = await fetch(`${API_BASE}/migrations/matches/${matchId}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Reject failed');
      }
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    },
  });
}
