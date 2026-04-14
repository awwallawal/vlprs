import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

export interface MultiLoanStaffRow {
  staffName: string;
  loanCount: number;
  mdaCount: number;
  totalPrincipal: string;
  mdaCodes: string;
  mdaNames: string;
  loanRefs: string;
  sampleLoanId: string;
  sampleMdaId: string;
  sampleMdaCode: string;
  activeCount: number;
  completedCount: number;
}

export interface MultiLoanStaffData {
  summary: {
    multiLoanStaff: number;
    triplePlus: number;
    crossMda: number;
    concentratedExposure: string;
  };
  staff: MultiLoanStaffRow[];
}

/**
 * Staff with 2+ loans across same/different MDAs.
 * Surfaces concentration risk for AG/Dept Admin oversight.
 */
export function useMultiLoanStaff() {
  return useQuery<MultiLoanStaffData>({
    queryKey: ['dashboard', 'multi-loan-staff'],
    queryFn: () => apiClient<MultiLoanStaffData>('/dashboard/multi-loan-staff'),
    staleTime: 60_000,
  });
}
