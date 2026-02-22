import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MigrationProgressCard, MigrationEmptyState } from './MigrationProgressCard';

describe('MigrationProgressCard', () => {
  const defaultProps = {
    mdaName: 'Ministry of Health',
    mdaCode: 'MOH',
    stage: 'validated' as const,
  };

  it('renders MDA name and code', () => {
    render(<MigrationProgressCard {...defaultProps} />);
    expect(screen.getByText('Ministry of Health')).toBeInTheDocument();
    expect(screen.getByText('MOH')).toBeInTheDocument();
  });

  it('renders stage badge', () => {
    render(<MigrationProgressCard {...defaultProps} />);
    const badges = screen.getAllByText('validated');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders progress indicator with aria values', () => {
    render(<MigrationProgressCard {...defaultProps} />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '4');
    expect(progressbar).toHaveAttribute('aria-valuemax', '6');
    expect(progressbar).toHaveAttribute('aria-label', 'Stage 4 of 6: validated');
  });

  it('renders stage description text', () => {
    render(<MigrationProgressCard {...defaultProps} />);
    expect(screen.getByText(/Stage 4 of 6/)).toBeInTheDocument();
  });

  it('renders all 6 stage dots', () => {
    const { container } = render(<MigrationProgressCard {...defaultProps} />);
    const dots = container.querySelectorAll('.rounded-full.h-2\\.5');
    expect(dots.length).toBe(6);
  });

  it('renders record counts when provided', () => {
    render(
      <MigrationProgressCard
        {...defaultProps}
        recordCounts={{ clean: 100, minor: 20, significant: 5, structural: 2 }}
      />
    );
    expect(screen.getByText('Clean: 100')).toBeInTheDocument();
    expect(screen.getByText('Minor: 20')).toBeInTheDocument();
  });

  it('renders last activity timestamp', () => {
    render(<MigrationProgressCard {...defaultProps} lastActivity="2026-02-19T14:30:00" />);
    expect(screen.getByText('19-Feb-2026, 02:30 PM')).toBeInTheDocument();
  });

  it('handles click', () => {
    const onClick = vi.fn();
    render(<MigrationProgressCard {...defaultProps} onClick={onClick} />);
    const card = screen.getByRole('button');
    fireEvent.click(card);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders pending stage correctly', () => {
    render(<MigrationProgressCard {...defaultProps} stage="pending" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '1');
  });

  it('renders certified stage correctly', () => {
    render(<MigrationProgressCard {...defaultProps} stage="certified" />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '6');
  });
});

describe('MigrationEmptyState', () => {
  it('renders empty state message', () => {
    render(<MigrationEmptyState />);
    expect(screen.getByText('No MDAs in migration pipeline')).toBeInTheDocument();
  });
});
