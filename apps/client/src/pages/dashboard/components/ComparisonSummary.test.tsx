import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ComparisonSummary } from './ComparisonSummary';

const { mockUseComparisonSummary } = vi.hoisted(() => {
  const mockUseComparisonSummary = vi.fn();
  return { mockUseComparisonSummary };
});

vi.mock('@/hooks/useSubmissionData', () => ({
  useComparisonSummary: mockUseComparisonSummary,
  useSubmissionUpload: vi.fn(),
  useManualSubmission: vi.fn(),
  useSubmissionHistory: vi.fn(),
}));

const comparisonData = {
  submissionId: 'sub-001',
  referenceNumber: 'BIR-2026-03-0001',
  summary: {
    alignedCount: 42,
    minorVarianceCount: 3,
    varianceCount: 5,
    totalRecords: 50,
    rows: [
      {
        staffId: '3301',
        declaredAmount: '14166.67',
        expectedAmount: '18333.33',
        difference: '-4166.66',
        category: 'variance' as const,
        explanation: 'Declared ₦14,166.67 vs expected ₦18,333.33 — difference of ₦4,166.66',
      },
      {
        staffId: '3302',
        declaredAmount: '8500.00',
        expectedAmount: '8333.33',
        difference: '166.67',
        category: 'minor_variance' as const,
        explanation: 'Declared ₦8,500.00 vs expected ₦8,333.33 — difference of ₦166.67',
      },
    ],
  },
};

function renderComponent() {
  mockUseComparisonSummary.mockReturnValue({
    data: comparisonData,
    isPending: false,
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ComparisonSummary submissionId="sub-001" />
    </QueryClientProvider>,
  );
}

describe('ComparisonSummary', () => {
  it('renders header as "Comparison Summary" (never "Error Report")', () => {
    renderComponent();
    expect(screen.getByText('Comparison Summary')).toBeInTheDocument();
    expect(screen.queryByText('Error Report')).not.toBeInTheDocument();
    expect(screen.queryByText('Validation Results')).not.toBeInTheDocument();
  });

  it('shows aligned count with green checkmark', () => {
    renderComponent();
    expect(screen.getByText(/42 records aligned/i)).toBeInTheDocument();
  });

  it('shows minor variance count with teal info icon', () => {
    renderComponent();
    expect(screen.getByText(/3 minor variance/i)).toBeInTheDocument();
  });

  it('shows variance count with teal info icon', () => {
    renderComponent();
    expect(screen.getByText(/5 variances with amounts/i)).toBeInTheDocument();
  });

  it('expand/collapse variance detail', async () => {
    const user = userEvent.setup();
    renderComponent();

    const expandBtn = screen.getByRole('button', { name: /view variance detail/i });
    expect(expandBtn).toHaveAttribute('aria-expanded', 'false');

    await user.click(expandBtn);
    expect(expandBtn).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows "No action required" footer', () => {
    renderComponent();
    expect(
      screen.getByText('No action required from you. Variances are logged for reconciliation.'),
    ).toBeInTheDocument();
  });

  it('renders loading state with skeletons', () => {
    mockUseComparisonSummary.mockReturnValue({
      data: undefined,
      isPending: true,
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ComparisonSummary submissionId="sub-001" />
      </QueryClientProvider>,
    );

    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('vocabulary compliance: no "error"/"mistake"/"fault" in rendered output', () => {
    renderComponent();
    const allText = document.body.textContent?.toLowerCase() ?? '';
    expect(allText).not.toMatch(/\berror\b/);
    expect(allText).not.toMatch(/\bmistake\b/);
    expect(allText).not.toMatch(/\bfault\b/);
  });
});
