import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAttentionItems } from './useAttentionItems';

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue({
    items: [
      {
        id: 'att-001',
        type: 'zero_deduction',
        description: '8 loans with no deduction for 60+ days',
        mdaName: 'Ministry of Works',
        category: 'review',
        priority: 10,
        count: 8,
        drillDownUrl: '/dashboard/loans?filter=zero-deduction&mda=mda-works',
        timestamp: '2026-02-18T10:00:00Z',
      },
    ],
    totalCount: 1,
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

describe('useAttentionItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns attention items response with items array and totalCount', async () => {
    const { result } = renderHook(() => useAttentionItems(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
    expect(result.current.data!.items).toHaveLength(1);
    expect(result.current.data!.totalCount).toBe(1);
    expect(result.current.data!.items[0]).toHaveProperty('id');
    expect(result.current.data!.items[0]).toHaveProperty('type');
    expect(result.current.data!.items[0]).toHaveProperty('drillDownUrl');
  });
});
