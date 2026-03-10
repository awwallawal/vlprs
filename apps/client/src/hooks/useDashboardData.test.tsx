import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MOCK_DASHBOARD_METRICS } from '@/mocks/dashboardMetrics';

// Mock apiClient to return mock data (no real server needed)
vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue(MOCK_DASHBOARD_METRICS),
}));

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
    expect(data.totalExposure).toBe('1876500000.00');
    expect(data.fundConfigured).toBe(true);
    expect(typeof data.fundAvailable).toBe('string');
    expect(data.recoveryPeriod).toBe('2026-02');
    expect(typeof data.loansInWindow).toBe('number');
    expect(typeof data.loanCompletionRate).toBe('number');
    expect(typeof data.loanCompletionRateLifetime).toBe('number');
  });
});
