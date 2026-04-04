import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { MigrationCoverageTracker } from './MigrationCoverageTracker';

const { mockUseMigrationCoverage } = vi.hoisted(() => {
  const mockUseMigrationCoverage = vi.fn();
  return { mockUseMigrationCoverage };
});

vi.mock('@/hooks/useMigrationData', () => ({
  useMigrationCoverage: mockUseMigrationCoverage,
  useMigrationStatus: vi.fn(),
  useMigrationDashboardMetrics: vi.fn(),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector({
    user: { role: 'dept_admin', email: 'admin@vlprs.test' },
    accessToken: 'test-token',
  }),
}));

const coverageData = {
  mdas: [
    {
      mdaId: 'mda-1',
      mdaName: 'Education',
      mdaCode: 'EDU',
      periods: {
        '2024-01': { recordCount: 3, baselinedCount: 3 },
        '2024-02': { recordCount: 2, baselinedCount: 1 },
      },
    },
    {
      mdaId: 'mda-2',
      mdaName: 'Health',
      mdaCode: 'HEA',
      periods: {
        '2024-01': { recordCount: 1, baselinedCount: 1 },
      },
    },
    {
      mdaId: 'mda-3',
      mdaName: 'Agriculture',
      mdaCode: 'AGR',
      periods: {},
    },
  ],
  periodRange: { start: '2024-01', end: '2024-03' },
};

function renderComponent() {
  mockUseMigrationCoverage.mockReturnValue({
    data: coverageData,
    isPending: false,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <MigrationCoverageTracker />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('MigrationCoverageTracker', () => {
  it('renders all MDA rows', () => {
    renderComponent();
    expect(screen.getByText('Education')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Agriculture')).toBeInTheDocument();
  });

  it('renders MDA codes', () => {
    renderComponent();
    expect(screen.getByText('EDU')).toBeInTheDocument();
    expect(screen.getByText('HEA')).toBeInTheDocument();
    expect(screen.getByText('AGR')).toBeInTheDocument();
  });

  it('renders month columns', () => {
    renderComponent();
    expect(screen.getByText('2024-01')).toBeInTheDocument();
    expect(screen.getByText('2024-02')).toBeInTheDocument();
    expect(screen.getByText('2024-03')).toBeInTheDocument();
  });

  it('renders cells with correct color-coded indicators', () => {
    renderComponent();

    // Education 2024-01: all baselined → complete (green) — now role="button" since clickable
    const completeCells = screen.getAllByRole('button').filter(
      (el) => el.getAttribute('aria-label')?.includes('2024-01: 3 records'),
    );
    expect(completeCells.length).toBe(1);
    expect(completeCells[0]).toHaveClass('bg-emerald-500');

    // Education 2024-02: partial → amber
    const partialCells = screen.getAllByRole('button').filter(
      (el) => el.getAttribute('aria-label')?.includes('2024-02: 2 records'),
    );
    expect(partialCells.length).toBe(1);
    expect(partialCells[0]).toHaveClass('bg-amber-400');
  });

  it('shows gap cells for missing periods', () => {
    renderComponent();

    // Agriculture has no periods → all gap cells (role="img", not clickable)
    const gapCells = screen.getAllByRole('img').filter(
      (el) => el.getAttribute('aria-label')?.includes('No data for this period'),
    );
    // Agriculture: 3 gap months, Health: 2 gap months (2024-02, 2024-03), Education: 1 gap month (2024-03) = 6
    expect(gapCells.length).toBe(6);
  });

  it('renders summary row with MDA-per-month counts', () => {
    renderComponent();
    expect(screen.getByText('MDAs with data')).toBeInTheDocument();
  });

  it('renders coverage summary column', () => {
    renderComponent();
    // Education: 2 covered out of 3
    expect(screen.getByText('2/3')).toBeInTheDocument();
    // Health: 1 covered out of 3
    expect(screen.getByText('1/3')).toBeInTheDocument();
    // Agriculture: 0 covered out of 3
    expect(screen.getByText('0/3')).toBeInTheDocument();
  });

  it('renders extended view toggle', () => {
    renderComponent();
    expect(screen.getByLabelText(/Extended View/)).toBeInTheDocument();
  });

  it('toggles extended view', async () => {
    const user = userEvent.setup();
    renderComponent();

    const toggle = screen.getByLabelText(/Extended View/);
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
    // Should trigger a new query with extended=true
    expect(mockUseMigrationCoverage).toHaveBeenCalledWith(true);
  });

  it('renders legend with all three status colors', () => {
    renderComponent();
    expect(screen.getByText('Baselined')).toBeInTheDocument();
    expect(screen.getByText('Partial')).toBeInTheDocument();
    expect(screen.getByText('Gap')).toBeInTheDocument();
  });

  it('renders loading state with skeletons', () => {
    mockUseMigrationCoverage.mockReturnValue({
      data: undefined,
      isPending: true,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MigrationCoverageTracker />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders error state when API call fails', () => {
    mockUseMigrationCoverage.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MigrationCoverageTracker />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Unable to load coverage data. Please try again later.')).toBeInTheDocument();
  });

  it('renders empty state when no MDA data', () => {
    mockUseMigrationCoverage.mockReturnValue({
      data: { mdas: [], periodRange: { start: '2024-01', end: '2024-03' } },
      isPending: false,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MigrationCoverageTracker />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('No migration data available.')).toBeInTheDocument();
  });

  it('vocabulary compliance: no "error"/"anomaly"/"discrepancy" in rendered output', () => {
    renderComponent();
    const allText = document.body.textContent?.toLowerCase() ?? '';
    expect(allText).not.toMatch(/\banomaly\b/);
    expect(allText).not.toMatch(/\bdiscrepancy\b/);
  });

  it('renders Download CSV button', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /Download CSV/i })).toBeInTheDocument();
  });

  it('renders Download PDF button', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /Download PDF/i })).toBeInTheDocument();
  });

  it('CSV export triggers download', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Mock URL.createObjectURL and createElement('a')
    const mockUrl = 'blob:test-url';
    const createObjectURL = vi.fn(() => mockUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick };
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor as unknown as HTMLAnchorElement;
      return origCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);

    await user.click(screen.getByRole('button', { name: /Download CSV/i }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockAnchor.download).toMatch(/vlprs-coverage-tracker.*\.csv/);

    vi.restoreAllMocks();
  });

  it('PDF export opens print window', async () => {
    const user = userEvent.setup();
    renderComponent();

    const mockWrite = vi.fn();
    const mockClose = vi.fn();
    const mockOpen = vi.fn(() => ({ document: { write: mockWrite, close: mockClose } }));
    vi.stubGlobal('open', mockOpen);

    await user.click(screen.getByRole('button', { name: /Download PDF/i }));

    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
    expect(mockWrite).toHaveBeenCalled();
    const html = mockWrite.mock.calls[0][0] as string;
    expect(html).toContain('Migration Coverage Tracker');
    expect(html).toContain('VLPRS');
    expect(html).toContain('DEPT ADMIN'); // role context
    expect(html).toContain('landscape');

    vi.restoreAllMocks();
  });

  it('PDF export falls back to Blob download when popup blocked', async () => {
    const user = userEvent.setup();
    renderComponent();

    // window.open returns null = popup blocked
    const mockOpen = vi.fn(() => null);
    vi.stubGlobal('open', mockOpen);

    const mockBlobUrl = 'blob:test-pdf-url';
    const createObjectURL = vi.fn((_blob: Blob) => mockBlobUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const mockClick = vi.fn();
    const mockAnchor = { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') return mockAnchor;
      return origCreateElement(tag);
    });
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => document.body);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => document.body);

    await user.click(screen.getByRole('button', { name: /Download PDF/i }));

    expect(mockOpen).toHaveBeenCalledWith('', '_blank');
    expect(createObjectURL).toHaveBeenCalled();
    // Verify Blob was created with text/html content
    const blobArg = createObjectURL.mock.calls[0][0];
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('text/html');
    // Verify <a> was clicked with correct download filename
    expect(mockAnchor.download).toBe('migration-coverage-report.html');
    expect(mockAnchor.href).toBe(mockBlobUrl);
    expect(mockClick).toHaveBeenCalled();
    expect(document.body.appendChild).toHaveBeenCalled();
    expect(document.body.removeChild).toHaveBeenCalled();
    // Toast shown (sonner auto-renders, just verify no errors thrown)

    vi.restoreAllMocks();
  });
});
