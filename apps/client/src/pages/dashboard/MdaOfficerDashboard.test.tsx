import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MdaOfficerDashboard } from './MdaOfficerDashboard';
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

const mockUser = {
  id: 'user-1',
  email: 'officer@mda.gov',
  firstName: 'Bola',
  lastName: 'Adeyemi',
  role: ROLES.MDA_OFFICER,
  mdaId: 'mda-001',
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: { user: typeof mockUser }) => unknown) =>
    selector({ user: mockUser }),
}));

const mockMetrics = {
  activeLoans: 171,
  totalExposure: '89200000.00',
  monthlyRecovery: '2400000.00',
  loanCompletionRateLifetime: 2.3,
  trends: {
    activeLoans: { direction: 'flat' as const, label: 'No change' },
    totalExposure: { direction: 'down' as const, label: '-1.2%' },
    monthlyRecovery: { direction: 'up' as const, label: '+3.4%' },
    completionRate: { direction: 'up' as const, label: '+0.1%' },
  },
};

const mockMdaDetail = {
  mdaId: 'mda-001',
  name: 'Ministry of Finance',
  code: 'MOF',
  officerName: 'Bola Adeyemi',
  loanCount: 171,
  totalExposure: '89200000.00',
  monthlyRecovery: '2400000.00',
  submissionHistory: [],
  statusDistribution: { completed: 4, onTrack: 150, overdue: 12, stalled: 5, overDeducted: 0 },
};

const mockMigration = [
  {
    mdaId: 'mda-001',
    mdaName: 'Ministry of Finance',
    mdaCode: 'MOF',
    stage: 'validated' as const,
    recordCounts: { clean: 149, minor: 8, significant: 14, structural: 0, anomalous: 0 },
    lastActivity: '2026-04-01T10:00:00Z',
  },
];

const mockSubmissions = {
  items: [
    {
      id: 'sub-1',
      referenceNumber: 'SUB-2026-04-001',
      submissionDate: '2026-04-02T09:00:00Z',
      recordCount: 171,
      alignedCount: 170,
      varianceCount: 1,
      status: 'confirmed' as const,
      period: '2026-04',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 5,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseDashboardMetrics = vi.fn((): any => ({ data: mockMetrics, isPending: false }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseMdaDetail = vi.fn((): any => ({ data: mockMdaDetail, isPending: false }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseMigrationStatus = vi.fn((): any => ({ data: mockMigration, isPending: false }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUsePreSubmissionCheckpoint = vi.fn((): any => ({ data: null, isPending: false }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseSubmissionHistory = vi.fn((): any => ({ data: mockSubmissions, isPending: false }));

vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardMetrics: () => mockUseDashboardMetrics(),
}));

vi.mock('@/hooks/useMdaData', () => ({
  useMdaDetail: (...args: unknown[]) => mockUseMdaDetail(...args),
}));

vi.mock('@/hooks/useMigrationData', () => ({
  useMigrationStatus: () => mockUseMigrationStatus(),
}));

vi.mock('@/hooks/usePreSubmissionCheckpoint', () => ({
  usePreSubmissionCheckpoint: (...args: unknown[]) => mockUsePreSubmissionCheckpoint(...args),
}));

vi.mock('@/hooks/useSubmissionData', () => ({
  useSubmissionHistory: (...args: unknown[]) => mockUseSubmissionHistory(...args),
}));

vi.mock('./components/MdaReviewSection', () => ({
  MdaReviewSection: () => <div data-testid="mda-review-section">Review Section</div>,
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <MdaOfficerDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MdaOfficerDashboard', () => {
  it('renders hero metric cards (AC: 1)', () => {
    renderDashboard();
    expect(screen.getByText('Active Loans')).toBeInTheDocument();
    expect(screen.getByText('Monthly Recovery')).toBeInTheDocument();
    expect(screen.getByText('Total Exposure')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
  });

  it('renders migration quality section with score (AC: 2)', () => {
    renderDashboard();
    expect(screen.getByText('Migration Quality')).toBeInTheDocument();
    // Quality = (149 + 8) / 171 * 100 = 91.8%
    expect(screen.getByText('91.8%')).toBeInTheDocument();
    expect(screen.getByText('Clean: 149')).toBeInTheDocument();
    expect(screen.getByText('Minor: 8')).toBeInTheDocument();
    expect(screen.getByText('Significant: 14')).toBeInTheDocument();
  });

  it('renders review section (AC: 3)', () => {
    renderDashboard();
    expect(screen.getByTestId('mda-review-section')).toBeInTheDocument();
  });

  it('renders pre-submission empty state when no checkpoint data (AC: 4, 8)', () => {
    renderDashboard();
    expect(screen.getByText('Pre-Submission Status')).toBeInTheDocument();
    expect(screen.getByText('Pre-submission checkpoint will appear when your submission window opens.')).toBeInTheDocument();
  });

  it('renders recent submissions table (AC: 5)', () => {
    renderDashboard();
    expect(screen.getByText('Recent Submissions')).toBeInTheDocument();
    expect(screen.getByText('Apr 2026')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
    expect(screen.getByText('171')).toBeInTheDocument();
  });

  it('renders submission empty state when no submissions (AC: 8)', () => {
    mockUseSubmissionHistory.mockReturnValue({ data: { items: [], total: 0, page: 1, pageSize: 5 }, isPending: false });
    renderDashboard();
    expect(screen.getByText('No monthly submissions yet. Upload your first submission via the Upload Data menu.')).toBeInTheDocument();
    // Restore
    mockUseSubmissionHistory.mockReturnValue({ data: mockSubmissions, isPending: false });
  });

  it('renders migration empty state when no migration data (AC: 8)', () => {
    mockUseMigrationStatus.mockReturnValue({ data: [], isPending: false });
    renderDashboard();
    expect(screen.getByText('No migration data available for your MDA yet.')).toBeInTheDocument();
    // Restore
    mockUseMigrationStatus.mockReturnValue({ data: mockMigration, isPending: false });
  });

  it('renders hero metrics as clickable cards (AC: 7)', () => {
    renderDashboard();
    const activeLoansCard = screen.getByLabelText(/Active Loans.*Click to view breakdown/);
    expect(activeLoansCard).toBeInTheDocument();
    expect(activeLoansCard).toHaveAttribute('role', 'link');
  });

  it('passes correct parameters to data hooks', () => {
    renderDashboard();
    expect(mockUseMdaDetail).toHaveBeenCalledWith('mda-001');
    expect(mockUsePreSubmissionCheckpoint).toHaveBeenCalledWith('mda-001');
    expect(mockUseSubmissionHistory).toHaveBeenCalledWith('mda-001', 1, 5);
  });
});

describe('MdaOfficerDashboard (sidebar — AC: 6)', () => {
  it('sidebar shows correct items for MDA officer', async () => {
    // Import navItems directly to test sidebar config
    const { NAV_ITEMS } = await import('@/components/layout/navItems');

    const mdaOfficerItems = NAV_ITEMS.filter((item) =>
      item.roles.includes(ROLES.MDA_OFFICER),
    );

    expect(mdaOfficerItems).toHaveLength(6);

    const labels = mdaOfficerItems.map((i) => i.label);
    expect(labels).toEqual([
      'My Dashboard',
      'Upload Data',
      'My Reviews',
      'Employment Events',
      'Reconciliation',
      'My Reports',
    ]);
  });

  it('MDA officer home route is /dashboard', async () => {
    const { ROLE_HOME_ROUTES } = await import('@/components/layout/navItems');
    expect(ROLE_HOME_ROUTES[ROLES.MDA_OFFICER]).toBe('/dashboard');
  });

  it('Historical Upload no longer visible to MDA officer', async () => {
    const { NAV_ITEMS } = await import('@/components/layout/navItems');

    const historicalUpload = NAV_ITEMS.find((item) => item.label === 'Historical Upload');
    expect(historicalUpload).toBeDefined();
    expect(historicalUpload!.roles).not.toContain(ROLES.MDA_OFFICER);
  });
});
