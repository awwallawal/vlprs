import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getAuthHeaders } from '@/lib/fetchHelpers';
import type { MigrationUploadPreview, MigrationUploadSummary, MdaListItem, ValidationSummary, ValidationResult, VarianceCategory, BaselineResult, BatchBaselineResult, BaselineSummary } from '@vlprs/shared';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useUploadMigration() {
  const queryClient = useQueryClient();

  return useMutation<MigrationUploadPreview, Error, { file: File; mdaId: string }>({
    mutationFn: async ({ file, mdaId }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mdaId', mdaId);

      const res = await fetch(`${API_BASE}/migrations/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Upload failed');
      }
      return body.data;
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

      const res = await fetch(`${API_BASE}/migrations/${uploadId}/confirm`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Confirmation failed');
      }
      return body.data;
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

      const { accessToken } = useAuthStore.getState();
      const res = await fetch(`${API_BASE}/migrations?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Failed to load migrations');
      }
      return { data: body.data, pagination: body.pagination };
    },
    staleTime: 30_000,
  });
}

export function useMdaList() {
  return useQuery<MdaListItem[]>({
    queryKey: ['mdas', 'active'],
    queryFn: async () => {
      const { accessToken } = useAuthStore.getState();
      const res = await fetch(`${API_BASE}/mdas?isActive=true`, {
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Failed to load MDAs');
      }
      return body.data;
    },
    staleTime: 60_000,
  });
}

export function useValidateUpload() {
  const queryClient = useQueryClient();

  return useMutation<ValidationSummary, Error, { uploadId: string }>({
    mutationFn: async ({ uploadId }) => {
      const res = await fetch(`${API_BASE}/migrations/${uploadId}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Validation failed');
      }
      return body.data;
    },
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

      const { accessToken } = useAuthStore.getState();
      const res = await fetch(`${API_BASE}/migrations/${uploadId}/validation?${params}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Failed to load validation results');
      }
      return body.data;
    },
    enabled: !!uploadId,
    staleTime: 30_000,
  });
}

export function useGetMigration(uploadId: string) {
  return useQuery({
    queryKey: ['migrations', uploadId],
    queryFn: async () => {
      const { accessToken } = useAuthStore.getState();
      const res = await fetch(`${API_BASE}/migrations/${uploadId}`, {
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Failed to load migration');
      }
      return body.data;
    },
    enabled: !!uploadId,
    staleTime: 30_000,
  });
}

// ─── Baseline Acknowledgment (Story 3.4) ────────────────────────────

export function useCreateBaseline(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<BaselineResult, Error, { recordId: string }>({
    mutationFn: async ({ recordId }) => {
      const res = await fetch(`${API_BASE}/migrations/${uploadId}/records/${recordId}/baseline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ confirm: true }),
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Baseline creation failed');
      }
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['baseline-summary', uploadId] });
      queryClient.invalidateQueries({ queryKey: ['validation', uploadId] });
    },
  });
}

export function useCreateBatchBaseline(uploadId: string) {
  const queryClient = useQueryClient();

  return useMutation<BatchBaselineResult, Error>({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/migrations/${uploadId}/baseline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ confirm: true }),
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Batch baseline creation failed');
      }
      return body.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migrations'] });
      queryClient.invalidateQueries({ queryKey: ['baseline-summary', uploadId] });
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
    mutationFn: async ({ uploadId, periodYear, periodMonth }) => {
      const params = new URLSearchParams();
      if (periodYear !== undefined) params.set('periodYear', String(periodYear));
      if (periodMonth !== undefined) params.set('periodMonth', String(periodMonth));

      const res = await fetch(`${API_BASE}/migrations/${uploadId}/check-overlap?${params}`, {
        headers: { ...getAuthHeaders() },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Overlap check failed');
      }
      return body.data;
    },
  });
}

export function useConfirmOverlap() {
  return useMutation<{ confirmed: boolean }, Error, { uploadId: string }>({
    mutationFn: async ({ uploadId }) => {
      const res = await fetch(`${API_BASE}/migrations/${uploadId}/confirm-overlap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Overlap confirmation failed');
      }
      return body.data;
    },
  });
}

export function useBaselineSummary(uploadId: string) {
  return useQuery<BaselineSummary>({
    queryKey: ['baseline-summary', uploadId],
    queryFn: async () => {
      const { accessToken } = useAuthStore.getState();
      const res = await fetch(`${API_BASE}/migrations/${uploadId}/baseline-summary`, {
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: 'include',
      });

      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message || 'Failed to load baseline summary');
      }
      return body.data;
    },
    enabled: !!uploadId,
    staleTime: 15_000,
  });
}
