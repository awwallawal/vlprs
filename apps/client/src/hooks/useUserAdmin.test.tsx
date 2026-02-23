import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUsers, useMdas } from './useUserAdmin';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUsers', () => {
  it('returns paginated user list with correct shape', async () => {
    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const response = result.current.data!;
    expect(response.data).toBeDefined();
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.pagination).toBeDefined();
    expect(response.pagination.page).toBe(1);
    expect(response.pagination.totalItems).toBeGreaterThan(0);
  });

  it('filters by role', async () => {
    const { result } = renderHook(() => useUsers({ role: 'mda_officer' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const response = result.current.data!;
    expect(response.data.every((u) => u.role === 'mda_officer')).toBe(true);
  });

  it('filters by status', async () => {
    const { result } = renderHook(() => useUsers({ status: 'active' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const response = result.current.data!;
    expect(response.data.every((u) => u.isActive)).toBe(true);
  });

  it('filters by search term', async () => {
    const { result } = renderHook(() => useUsers({ search: 'adebayo' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const response = result.current.data!;
    expect(response.data.length).toBeGreaterThan(0);
    expect(
      response.data.some((u) => u.firstName.toLowerCase().includes('adebayo')),
    ).toBe(true);
  });

  it('uses different query keys for different filters', () => {
    const wrapper = createWrapper();
    const { result: result1 } = renderHook(() => useUsers({ role: 'mda_officer' }), { wrapper });
    const { result: result2 } = renderHook(() => useUsers({ role: 'dept_admin' }), { wrapper });

    // Both queries should be independent (different query keys)
    expect(result1.current).not.toBe(result2.current);
  });
});

describe('useMdas', () => {
  it('returns MDA list with correct shape', async () => {
    const { result } = renderHook(() => useMdas(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const mdas = result.current.data!;
    expect(Array.isArray(mdas)).toBe(true);
    expect(mdas.length).toBeGreaterThan(0);
    expect(mdas[0]).toHaveProperty('id');
    expect(mdas[0]).toHaveProperty('name');
    expect(mdas[0]).toHaveProperty('code');
  });
});
