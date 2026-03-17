import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Info, CheckCircle2, Clock, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatCount } from '@/lib/formatters';
import { useDashboardMetrics } from '@/hooks/useDashboardData';
import { useMdaComplianceGrid } from '@/hooks/useMdaData';
import { useAttentionItems } from '@/hooks/useAttentionItems';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { ComplianceProgressHeader } from '@/components/shared/ComplianceProgressHeader';
import { HealthScoreBadge } from '@/components/shared/HealthScoreBadge';
import { SubmissionHeatmap } from '@/components/shared/SubmissionHeatmap';
import { AttentionItemCard, AttentionEmptyState } from '@/components/shared/AttentionItemCard';
import { useAuthStore } from '@/stores/authStore';
import { ROLES } from '@vlprs/shared';
import { SchemeFundDialog } from './components/SchemeFundDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { MdaComplianceRow, SubmissionStatus } from '@vlprs/shared';

const STATUS_BADGE_MAP: Record<SubmissionStatus, { variant: 'complete' | 'pending' | 'review'; label: string; Icon: typeof CheckCircle2; iconColor: string }> = {
  submitted: { variant: 'complete', label: 'Submitted', Icon: CheckCircle2, iconColor: 'text-green-600' },
  pending: { variant: 'pending', label: 'Pending', Icon: Clock, iconColor: 'text-teal-600' },
  overdue: { variant: 'review', label: 'Awaiting', Icon: Flag, iconColor: 'text-amber-600' },
};

function sortComplianceRows(rows: MdaComplianceRow[]): MdaComplianceRow[] {
  const pending = rows.filter((r) => r.status !== 'submitted').sort((a, b) => a.mdaName.localeCompare(b.mdaName));
  const submitted = rows.filter((r) => r.status === 'submitted').sort((a, b) => a.mdaName.localeCompare(b.mdaName));
  return [...pending, ...submitted];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const [schemeFundOpen, setSchemeFundOpen] = useState(false);
  const metrics = useDashboardMetrics();
  const compliance = useMdaComplianceGrid();
  const attention = useAttentionItems();

  const sortedComplianceRows = useMemo(
    () => compliance.data ? sortComplianceRows(compliance.data.rows) : [],
    [compliance.data],
  );

  return (
    <div className="space-y-8">
      {/* Welcome greeting + page header */}
      <div className="space-y-3">
        <WelcomeGreeting subtitle="Here's your executive overview" />
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
      </div>

      {/* Hero metrics grid — Primary Row */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroMetricCard
            label="Active Loans"
            value={metrics.data?.activeLoans ?? 0}
            format="count"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/active-loans')}
          />
          <HeroMetricCard
            label="Total Exposure"
            value={metrics.data?.totalExposure ?? '0'}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/total-exposure')}
          />
          {/* Fund Available — conditional rendering for unconfigured state */}
          {metrics.isPending ? (
            <HeroMetricCard
              label="Fund Available"
              value="0"
              format="currency"
              isPending={true}
            />
          ) : metrics.data?.fundConfigured === false ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'rounded-lg border bg-white p-6',
                      isSuperAdmin ? 'cursor-pointer hover:bg-slate-50 transition-colors' : 'cursor-default',
                    )}
                    aria-label="Fund Available: Awaiting Configuration"
                    role={isSuperAdmin ? 'button' : undefined}
                    tabIndex={isSuperAdmin ? 0 : undefined}
                    onClick={isSuperAdmin ? () => setSchemeFundOpen(true) : undefined}
                    onKeyDown={isSuperAdmin ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSchemeFundOpen(true);
                      }
                    } : undefined}
                  >
                    <p className="text-sm text-text-secondary mb-1">Fund Available</p>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-lg font-semibold text-text-secondary">Awaiting Configuration</span>
                      <Badge variant="info"><Info className="h-3 w-3" /></Badge>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isSuperAdmin ? 'Click to enter scheme fund total' : 'Scheme fund total has not been configured yet'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <HeroMetricCard
              label="Fund Available"
              value={metrics.data?.fundAvailable ?? '0'}
              format="currency"
              isPending={false}
              onClick={() => navigate('/dashboard/drill-down/fund-available')}
            />
          )}
          <div>
            <HeroMetricCard
              label="Monthly Recovery"
              value={metrics.data?.monthlyRecovery ?? '0'}
              format="currency"
              isPending={metrics.isPending}
              onClick={() => navigate('/dashboard/drill-down/monthly-recovery')}
            />
            {metrics.data?.recoveryPeriod && (
              <p className="mt-1 text-xs text-text-secondary text-center">
                {(() => {
                  const [y, m] = metrics.data.recoveryPeriod.split('-');
                  if (!y || !m) return '';
                  const date = new Date(Number(y), Number(m) - 1);
                  return date.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                })()}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Portfolio Analytics Row */}
      <section aria-label="Portfolio analytics">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Portfolio Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
          <HeroMetricCard
            label="Loans in Window"
            value={metrics.data?.loansInWindow ?? 0}
            format="count"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/loans-in-window')}
          />
          <HeroMetricCard
            label="Outstanding Receivables"
            value={metrics.data?.totalOutstandingReceivables ?? '0'}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/outstanding-receivables')}
          />
          <HeroMetricCard
            label="Collection Potential"
            value={metrics.data?.monthlyCollectionPotential ?? '0'}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/collection-potential')}
          />
          <HeroMetricCard
            label="At-Risk Amount"
            value={metrics.data?.atRiskAmount ?? '0'}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/at-risk')}
          />
          <HeroMetricCard
            label="Completion Rate (60m)"
            value={metrics.data?.loanCompletionRate ?? 0}
            format="percentage"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/completion-rate')}
          />
          <HeroMetricCard
            label="Completion Rate (All-Time)"
            value={metrics.data?.loanCompletionRateLifetime ?? 0}
            format="percentage"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/completion-rate-lifetime')}
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
        ) : attention.data && attention.data.items.length > 0 ? (
          <div className="space-y-3" role="list">
            {attention.data.items.map((item) => (
              <AttentionItemCard
                key={item.id}
                description={item.description}
                mdaName={item.mdaName}
                category={item.category}
                timestamp={item.timestamp}
                type={item.type}
                count={item.count}
                amount={item.amount}
                drillDownUrl={item.drillDownUrl}
              />
            ))}
            {attention.data.totalCount > 10 && (
              <button
                className="text-sm font-medium text-teal hover:underline"
                onClick={() => navigate('/dashboard/attention')}
              >
                View all attention items ({attention.data!.totalCount})
              </button>
            )}
          </div>
        ) : (
          <AttentionEmptyState />
        )}
      </section>

      {/* MDA Compliance Status */}
      <section aria-label="MDA compliance status">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          MDA Compliance Status
        </h2>

        {/* Progress Header + Countdown (Task 5) */}
        {compliance.data?.summary && (
          <div className="mb-4">
            <ComplianceProgressHeader
              submitted={compliance.data.summary.submitted}
              total={compliance.data.summary.total}
              deadlineDate={compliance.data.summary.deadlineDate}
            />
          </div>
        )}

        {compliance.isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : compliance.data ? (
          <>
            {/* Mobile compact view (<768px) — Task 8 */}
            <div className="md:hidden space-y-4">
              {(() => {
                const pendingRows = sortedComplianceRows.filter((r) => r.status !== 'submitted');
                const submittedRows = sortedComplianceRows.filter((r) => r.status === 'submitted');
                return (
                  <>
                    {/* Pending/Awaiting shown first, always expanded */}
                    {pendingRows.length > 0 && (
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-text-secondary">
                          Awaiting Submission ({pendingRows.length})
                        </h3>
                        <div className="space-y-1">
                          {pendingRows.map((row) => {
                            const badge = STATUS_BADGE_MAP[row.status];
                            return (
                              <button
                                key={row.mdaId}
                                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-slate-50 min-h-[44px]"
                                onClick={() => navigate(`/dashboard/mda/${row.mdaId}`)}
                              >
                                <span className="text-sm font-medium text-text-primary truncate mr-2">
                                  {row.mdaName}
                                </span>
                                <Badge variant={badge.variant} className="shrink-0">
                                  <badge.Icon className={cn('mr-1 h-3 w-3', badge.iconColor)} />
                                  {badge.label}
                                </Badge>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Submitted collapsed by default */}
                    {submittedRows.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-slate-50 min-h-[44px]">
                          <span className="text-sm font-medium text-text-secondary">
                            Submitted ({submittedRows.length})
                          </span>
                          <span className="text-xs text-text-secondary">Tap to expand</span>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-1 space-y-1">
                            {submittedRows.map((row) => (
                              <button
                                key={row.mdaId}
                                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-slate-50 min-h-[44px]"
                                onClick={() => navigate(`/dashboard/mda/${row.mdaId}`)}
                              >
                                <span className="text-sm font-medium text-text-primary truncate mr-2">
                                  {row.mdaName}
                                </span>
                                <Badge variant="complete" className="shrink-0">
                                  <CheckCircle2 className="mr-1 h-3 w-3 text-green-600" />
                                  Submitted
                                </Badge>
                              </button>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Desktop full table (>=768px) — Task 6 */}
            <div className="hidden md:block overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">MDA Name</th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">Health</th>
                    <th className="px-4 py-3 text-right font-medium text-text-secondary">Coverage %</th>
                    <th className="px-4 py-3 text-left font-medium text-text-secondary">Last Submission</th>
                    <th className="px-4 py-3 text-right font-medium text-text-secondary">Records</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedComplianceRows.map((row) => {
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
                        onClick={() => navigate(`/dashboard/mda/${row.mdaId}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/dashboard/mda/${row.mdaId}`);
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-medium text-text-primary">{row.mdaName}</span>
                            {row.isDark && (
                              <Badge variant="review" className="ml-2 text-xs">Submission gap observed</Badge>
                            )}
                            {row.stalenessMonths !== null && row.stalenessMonths >= 2 && (
                              <p className="text-xs text-text-secondary mt-0.5">
                                Data as of {row.lastSubmission ? formatDate(row.lastSubmission) : 'N/A'} — {row.stalenessMonths} months since last update
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>
                            <badge.Icon className={cn('mr-1 h-3 w-3', badge.iconColor)} />
                            {badge.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <HealthScoreBadge score={row.healthScore} band={row.healthBand} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">
                          {row.submissionCoveragePercent !== null
                            ? `${Math.round(row.submissionCoveragePercent)}%`
                            : '—'}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {row.lastSubmission ? formatDate(row.lastSubmission) : '—'}
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
          </>
        ) : null}
      </section>

      {/* Submission Heatmap — desktop only (Task 9, 10) */}
      <section aria-label="Submission history heatmap" className="hidden md:block">
        {compliance.isPending ? (
          <div className="rounded-lg border p-6 space-y-3">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : compliance.data ? (
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border p-4 text-left hover:bg-slate-50">
              <h2 className="text-lg font-semibold text-text-primary">
                Submission History (12 months)
              </h2>
              <span className="text-xs text-text-secondary">Click to toggle</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border p-4">
                <SubmissionHeatmap
                  rows={compliance.data.heatmap}
                  summary={compliance.data.summary.heatmapSummary}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </section>

      {/* Scheme Fund Dialog — SUPER_ADMIN only */}
      {isSuperAdmin && (
        <SchemeFundDialog open={schemeFundOpen} onOpenChange={setSchemeFundOpen} />
      )}
    </div>
  );
}

export { DashboardPage as Component };
