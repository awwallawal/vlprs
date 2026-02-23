import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { DeactivateDialog } from './DeactivateDialog';
import { useAuthStore } from '@/stores/authStore';
import type { User, UserListItem } from '@vlprs/shared';

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

const targetUser: UserListItem = {
  id: 'usr-003',
  firstName: 'Olumide',
  lastName: 'Adeyemi',
  email: 'o.adeyemi@vlprs.oyo.gov.ng',
  role: 'mda_officer',
  mdaId: 'mda-001',
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-20T11:00:00Z',
  isSelf: false,
  lastLoginAt: '2026-02-18T09:15:00Z',
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
  useAuthStore.setState({ accessToken: 'test-token', user: superAdmin });
});

describe('DeactivateDialog', () => {
  it('renders confirmation dialog with user name', () => {
    render(
      <DeactivateDialog user={targetUser} open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Deactivate Account')).toBeInTheDocument();
    expect(screen.getByText(/Deactivate Olumide Adeyemi/)).toBeInTheDocument();
  });

  it('shows optional reason field', () => {
    render(
      <DeactivateDialog user={targetUser} open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByLabelText('Reason (optional)')).toBeInTheDocument();
  });

  it('shows user email prominently', () => {
    render(
      <DeactivateDialog user={targetUser} open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(targetUser.email)).toBeInTheDocument();
  });

  it('shows confirm and cancel buttons', () => {
    render(
      <DeactivateDialog user={targetUser} open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Deactivate')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });
});
