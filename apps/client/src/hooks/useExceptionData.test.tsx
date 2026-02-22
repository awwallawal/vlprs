import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useExceptionQueue } from './useExceptionData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useExceptionQueue', () => {
  it('returns array of 5 exception items', async () => {
    const { result } = renderHook(() => useExceptionQueue(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(5);
    expect(result.current.data![0]).toHaveProperty('id');
    expect(result.current.data![0]).toHaveProperty('priority');
    expect(result.current.data![0]).toHaveProperty('category');
    expect(result.current.data![0]).toHaveProperty('status');
  });
});
