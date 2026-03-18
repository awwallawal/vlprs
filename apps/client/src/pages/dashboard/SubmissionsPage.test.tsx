import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SubmissionsPage } from './SubmissionsPage';

const mockSubmissions = [
  {
    id: 'sub-001',
    referenceNumber: 'MOH-2026-02-0001',
    submissionDate: '2026-02-15T14:20:00Z',
    recordCount: 178,
    alignedCount: 175,
    varianceCount: 3,
    status: 'confirmed' as const,
  },
  {
    id: 'sub-002',
    referenceNumber: 'MOH-2026-01-0001',
    submissionDate: '2026-01-14T10:30:00Z',
    recordCount: 176,
    alignedCount: 174,
    varianceCount: 2,
    status: 'confirmed' as const,
  },
];

// Default mock: MDA_OFFICER role
const mockUser = {
  mdaId: 'mda-003',
  firstName: 'Health',
  lastName: 'Officer',
  role: 'mda_officer',
  email: 'test@test.com',
};

let currentMockUser: Record<string, unknown> = mockUser;

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ user: currentMockUser }),
}));

// Configurable upload mutation mock
let mockUploadMutation = {
  mutate: vi.fn(),
  reset: vi.fn(),
  isPending: false,
  isSuccess: false,
  isError: false,
  data: null as Record<string, unknown> | null,
  error: null as (Error & { details?: unknown[] }) | null,
};

vi.mock('@/hooks/useSubmissionData', () => ({
  useSubmissionHistory: () => ({
    data: { items: mockSubmissions, total: mockSubmissions.length, page: 1, pageSize: 20 },
    isPending: false,
  }),
  useSubmissionUpload: () => mockUploadMutation,
  useManualSubmission: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
    data: null,
    error: null,
  }),
}));

vi.mock('@/hooks/usePreSubmissionCheckpoint', () => ({
  usePreSubmissionCheckpoint: () => ({
    data: {
      approachingRetirement: [
        { staffName: 'John Doe', staffId: 'OYO-001', retirementDate: '2026-09-15', daysUntilRetirement: 182 },
        { staffName: 'Jane Smith', staffId: 'OYO-002', retirementDate: '2027-01-10', daysUntilRetirement: 299 },
      ],
      zeroDeduction: [
        { staffName: 'Bob Wilson', staffId: 'OYO-003', lastDeductionDate: '2026-02-28', daysSinceLastDeduction: 17 },
      ],
      pendingEvents: [],
      lastSubmissionDate: '2026-02-28',
      submissionPeriod: '2026-03',
    },
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue([{ id: 'mda-003', name: 'Ministry of Health', code: 'HLT' }]),
}));

function renderPage(initialEntries = ['/dashboard/submissions']) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <SubmissionsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SubmissionsPage', () => {
  beforeEach(() => {
    currentMockUser = mockUser; // reset to MDA_OFFICER
    mockUploadMutation = {
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

  it('renders page heading "Monthly Submissions"', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Monthly Submissions' }),
    ).toBeInTheDocument();
  });

  it('renders "Submit Monthly Data" as prominent primary action button', () => {
    renderPage();
    const heroButton = screen.getByRole('button', { name: /Submit Monthly Data/i });
    expect(heroButton).toBeInTheDocument();
  });

  it('Submit Monthly Data button is disabled when checkpoint not confirmed', () => {
    renderPage();
    const heroButton = screen.getByRole('button', { name: /Submit Monthly Data/i });
    expect(heroButton).toBeDisabled();
  });

  it('Submit Monthly Data button enables after checkpoint confirmed', async () => {
    renderPage();
    const user = userEvent.setup();
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    const heroButton = screen.getByRole('button', { name: /Submit Monthly Data/i });
    expect(heroButton).toBeEnabled();
  });

  it('renders pre-submission checkpoint section', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pre-Submission Checkpoint' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Approaching Retirement')).toBeInTheDocument();
    expect(screen.getByText('Zero Deduction Review')).toBeInTheDocument();
    expect(screen.getByText('Pending Events')).toBeInTheDocument();
  });

  it('renders confirmation checkbox', () => {
    renderPage();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
    expect(
      screen.getByText(/I have reviewed the above items/),
    ).toBeInTheDocument();
  });

  it('renders submission data section with tabs', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Submit Deduction Data' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'CSV Upload' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Manual Entry' })).toBeInTheDocument();
  });

  it('shows CSV Upload tab as default active tab', () => {
    renderPage();
    const csvTab = screen.getByRole('tab', { name: 'CSV Upload' });
    expect(csvTab).toHaveAttribute('data-state', 'active');
  });

  it('switches to Manual Entry tab when clicked', async () => {
    renderPage();
    const user = userEvent.setup();
    const manualTab = screen.getByRole('tab', { name: 'Manual Entry' });
    await user.click(manualTab);
    expect(manualTab).toHaveAttribute('data-state', 'active');
  });

  it('renders submission history table', () => {
    renderPage();
    expect(screen.getByText('MOH-2026-02-0001')).toBeInTheDocument();
    expect(screen.getByText('MOH-2026-01-0001')).toBeInTheDocument();
  });

  it('renders download CSV template link with download attribute', () => {
    renderPage();
    const link = screen.getByRole('link', { name: /Download CSV Template/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('download');
    expect(link).toHaveAttribute('href', '/templates/submission-template.csv');
  });

  it('preserves manual entry form when switching tabs (forceMount)', async () => {
    renderPage();
    const user = userEvent.setup();

    // Switch to Manual Entry tab
    await user.click(screen.getByRole('tab', { name: 'Manual Entry' }));
    expect(screen.getByText('Submit All')).toBeInTheDocument();

    // Switch back to CSV Upload
    await user.click(screen.getByRole('tab', { name: 'CSV Upload' }));

    // Switch back to Manual Entry — form data should be preserved (forceMount)
    await user.click(screen.getByRole('tab', { name: 'Manual Entry' }));
    expect(screen.getByText('Submit All')).toBeInTheDocument();
  });

  // Role-based visibility tests
  describe('role-based visibility', () => {
    it('MDA_OFFICER sees upload capability and MDA name context', () => {
      currentMockUser = { ...mockUser, role: 'mda_officer' };
      renderPage();
      expect(screen.getByRole('button', { name: /Submit Monthly Data/i })).toBeInTheDocument();
      expect(screen.getByText(/Organisation:/)).toBeInTheDocument();
    });

    it('DEPT_ADMIN sees upload capability and "All MDAs" context', () => {
      currentMockUser = { ...mockUser, role: 'dept_admin', mdaId: null };
      renderPage();
      expect(screen.getByRole('button', { name: /Submit Monthly Data/i })).toBeInTheDocument();
      expect(screen.getByText('All MDAs')).toBeInTheDocument();
    });

    it('SUPER_ADMIN sees read-only history view (no upload capability)', () => {
      currentMockUser = { ...mockUser, role: 'super_admin', mdaId: null };
      renderPage();
      expect(screen.queryByRole('button', { name: /Submit Monthly Data/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Submit Deduction Data' })).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Submission History' })).toBeInTheDocument();
    });
  });

  // Period display
  it('shows current submission period', () => {
    renderPage();
    expect(screen.getByText(/Submitting for:/)).toBeInTheDocument();
  });

  // Accessibility tests
  describe('accessibility', () => {
    it('hero button has aria-disabled when checkpoint not confirmed', () => {
      renderPage();
      const heroButton = screen.getByRole('button', { name: /Submit Monthly Data/i });
      expect(heroButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('file upload zone has aria-label', () => {
      renderPage();
      expect(
        screen.getByRole('button', { name: /Upload CSV file/i }),
      ).toBeInTheDocument();
    });

    it('checkpoint section has proper heading hierarchy', () => {
      renderPage();
      const h2s = screen.getAllByRole('heading', { level: 2 });
      const headingTexts = h2s.map((h) => h.textContent);
      expect(headingTexts).toContain('Pre-Submission Checkpoint');
      expect(headingTexts).toContain('Submit Deduction Data');
      expect(headingTexts).toContain('Submission History');
    });
  });

  // Story 5.6 — Navigation to detail page (Task 6.1)
  it('submission history rows link to detail page', () => {
    renderPage();
    const link = screen.getByRole('link', { name: 'MOH-2026-02-0001' });
    expect(link).toHaveAttribute('href', '/dashboard/submissions/sub-001');
  });

  // Upload flow state machine tests
  describe('upload flow state machine', () => {
    it('shows validation error display with re-upload zone on upload error', () => {
      mockUploadMutation = {
        ...mockUploadMutation,
        isError: true,
        error: Object.assign(new Error('Upload needs attention'), {
          details: [
            { row: 0, field: 'amountDeducted', message: "Amount '12.3' is not a valid number" },
            { row: 2, field: 'month', message: "Month 'Feb' is not valid" },
          ],
        }),
      };
      renderPage();
      // ValidationErrorDisplay should render
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Upload needs attention')).toBeInTheDocument();
      expect(screen.getByText(/Row 1:/)).toBeInTheDocument();
      expect(screen.getByText(/Row 3:/)).toBeInTheDocument();
      // Reassurance message
      expect(
        screen.getByText('No data was processed — your previous submission is unchanged'),
      ).toBeInTheDocument();
      // Re-upload zone should be present (FileUploadZone with idle status)
      expect(
        screen.getByRole('button', { name: /Upload.*CSV.*file/i }),
      ).toBeInTheDocument();
    });

    it('shows uploading state when mutation is pending', () => {
      mockUploadMutation = {
        ...mockUploadMutation,
        isPending: true,
      };
      renderPage();
      // Upload zone should show uploading status
      expect(screen.getByText(/Uploading/)).toBeInTheDocument();
    });

    it('history table remains visible in all states', () => {
      renderPage();
      expect(screen.getByRole('heading', { name: 'Submission History' })).toBeInTheDocument();

      // Also visible in error state
      mockUploadMutation = {
        ...mockUploadMutation,
        isError: true,
        error: Object.assign(new Error('test'), {
          details: [{ row: 0, field: 'x', message: 'test' }],
        }),
      };
      const { unmount } = renderPage();
      expect(screen.getAllByRole('heading', { name: 'Submission History' }).length).toBeGreaterThan(0);
      unmount();
    });
  });
});
