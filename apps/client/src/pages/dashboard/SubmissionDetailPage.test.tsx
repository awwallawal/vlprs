import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SubmissionDetailPage } from './SubmissionDetailPage';
import type { SubmissionDetail } from '@vlprs/shared';

const mockSubmissionDetail: SubmissionDetail = {
  id: 'sub-001',
  mdaId: 'mda-003',
  mdaName: 'Ministry of Health',
  period: '2026-03',
  referenceNumber: 'BIR-2026-03-0001',
  status: 'confirmed',
  recordCount: 3,
  source: 'csv',
  filename: 'march-deductions.csv',
  fileSizeBytes: 2048,
  createdAt: '2026-03-15T10:30:00Z',
  rows: [
    {
      staffId: 'OY/HLT/2019/0451',
      month: '2026-03',
      amountDeducted: '45000.00',
      payrollBatchReference: 'PB-2026-03-001',
      mdaCode: 'HLT',
      eventFlag: 'NONE',
      eventDate: null,
      cessationReason: null,
    },
    {
      staffId: 'OY/HLT/2020/0122',
      month: '2026-03',
      amountDeducted: '32500.50',
      payrollBatchReference: 'PB-2026-03-001',
      mdaCode: 'HLT',
      eventFlag: 'RETIREMENT',
      eventDate: '2026-04-30',
      cessationReason: null,
    },
    {
      staffId: 'OY/HLT/2018/0087',
      month: '2026-03',
      amountDeducted: '28000.00',
      payrollBatchReference: 'PB-2026-03-001',
      mdaCode: 'HLT',
      eventFlag: 'TRANSFER_OUT',
      eventDate: '2026-03-01',
      cessationReason: null,
    },
  ],
};

// Default mock state
let mockDetailReturn: {
  data: SubmissionDetail | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
} = {
  data: mockSubmissionDetail,
  isPending: false,
  isError: false,
  error: null,
};

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ submissionId: 'sub-001' }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/hooks/useSubmissionData', () => ({
  useSubmissionDetail: () => mockDetailReturn,
  useComparisonSummary: () => ({
    data: {
      submissionId: 'sub-001',
      referenceNumber: 'BIR-2026-03-0001',
      summary: {
        alignedCount: 2,
        minorVarianceCount: 1,
        varianceCount: 0,
        totalRecords: 3,
        rows: [],
      },
    },
    isPending: false,
  }),
}));

vi.mock('@/hooks/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({
    copied: false,
    copyToClipboard: vi.fn(),
  }),
}));

function renderPage(initialEntries = ['/dashboard/submissions/sub-001']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <SubmissionDetailPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SubmissionDetailPage', () => {
  beforeEach(() => {
    mockDetailReturn = {
      data: mockSubmissionDetail,
      isPending: false,
      isError: false,
      error: null,
    };
    mockNavigate.mockClear();
  });

  // AC 2: Submission Metadata Display
  it('renders submission metadata — reference number, period, date, row count, status badge, source', () => {
    renderPage();

    // Reference number (appears in breadcrumb and heading)
    expect(screen.getByRole('heading', { level: 1, name: 'BIR-2026-03-0001' })).toBeInTheDocument();

    // Period formatted as "March 2026"
    expect(screen.getByText('March 2026')).toBeInTheDocument();

    // Status badge
    expect(screen.getByText('Confirmed')).toBeInTheDocument();

    // Row count
    expect(screen.getByText(/3 rows/)).toBeInTheDocument();

    // Source: CSV Upload with file size
    expect(screen.getByText(/CSV Upload/)).toBeInTheDocument();
    expect(screen.getByText(/march-deductions.csv/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();

    // MDA name
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
  });

  // AC 3: Submission Rows Table
  it('renders all submission rows in table with correct columns', () => {
    renderPage();

    // Table heading
    expect(
      screen.getByRole('heading', { level: 2, name: 'Submission Rows' }),
    ).toBeInTheDocument();

    // Column headers
    expect(screen.getByText('Staff ID')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Amount Deducted')).toBeInTheDocument();
    expect(screen.getByText('Payroll Batch Ref')).toBeInTheDocument();
    expect(screen.getByText('MDA Code')).toBeInTheDocument();
    expect(screen.getByText('Event Flag')).toBeInTheDocument();
    expect(screen.getByText('Event Date')).toBeInTheDocument();

    // Row data
    expect(screen.getByText('OY/HLT/2019/0451')).toBeInTheDocument();
    expect(screen.getByText('OY/HLT/2020/0122')).toBeInTheDocument();
    expect(screen.getByText('OY/HLT/2018/0087')).toBeInTheDocument();
  });

  // AC 3: Event flag visual distinction
  it('rows with non-NONE event flags have visual distinction (teal border)', () => {
    renderPage();

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row, rows[1-3] are data rows
    const normalRow = rows[1]; // NONE event flag
    const retirementRow = rows[2]; // RETIREMENT event flag
    const transferRow = rows[3]; // TRANSFER_OUT event flag

    expect(normalRow).not.toHaveClass('border-l-teal-500');
    expect(retirementRow).toHaveClass('border-l-teal-500');
    expect(transferRow).toHaveClass('border-l-teal-500');
  });

  // AC 3: Amount formatting
  it('amount column formats as ₦ with commas', () => {
    renderPage();
    expect(screen.getByText('₦45,000.00')).toBeInTheDocument();
    expect(screen.getByText('₦32,500.50')).toBeInTheDocument();
    expect(screen.getByText('₦28,000.00')).toBeInTheDocument();
  });

  // AC 3: Event flag labels
  it('renders human-readable event flag labels', () => {
    renderPage();
    expect(screen.getByText('Retirement')).toBeInTheDocument();
    expect(screen.getByText('Transfer Out')).toBeInTheDocument();
  });

  // AC 4: ComparisonSummary renders
  it('ComparisonSummary renders for confirmed submissions', () => {
    renderPage();
    // ComparisonSummary renders its own section heading
    expect(screen.getByText(/records aligned/i)).toBeInTheDocument();
  });

  // AC 6: Breadcrumb
  it('breadcrumb shows reference number and links back to submissions', () => {
    renderPage();

    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getByText('Submissions')).toBeInTheDocument();
    expect(within(nav).getByText('BIR-2026-03-0001')).toBeInTheDocument();

    const submissionsLink = within(nav).getByText('Submissions');
    expect(submissionsLink.closest('a')).toHaveAttribute(
      'href',
      '/dashboard/submissions',
    );
  });

  // AC 7: Skeleton loading state
  it('skeleton loading state during data fetch', () => {
    mockDetailReturn = {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
    };
    renderPage();

    // Should not show actual data
    expect(screen.queryByText('BIR-2026-03-0001')).not.toBeInTheDocument();

    // Should show skeletons (multiple skeleton divs)
    const container = document.querySelector('.space-y-8');
    expect(container).toBeInTheDocument();
  });

  // AC 7: Error state
  it('error state displays non-punitive message', () => {
    mockDetailReturn = {
      data: undefined,
      isPending: false,
      isError: true,
      error: new Error('Server error'),
    };
    renderPage();
    expect(
      screen.getByText('Unable to load submission details — please try again'),
    ).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  // AC 7: 404 error
  it('404 shows "Submission not found" message', () => {
    mockDetailReturn = {
      data: undefined,
      isPending: false,
      isError: true,
      error: Object.assign(new Error('Not Found'), { status: 404 }),
    };
    renderPage();
    expect(screen.getByText('Submission not found')).toBeInTheDocument();
  });

  // AC 5: 403 error (MDA isolation)
  it('403 shows access denied message', () => {
    mockDetailReturn = {
      data: undefined,
      isPending: false,
      isError: true,
      error: Object.assign(new Error('Forbidden'), { status: 403 }),
    };
    renderPage();
    expect(
      screen.getByText("You don't have access to this submission"),
    ).toBeInTheDocument();
  });

  // AC 6: Back button navigation
  it('clicking back button calls navigate(-1)', async () => {
    const user = userEvent.setup();
    renderPage();
    const backButton = screen.getByRole('button', {
      name: /Back to Submissions/,
    });
    await user.click(backButton);
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  // Manual entry source indicator
  it('renders manual entry source indicator correctly', () => {
    mockDetailReturn = {
      data: {
        ...mockSubmissionDetail,
        source: 'manual',
        filename: null,
        fileSizeBytes: null,
      } satisfies SubmissionDetail,
      isPending: false,
      isError: false,
      error: null,
    };
    renderPage();
    expect(screen.getByText(/Manual Entry/)).toBeInTheDocument();
  });

  // Event date formatting
  it('event date shows formatted date or dash when null', () => {
    renderPage();
    // Row with eventDate '2026-04-30'
    expect(screen.getByText('30-Apr-2026')).toBeInTheDocument();
    // Rows with null eventDate show '—'
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});
