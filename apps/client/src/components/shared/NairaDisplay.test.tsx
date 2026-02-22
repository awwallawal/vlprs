import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NairaDisplay } from './NairaDisplay';

describe('NairaDisplay', () => {
  it('renders formatted Naira amount', () => {
    render(<NairaDisplay amount="1840000.00" />);
    expect(screen.getByText('₦1,840,000.00')).toBeInTheDocument();
  });

  it('renders hero variant with correct classes', () => {
    render(<NairaDisplay amount="1000" variant="hero" />);
    const el = screen.getByText('₦1,000.00');
    expect(el).toHaveClass('text-4xl', 'font-bold', 'font-mono');
  });

  it('renders table variant with correct classes', () => {
    render(<NairaDisplay amount="500" variant="table" />);
    const el = screen.getByText('₦500.00');
    expect(el).toHaveClass('text-sm', 'font-mono');
  });

  it('renders compact variant stripping .00 for round numbers', () => {
    render(<NairaDisplay amount="1000" variant="compact" />);
    expect(screen.getByText('₦1,000')).toBeInTheDocument();
  });

  it('renders compact variant keeping decimals for non-round', () => {
    render(<NairaDisplay amount="1000.50" variant="compact" />);
    expect(screen.getByText('₦1,000.50')).toBeInTheDocument();
  });

  it('renders zero amount', () => {
    render(<NairaDisplay amount="0" />);
    expect(screen.getByText('₦0.00')).toBeInTheDocument();
  });

  it('renders negative amount', () => {
    render(<NairaDisplay amount="-500.50" />);
    expect(screen.getByText('-₦500.50')).toBeInTheDocument();
  });

  it('has aria-label with formatted amount', () => {
    render(<NairaDisplay amount="2418350000" />);
    const el = screen.getByLabelText('₦2,418,350,000.00');
    expect(el).toBeInTheDocument();
  });

  it('uses tabular-nums font-variant-numeric', () => {
    render(<NairaDisplay amount="100" />);
    const el = screen.getByText('₦100.00');
    expect(el.style.fontVariantNumeric).toBe('tabular-nums');
  });
});
