import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';

interface ApprovalBatch {
  id: string;
  label: string;
  year: number | null;
  listType: string;
  notes: string | null;
  uploadedBy: string;
  uploadedAt: string;
  createdAt: string;
  recordCount: number;
}

interface CommitteeFilePreview {
  schemaType: 'approval' | 'retiree';
  sheets: Array<{ sheetName: string; recordCount: number; skipped: boolean; skipReason?: string }>;
  records: Array<Record<string, unknown>>;
  dataQualityFlags: Array<{ row: number; field: string; issue: string }>;
}

export function useCommitteeListBatches() {
  return useQuery<ApprovalBatch[]>({
    queryKey: ['committee-lists', 'batches'],
    queryFn: () => apiClient<ApprovalBatch[]>('/committee-lists/batches'),
    staleTime: 30_000,
  });
}

export function useUploadCommitteeFile() {
  return useMutation<CommitteeFilePreview, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await authenticatedFetch('/committee-lists/upload', {
        method: 'POST',
        body: formData,
      });
      const body = await parseJsonResponse(res);
      return body.data as CommitteeFilePreview;
    },
  });
}

export function useConfirmCommitteeUpload() {
  const queryClient = useQueryClient();

  return useMutation<{ count: number }, Error, {
    records: Array<Record<string, unknown>>;
    mdaMappings: Record<string, string>;
    batchId: string;
  }>({
    mutationFn: (body) =>
      apiClient<{ count: number }>('/committee-lists/confirm', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committee-lists'] });
    },
  });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation<ApprovalBatch, Error, {
    label: string;
    listType: string;
    year?: number;
    notes?: string;
  }>({
    mutationFn: (body) =>
      apiClient<ApprovalBatch>('/committee-lists/batches', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committee-lists', 'batches'] });
    },
  });
}

export function useBatchDetail(batchId: string | undefined) {
  return useQuery<ApprovalBatch & { beneficiaries: Array<Record<string, unknown>> }>({
    queryKey: ['committee-lists', 'batch', batchId ?? '__none__'],
    queryFn: () =>
      apiClient<ApprovalBatch & { beneficiaries: Array<Record<string, unknown>> }>(
        `/committee-lists/batches/${batchId}`,
      ),
    enabled: !!batchId,
    staleTime: 30_000,
  });
}

// ─── Track 2 Hooks ──────────────────────────────────────────────────

interface ThreeVectorResult {
  sourceRow: number;
  name: string;
  category: 'clean' | 'variance' | 'requires_verification';
  schemeExpected: { totalLoan: string; monthlyDeduction: string; totalInterest: string } | null;
  reverseEngineered: { totalLoan: string | null; monthlyDeduction: string | null } | null;
  committeeDeclared: { totalLoan: string | null; monthlyDeduction: string | null };
}

interface MatchResult {
  sourceRow: number;
  name: string;
  status: 'matched' | 'pending';
  matchedLoanId: string | null;
  matchedLoanRef: string | null;
}

export function useThreeVectorValidation() {
  return useMutation<{ results: ThreeVectorResult[] }, Error, Array<Record<string, unknown>>>({
    mutationFn: (records) =>
      apiClient<{ results: ThreeVectorResult[] }>('/committee-lists/validate', {
        method: 'POST',
        body: JSON.stringify({ records }),
      }),
  });
}

export function useMatchAndClassify() {
  return useMutation<{ results: MatchResult[] }, Error, {
    records: Array<Record<string, unknown>>;
    mdaMappings: Record<string, string>;
  }>({
    mutationFn: (body) =>
      apiClient<{ results: MatchResult[] }>('/committee-lists/match', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export function useProcessRetiree() {
  const queryClient = useQueryClient();

  return useMutation<{ processed: number; errors: string[] }, Error, {
    records: Array<Record<string, unknown>>;
    mdaMappings: Record<string, string>;
    batchId: string;
    uploadReference?: string;
  }>({
    mutationFn: (body) =>
      apiClient<{ processed: number; errors: string[] }>('/committee-lists/process', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['committee-lists'] });
    },
  });
}
