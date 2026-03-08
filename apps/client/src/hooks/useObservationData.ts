import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { PaginatedObservations, ObservationCounts } from '@vlprs/shared';

interface ObservationFilters {
  page?: number;
  pageSize?: number;
  type?: string;
  mdaId?: string;
  status?: string;
  staffName?: string;
  sortBy?: 'createdAt' | 'type' | 'staffName' | 'status';
  sortOrder?: 'asc' | 'desc';
}

function buildQueryString(filters: ObservationFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.type) params.set('type', filters.type);
  if (filters.mdaId) params.set('mdaId', filters.mdaId);
  if (filters.status) params.set('status', filters.status);
  if (filters.staffName) params.set('staffName', filters.staffName);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useObservationList(filters: ObservationFilters) {
  return useQuery<PaginatedObservations>({
    queryKey: ['observations', filters],
    queryFn: () =>
      apiClient<PaginatedObservations>(`/observations${buildQueryString(filters)}`),
    staleTime: 30_000,
  });
}

export function useObservationCounts() {
  return useQuery<ObservationCounts>({
    queryKey: ['observations', 'counts'],
    queryFn: () => apiClient<ObservationCounts>('/observations/counts'),
    staleTime: 30_000,
  });
}

export function useReviewObservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiClient(`/observations/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] });
    },
  });
}

export function useResolveObservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNote }: { id: string; resolutionNote: string }) =>
      apiClient(`/observations/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolutionNote }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] });
    },
  });
}

export function usePromoteObservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, priority }: { id: string; priority?: string }) =>
      apiClient(`/observations/${id}/promote`, {
        method: 'POST',
        body: JSON.stringify({ priority }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] });
    },
  });
}

export function useGenerateObservations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ uploadId }: { uploadId: string }) =>
      apiClient('/observations/generate', {
        method: 'POST',
        body: JSON.stringify({ uploadId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['observations'] });
    },
  });
}
