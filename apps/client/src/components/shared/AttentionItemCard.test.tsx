import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttentionItemCard, AttentionEmptyState } from './AttentionItemCard';
import { formatDateTime } from '@/lib/formatters';

describe('AttentionItemCard', () => {
  const defaultProps = {
    description: 'Submission pending, 3 days past due',
    mdaName: 'Ministry of Works',
    category: 'review' as const,
    timestamp: '2026-02-19T14:30:00Z',
  };

  it('renders description and MDA name', () => {
    render(<AttentionItemCard {...defaultProps} />);
    expect(screen.getByText('Submission pending, 3 days past due')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Works')).toBeInTheDocument();
  });

  it('renders info icon (not warning triangle)', () => {
    const { container } = render(<AttentionItemCard {...defaultProps} />);
    // Lucide Info icon renders an SVG - verify it exists
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    // Should NOT contain any AlertTriangle text
    expect(container.innerHTML).not.toContain('alert-triangle');
  });

  it('renders category badge', () => {
    render(<AttentionItemCard {...defaultProps} />);
    expect(screen.getByText('review')).toBeInTheDocument();
  });

  it('renders formatted timestamp', () => {
    render(<AttentionItemCard {...defaultProps} />);
    const expected = formatDateTime('2026-02-19T14:30:00Z');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders teal left border when isNew is true', () => {
    const { container } = render(<AttentionItemCard {...defaultProps} isNew />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-l-');
  });

  it('handles click', () => {
    const onClick = vi.fn();
    render(<AttentionItemCard {...defaultProps} onClick={onClick} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders info badge variant', () => {
    render(<AttentionItemCard {...defaultProps} category="info" />);
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('renders complete badge variant', () => {
    render(<AttentionItemCard {...defaultProps} category="complete" />);
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('uses non-punitive language (no warning words)', () => {
    const { container } = render(<AttentionItemCard {...defaultProps} />);
    const text = container.textContent || '';
    expect(text).not.toContain('Error');
    expect(text).not.toContain('Failed');
    expect(text).not.toContain('Warning');
  });
});

describe('AttentionEmptyState', () => {
  it('renders empty state message', () => {
    render(<AttentionEmptyState />);
    expect(screen.getByText('No attention items — all systems normal')).toBeInTheDocument();
  });

  it('renders green checkmark icon', () => {
    const { container } = render(<AttentionEmptyState />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
