import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttentionItemCard, AttentionEmptyState } from './AttentionItemCard';
import { formatDateTime } from '@/lib/formatters';

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('AttentionItemCard', () => {
  const defaultProps = {
    description: 'Submission pending, 3 days past due',
    mdaName: 'Ministry of Works',
    category: 'review' as const,
    timestamp: '2026-02-19T14:30:00Z',
  };

  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders description and MDA name', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} />);
    expect(screen.getByText('Submission pending, 3 days past due')).toBeInTheDocument();
    expect(screen.getByText('Ministry of Works')).toBeInTheDocument();
  });

  it('renders icon (not warning triangle)', () => {
    const { container } = renderWithRouter(<AttentionItemCard {...defaultProps} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain('alert-triangle');
  });

  it('renders category badge', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} />);
    expect(screen.getByText('review')).toBeInTheDocument();
  });

  it('renders formatted timestamp', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} />);
    const expected = formatDateTime('2026-02-19T14:30:00Z');
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('renders teal left border when isNew is true', () => {
    const { container } = renderWithRouter(<AttentionItemCard {...defaultProps} isNew />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain('border-l-');
  });

  it('navigates on click when drillDownUrl is provided', () => {
    renderWithRouter(
      <AttentionItemCard {...defaultProps} drillDownUrl="/dashboard/loans?filter=overdue" />,
    );
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/loans?filter=overdue');
  });

  it('shows chevron icon when drillDownUrl is provided', () => {
    const { container } = renderWithRouter(
      <AttentionItemCard {...defaultProps} drillDownUrl="/dashboard/loans?filter=overdue" />,
    );
    // Should have at least 2 SVGs: the type icon + chevron
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render as button when no drillDownUrl', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders count badge when count is provided', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} count={12} />);
    expect(screen.getByText('12 loans')).toBeInTheDocument();
  });

  it('renders singular "loan" for count of 1', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} count={1} />);
    expect(screen.getByText('1 loan')).toBeInTheDocument();
  });

  it('renders amount via NairaDisplay when provided', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} amount="45000000.00" />);
    // NairaDisplay renders the amount — just verify it appears
    const amountEl = screen.getByLabelText(/45/);
    expect(amountEl).toBeInTheDocument();
  });

  it('renders appropriate icon per attention item type', () => {
    const { container } = renderWithRouter(
      <AttentionItemCard {...defaultProps} type="quick_win" />,
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders "records" for missing_staff_id type count', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} type="missing_staff_id" count={371} />);
    expect(screen.getByText('371 records')).toBeInTheDocument();
  });

  it('renders singular "record" for missing_staff_id type with count 1', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} type="missing_staff_id" count={1} />);
    expect(screen.getByText('1 record')).toBeInTheDocument();
  });

  it('sets aria-label on navigable cards', () => {
    renderWithRouter(
      <AttentionItemCard {...defaultProps} drillDownUrl="/dashboard/loans?filter=overdue" />,
    );
    const card = screen.getByRole('button');
    expect(card).toHaveAttribute('aria-label', 'Ministry of Works: Submission pending, 3 days past due');
  });

  it('does not set aria-label on non-navigable cards', () => {
    const { container } = renderWithRouter(<AttentionItemCard {...defaultProps} />);
    const card = container.firstChild as HTMLElement;
    expect(card).not.toHaveAttribute('aria-label');
  });

  it('renders info badge variant', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} category="info" />);
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('renders complete badge variant', () => {
    renderWithRouter(<AttentionItemCard {...defaultProps} category="complete" />);
    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('uses non-punitive language (no warning words)', () => {
    const { container } = renderWithRouter(<AttentionItemCard {...defaultProps} />);
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
