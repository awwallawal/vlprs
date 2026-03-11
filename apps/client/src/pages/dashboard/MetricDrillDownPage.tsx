import { useParams, useNavigate } from 'react-router';
import { useDrillDown } from '@/hooks/useDrillDown';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { HealthScoreBadge } from '@/components/shared/HealthScoreBadge';
import { StatusDistributionBar } from '@/components/shared/StatusDistributionBar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const METRIC_LABELS: Record<string, string> = {
  'active-loans': 'Active Loans',
  'total-exposure': 'Total Exposure',
  'fund-available': 'Fund Available',
  'monthly-recovery': 'Monthly Recovery',
  'loans-in-window': 'Loans in Window (60m)',
  'outstanding-receivables': 'Outstanding Receivables',
  'collection-potential': 'Collection Potential',
  'at-risk': 'At-Risk Amount',
  'completion-rate': 'Completion Rate (60m)',
  'completion-rate-lifetime': 'Completion Rate (All-Time)',
};

// URL slug → API param mapping
const SLUG_TO_API: Record<string, string> = {
  'active-loans': 'activeLoans',
  'total-exposure': 'totalExposure',
  'fund-available': 'fundAvailable',
  'monthly-recovery': 'monthlyRecovery',
  'loans-in-window': 'loansInWindow',
  'outstanding-receivables': 'outstandingReceivables',
  'collection-potential': 'collectionPotential',
  'at-risk': 'atRisk',
  'completion-rate': 'completionRate',
  'completion-rate-lifetime': 'completionRateLifetime',
};

export function MetricDrillDownPage() {
  const { metric } = useParams<{ metric: string }>();
  const navigate = useNavigate();
  const apiMetric = SLUG_TO_API[metric ?? ''] ?? metric ?? '';
  const { data: rows, isPending } = useDrillDown(apiMetric);

  const metricLabel = METRIC_LABELS[metric ?? ''] ?? metric ?? 'Metric';
  const isMonthlyRecovery = metric === 'monthly-recovery';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">
        {metricLabel} — MDA Breakdown
      </h1>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-medium text-text-secondary">
                MDA Name
              </th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Count</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Outstanding Amount</th>
              {isMonthlyRecovery && (
                <>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Expected</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Actual</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Variance</th>
                </>
              )}
              <th className="px-4 py-3 text-center font-medium text-text-secondary">Health</th>
              <th className="px-4 py-3 text-center font-medium text-text-secondary min-w-[120px]">Status Distribution</th>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <th className="px-4 py-3 text-center font-medium text-text-secondary cursor-help">
                      Submission
                    </th>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Available when live submission tracking is enabled (Epic 5)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </tr>
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="sticky left-0 z-10 bg-white px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-12" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-24" /></td>
                    {isMonthlyRecovery && (
                      <>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-20" /></td>
                        <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-16" /></td>
                      </>
                    )}
                    <td className="px-4 py-3"><Skeleton className="mx-auto h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-2 w-full rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                  </tr>
                ))
              : rows?.map((row) => (
                  <tr
                    key={row.mdaId}
                    className={cn(
                      'border-b transition-colors hover:bg-slate-50 cursor-pointer',
                    )}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/dashboard/mda/${row.mdaId}?metric=${metric}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/dashboard/mda/${row.mdaId}?metric=${metric}`);
                      }
                    }}
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 font-medium text-text-primary">
                      {row.mdaName}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">
                      {row.contributionCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <NairaDisplay amount={row.contributionAmount} variant="table" />
                    </td>
                    {isMonthlyRecovery && (
                      <>
                        <td className="px-4 py-3 text-right">
                          <NairaDisplay amount={row.expectedMonthlyDeduction} variant="table" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <NairaDisplay amount={row.actualMonthlyRecovery} variant="table" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <VarianceDisplay percent={row.variancePercent} />
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3 text-center">
                      <HealthScoreBadge score={row.healthScore} band={row.healthBand} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusDistributionBar distribution={row.statusDistribution} />
                    </td>
                    <td className="px-4 py-3 text-center text-text-secondary">—</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!isPending && rows && rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-secondary">
            No MDA data available for this metric.
          </p>
        )}
      </div>
    </div>
  );
}

/** Non-punitive variance display: "−5.2% below expected" / "+2.1% above expected" */
function VarianceDisplay({ percent }: { percent: number | null }) {
  if (percent === null) return <span className="text-text-secondary">—</span>;

  const isNegative = percent < 0;
  const formatted = `${isNegative ? '\u2212' : '+'}${Math.abs(percent).toFixed(1)}%`;
  const label = isNegative ? 'below expected' : 'above expected';

  return (
    <span className={cn('text-xs font-medium', isNegative ? 'text-amber-600' : 'text-green-600')}>
      {formatted} {label}
    </span>
  );
}

export { MetricDrillDownPage as Component };
