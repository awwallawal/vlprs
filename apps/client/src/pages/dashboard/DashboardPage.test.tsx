import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';

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

const mockMetrics = {
  activeLoans: 2847,
  totalExposure: '2418350000.00',
  fundAvailable: '892000000.00',
  monthlyRecovery: '48250000.00',
  pendingEarlyExits: 12,
  earlyExitRecoveryAmount: '18750000.00',
  gratuityReceivableExposure: '345000000.00',
  staffIdCoverage: { covered: 2564, total: 2847 },
};

const mockCompliance = {
  rows: [
    {
      mdaId: 'mda-001',
      mdaCode: 'MOF',
      mdaName: 'Ministry of Finance',
      status: 'submitted' as const,
      lastSubmission: '2026-02-15T09:30:00Z',
      recordCount: 142,
      alignedCount: 140,
      varianceCount: 2,
      healthScore: 82,
      healthBand: 'healthy' as const,
      submissionCoveragePercent: 90,
      isDark: false,
      stalenessMonths: null,
    },
    {
      mdaId: 'mda-002',
      mdaCode: 'MOE',
      mdaName: 'Ministry of Education',
      status: 'pending' as const,
      lastSubmission: null,
      recordCount: 210,
      alignedCount: 0,
      varianceCount: 0,
      healthScore: 55,
      healthBand: 'attention' as const,
      submissionCoveragePercent: null,
      isDark: false,
      stalenessMonths: null,
    },
  ],
  heatmap: [],
  summary: {
    submitted: 1,
    pending: 1,
    overdue: 0,
    total: 2,
    deadlineDate: '2026-03-28T00:00:00.000Z',
    heatmapSummary: { onTime: 0, gracePeriod: 0, awaiting: 2 },
  },
};

const mockAttention = {
  items: [
    {
      id: 'att-001',
      type: 'zero_deduction' as const,
      description: 'Submission pending, 3 days past due',
      mdaName: 'Ministry of Works',
      category: 'review' as const,
      priority: 10,
      drillDownUrl: '/dashboard/loans?filter=zero-deduction',
      timestamp: '2026-02-18T10:00:00Z',
    },
  ],
  totalCount: 1,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseDashboardMetrics = vi.fn((): any => ({ data: mockMetrics, isPending: false }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseMdaComplianceGrid = vi.fn((): any => ({ data: mockCompliance, isPending: false }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUseAttentionItems = vi.fn((): any => ({ data: mockAttention, isPending: false }));

vi.mock('@/hooks/useDashboardData', () => ({
  useDashboardMetrics: () => mockUseDashboardMetrics(),
}));

vi.mock('@/hooks/useMdaData', () => ({
  useMdaComplianceGrid: () => mockUseMdaComplianceGrid(),
}));

vi.mock('@/hooks/useAttentionItems', () => ({
  useAttentionItems: () => mockUseAttentionItems(),
}));

function renderPage(initialEntries = ['/dashboard']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
  it('renders page heading "Executive Dashboard"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Executive Dashboard' }),
    ).toBeInTheDocument();
  });

  it('renders hero metric cards', () => {
    renderPage();
    expect(screen.getByText('Active Loans')).toBeInTheDocument();
    expect(screen.getByText('Total Exposure')).toBeInTheDocument();
    expect(screen.getByText('Fund Available')).toBeInTheDocument();
    // "Monthly Recovery" renamed to "Declared Recovery" in UAT #9
    expect(screen.getByText('Declared Recovery')).toBeInTheDocument();
  });

  it('renders attention items section', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Items Requiring Attention' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Submission pending, 3 days past due'),
    ).toBeInTheDocument();
  });

  it('renders MDA compliance table', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'MDA Compliance Status' }),
    ).toBeInTheDocument();
    // Both mobile and desktop views render MDA names
    expect(screen.getAllByText('Ministry of Finance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ministry of Education').length).toBeGreaterThanOrEqual(1);
  });

  it('renders compliance status badges', () => {
    renderPage();
    // Both mobile and desktop views render badges, so use getAllByText
    expect(screen.getAllByText('Submitted').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Share as PDF button (disabled)', () => {
    renderPage();
    const button = screen.getByRole('button', { name: /Share as PDF/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });
});

describe('DashboardPage (pending state)', () => {
  it('renders skeleton loaders when data is pending', () => {
    mockUseDashboardMetrics.mockReturnValue({ data: undefined, isPending: true });
    mockUseMdaComplianceGrid.mockReturnValue({ data: undefined, isPending: true });
    mockUseAttentionItems.mockReturnValue({ data: undefined, isPending: true });

    renderPage();

    // When pending, real data should NOT be in the DOM (replaced by skeletons)
    expect(screen.queryByText('Ministry of Finance')).not.toBeInTheDocument();
    expect(screen.queryByText('Submission pending, 3 days past due')).not.toBeInTheDocument();
    // Skeleton elements use animate-pulse class
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);

    // Restore mocks for other tests
    mockUseDashboardMetrics.mockReturnValue({ data: mockMetrics, isPending: false });
    mockUseMdaComplianceGrid.mockReturnValue({ data: mockCompliance, isPending: false });
    mockUseAttentionItems.mockReturnValue({ data: mockAttention, isPending: false });
  });
});

describe('DashboardPage (analytics enrichment — AC4)', () => {
  it('renders "Submission gap observed" badge for dark MDAs', () => {
    const darkCompliance = {
      ...mockCompliance,
      rows: [
        ...mockCompliance.rows,
        {
          mdaId: 'mda-003',
          mdaCode: 'MOH',
          mdaName: 'Ministry of Health',
          status: 'pending' as const,
          lastSubmission: '2025-09-15T09:30:00Z',
          recordCount: 100,
          alignedCount: 0,
          varianceCount: 0,
          healthScore: 30,
          healthBand: 'for-review' as const,
          submissionCoveragePercent: 20,
          isDark: true,
          stalenessMonths: 6,
        },
      ],
      summary: { ...mockCompliance.summary, total: 3, pending: 2 },
    };
    mockUseMdaComplianceGrid.mockReturnValue({ data: darkCompliance, isPending: false });

    renderPage();

    expect(screen.getAllByText('Submission gap observed').length).toBeGreaterThanOrEqual(1);

    // Restore
    mockUseMdaComplianceGrid.mockReturnValue({ data: mockCompliance, isPending: false });
  });

  it('renders staleness indicator for MDAs with stalenessMonths >= 2', () => {
    const staleCompliance = {
      ...mockCompliance,
      rows: [
        ...mockCompliance.rows,
        {
          mdaId: 'mda-004',
          mdaCode: 'MOW',
          mdaName: 'Ministry of Works',
          status: 'pending' as const,
          lastSubmission: '2025-12-15T09:30:00Z',
          recordCount: 50,
          alignedCount: 0,
          varianceCount: 0,
          healthScore: 45,
          healthBand: 'attention' as const,
          submissionCoveragePercent: 40,
          isDark: false,
          stalenessMonths: 3,
        },
      ],
      summary: { ...mockCompliance.summary, total: 3, pending: 2 },
    };
    mockUseMdaComplianceGrid.mockReturnValue({ data: staleCompliance, isPending: false });

    renderPage();

    expect(screen.getAllByText(/months since last update/).length).toBeGreaterThanOrEqual(1);

    // Restore
    mockUseMdaComplianceGrid.mockReturnValue({ data: mockCompliance, isPending: false });
  });
});

describe('DashboardPage (heatmap section — AC5)', () => {
  it('renders Submission History heading on desktop', () => {
    renderPage();
    expect(
      screen.getByText('Submission History (12 months)'),
    ).toBeInTheDocument();
  });
});

describe('DashboardPage (compliance progress — AC1/AC2)', () => {
  it('renders progress header with submission count', () => {
    renderPage();
    expect(screen.getByText(/1 of 2 MDAs submitted/)).toBeInTheDocument();
  });

  it('renders progress bar with aria attributes', () => {
    renderPage();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('1');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('2');
  });
});
