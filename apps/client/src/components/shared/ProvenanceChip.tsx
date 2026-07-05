import { Badge } from '@/components/ui/badge';
import { UI_COPY } from '@vlprs/shared';
import { cn } from '@/lib/utils';

/**
 * Date-basis disclosure chip (Story 17f.2, PO decision D-a 2026-07-04).
 *
 * Renders next to a computed money figure and states the basis of the number:
 * - 'baseline' — computed from migration-baseline records only (gold attention)
 * - 'live'     — includes posted payroll deduction events (teal info)
 * - 'declared' — derives from registered loan terms, not ledger events (neutral)
 * - 'none'     — no ledger events exist for this record (neutral)
 * - 'unknown'  — basis not determinable: render nothing rather than guess
 *
 * Pure disclosure: no computation, data, or authority change. Non-punitive
 * palette only (gold/teal/slate — no red).
 */
export interface ProvenanceBasis {
  basis: 'live' | 'baseline' | 'declared' | 'none' | 'unknown';
  latestEntryPeriod?: string | null;
}

interface ProvenanceChipProps {
  provenance?: ProvenanceBasis | null;
  className?: string;
}

const withPeriod = (template: string, period: string) => template.replace('{period}', period);

export function ProvenanceChip({ provenance, className }: ProvenanceChipProps) {
  if (!provenance || provenance.basis === 'unknown') return null;

  const period = provenance.latestEntryPeriod ?? null;

  let label: string;
  let detail: string;
  let variant: 'review' | 'info' | 'pending';

  switch (provenance.basis) {
    case 'baseline':
      label = period
        ? withPeriod(UI_COPY.PROVENANCE_BASELINE, period)
        : UI_COPY.PROVENANCE_BASELINE_UNDATED;
      detail = UI_COPY.PROVENANCE_BASELINE_DETAIL;
      variant = 'review';
      break;
    case 'live':
      label = period
        ? withPeriod(UI_COPY.PROVENANCE_LIVE, period)
        : UI_COPY.PROVENANCE_LIVE_UNDATED;
      detail = UI_COPY.PROVENANCE_LIVE_DETAIL;
      variant = 'info';
      break;
    case 'declared':
      label = UI_COPY.PROVENANCE_DECLARED;
      detail = UI_COPY.PROVENANCE_DECLARED_DETAIL;
      variant = 'pending';
      break;
    case 'none':
      label = UI_COPY.PROVENANCE_NONE;
      detail = UI_COPY.PROVENANCE_NONE_DETAIL;
      variant = 'pending';
      break;
  }

  return (
    <Badge
      variant={variant}
      className={cn('font-normal whitespace-nowrap', className)}
      title={detail}
      aria-label={`${label}. ${detail}`}
      data-testid="provenance-chip"
      data-basis={provenance.basis}
    >
      {label}
    </Badge>
  );
}
