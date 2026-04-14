import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUsers, useMdas } from './useUserAdmin';

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn(),
}));

import { apiClient } from '@/lib/apiClient';

const mockApiClient = vi.mocked(apiClient);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const sampleUsers = [
  { id: 'u-1', email: 'adebayo@example.com', firstName: 'Adebayo', lastName: 'Ogunlesi', role: 'super_admin', mdaId: null, isActive: true },
  { id: 'u-2', email: 'officer@example.com', firstName: 'Olumide', lastName: 'Adeyemi', role: 'mda_officer', mdaId: 'mda-1', isActive: true },
];

describe('useUsers', () => {
  beforeEach(() => {
    mockApiClient.mockReset();
  });

  it('returns paginated user list with correct shape', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: sampleUsers,
      pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
    });

    const { result } = renderHook(() => useUsers(), { wrapper: createWrapper() });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const response = result.current.data!;
    expect(Array.isArray(response.data)).toBe(true);
    expect(response.pagination.page).toBe(1);
    expect(response.pagination.totalItems).toBe(2);
  });

  it('filters by role', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: [sampleUsers[1]],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });

    const { result } = renderHook(() => useUsers({ role: 'mda_officer' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient).toHaveBeenCalledWith(expect.stringContaining('role=mda_officer'));
    expect(result.current.data!.data.every((u) => u.role === 'mda_officer')).toBe(true);
  });

  it('filters by status', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: sampleUsers,
      pagination: { page: 1, pageSize: 25, totalItems: 2, totalPages: 1 },
    });

    const { result } = renderHook(() => useUsers({ status: 'active' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient).toHaveBeenCalledWith(expect.stringContaining('status=active'));
  });

  it('filters by search term', async () => {
    mockApiClient.mockResolvedValueOnce({
      data: [sampleUsers[0]],
      pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
    });

    const { result } = renderHook(() => useUsers({ search: 'adebayo' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockApiClient).toHaveBeenCalledWith(expect.stringContaining('search=adebayo'));
  });

  it('uses different query keys for different filters', () => {
    const wrapper = createWrapper();
    const { result: result1 } = renderHook(() => useUsers({ role: 'mda_officer' }), { wrapper });
    const { result: result2 } = renderHook(() => useUsers({ role: 'dept_admin' }), { wrapper });
    expect(result1.current).not.toBe(result2.current);
  });
});

describe('useMdas', () => {
  beforeEach(() => {
    mockApiClient.mockReset();
  });

  it('returns MDA list with correct shape', async () => {
    mockApiClient.mockResolvedValueOnce([
      { id: 'mda-1', name: 'Ministry of Health', code: 'MOH' },
      { id: 'mda-2', name: 'Bureau of Internal Revenue', code: 'BIR' },
    ]);

    const { result } = renderHook(() => useMdas(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const mdas = result.current.data!;
    expect(Array.isArray(mdas)).toBe(true);
    expect(mdas.length).toBeGreaterThan(0);
    expect(mdas[0]).toHaveProperty('id');
    expect(mdas[0]).toHaveProperty('name');
    expect(mdas[0]).toHaveProperty('code');
  });
});
