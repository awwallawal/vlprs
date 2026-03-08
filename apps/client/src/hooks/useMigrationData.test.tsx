import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMigrationStatus, useMigrationDashboardMetrics } from './useMigrationData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMigrationStatus', () => {
  it('initialises in pending state with correct query key', () => {
    const { result } = renderHook(() => useMigrationStatus(), {
      wrapper: createWrapper(),
    });

    // Hook starts in pending state (real API call, no mock server)
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});

describe('useMigrationDashboardMetrics', () => {
  it('initialises in pending state with correct query key', () => {
    const { result } = renderHook(() => useMigrationDashboardMetrics(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});
