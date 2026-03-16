import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NonPunitiveVarianceDisplay } from './NonPunitiveVarianceDisplay';
import type { ComparisonRow } from '@vlprs/shared';

const sampleRows: ComparisonRow[] = [
  {
    staffId: '3301',
    declaredAmount: '14166.67',
    expectedAmount: '18333.33',
    difference: '-4166.66',
    category: 'variance',
    explanation: 'Declared ₦14,166.67 vs expected ₦18,333.33 — difference of ₦4,166.66',
  },
  {
    staffId: '3302',
    declaredAmount: '8500.00',
    expectedAmount: '8333.33',
    difference: '166.67',
    category: 'minor_variance',
    explanation: 'Declared ₦8,500.00 vs expected ₦8,333.33 — difference of ₦166.67',
  },
];

function renderVarianceDisplay(props: Partial<Parameters<typeof NonPunitiveVarianceDisplay>[0]> = {}) {
  return render(
    <NonPunitiveVarianceDisplay rows={sampleRows} {...props} />,
  );
}

describe('NonPunitiveVarianceDisplay', () => {
  it('renders variance rows count in collapsed state', () => {
    renderVarianceDisplay();
    expect(screen.getByText('2 variances')).toBeInTheDocument();
  });

  it('uses info icon, never warning triangle', () => {
    renderVarianceDisplay();
    // Info icons are present (lucide-react renders SVGs with class)
    const svgs = document.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    // No warning triangle icon should be present — all icons should be info circle
    expect(screen.queryByText('⚠')).not.toBeInTheDocument();
  });

  it('uses teal colour for icons (not red)', () => {
    renderVarianceDisplay();
    // Check that the info icon uses teal colour class
    const icons = document.querySelectorAll('.text-\\[\\#0D7377\\]');
    expect(icons.length).toBeGreaterThan(0);
    // No red classes
    const redIcons = document.querySelectorAll('.text-red-500, .text-red-600, .text-\\[\\#DC2626\\]');
    expect(redIcons.length).toBe(0);
  });

  it('expand/collapse toggles aria-expanded', async () => {
    const user = userEvent.setup();
    renderVarianceDisplay();

    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows "No action required" note when expanded', async () => {
    const user = userEvent.setup();
    renderVarianceDisplay();

    await user.click(screen.getByRole('button'));
    expect(
      screen.getByText('No action required from you. Variances are logged for reconciliation.'),
    ).toBeInTheDocument();
  });

  it('never renders "error", "mistake", or "fault" text', async () => {
    const user = userEvent.setup();
    renderVarianceDisplay();
    await user.click(screen.getByRole('button'));

    const allText = document.body.textContent?.toLowerCase() ?? '';
    // Check for these specific punitive words (not as substrings of other words)
    expect(allText).not.toMatch(/\berror\b/);
    expect(allText).not.toMatch(/\bmistake\b/);
    expect(allText).not.toMatch(/\bfault\b/);
  });

  it('renders NairaDisplay for amounts when expanded', async () => {
    const user = userEvent.setup();
    renderVarianceDisplay();
    await user.click(screen.getByRole('button'));

    // NairaDisplay renders amounts with font-mono class
    const monoElements = document.querySelectorAll('.font-mono');
    expect(monoElements.length).toBeGreaterThan(0);
  });

  it('renders compact display for minor variant', async () => {
    const user = userEvent.setup();
    render(<NonPunitiveVarianceDisplay rows={sampleRows} variant="minor" />);

    await user.click(screen.getByRole('button'));
    // Minor variant shows staff ID and explanation on same line, no grid
    expect(screen.getByText('3301')).toBeInTheDocument();
    expect(screen.getByText('3302')).toBeInTheDocument();
  });

  it('renders count only for summary variant', () => {
    render(<NonPunitiveVarianceDisplay rows={sampleRows} variant="summary" />);
    expect(screen.getByText('2 variances')).toBeInTheDocument();
    // No expand button in summary mode
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides "No action required" note when showNoActionNote is false', async () => {
    const user = userEvent.setup();
    render(<NonPunitiveVarianceDisplay rows={sampleRows} showNoActionNote={false} />);
    await user.click(screen.getByRole('button'));
    expect(
      screen.queryByText('No action required from you. Variances are logged for reconciliation.'),
    ).not.toBeInTheDocument();
  });

  it('renders nothing for empty rows', () => {
    const { container } = render(
      <NonPunitiveVarianceDisplay rows={[]} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
