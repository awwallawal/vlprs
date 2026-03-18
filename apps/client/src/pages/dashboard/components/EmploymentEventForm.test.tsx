import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock hooks
const mockStaffLookupData = {
  staffId: 'STAFF001',
  staffName: 'John Doe',
  mdaName: 'Ministry of Agriculture',
  loanStatus: 'ACTIVE',
};

const mockCreateEvent = vi.fn();
const mockMutateAsync = vi.fn();

vi.mock('@/hooks/useEmploymentEvent', () => ({
  useStaffLookup: vi.fn((staffId: string) => {
    if (staffId === 'STAFF001') {
      return { data: mockStaffLookupData, isError: false, isLoading: false };
    }
    if (staffId === 'UNKNOWN') {
      return { data: null, isError: true, isLoading: false };
    }
    return { data: null, isError: false, isLoading: false };
  }),
  useCreateEmploymentEvent: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: (string | undefined | false)[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

/**
 * Mock @hookform/resolvers/zod so we can bypass Zod validation in
 * submission tests (jsdom + Radix Select prevents setting eventType/effectiveDate).
 * When `bypassValidation` is true, the resolver returns the `bypassValues` payload
 * with no errors, causing react-hook-form to call `onSubmit` immediately.
 */
let bypassValidation = false;
let bypassValues: Record<string, unknown> = {};
vi.mock('@hookform/resolvers/zod', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@hookform/resolvers/zod')>();
  return {
    ...orig,
    zodResolver: (...args: Parameters<typeof orig.zodResolver>) => {
      const realResolver = orig.zodResolver(...args);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (values: any, context: any, options: any) => {
        if (bypassValidation) {
          return { values: bypassValues, errors: {} };
        }
        return realResolver(values, context, options);
      };
    },
  };
});

import { EmploymentEventForm } from './EmploymentEventForm';
import { EMPLOYMENT_EVENT_TYPES, REFERENCE_REQUIRED_TYPES, UI_COPY } from '@vlprs/shared';
import { toast } from 'sonner';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('EmploymentEventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bypassValidation = false;
    bypassValues = {};
    mockMutateAsync.mockResolvedValue({
      id: 'event-1',
      staffId: 'STAFF001',
      staffName: 'John Doe',
      eventType: 'RETIRED',
      effectiveDate: '2026-06-01',
      newLoanStatus: 'RETIRED',
      reconciliationStatus: 'UNCONFIRMED',
    });
  });

  it('renders the form with title', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    expect(screen.getByText('Report Employment Event')).toBeInTheDocument();
  });

  it('renders Staff ID input', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText('Enter Staff ID')).toBeInTheDocument();
  });

  it('renders event type dropdown', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    expect(screen.getByText('Select event type')).toBeInTheDocument();
  });

  it('renders effective date picker', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    expect(screen.getByText('Select date')).toBeInTheDocument();
  });

  it('renders reference number field', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    expect(screen.getByText('Reference Number')).toBeInTheDocument();
  });

  it('renders notes field', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    expect(screen.getByText('Notes')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    expect(screen.getByText('Submit Event')).toBeInTheDocument();
  });

  it('shows teal confirmation panel on staff lookup match', async () => {
    const user = userEvent.setup();
    render(<EmploymentEventForm />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText('Enter Staff ID');
    await user.type(input, 'STAFF001');

    await waitFor(() => {
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Ministry of Agriculture/)).toBeInTheDocument();
    });
  });

  it('shows "not found" message on staff lookup miss', async () => {
    const user = userEvent.setup();
    render(<EmploymentEventForm />, { wrapper: createWrapper() });

    const input = screen.getByPlaceholderText('Enter Staff ID');
    await user.type(input, 'UNKNOWN');

    await waitFor(() => {
      expect(screen.getByText(/Staff ID not found/)).toBeInTheDocument();
    });
  });

  it('has event type dropdown with placeholder', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    // Radix Select renders with pointer-events:none in jsdom, so we verify
    // the trigger renders rather than opening the dropdown
    expect(screen.getByText('Select event type')).toBeInTheDocument();
  });

  it('exports all 11 event types from shared constants', () => {
    expect(EMPLOYMENT_EVENT_TYPES).toHaveLength(11);
    expect(EMPLOYMENT_EVENT_TYPES).toContain('RETIRED');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('DECEASED');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('SUSPENDED');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('ABSCONDED');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('TRANSFERRED_OUT');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('TRANSFERRED_IN');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('DISMISSED');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('LWOP_START');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('LWOP_END');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('REINSTATED');
    expect(EMPLOYMENT_EVENT_TYPES).toContain('SERVICE_EXTENSION');
  });

  it('has human-readable labels for all 11 event types', () => {
    const labels = UI_COPY.EVENT_TYPE_LABELS as Record<string, string>;
    for (const type of EMPLOYMENT_EVENT_TYPES) {
      expect(labels[type]).toBeDefined();
      expect(typeof labels[type]).toBe('string');
    }
  });

  // --- H2 gap tests ---

  it('Reference Number becomes required for specific event types (REFERENCE_REQUIRED_TYPES)', () => {
    // Radix Select can't be manipulated in jsdom, so we verify:
    // 1. The REFERENCE_REQUIRED_TYPES constant contains the expected types
    expect(REFERENCE_REQUIRED_TYPES).toContain('RETIRED');
    expect(REFERENCE_REQUIRED_TYPES).toContain('TRANSFERRED_OUT');
    expect(REFERENCE_REQUIRED_TYPES).toContain('DISMISSED');
    expect(REFERENCE_REQUIRED_TYPES).toContain('REINSTATED');
    expect(REFERENCE_REQUIRED_TYPES).toContain('SERVICE_EXTENSION');
    expect(REFERENCE_REQUIRED_TYPES).toHaveLength(5);

    // 2. By default (no event type selected), the Reference Number label has NO red asterisk
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    const refLabel = screen.getByText('Reference Number');
    // The asterisk is a child <span> with text " *" — it should NOT be present
    expect(refLabel.querySelector('span.text-red-500')).toBeNull();
  });

  it('New Retirement Date field does NOT appear by default (only for SERVICE_EXTENSION)', () => {
    render(<EmploymentEventForm />, { wrapper: createWrapper() });
    // With no event type selected, the conditional New Retirement Date block is hidden
    expect(screen.queryByText('New Retirement Date')).not.toBeInTheDocument();
  });

  it('form submission calls mutation and shows success toast', async () => {
    // Bypass Zod validation — jsdom + Radix Select prevents setting eventType/effectiveDate
    bypassValidation = true;
    bypassValues = {
      staffId: 'STAFF001',
      eventType: 'RETIRED',
      effectiveDate: '2026-03-15',
      referenceNumber: 'REF-1',
    };

    const user = userEvent.setup();
    render(<EmploymentEventForm />, { wrapper: createWrapper() });

    const staffInput = screen.getByPlaceholderText('Enter Staff ID');
    await user.type(staffInput, 'STAFF001');

    const submitBtn = screen.getByText('Submit Event');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(UI_COPY.EMPLOYMENT_EVENT_SUCCESS);
    });

    bypassValidation = false;
  });

  it('403 error shows MDA denied toast', async () => {
    mockMutateAsync.mockRejectedValueOnce({ status: 403, message: 'Forbidden' });

    bypassValidation = true;
    bypassValues = {
      staffId: 'STAFF001',
      eventType: 'RETIRED',
      effectiveDate: '2026-03-15',
      referenceNumber: 'REF-1',
    };

    const user = userEvent.setup();
    render(<EmploymentEventForm />, { wrapper: createWrapper() });

    const staffInput = screen.getByPlaceholderText('Enter Staff ID');
    await user.type(staffInput, 'STAFF001');

    const submitBtn = screen.getByText('Submit Event');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith(UI_COPY.EMPLOYMENT_EVENT_MDA_DENIED);
    });

    bypassValidation = false;
  });

  it('duplicate guard shows confirmation dialog with Proceed Anyway button', async () => {
    mockMutateAsync.mockRejectedValueOnce({ status: 422, code: 'DUPLICATE_EVENT' });

    bypassValidation = true;
    bypassValues = {
      staffId: 'STAFF001',
      eventType: 'RETIRED',
      effectiveDate: '2026-03-15',
      referenceNumber: 'REF-1',
    };

    const user = userEvent.setup();
    render(<EmploymentEventForm />, { wrapper: createWrapper() });

    const staffInput = screen.getByPlaceholderText('Enter Staff ID');
    await user.type(staffInput, 'STAFF001');

    const submitBtn = screen.getByText('Submit Event');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    });

    // The duplicate dialog should now be visible
    await waitFor(() => {
      expect(screen.getByText(UI_COPY.EMPLOYMENT_EVENT_DUPLICATE_CONFIRM)).toBeInTheDocument();
      expect(screen.getByText('Proceed Anyway')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    bypassValidation = false;
  });
});
