import { UI_COPY } from '@vlprs/shared';

interface BaselineConfirmationDialogProps {
  recordCount: number;
  byCategory: Record<string, number>;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const CATEGORY_LABELS = UI_COPY.VARIANCE_CATEGORY_LABELS;

export function BaselineConfirmationDialog({
  recordCount,
  byCategory,
  isLoading,
  onConfirm,
  onCancel,
}: BaselineConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-lg border border-border shadow-lg max-w-md w-full mx-4 p-6">
        <h3 className="text-base font-semibold text-text-primary mb-3">
          Accept as Declared — Establish Baselines
        </h3>

        <p className="text-sm text-text-secondary mb-4">
          You are about to establish baselines for <strong>{recordCount}</strong> record{recordCount !== 1 ? 's' : ''}.
          All values will be recorded as declared by the MDA.
        </p>

        {Object.keys(byCategory).length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-xs font-medium text-text-muted uppercase mb-2">Breakdown by Category</p>
            <div className="space-y-1">
              {Object.entries(byCategory).map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{CATEGORY_LABELS[cat] || cat}</span>
                  <span className="font-medium text-text-primary">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-text-muted mb-5">
          Variances are noted for review — they do not imply fault. No retroactive corrections will be applied.
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
            {isLoading ? 'Establishing...' : 'Confirm — Establish Baselines'}
          </button>
        </div>
      </div>
    </div>
  );
}
