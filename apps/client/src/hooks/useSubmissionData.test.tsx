import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSubmissionHistory } from './useSubmissionData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useSubmissionHistory', () => {
  it('returns array of 3 submissions for mda-003', async () => {
    const { result } = renderHook(() => useSubmissionHistory('mda-003'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(3);
    expect(result.current.data![0]).toHaveProperty('referenceNumber');
    expect(result.current.data![0]).toHaveProperty('status');
  });

  it('returns empty array for unknown MDA', async () => {
    const { result } = renderHook(() => useSubmissionHistory('mda-999'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(0);
  });

  it('does not fetch when mdaId is empty', () => {
    const { result } = renderHook(() => useSubmissionHistory(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
