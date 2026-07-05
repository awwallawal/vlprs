import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProvenanceChip } from './ProvenanceChip';

describe('ProvenanceChip (Story 17f.2)', () => {
  it('renders baseline basis with period', () => {
    render(<ProvenanceChip provenance={{ basis: 'baseline', latestEntryPeriod: '2026-01' }} />);
    const chip = screen.getByTestId('provenance-chip');
    expect(chip).toHaveTextContent('As at baseline 2026-01');
    expect(chip).toHaveAttribute('data-basis', 'baseline');
  });

  it('renders undated baseline when no period is known', () => {
    render(<ProvenanceChip provenance={{ basis: 'baseline', latestEntryPeriod: null }} />);
    expect(screen.getByTestId('provenance-chip')).toHaveTextContent('As at migration baseline');
  });

  it('renders live basis with period', () => {
    render(<ProvenanceChip provenance={{ basis: 'live', latestEntryPeriod: '2026-06' }} />);
    expect(screen.getByTestId('provenance-chip')).toHaveTextContent('Live through 2026-06');
  });

  it('renders declared basis', () => {
    render(<ProvenanceChip provenance={{ basis: 'declared', latestEntryPeriod: null }} />);
    expect(screen.getByTestId('provenance-chip')).toHaveTextContent('From registered loan terms');
  });

  it('renders the no-events state', () => {
    render(<ProvenanceChip provenance={{ basis: 'none', latestEntryPeriod: null }} />);
    expect(screen.getByTestId('provenance-chip')).toHaveTextContent('No financial events recorded');
  });

  it('renders nothing for unknown basis — never guesses', () => {
    render(<ProvenanceChip provenance={{ basis: 'unknown', latestEntryPeriod: null }} />);
    expect(screen.queryByTestId('provenance-chip')).not.toBeInTheDocument();
  });

  it('renders nothing when provenance is absent', () => {
    render(<ProvenanceChip />);
    expect(screen.queryByTestId('provenance-chip')).not.toBeInTheDocument();
  });

  it('exposes the explanation for assistive technology', () => {
    render(<ProvenanceChip provenance={{ basis: 'baseline', latestEntryPeriod: '2026-01' }} />);
    const chip = screen.getByTestId('provenance-chip');
    expect(chip.getAttribute('aria-label')).toContain('As at baseline 2026-01');
    expect(chip.getAttribute('title')).toContain('migration baseline records');
  });

  it('uses only non-punitive variants (no destructive/red)', () => {
    render(<ProvenanceChip provenance={{ basis: 'baseline', latestEntryPeriod: '2026-01' }} />);
    const chip = screen.getByTestId('provenance-chip');
    expect(chip.className).not.toContain('destructive');
  });
});
