import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { ExceptionListItem, ExceptionDetail, ExceptionCounts, FlagExceptionRequest, ResolveExceptionRequest } from '@vlprs/shared';

interface ExceptionListResponse {
  data: ExceptionListItem[];
  total: number;
  page: number;
}

interface ExceptionFilters {
  category?: string;
  mdaId?: string;
  priority?: string;
  status?: string;
  loanId?: string;
  page?: number;
  limit?: number;
}

function buildQueryString(filters: ExceptionFilters): string {
  const params = new URLSearchParams();
  if (filters.category) params.set('category', filters.category);
  if (filters.mdaId) params.set('mdaId', filters.mdaId);
  if (filters.priority) params.set('priority', filters.priority);
  if (filters.status) params.set('status', filters.status);
  if (filters.loanId) params.set('loanId', filters.loanId);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useExceptions(filters: ExceptionFilters = {}) {
  return useQuery<ExceptionListResponse>({
    queryKey: ['exceptions', filters],
    queryFn: () => apiClient<ExceptionListResponse>(`/exceptions${buildQueryString(filters)}`),
    staleTime: 30_000,
  });
}

// Backwards-compatible alias used by OperationsHubPage
export function useExceptionQueue() {
  const query = useExceptions({ status: 'open', limit: 5 });
  return {
    ...query,
    data: query.data?.data,
  };
}

export function useExceptionDetail(id: string) {
  return useQuery<ExceptionDetail>({
    queryKey: ['exceptions', id],
    queryFn: () => apiClient<ExceptionDetail>(`/exceptions/${id}`),
    enabled: !!id,
  });
}

export function useExceptionCounts() {
  return useQuery<ExceptionCounts>({
    queryKey: ['exception-counts'],
    queryFn: () => apiClient<ExceptionCounts>('/exceptions/counts'),
    staleTime: 30_000,
  });
}

export function useFlagException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: FlagExceptionRequest) =>
      apiClient<{ exceptionId: string; observationId: string }>('/exceptions/flag', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['exception-counts'] });
    },
  });
}

export function useResolveException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: ResolveExceptionRequest & { id: string }) =>
      apiClient<{ id: string; status: string }>(`/exceptions/${id}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['exception-counts'] });
    },
  });
}
