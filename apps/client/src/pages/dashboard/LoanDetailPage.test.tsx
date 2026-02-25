import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { LoanDetailPage } from './LoanDetailPage';

const mockLoan = {
  loanId: 'loan-001',
  borrowerName: 'Akinwale Babatunde',
  staffId: 'OY/MOH/2019/0451',
  mdaName: 'Ministry of Health',
  loanRef: 'VL-2024-00451',
  gradeLevelTier: 3,
  principal: '2500000.00',
  outstandingBalance: '1875000.00',
  installmentsPaid: 10,
  installmentsRemaining: 30,
  lastDeductionDate: '2026-02-01T00:00:00Z',
  status: 'ACTIVE' as const,
  retirementDate: '2035-06-30T00:00:00Z',
};

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ mdaId: 'mda-003', loanId: 'loan-001' }),
  };
});

vi.mock('@/hooks/useLoanData', () => ({
  useLoanDetail: () => ({ data: mockLoan, isPending: false }),
  useLoanSearch: () => ({ data: [], isPending: false }),
}));

function renderPage(initialEntries = ['/dashboard/mda/mda-003/loan/loan-001']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <LoanDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LoanDetailPage', () => {
  it('renders borrower name heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Akinwale Babatunde' }),
    ).toBeInTheDocument();
  });

  it('renders loan status badge', () => {
    renderPage();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders loan detail cards', () => {
    renderPage();
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
    expect(screen.getByText('Loan Reference')).toBeInTheDocument();
    expect(screen.getByText('VL-2024-00451')).toBeInTheDocument();
    expect(screen.getByText('Grade Level Tier')).toBeInTheDocument();
    expect(screen.getByText('Tier 3')).toBeInTheDocument();
  });

  it('renders placeholder sections for future features', () => {
    renderPage();
    expect(screen.getByText('Repayment Schedule')).toBeInTheDocument();
    expect(screen.getByText('Ledger History')).toBeInTheDocument();
    expect(screen.getByText('Annotations')).toBeInTheDocument();
  });

  it('renders "How was this calculated?" accordion', () => {
    renderPage();
    expect(screen.getByText('How was this calculated?')).toBeInTheDocument();
  });

  it('renders back to MDA button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /Back to MDA/ }),
    ).toBeInTheDocument();
  });
});
