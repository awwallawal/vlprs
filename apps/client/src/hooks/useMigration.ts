import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';
import type { MigrationUploadPreview, MigrationUploadSummary, MdaListItem, ValidationSummary, ValidationResult, VarianceCategory, BaselineResult, BatchBaselineResult, BaselineSummary, MigrationRecordDetail, MultiSheetOverlapResponse, FlaggedRecordSummary, MdaReviewProgress, CorrectionWorksheetPreview } from '@vlprs/shared';

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
    { totalRecords: number; recordsPerSheet: Array<{ sheetName: string; count: number; era: number; periodYear: number | null; periodMonth: number | null }> },
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
      return body.data as { totalRecords: number; recordsPerSheet: Array<{ sheetName: string; count: number; era: number; periodYear: number | null; periodMonth: number | null }> };
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

/** Dynamic variant — accepts uploadId at mutation call time (for upload list actions). */
export function useBatchBaseline() {
  const queryClient = useQueryClient();

  return useMutation<BatchBaselineResult, Error, { uploadId: string }>({
    mutationFn: ({ uploadId }) =>
      apiClient<BatchBaselineResult>(`/migrations/${uploadId}/baseline`, {
        method: 'POST',
        body: JSON.stringify({ confirm: true }),
      }),
    onSuccess: (_data, { uploadId }) => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['baseline-summary', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['validation', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['migration-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
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

// ─── Period Overlap Check (Story 8.0d) ───────────────────────────────

export function useCheckOverlap() {
  return useMutation<
    MultiSheetOverlapResponse,
    Error,
    { uploadId: string; sheetPeriods: Array<{ sheetName: string; periodYear: number; periodMonth: number }> }
  >({
    mutationFn: ({ uploadId, sheetPeriods }) =>
      apiClient<MultiSheetOverlapResponse>(`/migrations/${uploadId}/check-overlap`, {
        method: 'POST',
        body: JSON.stringify({ sheetPeriods }),
      }),
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

// ─── Delete Upload (UAT 2026-04-12) ─────────────────────────────────

export function useDeleteMigration() {
  const queryClient = useQueryClient();

  return useMutation<
    { deleted: true; recordsAffected: number; loansRemoved: number },
    Error,
    { uploadId: string; confirmFilename: string; reason: string }
  >({
    mutationFn: ({ uploadId, confirmFilename, reason }) =>
      apiClient<{ deleted: true; recordsAffected: number; loansRemoved: number }>(`/migrations/${uploadId}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmFilename, reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['migration-metrics'] });
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

// ─── MDA Review Hooks (Story 8.0j) ─────���───────────────────────────

export function useFlaggedRecords(
  uploadId: string,
  filters?: { page?: number; limit?: number; status?: 'pending' | 'reviewed' | 'all' },
) {
  return useQuery<{ records: FlaggedRecordSummary[]; total: number; page: number; limit: number }>({
    queryKey: ['migrations', uploadId, 'review', 'records', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.status) params.set('status', filters.status);

      return apiClient<{ records: FlaggedRecordSummary[]; total: number; page: number; limit: number }>(
        `/migrations/${uploadId}/review/records?${params}`,
      );
    },
    enabled: !!uploadId,
    staleTime: 15_000,
  });
}

/** Fetches ALL flagged records across all uploads for the user's MDA scope. */
export function useAllFlaggedRecords(
  filters?: { page?: number; limit?: number; status?: 'pending' | 'reviewed' | 'all'; mda?: string },
) {
  return useQuery<{ records: FlaggedRecordSummary[]; total: number; page: number; limit: number }>({
    queryKey: ['migrations', 'review', 'all', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.limit) params.set('limit', String(filters.limit));
      if (filters?.status) params.set('status', filters.status);
      if (filters?.mda) params.set('mda', filters.mda);

      return apiClient<{ records: FlaggedRecordSummary[]; total: number; page: number; limit: number }>(
        `/migrations/review/all?${params}`,
      );
    },
    staleTime: 15_000,
  });
}

/** All-MDA progress aggregated across all active uploads (UAT 2026-04-14) */
export function useAllMdaReviewProgress() {
  return useQuery<MdaReviewProgress[]>({
    queryKey: ['migrations', 'review', 'progress-all'],
    queryFn: () => apiClient<MdaReviewProgress[]>('/migrations/review/progress-all'),
    staleTime: 30_000,
  });
}

export function useMdaReviewProgress(uploadId: string) {
  return useQuery<MdaReviewProgress[]>({
    queryKey: ['migrations', uploadId, 'review', 'progress'],
    queryFn: () => apiClient<MdaReviewProgress[]>(`/migrations/${uploadId}/review/progress`),
    enabled: !!uploadId,
    staleTime: 15_000,
  });
}

export function useSubmitReview(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<MigrationRecordDetail, Error, { recordId: string; corrections: Record<string, unknown>; correctionReason: string }>({
    mutationFn: ({ recordId, corrections, correctionReason }) =>
      apiClient<MigrationRecordDetail>(`/migrations/${uploadId}/records/${recordId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ ...corrections, correctionReason }),
      }),
    onSuccess: (_data, { recordId }) => {
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'review'] });
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'records', recordId] });
    },
  });
}

export function useMarkReviewed(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<MigrationRecordDetail, Error, { recordId: string; correctionReason: string }>({
    mutationFn: ({ recordId, correctionReason }) =>
      apiClient<MigrationRecordDetail>(`/migrations/${uploadId}/records/${recordId}/mark-reviewed`, {
        method: 'PATCH',
        body: JSON.stringify({ correctionReason }),
      }),
    onSuccess: (_data, { recordId }) => {
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'review'] });
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'records', recordId] });
    },
  });
}

export function useExtendReviewWindow(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, Error, { mdaId: string }>({
    mutationFn: ({ mdaId }) =>
      apiClient<{ message: string }>(`/migrations/${uploadId}/review/extend-window`, {
        method: 'POST',
        body: JSON.stringify({ mdaId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'review', 'progress'] });
    },
  });
}

export function useBaselineReviewed(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ baselinedCount: number }, Error>({
    mutationFn: () =>
      apiClient<{ baselinedCount: number }>(`/migrations/${uploadId}/baseline-reviewed`, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'review'] });
      queryClient.invalidateQueries({ queryKey: ['baseline-summary', uploadId] });
    },
  });
}

export function useDownloadWorksheet(uploadId: string) {
  return useMutation<Blob, Error>({
    mutationFn: async () => {
      const res = await authenticatedFetch(`/migrations/${uploadId}/review/worksheet`);
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error?.message ?? 'Failed to download worksheet');
      }
      return res.blob();
    },
  });
}

export function useUploadWorksheet(uploadId: string) {
  return useMutation<CorrectionWorksheetPreview, Error, { file: File }>({
    mutationFn: async ({ file }) => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await authenticatedFetch(`/migrations/${uploadId}/review/worksheet`, {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonResponse(res);
      return body.data as CorrectionWorksheetPreview;
    },
  });
}

export function useApplyWorksheet(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<{ applied: number; reviewed: number }, Error, CorrectionWorksheetPreview>({
    mutationFn: (preview) =>
      apiClient<{ applied: number; reviewed: number }>(`/migrations/${uploadId}/review/worksheet/apply`, {
        method: 'POST',
        body: JSON.stringify(preview),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations', uploadId, 'review'] });
      queryClient.invalidateQueries({ queryKey: ['validation', uploadId] });
    },
  });
}

// ─── Federated Upload: Approve/Reject (Story 15.0f) ────────────────

export function useApproveUpload() {
  const queryClient = useQueryClient();

  return useMutation<{ uploadId: string; status: 'validated' }, Error, { uploadId: string }>({
    mutationFn: ({ uploadId }) =>
      apiClient<{ uploadId: string; status: 'validated' }>(`/migrations/${uploadId}/approve`, {
        method: 'PATCH',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
}

export function useRejectUpload() {
  const queryClient = useQueryClient();

  return useMutation<{ uploadId: string; status: 'rejected'; reason: string }, Error, { uploadId: string; reason: string }>({
    mutationFn: ({ uploadId, reason }) =>
      apiClient<{ uploadId: string; status: 'rejected'; reason: string }>(`/migrations/${uploadId}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
    },
  });
}
