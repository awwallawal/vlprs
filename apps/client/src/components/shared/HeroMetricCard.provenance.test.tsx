import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HeroMetricCard } from './HeroMetricCard';

describe('HeroMetricCard provenance (Story 17f.2 review fix)', () => {
  it('renders the chip for a renderable basis', () => {
    render(
      <HeroMetricCard
        label="Outstanding Receivables"
        value="1000000.00"
        format="currency"
        provenance={{ basis: 'baseline', latestEntryPeriod: '2026-01' }}
      />,
    );
    expect(screen.getByTestId('provenance-chip')).toHaveTextContent('As at baseline 2026-01');
  });

  it("mounts no empty spacer for basis 'unknown' (chip renders nothing)", () => {
    const { container } = render(
      <HeroMetricCard
        label="Aggregated Figure"
        value="1000000.00"
        format="currency"
        provenance={{ basis: 'unknown', latestEntryPeriod: null }}
      />,
    );
    expect(screen.queryByTestId('provenance-chip')).not.toBeInTheDocument();
    // No empty wrapper div left behind to misalign card heights
    expect(container.querySelectorAll('div.mb-1:empty')).toHaveLength(0);
  });

  it('renders no chip when provenance is absent', () => {
    render(<HeroMetricCard label="Active Loans" value={12} format="count" />);
    expect(screen.queryByTestId('provenance-chip')).not.toBeInTheDocument();
  });
});
