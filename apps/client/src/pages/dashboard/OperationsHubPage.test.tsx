import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OperationsHubPage } from './OperationsHubPage';

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockMigration = [
  {
    mdaId: 'mda-001',
    mdaName: 'Ministry of Finance',
    mdaCode: 'MOF',
    stage: 'validated' as const,
    recordCounts: { total: 142, validated: 142, errors: 0 },
    lastActivity: '2026-02-15T09:30:00Z',
  },
];

const mockExceptions = [
  {
    id: 'exc-001',
    priority: 'high' as const,
    category: 'Zero Deduction',
    staffId: 'OY/001',
    staffName: 'John Doe',
    mdaName: 'Ministry of Finance',
    description: 'No deduction found',
    createdAt: '2026-02-18T10:00:00Z',
    status: 'open' as const,
  },
];

vi.mock('@/hooks/useMigrationData', () => ({
  useMigrationStatus: () => ({ data: mockMigration, isPending: false }),
}));

vi.mock('@/hooks/useLoanData', () => ({
  useLoanSearch: () => ({ data: [], isPending: false }),
  useLoanDetail: () => ({ data: null, isPending: false }),
}));

vi.mock('@/hooks/useExceptionData', () => ({
  useExceptionQueue: () => ({ data: mockExceptions, isPending: false }),
  useExceptionCounts: () => ({ data: { high: 1, medium: 0, low: 0, total: 1 } }),
}));

function renderPage(initialEntries = ['/dashboard/operations']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <OperationsHubPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OperationsHubPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders page heading "Operations Hub"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Operations Hub' }),
    ).toBeInTheDocument();
  });

  it('renders migration status section', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Migration Status' }),
    ).toBeInTheDocument();
    const matches = screen.getAllByText('Ministry of Finance');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders MDA filter input', () => {
    renderPage();
    expect(
      screen.getByPlaceholderText('Filter by MDA name...'),
    ).toBeInTheDocument();
  });

  it('renders loan search section', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Loan Search' }),
    ).toBeInTheDocument();
  });

  it('renders exception queue section', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Exception Queue' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No deduction found')).toBeInTheDocument();
  });

  it('renders quick action buttons', () => {
    renderPage();
    expect(
      screen.getByRole('button', { name: /Generate Report/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /File Employment Event/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Compute Early Exit/ }),
    ).toBeInTheDocument();
  });

  describe('Migration card navigation (Story 15.0h, UAT #31)', () => {
    /**
     * Mock data uses "Ministry of Finance" for both the migration card and the
     * exception row, and both render role="button". Scope queries to the
     * migration section (region with accessible name "Migration Status") so the
     * exception row is not in scope.
     */
    function getMigrationCard(): HTMLElement {
      const migrationSection = screen.getByRole('region', { name: /Migration Status/i });
      return within(migrationSection).getByRole('button', { name: /Ministry of Finance/i });
    }

    it('navigates to /dashboard/mda/:mdaId when a migration card is clicked', async () => {
      renderPage();
      const card = getMigrationCard();
      await userEvent.click(card);
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/mda/mda-001');
    });

    it('navigates on Enter key from a focused migration card', async () => {
      renderPage();
      const card = getMigrationCard();
      card.focus();
      await userEvent.keyboard('{Enter}');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/mda/mda-001');
    });

    it('migration card has cursor-pointer class for hover affordance', () => {
      renderPage();
      const card = getMigrationCard();
      expect(card.className).toContain('cursor-pointer');
    });
  });
});
