import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { WeeklyAgReport } from './WeeklyAgReport';

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

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: { role: 'super_admin', mdaId: null },
      accessToken: 'test-token',
    }),
  ),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue({
    generatedAt: '2026-03-28T10:00:00.000Z',
    periodStart: '2026-03-21',
    periodEnd: '2026-03-28',
    executiveSummary: {
      activeLoans: 150,
      totalExposure: '45000000.00',
      fundAvailable: '5000000.00',
      monthlyRecoveryRate: '3500000.00',
    },
    complianceStatus: {
      submissionsThisWeek: [
        { mdaName: 'Ministry of Education', mdaCode: 'EDU', submissionDate: '2026-03-25T10:00:00.000Z', recordCount: 45, status: 'confirmed' },
      ],
      totalSubmissions: 1,
    },
    exceptionsResolved: [
      { staffName: 'Adamu Bello', type: 'rate_variance', resolutionNote: 'Rate corrected', resolvedAt: '2026-03-24T10:00:00.000Z', mdaName: 'Ministry of Health' },
    ],
    outstandingAttentionItems: [
      { id: 'att-1', type: 'overdue_loans', description: '3 loans past expected completion', mdaName: 'Scheme-wide', category: 'review', priority: 10, count: 3, timestamp: '2026-03-28T00:00:00.000Z' },
    ],
    quickRecoveryOpportunities: [
      { staffName: 'Fatima Musa', staffId: 'OY/1234', mdaName: 'Ministry of Works', outstandingBalance: '25000.00', estimatedRemainingInstallments: 2 },
    ],
    observationActivity: { newCount: 5, reviewedCount: 3, resolvedCount: 2 },
    portfolioSnapshot: [
      { classification: 'Completed', count: 50, percentage: 33.3 },
      { classification: 'On Track', count: 60, percentage: 40.0 },
      { classification: 'Past Expected Completion', count: 20, percentage: 13.3 },
      { classification: 'Balance Unchanged', count: 15, percentage: 10.0 },
      { classification: 'Balance Below Zero', count: 5, percentage: 3.3 },
    ],
  }),
  authenticatedFetch: vi.fn(),
}));

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('WeeklyAgReport', () => {
  it('renders all 7 report sections', async () => {
    renderWithProviders(<WeeklyAgReport />);

    expect(await screen.findByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('Compliance Status')).toBeInTheDocument();
    expect(screen.getByText('Observations Resolved')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Attention Items')).toBeInTheDocument();
    expect(screen.getByText('Quick Recovery Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Observation Activity')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Snapshot')).toBeInTheDocument();
  });

  it('renders date picker for asOfDate', async () => {
    renderWithProviders(<WeeklyAgReport />);

    await screen.findByText('Executive Summary');
    expect(screen.getByLabelText('As of:')).toBeInTheDocument();
  });

  it('renders executive summary metric values', async () => {
    renderWithProviders(<WeeklyAgReport />);

    await screen.findByText('Active Loans');
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('renders compliance submissions table', async () => {
    renderWithProviders(<WeeklyAgReport />);

    expect(await screen.findByText('Ministry of Education')).toBeInTheDocument();
    expect(screen.getByText('EDU')).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders resolved observation', async () => {
    renderWithProviders(<WeeklyAgReport />);

    expect(await screen.findByText('Adamu Bello')).toBeInTheDocument();
    expect(screen.getByText('Rate corrected')).toBeInTheDocument();
  });

  it('renders attention items', async () => {
    renderWithProviders(<WeeklyAgReport />);

    expect(await screen.findByText('3 loans past expected completion')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('renders quick recovery opportunities', async () => {
    renderWithProviders(<WeeklyAgReport />);

    expect(await screen.findByText('Fatima Musa')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Works')).toBeInTheDocument();
    expect(screen.getByText('2 installments')).toBeInTheDocument();
  });

  it('renders observation activity counts', async () => {
    renderWithProviders(<WeeklyAgReport />);

    await screen.findByText('Observation Activity');
    // Activity labels appear — "New", "Reviewed", "Resolved" (may appear multiple times on page)
    expect(screen.getAllByText('5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
    // "Resolved" appears in both observation table header and activity section
    expect(screen.getAllByText('Resolved').length).toBeGreaterThanOrEqual(1);
  });

  it('uses non-punitive labels in portfolio snapshot', async () => {
    renderWithProviders(<WeeklyAgReport />);

    await screen.findByText('Portfolio Snapshot');
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('On Track')).toBeInTheDocument();
    expect(screen.getByText('Past Expected Completion')).toBeInTheDocument();
    expect(screen.getByText('Balance Unchanged')).toBeInTheDocument();
    expect(screen.getByText('Balance Below Zero')).toBeInTheDocument();

    // Verify no forbidden terms
    const html = document.body.innerHTML;
    expect(html).not.toContain('Overdue');
    expect(html).not.toContain('Stalled');
    expect(html).not.toContain('Over-Deducted');
  });
});
