import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMdaComplianceGrid, useMdaDetail, useMdaLoans } from './useMdaData';

const mockApiClient = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  mockApiClient.mockReset();
});

describe('useMdaComplianceGrid', () => {
  it('returns array of 63 MDA compliance rows', async () => {
    const { result } = renderHook(() => useMdaComplianceGrid(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(63);
    expect(result.current.data![0]).toHaveProperty('mdaId');
    expect(result.current.data![0]).toHaveProperty('mdaName');
    expect(result.current.data![0]).toHaveProperty('status');
  });
});

describe('useMdaDetail', () => {
  it('returns MdaSummary for mda-003 with name "Ministry of Health"', async () => {
    mockApiClient.mockResolvedValueOnce({
      mdaId: 'mda-003',
      name: 'Ministry of Health',
      code: 'MOH',
      loanCount: 45,
      totalExposure: '125000000.00',
      monthlyRecovery: '5200000.00',
      healthScore: 72,
      healthBand: 'attention',
    });

    const { result } = renderHook(() => useMdaDetail('mda-003'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data!;
    expect(data.name).toBe('Ministry of Health');
    expect(data.mdaId).toBe('mda-003');
    expect(data.code).toBe('MOH');
  });

  it('does not fetch when mdaId is empty', () => {
    const { result } = renderHook(() => useMdaDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useMdaLoans', () => {
  it('returns paginated loan list for an MDA', async () => {
    const mockLoans = {
      data: [
        {
          loanId: 'loan-001',
          staffName: 'Test Worker',
          staffId: 'STF-001',
          mdaName: 'Ministry of Health',
          loanReference: 'VLC-2026-0001',
          outstandingBalance: '500000.00',
          status: 'ACTIVE',
          installmentsPaid: 5,
          installmentsRemaining: 19,
          principalAmount: '600000.00',
          tenureMonths: 24,
          classification: 'ON_TRACK',
        },
      ],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    };
    mockApiClient.mockResolvedValueOnce(mockLoans);

    const { result } = renderHook(() => useMdaLoans('mda-003'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.data).toHaveLength(1);
    expect(result.current.data!.data[0].loanId).toBe('loan-001');
    expect(result.current.data!.pagination.totalItems).toBe(1);
  });

  it('does not fetch when mdaId is empty', () => {
    const { result } = renderHook(() => useMdaLoans(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('passes classification filter to API', async () => {
    mockApiClient.mockResolvedValueOnce({ data: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } });

    const { result } = renderHook(() => useMdaLoans('mda-003', 'OVERDUE'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiClient).toHaveBeenCalledWith(
      expect.stringContaining('classification=OVERDUE'),
    );
  });
});
