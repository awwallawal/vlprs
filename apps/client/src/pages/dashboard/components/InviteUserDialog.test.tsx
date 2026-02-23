import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { InviteUserDialog } from './InviteUserDialog';
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
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: 'test-token', user: superAdmin });
});

describe('InviteUserDialog', () => {
  it('renders dialog with form fields when open', () => {
    render(
      <InviteUserDialog open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Invite User')).toBeInTheDocument();
    expect(screen.getByText(/First Name/)).toBeInTheDocument();
    expect(screen.getByText(/Last Name/)).toBeInTheDocument();
    expect(screen.getByText(/Email/)).toBeInTheDocument();
    expect(screen.getByText(/Role/)).toBeInTheDocument();
  });

  it('shows preview note about email invitation', () => {
    render(
      <InviteUserDialog open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText(/welcome email with temporary login credentials/)).toBeInTheDocument();
  });

  it('shows submit and cancel buttons', () => {
    render(
      <InviteUserDialog open={true} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByText('Send Invitation')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <InviteUserDialog open={false} onOpenChange={() => {}} />,
      { wrapper: createWrapper() },
    );

    expect(screen.queryByText('Invite User')).not.toBeInTheDocument();
  });
});
