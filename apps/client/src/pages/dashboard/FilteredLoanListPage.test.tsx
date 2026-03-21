import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { FilteredLoanListPage } from './FilteredLoanListPage';

const { mockUseFilteredLoans } = vi.hoisted(() => {
  const mockUseFilteredLoans = vi.fn();
  return { mockUseFilteredLoans };
});

vi.mock('@/hooks/useFilteredLoans', () => ({
  useFilteredLoans: mockUseFilteredLoans,
}));

const mockLoans = [
  {
    loanId: 'loan-1',
    staffName: 'Akinwale Babatunde',
    staffId: 'OY/MOH/001',
    mdaName: 'Ministry of Health',
    mdaId: 'mda-1',
    loanReference: 'VL-2024-001',
    outstandingBalance: '1500000.00',
    classification: 'OVERDUE',
    lastDeductionDate: '2026-01-15T00:00:00Z',
  },
];

function renderPage(initialEntries = ['/dashboard/loans?filter=overdue']) {
  mockUseFilteredLoans.mockReturnValue({
    data: { data: mockLoans, pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } },
    isPending: false,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <FilteredLoanListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FilteredLoanListPage — column sorting', () => {
  it('renders sortable column headers with neutral sort icons', () => {
    renderPage();
    // Sortable columns should be present
    expect(screen.getByText(/Staff Name/)).toBeInTheDocument();
    expect(screen.getByText(/Loan Ref/)).toBeInTheDocument();
    expect(screen.getByText(/Outstanding/)).toBeInTheDocument();
    expect(screen.getByText(/Classification/)).toBeInTheDocument();
    expect(screen.getByText(/Last Deduction/)).toBeInTheDocument();
  });

  it('clicking Staff Name header triggers ascending sort', async () => {
    const user = userEvent.setup();
    renderPage();

    const staffNameHeader = screen.getByText(/Staff Name/).closest('th')!;
    await user.click(staffNameHeader);

    // useFilteredLoans should be re-called with sortBy=staffName, sortOrder=asc
    const lastCall = mockUseFilteredLoans.mock.calls[mockUseFilteredLoans.mock.calls.length - 1];
    expect(lastCall[2]).toBe('staffName');
    expect(lastCall[3]).toBe('asc');
  });

  it('clicking same column header twice toggles to descending sort', async () => {
    const user = userEvent.setup();
    renderPage(['/dashboard/loans?filter=overdue&sortBy=staffName&sortOrder=asc']);

    const staffNameHeader = screen.getByText(/Staff Name/).closest('th')!;
    await user.click(staffNameHeader);

    const lastCall = mockUseFilteredLoans.mock.calls[mockUseFilteredLoans.mock.calls.length - 1];
    expect(lastCall[2]).toBe('staffName');
    expect(lastCall[3]).toBe('desc');
  });

  it('clicking a different column resets sort to ascending', async () => {
    const user = userEvent.setup();
    renderPage(['/dashboard/loans?filter=overdue&sortBy=staffName&sortOrder=desc']);

    const loanRefHeader = screen.getByText(/Loan Ref/).closest('th')!;
    await user.click(loanRefHeader);

    const lastCall = mockUseFilteredLoans.mock.calls[mockUseFilteredLoans.mock.calls.length - 1];
    expect(lastCall[2]).toBe('loanReference');
    expect(lastCall[3]).toBe('asc');
  });

  it('non-sortable columns (Staff ID, MDA) have no click handler', async () => {
    const user = userEvent.setup();
    renderPage();

    const callCountBefore = mockUseFilteredLoans.mock.calls.length;

    const staffIdHeader = screen.getByText('Staff ID').closest('th')!;
    await user.click(staffIdHeader);

    const mdaHeader = screen.getByText('MDA').closest('th')!;
    await user.click(mdaHeader);

    // No new calls with sort params — non-sortable headers don't trigger sort
    const callsAfter = mockUseFilteredLoans.mock.calls.slice(callCountBefore);
    const sortCalls = callsAfter.filter((c: unknown[]) => c[2] !== undefined);
    expect(sortCalls.length).toBe(0);
  });
});

describe('FilteredLoanListPage — rendering', () => {
  it('renders loan data in table rows', () => {
    renderPage();
    expect(screen.getByText('Akinwale Babatunde')).toBeInTheDocument();
    expect(screen.getByText('VL-2024-001')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
  });

  it('renders empty state when no loans match filter', () => {
    mockUseFilteredLoans.mockReturnValue({
      data: { data: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 } },
      isPending: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/loans?filter=overdue']}>
          <FilteredLoanListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('No loans found matching this filter.')).toBeInTheDocument();
  });

  it('renders skeleton rows while loading', () => {
    mockUseFilteredLoans.mockReturnValue({
      data: undefined,
      isPending: true,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/dashboard/loans?filter=overdue']}>
          <FilteredLoanListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
