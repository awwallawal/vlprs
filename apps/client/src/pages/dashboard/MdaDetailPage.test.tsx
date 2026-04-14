import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MdaDetailPage } from './MdaDetailPage';

const mockMdaDetail = {
  name: 'Ministry of Health',
  code: 'HLT',
  officerName: 'Dr. Adeola',
  loanCount: 45,
  totalExposure: '125000000.00',
  monthlyRecovery: '5200000.00',
  healthScore: 72,
  healthBand: 'attention' as const,
  statusDistribution: {
    completed: 10,
    onTrack: 20,
    overdue: 8,
    stalled: 5,
    overDeducted: 2,
  },
  expectedMonthlyDeduction: '6000000.00',
  actualMonthlyRecovery: '5200000.00',
  variancePercent: -13.3,
  // MdaDetailPage (UAT #7) now reads declaredRecovery + collectionPotential + recoveryVariancePercent
  declaredRecovery: '5200000.00',
  collectionPotential: '6000000.00',
  recoveryVariancePercent: -13.3,
  recoveryVarianceAmount: '-800000.00',
};

const mockSubmissions = [
  {
    id: 'sub-001',
    referenceNumber: 'MOH-2026-02-0001',
    submissionDate: '2026-02-15T14:20:00Z',
    recordCount: 178,
    alignedCount: 175,
    varianceCount: 3,
    status: 'confirmed' as const,
  },
];

const mockLoans = {
  data: [
    {
      loanId: 'loan-001',
      staffName: 'Akinwale Babatunde',
      staffId: 'OY/MOH/2019/0451',
      loanReference: 'VL-2024-00451',
      outstandingBalance: '1875000.00',
      classification: 'ON_TRACK' as const,
      lastDeductionDate: '2026-02-28',
      computedRetirementDate: '2030-06-15',
      mdaName: 'Ministry of Health',
    },
  ],
  pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
};

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ mdaId: 'mda-003' }),
  };
});

const { mockUseMdaLoans } = vi.hoisted(() => {
  const mockUseMdaLoans = vi.fn();
  return { mockUseMdaLoans };
});

vi.mock('@/hooks/useMdaData', () => ({
  useMdaDetail: () => ({ data: mockMdaDetail, isPending: false }),
  useMdaComplianceGrid: () => ({ data: [], isPending: false }),
  useMdaLoans: (...args: unknown[]) => mockUseMdaLoans(...args),
}));

// Default mock — single page, no pagination controls rendered
mockUseMdaLoans.mockReturnValue({ data: mockLoans, isPending: false });

vi.mock('@/hooks/useSubmissionData', () => ({
  useSubmissionHistory: () => ({
    data: { items: mockSubmissions, total: mockSubmissions.length, page: 1, pageSize: 20 },
    isPending: false,
  }),
}));

function renderPage(initialEntries = ['/dashboard/mda/mda-003']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <MdaDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MdaDetailPage', () => {
  beforeEach(() => {
    mockUseMdaLoans.mockReturnValue({ data: mockLoans, isPending: false });
  });

  it('renders MDA name heading', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Ministry of Health' }),
    ).toBeInTheDocument();
  });

  it('renders MDA code and officer name', () => {
    renderPage();
    expect(screen.getByText(/Code: HLT/)).toBeInTheDocument();
    expect(screen.getByText(/Liaison Officer: Dr. Adeola/)).toBeInTheDocument();
  });

  it('renders summary cards', () => {
    renderPage();
    expect(screen.getByText('Loan Count')).toBeInTheDocument();
    expect(screen.getByText('Total Exposure')).toBeInTheDocument();
    // "Monthly Recovery" renamed to "Declared Recovery" in UAT #9
    expect(screen.getByText('Declared Recovery')).toBeInTheDocument();
  });

  it('renders submission history table', () => {
    renderPage();
    // Renamed to "Monthly Submissions" in MDA detail page
    expect(
      screen.getByRole('heading', { level: 2, name: 'Monthly Submissions' }),
    ).toBeInTheDocument();
    expect(screen.getByText('MOH-2026-02-0001')).toBeInTheDocument();
  });

  it('renders loans table with loan data', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Loans' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Akinwale Babatunde')).toBeInTheDocument();
    expect(screen.getByText('VL-2024-00451')).toBeInTheDocument();
  });

  it('renders back button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /Back/ }),
    ).toBeInTheDocument();
  });

  it('renders health score badge', () => {
    renderPage();
    expect(screen.getByText(/72/)).toBeInTheDocument();
  });

  it('renders variance information', () => {
    renderPage();
    // Updated copy: shows "Recovery Analysis" with percent variance
    expect(screen.getByText('Recovery Analysis')).toBeInTheDocument();
    expect(screen.getByText(/% variance/)).toBeInTheDocument();
  });

  it('does not render pagination when totalPages is 1', () => {
    renderPage();
    expect(screen.queryByText(/Previous/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next/)).not.toBeInTheDocument();
  });

  it('renders pagination controls when totalPages > 1', () => {
    mockUseMdaLoans.mockReturnValue({
      data: {
        data: mockLoans.data,
        pagination: { page: 1, pageSize: 25, totalItems: 171, totalPages: 7 },
      },
      isPending: false,
    });
    renderPage();
    expect(screen.getByText(/Showing 1–25 of 171 loans/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled();
  });

  it('clicking Next advances the loan page', async () => {
    const user = userEvent.setup();
    mockUseMdaLoans.mockReturnValue({
      data: {
        data: mockLoans.data,
        pagination: { page: 1, pageSize: 25, totalItems: 171, totalPages: 7 },
      },
      isPending: false,
    });
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    // useMdaLoans should be re-called with page=2
    await waitFor(() => {
      const lastCall = mockUseMdaLoans.mock.calls[mockUseMdaLoans.mock.calls.length - 1];
      expect(lastCall[2]).toBe(2);
    });
  });
});
