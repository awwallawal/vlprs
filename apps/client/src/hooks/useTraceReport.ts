import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient, authenticatedFetch } from '@/lib/apiClient';
import type { TraceReportData } from '@vlprs/shared';

export function useTraceReport(personKey: string | undefined) {
  return useQuery<TraceReportData>({
    queryKey: ['traceReport', personKey],
    queryFn: () =>
      apiClient<TraceReportData>(`/staff/${encodeURIComponent(personKey!)}/trace`),
    enabled: !!personKey,
    staleTime: 60_000,
  });
}

export function useDownloadTracePdf(personKey: string | undefined) {
  return useMutation<void, Error>({
    mutationFn: async () => {
      if (!personKey) throw new Error('No person key');

      const res = await authenticatedFetch(
        `/staff/${encodeURIComponent(personKey)}/trace/pdf`,
      );

      if (!res.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') ??
        `vlprs-trace-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    },
  });
}
