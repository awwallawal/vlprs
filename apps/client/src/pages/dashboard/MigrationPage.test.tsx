import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MigrationPage } from './MigrationPage';
import { ROLES } from '@vlprs/shared';

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

type MockUser = { id: string; email: string; firstName: string; lastName: string; role: string; mdaId?: string };

let mockUser: MockUser | null = {
  id: 'user-1',
  email: 'officer@mda.gov',
  firstName: 'Bola',
  lastName: 'Adeyemi',
  role: ROLES.MDA_OFFICER,
  mdaId: 'mda-001',
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: MockUser | null }) => unknown) =>
    selector({ user: mockUser }),
}));

vi.mock('@/hooks/useMigrationData', () => ({
  useMigrationStatus: () => ({ data: [], isPending: false }),
  useMigrationDashboardMetrics: () => ({
    data: { totalStaffMigrated: 0, totalExposure: '0.00', mdasComplete: 0, baselinesEstablished: 0, pendingDuplicates: 0 },
    isPending: false,
  }),
}));

vi.mock('@/hooks/useMigration', () => ({
  useListMigrations: () => ({ data: { data: [{ id: 'upload-1' }] }, isPending: false }),
}));

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}));

// Mock heavy child components — we only care about which tab is active
vi.mock('./components/MigrationProgressBar', () => ({
  MigrationProgressBar: () => <div data-testid="progress-bar" />,
}));
vi.mock('./components/MasterBeneficiaryLedger', () => ({
  MasterBeneficiaryLedger: () => <div data-testid="beneficiary-ledger" />,
}));
vi.mock('./components/ObservationsList', () => ({
  ObservationsList: () => <div data-testid="observations-list" />,
}));
vi.mock('./components/DuplicateResolutionTable', () => ({
  DuplicateResolutionTable: () => <div data-testid="duplicate-table" />,
}));
vi.mock('./components/MigrationCoverageTracker', () => ({
  MigrationCoverageTracker: () => <div data-testid="coverage-tracker" />,
}));
vi.mock('./components/MigrationUploadList', () => ({
  MigrationUploadList: () => <div data-testid="upload-list" />,
}));
vi.mock('./components/MdaReviewProgressTracker', () => ({
  MdaReviewProgressTracker: () => <div data-testid="mda-review-tracker" />,
}));

function renderPage(initialPath = '/dashboard/migration') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <MigrationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MigrationPage', () => {
  beforeEach(() => {
    // Reset to MDA_OFFICER by default
    mockUser = {
      id: 'user-1',
      email: 'officer@mda.gov',
      firstName: 'Bola',
      lastName: 'Adeyemi',
      role: ROLES.MDA_OFFICER,
      mdaId: 'mda-001',
    };
  });

  // AC 5 — MDA officer auto-lands on MDA Review tab
  it('auto-selects MDA Review tab for MDA officers', () => {
    renderPage('/dashboard/migration');
    // The MDA Review tab content should be visible (the MdaReviewProgressTracker)
    expect(screen.getByTestId('mda-review-tracker')).toBeInTheDocument();
  });

  // Admin defaults to MDA Progress tab (regression check)
  it('defaults to MDA Progress tab for admin users', () => {
    mockUser = {
      id: 'user-2',
      email: 'admin@oyo.gov',
      firstName: 'Admin',
      lastName: 'User',
      role: ROLES.DEPT_ADMIN,
    };
    renderPage('/dashboard/migration');
    // MDA Progress tab is active → MdaReviewProgressTracker should NOT be visible
    expect(screen.queryByTestId('mda-review-tracker')).not.toBeInTheDocument();
  });

  // Task 4.2 — `?tab=` URL param overrides default
  it('respects ?tab= URL param for direct deep linking', () => {
    mockUser = {
      id: 'user-2',
      email: 'admin@oyo.gov',
      firstName: 'Admin',
      lastName: 'User',
      role: ROLES.DEPT_ADMIN,
    };
    renderPage('/dashboard/migration?tab=mda-review');
    // Admin user with explicit ?tab=mda-review should land on MDA Review
    expect(screen.getByTestId('mda-review-tracker')).toBeInTheDocument();
  });

  // Code-review fix: invalid ?tab= value falls back to role default (no blank page)
  it('falls back to role default when ?tab= value is invalid', () => {
    renderPage('/dashboard/migration?tab=hacker');
    // MDA officer with bogus tab → should still get mda-review (their default)
    expect(screen.getByTestId('mda-review-tracker')).toBeInTheDocument();
  });

  // Code-review fix: ?tab=beneficiary-ledger renders ledger
  it('respects ?tab=beneficiary-ledger URL param', () => {
    renderPage('/dashboard/migration?tab=beneficiary-ledger');
    expect(screen.getByTestId('beneficiary-ledger')).toBeInTheDocument();
  });
});
