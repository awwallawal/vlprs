import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { OperationsHubPage } from './OperationsHubPage';

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
});
