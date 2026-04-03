import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { refreshTokenWithReason, isRefreshInProgress } from '@/lib/apiClient';

const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes
const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes — skip visibility refresh if refreshed recently

/**
 * Background token refresh hook.
 *
 * - Refreshes the access token every 12 minutes via setInterval
 * - Refreshes immediately when the tab regains focus (debounced to 2 min)
 * - Does NOT reset the client-side inactivity timer (by design)
 * - Distinguishes auth errors (logout) from network errors (retry next interval)
 */
export function useBackgroundRefresh() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const lastRefreshAtRef = useRef(Date.now());

  const handleAuthFailure = useCallback(() => {
    clearAuth();
    navigate('/login');
    toast('Your session has expired. Please log in again.');
  }, [clearAuth, navigate]);

  const doRefresh = useCallback(async () => {
    if (isRefreshInProgress()) return;

    const result = await refreshTokenWithReason();
    if (result === 'ok') {
      lastRefreshAtRef.current = Date.now();
    } else if (result === 'auth_error') {
      handleAuthFailure();
    }
    // 'network_error' → silently ignore, retry next interval
  }, [handleAuthFailure]);

  // Background interval refresh
  useEffect(() => {
    if (!accessToken) return;

    const intervalId = setInterval(doRefresh, REFRESH_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [accessToken, doRefresh]);

  // Tab focus (visibilitychange) refresh
  useEffect(() => {
    if (!accessToken) return;

    const handleVisibilityChange = async () => {
      if (document.visibilityState !== 'visible') return;

      // Debounce: skip if refreshed within last 2 minutes
      const elapsed = Date.now() - lastRefreshAtRef.current;
      if (elapsed < DEBOUNCE_MS) return;

      await doRefresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [accessToken, doRefresh]);
}
