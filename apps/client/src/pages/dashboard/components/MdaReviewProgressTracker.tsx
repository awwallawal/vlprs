import { toast } from 'sonner';
import { useMdaReviewProgress, useExtendReviewWindow, useBaselineReviewed } from '@/hooks/useMigration';
import { MetricHelp } from '@/components/shared/MetricHelp';
import type { CountdownStatus } from '@vlprs/shared';
import { CorrectionWorksheetActions } from './CorrectionWorksheetActions';

export function countdownBadge(daysRemaining: number, status: CountdownStatus) {
  const colorClass = status === 'overdue'
    ? 'bg-amber-100 text-amber-800'
    : status === 'warning'
      ? 'bg-amber-100 text-amber-700'
      : 'bg-teal/10 text-teal-dark';

  const label = status === 'overdue'
    ? `Overdue (${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''})`
    : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}

interface MdaReviewProgressTrackerProps {
  uploadId: string;
}

export function MdaReviewProgressTracker({ uploadId }: MdaReviewProgressTrackerProps) {
  const progress = useMdaReviewProgress(uploadId);
  const extendMutation = useExtendReviewWindow(uploadId);
  const baselineMutation = useBaselineReviewed(uploadId);

  if (!progress.data || progress.data.length === 0) {
    return null;
  }

  const handleExtend = async (mdaId: string, mdaName: string) => {
    try {
      await extendMutation.mutateAsync({ mdaId });
      toast.success(`Review window extended for ${mdaName}`);
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to extend window');
    }
  };

  const handleBaselineAll = async () => {
    try {
      const result = await baselineMutation.mutateAsync();
      toast.success(`${result.baselinedCount} record${result.baselinedCount !== 1 ? 's' : ''} baselined`);
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to baseline records');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          MDA Review Progress
          <MetricHelp metric="migration.reviewProgress" />
        </h3>
        <button
          type="button"
          onClick={handleBaselineAll}
          disabled={baselineMutation.isPending}
          className="px-3 py-1.5 text-xs bg-teal text-white rounded hover:bg-teal/90 disabled:opacity-50"
        >
          {baselineMutation.isPending ? 'Processing...' : 'Baseline All Reviewed'}
        </button>
      </div>

      <div className="space-y-2">
        {progress.data.map((mda) => (
          <div key={mda.mdaId} className="bg-white border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{mda.mdaName}</span>
                {countdownBadge(mda.daysRemaining, mda.countdownStatus)}
              </div>
              <span className="text-sm text-text-secondary">
                {mda.reviewed}/{mda.totalFlagged}
                <MetricHelp metric="migration.reviewProgress" />
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-2 mb-2">
              <div
                className="bg-teal h-2 rounded-full transition-all"
                style={{ width: `${mda.completionPct}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>{mda.completionPct}% complete
                <MetricHelp metric="migration.reviewProgress" />
              </span>
              {mda.countdownStatus === 'overdue' && (
                <button
                  type="button"
                  onClick={() => handleExtend(mda.mdaId, mda.mdaName)}
                  disabled={extendMutation.isPending}
                  className="px-2 py-0.5 text-xs border border-amber-300 text-amber-700 rounded hover:bg-amber-50 disabled:opacity-50"
                >
                  Extend
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Correction Worksheet Actions */}
      <div className="border-t border-border pt-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Bulk Correction Tools</h4>
        <CorrectionWorksheetActions uploadId={uploadId} />
      </div>
    </div>
  );
}
