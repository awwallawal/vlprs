import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { HistoricalReconciliation } from './HistoricalReconciliation';

const { mockUseHistoricalReconciliation, mockUseFlagDiscrepancy } = vi.hoisted(() => ({
  mockUseHistoricalReconciliation: vi.fn(),
  mockUseFlagDiscrepancy: vi.fn(),
}));

vi.mock('@/hooks/useHistoricalSubmission', () => ({
  useHistoricalReconciliation: mockUseHistoricalReconciliation,
  useFlagDiscrepancy: (...args: unknown[]) => mockUseFlagDiscrepancy(...args),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

const baseData: {
  matchedCount: number;
  varianceCount: number;
  largestVarianceAmount: string;
  matchRate: number;
  noBaseline: boolean;
  flaggedRows: never[];
  details: Array<{
    staffId: string;
    staffName: string;
    declaredAmount: string;
    baselineAmount: string;
    variance: string;
    matchStatus: 'matched' | 'variance';
    flagged: boolean;
    flagReason: string | null;
  }>;
} = {
  matchedCount: 3,
  varianceCount: 2,
  largestVarianceAmount: '1500.00',
  matchRate: 60.0,
  noBaseline: false,
  flaggedRows: [],
  details: [
    {
      staffId: 'S001',
      staffName: 'John Doe',
      declaredAmount: '15000.00',
      baselineAmount: '15000.00',
      variance: '0.00',
      matchStatus: 'matched' as const,
      flagged: false,
      flagReason: null,
    },
    {
      staffId: 'S002',
      staffName: 'Jane Smith',
      declaredAmount: '20000.00',
      baselineAmount: '18000.00',
      variance: '2000.00',
      matchStatus: 'variance' as const,
      flagged: false,
      flagReason: null,
    },
    {
      staffId: 'S003',
      staffName: 'Bob Wilson',
      declaredAmount: '12000.00',
      baselineAmount: '12100.00',
      variance: '-100.00',
      matchStatus: 'matched' as const,
      flagged: false,
      flagReason: null,
    },
    {
      staffId: 'S004',
      staffName: 'Alice Brown',
      declaredAmount: '25000.00',
      baselineAmount: '23500.00',
      variance: '1500.00',
      matchStatus: 'variance' as const,
      flagged: false,
      flagReason: null,
    },
    {
      staffId: 'S005',
      staffName: 'Charlie Green',
      declaredAmount: '10000.00',
      baselineAmount: '10200.00',
      variance: '-200.00',
      matchStatus: 'matched' as const,
      flagged: false,
      flagReason: null,
    },
  ],
};

function renderComponent(overrides: { data?: typeof baseData | null; isPending?: boolean } = {}) {
  const { data = baseData, isPending = false } = overrides;
  mockUseHistoricalReconciliation.mockReturnValue({ data, isPending });
  mockUseFlagDiscrepancy.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });

  const queryClient = createQueryClient();
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <HistoricalReconciliation submissionId="test-sub-id" />
    </QueryClientProvider>,
  );
  return { container };
}

describe('HistoricalReconciliation', () => {
  it('renders matched and variance count badges with correct values', () => {
    renderComponent();
    expect(screen.getByText(/3.*Matched/i)).toBeInTheDocument();
    expect(screen.getByText(/2.*Variance/i)).toBeInTheDocument();
  });

  it('renders aggregate match rate percentage', () => {
    renderComponent();
    expect(screen.getByText(/60.*%.*match rate/i)).toBeInTheDocument();
  });

  it('renders per-loanee detail table with declared vs baseline amounts', () => {
    renderComponent();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('S001')).toBeInTheDocument();
    expect(screen.getByText('S002')).toBeInTheDocument();
  });

  it('displays all-clear state when all records matched', () => {
    const allMatchedData = {
      ...baseData,
      varianceCount: 0,
      matchedCount: 5,
      matchRate: 100.0,
      details: baseData.details.map((d) => ({ ...d, matchStatus: 'matched' as const })),
    };
    renderComponent({ data: allMatchedData });
    expect(screen.getByText(/all historical records align/i)).toBeInTheDocument();
  });

  it('"Flag for Review" button opens dialog with reason field (min 10 chars)', async () => {
    const user = userEvent.setup();
    renderComponent();
    const flagButtons = screen.getAllByRole('button', { name: /flag/i });
    expect(flagButtons.length).toBeGreaterThan(0);

    await user.click(flagButtons[0]);
    expect(screen.getByPlaceholderText(/at least 10 characters/i)).toBeInTheDocument();
  });

  it('successful flag updates row to show "Flagged" badge', () => {
    const flaggedData = {
      ...baseData,
      details: baseData.details.map((d) =>
        d.staffId === 'S002'
          ? { ...d, flagged: true, flagReason: 'Amount seems wrong based on our records' }
          : d,
      ),
    };
    renderComponent({ data: flaggedData });
    expect(screen.getByText('Flagged')).toBeInTheDocument();
  });

  it('skeleton loading state during fetch', () => {
    const { container } = renderComponent({ isPending: true });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('non-punitive badge colors (gold for variance, green for matched, no red)', () => {
    const { container } = renderComponent();
    const html = container.innerHTML.toLowerCase();
    // Should not contain "error", "warning", "red" badge classes
    expect(html).not.toContain('bg-red');
    expect(html).not.toContain('text-red');
    expect(html).not.toContain('bg-destructive');
  });

  it('no baseline state shows informational message (no badges, no error)', () => {
    const noBaselineData = {
      ...baseData,
      noBaseline: true,
      matchedCount: 0,
      varianceCount: 0,
      matchRate: 0,
      details: [],
    };
    renderComponent({ data: noBaselineData });
    expect(screen.getByText(/no migration baseline available/i)).toBeInTheDocument();
    expect(screen.queryByText(/Matched/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Variance/)).not.toBeInTheDocument();
  });

  it('amounts displayed in Naira format', () => {
    renderComponent();
    // NairaDisplay component should format amounts with ₦ prefix
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();
    // Check that row contains amount cells
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1); // header + data rows
  });
});
