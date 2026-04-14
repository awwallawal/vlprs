import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { LoanDetailPage } from './LoanDetailPage';

const mockLoan = {
  id: 'loan-001',
  staffId: 'OY/MOH/2019/0451',
  staffName: 'Akinwale Babatunde',
  gradeLevel: 'Level 8',
  mdaId: 'mda-003',
  mdaName: 'Ministry of Health',
  mdaCode: 'MOH',
  principalAmount: '2500000.00',
  interestRate: '0.1333',
  tenureMonths: 40,
  moratoriumMonths: 0,
  monthlyDeductionAmount: '83250.00',
  approvalDate: '2024-01-01T00:00:00Z',
  firstDeductionDate: '2024-02-01T00:00:00Z',
  loanReference: 'VL-2024-00451',
  status: 'ACTIVE' as const,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2026-02-01T00:00:00Z',
  balance: {
    computedBalance: '1875000.00',
    installmentsCompleted: 10,
    installmentsRemaining: 30,
    lastDeductionDate: '2026-02-01T00:00:00Z',
    totalAmountPaid: '832500.00',
    derivation: {
      formula: 'Total Loan - Total Paid',
      totalLoan: '3330000.00',
    },
  },
  schedule: { schedule: [] as unknown[] },
  ledgerEntryCount: 10,
  temporalProfile: null,
  gratuityProjection: null,
  migrationContext: null,
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
  useUpdateStaffId: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useCertificate', () => ({
  useCertificate: () => ({ data: null, isPending: false }),
  useDownloadCertificatePdf: () => ({ mutate: vi.fn(), isPending: false }),
  useResendNotifications: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useExceptionData', () => ({
  useExceptions: () => ({ data: { data: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 }, total: 0 }, isPending: false }),
  useFlagException: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({ user: { role: 'super_admin' } }),
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

  it('renders loan detail cards with MDA, reference, grade, tenure', () => {
    renderPage();
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
    expect(screen.getByText('Loan Reference')).toBeInTheDocument();
    expect(screen.getByText('VL-2024-00451')).toBeInTheDocument();
    expect(screen.getByText('Grade Level')).toBeInTheDocument();
    expect(screen.getByText('Level 8')).toBeInTheDocument();
    expect(screen.getByText('Tenure')).toBeInTheDocument();
  });

  it('renders repayment schedule accordion', () => {
    renderPage();
    expect(screen.getByText(/Repayment Schedule/)).toBeInTheDocument();
  });

  it('renders back to MDA button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /Back to MDA/ }),
    ).toBeInTheDocument();
  });
});
