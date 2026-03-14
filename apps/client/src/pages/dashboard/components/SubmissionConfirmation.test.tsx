import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

import { SubmissionConfirmation } from './SubmissionConfirmation';
import { formatDateTime } from '@/lib/formatters';

describe('SubmissionConfirmation', () => {
  let originalClipboard: Clipboard;

  const defaultProps = {
    referenceNumber: 'BIR-2026-02-0001',
    recordCount: 42,
    submissionDate: '2026-03-11T14:30:00.000Z',
    source: 'csv' as const,
    onSubmitAnother: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers();
    originalClipboard = navigator.clipboard;
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.assign(navigator, { clipboard: originalClipboard });
    vi.restoreAllMocks();
  });

  it('renders reference number', () => {
    render(<SubmissionConfirmation {...defaultProps} />);
    expect(screen.getByText('BIR-2026-02-0001')).toBeInTheDocument();
  });

  it('renders record count', () => {
    render(<SubmissionConfirmation {...defaultProps} />);
    expect(screen.getByText('42 records submitted')).toBeInTheDocument();
  });

  it('renders formatted timestamp', () => {
    render(<SubmissionConfirmation {...defaultProps} />);
    const expected = formatDateTime(defaultProps.submissionDate);
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders "Upload Complete" header', () => {
    render(<SubmissionConfirmation {...defaultProps} />);
    expect(screen.getByText('Upload Complete')).toBeInTheDocument();
  });

  it('renders CSV source label', () => {
    render(<SubmissionConfirmation {...defaultProps} source="csv" />);
    expect(screen.getByText('Submitted via CSV upload')).toBeInTheDocument();
  });

  it('renders manual source label', () => {
    render(<SubmissionConfirmation {...defaultProps} source="manual" />);
    expect(screen.getByText('Submitted via manual entry')).toBeInTheDocument();
  });

  it('copy button calls navigator.clipboard.writeText with reference number', async () => {
    render(<SubmissionConfirmation {...defaultProps} />);

    const copyButton = screen.getByRole('button', { name: /copy reference number/i });
    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('BIR-2026-02-0001');
  });

  it('copy button shows copied state after click, reverts after 2s', async () => {
    render(<SubmissionConfirmation {...defaultProps} />);

    // Before click — "Copy reference number" aria-label
    expect(screen.getByRole('button', { name: /copy reference number/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reference number copied/i })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy reference number/i }));
    });

    // After click — "Reference number copied" aria-label
    expect(screen.getByRole('button', { name: /reference number copied/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copy reference number/i })).not.toBeInTheDocument();

    // After 2s — reverts
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByRole('button', { name: /copy reference number/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reference number copied/i })).not.toBeInTheDocument();
  });

  it('"Submit Another" button calls onSubmitAnother callback', () => {
    const onSubmitAnother = vi.fn();
    render(<SubmissionConfirmation {...defaultProps} onSubmitAnother={onSubmitAnother} />);

    const button = screen.getByRole('button', { name: /submit another/i });
    fireEvent.click(button);

    expect(onSubmitAnother).toHaveBeenCalledOnce();
  });
});
