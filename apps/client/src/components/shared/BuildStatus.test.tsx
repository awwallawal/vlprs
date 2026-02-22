import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildStatus } from './BuildStatus';

describe('BuildStatus', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SPRINT_LABEL', 'Sprint 1 — Foundation & UI Shell');
    vi.stubEnv('VITE_NEXT_MILESTONE', 'Sprint 2 — Loan Computation Engine');
    vi.stubEnv('VITE_DEPLOY_TIMESTAMP', '');
  });

  it('renders sprint label', () => {
    render(<BuildStatus />);
    expect(screen.getByText('Sprint 1 — Foundation & UI Shell')).toBeInTheDocument();
  });

  it('renders next milestone', () => {
    render(<BuildStatus />);
    expect(screen.getByText(/Sprint 2 — Loan Computation Engine/)).toBeInTheDocument();
  });

  it('renders deploy timestamp when provided', () => {
    vi.stubEnv('VITE_DEPLOY_TIMESTAMP', '2026-02-20T10:00:00Z');
    render(<BuildStatus />);
    expect(screen.getByText(/Deployed:/)).toBeInTheDocument();
  });

  it('hides deploy timestamp when empty', () => {
    render(<BuildStatus />);
    expect(screen.queryByText(/Deployed:/)).not.toBeInTheDocument();
  });
});
