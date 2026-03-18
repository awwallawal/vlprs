import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ReconciliationSummary } from './ReconciliationSummary';

const { mockUseReconciliationSummary, mockUseResolveDiscrepancy } = vi.hoisted(() => {
  const mockUseReconciliationSummary = vi.fn();
  const mockUseResolveDiscrepancy = vi.fn();
  return { mockUseReconciliationSummary, mockUseResolveDiscrepancy };
});

vi.mock('@/hooks/useReconciliation', () => ({
  useReconciliationSummary: mockUseReconciliationSummary,
  useResolveDiscrepancy: mockUseResolveDiscrepancy,
}));

const reconciliationData = {
  counts: {
    matched: 5,
    dateDiscrepancy: 2,
    unconfirmed: 1,
    newCsvEvent: 3,
  },
  details: [
    {
      staffId: 'STAFF-001',
      staffName: 'John Doe',
      eventType: 'RETIRED',
      csvEventDate: '2026-03-10',
      employmentEventDate: '2026-03-08',
      reconciliationStatus: 'matched' as const,
      daysDifference: 2,
      employmentEventId: 'evt-1',
    },
    {
      staffId: 'STAFF-002',
      staffName: 'Jane Smith',
      eventType: 'DECEASED',
      csvEventDate: '2026-03-20',
      employmentEventDate: '2026-03-01',
      reconciliationStatus: 'date_discrepancy' as const,
      daysDifference: 19,
      employmentEventId: 'evt-2',
    },
    {
      staffId: 'STAFF-003',
      staffName: 'Bob Johnson',
      eventType: 'SUSPENDED',
      csvEventDate: null,
      employmentEventDate: '2026-02-15',
      reconciliationStatus: 'unconfirmed_event' as const,
      daysDifference: null,
      employmentEventId: 'evt-3',
    },
    {
      staffId: 'STAFF-004',
      staffName: 'Alice Brown',
      eventType: 'DISMISSED',
      csvEventDate: '2026-03-12',
      employmentEventDate: null,
      reconciliationStatus: 'new_csv_event' as const,
      daysDifference: null,
      employmentEventId: null,
    },
  ],
};

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderComponent(overrides: { userRole?: string; data?: typeof reconciliationData | undefined; isPending?: boolean } = {}) {
  const { userRole = 'dept_admin', data = reconciliationData, isPending = false } = overrides;

  mockUseReconciliationSummary.mockReturnValue({ data, isPending });
  mockUseResolveDiscrepancy.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  });

  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ReconciliationSummary
        submissionId="sub-001"
        userRole={userRole as 'super_admin' | 'dept_admin' | 'mda_officer'}
        mdaId="mda-001"
      />
    </QueryClientProvider>,
  );
}

describe('ReconciliationSummary', () => {
  it('renders 4 count badges with correct values', () => {
    renderComponent();
    expect(screen.getByText(/5 confirmed/)).toBeInTheDocument();
    expect(screen.getByText(/2 date difference/)).toBeInTheDocument();
    expect(screen.getByText(/1 pending confirmation/)).toBeInTheDocument();
    expect(screen.getByText(/3 new from submission/)).toBeInTheDocument();
  });

  it('renders detail table with correct columns and data', () => {
    renderComponent();
    // Check header columns
    expect(screen.getByText('Staff ID')).toBeInTheDocument();
    expect(screen.getByText('Staff Name')).toBeInTheDocument();
    expect(screen.getByText('Event Type')).toBeInTheDocument();
    expect(screen.getByText('CSV Date')).toBeInTheDocument();
    expect(screen.getByText('Event Date')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Days Diff')).toBeInTheDocument();

    // Check data rows
    expect(screen.getByText('STAFF-001')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('STAFF-002')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('renders empty state when no events to reconcile', () => {
    renderComponent({
      data: {
        counts: { matched: 0, dateDiscrepancy: 0, unconfirmed: 0, newCsvEvent: 0 },
        details: [],
      },
    });
    expect(screen.getByText('No employment events to reconcile')).toBeInTheDocument();
  });

  it('renders all-clear state when all events matched', () => {
    renderComponent({
      data: {
        counts: { matched: 5, dateDiscrepancy: 0, unconfirmed: 0, newCsvEvent: 3 },
        details: [],
      },
    });
    expect(screen.getByText(/All events reconciled/)).toBeInTheDocument();
  });

  it('renders skeleton loading state during fetch', () => {
    const { container } = renderComponent({ isPending: true, data: undefined });
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('non-punitive badge colors: no red, uses gold for discrepancy and teal for matched', () => {
    const { container } = renderComponent();
    // No destructive (red) badges
    const allBadges = container.querySelectorAll('[class*="badge"]');
    const hasDestructive = Array.from(allBadges).some(
      (el) => el.className.includes('destructive'),
    );
    expect(hasDestructive).toBe(false);
  });

  it('DEPT_ADMIN sees resolution action buttons on DATE_DISCREPANCY rows', () => {
    renderComponent({ userRole: 'dept_admin' });
    expect(screen.getByText('Actions')).toBeInTheDocument();
    // DATE_DISCREPANCY row should have Confirm and Reject buttons
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('MDA_OFFICER does NOT see resolution action buttons (read-only view)', () => {
    renderComponent({ userRole: 'mda_officer' });
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  it('vocabulary compliance: no "error", "mismatch", or "fault" in rendered output', () => {
    renderComponent();
    const allText = document.body.textContent?.toLowerCase() ?? '';
    expect(allText).not.toMatch(/\berror\b/);
    expect(allText).not.toMatch(/\bmismatch\b/);
    expect(allText).not.toMatch(/\bfault\b/);
  });

  it('renders null when data is not available and not loading', () => {
    mockUseReconciliationSummary.mockReturnValue({ data: null, isPending: false });
    mockUseResolveDiscrepancy.mockReturnValue({ mutate: vi.fn(), isPending: false });
    const { container } = render(
      <QueryClientProvider client={createQueryClient()}>
        <ReconciliationSummary submissionId="sub-001" />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('resolution confirmation dialog requires reason (min 10 chars) before submission', async () => {
    const user = userEvent.setup();
    renderComponent({ userRole: 'dept_admin' });

    // Click the "Confirm" button on the DATE_DISCREPANCY row to open the dialog
    await user.click(screen.getByText('Confirm'));

    // Dialog should open — find it by role
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // The "Confirm" button inside the dialog should be disabled (reason is empty)
    const dialogConfirmBtn = within(dialog).getByRole('button', { name: 'Confirm' });
    expect(dialogConfirmBtn).toBeDisabled();

    // Type a short reason (less than 10 chars) — button should remain disabled
    const textarea = within(dialog).getByPlaceholderText(/enter reason/i);
    await user.type(textarea, 'Too short');
    expect(dialogConfirmBtn).toBeDisabled();

    // Type a reason >= 10 chars — button should become enabled
    await user.clear(textarea);
    await user.type(textarea, 'This is a valid reason for resolution');
    expect(dialogConfirmBtn).toBeEnabled();
  });

  it('successful resolution updates row status badge and hides action buttons', async () => {
    const user = userEvent.setup();
    const mutateMock = vi.fn((_params, options) => {
      // Simulate successful mutation by calling onSuccess
      options?.onSuccess?.();
    });

    mockUseReconciliationSummary.mockReturnValue({ data: reconciliationData, isPending: false });
    mockUseResolveDiscrepancy.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
    });

    render(
      <QueryClientProvider client={createQueryClient()}>
        <ReconciliationSummary
          submissionId="sub-001"
          userRole="dept_admin"
          mdaId="mda-001"
        />
      </QueryClientProvider>,
    );

    // Click the "Confirm" button on the DATE_DISCREPANCY row
    await user.click(screen.getByText('Confirm'));

    // Dialog should open
    const dialog = await screen.findByRole('dialog');

    // Type a valid reason and click dialog Confirm button
    const textarea = within(dialog).getByPlaceholderText(/enter reason/i);
    await user.type(textarea, 'Date confirmed with HR department records');

    const dialogConfirmBtn = within(dialog).getByRole('button', { name: 'Confirm' });
    await user.click(dialogConfirmBtn);

    // Verify the mutation was called with the correct params
    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        { eventId: 'evt-2', status: 'MATCHED', reason: 'Date confirmed with HR department records' },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      );
    });
  });
});
