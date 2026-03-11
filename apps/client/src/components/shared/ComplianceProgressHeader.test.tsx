import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ComplianceProgressHeader } from './ComplianceProgressHeader';

// Mock date-fns to control date computation
vi.mock('date-fns', () => ({
  differenceInCalendarDays: vi.fn(),
}));

import { differenceInCalendarDays } from 'date-fns';
const mockDiff = vi.mocked(differenceInCalendarDays);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ComplianceProgressHeader', () => {
  it('displays submitted count out of total', () => {
    mockDiff.mockReturnValue(17);
    render(
      <ComplianceProgressHeader
        submitted={45}
        total={63}
        deadlineDate="2026-03-28T00:00:00.000Z"
      />,
    );
    expect(screen.getByText('45 of 63 MDAs submitted')).toBeDefined();
  });

  it('shows countdown badge with days remaining', () => {
    mockDiff.mockReturnValue(17);
    render(
      <ComplianceProgressHeader
        submitted={45}
        total={63}
        deadlineDate="2026-03-28T00:00:00.000Z"
      />,
    );
    expect(screen.getByText('17 days until deadline (28th)')).toBeDefined();
  });

  it('shows singular "day" when 1 day remaining', () => {
    mockDiff.mockReturnValue(1);
    render(
      <ComplianceProgressHeader
        submitted={60}
        total={63}
        deadlineDate="2026-03-28T00:00:00.000Z"
      />,
    );
    expect(screen.getByText('1 day until deadline (28th)')).toBeDefined();
  });

  it('shows "Deadline today" when 0 days remaining', () => {
    mockDiff.mockReturnValue(0);
    render(
      <ComplianceProgressHeader
        submitted={62}
        total={63}
        deadlineDate="2026-03-28T00:00:00.000Z"
      />,
    );
    expect(screen.getByText('Deadline today (28th)')).toBeDefined();
  });

  it('shows deadline passed message when past deadline', () => {
    mockDiff.mockReturnValue(-3);
    render(
      <ComplianceProgressHeader
        submitted={45}
        total={63}
        deadlineDate="2026-03-28T00:00:00.000Z"
      />,
    );
    expect(screen.getByText('Deadline passed — 18 MDAs awaiting')).toBeDefined();
  });

  it('renders progress bar with correct aria attributes', () => {
    mockDiff.mockReturnValue(10);
    render(
      <ComplianceProgressHeader
        submitted={30}
        total={63}
        deadlineDate="2026-03-28T00:00:00.000Z"
      />,
    );
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('30');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('63');
  });
});
