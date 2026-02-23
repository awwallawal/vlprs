import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { ChangePasswordDialog } from './ChangePasswordDialog';
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'test-token', user: testUser });
});

describe('ChangePasswordDialog', () => {
  it('renders dialog with title and description', () => {
    render(
      <ChangePasswordDialog open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByText(/current password and choose a new one/)).toBeInTheDocument();
  });

  it('shows all three password fields', () => {
    render(
      <ChangePasswordDialog open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(/Current Password/)).toBeInTheDocument();
    expect(screen.getByText(/^New Password/)).toBeInTheDocument();
    expect(screen.getByText(/^Confirm New Password/)).toBeInTheDocument();
  });

  it('shows submit and cancel buttons', () => {
    render(
      <ChangePasswordDialog open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Update Password')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <ChangePasswordDialog open={false} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByText('Change Password')).not.toBeInTheDocument();
  });
});
