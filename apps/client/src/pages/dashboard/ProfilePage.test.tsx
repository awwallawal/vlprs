import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { ProfilePage } from './ProfilePage';
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
  id: 'usr-003',
  firstName: 'Olumide',
  lastName: 'Adeyemi',
  email: 'o.adeyemi@vlprs.oyo.gov.ng',
  role: 'mda_officer',
  mdaId: 'mda-001',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-20T11:00:00Z',
};

const superAdmin: User = {
  id: 'usr-001',
  firstName: 'Adebayo',
  lastName: 'Ogunlesi',
  email: 'ag@vlprs.oyo.gov.ng',
  role: 'super_admin',
  mdaId: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-15T09:00:00Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/profile']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('ProfilePage', () => {
  it('renders profile page title', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<ProfilePage />, { wrapper: createWrapper() });

    expect(screen.getByText('My Profile')).toBeInTheDocument();
  });

  it('displays user details as read-only', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<ProfilePage />, { wrapper: createWrapper() });

    expect(screen.getByText('Olumide Adeyemi')).toBeInTheDocument();
    expect(screen.getByText('o.adeyemi@vlprs.oyo.gov.ng')).toBeInTheDocument();
    expect(screen.getByText('MDA Officer')).toBeInTheDocument();
  });

  it('shows MDA assignment for mda_officer', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<ProfilePage />, { wrapper: createWrapper() });

    expect(screen.getByText('MDA Assignment')).toBeInTheDocument();
  });

  it('does not show MDA assignment for super_admin', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: superAdmin });
    render(<ProfilePage />, { wrapper: createWrapper() });

    expect(screen.queryByText('MDA Assignment')).not.toBeInTheDocument();
  });

  it('shows change password button', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<ProfilePage />, { wrapper: createWrapper() });

    expect(screen.getByText('Change Password')).toBeInTheDocument();
  });

  it('shows lock icons with tooltip text for restricted fields', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: testUser });
    render(<ProfilePage />, { wrapper: createWrapper() });

    const lockIcons = screen.getAllByLabelText('Contact your administrator to update');
    expect(lockIcons.length).toBeGreaterThan(0);
  });
});
