import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMigrationStatus } from './useMigrationData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMigrationStatus', () => {
  it('returns array of 63 migration status items', async () => {
    const { result } = renderHook(() => useMigrationStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(63);
    expect(result.current.data![0]).toHaveProperty('mdaId');
    expect(result.current.data![0]).toHaveProperty('stage');
    expect(result.current.data![0]).toHaveProperty('recordCounts');
  });
});
