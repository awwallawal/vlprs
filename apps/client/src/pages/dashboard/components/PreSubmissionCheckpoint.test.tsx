import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PreSubmissionCheckpoint } from './PreSubmissionCheckpoint';
import type { PreSubmissionCheckpoint as CheckpointData } from '@vlprs/shared';

const emptyCheckpoint: CheckpointData = {
  approachingRetirement: [],
  zeroDeduction: [],
  pendingEvents: [],
  lastSubmissionDate: null,
  submissionPeriod: '2026-03',
};

const populatedCheckpoint: CheckpointData = {
  approachingRetirement: [
    { staffName: 'John Doe', staffId: 'OYO-001', retirementDate: '2026-09-15', daysUntilRetirement: 182 },
    { staffName: 'Jane Smith', staffId: 'OYO-002', retirementDate: '2027-01-10', daysUntilRetirement: 299 },
  ],
  zeroDeduction: [
    { staffName: 'Bob Wilson', staffId: 'OYO-003', lastDeductionDate: '2026-02-28', daysSinceLastDeduction: 17 },
  ],
  pendingEvents: [
    { eventType: 'TRANSFER_OUT', staffName: 'Alice Brown', effectiveDate: '2026-03-01', reconciliationStatus: 'unconfirmed' },
  ],
  lastSubmissionDate: '2026-02-28',
  submissionPeriod: '2026-03',
};

// Generate 60 items for pagination tests
function generateZeroDeductionItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    staffName: `Staff ${i + 1}`,
    staffId: `OYO-${String(i + 100).padStart(4, '0')}`,
    lastDeductionDate: '2026-01-15',
    daysSinceLastDeduction: 60 + i,
  }));
}

describe('PreSubmissionCheckpoint', () => {
  // AC 1 — Renders three sections with correct item counts
  it('renders three sections with correct item counts when data present', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={populatedCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.getByText('Approaching Retirement')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();

    expect(screen.getByText('Zero Deduction Review')).toBeInTheDocument();
    // Both zero deduction (1) and pending events (1) show "1 item"
    expect(screen.getAllByText('1 item')).toHaveLength(2);

    expect(screen.getByText('Pending Events')).toBeInTheDocument();

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    expect(screen.getByText('TRANSFER_OUT')).toBeInTheDocument();
  });

  // AC 3 — Zero Deduction renders as a proper table
  it('renders zero deduction items in a table with sortable columns', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={populatedCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    // Should have table elements (3 tables — retirement, zero deduction, pending events)
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(3);

    // Check zero deduction specific column headers exist (shared headers like "Staff Name" appear in multiple tables)
    expect(screen.getByText('Last Deduction')).toBeInTheDocument();
    expect(screen.getByText('Days Since')).toBeInTheDocument();
  });

  // AC 3 — Retirement and pending events also render as tables
  it('renders retirement and pending event items as tables', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={populatedCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    // All three sections should have tables
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(3);

    // Retirement table headers
    expect(screen.getByText('Retirement Date')).toBeInTheDocument();
    expect(screen.getByText('Days Until')).toBeInTheDocument();

    // Pending events table headers
    expect(screen.getByText('Event Type')).toBeInTheDocument();
    expect(screen.getByText('Effective Date')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  // AC 3 — Pagination renders when >25 items
  it('shows pagination controls when more than 25 items', () => {
    const onConfirm = vi.fn();
    const checkpointWith60 = {
      ...emptyCheckpoint,
      zeroDeduction: generateZeroDeductionItems(60),
    };
    render(
      <PreSubmissionCheckpoint
        data={checkpointWith60}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  // AC 3 — Pagination navigates between pages
  it('navigates between pages when clicking Next/Previous', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const checkpointWith60 = {
      ...emptyCheckpoint,
      zeroDeduction: generateZeroDeductionItems(60),
    };
    render(
      <PreSubmissionCheckpoint
        data={checkpointWith60}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    await user.click(screen.getByText('Next'));
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    await user.click(screen.getByText('Previous'));
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  // AC 4 — No pagination when <25 items
  it('does not show pagination when less than 25 items', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={populatedCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  // AC 4 — Empty state for zero deduction
  it('shows contextual empty state for zero deduction section', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={emptyCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.getByText('All staff have recent deductions — no action needed')).toBeInTheDocument();
  });

  // AC 6 — Empty states for retirement and pending events
  it('shows contextual empty states for retirement and pending events sections', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={emptyCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.getByText('No approaching retirements')).toBeInTheDocument();
    expect(screen.getByText('No pending events')).toBeInTheDocument();
  });

  // AC 5 — Skeleton loader during loading
  it('skeleton loader shown during loading state', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={undefined}
        isLoading={true}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.getByTestId('checkpoint-skeleton')).toBeInTheDocument();
  });

  // AC 5 — Error message on fetch failure (non-punitive vocabulary)
  it('error message shown on fetch failure (non-punitive vocabulary)', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={undefined}
        isLoading={false}
        isError={true}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/unable to load checkpoint data/i)).toBeInTheDocument();
  });

  // Confirmation checkbox
  it('confirmation checkbox toggles onConfirm callback', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={emptyCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();

    await user.click(checkbox);
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  // Checkbox required even when all sections empty
  it('checkbox is required even when all sections are empty', () => {
    const onConfirm = vi.fn();
    render(
      <PreSubmissionCheckpoint
        data={emptyCheckpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText('I have reviewed the above items')).toBeInTheDocument();
  });

  // Column sorting
  it('sorts zero deduction table by column when header is clicked', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const checkpoint: CheckpointData = {
      ...emptyCheckpoint,
      zeroDeduction: [
        { staffName: 'Zara Yusuf', staffId: 'OYO-001', lastDeductionDate: '2026-01-01', daysSinceLastDeduction: 90 },
        { staffName: 'Ada Bello', staffId: 'OYO-002', lastDeductionDate: '2026-02-15', daysSinceLastDeduction: 30 },
      ],
    };
    render(
      <PreSubmissionCheckpoint
        data={checkpoint}
        isLoading={false}
        isError={false}
        onConfirm={onConfirm}
        confirmed={false}
      />,
    );

    // Only one table is rendered (retirement/events are empty → no tables for them)
    const table = screen.getByRole('table');

    // Default sort is daysSinceLastDeduction desc → Zara (90) before Ada (30)
    let rows = within(table).getAllByRole('row');
    // row[0] is header, row[1] is first data row
    expect(rows[1]).toHaveTextContent('Zara Yusuf');
    expect(rows[2]).toHaveTextContent('Ada Bello');

    // Click "Staff Name" header to sort ascending by name
    const staffNameHeader = within(table).getByText('Staff Name');
    await user.click(staffNameHeader);

    // Now Ada should come before Zara
    rows = within(table).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Ada Bello');
    expect(rows[2]).toHaveTextContent('Zara Yusuf');
  });
});
