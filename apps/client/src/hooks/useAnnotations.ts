import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { LoanAnnotation, EventFlagCorrection, EventFlagCorrectionResponse } from '@vlprs/shared';

export function useAnnotations(loanId: string) {
  return useQuery<LoanAnnotation[]>({
    queryKey: ['annotations', loanId],
    queryFn: () => apiClient<LoanAnnotation[]>(`/loans/${loanId}/annotations`),
    enabled: !!loanId,
    staleTime: 30_000,
  });
}

export function useAddAnnotation(loanId: string) {
  const queryClient = useQueryClient();

  return useMutation<LoanAnnotation, Error, { content: string }>({
    mutationFn: ({ content }) =>
      apiClient<LoanAnnotation>(`/loans/${loanId}/annotations`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotations', loanId] });
    },
  });
}

export function useEventFlagCorrections(loanId: string) {
  return useQuery<EventFlagCorrection[]>({
    queryKey: ['event-flag-corrections', loanId],
    queryFn: () => apiClient<EventFlagCorrection[]>(`/loans/${loanId}/event-flag-corrections`),
    enabled: !!loanId,
    staleTime: 30_000,
  });
}

export function useCorrectEventFlag(loanId: string) {
  const queryClient = useQueryClient();

  return useMutation<
    EventFlagCorrectionResponse,
    Error,
    { originalEventFlag: string; newEventFlag: string; correctionReason: string; submissionRowId?: string }
  >({
    mutationFn: (input) =>
      apiClient<EventFlagCorrectionResponse>(`/loans/${loanId}/event-flag-corrections`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-flag-corrections', loanId] });
    },
  });
}
