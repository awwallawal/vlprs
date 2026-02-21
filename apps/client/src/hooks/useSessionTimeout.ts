import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';

const WARNING_THRESHOLD_MS = 29 * 60 * 1000; // 29 minutes
const LOGOUT_DELAY_MS = 60 * 1000; // 60 seconds after warning
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'scroll', 'touchstart'];
const ACTIVITY_RESET_EVENT = 'vlprs:activity';

/**
 * Dispatch a custom event to reset the session activity timer.
 * Called by apiClient on successful requests (outside React tree).
 */
export function resetActivityTimer(): void {
  window.dispatchEvent(new Event(ACTIVITY_RESET_EVENT));
}

export function useSessionTimeout() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const [showWarning, setShowWarning] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  const handleLogout = useCallback(() => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    setShowWarning(false);

    // Revoke refresh token server-side before clearing local state
    apiClient('/auth/logout', { method: 'POST' }).catch(() => {
      // Logout locally even if server call fails
    });

    clearAuth();
    navigate('/login');
    toast('Your session has expired. Please log in again.');
  }, [clearAuth, navigate]);

  const handleContinue = useCallback(async () => {
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    try {
      await apiClient('/auth/refresh', { method: 'POST' });
    } catch {
      handleLogout();
      return;
    }
    resetActivity();
    setShowWarning(false);
  }, [resetActivity, handleLogout]);

  // Effect 1: Inactivity detection — polls every 30s, shows warning at threshold
  useEffect(() => {
    if (!accessToken) return;

    const checkActivity = () => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= WARNING_THRESHOLD_MS && !showWarning) {
        setShowWarning(true);
      }
    };

    const intervalId = setInterval(checkActivity, 30_000);

    const onActivity = () => {
      if (!showWarning) {
        resetActivity();
      }
    };

    // Listen for user interaction events
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    // Listen for API-triggered activity resets
    window.addEventListener(ACTIVITY_RESET_EVENT, onActivity);

    return () => {
      clearInterval(intervalId);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      window.removeEventListener(ACTIVITY_RESET_EVENT, onActivity);
    };
  }, [accessToken, showWarning, resetActivity]);

  // Effect 2: Logout countdown — starts when warning is shown, separate from Effect 1
  // so that Effect 1's cleanup does not clear the logout timer
  useEffect(() => {
    if (!showWarning) return;

    logoutTimerRef.current = setTimeout(handleLogout, LOGOUT_DELAY_MS);

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [showWarning, handleLogout]);

  return {
    showWarning,
    onContinue: handleContinue,
    onLogoutNow: handleLogout,
  };
}
