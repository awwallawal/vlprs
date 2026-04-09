import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CertificateListPage } from './CertificateListPage';

const { mockUseCertificateList, mockUseDownload, mockUseResend, mockAuthState } = vi.hoisted(
  () => ({
    mockUseCertificateList: vi.fn(),
    mockUseDownload: vi.fn(),
    mockUseResend: vi.fn(),
    // Mutable per-test auth state so we can exercise SUPER_ADMIN, DEPT_ADMIN,
    // and MDA_OFFICER paths without re-mocking the module each time.
    mockAuthState: { user: { role: 'super_admin' as 'super_admin' | 'dept_admin' | 'mda_officer' } },
  }),
);

vi.mock('@/hooks/useCertificate', () => ({
  useCertificateList: mockUseCertificateList,
  useDownloadCertificatePdf: mockUseDownload,
  useResendNotifications: mockUseResend,
}));

vi.mock('@/hooks/useMigration', () => ({
  useMdaList: vi.fn().mockReturnValue({ data: [] }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) => selector(mockAuthState)),
}));

const sampleCertificates = [
  {
    certificateId: 'ASC-2026-04-0001',
    loanId: 'loan-1',
    beneficiaryName: 'Adebayo Okonkwo',
    staffId: 'STAFF-001',
    mdaId: 'mda-1',
    mdaName: 'Ministry of Works',
    loanReference: 'VLC-001',
    completionDate: '2026-04-01T00:00:00Z',
    generatedAt: '2026-04-02T10:00:00Z',
    notifiedMdaAt: '2026-04-02T10:05:00Z',
    notifiedBeneficiaryAt: '2026-04-02T10:06:00Z',
    originalPrincipal: '500000.00',
    totalPaid: '566650.00',
  },
  {
    certificateId: 'ASC-2026-04-0002',
    loanId: 'loan-2',
    beneficiaryName: 'Chidinma Eze',
    staffId: 'STAFF-002',
    mdaId: 'mda-1',
    mdaName: 'Ministry of Works',
    loanReference: 'VLC-002',
    completionDate: '2026-04-03T00:00:00Z',
    generatedAt: '2026-04-03T11:00:00Z',
    notifiedMdaAt: null,
    notifiedBeneficiaryAt: null,
    originalPrincipal: '300000.00',
    totalPaid: '339990.00',
  },
];

function renderPage(initialEntries: string[] = ['/dashboard/certificates']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <CertificateListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseCertificateList.mockReset();
  mockUseDownload.mockReturnValue({ mutate: vi.fn(), isPending: false });
  mockUseResend.mockReturnValue({ mutate: vi.fn(), isPending: false });
  // Default to super_admin so existing tests are unaffected; per-test overrides
  // can flip the role for DEPT_ADMIN / MDA_OFFICER coverage.
  mockAuthState.user = { role: 'super_admin' };
});

describe('CertificateListPage', () => {
  it('renders certificate rows when data is available', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: sampleCertificates, total: 2, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    expect(screen.getByText(/Completed Loans & Certificates/)).toBeInTheDocument();
    expect(screen.getByText('ASC-2026-04-0001')).toBeInTheDocument();
    expect(screen.getByText('ASC-2026-04-0002')).toBeInTheDocument();
    expect(screen.getByText('Adebayo Okonkwo')).toBeInTheDocument();
    expect(screen.getByText('Chidinma Eze')).toBeInTheDocument();
    expect(screen.getByText(/2 issued/)).toBeInTheDocument();
  });

  it('shows the Notified badge when both timestamps are set', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: [sampleCertificates[0]], total: 1, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText('Notified')).toBeInTheDocument();
  });

  it('shows the Pending badge when neither timestamp is set', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: [sampleCertificates[1]], total: 1, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders empty state when no certificates exist', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: [], total: 0, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    expect(
      screen.getByText(/No Auto-Stop Certificates have been issued yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Certificates are automatically generated when a loan reaches zero balance/,
      ),
    ).toBeInTheDocument();
  });

  it('renders download buttons for each row', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: sampleCertificates, total: 2, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    expect(screen.getAllByRole('button', { name: /Download certificate/ })).toHaveLength(2);
  });

  it('renders resend buttons for SUPER_ADMIN', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: sampleCertificates, total: 2, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    expect(
      screen.getAllByRole('button', { name: /Resend notifications for certificate/ }),
    ).toHaveLength(2);
  });

  it('reads initial filters from URL search params', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: [], total: 0, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage(['/dashboard/certificates?notificationStatus=pending&page=2']);

    expect(mockUseCertificateList).toHaveBeenCalledWith(
      expect.objectContaining({ notificationStatus: 'pending', page: 2 }),
    );
  });

  it('shows skeleton loaders while pending', () => {
    mockUseCertificateList.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });

    const { container } = renderPage();
    // Skeleton elements rendered as div with animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state when query fails', () => {
    mockUseCertificateList.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });

    renderPage();
    expect(screen.getByText(/Unable to load certificates/)).toBeInTheDocument();
  });

  it('toggles sort order when a sortable header is clicked', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: sampleCertificates, total: 2, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    // Initial render uses defaults: sortBy=generatedAt, sortOrder=desc.
    // Clicking the "Generated" header (same column) should flip the order to asc.
    const generatedHeader = screen.getByRole('button', { name: /Generated/ });
    fireEvent.click(generatedHeader);

    const lastCall = mockUseCertificateList.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(
      expect.objectContaining({ sortBy: 'generatedAt', sortOrder: 'asc' }),
    );
  });

  it('toggles sort column when a different sortable header is clicked', () => {
    mockUseCertificateList.mockReturnValue({
      data: { data: sampleCertificates, total: 2, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    const completionHeader = screen.getByRole('button', { name: /Completion Date/ });
    fireEvent.click(completionHeader);

    const lastCall = mockUseCertificateList.mock.calls.at(-1)?.[0];
    expect(lastCall).toEqual(
      expect.objectContaining({ sortBy: 'completionDate', sortOrder: 'desc' }),
    );
  });

  it('paginates Next and Previous', () => {
    // 60 total + page size 25 → 3 pages. Render on page 2 so both controls are enabled.
    mockUseCertificateList.mockReturnValue({
      data: { data: sampleCertificates, total: 60, page: 2, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage(['/dashboard/certificates?page=2']);

    const nextBtn = screen.getByRole('button', { name: /Next/ });
    fireEvent.click(nextBtn);
    expect(mockUseCertificateList.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ page: 3 }),
    );

    const prevBtn = screen.getByRole('button', { name: /Previous/ });
    fireEvent.click(prevBtn);
    expect(mockUseCertificateList.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ page: 2 }),
    );
  });

  it('does not render Resend button for DEPT_ADMIN', () => {
    mockAuthState.user = { role: 'dept_admin' };
    mockUseCertificateList.mockReturnValue({
      data: { data: sampleCertificates, total: 2, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    expect(
      screen.queryAllByRole('button', { name: /Resend notifications for certificate/ }),
    ).toHaveLength(0);
    // Download must still be available
    expect(screen.getAllByRole('button', { name: /Download certificate/ })).toHaveLength(2);
  });

  it('shows MDA filter for DEPT_ADMIN (regression guard for Story 15.0i HIGH finding)', () => {
    mockAuthState.user = { role: 'dept_admin' };
    mockUseCertificateList.mockReturnValue({
      data: { data: [], total: 0, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    // The MDA dropdown trigger should be present for DEPT_ADMIN — they have no
    // server-side scope and need this filter to slice by ministry.
    expect(screen.getByText(/All MDAs/)).toBeInTheDocument();
  });

  it('hides MDA filter for MDA_OFFICER (server-side scoped)', () => {
    mockAuthState.user = { role: 'mda_officer' };
    mockUseCertificateList.mockReturnValue({
      data: { data: [], total: 0, page: 1, pageSize: 25 },
      isPending: false,
      isError: false,
    });

    renderPage();

    expect(screen.queryByText(/All MDAs/)).not.toBeInTheDocument();
  });
});
