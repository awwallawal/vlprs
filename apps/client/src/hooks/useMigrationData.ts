import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { MigrationMdaStatus, MigrationDashboardMetrics } from '@vlprs/shared';

export function useMigrationStatus() {
  return useQuery<MigrationMdaStatus[]>({
    queryKey: ['migration', 'status'],
    queryFn: () => apiClient<MigrationMdaStatus[]>('/migrations/dashboard'),
    staleTime: 30_000,
  });
}

export function useMigrationDashboardMetrics() {
  return useQuery<MigrationDashboardMetrics>({
    queryKey: ['migration', 'dashboard', 'metrics'],
    queryFn: () => apiClient<MigrationDashboardMetrics>('/migrations/dashboard/metrics'),
    staleTime: 30_000,
  });
}
