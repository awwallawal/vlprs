import { useState, useMemo } from 'react';
import { Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useThreeWayReconciliation, useThreeWayDashboard } from '@/hooks/useThreeWayReconciliation';
import { useMdaList } from '@/hooks/useMigration';
import { useAuthStore } from '@/stores/authStore';
import { usePageMeta } from '@/hooks/usePageMeta';
import { formatNaira } from '@/lib/formatters';
import { ROLES } from '@vlprs/shared';
import type { ThreeWayMatchStatus, ThreeWayVarianceCategory, ThreeWayReconciliationRow } from '@vlprs/shared';

const MATCH_STATUS_LABELS: Record<ThreeWayMatchStatus, string> = {
  full_match: 'Full Match',
  partial_match: 'Partial Match',
  full_variance: 'Variance Observed',
  expected_unknown: 'Expected Unknown',
};

const MATCH_STATUS_VARIANT: Record<ThreeWayMatchStatus, 'complete' | 'review' | 'info' | 'variance'> = {
  full_match: 'complete',
  partial_match: 'review',
  full_variance: 'info',
  expected_unknown: 'variance',
};

const VARIANCE_CATEGORY_LABELS: Record<ThreeWayVarianceCategory, string> = {
  ghost_deduction: 'Deduction reported by MDA but not found in payroll extract',
  unreported_deduction: 'Payroll deduction recorded but not reported by MDA',
  amount_mismatch: 'Declared and payroll amounts differ',
  staff_not_in_payroll: 'Staff included in MDA submission but absent from payroll extract',
};

function generatePeriodOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
}

export function ThreeWayReconciliationPage() {
  usePageMeta({ title: 'Three-Way Reconciliation', description: 'Compare expected, declared, and actual deductions' });

  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const isDeptAdmin = user?.role === ROLES.DEPT_ADMIN;

  const mdaList = useMdaList();
  const periods = useMemo(generatePeriodOptions, []);

  // Default MDA: for MDA_OFFICER/DEPT_ADMIN use their assigned MDA
  const userMdaId = user?.mdaId ?? undefined;
  const [selectedMdaId, setSelectedMdaId] = useState<string | undefined>(userMdaId);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(periods[0]);

  const dashboard = useThreeWayDashboard();
  const reconciliation = useThreeWayReconciliation(selectedMdaId, selectedPeriod);

  const summary = reconciliation.data;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-text-primary">Three-Way Reconciliation</h1>
      <p className="text-sm text-text-secondary">
        Compare expected deductions (VLPRS), declared deductions (MDA submission), and actual deductions (payroll extract).
      </p>

      {/* Dashboard Metrics (SUPER_ADMIN / DEPT_ADMIN) */}
      {(isSuperAdmin || isDeptAdmin) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Overall Match Rate"
            value={dashboard.data ? `${dashboard.data.overallMatchRate}%` : undefined}
            loading={dashboard.isLoading}
          />
          <MetricCard
            label="Full Variances"
            value={dashboard.data?.fullVarianceCount?.toString()}
            loading={dashboard.isLoading}
          />
          <MetricCard
            label="Top Variance MDAs"
            value={dashboard.data?.topVarianceMdas.length
              ? dashboard.data.topVarianceMdas.map((m) => `${m.mdaName} (${m.varianceCount})`).join(', ')
              : 'None'}
            loading={dashboard.isLoading}
          />
        </div>
      )}

      {/* Selectors */}
      <div className="flex flex-wrap gap-4">
        {(isSuperAdmin || isDeptAdmin) && (
          <div className="space-y-1">
            <label htmlFor="mda-select" className="text-xs font-medium text-text-secondary">MDA</label>
            <select
              id="mda-select"
              className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
              value={selectedMdaId ?? ''}
              onChange={(e) => setSelectedMdaId(e.target.value || undefined)}
            >
              <option value="">Select MDA</option>
              {mdaList.data?.map((mda) => (
                <option key={mda.id} value={mda.id}>{mda.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="period-select" className="text-xs font-medium text-text-secondary">Period</label>
          <select
            id="period-select"
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Pending State Banner */}
      {summary?.pendingState && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">{summary.pendingState}</p>
        </div>
      )}

      {/* Loading State */}
      {reconciliation.isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Summary Card */}
      {summary && !summary.pendingState && (
        <>
          <div className="rounded-lg border border-border bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">Reconciliation Summary — {summary.mdaName}</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SummaryItem label="Total Staff" value={summary.totalStaffCompared.toString()} />
              <SummaryItem label="Full Match" value={`${summary.fullMatchCount} (${summary.fullMatchPercent}%)`} />
              <SummaryItem label="Partial Match" value={summary.partialMatchCount.toString()} />
              <SummaryItem label="Variance Observed" value={summary.fullVarianceCount.toString()} />
              <SummaryItem label="Aggregate Declared" value={formatNaira(summary.aggregateDeclared)} />
              <SummaryItem label="Aggregate Actual" value={formatNaira(summary.aggregateActual)} />
              <SummaryItem label="Reconciliation Health" value={`${summary.reconciliationHealth}%`} />
            </div>
          </div>

          {/* Per-Staff Detail Table */}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-accent text-left text-xs font-medium text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Staff ID</th>
                  <th className="px-4 py-3">Staff Name</th>
                  <th className="px-4 py-3 text-right">Expected (₦)</th>
                  <th className="px-4 py-3 text-right">Declared (₦)</th>
                  <th className="px-4 py-3 text-right">Actual (₦)</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Variance Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {summary.rows.map((row) => (
                  <StaffRow key={row.staffId} row={row} />
                ))}
                {summary.rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-text-secondary">
                      No reconciliation data available for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-Components ────────────────────────────────────────────────

function MetricCard({ label, value, loading }: { label: string; value?: string; loading: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-6 w-24" />
      ) : (
        <p className="mt-1 text-lg font-semibold text-text-primary">{value ?? '—'}</p>
      )}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-text-primary">{value}</p>
    </div>
  );
}

function StaffRow({ row }: { row: ThreeWayReconciliationRow }) {
  return (
    <tr className="hover:bg-surface-accent/50">
      <td className="px-4 py-3 font-mono text-xs">{row.staffId}</td>
      <td className="px-4 py-3">{row.staffName}</td>
      <td className="px-4 py-3 text-right font-mono">
        {row.expectedAmount !== null ? formatNaira(row.expectedAmount) : <span className="text-text-secondary italic">Unknown</span>}
      </td>
      <td className="px-4 py-3 text-right font-mono">{formatNaira(row.declaredAmount)}</td>
      <td className="px-4 py-3 text-right font-mono">{formatNaira(row.actualAmount)}</td>
      <td className="px-4 py-3">
        <Badge variant={MATCH_STATUS_VARIANT[row.matchStatus]}>
          {MATCH_STATUS_LABELS[row.matchStatus]}
        </Badge>
      </td>
      <td className="px-4 py-3 text-xs text-text-secondary">
        {row.varianceCategory ? VARIANCE_CATEGORY_LABELS[row.varianceCategory] : '—'}
      </td>
    </tr>
  );
}
