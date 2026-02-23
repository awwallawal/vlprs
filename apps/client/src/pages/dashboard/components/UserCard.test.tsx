import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { UserCard } from './UserCard';
import type { UserListItem } from '@vlprs/shared';

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

const mdaOfficer: UserListItem = {
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

const superAdminUser: UserListItem = {
  id: 'usr-001',
  firstName: 'Adebayo',
  lastName: 'Ogunlesi',
  email: 'ag@vlprs.oyo.gov.ng',
  role: 'super_admin',
  mdaId: null,
  isActive: true,
  mustChangePassword: false,
  createdAt: '2026-01-15T09:00:00Z',
  isSelf: false,
  lastLoginAt: '2026-02-20T08:30:00Z',
};

const selfUser: UserListItem = {
  ...mdaOfficer,
  isSelf: true,
};

const noop = () => {};

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('UserCard', () => {
  it('renders user name, email, and badges', () => {
    render(
      <UserCard
        user={mdaOfficer}
        currentUserRole="super_admin"
        mdaName="Ministry of Agriculture"
        onDeactivate={noop}
        onReactivate={noop}
        onDelete={noop}
        onResetPassword={noop}
        onReassignMda={noop}
      />,
      { wrapper },
    );

    expect(screen.getByText('Olumide Adeyemi')).toBeInTheDocument();
    expect(screen.getByText('o.adeyemi@vlprs.oyo.gov.ng')).toBeInTheDocument();
    expect(screen.getByText('MDA Officer')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Agriculture')).toBeInTheDocument();
  });

  it('shows action menu for manageable users', () => {
    render(
      <UserCard
        user={mdaOfficer}
        currentUserRole="super_admin"
        onDeactivate={noop}
        onReactivate={noop}
        onDelete={noop}
        onResetPassword={noop}
        onReassignMda={noop}
      />,
      { wrapper },
    );

    expect(screen.getByLabelText('Actions for Olumide Adeyemi')).toBeInTheDocument();
  });

  it('shows View Details for super admin rows', () => {
    render(
      <UserCard
        user={superAdminUser}
        currentUserRole="super_admin"
        onDeactivate={noop}
        onReactivate={noop}
        onDelete={noop}
        onResetPassword={noop}
        onReassignMda={noop}
      />,
      { wrapper },
    );

    expect(screen.getByRole('button', { name: 'View Details' })).toBeInTheDocument();
  });

  it('hides action menu for self user', () => {
    render(
      <UserCard
        user={selfUser}
        currentUserRole="super_admin"
        onDeactivate={noop}
        onReactivate={noop}
        onDelete={noop}
        onResetPassword={noop}
        onReassignMda={noop}
      />,
      { wrapper },
    );

    expect(screen.queryByLabelText(/Actions for/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'View Details' })).not.toBeInTheDocument();
  });
});
