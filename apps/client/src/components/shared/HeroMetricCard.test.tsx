import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HeroMetricCard } from './HeroMetricCard';

// Mock matchMedia for reduced motion tests
function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('HeroMetricCard', () => {
  beforeEach(() => {
    mockMatchMedia(true); // default to reduced motion for deterministic tests
  });

  it('renders currency format with compact NairaDisplay', () => {
    render(<HeroMetricCard label="Total Exposure" value="2418350000" format="currency" />);
    expect(screen.getByText('Total Exposure')).toBeInTheDocument();
    // Hero cards use compact notation with full value in tooltip
    expect(screen.getByText('₦2.42B')).toBeInTheDocument();
    expect(screen.getByText('₦2.42B')).toHaveAttribute('title', '₦2,418,350,000.00');
  });

  it('renders count format', () => {
    render(<HeroMetricCard label="Active Loans" value={3147} format="count" />);
    expect(screen.getByText('Active Loans')).toBeInTheDocument();
    expect(screen.getByText('3,147')).toBeInTheDocument();
  });

  it('renders percentage format', () => {
    render(<HeroMetricCard label="Coverage" value={94.2} format="percentage" />);
    expect(screen.getByText('94.2%')).toBeInTheDocument();
  });

  it('renders skeleton loading state', () => {
    const { container } = render(
      <HeroMetricCard label="Test" value={0} format="count" isPending />,
    );
    // Skeleton elements render with animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders trend indicator for up', () => {
    render(
      <HeroMetricCard
        label="Recovery"
        value="48250000"
        format="currency"
        trend={{ direction: 'up', label: '+2.1% vs last month' }}
      />,
    );
    expect(screen.getByText('\u2191')).toBeInTheDocument();
    expect(screen.getByText('+2.1% vs last month')).toBeInTheDocument();
  });

  it('renders trend indicator for down', () => {
    render(
      <HeroMetricCard
        label="Exposure"
        value="100"
        format="count"
        trend={{ direction: 'down', label: '-5 from last week' }}
      />,
    );
    expect(screen.getByText('\u2193')).toBeInTheDocument();
  });

  it('renders trend indicator for flat', () => {
    render(
      <HeroMetricCard
        label="Fund"
        value="100"
        format="count"
        trend={{ direction: 'flat', label: 'No change' }}
      />,
    );
    expect(screen.getByText('\u2192')).toBeInTheDocument();
  });

  it('handles click and has role="link" when onClick provided', () => {
    const onClick = vi.fn();
    render(
      <HeroMetricCard label="Active Loans" value={3147} format="count" onClick={onClick} />,
    );
    const card = screen.getByRole('link');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard Enter key when onClick provided', () => {
    const onClick = vi.fn();
    render(
      <HeroMetricCard label="Active Loans" value={3147} format="count" onClick={onClick} />,
    );
    const card = screen.getByRole('link');
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard Space key when onClick provided', () => {
    const onClick = vi.fn();
    render(
      <HeroMetricCard label="Active Loans" value={3147} format="count" onClick={onClick} />,
    );
    const card = screen.getByRole('link');
    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has appropriate aria-label when clickable', () => {
    const onClick = vi.fn();
    render(
      <HeroMetricCard label="Active Loans" value={3147} format="count" onClick={onClick} />,
    );
    const card = screen.getByRole('link');
    expect(card.getAttribute('aria-label')).toContain('Click to view breakdown');
  });

  it('does not have role="link" when not clickable', () => {
    render(<HeroMetricCard label="Active Loans" value={3147} format="count" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
