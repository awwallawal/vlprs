import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter } from 'react-router';
import { useAuthStore } from '@/stores/authStore';
import { LoginPage } from './LoginPage';

// Mock apiClient
vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn(),
}));

// Mock react-google-recaptcha-v3
vi.mock('react-google-recaptcha-v3', () => ({
  useGoogleReCaptcha: () => ({ executeRecaptcha: null }),
}));

const { apiClient } = await import('@/lib/apiClient');
const mockApiClient = apiClient as ReturnType<typeof vi.fn>;

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
  });

  it('renders email and password fields with labels', () => {
    renderLoginPage();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('shows validation error on blur when email is empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const emailInput = screen.getByLabelText('Email Address');
    await user.click(emailInput);
    await user.tab(); // blur

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows validation error on blur when password is empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const passwordInput = screen.getByLabelText('Password');
    await user.click(passwordInput);
    await user.tab(); // blur

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const passwordError = alerts.find((el) =>
        el.textContent?.toLowerCase().includes('password'),
      );
      expect(passwordError).toBeTruthy();
    });
  });

  it('submit button is disabled during loading', async () => {
    const user = userEvent.setup();
    // Make apiClient hang
    mockApiClient.mockReturnValue(new Promise(() => {}));

    renderLoginPage();

    const emailInput = screen.getByLabelText('Email Address');
    const passwordInput = screen.getByLabelText('Password');

    await user.type(emailInput, 'admin@test.com');
    await user.type(passwordInput, 'Password1');

    const submitButton = screen.getByRole('button', { name: /login/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it('calls API with correct payload on valid submit', async () => {
    const user = userEvent.setup();
    mockApiClient.mockResolvedValueOnce({
      accessToken: 'test-token',
      user: {
        id: '1',
        email: 'admin@test.com',
        firstName: 'Test',
        lastName: 'Admin',
        role: 'super_admin',
        mdaId: null,
        isActive: true,
        createdAt: '2026-01-01',
      },
    });

    renderLoginPage();

    await user.type(screen.getByLabelText('Email Address'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'Password1');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockApiClient).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: expect.stringContaining('admin@test.com'),
      });
    });
  });

  it('displays error message on failed login (non-punitive text)', async () => {
    const user = userEvent.setup();
    mockApiClient.mockRejectedValueOnce(
      Object.assign(new Error('Invalid credentials'), { code: 'INVALID_CREDENTIALS' }),
    );

    renderLoginPage();

    await user.type(screen.getByLabelText('Email Address'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'WrongPass1');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Email or password is incorrect. Please try again.'),
      ).toBeInTheDocument();
    });
  });
});
