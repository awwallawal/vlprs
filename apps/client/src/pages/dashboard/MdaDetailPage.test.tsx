import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { MdaDetailPage } from './MdaDetailPage';

const mockMdaDetail = {
  name: 'Ministry of Health',
  code: 'HLT',
  officerName: 'Dr. Adeola',
  loanCount: 45,
  totalExposure: '125000000.00',
  monthlyRecovery: '5200000.00',
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

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ mdaId: 'mda-003' }),
  };
});

vi.mock('@/hooks/useMdaData', () => ({
  useMdaDetail: () => ({ data: mockMdaDetail, isPending: false }),
  useMdaComplianceGrid: () => ({ data: [], isPending: false }),
}));

vi.mock('@/hooks/useSubmissionData', () => ({
  useSubmissionHistory: () => ({ data: mockSubmissions, isPending: false }),
}));

vi.mock('@/mocks/loanDetail', () => ({
  MOCK_LOAN_DETAILS: {
    'loan-001': {
      loanId: 'loan-001',
      borrowerName: 'Akinwale Babatunde',
      staffId: 'OY/MOH/2019/0451',
      mdaName: 'Ministry of Health',
      loanRef: 'VL-2024-00451',
      outstandingBalance: '1875000.00',
      status: 'ACTIVE',
    },
  },
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
    expect(screen.getByText('Monthly Recovery')).toBeInTheDocument();
  });

  it('renders submission history table', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Submission History' }),
    ).toBeInTheDocument();
    expect(screen.getByText('MOH-2026-02-0001')).toBeInTheDocument();
  });

  it('renders loans table', async () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Loans' }),
    ).toBeInTheDocument();
    // Loan data loads via async useQuery — wait for it to resolve
    expect(await screen.findByText('Akinwale Babatunde')).toBeInTheDocument();
  });

  it('renders back to dashboard button', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /Back to Dashboard/ }),
    ).toBeInTheDocument();
  });
});
