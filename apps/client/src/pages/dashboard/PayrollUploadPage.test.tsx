import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PayrollUploadPage } from './PayrollUploadPage';
import type { PayrollDelineationSummary, PayrollUploadResponse } from '@vlprs/shared';

// ─── Configurable mock state ──────────────────────────────────────────

let mockPreviewMutation = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  data: null as PayrollDelineationSummary | null,
  error: null as (Error & { code?: string; details?: unknown[] }) | null,
};

let mockConfirmMutation = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  data: null as PayrollUploadResponse | null,
  error: null as (Error & { code?: string }) | null,
};

vi.mock('@/hooks/usePayrollUpload', () => ({
  usePayrollPreview: () => mockPreviewMutation,
  usePayrollConfirm: () => mockConfirmMutation,
}));

// ─── Helpers ──────────────────────────────────────────────────────────

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/payroll-upload']}>
        <PayrollUploadPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const MOCK_SUMMARY: PayrollDelineationSummary = {
  period: '2026-03',
  totalRecords: 15,
  mdaBreakdown: [
    { mdaCode: 'MOF', mdaName: 'Ministry of Finance', recordCount: 10, totalDeduction: '150000.00' },
    { mdaCode: 'MOH', mdaName: 'Ministry of Health', recordCount: 5, totalDeduction: '75000.00' },
  ],
  unmatchedCodes: [],
};

const MOCK_SUMMARY_WITH_UNMATCHED: PayrollDelineationSummary = {
  ...MOCK_SUMMARY,
  mdaBreakdown: [
    ...MOCK_SUMMARY.mdaBreakdown,
    { mdaCode: 'XXX', mdaName: 'Unmatched: XXX', recordCount: 2, totalDeduction: '30000.00' },
  ],
  unmatchedCodes: ['XXX'],
};

const MOCK_CONFIRMATION: PayrollUploadResponse = {
  referenceNumbers: ['PAY-2026-03-0001', 'PAY-2026-03-0002'],
  totalRecords: 15,
  mdaCount: 2,
  period: '2026-03',
};

// ─── Tests ────────────────────────────────────────────────────────────

describe('PayrollUploadPage', () => {
  beforeEach(() => {
    mockPreviewMutation = {
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      data: null,
      error: null,
    };
    mockConfirmMutation = {
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isSuccess: false,
      isError: false,
      data: null,
      error: null,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders upload zone with CSV + XLSX acceptance', () => {
    renderPage();

    expect(
      screen.getByText('Upload Monthly Payroll Deduction Extract'),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/upload the consolidated monthly payroll deduction extract/i),
    ).toBeInTheDocument();
  });

  it('renders page heading and info text', () => {
    renderPage();

    // Verify the upload page renders with correct heading
    expect(screen.getByText('Upload Monthly Payroll Deduction Extract')).toBeInTheDocument();
    expect(screen.getByText(/\.csv or \.xlsx/i)).toBeInTheDocument();
  });

  it('shows delineation table when preview is successful', async () => {
    // Pre-set the component to preview state by having mutate call onSuccess immediately
    mockPreviewMutation.mutate = vi.fn((_file: File, opts?: { onSuccess?: (data: PayrollDelineationSummary) => void }) => {
      opts?.onSuccess?.(MOCK_SUMMARY);
    });

    renderPage();

    // Simulate file selection via the hidden input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const file = new File(['test'], 'payroll.csv', { type: 'text/csv' });
      await userEvent.upload(fileInput as HTMLElement, file);
    }

    // After successful preview, delineation table should show
    const table = screen.getByTestId('delineation-table');
    expect(within(table).getByText('Ministry of Finance')).toBeInTheDocument();
    expect(within(table).getByText('Ministry of Health')).toBeInTheDocument();
    expect(within(table).getByText('10')).toBeInTheDocument();
    expect(within(table).getByText('5')).toBeInTheDocument();
  });

  it('disables confirm button when unmatched MDA codes exist', async () => {
    mockPreviewMutation.mutate = vi.fn((_file: File, opts?: { onSuccess?: (data: PayrollDelineationSummary) => void }) => {
      opts?.onSuccess?.(MOCK_SUMMARY_WITH_UNMATCHED);
    });

    renderPage();

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const file = new File(['test'], 'payroll.csv', { type: 'text/csv' });
      await userEvent.upload(fileInput as HTMLElement, file);
    }

    // Confirm button should be disabled when unmatched codes exist
    const confirmBtn = screen.getByRole('button', { name: /confirm upload/i });
    expect(confirmBtn).toBeDisabled();

    // Unmatched warning should be displayed
    expect(screen.getByText(/unrecognized MDA codes/i)).toBeInTheDocument();
  });

  it('shows reference numbers after successful confirmation', async () => {
    // Set up preview state first
    mockPreviewMutation.mutate = vi.fn((_file: File, opts?: { onSuccess?: (data: PayrollDelineationSummary) => void }) => {
      opts?.onSuccess?.(MOCK_SUMMARY);
    });

    mockConfirmMutation.mutate = vi.fn((_body: { period: string }, opts?: { onSuccess?: (data: PayrollUploadResponse) => void }) => {
      opts?.onSuccess?.(MOCK_CONFIRMATION);
    });

    renderPage();

    // Trigger file upload to get to preview state
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const file = new File(['test'], 'payroll.csv', { type: 'text/csv' });
      await userEvent.upload(fileInput as HTMLElement, file);
    }

    // Click confirm
    const confirmBtn = screen.getByRole('button', { name: /confirm upload/i });
    await userEvent.click(confirmBtn);

    // Confirmation result should show reference numbers
    expect(screen.getByText('PAY-2026-03-0001')).toBeInTheDocument();
    expect(screen.getByText('PAY-2026-03-0002')).toBeInTheDocument();
  });
});
