import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useDashboardMetrics } from './useDashboardData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useDashboardMetrics', () => {
  it('returns dashboard metrics with correct shape', async () => {
    const { result } = renderHook(() => useDashboardMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data!;
    expect(typeof data.activeLoans).toBe('number');
    expect(typeof data.totalExposure).toBe('string');
    expect(data.activeLoans).toBe(2847);
    expect(data.totalExposure).toBe('2418350000.00');
  });
});
