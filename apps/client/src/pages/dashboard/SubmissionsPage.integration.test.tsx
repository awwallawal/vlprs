import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn() } }));

// Capture CSV upload onSuccess callback
let csvOnSuccess: ((data: Record<string, unknown>) => void) | null = null;
let csvOnError: ((error: Error & { details?: unknown[] }) => void) | null = null;
const mockMutate = vi.fn((_file: unknown, options?: { onSuccess?: (data: Record<string, unknown>) => void; onError?: (error: Error & { details?: unknown[] }) => void }) => {
  csvOnSuccess = options?.onSuccess ?? null;
  csvOnError = options?.onError ?? null;
});
const mockReset = vi.fn();

vi.mock('@/hooks/useSubmissionData', () => ({
  useSubmissionHistory: vi.fn(() => ({
    data: { items: [], total: 0, page: 1, pageSize: 20 },
    isPending: false,
  })),
  useSubmissionUpload: vi.fn(() => ({
    mutate: mockMutate,
    mutateAsync: vi.fn(),
    reset: mockReset,
    isPending: false,
    isSuccess: false,
    isError: false,
    error: null,
    data: null,
  })),
  useComparisonSummary: vi.fn(() => ({
    data: null,
    isPending: false,
  })),
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: vi.fn((selector: (state: Record<string, unknown>) => unknown) =>
    selector({ user: { id: '1', name: 'Test', role: 'mda_officer', mdaId: 'mda-1' } }),
  ),
}));

vi.mock('./components/ManualEntryForm', () => ({
  ManualEntryForm: ({ onSuccess }: { onSuccess?: (data: Record<string, unknown>) => void; disabled?: boolean }) => (
    <button
      data-testid="mock-manual-submit"
      onClick={() =>
        onSuccess?.({
          id: 'sub-002',
          referenceNumber: 'BIR-2026-03-0002',
          recordCount: 5,
          submissionDate: '2026-03-14T12:00:00.000Z',
          status: 'confirmed',
          alignedCount: 4,
          varianceCount: 1,
        })
      }
    >
      Mock Submit Manual
    </button>
  ),
}));

vi.mock('@/components/shared/FileUploadZone', () => ({
  FileUploadZone: ({ onFileSelect }: { onFileSelect: (file: File) => void }) => (
    <button
      data-testid="mock-csv-upload"
      onClick={() => onFileSelect(new File(['test'], 'test.csv', { type: 'text/csv' }))}
    >
      Mock Upload CSV
    </button>
  ),
}));

vi.mock('@/components/shared/WelcomeGreeting', () => ({
  WelcomeGreeting: () => <div data-testid="welcome-greeting" />,
}));

vi.mock('@/hooks/usePreSubmissionCheckpoint', () => ({
  usePreSubmissionCheckpoint: () => ({
    data: {
      approachingRetirement: [],
      zeroDeduction: [],
      pendingEvents: [],
      lastSubmissionDate: null,
      submissionPeriod: '2026-03',
    },
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue([{ id: 'mda-1', name: 'Ministry of Health', code: 'HLT' }]),
}));

import { SubmissionsPage } from './SubmissionsPage';

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const mockCsvResponse = {
  id: 'sub-001',
  referenceNumber: 'BIR-2026-03-0001',
  recordCount: 10,
  submissionDate: '2026-03-14T10:00:00.000Z',
  status: 'confirmed' as const,
  alignedCount: 8,
  varianceCount: 2,
};

describe('SubmissionsPage Integration (Story 5.3)', () => {
  let originalClipboard: Clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    csvOnSuccess = null;
    csvOnError = null;
    originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    Object.assign(navigator, { clipboard: originalClipboard });
  });

  it('renders confirmation with source="csv" after CSV upload success', () => {
    renderWithProviders(<SubmissionsPage />);

    // Enable upload by checking checkpoint
    fireEvent.click(screen.getByRole('checkbox'));

    // Trigger CSV upload
    fireEvent.click(screen.getByTestId('mock-csv-upload'));
    expect(mockMutate).toHaveBeenCalled();

    // Simulate mutation success
    act(() => {
      csvOnSuccess?.(mockCsvResponse);
    });

    // Confirmation should be visible with CSV source
    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
    expect(screen.getByText('BIR-2026-03-0001')).toBeInTheDocument();
    expect(screen.getByText('Submitted via CSV upload')).toBeInTheDocument();
  });

  it('renders confirmation with source="manual" after manual entry success', () => {
    renderWithProviders(<SubmissionsPage />);

    // Enable forms
    fireEvent.click(screen.getByRole('checkbox'));

    // Switch to manual tab
    fireEvent.click(screen.getByRole('tab', { name: /manual entry/i }));

    // Trigger manual submission via mock
    fireEvent.click(screen.getByTestId('mock-manual-submit'));

    // Confirmation should show manual source
    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
    expect(screen.getByText('BIR-2026-03-0002')).toBeInTheDocument();
    expect(screen.getByText('Submitted via manual entry')).toBeInTheDocument();
  });

  it('"Submit Another" resets to upload view with unchecked checkpoint', () => {
    renderWithProviders(<SubmissionsPage />);

    // Enter confirmation view via CSV upload
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('mock-csv-upload'));
    act(() => {
      csvOnSuccess?.(mockCsvResponse);
    });

    // Verify in confirmation view — checkpoint should be hidden
    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();

    // Click Submit Another
    fireEvent.click(screen.getByRole('button', { name: /submit another/i }));

    // Back to upload view
    expect(screen.queryByText('Upload Complete')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(mockReset).toHaveBeenCalled();
  });

  it('submission history remains visible in confirmation view', () => {
    renderWithProviders(<SubmissionsPage />);

    // History visible in upload view
    expect(screen.getByText('Submission History')).toBeInTheDocument();

    // Enter confirmation view
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByTestId('mock-csv-upload'));
    act(() => {
      csvOnSuccess?.(mockCsvResponse);
    });

    // History still visible in confirmation view
    expect(screen.getByText('Submission History')).toBeInTheDocument();
  });

  it('error → re-upload → success flow', () => {
    renderWithProviders(<SubmissionsPage />);

    // Enable upload
    fireEvent.click(screen.getByRole('checkbox'));

    // First upload
    fireEvent.click(screen.getByTestId('mock-csv-upload'));
    expect(mockMutate).toHaveBeenCalledTimes(1);

    // Simulate error
    act(() => {
      csvOnError?.(Object.assign(new Error('Upload needs attention'), {
        details: [{ row: 0, field: 'month', message: "Month 'bad' is not valid" }],
      }));
    });

    // Error view shown
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Upload needs attention')).toBeInTheDocument();

    // Re-upload from error view
    fireEvent.click(screen.getByTestId('mock-csv-upload'));
    expect(mockMutate).toHaveBeenCalledTimes(2);

    // Simulate success on re-upload
    act(() => {
      csvOnSuccess?.(mockCsvResponse);
    });

    // Confirmation shown, error cleared
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
    expect(screen.getByText('BIR-2026-03-0001')).toBeInTheDocument();
  });
});
