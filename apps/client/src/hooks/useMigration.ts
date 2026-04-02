import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';
import type { MigrationUploadPreview, MigrationUploadSummary, MdaListItem, ValidationSummary, ValidationResult, VarianceCategory, BaselineResult, BatchBaselineResult, BaselineSummary, MigrationRecordDetail } from '@vlprs/shared';

export function useUploadMigration() {
  const queryClient = useQueryClient();

  return useMutation<MigrationUploadPreview, Error, { file: File; mdaId: string }>({
    mutationFn: async ({ file, mdaId }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mdaId', mdaId);

      const res = await authenticatedFetch('/migrations/upload', {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonResponse(res);
      return body.data as MigrationUploadPreview;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
}

export function useConfirmMapping() {
  const queryClient = useQueryClient();

  return useMutation<
    { totalRecords: number; recordsPerSheet: Array<{ sheetName: string; count: number; era: number }> },
    Error,
    { uploadId: string; file: File; mdaId: string; sheets: Array<{ sheetName: string; mappings: Array<{ sourceIndex: number; canonicalField: string | null }> }> }
  >({
    mutationFn: async ({ uploadId, file, mdaId, sheets }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mdaId', mdaId);
      formData.append('sheets', JSON.stringify(sheets));

      const res = await authenticatedFetch(`/migrations/${uploadId}/confirm`, {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonResponse(res);
      return body.data as { totalRecords: number; recordsPerSheet: Array<{ sheetName: string; count: number; era: number }> };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
}

export function useListMigrations(filters?: { page?: number; limit?: number; status?: string }) {
  return useQuery<{ data: MigrationUploadSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>({
    queryKey: ['migrations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.status) params.set('status', filters.status);

      const res = await authenticatedFetch(`/migrations?${params}`);
      const body = await parseJsonResponse(res);
      return { data: body.data as MigrationUploadSummary[], pagination: body.pagination as { page: number; limit: number; total: number; totalPages: number } };
    },
    staleTime: 30_000,
  });
}

export function useMdaList() {
  return useQuery<MdaListItem[]>({
    queryKey: ['mdas', 'active'],
    queryFn: () => apiClient<MdaListItem[]>('/mdas?isActive=true'),
    staleTime: 60_000,
  });
}

export function useValidateUpload() {
  const queryClient = useQueryClient();

  return useMutation<ValidationSummary, Error, { uploadId: string }>({
    mutationFn: ({ uploadId }) =>
      apiClient<ValidationSummary>(`/migrations/${uploadId}/validate`, { method: 'POST' }),
    onSuccess: (_data, { uploadId }) => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['validation', uploadId] });
    },
  });
}

export function useValidationResults(
  uploadId: string,
  filters?: { page?: number; limit?: number; category?: VarianceCategory; sortBy?: string; sortOrder?: string },
) {
  return useQuery<ValidationResult & { pagination: { page: number; limit: number; total: number; totalPages: number } }>({
    queryKey: ['validation', uploadId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.category) params.set('category', filters.category);
      if (filters?.sortBy) params.set('sortBy', filters.sortBy);
      if (filters?.sortOrder) params.set('sortOrder', filters.sortOrder);

      return apiClient<ValidationResult & { pagination: { page: number; limit: number; total: number; totalPages: number } }>(
        `/migrations/${uploadId}/validation?${params}`,
      );
    },
    enabled: !!uploadId,
    staleTime: 30_000,
  });
}

export function useGetMigration(uploadId: string) {
  return useQuery({
    queryKey: ['migrations', uploadId],
    queryFn: () => apiClient(`/migrations/${uploadId}`),
    enabled: !!uploadId,
    staleTime: 30_000,
  });
}

// ─── Baseline Acknowledgment (Story 3.4) ────────────────────────────

export function useCreateBaseline(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<BaselineResult, Error, { recordId: string }>({
    mutationFn: ({ recordId }) =>
      apiClient<BaselineResult>(`/migrations/${uploadId}/records/${recordId}/baseline`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      }),
    onSuccess: (_data, { recordId }) => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['baseline-summary', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['validation', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'records', recordId] });
    },
  });
}

export function useCreateBatchBaseline(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<BatchBaselineResult, Error>({
    mutationFn: () =>
      apiClient<BatchBaselineResult>(`/migrations/${uploadId}/baseline`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['baseline-summary', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['validation', uploadId] });
    },
  });
}

// ─── Record Detail & Correction (Story 8.0b) ───────────────────────

export function useMigrationRecordDetail(uploadId: string, recordId: string | null) {
  return useQuery<MigrationRecordDetail>({
    queryKey: ['migrations', uploadId, 'records', recordId],
    queryFn: () => apiClient<MigrationRecordDetail>(`/migrations/${uploadId}/records/${recordId}`),
    enabled: !!uploadId && !!recordId,
    staleTime: 15_000,
  });
}

export function useCorrectMigrationRecord(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<MigrationRecordDetail, Error, { recordId: string; corrections: Record<string, unknown> }>({
    mutationFn: ({ recordId, corrections }) =>
      apiClient<MigrationRecordDetail>(`/migrations/${uploadId}/records/${recordId}/correct`, {
        method: 'PATCH',
        body: JSON.stringify(corrections),
      }),
    onSuccess: (_data, { recordId }) => {
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'records', recordId] });
      queryClient.invalidateQueries({ queryKey: ['validation', uploadId] });
    },
  });
}

// ─── Period Overlap Check (Story 7.0d) ───────────────────────────────

export function useCheckOverlap() {
  return useMutation<
    { overlap: boolean; existingUploadId?: string; existingRecordCount?: number; newRecordCount?: number; period?: string; mdaName?: string },
    Error,
    { uploadId: string; periodYear?: number; periodMonth?: number }
  >({
    mutationFn: ({ uploadId, periodYear, periodMonth }) => {
      const params = new URLSearchParams();
      if (periodYear !== undefined) params.set('periodYear', String(periodYear));
      if (periodMonth !== undefined) params.set('periodMonth', String(periodMonth));

      return apiClient(`/migrations/${uploadId}/check-overlap?${params}`);
    },
  });
}

export function useConfirmOverlap() {
  return useMutation<{ confirmed: boolean }, Error, { uploadId: string }>({
    mutationFn: ({ uploadId }) =>
      apiClient<{ confirmed: boolean }>(`/migrations/${uploadId}/confirm-overlap`, {
        method: 'POST',
      }),
  });
}

// ─── Discard Upload (Story 8.0c) ────────────────────────────────────

export function useDiscardMigration() {
  const queryClient = useQueryClient();

  return useMutation<{ discarded: true; recordsAffected: number }, Error, { uploadId: string }>({
    mutationFn: ({ uploadId }) =>
      apiClient<{ discarded: true; recordsAffected: number }>(`/migrations/${uploadId}/discard`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
}

export function useBaselineSummary(uploadId: string) {
  return useQuery<BaselineSummary>({
    queryKey: ['baseline-summary', uploadId],
    queryFn: () => apiClient<BaselineSummary>(`/migrations/${uploadId}/baseline-summary`),
    enabled: !!uploadId,
    staleTime: 15_000,
  });
}
