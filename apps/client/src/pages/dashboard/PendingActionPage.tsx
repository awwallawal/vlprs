/**
 * PendingActionPage — Per-MDA backlog of records awaiting action.
 * UAT 2026-04-14 Finding #41
 */

import { useNavigate } from 'react-router';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { usePendingMdaAction } from '@/hooks/usePendingMdaAction';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';
import { formatDate } from '@/lib/formatters';

export function PendingActionPage() {
  const navigate = useNavigate();
  const { data, isPending } = usePendingMdaAction();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 -ml-2 text-text-secondary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Awaiting MDA Action</h1>
          <p className="text-sm text-text-secondary mt-1">
            Records pending MDA officer review or correction. As MDAs work through their queues, these numbers shrink.
          </p>
        </div>
      </div>

      {/* Hero metrics */}
      <section aria-label="Backlog metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroMetricCard
            label="Records Pending"
            value={data?.totalPending ?? 0}
            format="count"
            isPending={isPending}
          />
          <HeroMetricCard
            label="Pending Exposure"
            value={data?.totalExposure ?? '0'}
            format="currency"
            isPending={isPending}
          />
          <HeroMetricCard
            label="MDAs With Backlog"
            value={data?.mdaCount ?? 0}
            format="count"
            isPending={isPending}
          />
          <HeroMetricCard
            label="Overdeductions"
            value={data?.overdeductions ?? 0}
            format="count"
            isPending={isPending}
          />
        </div>
      </section>

      {/* Observation breakdown */}
      {!isPending && data && (
        <section className="rounded-lg border bg-amber-50 border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-amber-900">
              <span><strong>{data.withinFileDuplicates}</strong> within-file duplicates blocking baseline</span>
              <span><strong>{data.negativeBalances}</strong> negative balances</span>
              <span><strong>{data.overdeductions}</strong> post-completion deductions (overdeductions)</span>
            </div>
          </div>
        </section>
      )}

      {/* Per-MDA scorecard */}
      <section aria-label="Per-MDA backlog">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Per-MDA Scorecard</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">MDA</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Flagged</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Not Baselined</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Exposure</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Next Deadline</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Action</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                    <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  </tr>
                ))
              ) : data?.perMda?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-text-secondary">
                    No pending records — all MDAs have cleared their backlog.
                  </td>
                </tr>
              ) : (
                data?.perMda?.map((row) => {
                  const overdue = row.nextDeadline && new Date(row.nextDeadline) < new Date();
                  return (
                    <tr
                      key={row.mdaId}
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/dashboard/mda/${row.mdaId}`)}
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">{row.mdaName}</td>
                      <td className="px-4 py-3 text-right font-mono text-text-secondary">{row.flagged.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-text-secondary">{row.notBaselined.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <NairaDisplay amount={row.flaggedExposure} variant="table" />
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {row.nextDeadline ? (
                          <span className={overdue ? 'text-amber-700 font-medium' : ''}>
                            {formatDate(row.nextDeadline)} {overdue && '(overdue)'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/migration/review?mda=${row.mdaId}`); }}
                          className="text-sm text-teal hover:text-teal/80 font-medium"
                        >
                          Review →
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export { PendingActionPage as Component };
