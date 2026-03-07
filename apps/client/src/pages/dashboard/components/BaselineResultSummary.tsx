import { UI_COPY } from '@vlprs/shared';
import type { BatchBaselineResult } from '@vlprs/shared';

interface BaselineResultSummaryProps {
  result: BatchBaselineResult;
  onViewLoans?: () => void;
}

const CATEGORY_LABELS = UI_COPY.VARIANCE_CATEGORY_LABELS;

export function BaselineResultSummary({ result, onViewLoans }: BaselineResultSummaryProps) {
  return (
    <div className="bg-teal/5 border border-teal/20 rounded-lg p-5">
      <h3 className="text-sm font-semibold text-teal mb-3">
        Baselines Established Successfully
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-text-muted">Records Processed</p>
          <p className="text-lg font-semibold text-text-primary">{result.totalProcessed}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Loans Created</p>
          <p className="text-lg font-semibold text-text-primary">{result.loansCreated}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Ledger Entries</p>
          <p className="text-lg font-semibold text-text-primary">{result.entriesCreated}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Processing Time</p>
          <p className="text-lg font-semibold text-text-primary">
            {result.processingTimeMs < 1000
              ? `${result.processingTimeMs}ms`
              : `${(result.processingTimeMs / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>

      {Object.keys(result.byCategory).length > 0 && (
        <div className="bg-white/60 rounded-lg p-3 mb-4">
          <p className="text-xs font-medium text-text-muted uppercase mb-2">By Category</p>
          <div className="flex flex-wrap gap-3">
            {Object.entries(result.byCategory).map(([cat, count]) => (
              <span key={cat} className="text-xs text-text-secondary">
                {CATEGORY_LABELS[cat] || cat}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {onViewLoans && (
        <button
          type="button"
          onClick={onViewLoans}
          className="text-sm text-teal hover:text-teal-hover underline"
        >
          View Loans
        </button>
      )}
    </div>
  );
}
