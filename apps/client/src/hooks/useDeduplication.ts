/**
 * useDeduplication — TanStack Query hooks for delineation and deduplication.
 *
 * Story 3.8: Multi-MDA File Delineation & Deduplication
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type {
  DelineationResult,
  DuplicateCandidate,
  DuplicateRecordDetail,
  DuplicateResolution,
} from '@vlprs/shared';

// ─── Delineation Hooks ──────────────────────────────────────────────

export function useDelineationPreview(uploadId: string) {
  return useQuery<DelineationResult>({
    queryKey: ['delineation', uploadId],
    queryFn: () => apiClient<DelineationResult>(`/migrations/${uploadId}/delineation`),
    enabled: !!uploadId,
    staleTime: 30_000,
  });
}

export function useTriggerDelineation(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<DelineationResult, Error>({
    mutationFn: () =>
      apiClient<DelineationResult>(`/migrations/${uploadId}/delineate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delineation', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
}

export function useConfirmDelineation(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    DelineationResult,
    Error,
    { sections: Array<{ sectionIndex: number; mdaId: string }> }
  >({
    mutationFn: ({ sections }) =>
      apiClient<DelineationResult>(`/migrations/${uploadId}/delineation/confirm`, {
        method: 'POST',
        body: JSON.stringify({ sections }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delineation', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard', 'metrics'] });
    },
  });
}

// ─── Deduplication Hooks ────────────────────────────────────────────

interface DuplicateListResponse {
  data: DuplicateCandidate[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface DuplicateFilters {
  page?: number;
  pageSize?: number;
  parentMdaId?: string;
  childMdaId?: string;
  status?: string;
  staffName?: string;
}

export function useDuplicateList(filters?: DuplicateFilters) {
  const params = new URLSearchParams();
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters?.parentMdaId) params.set('parentMdaId', filters.parentMdaId);
  if (filters?.childMdaId) params.set('childMdaId', filters.childMdaId);
  if (filters?.status) params.set('status', filters.status);
  if (filters?.staffName) params.set('staffName', filters.staffName);

  const query = params.toString();

  return useQuery<DuplicateListResponse>({
    queryKey: ['duplicates', filters],
    queryFn: () =>
      apiClient<DuplicateListResponse>(`/migrations/duplicates${query ? `?${query}` : ''}`),
    staleTime: 30_000,
  });
}

export function useResolveDuplicate() {
  const queryClient = useQueryClient();

  return useMutation<
    DuplicateCandidate,
    Error,
    { candidateId: string; resolution: DuplicateResolution; note?: string }
  >({
    mutationFn: ({ candidateId, resolution, note }) =>
      apiClient<DuplicateCandidate>(`/migrations/duplicates/${candidateId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify({ resolution, note }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'status'] });
      queryClient.invalidateQueries({ queryKey: ['migration', 'dashboard', 'metrics'] });
    },
  });
}

export function useDuplicateRecordDetail(candidateId: string | null) {
  return useQuery<DuplicateRecordDetail>({
    queryKey: ['duplicates', candidateId, 'records'],
    queryFn: () =>
      apiClient<DuplicateRecordDetail>(
        `/migrations/duplicates/${candidateId}/records`,
      ),
    enabled: !!candidateId,
    staleTime: 60_000,
  });
}

export function useTriggerDeduplication() {
  const queryClient = useQueryClient();

  return useMutation<{ detected: number; pairs: number }, Error>({
    mutationFn: () =>
      apiClient<{ detected: number; pairs: number }>('/migrations/deduplicate', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
    },
  });
}
