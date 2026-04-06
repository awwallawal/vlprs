import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMdaComplianceGrid, useMdaDetail, useMdaLoans } from './useMdaData';

const mockApiClient = vi.fn();
const mockAuthenticatedFetch = vi.fn();
const mockParseJsonResponse = vi.fn();
vi.mock('@/lib/apiClient', () => ({
  apiClient: (...args: unknown[]) => mockApiClient(...args),
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
  parseJsonResponse: (...args: unknown[]) => mockParseJsonResponse(...args),
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
  mockAuthenticatedFetch.mockReset();
  mockParseJsonResponse.mockReset();
});

describe('useMdaComplianceGrid', () => {
  it('returns ComplianceResponse with rows, heatmap, and summary', async () => {
    const mockResponse = {
      rows: [
        { mdaId: 'mda-001', mdaCode: 'OY-FIN', mdaName: 'Ministry of Finance', status: 'pending', lastSubmission: null, recordCount: 0, alignedCount: 0, varianceCount: 0, healthScore: 72, healthBand: 'healthy', submissionCoveragePercent: null, isDark: false, stalenessMonths: null },
      ],
      heatmap: [],
      summary: { submitted: 0, pending: 1, overdue: 0, total: 1, deadlineDate: '2026-03-28T00:00:00.000Z', heatmapSummary: { onTime: 0, gracePeriod: 0, awaiting: 1 } },
    };
    mockApiClient.mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useMdaComplianceGrid(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.rows).toHaveLength(1);
    expect(result.current.data!.rows[0]).toHaveProperty('mdaId');
    expect(result.current.data!.rows[0]).toHaveProperty('mdaName');
    expect(result.current.data!.rows[0]).toHaveProperty('status');
    expect(result.current.data!.summary).toBeDefined();
    expect(result.current.data!.heatmap).toBeDefined();
  });

  it('calls apiClient with /dashboard/compliance', async () => {
    mockApiClient.mockResolvedValueOnce({ rows: [], heatmap: [], summary: { submitted: 0, pending: 0, overdue: 0, total: 0, deadlineDate: '', heatmapSummary: { onTime: 0, gracePeriod: 0, awaiting: 0 } } });

    const { result } = renderHook(() => useMdaComplianceGrid(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/dashboard/compliance');
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
    // Server sends FLAT format: { success, data: [...], pagination: {...} }
    // parseJsonResponse returns the full body, hook manually constructs { data, pagination }
    mockAuthenticatedFetch.mockResolvedValueOnce({});
    mockParseJsonResponse.mockResolvedValueOnce({
      success: true,
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
    });

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
    mockAuthenticatedFetch.mockResolvedValueOnce({});
    mockParseJsonResponse.mockResolvedValueOnce({
      success: true,
      data: [],
      pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 },
    });

    const { result } = renderHook(() => useMdaLoans('mda-003', 'OVERDUE'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockAuthenticatedFetch).toHaveBeenCalledWith(
      expect.stringContaining('classification=OVERDUE'),
    );
  });
});
