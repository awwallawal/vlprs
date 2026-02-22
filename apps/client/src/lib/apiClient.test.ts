import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@vlprs/shared';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Must import after mocking
const { apiClient, resetRefreshState } = await import('./apiClient');

const testUser: User = {
  id: 'test-user-1',
  email: 'admin@vlprs.gov.ng',
  firstName: 'Test',
  lastName: 'Admin',
  role: 'super_admin',
  mdaId: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
    resetRefreshState();
  });

  it('attaches Authorization header when token exists', async () => {
    useAuthStore.getState().setAuth('test-token', testUser);
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { id: 1 } }),
    );

    await apiClient('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('omits Authorization header when no token', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { id: 1 } }),
    );

    await apiClient('/test');

    const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it('returns parsed data from success response envelope', async () => {
    useAuthStore.getState().setAuth('token', testUser);
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { name: 'test' } }),
    );

    const result = await apiClient<{ name: string }>('/test');
    expect(result).toEqual({ name: 'test' });
  });

  it('throws error with code and message from error response', async () => {
    useAuthStore.getState().setAuth('token', testUser);
    mockFetch.mockResolvedValueOnce(
      mockResponse(400, {
        success: false,
        error: { code: 'VALIDATION_FAILED', message: 'Bad input' },
      }),
    );

    await expect(apiClient('/test')).rejects.toMatchObject({
      message: 'Bad input',
      code: 'VALIDATION_FAILED',
      status: 400,
    });
  });

  it('on 401: calls refresh endpoint, retries original request', async () => {
    useAuthStore.getState().setAuth('expired-token', testUser);

    // First call returns 401
    mockFetch.mockResolvedValueOnce(mockResponse(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } }));
    // Refresh call succeeds
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { accessToken: 'new-token' } }),
    );
    // Retry with new token succeeds
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { result: 'ok' } }),
    );

    const result = await apiClient<{ result: string }>('/protected');

    expect(result).toEqual({ result: 'ok' });
    expect(mockFetch).toHaveBeenCalledTimes(3);
    // Verify refresh was called
    expect(mockFetch.mock.calls[1][0]).toContain('/auth/refresh');
    // Verify retry uses new token
    const retryHeaders = (mockFetch.mock.calls[2][1] as RequestInit).headers as Record<string, string>;
    expect(retryHeaders.Authorization).toBe('Bearer new-token');
  });

  it('on 401 + refresh failure: clears auth and redirects to /login', async () => {
    useAuthStore.getState().setAuth('expired-token', testUser);

    // Mock window.location
    const locationSpy = vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      href: '',
    } as Location);
    // Also need to allow setting href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    // First call returns 401
    mockFetch.mockResolvedValueOnce(mockResponse(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } }));
    // Refresh also returns 401
    mockFetch.mockResolvedValueOnce(mockResponse(401, { success: false, error: { code: 'REFRESH_EXPIRED', message: 'expired' } }));

    await expect(apiClient('/protected')).rejects.toThrow('Session expired');

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(window.location.href).toBe('/login');

    // Restore
    locationSpy.mockRestore();
  });

  it('multiple simultaneous 401s: only one refresh call made', async () => {
    useAuthStore.getState().setAuth('expired-token', testUser);

    // Both calls return 401
    mockFetch.mockResolvedValueOnce(mockResponse(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } }));
    mockFetch.mockResolvedValueOnce(mockResponse(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } }));
    // Single refresh call
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { accessToken: 'new-token' } }),
    );
    // Both retries succeed
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { result: 'a' } }),
    );
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { result: 'b' } }),
    );

    const [r1, r2] = await Promise.all([
      apiClient<{ result: string }>('/endpoint-a'),
      apiClient<{ result: string }>('/endpoint-b'),
    ]);

    expect(r1).toEqual({ result: 'a' });
    expect(r2).toEqual({ result: 'b' });

    // Count refresh calls
    const refreshCalls = mockFetch.mock.calls.filter(
      (call) => (call[0] as string).includes('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('includes credentials: include on all requests', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: {} }),
    );

    await apiClient('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('includes CSRF token on mutation requests', async () => {
    useAuthStore.getState().setAuth('token', testUser);
    // Set CSRF cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '__csrf=csrf-token-123',
    });

    mockFetch.mockResolvedValueOnce(
      mockResponse(200, { success: true, data: { created: true } }),
    );

    await apiClient('/test', { method: 'POST', body: JSON.stringify({ data: 1 }) });

    const headers = (mockFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('csrf-token-123');
  });
});
