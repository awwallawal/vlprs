import { useQuery } from '@tanstack/react-query';
import type { ExecutiveSummaryReportData, MdaComplianceReportData } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';

/**
 * Fetches Executive Summary Report.
 * @target GET /api/reports/executive-summary
 */
export function useExecutiveSummaryReport(filters?: { periodYear?: number; periodMonth?: number }) {
  const params = new URLSearchParams();
  if (filters?.periodYear) params.set('periodYear', String(filters.periodYear));
  if (filters?.periodMonth) params.set('periodMonth', String(filters.periodMonth));
  const qs = params.toString();

  return useQuery<ExecutiveSummaryReportData>({
    queryKey: ['reports', 'executive-summary', filters],
    queryFn: () => apiClient<ExecutiveSummaryReportData>(`/reports/executive-summary${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
  });
}

/**
 * Fetches MDA Compliance Report.
 * @target GET /api/reports/mda-compliance
 */
export function useMdaComplianceReport(filters?: { mdaId?: string; periodYear?: number; periodMonth?: number }) {
  const params = new URLSearchParams();
  if (filters?.mdaId) params.set('mdaId', filters.mdaId);
  if (filters?.periodYear) params.set('periodYear', String(filters.periodYear));
  if (filters?.periodMonth) params.set('periodMonth', String(filters.periodMonth));
  const qs = params.toString();

  return useQuery<MdaComplianceReportData>({
    queryKey: ['reports', 'mda-compliance', filters],
    queryFn: () => apiClient<MdaComplianceReportData>(`/reports/mda-compliance${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
  });
}
