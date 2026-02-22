import { useNavigate } from 'react-router';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatCount } from '@/lib/formatters';
import { useDashboardMetrics } from '@/hooks/useDashboardData';
import { useMdaComplianceGrid } from '@/hooks/useMdaData';
import { useAttentionItems } from '@/hooks/useAttentionItems';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';
import { AttentionItemCard, AttentionEmptyState } from '@/components/shared/AttentionItemCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const STATUS_BADGE_MAP = {
  submitted: { variant: 'complete' as const, label: 'Submitted' },
  pending: { variant: 'pending' as const, label: 'Pending' },
  overdue: { variant: 'review' as const, label: 'Awaiting' },
} as const;

export function DashboardPage() {
  const navigate = useNavigate();
  const metrics = useDashboardMetrics();
  const compliance = useMdaComplianceGrid();
  const attention = useAttentionItems();

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          Executive Dashboard
        </h1>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button disabled className="gap-2">
                  <FileText className="h-4 w-4" />
                  Share as PDF
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>PDF export — Coming in Sprint 10 (Epic 6)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Hero metrics grid */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroMetricCard
            label="Active Loans"
            value={metrics.data?.activeLoans ?? 0}
            format="count"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/operations')}
          />
          <HeroMetricCard
            label="Total Exposure"
            value={metrics.data?.totalExposure ?? '0'}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/operations')}
          />
          <HeroMetricCard
            label="Fund Available"
            value={metrics.data?.fundAvailable ?? '0'}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/reports')}
          />
          <HeroMetricCard
            label="Monthly Recovery"
            value={metrics.data?.monthlyRecovery ?? '0'}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/reports')}
          />
        </div>
      </section>

      {/* Attention items */}
      <section aria-label="Items requiring attention">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Items Requiring Attention
        </h2>
        {attention.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg bg-attention-bg p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="mt-0.5 h-5 w-5 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : attention.data && attention.data.length > 0 ? (
          <div className="space-y-3">
            {attention.data.map((item) => (
              <AttentionItemCard
                key={item.id}
                description={item.description}
                mdaName={item.mdaName}
                category={item.category}
                timestamp={item.timestamp}
              />
            ))}
          </div>
        ) : (
          <AttentionEmptyState />
        )}
      </section>

      {/* MDA Compliance Grid */}
      <section aria-label="MDA compliance status">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          MDA Compliance Status
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  MDA Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Last Submission
                </th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">
                  Records
                </th>
              </tr>
            </thead>
            <tbody>
              {compliance.isPending
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-48" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Skeleton className="ml-auto h-4 w-12" />
                      </td>
                    </tr>
                  ))
                : compliance.data?.map((row) => {
                    const badge = STATUS_BADGE_MAP[row.status];
                    return (
                      <tr
                        key={row.mdaId}
                        className={cn(
                          'border-b transition-colors hover:bg-slate-50',
                          'cursor-pointer',
                        )}
                        role="link"
                        tabIndex={0}
                        onClick={() =>
                          navigate(`/dashboard/mda/${row.mdaId}`)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/dashboard/mda/${row.mdaId}`);
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {row.mdaName}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {row.lastSubmission
                            ? formatDate(row.lastSubmission)
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">
                          {formatCount(row.recordCount)}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export { DashboardPage as Component };
