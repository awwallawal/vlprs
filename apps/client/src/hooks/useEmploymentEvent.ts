import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type {
  CreateEmploymentEventRequest,
  CreateEmploymentEventResponse,
  StaffLookupResult,
  TransferSearchResult,
  ConfirmTransferResponse,
  EmploymentEventListItem,
} from '@vlprs/shared';

/**
 * Staff ID lookup with debounced triggering.
 * Enabled when staffId has 3+ characters.
 */
export function useStaffLookup(staffId: string) {
  return useQuery<StaffLookupResult>({
    queryKey: ['staffLookup', staffId],
    queryFn: () => apiClient<StaffLookupResult>(`/staff-lookup?staffId=${encodeURIComponent(staffId)}`),
    enabled: !!staffId && staffId.length >= 3,
    staleTime: 30_000,
    retry: false,
  });
}

/**
 * Create an employment event.
 * Invalidates checkpoint and employment events queries on success.
 */
export function useCreateEmploymentEvent() {
  const queryClient = useQueryClient();
  return useMutation<
    CreateEmploymentEventResponse,
    Error & { code?: string; status?: number; details?: unknown[] },
    CreateEmploymentEventRequest
  >({
    mutationFn: async (data: CreateEmploymentEventRequest) => {
      return apiClient<CreateEmploymentEventResponse>('/employment-events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preSubmission', 'checkpoint'] });
      queryClient.invalidateQueries({ queryKey: ['employmentEvents'] });
    },
  });
}

/**
 * Transfer search — cross-MDA, returns limited data.
 * Enabled when query has 2+ characters.
 */
export function useTransferSearch(query: string, page = 1) {
  const params = new URLSearchParams({
    query,
    page: String(page),
    limit: '20',
  });
  return useQuery<{ items: TransferSearchResult[]; total: number; page: number; limit: number }>({
    queryKey: ['transferSearch', query, page],
    queryFn: () => apiClient(`/employment-events/transfer-search?${params.toString()}`),
    enabled: query.length >= 2,
    staleTime: 15_000,
  });
}

/**
 * Claim a transfer in for a staff member.
 */
export function useClaimTransfer() {
  const queryClient = useQueryClient();
  return useMutation<
    { transferId: string; status: string },
    Error & { code?: string; status?: number },
    { staffId: string }
  >({
    mutationFn: async (data) => {
      return apiClient('/employment-events/claim-transfer', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferSearch'] });
      queryClient.invalidateQueries({ queryKey: ['employmentEvents'] });
    },
  });
}

/**
 * Confirm one side of a transfer handshake.
 */
export function useConfirmTransfer() {
  const queryClient = useQueryClient();
  return useMutation<
    ConfirmTransferResponse,
    Error & { code?: string; status?: number },
    { transferId: string; side: 'outgoing' | 'incoming' }
  >({
    mutationFn: async (data) => {
      return apiClient('/employment-events/confirm-transfer', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferSearch'] });
      queryClient.invalidateQueries({ queryKey: ['employmentEvents'] });
    },
  });
}

/**
 * Employment event history for an MDA.
 */
export function useEmploymentEvents(mdaId?: string, page = 1) {
  const params = new URLSearchParams({ page: String(page), limit: '20' });
  if (mdaId) params.set('mdaId', mdaId);
  return useQuery<{ items: EmploymentEventListItem[]; total: number; page: number; limit: number }>({
    queryKey: ['employmentEvents', mdaId ?? 'all', page],
    queryFn: () => apiClient(`/employment-events?${params.toString()}`),
    staleTime: 30_000,
  });
}
