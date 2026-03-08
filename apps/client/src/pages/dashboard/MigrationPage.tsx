import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMigrationStatus, useMigrationDashboardMetrics } from '@/hooks/useMigrationData';
import { MigrationProgressCard } from '@/components/shared/MigrationProgressCard';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { MigrationProgressBar } from './components/MigrationProgressBar';
import { MasterBeneficiaryLedger } from './components/MasterBeneficiaryLedger';
import { ObservationsList } from './components/ObservationsList';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageMeta } from '@/hooks/usePageMeta';
import { VOCABULARY } from '@vlprs/shared';

type Tab = 'mda-progress' | 'beneficiary-ledger' | 'observations';

export function MigrationPage() {
  usePageMeta({ title: VOCABULARY.MIGRATION_DASHBOARD_TITLE, description: 'Migration progress and beneficiary ledger' });

  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('mda-progress');
  const [mdaFilter, setMdaFilter] = useState('');

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
      <WelcomeGreeting subtitle={VOCABULARY.MIGRATION_DASHBOARD_TITLE} />

      {/* Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeroMetricCard
          label="Total Staff Migrated"
          value={metrics?.totalStaffMigrated ?? 0}
          format="count"
          isPending={isMetricsPending}
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
                  observationCount={mda.observationCount}
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
    </div>
  );
}

export { MigrationPage as Component };
