import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ReportsPage } from './ReportsPage';

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

// Mock auth store
vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      user: { role: 'super_admin', mdaId: null },
      accessToken: 'test-token',
    }),
  ),
}));

// Mock apiClient to return empty data
vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue({}),
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

describe('ReportsPage', () => {
  it('renders report page title', () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText('Reports')).toBeInTheDocument();
  });

  it('renders Executive Summary tab', () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
  });

  it('renders MDA Compliance tab', () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText('MDA Compliance')).toBeInTheDocument();
  });

  it('renders Variance tab', () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText('Variance')).toBeInTheDocument();
  });

  it('renders Loan Snapshot tab', () => {
    renderWithProviders(<ReportsPage />);
    expect(screen.getByText('Loan Snapshot')).toBeInTheDocument();
  });

  it('does not render any forbidden non-punitive terms', () => {
    renderWithProviders(<ReportsPage />);
    const html = document.body.innerHTML;
    expect(html).not.toContain('Anomaly');
    expect(html).not.toContain('Discrepancy');
    // "Error" may appear in error boundary text — only check for specific forbidden terms
  });
});
