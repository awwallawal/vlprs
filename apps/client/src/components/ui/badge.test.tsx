import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders with default variant', () => {
    render(<Badge>Default</Badge>);
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('renders review variant with gold styling', () => {
    render(<Badge variant="review">Review</Badge>);
    const badge = screen.getByText('Review');
    expect(badge).toHaveClass('bg-gold-50', 'text-gold-dark');
  });

  it('renders info variant with teal styling', () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText('Info');
    expect(badge).toHaveClass('bg-teal-50', 'text-teal');
  });

  it('renders complete variant with green styling', () => {
    render(<Badge variant="complete">Complete</Badge>);
    const badge = screen.getByText('Complete');
    expect(badge).toHaveClass('bg-green-50', 'text-success');
  });

  it('renders pending variant with grey styling', () => {
    render(<Badge variant="pending">Pending</Badge>);
    const badge = screen.getByText('Pending');
    expect(badge).toHaveClass('bg-slate-100', 'text-text-secondary');
  });

  it('renders variance variant with teal border and grey bg', () => {
    render(<Badge variant="variance">Variance</Badge>);
    const badge = screen.getByText('Variance');
    expect(badge).toHaveClass('bg-variance-bg', 'text-teal');
  });

  it('applies custom className alongside variant', () => {
    render(<Badge variant="review" className="ml-2">Custom</Badge>);
    const badge = screen.getByText('Custom');
    expect(badge).toHaveClass('ml-2');
    expect(badge).toHaveClass('bg-gold-50');
  });
});
