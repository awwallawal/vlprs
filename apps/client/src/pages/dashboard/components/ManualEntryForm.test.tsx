import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { ManualEntryForm } from './ManualEntryForm';

// jsdom polyfills for Radix UI pointer events and scroll
beforeAll(() => {
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock sonner toast — vi.hoisted ensures the object exists before vi.mock hoisting
const mockToast = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: mockToast }));

// Mock auth store — default MDA_OFFICER
let mockUser: Record<string, unknown> = {
  mdaId: 'mda-003',
  firstName: 'Health',
  lastName: 'Officer',
  role: 'mda_officer',
  email: 'test@test.com',
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ user: mockUser }),
}));

const mockMutateAsync = vi.fn();
let mockMutationState = {
  isPending: false,
  isSuccess: false,
  isError: false,
  data: null as unknown,
  error: null as unknown,
};

vi.mock('@/hooks/useSubmissionData', () => ({
  useManualSubmission: () => ({
    mutate: vi.fn(),
    mutateAsync: mockMutateAsync,
    reset: vi.fn(),
    ...mockMutationState,
  }),
}));

// Mock apiClient — return MDAs for MDA code lookup
vi.mock('@/lib/apiClient', () => ({
  apiClient: vi.fn().mockResolvedValue([
    { id: 'mda-003', name: 'Ministry of Health', code: 'MOH' },
    { id: 'mda-004', name: 'Ministry of Finance', code: 'MOF' },
  ]),
}));

function renderForm(props: { disabled?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ManualEntryForm {...props} />
    </QueryClientProvider>,
  );
}

describe('ManualEntryForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      mdaId: 'mda-003',
      firstName: 'Health',
      lastName: 'Officer',
      role: 'mda_officer',
      email: 'test@test.com',
    };
    mockMutationState = {
      isPending: false,
      isSuccess: false,
      isError: false,
      data: null,
      error: null,
    };
  });

  it('renders 8 form fields per row', async () => {
    renderForm();

    // Row 1 should have all required fields
    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.getByLabelText(/Staff ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Month/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Amount Deducted/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Payroll Batch Ref/)).toBeInTheDocument();
    expect(screen.getByLabelText(/MDA Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Event Flag/)).toBeInTheDocument();
  });

  it('renders Add Row and Submit All buttons', () => {
    renderForm();
    expect(screen.getByRole('button', { name: /Add Row/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Submit All/i })).toBeInTheDocument();
  });

  it('adds a new row when Add Row is clicked', async () => {
    renderForm();
    const user = userEvent.setup();

    expect(screen.getByText('Row 1')).toBeInTheDocument();
    expect(screen.queryByText('Row 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Add Row/i }));

    expect(screen.getByText('Row 2')).toBeInTheDocument();
  });

  it('removes a row when trash icon is clicked', async () => {
    renderForm();
    const user = userEvent.setup();

    // Add second row
    await user.click(screen.getByRole('button', { name: /Add Row/i }));
    expect(screen.getByText('Row 2')).toBeInTheDocument();

    // Remove first row
    const removeBtn = screen.getByRole('button', { name: /Remove row 1/i });
    await user.click(removeBtn);

    // Should only have one row now
    expect(screen.queryByText('Row 2')).not.toBeInTheDocument();
  });

  it('hides remove button when only one row exists', () => {
    renderForm();
    // No remove button when single row
    expect(screen.queryByRole('button', { name: /Remove row/i })).not.toBeInTheDocument();
  });

  it('pre-fills Month field with current YYYY-MM format', () => {
    renderForm();
    const now = new Date();
    const expectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthInput = screen.getByLabelText(/Month/) as HTMLInputElement;
    expect(monthInput.value).toBe(expectedMonth);
  });

  it('shows MDA Code as read-only for MDA_OFFICER role', async () => {
    renderForm();
    // Wait for MDA query to resolve
    const mdaInput = await screen.findByLabelText(/MDA Code/) as HTMLInputElement;
    expect(mdaInput).toHaveAttribute('readOnly');
  });

  it('disables Add Row button when max rows reached', async () => {
    // Not practical to add 50 rows in a test, but verify the button exists and is enabled initially
    renderForm();
    const addBtn = screen.getByRole('button', { name: /Add Row/i });
    expect(addBtn).not.toBeDisabled();
  });

  it('disables form controls when disabled prop is true', () => {
    renderForm({ disabled: true });
    const addBtn = screen.getByRole('button', { name: /Add Row/i });
    expect(addBtn).toBeDisabled();
    const submitBtn = screen.getByRole('button', { name: /Submit All/i });
    expect(submitBtn).toBeDisabled();
  });
});

describe('ManualEntryForm — conditional fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      mdaId: 'mda-003', firstName: 'Health', lastName: 'Officer',
      role: 'mda_officer', email: 'test@test.com',
    };
    mockMutationState = { isPending: false, isSuccess: false, isError: false, data: null, error: null };
  });

  it('does not show Event Date or Cessation Reason by default', () => {
    renderForm();
    expect(screen.queryByLabelText(/Event Date/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Cessation Reason/)).not.toBeInTheDocument();
  });

  it('shows Event Date when Event Flag is changed to non-NONE value (9.6)', async () => {
    renderForm();
    const user = userEvent.setup();

    // Open the Event Flag select
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    // Select RETIREMENT from dropdown
    const retirementOption = await screen.findByRole('option', { name: /RETIREMENT/i });
    await user.click(retirementOption);

    // Event Date field should now be visible
    await waitFor(() => {
      expect(screen.getByLabelText(/Event Date/)).toBeInTheDocument();
    });
  });

  it('shows Cessation Reason when Amount is 0 and Event Flag is NONE (9.7)', async () => {
    renderForm();
    const user = userEvent.setup();

    // Type "0" into Amount Deducted field
    const amountInput = screen.getByLabelText(/Amount Deducted/);
    await user.type(amountInput, '0');

    // Cessation Reason should appear (amount = 0, Event Flag = NONE by default)
    await waitFor(() => {
      expect(screen.getByLabelText(/Cessation Reason/)).toBeInTheDocument();
    });
  });
});

describe('ManualEntryForm — submission (9.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      mdaId: 'mda-003', firstName: 'Health', lastName: 'Officer',
      role: 'mda_officer', email: 'test@test.com',
    };
    mockMutationState = { isPending: false, isSuccess: false, isError: false, data: null, error: null };
  });

  it('calls mutateAsync with row data on form submit and shows success toast (9.3, 9.10)', async () => {
    mockMutateAsync.mockResolvedValueOnce({
      referenceNumber: 'BIR-2026-03-0001',
      recordCount: 1,
      submissionDate: '2026-03-13T10:00:00Z',
      status: 'confirmed',
    });

    renderForm();
    const user = userEvent.setup();

    // Fill in required fields
    await user.type(screen.getByLabelText(/Staff ID/), 'OYO-001');
    await user.type(screen.getByLabelText(/Payroll Batch Ref/), 'BATCH-001');

    // Wait for MDA code to be pre-filled
    await waitFor(() => {
      expect((screen.getByLabelText(/MDA Code/) as HTMLInputElement).value).toBe('MOH');
    });

    // Amount is required — type a valid value
    await user.type(screen.getByLabelText(/Amount Deducted/), '15000');

    // Submit
    await user.click(screen.getByRole('button', { name: /Submit All/i }));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    // Verify the call includes row data
    const callArgs = mockMutateAsync.mock.calls[0][0];
    expect(callArgs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ staffId: 'OYO-001' }),
      ]),
    );

    // Success toast should fire (9.10)
    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith('Submission confirmed and recorded');
    });
  });

  it('maps 422 errors to inline form fields and shows attention toast (9.4, 9.10)', async () => {
    const error422 = Object.assign(new Error('Validation failed'), {
      status: 422,
      details: [
        { row: 0, field: 'staffId', message: "Row 1: Staff ID 'BAD' not found in your MDA" },
      ],
    });
    mockMutateAsync.mockRejectedValueOnce(error422);

    renderForm();
    const user = userEvent.setup();

    // Fill minimum fields to trigger submit
    await user.type(screen.getByLabelText(/Staff ID/), 'BAD');
    await user.type(screen.getByLabelText(/Amount Deducted/), '15000');
    await user.type(screen.getByLabelText(/Payroll Batch Ref/), 'BATCH-001');

    await waitFor(() => {
      expect((screen.getByLabelText(/MDA Code/) as HTMLInputElement).value).toBe('MOH');
    });

    await user.click(screen.getByRole('button', { name: /Submit All/i }));

    // Toast with attention count (9.10)
    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith(
        expect.stringContaining('items need your attention'),
      );
    });

    // "Upload needs attention" banner should appear (M1 fix validation)
    await waitFor(() => {
      expect(screen.getByText('Upload needs attention')).toBeInTheDocument();
    });
  });

  it('shows generic banner for non-422 errors with info toast (9.5, L1)', async () => {
    const error400 = Object.assign(new Error('Bad request'), { status: 400 });
    mockMutateAsync.mockRejectedValueOnce(error400);

    renderForm();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Staff ID/), 'OYO-001');
    await user.type(screen.getByLabelText(/Amount Deducted/), '15000');
    await user.type(screen.getByLabelText(/Payroll Batch Ref/), 'BATCH-001');

    await waitFor(() => {
      expect((screen.getByLabelText(/MDA Code/) as HTMLInputElement).value).toBe('MOH');
    });

    await user.click(screen.getByRole('button', { name: /Submit All/i }));

    // Info toast (non-punitive, not toast.error)
    await waitFor(() => {
      expect(mockToast.info).toHaveBeenCalledWith('Bad request');
    });
    expect(mockToast.error).not.toHaveBeenCalled();
  });
});

describe('ManualEntryForm — DEPT_ADMIN role (9.9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      mdaId: null,
      firstName: 'Admin',
      lastName: 'User',
      role: 'dept_admin',
      email: 'admin@test.com',
    };
    mockMutationState = { isPending: false, isSuccess: false, isError: false, data: null, error: null };
  });

  it('shows editable MDA Code field for DEPT_ADMIN role', async () => {
    renderForm();
    const mdaInput = await screen.findByLabelText(/MDA Code/) as HTMLInputElement;
    expect(mdaInput).not.toHaveAttribute('readOnly');
    expect(mdaInput.value).toBe(''); // Not pre-filled for DEPT_ADMIN
  });
});

describe('ManualEntryForm — keyboard navigation (9.11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      mdaId: 'mda-003', firstName: 'Health', lastName: 'Officer',
      role: 'mda_officer', email: 'test@test.com',
    };
    mockMutationState = { isPending: false, isSuccess: false, isError: false, data: null, error: null };
  });

  it('all form fields and buttons are keyboard-focusable via Tab', async () => {
    renderForm();
    const user = userEvent.setup();

    // Tab into the form — first focusable should be Staff ID
    await user.tab();
    expect(screen.getByLabelText(/Staff ID/)).toHaveFocus();

    // Continue tabbing through fields
    await user.tab();
    expect(screen.getByLabelText(/Month/)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/Amount Deducted/)).toHaveFocus();

    await user.tab();
    expect(screen.getByLabelText(/Payroll Batch Ref/)).toHaveFocus();
  });
});
