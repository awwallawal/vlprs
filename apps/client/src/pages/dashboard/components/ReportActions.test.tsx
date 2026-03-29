import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ReportActions } from './ReportActions';

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
  useAuthStore: Object.assign(
    vi.fn((selector) =>
      selector({ user: { role: 'super_admin', mdaId: null }, accessToken: 'test-token' }),
    ),
    {
      getState: () => ({ accessToken: 'test-token', user: { role: 'super_admin', mdaId: null } }),
    },
  ),
}));

const mockAuthenticatedFetch = vi.fn();

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn(),
  authenticatedFetch: (...args: unknown[]) => mockAuthenticatedFetch(...args),
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

describe('ReportActions', () => {
  it('renders Download PDF and Share buttons', () => {
    renderWithProviders(
      <ReportActions reportType="executive-summary" queryParams={{}} reportTitle="Executive Summary Report" />,
    );

    expect(screen.getByText('Download PDF')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('shows loading state when downloading', async () => {
    // Mock fetch that never resolves to show loading state
    mockAuthenticatedFetch.mockReturnValue(new Promise(() => {}));

    renderWithProviders(
      <ReportActions reportType="executive-summary" queryParams={{}} reportTitle="Executive Summary Report" />,
    );

    const downloadBtn = screen.getByText('Download PDF');
    await userEvent.click(downloadBtn);

    await waitFor(() => {
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });
  });

  it('opens share dialog when Share is clicked', async () => {
    renderWithProviders(
      <ReportActions reportType="executive-summary" queryParams={{}} reportTitle="Executive Summary Report" />,
    );

    const shareBtn = screen.getByText('Share');
    await userEvent.click(shareBtn);

    expect(await screen.findByText('Share Report')).toBeInTheDocument();
    expect(screen.getByText('Recipient Email')).toBeInTheDocument();
    expect(screen.getByText('Cover Message (optional)')).toBeInTheDocument();
  });

  it('validates email in share dialog', async () => {
    renderWithProviders(
      <ReportActions reportType="executive-summary" queryParams={{}} reportTitle="Executive Summary Report" />,
    );

    await userEvent.click(screen.getByText('Share'));
    await screen.findByText('Share Report');

    // Send button should be disabled without valid email
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();

    // Enter valid email
    const emailInput = screen.getByPlaceholderText('recipient@example.com');
    await userEvent.type(emailInput, 'test@example.com');

    // Send button should be enabled with valid email
    expect(sendBtn).toBeEnabled();
  });

  it('renders in all 5 report types without error', () => {
    const reportTypes = [
      { type: 'executive-summary' as const, title: 'Executive Summary Report' },
      { type: 'mda-compliance' as const, title: 'MDA Compliance Report' },
      { type: 'variance' as const, title: 'Variance Report' },
      { type: 'loan-snapshot' as const, title: 'Loan Snapshot Report' },
      { type: 'weekly-ag' as const, title: 'Weekly AG Report' },
    ];

    for (const { type, title } of reportTypes) {
      const { unmount } = renderWithProviders(
        <ReportActions reportType={type} queryParams={{}} reportTitle={title} />,
      );
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
      unmount();
    }
  });
});
