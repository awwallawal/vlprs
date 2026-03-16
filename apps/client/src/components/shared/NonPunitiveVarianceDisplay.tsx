import { useState } from 'react';
import { Info } from 'lucide-react';
import { NairaDisplay } from './NairaDisplay';
import { cn } from '@/lib/utils';
import { VOCABULARY, UI_COPY } from '@vlprs/shared';
import type { ComparisonRow } from '@vlprs/shared';

interface NonPunitiveVarianceDisplayProps {
  rows: ComparisonRow[];
  variant?: 'minor' | 'standard' | 'summary';
  className?: string;
  showNoActionNote?: boolean;
}

export function NonPunitiveVarianceDisplay({
  rows,
  variant = 'standard',
  className,
  showNoActionNote = true,
}: NonPunitiveVarianceDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) return null;

  const panelId = 'variance-detail-panel';

  // Summary variant: count-only inline display
  if (variant === 'summary') {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-sm text-text-secondary', className)}>
        <Info className="h-4 w-4 text-[#0D7377] shrink-0" aria-hidden="true" />
        <span>{rows.length} {rows.length === 1 ? 'variance' : 'variances'}</span>
      </span>
    );
  }

  return (
    <div className={cn('rounded-lg bg-slate-50 p-4', className)}>
      {/* Expand/collapse toggle */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex items-center gap-2 w-full text-left"
      >
        <Info className="h-5 w-5 text-[#0D7377] shrink-0" aria-hidden="true" />
        <span className="text-sm font-medium text-text-primary">
          {rows.length} {rows.length === 1 ? 'variance' : 'variances'}
        </span>
        <span className="ml-auto text-xs text-text-muted">
          {expanded ? UI_COPY.COMPARISON_COLLAPSE_DETAIL : UI_COPY.COMPARISON_EXPAND_DETAIL}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div id={panelId} className="mt-3 space-y-2">
          {rows.map((row, idx) => (
            <div
              key={`${row.staffId}-${idx}`}
              className="rounded border border-slate-200 bg-white p-3"
              aria-label={`Information: variance of ${row.difference}`}
            >
              {variant === 'minor' ? (
                /* Minor variant: compact single-line display */
                <div className="flex items-center gap-3 text-sm">
                  <Info className="h-4 w-4 text-[#0D7377] shrink-0" aria-hidden="true" />
                  <span className="font-mono text-text-primary">{row.staffId}</span>
                  <span className="text-text-secondary">{row.explanation}</span>
                </div>
              ) : (
                /* Standard variant: full detail */
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-[#0D7377] shrink-0" aria-hidden="true" />
                    <span className="text-sm font-medium text-text-primary">
                      Staff ID: {row.staffId}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="block text-xs text-text-muted">Declared</span>
                      <NairaDisplay amount={row.declaredAmount} variant="table" />
                    </div>
                    <div>
                      <span className="block text-xs text-text-muted">Expected</span>
                      <NairaDisplay amount={row.expectedAmount} variant="table" />
                    </div>
                    <div>
                      <span className="block text-xs text-text-muted">Difference</span>
                      <NairaDisplay amount={row.difference} variant="table" />
                    </div>
                  </div>
                  <p className="text-xs text-text-secondary">{row.explanation}</p>
                </div>
              )}
            </div>
          ))}

          {/* No action required note */}
          {showNoActionNote && (
            <p className="text-xs text-text-muted mt-2 pt-2 border-t border-slate-200">
              {VOCABULARY.COMPARISON_NO_ACTION_REQUIRED}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
