import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { AuthGuard } from './AuthGuard';
import type { User } from '@vlprs/shared';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const testUser: User = {
  id: 'test-1',
  email: 'admin@test.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'super_admin',
  mdaId: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderWithRouter(initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route element={<AuthGuard />}>
          <Route path="/dashboard" element={<div>Dashboard Content</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('renders Outlet when accessToken exists', () => {
    useAuthStore.getState().setAuth('valid-token', testUser);
    renderWithRouter('/dashboard');
    expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
  });

  it('redirects to /login when no accessToken and refresh fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('refresh failed'));
    renderWithRouter('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  it('shows loading spinner while attempting session restoration', () => {
    // Never resolve the fetch
    mockFetch.mockReturnValueOnce(new Promise(() => {}));
    renderWithRouter('/dashboard');

    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('restores session when refresh succeeds', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: { accessToken: 'new-token', user: testUser },
        }),
    });

    renderWithRouter('/dashboard');

    await waitFor(() => {
      expect(screen.getByText('Dashboard Content')).toBeInTheDocument();
    });
  });
});
