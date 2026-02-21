import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '@/stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const CSRF_COOKIE_NAME = '__csrf';

function getCsrfToken(): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CSRF_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.split('=')[1]) : null;
}

export function AuthGuard() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [isLoading, setIsLoading] = useState(!accessToken);

  useEffect(() => {
    if (accessToken) return;

    // Build headers with CSRF token for the POST request
    const headers: Record<string, string> = {};
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }

    // Attempt session restoration via refresh endpoint
    fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(({ data }) => setAuth(data.accessToken, data.user))
      .catch(() => clearAuth())
      .finally(() => setIsLoading(false));
  }, [accessToken, setAuth, clearAuth]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-crimson border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
