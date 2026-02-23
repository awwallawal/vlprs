import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { ReassignMdaDialog } from './ReassignMdaDialog';
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

describe('ReassignMdaDialog', () => {
  it('renders dialog with title and user name', () => {
    render(
      <ReassignMdaDialog
        user={targetUser}
        open={true}
        onOpenChange={() => {}}
        currentMdaName="Ministry of Agriculture"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getAllByText('Reassign MDA').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Olumide Adeyemi/)).toBeInTheDocument();
  });

  it('shows current MDA assignment', () => {
    render(
      <ReassignMdaDialog
        user={targetUser}
        open={true}
        onOpenChange={() => {}}
        currentMdaName="Ministry of Agriculture"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Ministry of Agriculture')).toBeInTheDocument();
    expect(screen.getByText('Current MDA')).toBeInTheDocument();
  });

  it('shows reassignment note', () => {
    render(
      <ReassignMdaDialog
        user={targetUser}
        open={true}
        onOpenChange={() => {}}
        currentMdaName="Ministry of Agriculture"
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(/data access will immediately switch/)).toBeInTheDocument();
  });

  it('shows confirm and cancel buttons', () => {
    render(
      <ReassignMdaDialog
        user={targetUser}
        open={true}
        onOpenChange={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Cancel')).toBeInTheDocument();
    // "Reassign MDA" appears as both title and button
    const reassignButtons = screen.getAllByText('Reassign MDA');
    expect(reassignButtons.length).toBeGreaterThanOrEqual(1);
  });
});
