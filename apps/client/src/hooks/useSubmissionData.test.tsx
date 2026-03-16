import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSubmissionHistory } from './useSubmissionData';

// Mock apiClient to avoid real API calls
vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'sub-1',
        referenceNumber: 'BIR-2026-03-0001',
        submissionDate: '2026-03-15T09:30:00Z',
        recordCount: 42,
        alignedCount: 0,
        varianceCount: 0,
        status: 'confirmed',
      },
    ],
    total: 1,
    page: 1,
    pageSize: 20,
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

describe('useSubmissionHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated submission data', async () => {
    const { result } = renderHook(() => useSubmissionHistory('mda-001'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0]).toHaveProperty('referenceNumber');
    expect(result.current.data?.items[0]).toHaveProperty('status');
    expect(result.current.data?.total).toBe(1);
  });

  it('fetches without mdaId (server scopes via JWT)', async () => {
    const { result } = renderHook(() => useSubmissionHistory(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.items).toHaveLength(1);
  });
});
