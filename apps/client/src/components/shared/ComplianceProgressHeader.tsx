import { differenceInCalendarDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { MetricHelp } from '@/components/shared/MetricHelp';

interface ComplianceProgressHeaderProps {
  submitted: number;
  total: number;
  deadlineDate: string;
}

export function ComplianceProgressHeader({
  submitted,
  total,
  deadlineDate,
}: ComplianceProgressHeaderProps) {
  const today = new Date();
  const deadline = new Date(deadlineDate);
  const daysRemaining = differenceInCalendarDays(deadline, today);
  const isPast = daysRemaining < 0;
  const awaitingCount = total - submitted;

  const progressPercent = total > 0 ? (submitted / total) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      {/* Progress indicator */}
      <div className="flex-1 space-y-1.5">
        <p className="text-sm font-medium text-text-primary">
          {submitted} of {total} MDAs submitted
          <MetricHelp definition={{ label: 'MDA Submission Progress', description: 'Number of MDAs that have submitted their monthly return for the current period.', derivedFrom: 'Count of confirmed submissions against total registered MDAs with active loans.' }} />
        </p>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-green-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={submitted}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-label={`${submitted} of ${total} MDAs submitted`}
          />
        </div>
      </div>

      {/* Countdown badge */}
      <div className="shrink-0">
        {isPast ? (
          <Badge variant="review">
            Deadline passed — {awaitingCount} MDAs awaiting
          </Badge>
        ) : (
          <Badge variant="pending">
            {daysRemaining === 0
              ? 'Deadline today (28th)'
              : `${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} until deadline (28th)`}
          </Badge>
        )}
      </div>
    </div>
  );
}
