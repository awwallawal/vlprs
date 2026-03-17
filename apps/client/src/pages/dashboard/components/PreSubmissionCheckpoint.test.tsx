import { render, screen } from '@testing-library/react';
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

  // AC 3 — Empty sections show "No items require attention"
  it('renders "No items require attention" with green checkmark for empty sections', () => {
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

    const emptyMessages = screen.getAllByText('No items require attention');
    expect(emptyMessages).toHaveLength(3);
  });

  // AC 2 — Confirmation checkbox toggles onConfirm callback
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

  // AC 3 — Checkbox required even when all sections empty
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
});
