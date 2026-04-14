import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Upload } from 'lucide-react';
import { useMigrationStatus, useMigrationDashboardMetrics } from '@/hooks/useMigrationData';
import { useAuthStore } from '@/stores/authStore';
import { MigrationProgressCard } from '@/components/shared/MigrationProgressCard';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { MigrationProgressBar } from './components/MigrationProgressBar';
import { MasterBeneficiaryLedger } from './components/MasterBeneficiaryLedger';
import { ObservationsList } from './components/ObservationsList';
import { DuplicateResolutionTable } from './components/DuplicateResolutionTable';
import { MigrationCoverageTracker } from './components/MigrationCoverageTracker';
import { MigrationUploadList } from './components/MigrationUploadList';
import { MdaReviewProgressTracker } from './components/MdaReviewProgressTracker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useListMigrations } from '@/hooks/useMigration';
import { ROLES, VOCABULARY } from '@vlprs/shared';

type Tab = 'mda-progress' | 'beneficiary-ledger' | 'observations' | 'duplicates' | 'coverage' | 'uploads' | 'mda-review';

const VALID_TABS = new Set<Tab>(['mda-progress', 'beneficiary-ledger', 'observations', 'duplicates', 'coverage', 'uploads', 'mda-review']);

function parseTab(raw: string | null): Tab | null {
  return raw && VALID_TABS.has(raw as Tab) ? (raw as Tab) : null;
}

export function MigrationPage() {
  usePageMeta({ title: VOCABULARY.MIGRATION_DASHBOARD_TITLE, description: 'Migration progress and beneficiary ledger' });

  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canUpload = user?.role === ROLES.DEPT_ADMIN || user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.MDA_OFFICER;
  const isAdminOrOfficer = canUpload || user?.role === ROLES.MDA_OFFICER;
  const [searchParams] = useSearchParams();
  const isOfficer = user?.role === ROLES.MDA_OFFICER;
  const uploads = useListMigrations({ limit: 1 });
  const latestUploadId = uploads.data?.data?.[0]?.id ?? '';
  const [activeTab, setActiveTab] = useState<Tab>(
    parseTab(searchParams.get('tab')) ?? (isOfficer ? 'mda-review' : 'mda-progress'),
  );
  const [mdaFilter, setMdaFilter] = useState('');

  // Sync tab state when URL search params change (e.g., sidebar re-click)
  useEffect(() => {
    const tab = parseTab(searchParams.get('tab'));
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const { data: migrationData, isPending: isMigrationPending } = useMigrationStatus();
  const { data: metrics, isPending: isMetricsPending } = useMigrationDashboardMetrics();

  const filteredMigration = migrationData?.filter((m) =>
    m.mdaName.toLowerCase().includes(mdaFilter.toLowerCase()),
  );

  const totalMdas = migrationData?.length ?? 0;
  const mdasComplete = migrationData?.filter((m) => m.stage === 'reconciled' || m.stage === 'certified').length ?? 0;
  const mdasWithData = migrationData?.filter((m) => m.stage !== 'pending').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <WelcomeGreeting subtitle={VOCABULARY.MIGRATION_DASHBOARD_TITLE} />
        {canUpload && (
          <Button
            onClick={() => navigate('/dashboard/migration/upload')}
            className="gap-2 shrink-0"
          >
            <Upload className="h-4 w-4" />
            {user?.role === ROLES.MDA_OFFICER ? 'Upload My MDA Data' : 'Upload Legacy Data'}
          </Button>
        )}
      </div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <HeroMetricCard
          label="Total Staff Migrated"
          value={metrics?.totalStaffMigrated ?? 0}
          format="count"
          isPending={isMetricsPending}
          helpKey="migration.totalStaffMigrated"
        />
        <HeroMetricCard
          label="Total Exposure"
          value={metrics?.totalExposure ?? '0.00'}
          format="currency"
          isPending={isMetricsPending}
        />
        <HeroMetricCard
          label="MDAs Complete"
          value={metrics?.mdasComplete ?? 0}
          format="count"
          isPending={isMetricsPending}
        />
        <HeroMetricCard
          label="Baselines Established"
          value={metrics?.baselinesEstablished ?? 0}
          format="count"
          isPending={isMetricsPending}
          helpKey="migration.baselinesEstablished"
        />
        <HeroMetricCard
          label="Pending Duplicates"
          value={metrics?.pendingDuplicates ?? 0}
          format="count"
          isPending={isMetricsPending}
        />
      </div>

      {/* Overall Progress Bar */}
      {isMigrationPending ? (
        <Skeleton className="h-16 w-full rounded-lg" />
      ) : (
        <MigrationProgressBar
          mdasComplete={mdasComplete}
          mdasWithData={mdasWithData}
          totalMdas={totalMdas}
        />
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('mda-progress')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'mda-progress'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          MDA Progress
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('beneficiary-ledger')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'beneficiary-ledger'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Master Beneficiary Ledger
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('observations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'observations'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Observations
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('duplicates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'duplicates'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Duplicates
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('coverage')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'coverage'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Coverage Tracker
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('uploads')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'uploads'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Uploads
        </button>
        {isAdminOrOfficer && (
          <button
            type="button"
            onClick={() => setActiveTab('mda-review')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'mda-review'
                ? 'border-teal text-teal'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            MDA Review
          </button>
        )}
      </div>

      {/* MDA Progress Tab */}
      {activeTab === 'mda-progress' && (
        <section aria-label="MDA Migration Progress">
          <Input
            placeholder="Filter by MDA name..."
            value={mdaFilter}
            onChange={(e) => setMdaFilter(e.target.value)}
            className="mb-4 max-w-sm"
          />

          {isMigrationPending ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-lg" />
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
                  baselineCompletion={mda.baselineCompletion}
                  onClick={() => navigate(`/dashboard/mda/${mda.mdaId}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Master Beneficiary Ledger Tab */}
      {activeTab === 'beneficiary-ledger' && (
        <section aria-label={VOCABULARY.BENEFICIARY_LEDGER_TITLE}>
          <MasterBeneficiaryLedger />
        </section>
      )}

      {/* Observations Tab */}
      {activeTab === 'observations' && (
        <section aria-label="Observations">
          <ObservationsList />
        </section>
      )}

      {/* Duplicates Tab */}
      {activeTab === 'duplicates' && (
        <section aria-label="Potential Duplicates">
          <DuplicateResolutionTable />
        </section>
      )}

      {/* Coverage Tracker Tab */}
      {activeTab === 'coverage' && (
        <section aria-label="Migration Coverage Tracker">
          <MigrationCoverageTracker />
        </section>
      )}

      {/* Uploads Tab */}
      {activeTab === 'uploads' && (
        <section aria-label="Migration Upload History">
          <MigrationUploadList />
        </section>
      )}

      {/* MDA Review Tab (Story 8.0j) — UAT 2026-04-14: aggregate across all uploads */}
      {activeTab === 'mda-review' && latestUploadId && (
        <section aria-label="MDA Review Progress">
          <MdaReviewProgressTracker uploadId={latestUploadId} allUploads />
        </section>
      )}
    </div>
  );
}

export { MigrationPage as Component };
