import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useExceptionQueue } from './useExceptionData';

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue({
    data: [
      { id: 'e1', priority: 'high', category: 'over_deduction', staffId: 'S1', staffName: 'Akin', mdaId: 'm1', mdaName: 'Works', description: 'Test', createdAt: '2026-03-20T10:00:00Z', status: 'open', resolvedAt: null, loanId: 'l1', observationId: 'o1', flagNotes: null },
      { id: 'e2', priority: 'medium', category: 'inactive', staffId: 'S2', staffName: 'Funke', mdaId: 'm1', mdaName: 'Works', description: 'Test2', createdAt: '2026-03-19T10:00:00Z', status: 'open', resolvedAt: null, loanId: null, observationId: 'o2', flagNotes: null },
    ],
    total: 2,
    page: 1,
  }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useExceptionQueue', () => {
  it('returns array of exception items from API', async () => {
    const { result } = renderHook(() => useExceptionQueue(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]).toHaveProperty('id');
    expect(result.current.data![0]).toHaveProperty('priority');
    expect(result.current.data![0]).toHaveProperty('category');
    expect(result.current.data![0]).toHaveProperty('status');
  });
});
