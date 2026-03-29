import { useMutation } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/apiClient';
import type { PdfReportType } from '@vlprs/shared';

/**
 * Downloads a report PDF via the server PDF endpoint.
 * Follows the established useDownloadTracePdf pattern: fetch → blob → download link → cleanup.
 */
export function useDownloadReportPdf(reportType: PdfReportType, queryParams: Record<string, string>) {
  return useMutation<void, Error>({
    mutationFn: async () => {
      const params = new URLSearchParams(queryParams);
      const qs = params.toString();
      const endpoint = `/reports/${reportType}/pdf${qs ? `?${qs}` : ''}`;

      const res = await authenticatedFetch(endpoint);

      if (!res.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ??
        `vlprs-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });
}

/**
 * Shares a report via email with PDF attachment.
 */
export function useShareReport() {
  return useMutation<void, Error, { reportType: PdfReportType; recipientEmail: string; coverMessage?: string; reportParams: Record<string, string> }>({
    mutationFn: async (body) => {
      const res = await authenticatedFetch('/reports/share', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Failed to share report');
      }
    },
  });
}
