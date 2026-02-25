import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useLoanDetail, useLoanSearch } from './useLoanData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useLoanDetail', () => {
  it('returns loan with borrowerName for loan-001', async () => {
    const { result } = renderHook(() => useLoanDetail('loan-001'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data!;
    expect(data.borrowerName).toBe('Akinwale Babatunde');
    expect(data.loanId).toBe('loan-001');
    expect(data.status).toBe('ACTIVE');
  });

  it('does not fetch when loanId is empty', () => {
    const { result } = renderHook(() => useLoanDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useLoanSearch', () => {
  it('returns results when searching for "Akinwale"', async () => {
    const { result } = renderHook(() => useLoanSearch('Akinwale'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data!;
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((r) => r.borrowerName.toLowerCase().includes('akinwale'))).toBe(true);
  });

  it('does not fetch when query is empty', () => {
    const { result } = renderHook(() => useLoanSearch(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
