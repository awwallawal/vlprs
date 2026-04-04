import { UI_COPY } from '@vlprs/shared';

interface BaselineConfirmationDialogProps {
  recordCount: number;
  byCategory: Record<string, number>;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CATEGORY_LABELS = UI_COPY.VARIANCE_CATEGORY_LABELS;

const AUTO_BASELINE_CATEGORIES = new Set(['clean', 'minor_variance']);

export function BaselineConfirmationDialog({
  recordCount,
  byCategory,
  isLoading,
  onConfirm,
  onCancel,
}: BaselineConfirmationDialogProps) {
  // Partition into auto-baseline vs flagged-for-review
  const autoBaselineCount = Object.entries(byCategory)
    .filter(([cat]) => AUTO_BASELINE_CATEGORIES.has(cat))
    .reduce((sum, [, count]) => sum + count, 0);
  const flagForReviewCount = Object.entries(byCategory)
    .filter(([cat]) => !AUTO_BASELINE_CATEGORIES.has(cat))
    .reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg border border-border shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-base font-semibold text-text-primary mb-3">
          Establish Baselines — Selective Processing
        </h3>

        <p className="text-sm text-text-secondary mb-4">
          <strong>{recordCount}</strong> record{recordCount !== 1 ? 's' : ''} will be processed selectively:
        </p>

        {/* Selective breakdown */}
        <div className="space-y-3 mb-4">
          {autoBaselineCount > 0 && (
            <div className="bg-teal/5 border border-teal/20 rounded-lg p-3">
              <p className="text-sm font-medium text-teal-dark mb-1">
                {autoBaselineCount} record{autoBaselineCount !== 1 ? 's' : ''} will be baselined immediately
              </p>
              <p className="text-xs text-text-muted">Clean + Minor Variance — values accepted as declared.</p>
              <div className="mt-2 space-y-0.5">
                {Object.entries(byCategory)
                  .filter(([cat]) => AUTO_BASELINE_CATEGORIES.has(cat))
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {flagForReviewCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-800 mb-1">
                {flagForReviewCount} record{flagForReviewCount !== 1 ? 's' : ''} will be flagged for MDA review
              </p>
              <p className="text-xs text-text-muted">
                Significant Variance or higher — MDA officers will be asked to review and provide context within 14 days.
              </p>
              <div className="mt-2 space-y-0.5">
                {Object.entries(byCategory)
                  .filter(([cat]) => !AUTO_BASELINE_CATEGORIES.has(cat))
                  .map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between text-xs text-text-secondary">
                      <span>{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-text-muted mb-5">
          Variances are noted for review — they do not imply fault. MDA officers will have 14 days to review flagged records.
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-teal text-white rounded-lg hover:bg-teal-hover disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Confirm — Establish Baselines'}
          </button>
        </div>
      </div>
    </div>
  );
}
