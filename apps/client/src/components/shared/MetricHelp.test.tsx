import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { MetricHelp } from './MetricHelp';

describe('MetricHelp', () => {
  it('renders info icon for a valid glossary key', () => {
    render(<MetricHelp metric="dashboard.totalExposure" />);
    expect(screen.getByRole('button', { name: /help/i })).toBeInTheDocument();
  });

  it('renders nothing for an invalid glossary key', () => {
    const { container } = render(<MetricHelp metric="nonexistent.key" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows tooltip content on hover', async () => {
    const user = userEvent.setup();
    render(<MetricHelp metric="dashboard.totalExposure" />);

    const trigger = screen.getByRole('button', { name: /help/i });
    await user.hover(trigger);

    // Radix Tooltip renders content in multiple DOM nodes (visible + sr-only)
    const labels = await screen.findAllByText('Total Exposure');
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const descriptions = screen.getAllByText(/combined outstanding balance/i);
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
    const basedOn = screen.getAllByText(/Based on:/);
    expect(basedOn.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts an inline definition prop', async () => {
    const user = userEvent.setup();
    render(
      <MetricHelp
        definition={{
          label: 'Custom Metric',
          description: 'A custom description.',
          derivedFrom: 'Custom data source.',
          guidance: 'Custom guidance.',
        }}
      />,
    );

    const trigger = screen.getByRole('button', { name: /help: custom metric/i });
    await user.hover(trigger);

    // Radix Tooltip renders content in multiple DOM nodes (visible + sr-only)
    const labels = await screen.findAllByText('Custom Metric');
    expect(labels.length).toBeGreaterThanOrEqual(1);
    const descriptions = screen.getAllByText('A custom description.');
    expect(descriptions.length).toBeGreaterThanOrEqual(1);
    const sources = screen.getAllByText(/Custom data source/);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    const guidance = screen.getAllByText(/Custom guidance/);
    expect(guidance.length).toBeGreaterThanOrEqual(1);
  });

  it('has accessible aria-label', () => {
    render(<MetricHelp metric="observation.rate_variance" />);
    expect(screen.getByRole('button', { name: /help: rate variance/i })).toBeInTheDocument();
  });

  it('is keyboard focusable', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>Before</button>
        <span>Label <MetricHelp metric="dashboard.activeLoans" /></span>
      </div>,
    );

    await user.tab();
    await user.tab();
    expect(screen.getByRole('button', { name: /help/i })).toHaveFocus();
  });
});
