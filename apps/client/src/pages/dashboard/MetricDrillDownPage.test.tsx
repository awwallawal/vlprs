import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MetricDrillDownPage } from './MetricDrillDownPage';

const mockNavigate = vi.fn();
let mockMetric = 'at-risk';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ metric: mockMetric }),
  };
});

vi.mock('@/hooks/useDrillDown', () => ({
  useDrillDown: () => ({
    data: [
      {
        mdaId: 'mda-1',
        mdaName: 'Agriculture',
        contributionCount: 42,
        contributionAmount: '1000000.00',
        healthScore: 85,
        healthBand: 'healthy',
        statusDistribution: { ON_TRACK: 30, OVERDUE: 10, STALLED: 2 },
        expectedMonthlyDeduction: null,
        actualMonthlyRecovery: null,
        variancePercent: null,
      },
    ],
    isPending: false,
  }),
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MetricDrillDownPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MetricDrillDownPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockMetric = 'at-risk';
  });

  // AC 1: "View All Loans" button renders for applicable metrics
  it('renders "View All Loans" button for at-risk metric', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /view all loans/i })).toBeInTheDocument();
  });

  it('renders "View All Loans" button for completion-rate metric', () => {
    mockMetric = 'completion-rate';
    renderPage();
    expect(screen.getByRole('button', { name: /view all loans/i })).toBeInTheDocument();
  });

  // AC 1: Button navigates to correct filtered URL
  it('navigates to filtered loans page when "View All Loans" is clicked', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /view all loans/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=overdue');
  });

  it('navigates to completed loans for completion-rate metric', async () => {
    mockMetric = 'completion-rate';
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /view all loans/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=completed');
  });

  // AC 2: MDA row click-through still works (no regression)
  it('MDA rows remain clickable', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = screen.getByText('Agriculture').closest('tr')!;
    expect(row).toHaveAttribute('role', 'link');
    await user.click(row);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/mda/mda-1?metric=at-risk');
  });

  // Button hidden for aggregate metrics
  it('does not show "View All Loans" for total-exposure', () => {
    mockMetric = 'total-exposure';
    renderPage();
    expect(screen.queryByRole('button', { name: /view all loans/i })).not.toBeInTheDocument();
  });

  it('does not show "View All Loans" for monthly-recovery', () => {
    mockMetric = 'monthly-recovery';
    renderPage();
    expect(screen.queryByRole('button', { name: /view all loans/i })).not.toBeInTheDocument();
  });

  it('does not show "View All Loans" for fund-available', () => {
    mockMetric = 'fund-available';
    renderPage();
    expect(screen.queryByRole('button', { name: /view all loans/i })).not.toBeInTheDocument();
  });

  it('does not show "View All Loans" for active-loans', () => {
    mockMetric = 'active-loans';
    renderPage();
    expect(screen.queryByRole('button', { name: /view all loans/i })).not.toBeInTheDocument();
  });

  it('does not show "View All Loans" for outstanding-receivables', () => {
    mockMetric = 'outstanding-receivables';
    renderPage();
    expect(screen.queryByRole('button', { name: /view all loans/i })).not.toBeInTheDocument();
  });

  it('does not show "View All Loans" for collection-potential', () => {
    mockMetric = 'collection-potential';
    renderPage();
    expect(screen.queryByRole('button', { name: /view all loans/i })).not.toBeInTheDocument();
  });

  it('does not show "View All Loans" for loans-in-window', () => {
    mockMetric = 'loans-in-window';
    renderPage();
    expect(screen.queryByRole('button', { name: /view all loans/i })).not.toBeInTheDocument();
  });
});
