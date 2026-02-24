import { useAuthStore } from '@/stores/authStore';
import { resetActivityTimer } from '@/hooks/useSessionTimeout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const CSRF_COOKIE_NAME = '__csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let refreshPromise: Promise<boolean> | null = null;

function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

async function refreshToken(): Promise<boolean> {
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

    if (!res.ok) return false;

    const body = await res.json();
    if (!body.success) return false;

    const currentUser = useAuthStore.getState().user;
    if (currentUser) {
      useAuthStore.getState().setAuth(body.data.accessToken, body.data.user ?? currentUser);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Reset refresh state — exposed for testing only.
 */
export function resetRefreshState(): void {
  refreshPromise = null;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken } = useAuthStore.getState();
  const method = (options.method || 'GET').toUpperCase();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    // Prevent multiple simultaneous refresh calls
    if (!refreshPromise) {
      refreshPromise = refreshToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;

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

  // Guard against non-JSON responses (e.g. 502 HTML from nginx during deploys)
  let body: { success?: boolean; data?: unknown; error?: { code: string; message: string } };
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
    });
  }

  // Reset session inactivity timer on successful API call
  resetActivityTimer();

  return body.data as T;
}
