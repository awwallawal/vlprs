import { useQuery } from '@tanstack/react-query';
import { apiClient, authenticatedFetch } from '@/lib/apiClient';
import type { PaginatedBeneficiaries, BeneficiaryListMetrics } from '@vlprs/shared';

interface BeneficiaryFilters {
  page?: number;
  pageSize?: number;
  mdaId?: string;
  search?: string;
  sortBy?: 'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate';
  sortOrder?: 'asc' | 'desc';
}

function buildQueryString(filters: BeneficiaryFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  if (filters.mdaId) params.set('mdaId', filters.mdaId);
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useBeneficiaryList(filters: BeneficiaryFilters) {
  return useQuery<PaginatedBeneficiaries>({
    queryKey: ['migration', 'beneficiaries', filters],
    queryFn: () =>
      apiClient<PaginatedBeneficiaries>(`/migrations/beneficiaries${buildQueryString(filters)}`),
    staleTime: 30_000,
  });
}

export function useBeneficiaryMetrics() {
  return useQuery<BeneficiaryListMetrics>({
    queryKey: ['migration', 'beneficiaries', 'metrics'],
    queryFn: () =>
      apiClient<BeneficiaryListMetrics>('/migrations/beneficiaries/metrics'),
    staleTime: 30_000,
  });
}

export function useExportBeneficiaries() {
  return async (filters: BeneficiaryFilters) => {
    const qs = buildQueryString(filters);
    const res = await authenticatedFetch(`/migrations/beneficiaries/export${qs}`);

    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = res.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '')
      || `vlprs-beneficiary-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };
}
