import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { PasswordChangeScreen } from './PasswordChangeScreen';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@vlprs/shared';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const testUser: User = {
  id: 'usr-004',
  firstName: 'Funke',
  lastName: 'Adekunle',
  email: 'f.adekunle@vlprs.oyo.gov.ng',
  role: 'mda_officer',
  mdaId: 'mda-002',
  isActive: true,
  mustChangePassword: true,
  createdAt: '2026-02-10T08:00:00Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('PasswordChangeScreen', () => {
  it('renders password change form', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<PasswordChangeScreen />, { wrapper: createWrapper() });

    expect(screen.getByText('Set Your Password')).toBeInTheDocument();
  });

  it('shows all three password fields', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<PasswordChangeScreen />, { wrapper: createWrapper() });

    expect(screen.getByText(/Current Temporary Password/)).toBeInTheDocument();
    expect(screen.getByText(/^New Password/)).toBeInTheDocument();
    expect(screen.getByText(/^Confirm New Password/)).toBeInTheDocument();
  });

  it('shows submit button', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<PasswordChangeScreen />, { wrapper: createWrapper() });

    expect(screen.getByText('Set Password')).toBeInTheDocument();
  });

  it('shows description text about temporary password', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<PasswordChangeScreen />, { wrapper: createWrapper() });

    expect(screen.getByText(/must change your temporary password/)).toBeInTheDocument();
  });
});
