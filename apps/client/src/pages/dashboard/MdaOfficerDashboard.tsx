import { useNavigate } from 'react-router';
import { useDashboardMetrics } from '@/hooks/useDashboardData';
import { useMdaDetail } from '@/hooks/useMdaData';
import { useMigrationStatus } from '@/hooks/useMigrationData';
import { usePreSubmissionCheckpoint } from '@/hooks/usePreSubmissionCheckpoint';
import { useSubmissionHistory } from '@/hooks/useSubmissionData';
import { useAuthStore } from '@/stores/authStore';
import type { SubmissionRecordStatus } from '@vlprs/shared';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { StatusDistributionBar } from '@/components/shared/StatusDistributionBar';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { MdaReviewSection } from './components/MdaReviewSection';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/lib/formatters';

const STATUS_LABEL: Record<SubmissionRecordStatus, { label: string; variant: 'complete' | 'pending' | 'review' }> = {
  confirmed: { label: 'Confirmed', variant: 'complete' },
  processing: { label: 'Processing', variant: 'pending' },
  rejected: { label: 'Rejected', variant: 'review' },
};

export function MdaOfficerDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const userMdaId = user?.mdaId || undefined;

  const metrics = useDashboardMetrics();
  // Pass userMdaId directly (the hook accepts string | undefined). Coercing to ''
  // would defeat the cache-key fix from Story 15.0j Fix #11 because '' is not nullish.
  const mdaDetail = useMdaDetail(userMdaId);
  const migration = useMigrationStatus();
  const checkpoint = usePreSubmissionCheckpoint(userMdaId);
  const submissions = useSubmissionHistory(userMdaId, 1, 5);

  const mdaName = mdaDetail.data?.name ?? '';
  const migrationData = migration.data?.[0];
  const recordCounts = migrationData?.recordCounts;
  const qualityTotal = recordCounts
    ? recordCounts.clean + recordCounts.minor + recordCounts.significant + recordCounts.structural + recordCounts.anomalous
    : 0;
  const qualityScore = recordCounts && qualityTotal > 0
    ? ((recordCounts.clean + recordCounts.minor) / qualityTotal * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-8">
      {/* Welcome greeting */}
      <WelcomeGreeting subtitle={mdaName || undefined} />

      {/* Hero Metrics (AC: 1, 7) */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroMetricCard
            label="Active Loans"
            value={metrics.data?.activeLoans ?? 0}
            format="count"
            trend={metrics.data?.trends?.activeLoans}
            isPending={metrics.isPending}
            onClick={() => navigate(userMdaId ? `/dashboard/loans?filter=active&mda=${userMdaId}` : '/dashboard/loans?filter=active')}
          />
          <HeroMetricCard
            label="Monthly Recovery"
            value={metrics.data?.monthlyRecovery ?? '0'}
            format="currency"
            trend={metrics.data?.trends?.monthlyRecovery}
            isPending={metrics.isPending}
            helpKey="dashboard.monthlyRecovery"
            onClick={() => navigate(`/dashboard/drill-down/monthly-recovery`)}
          />
          <HeroMetricCard
            label="Total Exposure"
            value={metrics.data?.totalExposure ?? '0'}
            format="currency"
            trend={metrics.data?.trends?.totalExposure}
            isPending={metrics.isPending}
            helpKey="dashboard.totalExposure"
            onClick={() => navigate(`/dashboard/drill-down/total-exposure`)}
          />
          <HeroMetricCard
            label="Completion Rate"
            value={metrics.data?.loanCompletionRateLifetime ?? 0}
            format="percentage"
            trend={metrics.data?.trends?.completionRate}
            isPending={metrics.isPending}
            helpKey="dashboard.completionRateLifetime"
            onClick={() => navigate(`/dashboard/drill-down/completion-rate-lifetime`)}
          />
        </div>
      </section>

      {/* Status Distribution Bar (AC: 1) */}
      {mdaDetail.isPending ? (
        <Skeleton className="h-2 w-full rounded-full" />
      ) : mdaDetail.data?.statusDistribution ? (
        <StatusDistributionBar distribution={mdaDetail.data.statusDistribution} />
      ) : null}

      {/* Two-column layout: Migration Quality + Records for Review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Migration Quality (AC: 2) */}
        <section aria-label="Migration quality" className="rounded-lg border bg-white p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">
            Migration Quality <MetricHelp metric="migration.stageProgress" />
          </h3>
          {migration.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : recordCounts ? (
            <>
              <p className="text-2xl font-bold text-text-primary mb-2">{qualityScore}%</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
                <span>Clean: {recordCounts.clean}</span>
                <span>Minor: {recordCounts.minor}</span>
                <span>Significant: {recordCounts.significant}</span>
                <span>Structural: {recordCounts.structural}</span>
                {recordCounts.anomalous > 0 && <span>Anomalous: {recordCounts.anomalous}</span>}
              </div>
            </>
          ) : (
            <p className="text-sm text-text-muted">No migration data available for your MDA yet.</p>
          )}
        </section>

        {/* Records Awaiting Review (AC: 3) */}
        <MdaReviewSection onNavigateToReview={() => navigate('/dashboard/migration')} />
      </div>

      {/* Pre-Submission Checkpoint (AC: 4) */}
      <section aria-label="Pre-submission checkpoint" className="rounded-lg border bg-white p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Pre-Submission Status
        </h3>
        {checkpoint.isPending ? (
          <Skeleton className="h-6 w-48" />
        ) : checkpoint.data ? (
          <div className="flex items-center gap-3">
            {checkpoint.data.approachingRetirement.length === 0 &&
             checkpoint.data.zeroDeduction.length === 0 &&
             checkpoint.data.pendingEvents.length === 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="text-sm text-text-primary font-medium">All clear — ready to submit</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-text-primary font-medium">
                  {checkpoint.data.approachingRetirement.length + checkpoint.data.zeroDeduction.length + checkpoint.data.pendingEvents.length} items need attention
                </span>
              </>
            )}
            <button
              type="button"
              onClick={() => navigate('/dashboard/submissions')}
              className="ml-auto text-sm text-teal hover:text-teal-hover font-medium underline"
            >
              View Details →
            </button>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Pre-submission checkpoint will appear when your submission window opens.</p>
        )}
      </section>

      {/* Recent Submissions (AC: 5, 8) */}
      <section aria-label="Recent submissions" className="rounded-lg border bg-white p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">
          Recent Submissions
        </h3>
        {submissions.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : submissions.data && submissions.data.items.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">Period</th>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">Status</th>
                    <th className="px-3 py-2 text-right font-medium text-text-secondary">Records</th>
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.data.items.map((sub) => {
                    const badge = STATUS_LABEL[sub.status] ?? { label: sub.status, variant: 'pending' as const };
                    return (
                      <tr
                        key={sub.id}
                        className="border-b hover:bg-slate-50 cursor-pointer"
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/dashboard/submissions/${sub.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/dashboard/submissions/${sub.id}`);
                          }
                        }}
                      >
                        <td className="px-3 py-2 text-sm">
                          {(() => {
                            const [y, m] = sub.period.split('-');
                            if (!y || !m) return sub.period;
                            return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{sub.recordCount}</td>
                        <td className="px-3 py-2 text-text-secondary">{formatDate(sub.submissionDate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {submissions.data.total > 5 && (
              <button
                type="button"
                onClick={() => navigate('/dashboard/submissions')}
                className="mt-3 text-sm text-teal hover:text-teal-hover font-medium underline"
              >
                View All Submissions ({submissions.data.total})
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-text-muted">No monthly submissions yet. Upload your first submission via the Upload Data menu.</p>
        )}
      </section>
    </div>
  );
}
