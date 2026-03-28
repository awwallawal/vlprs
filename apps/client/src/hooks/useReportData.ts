import { useQuery } from '@tanstack/react-query';
import type { ExecutiveSummaryReportData, MdaComplianceReportData, VarianceReportData, LoanSnapshotReportData, WeeklyAgReportData } from '@vlprs/shared';
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

/**
 * Fetches Variance Report.
 * @target GET /api/reports/variance
 */
export function useVarianceReport(filters?: { mdaId?: string; periodYear?: number; periodMonth?: number }) {
  const params = new URLSearchParams();
  if (filters?.mdaId) params.set('mdaId', filters.mdaId);
  if (filters?.periodYear) params.set('periodYear', String(filters.periodYear));
  if (filters?.periodMonth) params.set('periodMonth', String(filters.periodMonth));
  const qs = params.toString();

  return useQuery<VarianceReportData>({
    queryKey: ['reports', 'variance', filters],
    queryFn: () => apiClient<VarianceReportData>(`/reports/variance${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
  });
}

/**
 * Fetches Loan Snapshot Report.
 * @target GET /api/reports/loan-snapshot
 */
export function useLoanSnapshotReport(
  mdaId: string | undefined,
  options?: { page?: number; pageSize?: number; sortBy?: string; sortOrder?: 'asc' | 'desc'; statusFilter?: string },
) {
  const params = new URLSearchParams();
  if (mdaId) params.set('mdaId', mdaId);
  if (options?.page) params.set('page', String(options.page));
  if (options?.pageSize) params.set('pageSize', String(options.pageSize));
  if (options?.sortBy) params.set('sortBy', options.sortBy);
  if (options?.sortOrder) params.set('sortOrder', options.sortOrder);
  if (options?.statusFilter) params.set('statusFilter', options.statusFilter);
  const qs = params.toString();

  return useQuery<LoanSnapshotReportData>({
    queryKey: ['reports', 'loan-snapshot', mdaId, options],
    queryFn: () => apiClient<LoanSnapshotReportData>(`/reports/loan-snapshot${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
    enabled: !!mdaId,
  });
}

/**
 * Fetches Weekly AG Report.
 * @target GET /api/reports/weekly-ag
 */
export function useWeeklyAgReport(asOfDate?: string) {
  const params = new URLSearchParams();
  if (asOfDate) params.set('asOfDate', asOfDate);
  const qs = params.toString();

  return useQuery<WeeklyAgReportData>({
    queryKey: ['reports', 'weekly-ag', asOfDate],
    queryFn: () => apiClient<WeeklyAgReportData>(`/reports/weekly-ag${qs ? `?${qs}` : ''}`),
    staleTime: 60_000,
  });
}
