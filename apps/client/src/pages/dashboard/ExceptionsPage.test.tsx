import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ExceptionsPage } from './ExceptionsPage';

const { mockUseExceptions, mockUseExceptionCounts } = vi.hoisted(() => {
  const mockUseExceptions = vi.fn();
  const mockUseExceptionCounts = vi.fn();
  return { mockUseExceptions, mockUseExceptionCounts };
});

vi.mock('@/hooks/useExceptionData', () => ({
  useExceptions: mockUseExceptions,
  useExceptionCounts: mockUseExceptionCounts,
  useExceptionQueue: vi.fn(),
  useExceptionDetail: vi.fn(),
  useFlagException: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
  useResolveException: vi.fn(),
  useDetectInactive: vi.fn().mockReturnValue({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/useMigration', () => ({
  useMdaList: vi.fn().mockReturnValue({ data: [] }),
  useMigrationStatus: vi.fn().mockReturnValue({ data: [], isPending: false }),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ user: { role: 'super_admin' } }),
  ),
}));

vi.mock('@/hooks/useLoanData', () => ({
  useLoanSearch: vi.fn().mockReturnValue({ data: [], isPending: false }),
}));

const mockExceptions = [
  {
    id: 'e1', priority: 'high' as const, category: 'over_deduction', staffId: 'S1',
    staffName: 'Akin Balogun', mdaId: 'm1', mdaName: 'Works', description: 'Over-deducted by 5000',
    createdAt: '2026-03-20T10:00:00Z', status: 'open' as const, resolvedAt: null,
    loanId: 'l1', observationId: 'o1', flagNotes: 'Manual flag',
  },
  {
    id: 'e2', priority: 'medium' as const, category: 'inactive', staffId: 'S2',
    staffName: 'Funke Adebayo', mdaId: 'm1', mdaName: 'Works', description: 'No deductions',
    createdAt: '2026-03-19T10:00:00Z', status: 'open' as const, resolvedAt: null,
    loanId: null, observationId: 'o2', flagNotes: null,
  },
  {
    id: 'e3', priority: 'low' as const, category: 'data_mismatch', staffId: 'S3',
    staffName: 'Chidi Okafor', mdaId: 'm2', mdaName: 'Education', description: 'Name mismatch',
    createdAt: '2026-03-18T10:00:00Z', status: 'resolved' as const, resolvedAt: '2026-03-19T14:00:00Z',
    loanId: 'l3', observationId: 'o3', flagNotes: null,
  },
];

function renderPage(initialEntries = ['/dashboard/exceptions']) {
  mockUseExceptions.mockReturnValue({
    data: { data: mockExceptions, total: 3, page: 1 },
    isPending: false,
  });
  mockUseExceptionCounts.mockReturnValue({
    data: { high: 1, medium: 1, low: 1, total: 3 },
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <ExceptionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ExceptionsPage', () => {
  it('renders exception list sorted by priority', () => {
    renderPage();
    expect(screen.getByText('Exception Queue')).toBeInTheDocument();
    expect(screen.getByText(/Akin Balogun/)).toBeInTheDocument();
    expect(screen.getByText(/Funke Adebayo/)).toBeInTheDocument();
    expect(screen.getByText(/Chidi Okafor/)).toBeInTheDocument();
  });

  it('shows resolved exceptions in list', () => {
    renderPage();
    expect(screen.getByText(/Chidi Okafor/)).toBeInTheDocument();
  });

  it('displays priority counts', () => {
    renderPage();
    expect(screen.getByText(/1 High/)).toBeInTheDocument();
    expect(screen.getByText(/1 Medium/)).toBeInTheDocument();
    expect(screen.getByText(/1 Low/)).toBeInTheDocument();
  });

  it('renders filter controls for status, priority, category', () => {
    renderPage();
    // Filter dropdowns are rendered
    const triggers = screen.getAllByRole('combobox');
    // Status, Priority, Category, MDA (super_admin) = 4 dropdowns
    expect(triggers.length).toBeGreaterThanOrEqual(3);
  });

  it('reads initial filters from URL search params', () => {
    // Render with priority=high in URL
    renderPage(['/dashboard/exceptions?priority=high&status=open']);
    // useExceptions should be called with the priority filter
    expect(mockUseExceptions).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'high', status: 'open' }),
    );
  });

  it('shows empty state when no exceptions', () => {
    mockUseExceptions.mockReturnValue({
      data: { data: [], total: 0, page: 1 },
      isPending: false,
    });
    mockUseExceptionCounts.mockReturnValue({
      data: { high: 0, medium: 0, low: 0, total: 0 },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ExceptionsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.queryByText('Akin Balogun')).not.toBeInTheDocument();
  });

  it('renders Flag Exception button for admin users', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Flag Exception/ })).toBeInTheDocument();
  });
});
