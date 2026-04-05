import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, authenticatedFetch, isApiError } from '@/lib/apiClient';

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
