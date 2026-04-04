import { useListMigrations, useFlaggedRecords } from '@/hooks/useMigration';
import { MetricHelp } from '@/components/shared/MetricHelp';
import type { CountdownStatus } from '@vlprs/shared';
import { countdownBadge } from './MdaReviewProgressTracker';

interface MdaReviewSectionProps {
  onNavigateToReview?: () => void;
}

export function MdaReviewSection({ onNavigateToReview }: MdaReviewSectionProps) {
  // Find the most recent upload with flagged records
  const uploads = useListMigrations({ limit: 1 });
  const latestUploadId = uploads.data?.data?.[0]?.id ?? '';

  const flagged = useFlaggedRecords(latestUploadId, { status: 'pending', limit: 5 });

  if (!latestUploadId || !flagged.data || flagged.data.total === 0) {
    return null;
  }

  const { records, total } = flagged.data;
  const firstRecord = records[0];
  const deadline = firstRecord ? new Date(firstRecord.reviewWindowDeadline) : null;
  const { daysRemaining, countdownStatus } = firstRecord
    ? { daysRemaining: firstRecord.daysRemaining, countdownStatus: firstRecord.countdownStatus }
    : { daysRemaining: 0, countdownStatus: 'normal' as CountdownStatus };

  return (
    <section aria-label="Migration records requiring review" className="bg-white border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Migration Records Requiring Your Review
          <MetricHelp metric="migration.reviewWindow" />
        </h3>
        {countdownBadge(daysRemaining, countdownStatus)}
      </div>

      <div className="flex items-center gap-6 mb-4">
        <div>
          <p className="text-2xl font-bold text-text-primary">{total}</p>
          <p className="text-xs text-text-muted">Records pending</p>
        </div>
        {deadline && (
          <div>
            <p className="text-sm font-medium text-text-secondary">{deadline.toLocaleDateString()}</p>
            <p className="text-xs text-text-muted">Review deadline</p>
          </div>
        )}
      </div>

      {onNavigateToReview && (
        <button
          type="button"
          onClick={onNavigateToReview}
          className="text-sm text-teal hover:text-teal-hover font-medium underline"
        >
          Review Records →
        </button>
      )}
    </section>
  );
}
