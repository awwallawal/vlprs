import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, isApiError } from '@/lib/apiClient';
import type {
  CertificateListResponse,
  CertificateNotificationStatus,
  CertificateSortBy,
} from '@vlprs/shared';

interface CertificateMetadata {
  certificateId: string;
  loanId: string;
  verificationToken: string;
  beneficiaryName: string;
  staffId: string;
  mdaName: string;
  loanReference: string;
  completionDate: string;
  generatedAt: string;
  notifiedMdaAt: string | null;
  notifiedBeneficiaryAt: string | null;
  notificationNotes: string | null;
}

interface ResendResult {
  mdaOfficersNotified: number;
  beneficiaryNotified: boolean;
  notes: string[];
}

/**
 * Fetches certificate metadata for a completed loan.
 * Only enabled when the loan status is COMPLETED.
 */
export function useCertificate(loanId: string, enabled: boolean) {
  return useQuery<CertificateMetadata | null>({
    queryKey: ['certificates', loanId],
    queryFn: async () => {
      try {
        return await apiClient<CertificateMetadata>(`/certificates/${loanId}`);
      } catch (err: unknown) {
        if (isApiError(err) && err.status === 404) {
          return null;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 60_000,
  });
}

/**
 * Downloads the Auto-Stop Certificate PDF for a completed loan.
 * Follows the established useDownloadReportPdf pattern: fetch → blob → download link → cleanup.
 */
export function useDownloadCertificatePdf(loanId: string) {
  return useMutation<void, Error>({
    mutationFn: async () => {
      const res = await authenticatedFetch(`/certificates/${loanId}/pdf`);

      if (!res.ok) {
        throw new Error('Certificate PDF generation failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ??
        `auto-stop-certificate-${loanId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });
}

/**
 * Resend Auto-Stop Certificate notifications (SUPER_ADMIN only).
 * Invalidates certificate query on success to refresh notification timestamps.
 */
export function useResendNotifications(loanId: string) {
  const queryClient = useQueryClient();
  return useMutation<ResendResult, Error>({
    mutationFn: async () => {
      return apiClient<ResendResult>(`/certificates/${loanId}/resend`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates', loanId] });
      queryClient.invalidateQueries({ queryKey: ['certificates', 'list'] });
    },
  });
}

// ─── Certificate List (Story 15.0i) ────────────────────────────────

export interface CertificateListFilters {
  mdaId?: string;
  notificationStatus?: CertificateNotificationStatus;
  page?: number;
  limit?: number;
  sortBy?: CertificateSortBy;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Fetches paginated list of issued Auto-Stop Certificates.
 * Backend returns wrapped format `{ success, data: { data, total, page, pageSize } }`.
 * `apiClient<CertificateListResponse>` returns the inner object (wrapped format).
 */
export function useCertificateList(filters: CertificateListFilters = {}) {
  // Strip undefined entries so the queryKey is stable when filters toggle on/off
  // (otherwise React Query treats `{mdaId: undefined}` and `{}` as distinct keys
  // and we get unnecessary cache misses).
  const definedFilters = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined),
  );

  const params = new URLSearchParams();
  if (filters.mdaId) params.set('mdaId', filters.mdaId);
  if (filters.notificationStatus) params.set('notificationStatus', filters.notificationStatus);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

  const queryString = params.toString();
  const endpoint = queryString ? `/certificates?${queryString}` : '/certificates';

  return useQuery<CertificateListResponse>({
    queryKey: ['certificates', 'list', definedFilters],
    queryFn: () => apiClient<CertificateListResponse>(endpoint),
    staleTime: 30_000,
  });
}
