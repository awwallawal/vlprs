import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMdaComplianceGrid, useMdaDetail } from './useMdaData';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useMdaComplianceGrid', () => {
  it('returns array of 63 MDA compliance rows', async () => {
    const { result } = renderHook(() => useMdaComplianceGrid(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(63);
    expect(result.current.data![0]).toHaveProperty('mdaId');
    expect(result.current.data![0]).toHaveProperty('mdaName');
    expect(result.current.data![0]).toHaveProperty('status');
  });
});

describe('useMdaDetail', () => {
  it('returns MdaSummary for mda-003 with name "Ministry of Health"', async () => {
    const { result } = renderHook(() => useMdaDetail('mda-003'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data!;
    expect(data.name).toBe('Ministry of Health');
    expect(data.mdaId).toBe('mda-003');
    expect(data.code).toBe('MOH');
  });

  it('does not fetch when mdaId is empty', () => {
    const { result } = renderHook(() => useMdaDetail(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});
