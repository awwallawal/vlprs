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

const mockCompliance = [
  {
    mdaId: 'mda-001',
    mdaCode: 'MOF',
    mdaName: 'Ministry of Finance',
    status: 'submitted' as const,
    lastSubmission: '2026-02-15T09:30:00Z',
    recordCount: 142,
    alignedCount: 140,
    varianceCount: 2,
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
  },
];

const mockAttention = [
  {
    id: 'att-001',
    description: 'Submission pending, 3 days past due',
    mdaName: 'Ministry of Works',
    category: 'review' as const,
    timestamp: '2026-02-18T10:00:00Z',
  },
];

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
    expect(screen.getByText('Monthly Recovery')).toBeInTheDocument();
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
    expect(screen.getByText('Ministry of Finance')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Education')).toBeInTheDocument();
  });

  it('renders compliance status badges', () => {
    renderPage();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
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
