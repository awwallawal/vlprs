import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Briefcase, Calculator, Search } from 'lucide-react';
import { useDashboardMetrics } from '@/hooks/useDashboardData';
import { useAttentionItems } from '@/hooks/useAttentionItems';
import { useMigrationStatus } from '@/hooks/useMigrationData';
import { useListMigrations } from '@/hooks/useMigration';
import { useLoanSearch } from '@/hooks/useLoanData';
import { useExceptionQueue, useExceptionCounts } from '@/hooks/useExceptionData';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';
import { MigrationProgressCard } from '@/components/shared/MigrationProgressCard';
import { MdaReviewProgressTracker } from './components/MdaReviewProgressTracker';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { ExceptionQueueRow, ExceptionEmptyState } from '@/components/shared/ExceptionQueueRow';
import { AttentionItemCard } from '@/components/shared/AttentionItemCard';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

/** Simple debounce hook using setTimeout/clearTimeout. */
function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export function OperationsHubPage() {
  const navigate = useNavigate();

  // --- Hero Metrics ---
  const metrics = useDashboardMetrics();
  const attention = useAttentionItems();

  // --- MDA Review Progress ---
  const uploads = useListMigrations({ limit: 1 });
  const latestUploadId = uploads.data?.data?.[0]?.id ?? '';

  // --- Migration Dashboard ---
  const { data: migrationData, isPending: isMigrationPending } = useMigrationStatus();
  const [mdaFilter, setMdaFilter] = useState('');
  const filteredMigration = migrationData?.filter((m) =>
    m.mdaName.toLowerCase().includes(mdaFilter.toLowerCase()),
  );

  // --- Loan Search ---
  const [loanQuery, setLoanQuery] = useState('');
  const debouncedLoanQuery = useDebouncedValue(loanQuery, 300);
  const { data: loanResults, isPending: isLoanPending } = useLoanSearch(
    debouncedLoanQuery.length >= 2 ? debouncedLoanQuery : '',
  );

  // --- Exception Queue ---
  const { data: exceptions, isPending: isExceptionsPending } = useExceptionQueue();
  const { data: exceptionCounts } = useExceptionCounts();
  const sortedExceptions = exceptions
    ? [...exceptions].sort(
        (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
      )
    : [];

  return (
    <div className="space-y-10">
      {/* Welcome greeting + page heading */}
      <WelcomeGreeting subtitle="Operations Dashboard" />

      {/* Hero Metrics */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroMetricCard
            label="Active Loans"
            value={metrics.data?.activeLoans ?? 0}
            format="count"
            trend={metrics.data?.trends?.activeLoans}
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/loans')}
          />
          <HeroMetricCard
            label="Declared Recovery"
            value={Number(metrics.data?.monthlyRecovery ?? 0) > 0
              ? (metrics.data?.monthlyRecovery ?? '0')
              : (metrics.data?.monthlyCollectionPotential ?? '0')}
            format="currency"
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/monthly-recovery')}
          />
          <HeroMetricCard
            label="Total Exposure"
            value={metrics.data?.totalExposure ?? '0'}
            format="currency"
            trend={metrics.data?.trends?.totalExposure}
            isPending={metrics.isPending}
            onClick={() => navigate('/dashboard/drill-down/total-exposure')}
          />
          <HeroMetricCard
            label="Open Exceptions"
            value={exceptionCounts?.total ?? 0}
            format="count"
            isPending={!exceptionCounts}
            onClick={() => navigate('/dashboard/exceptions')}
          />
        </div>
      </section>

      {/* Attention Items (top 5) */}
      {attention.data && attention.data.items.length > 0 && (
        <section aria-label="Attention items">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-text-primary">Needs Attention</h2>
            {attention.data.totalCount > 5 && (
              <button
                type="button"
                onClick={() => navigate('/dashboard/attention')}
                className="text-sm text-teal hover:text-teal-hover underline"
              >
                View all ({attention.data.totalCount})
              </button>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {attention.data.items.slice(0, 5).map((item) => (
              <AttentionItemCard
                key={item.id}
                type={item.type}
                description={item.description}
                mdaName={item.mdaName}
                category={item.category}
                count={item.count}
                amount={item.amount}
                drillDownUrl={item.drillDownUrl}
                timestamp={item.timestamp}
              />
            ))}
          </div>
        </section>
      )}

      {/* MDA Review Progress */}
      {latestUploadId && (
        <section aria-label="MDA review progress">
          <MdaReviewProgressTracker uploadId={latestUploadId} allUploads />
        </section>
      )}

      {/* Migration Dashboard */}
      <section aria-labelledby="migration-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="migration-heading" className="text-lg font-semibold text-text-primary">
            Migration Status
          </h2>
          <button
            type="button"
            onClick={() => navigate('/dashboard/migration')}
            className="text-sm text-teal hover:text-teal-hover underline"
          >
            View All MDAs
          </button>
        </div>

        <Input
          placeholder="Filter by MDA name..."
          value={mdaFilter}
          onChange={(e) => setMdaFilter(e.target.value)}
          className="mb-4 max-w-sm"
        />

        {isMigrationPending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full rounded-lg" />
            ))}
          </div>
        ) : !filteredMigration || filteredMigration.length === 0 ? (
          <p className="text-sm text-text-muted py-4">
            {mdaFilter
              ? `No MDAs matching "${mdaFilter}".`
              : 'No migration data available.'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMigration.map((mda) => (
              <MigrationProgressCard
                key={mda.mdaId}
                mdaName={mda.mdaName}
                mdaCode={mda.mdaCode}
                stage={mda.stage}
                recordCounts={mda.recordCounts}
                lastActivity={mda.lastActivity ?? undefined}
                onClick={() => navigate(`/dashboard/mda/${mda.mdaId}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Loan Search */}
      <section aria-labelledby="loan-search-heading">
        <h2 id="loan-search-heading" className="text-lg font-semibold text-text-primary mb-3">
          Loan Search
        </h2>

        <div className="relative max-w-md mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" aria-hidden="true" />
          <Input
            placeholder="Search by name, Staff ID, or loan reference..."
            value={loanQuery}
            onChange={(e) => setLoanQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {debouncedLoanQuery.length >= 2 && isLoanPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : debouncedLoanQuery.length >= 2 &&
          loanResults &&
          loanResults.length === 0 ? (
          <p className="text-sm text-text-muted py-4">
            No records found for &ldquo;{debouncedLoanQuery}&rdquo;
          </p>
        ) : debouncedLoanQuery.length >= 2 && loanResults && loanResults.length > 0 ? (
          <div className="space-y-2">
            {loanResults.map((result) => (
              <div
                key={result.loanId}
                role="button"
                tabIndex={0}
                onClick={() =>
                  navigate(`/dashboard/mda/_/loan/${result.loanId}`)
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/dashboard/mda/_/loan/${result.loanId}`);
                  }
                }}
                className="flex items-center justify-between gap-4 rounded-lg border bg-white px-4 py-3 cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {result.staffName}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {result.staffId && (
                      <span className="text-xs text-text-muted font-mono">
                        {result.staffId}
                      </span>
                    )}
                    <span className="text-xs text-text-secondary">{result.mdaName}</span>
                    <span className="text-xs text-text-muted font-mono">
                      {result.loanReference}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <NairaDisplay amount={result.outstandingBalance} variant="table" />
                  <p className="text-[11px] text-text-muted mt-0.5">Outstanding</p>
                </div>
              </div>
            ))}
          </div>
        ) : debouncedLoanQuery.length > 0 && debouncedLoanQuery.length < 2 ? (
          <p className="text-sm text-text-muted py-2">Type at least 2 characters to search.</p>
        ) : null}
      </section>

      {/* Exception Queue */}
      <section aria-labelledby="exceptions-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="exceptions-heading" className="text-lg font-semibold text-text-primary">
            Exception Queue
          </h2>
          <div className="flex items-center gap-3">
            {exceptionCounts && (
              <div className="flex items-center gap-1.5 text-xs">
                <Badge variant="outline">{exceptionCounts.high} High</Badge>
                <Badge variant="review">{exceptionCounts.medium} Med</Badge>
                <Badge variant="info">{exceptionCounts.low} Low</Badge>
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate('/dashboard/exceptions')}
              className="text-sm text-teal hover:text-teal-hover underline"
            >
              View All
            </button>
          </div>
        </div>

        {isExceptionsPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : sortedExceptions.length === 0 ? (
          <ExceptionEmptyState />
        ) : (
          <div className="space-y-2">
            {sortedExceptions.map((item) => (
              <ExceptionQueueRow
                key={item.id}
                priority={item.priority}
                category={item.category}
                staffId={item.staffId ?? undefined}
                staffName={item.staffName}
                mdaName={item.mdaName}
                description={item.description}
                createdAt={item.createdAt}
                status={item.status}
                onClick={() => navigate(`/dashboard/exceptions/${item.id}`)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-lg font-semibold text-text-primary mb-3">
          Quick Actions
        </h2>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard/placeholder/generate-report')}
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Generate Report
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard/placeholder/employment-event')}
          >
            <Briefcase className="h-4 w-4" aria-hidden="true" />
            File Employment Event
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/dashboard/placeholder/early-exit')}
          >
            <Calculator className="h-4 w-4" aria-hidden="true" />
            Compute Early Exit
          </Button>
        </div>
      </section>
    </div>
  );
}

export { OperationsHubPage as Component };
