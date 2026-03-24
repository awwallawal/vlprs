import { Info, CheckCircle2 } from 'lucide-react';
import { useComparisonSummary } from '@/hooks/useSubmissionData';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { NonPunitiveVarianceDisplay } from '@/components/shared/NonPunitiveVarianceDisplay';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { UI_COPY, VOCABULARY } from '@vlprs/shared';
import { formatCount } from '@/lib/formatters';

interface ComparisonSummaryProps {
  submissionId: string;
  className?: string;
}

export function ComparisonSummary({
  submissionId,
  className,
}: ComparisonSummaryProps) {
  const { data, isPending } = useComparisonSummary(submissionId);

  if (isPending) {
    return (
      <div className={cn('rounded-lg bg-slate-50 p-4 space-y-3', className)}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-52" />
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;

  return (
    <section
      aria-labelledby="comparison-summary-heading"
      className={cn('rounded-lg bg-slate-50 p-4 space-y-4', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5 text-[#0D7377]" aria-hidden="true" />
        <h2
          id="comparison-summary-heading"
          className="text-base font-semibold text-text-primary"
        >
          {UI_COPY.COMPARISON_SUMMARY_HEADER}
        </h2>
      </div>

      {/* Three-row summary */}
      <div className="space-y-2">
        {/* Aligned records */}
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-[#16A34A] shrink-0" aria-hidden="true" />
          <span className="text-text-primary">
            {formatCount(summary.alignedCount)} records {UI_COPY.COMPARISON_ALIGNED_LABEL.toLowerCase()}
            <MetricHelp metric="reconciliation.matchRate" />
          </span>
        </div>

        {/* Minor variances */}
        <div className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-[#0D7377] shrink-0" aria-hidden="true" />
          <span className="text-text-secondary">
            {formatCount(summary.minorVarianceCount)} {UI_COPY.COMPARISON_MINOR_VARIANCE_LABEL.toLowerCase()}
            {summary.minorVarianceCount !== 1 ? 's' : ''}
            <MetricHelp metric="reconciliation.fullVariance" />
          </span>
        </div>

        {/* Variances with amounts */}
        <div className="flex items-center gap-2 text-sm">
          <Info className="h-4 w-4 text-[#0D7377] shrink-0" aria-hidden="true" />
          <span className="text-text-secondary">
            {formatCount(summary.varianceCount)} variance{summary.varianceCount !== 1 ? 's' : ''} with amounts
          </span>
        </div>
      </div>

      {/* Expandable variance detail */}
      {summary.rows.length > 0 && (
        <NonPunitiveVarianceDisplay rows={summary.rows} showNoActionNote={false} />
      )}

      {/* Footer note */}
      <p className="text-xs text-text-muted border-t border-slate-200 pt-3">
        {VOCABULARY.COMPARISON_NO_ACTION_REQUIRED}
      </p>
    </section>
  );
}
