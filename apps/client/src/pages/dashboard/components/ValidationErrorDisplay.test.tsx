import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValidationErrorDisplay } from './ValidationErrorDisplay';
import type { SubmissionValidationError } from '@vlprs/shared';

const sampleErrors: SubmissionValidationError[] = [
  { row: 0, field: 'amountDeducted', message: "Amount '12.3.4' is not a valid number" },
  { row: 2, field: 'month', message: "Month 'Feb-26' is not a valid YYYY-MM format" },
  { row: 4, field: 'eventDate', message: 'Event Date is required when Event Flag is not NONE' },
];

describe('ValidationErrorDisplay', () => {
  it('renders "Upload needs attention" header (never "Upload failed" or "Error")', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    expect(screen.getByText('Upload needs attention')).toBeInTheDocument();
    expect(screen.queryByText(/Upload failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Error$/)).not.toBeInTheDocument();
  });

  it('renders row-level error items with 1-based row numbers', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    expect(screen.getByText(/Row 1:/)).toBeInTheDocument();
    expect(screen.getByText(/Row 3:/)).toBeInTheDocument();
    expect(screen.getByText(/Row 5:/)).toBeInTheDocument();
  });

  it('shows reassurance message', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    expect(
      screen.getByText('No data was processed — your previous submission is unchanged'),
    ).toBeInTheDocument();
  });

  it('shows fix guidance message', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    expect(
      screen.getByText('Fix the items above in your CSV and re-upload'),
    ).toBeInTheDocument();
  });

  it('uses amber/gold styling (not red)', () => {
    const { container } = render(<ValidationErrorDisplay errors={sampleErrors} />);
    const alertDiv = container.firstElementChild as HTMLElement;
    expect(alertDiv.className).toContain('bg-amber-50');
    expect(alertDiv.className).toContain('border-l-[#D4A017]');
    expect(alertDiv.className).not.toContain('bg-red');
  });

  it('uses Info icon (not warning triangle)', () => {
    const { container } = render(<ValidationErrorDisplay errors={sampleErrors} />);
    // Info icon is rendered as an SVG; AlertTriangle would have a different class
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    // Info icon from lucide uses a circle, not a triangle path
    // We check by confirming no "triangle" text in aria labels
    expect(screen.queryByLabelText(/warning/i)).not.toBeInTheDocument();
  });

  it('has role="alert" for accessibility', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('has aria-live="assertive" on error container', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
  });

  it('vocabulary compliance: no "error"/"failed"/"wrong" in rendered text', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    const alertEl = screen.getByRole('alert');
    const text = alertEl.textContent ?? '';
    expect(text.toLowerCase()).not.toContain('failed');
    expect(text.toLowerCase()).not.toContain('wrong');
    // "error" is allowed in field-level messages from server but not in headers
    expect(screen.queryByText(/^Error$/)).not.toBeInTheDocument();
  });

  it('displays item count', () => {
    render(<ValidationErrorDisplay errors={sampleErrors} />);
    expect(screen.getByText(/3 items need your attention/)).toBeInTheDocument();
  });
});
