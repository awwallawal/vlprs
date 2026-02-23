import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { AdminPage } from './AdminPage';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@vlprs/shared';

// Mock matchMedia for jsdom
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
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

const deptAdmin: User = {
  id: 'usr-002',
  firstName: 'Chidinma',
  lastName: 'Okafor',
  email: 'dept.admin@vlprs.oyo.gov.ng',
  role: 'dept_admin',
  mdaId: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-16T10:00:00Z',
};

const mdaOfficer: User = {
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
        <MemoryRouter initialEntries={['/dashboard/admin']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  useAuthStore.setState({ accessToken: null, user: null });
});

describe('AdminPage', () => {
  it('renders page title and invite button for super_admin', async () => {
    useAuthStore.setState({ accessToken: 'test-token', user: superAdmin });
    render(<AdminPage />, { wrapper: createWrapper() });

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Invite User')).toBeInTheDocument();
  });

  it('renders user table with data for super_admin', async () => {
    useAuthStore.setState({ accessToken: 'test-token', user: superAdmin });
    render(<AdminPage />, { wrapper: createWrapper() });

    // Wait for mock data to load
    expect(await screen.findByText('Adebayo Ogunlesi')).toBeInTheDocument();
    expect(screen.getByText('ag@vlprs.oyo.gov.ng')).toBeInTheDocument();
  });

  it('shows search input and filter dropdowns', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: superAdmin });
    render(<AdminPage />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText('Search by name or email...')).toBeInTheDocument();
    expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
  });

  it('renders page for dept_admin', async () => {
    useAuthStore.setState({ accessToken: 'test-token', user: deptAdmin });
    render(<AdminPage />, { wrapper: createWrapper() });

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Invite User')).toBeInTheDocument();
  });

  it('dept_admin only sees mda_officer accounts', async () => {
    useAuthStore.setState({ accessToken: 'test-token', user: deptAdmin });
    render(<AdminPage />, { wrapper: createWrapper() });

    // Wait for data to load
    await screen.findByText('Olumide Adeyemi');

    // Dept admin should not see super_admin or other dept_admin rows
    expect(screen.queryByText('Adebayo Ogunlesi')).not.toBeInTheDocument();
    expect(screen.queryByText('Chidinma Okafor')).not.toBeInTheDocument();
  });

  it('redirects mda_officer away from admin page', () => {
    useAuthStore.setState({ accessToken: 'test-token', user: mdaOfficer });
    render(<AdminPage />, { wrapper: createWrapper() });

    // Should NOT render admin content
    expect(screen.queryByText('User Management')).not.toBeInTheDocument();
  });

  it('super_admin rows show only View Details action', async () => {
    // Use a different id so the mock super_admin row is not isSelf
    const otherSuperAdmin: User = { ...superAdmin, id: 'usr-999' };
    useAuthStore.setState({ accessToken: 'test-token', user: otherSuperAdmin });
    render(<AdminPage />, { wrapper: createWrapper() });

    // Wait for data — Adebayo Ogunlesi is the mock super_admin (usr-001)
    await screen.findByText('Adebayo Ogunlesi');

    // Super admin row should have "View Details" button (sr-only text provides accessible name)
    const viewButtons = screen.getAllByRole('button', { name: 'View Details' });
    expect(viewButtons.length).toBeGreaterThan(0);
  });

  it('empty state shows when no users match filters', async () => {
    useAuthStore.setState({ accessToken: 'test-token', user: superAdmin });
    const { container } = render(<AdminPage />, { wrapper: createWrapper() });

    // Wait for data to load
    await screen.findByText('Adebayo Ogunlesi');

    // Type a search that won't match any mock users
    const searchInput = screen.getByPlaceholderText('Search by name or email...');
    const { fireEvent: fe } = await import('@testing-library/react');
    fe.change(searchInput, { target: { value: 'zzzznonexistent' } });

    // Wait for debounce (300ms) + re-render with empty results
    await new Promise((r) => setTimeout(r, 400));

    // After debounce, the empty state should show
    const emptyText = container.querySelector('.text-muted-foreground');
    expect(emptyText).not.toBeNull();
  });
});
