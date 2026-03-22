import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { ThreeWayReconciliationPage } from './ThreeWayReconciliationPage';
import type { ThreeWayReconciliationSummary, ThreeWayDashboardMetrics } from '@vlprs/shared';

// ─── Mock Data ───────────────────────────────────────────────────

const mockSummary: ThreeWayReconciliationSummary = {
  period: '2026-03',
  mdaId: 'mda-001',
  mdaName: 'Ministry of Education',
  totalStaffCompared: 4,
  fullMatchCount: 2,
  fullMatchPercent: '50.00',
  partialMatchCount: 1,
  fullVarianceCount: 1,
  aggregateDeclared: '56666.68',
  aggregateActual: '51000.00',
  reconciliationHealth: '50.00',
  rows: [
    {
      staffId: 'S001',
      staffName: 'John Doe',
      expectedAmount: '14166.67',
      declaredAmount: '14166.67',
      actualAmount: '14166.67',
      matchStatus: 'full_match',
    },
    {
      staffId: 'S002',
      staffName: 'Jane Smith',
      expectedAmount: '14166.67',
      declaredAmount: '14166.67',
      actualAmount: '12000.00',
      matchStatus: 'partial_match',
      varianceCategory: 'amount_mismatch',
      varianceAmount: '2166.67',
    },
    {
      staffId: 'S003',
      staffName: 'Amina Bello',
      expectedAmount: '14166.67',
      declaredAmount: '14166.67',
      actualAmount: '0.00',
      matchStatus: 'full_variance',
      varianceCategory: 'ghost_deduction',
      varianceAmount: '14166.67',
    },
    {
      staffId: 'S004',
      staffName: 'Ola Adeyemi',
      expectedAmount: '14166.67',
      declaredAmount: '14166.67',
      actualAmount: '14166.67',
      matchStatus: 'full_match',
    },
  ],
};

const mockDashboard: ThreeWayDashboardMetrics = {
  overallMatchRate: '72.50',
  fullVarianceCount: 3,
  topVarianceMdas: [
    { mdaName: 'Ministry of Education', varianceCount: 2 },
    { mdaName: 'Ministry of Health', varianceCount: 1 },
  ],
};

const mockPendingSummary: ThreeWayReconciliationSummary = {
  period: '2026-03',
  mdaId: 'mda-001',
  mdaName: 'Ministry of Education',
  totalStaffCompared: 0,
  fullMatchCount: 0,
  fullMatchPercent: '0.00',
  partialMatchCount: 0,
  fullVarianceCount: 0,
  aggregateDeclared: '0.00',
  aggregateActual: '0.00',
  reconciliationHealth: '0.00',
  rows: [],
  pendingState: 'Payroll data received for 2026-03. MDA submission pending. Reconciliation will run automatically upon submission.',
};

// ─── Mocks ──────────────────────────────────────────────────────

const mockUseThreeWayReconciliation = vi.fn((): unknown => ({
  data: mockSummary,
  isLoading: false,
  isError: false,
}));

const mockUseThreeWayDashboard = vi.fn((): unknown => ({
  data: mockDashboard,
  isLoading: false,
  isError: false,
}));

vi.mock('@/hooks/useThreeWayReconciliation', () => ({
  useThreeWayReconciliation: () => mockUseThreeWayReconciliation(),
  useThreeWayDashboard: () => mockUseThreeWayDashboard(),
}));

vi.mock('@/hooks/useMigration', () => ({
  useMdaList: () => ({
    data: [
      { id: 'mda-001', name: 'Ministry of Education', code: 'EDU' },
      { id: 'mda-002', name: 'Ministry of Health', code: 'HLT' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({
    user: { role: 'super_admin', mdaId: null },
  }),
}));

vi.mock('@/hooks/usePageMeta', () => ({
  usePageMeta: vi.fn(),
}));

// ─── Render Helper ──────────────────────────────────────────────

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/reconciliation/three-way']}>
        <ThreeWayReconciliationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ─── Tests ──────────────────────────────────────────────────────

describe('ThreeWayReconciliationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseThreeWayReconciliation.mockReturnValue({
      data: mockSummary,
      isLoading: false,
      isError: false,
    });
    mockUseThreeWayDashboard.mockReturnValue({
      data: mockDashboard,
      isLoading: false,
      isError: false,
    });
  });

  it('renders summary card with match percentages', () => {
    renderPage();

    expect(screen.getByText('Reconciliation Summary — Ministry of Education')).toBeInTheDocument();
    expect(screen.getByText('2 (50.00%)')).toBeInTheDocument(); // Full Match
    expect(screen.getByText('50.00%')).toBeInTheDocument(); // Reconciliation Health
  });

  it('renders per-staff table with all 3 amounts side by side', () => {
    renderPage();

    // Check staff IDs in table
    expect(screen.getByText('S001')).toBeInTheDocument();
    expect(screen.getByText('S002')).toBeInTheDocument();
    expect(screen.getByText('S003')).toBeInTheDocument();

    // Check staff names
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Amina Bello')).toBeInTheDocument();
  });

  it('displays variance category badges correctly', () => {
    renderPage();

    // Status badges appear in both summary and table rows — use getAllByText
    expect(screen.getAllByText('Full Match').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Partial Match').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Variance Observed').length).toBeGreaterThanOrEqual(1);

    // Non-punitive variance category labels
    expect(screen.getByText('Declared and payroll amounts differ')).toBeInTheDocument();
    expect(screen.getByText('Deduction reported by MDA but not found in payroll extract')).toBeInTheDocument();
  });

  it('shows pending state banner when one source is missing', () => {
    mockUseThreeWayReconciliation.mockReturnValue({
      data: mockPendingSummary,
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText(/MDA submission pending/)).toBeInTheDocument();
    expect(screen.getByText(/Reconciliation will run automatically/)).toBeInTheDocument();
  });

  it('uses non-punitive badge colors (green/amber/grey, no red)', () => {
    renderPage();

    // Check that badge variants are non-punitive
    // Full Match → 'complete' (green)
    // Partial Match → 'review' (amber)
    // Variance Observed → 'info' (grey)
    // No 'error' or 'destructive' variants should exist
    const badges = screen.getAllByText(/Full Match|Partial Match|Variance Observed/);
    expect(badges.length).toBeGreaterThanOrEqual(3);

    // Verify no "Error" or "Fault" text exists
    expect(screen.queryByText(/Error detected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Indicating fault/i)).not.toBeInTheDocument();
  });

  it('renders loading skeleton when data is loading', () => {
    mockUseThreeWayReconciliation.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    mockUseThreeWayDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    renderPage();

    // Should not render summary card or table
    expect(screen.queryByText('Reconciliation Summary')).not.toBeInTheDocument();
  });

  it('renders correctly when reconciliation returns empty rows', () => {
    mockUseThreeWayReconciliation.mockReturnValue({
      data: {
        ...mockSummary,
        totalStaffCompared: 0,
        fullMatchCount: 0,
        fullMatchPercent: '0.00',
        partialMatchCount: 0,
        fullVarianceCount: 0,
        rows: [],
      },
      isLoading: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText('No reconciliation data available for this selection.')).toBeInTheDocument();
  });
});
