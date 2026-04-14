import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLoanDetail, useLoanSearch } from './useLoanData';

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from '@/lib/apiClient';
const mockApiClient = vi.mocked(apiClient);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useLoanDetail', () => {
  it('fetches loan by ID from the API', async () => {
    mockApiClient.mockResolvedValueOnce({
      id: 'loan-001',
      staffName: 'Akinwale Babatunde',
      status: 'ACTIVE',
    });

    const { result } = renderHook(() => useLoanDetail('loan-001'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockApiClient).toHaveBeenCalledWith('/loans/loan-001');
    expect(result.current.data!.staffName).toBe('Akinwale Babatunde');
    expect(result.current.data!.status).toBe('ACTIVE');
  });

  it('does not fetch when loanId is empty', () => {
    const { result } = renderHook(() => useLoanDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApiClient).not.toHaveBeenCalled();
  });
});

describe('useLoanSearch', () => {
  it('fetches search results from the API', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: [{ staffName: 'Akinwale Babatunde', loanReference: 'VLC-001' }],
    });

    const { result } = renderHook(() => useLoanSearch('Akinwale'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data!.length).toBeGreaterThan(0);
  });

  it('does not fetch when query is empty', () => {
    const { result } = renderHook(() => useLoanSearch(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
