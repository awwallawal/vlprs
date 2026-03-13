import { useAuthStore } from '@/stores/authStore';

const CSRF_COOKIE_NAME = '__csrf';

/**
 * Build auth headers for FormData uploads (raw fetch, NOT apiClient).
 * Includes Bearer token + CSRF token.
 */
export function getAuthHeaders(): Record<string, string> {
  const { accessToken } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  const csrfMatch = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  if (csrfMatch) {
    headers['x-csrf-token'] = decodeURIComponent(csrfMatch.split('=')[1]);
  }
  return headers;
}
