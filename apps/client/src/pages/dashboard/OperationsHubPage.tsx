import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { FileText, Briefcase, Calculator, Search } from 'lucide-react';
import { useMigrationStatus } from '@/hooks/useMigrationData';
import { useLoanSearch } from '@/hooks/useLoanData';
import { useExceptionQueue } from '@/hooks/useExceptionData';
import { MigrationProgressCard } from '@/components/shared/MigrationProgressCard';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { ExceptionQueueRow, ExceptionEmptyState } from '@/components/shared/ExceptionQueueRow';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
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
  const sortedExceptions = exceptions
    ? [...exceptions].sort(
        (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9),
      )
    : [];

  return (
    <div className="space-y-10">
      {/* Welcome greeting + page heading */}
      <WelcomeGreeting subtitle="Here's your operations overview" />
      <h1 className="text-2xl font-bold text-text-primary">Operations Hub</h1>

      {/* Migration Dashboard */}
      <section aria-labelledby="migration-heading">
        <h2 id="migration-heading" className="text-lg font-semibold text-text-primary mb-3">
          Migration Status
        </h2>

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
        <h2 id="exceptions-heading" className="text-lg font-semibold text-text-primary mb-3">
          Exception Queue
        </h2>

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
