import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ExceptionQueueRow, ExceptionEmptyState } from './ExceptionQueueRow';

describe('ExceptionQueueRow', () => {
  const defaultProps = {
    priority: 'high' as const,
    category: 'over_deduction',
    staffName: 'Adeyemi Ogunlade',
    staffId: 'OYO-2847',
    mdaName: 'Ministry of Health',
    description: 'Monthly deduction exceeds approved schedule by ₦12,500',
    createdAt: '2026-02-19T14:30:00Z',
  };

  it('renders MDA name and description', () => {
    render(<ExceptionQueueRow {...defaultProps} />);
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
    expect(screen.getByText(/Monthly deduction exceeds/)).toBeInTheDocument();
  });

  it('renders priority badge for high', () => {
    render(<ExceptionQueueRow {...defaultProps} />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders priority badge for medium', () => {
    render(<ExceptionQueueRow {...defaultProps} priority="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders priority badge for low', () => {
    render(<ExceptionQueueRow {...defaultProps} priority="low" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders category badge with underscores replaced', () => {
    render(<ExceptionQueueRow {...defaultProps} />);
    expect(screen.getByText('over deduction')).toBeInTheDocument();
  });

  it('renders staff name and ID', () => {
    render(<ExceptionQueueRow {...defaultProps} />);
    expect(screen.getByText('Adeyemi Ogunlade (OYO-2847)')).toBeInTheDocument();
  });

  it('renders formatted timestamp', () => {
    // Use non-UTC timestamp to avoid timezone offset issues
    const props = { ...defaultProps, createdAt: '2026-02-19T14:30:00' };
    render(<ExceptionQueueRow {...props} />);
    expect(screen.getByText('19-Feb-2026, 02:30 PM')).toBeInTheDocument();
  });

  it('renders resolved state with strikethrough', () => {
    const { container } = render(<ExceptionQueueRow {...defaultProps} status="resolved" />);
    const strikethroughs = container.querySelectorAll('.line-through');
    expect(strikethroughs.length).toBeGreaterThan(0);
  });

  it('renders resolved state with muted opacity', () => {
    const { container } = render(<ExceptionQueueRow {...defaultProps} status="resolved" />);
    expect((container.firstChild as HTMLElement).className).toContain('opacity-60');
  });

  it('handles click', () => {
    const onClick = vi.fn();
    render(<ExceptionQueueRow {...defaultProps} onClick={onClick} />);
    const row = screen.getByRole('button');
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has hover highlight when clickable', () => {
    const onClick = vi.fn();
    const { container } = render(<ExceptionQueueRow {...defaultProps} onClick={onClick} />);
    expect((container.firstChild as HTMLElement).className).toContain('hover:bg-surface');
  });
});

describe('ExceptionEmptyState', () => {
  it('renders empty state message', () => {
    render(<ExceptionEmptyState />);
    expect(screen.getByText('No exceptions — all issues resolved')).toBeInTheDocument();
  });

  it('renders green checkmark icon', () => {
    const { container } = render(<ExceptionEmptyState />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });
});
