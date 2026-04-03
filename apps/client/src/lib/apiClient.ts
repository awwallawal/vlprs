import { useAuthStore } from '@/stores/authStore';
import { resetActivityTimer } from '@/hooks/useSessionTimeout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const CSRF_COOKIE_NAME = '__csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let refreshPromise: Promise<'ok' | 'auth_error' | 'network_error'> | null = null;

function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

/**
 * Core refresh implementation — single source of truth for token refresh logic.
 * Returns discriminated result. NOT exported; callers use refreshToken() or refreshTokenWithReason().
 */
async function refreshTokenCore(): Promise<'ok' | 'auth_error' | 'network_error'> {
  try {
    const csrfToken = getCsrfToken();
    const headers: Record<string, string> = {};
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }

    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
    });

    if (!res.ok) return 'auth_error';

    const body = await res.json();
    if (!body.success) return 'auth_error';

    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      useAuthStore.getState().setAuth(body.data.accessToken, body.data.user ?? currentUser);
    }
    return 'ok';
  } catch {
    return 'network_error';
  }
}

/**
 * Refresh the access token. Returns true on success, false on failure.
 * Deduplicates concurrent calls via shared refreshPromise guard.
 * Used internally by authenticatedFetch on 401 retry.
 */
async function refreshToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshTokenCore().finally(() => {
      refreshPromise = null;
    });
  }
  const result = await refreshPromise;
  return result === 'ok';
}

/**
 * Refresh token with reason — distinguishes auth failure from network failure.
 * Deduplicates concurrent calls via shared refreshPromise guard.
 * Used by background refresh to decide whether to logout or retry.
 */
export async function refreshTokenWithReason(): Promise<'ok' | 'auth_error' | 'network_error'> {
  if (!refreshPromise) {
    refreshPromise = refreshTokenCore().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Check if a token refresh is currently in progress.
 */
export function isRefreshInProgress(): boolean {
  return refreshPromise !== null;
}

/**
 * Reset refresh state — exposed for testing only.
 */
export function resetRefreshState(): void {
  refreshPromise = null;
}

/**
 * Low-level authenticated fetch with 401→refresh→retry.
 * Use this when you need custom response handling (FormData, blobs, pagination).
 * For standard JSON { success, data } responses, prefer apiClient().
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {},
): Promise<Response> {
  const { accessToken } = useAuthStore.getState();
  const method = (options.method || 'GET').toUpperCase();
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    // Skip Content-Type for FormData — browser sets multipart boundary
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Attach CSRF token on mutation requests
  if (MUTATION_METHODS.has(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  let res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  // 401 → attempt silent refresh + retry
  if (res.status === 401 && accessToken) {
    const refreshed = await refreshToken();

    if (refreshed) {
      // Retry with new token
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        method,
        headers,
        credentials: 'include',
      });
    } else {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  // Reset session inactivity timer on successful API call
  if (res.ok) resetActivityTimer();

  return res;
}

/**
 * Parse an authenticated response as JSON, throwing structured errors.
 * Shared by apiClient and hooks that need custom top-level fields (e.g. pagination).
 */
export async function parseJsonResponse(res: Response) {
  let body: { success?: boolean; data?: unknown; pagination?: unknown; error?: { code: string; message: string; details?: unknown } };
  try {
    body = await res.json();
  } catch {
    throw Object.assign(new Error('Server temporarily unavailable — please try again'), {
      code: 'SERVICE_UNAVAILABLE',
      status: res.status,
    });
  }

  if (!res.ok || !body.success) {
    const error = body.error || {
      code: 'UNKNOWN',
      message: 'An unexpected error occurred',
    };
    throw Object.assign(new Error(error.message), {
      code: error.code,
      status: res.status,
      details: error.details,
    });
  }

  return body;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await authenticatedFetch(endpoint, options);
  const body = await parseJsonResponse(res);
  return body.data as T;
}
