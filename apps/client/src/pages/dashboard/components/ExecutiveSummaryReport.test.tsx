import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExecutiveSummaryReport } from './ExecutiveSummaryReport';
import type { ExecutiveSummaryReportData } from '@vlprs/shared';

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ReportActions hits hooks unrelated to this story; stub it out.
vi.mock('./ReportActions', () => ({
  ReportActions: () => <div data-testid="report-actions" />,
}));

const mockReportData: ExecutiveSummaryReportData = {
  schemeOverview: {
    activeLoans: 100,
    totalExposure: '500000000',
    fundAvailable: null,
    monthlyRecoveryRate: '5000000',
    recoveryPeriod: '8 years',
  },
  portfolioStatus: [
    { classification: 'On Track', count: 80, percentage: 80 },
    { classification: 'Overdue', count: 20, percentage: 20 },
  ],
  mdaScorecard: {
    topHealthy: [
      {
        mdaId: 'mda-001',
        mdaName: 'Ministry of Finance',
        mdaCode: 'MOF',
        healthScore: 95,
        healthBand: 'healthy',
        totalOutstanding: '12000000',
        observationCount: 0,
      },
      {
        mdaId: 'mda-002',
        mdaName: 'Ministry of Education',
        mdaCode: 'MOE',
        healthScore: 90,
        healthBand: 'healthy',
        totalOutstanding: '8000000',
        observationCount: 1,
      },
    ],
    bottomForReview: [
      {
        mdaId: 'mda-099',
        mdaName: 'Ministry of Works',
        mdaCode: 'MOW',
        healthScore: 35,
        healthBand: 'for-review',
        totalOutstanding: '50000000',
        observationCount: 12,
      },
    ],
  },
  receivablesRanking: [],
  recoveryPotential: [
    {
      tierKey: 'QUICK',
      tierName: 'Quick Recovery',
      loanCount: 25,
      totalAmount: '15000000',
      monthlyProjection: '1000000',
    },
    {
      tierKey: 'INTERVENTION',
      tierName: 'Requires Intervention',
      loanCount: 12,
      totalAmount: '40000000',
      monthlyProjection: '500000',
    },
    {
      tierKey: 'EXTENDED',
      tierName: 'Extended Follow-up',
      loanCount: 8,
      totalAmount: '20000000',
      monthlyProjection: '200000',
    },
  ],
  submissionCoverage: { activeMdas: 50, spottyMdas: 8, darkMdas: 5, totalMdas: 63 },
  onboardingPipeline: { approvedNotCollectingCount: 2, revenueAtRisk: '300000' },
  exceptionSummary: { openCount: 3, resolvedCount: 7, totalCount: 10 },
  topVariances: [],
  monthOverMonthTrend: {
    activeLoans: { current: 100, previous: 95, changePercent: 5.3 },
    totalExposure: { current: 500, previous: 480, changePercent: 4.2 },
    monthlyRecovery: { current: 5, previous: 5, changePercent: 0 },
    completionRate: { current: 80, previous: null, changePercent: null },
  },
  generatedAt: '2026-04-07T10:00:00Z',
};

vi.mock('@/hooks/useReportData', () => ({
  useExecutiveSummaryReport: () => ({
    data: mockReportData,
    isLoading: false,
    error: null,
  }),
}));

function renderReport() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ExecutiveSummaryReport />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ExecutiveSummaryReport — clickable cards & rows (Story 15.0h)', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('Recovery Potential cards', () => {
    it('navigates to /dashboard/loans?filter=quick-win when Quick Recovery card clicked', async () => {
      renderReport();
      const card = screen.getByRole('button', { name: /Quick Recovery/i });
      await userEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=quick-win');
    });

    it('navigates to /dashboard/loans?filter=overdue when Requires Intervention card clicked', async () => {
      renderReport();
      const card = screen.getByRole('button', { name: /Requires Intervention/i });
      await userEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=overdue');
    });

    it('navigates to /dashboard/loans?filter=stalled when Extended Follow-up card clicked', async () => {
      renderReport();
      const card = screen.getByRole('button', { name: /Extended Follow-up/i });
      await userEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=stalled');
    });

    it('navigates on Enter key (keyboard accessibility)', async () => {
      renderReport();
      const card = screen.getByRole('button', { name: /Quick Recovery/i });
      card.focus();
      await userEvent.keyboard('{Enter}');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=quick-win');
    });

    it('navigates on Space key (keyboard accessibility)', async () => {
      renderReport();
      const card = screen.getByRole('button', { name: /Requires Intervention/i });
      card.focus();
      await userEvent.keyboard(' ');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=overdue');
    });

    it('renders cards with cursor-pointer class for hover affordance', () => {
      renderReport();
      const card = screen.getByTestId('recovery-tier-card-QUICK');
      expect(card.className).toContain('cursor-pointer');
    });

    it('renders cards with tabIndex=0 so they are keyboard-focusable', () => {
      renderReport();
      const cards = [
        screen.getByTestId('recovery-tier-card-QUICK'),
        screen.getByTestId('recovery-tier-card-INTERVENTION'),
        screen.getByTestId('recovery-tier-card-EXTENDED'),
      ];
      cards.forEach((card) => expect(card).toHaveAttribute('tabIndex', '0'));
    });
  });

  describe('MDA Scorecard rows', () => {
    it('navigates to /dashboard/mda/:mdaId when a Top Healthy row is clicked', async () => {
      renderReport();
      // role="link" applied to the <tr>
      const rows = screen.getAllByRole('link');
      const mofRow = rows.find((row) => row.textContent?.includes('Ministry of Finance'));
      expect(mofRow).toBeDefined();
      await userEvent.click(mofRow!);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/mda/mda-001');
    });

    it('navigates to /dashboard/mda/:mdaId when a Bottom For Review row is clicked', async () => {
      renderReport();
      const rows = screen.getAllByRole('link');
      const mowRow = rows.find((row) => row.textContent?.includes('Ministry of Works'));
      expect(mowRow).toBeDefined();
      await userEvent.click(mowRow!);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/mda/mda-099');
    });

    it('navigates on Enter key from a focused scorecard row', async () => {
      renderReport();
      const rows = screen.getAllByRole('link');
      const moeRow = rows.find((row) => row.textContent?.includes('Ministry of Education'));
      expect(moeRow).toBeDefined();
      moeRow!.focus();
      await userEvent.keyboard('{Enter}');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/mda/mda-002');
    });

    it('renders scorecard rows with cursor-pointer class', () => {
      renderReport();
      const rows = screen.getAllByRole('link');
      const scorecardRows = rows.filter((row) =>
        /Ministry of (Finance|Education|Works)/.test(row.textContent ?? ''),
      );
      expect(scorecardRows.length).toBeGreaterThanOrEqual(3);
      scorecardRows.forEach((row) => expect(row.className).toContain('cursor-pointer'));
    });
  });
});
