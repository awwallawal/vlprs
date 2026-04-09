import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { formatDateTime } from '@/lib/formatters';
import { UI_COPY, VOCABULARY } from '@vlprs/shared';
import type { MigrationStage } from '@vlprs/shared';

const STAGES: MigrationStage[] = ['pending', 'received', 'imported', 'validated', 'reconciled', 'certified'];

const stageIndex = (stage: MigrationStage) => STAGES.indexOf(stage);

interface MigrationProgressCardProps {
  mdaName: string;
  mdaCode: string;
  stage: MigrationStage;
  recordCounts?: { clean: number; minor: number; significant: number; structural: number; anomalous?: number };
  lastActivity?: string;
  baselineCompletion?: { done: number; total: number };
  observationCount?: number;
  onClick?: () => void;
  className?: string;
}

export function MigrationProgressCard({
  mdaName,
  mdaCode,
  stage,
  recordCounts,
  lastActivity,
  baselineCompletion,
  observationCount,
  onClick,
  className,
}: MigrationProgressCardProps) {
  const currentIndex = stageIndex(stage);

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 transition-shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium text-text-primary">{mdaName}</h3>
          <span className="text-xs text-text-muted">{mdaCode}</span>
        </div>
        <Badge variant={stage === 'certified' ? 'complete' : stage === 'pending' ? 'pending' : 'info'}>
          {stage === 'pending' ? 'Data Pending' : stage}
        </Badge>
      </div>

      {/* Progress indicator */}
      <div
        className="flex items-center gap-1 mb-3"
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={6}
        aria-label={`Stage ${currentIndex + 1} of 6: ${stage}`}
      >
        {STAGES.map((s, i) => (
          <div key={s} className="flex items-center">
            <div
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                i < currentIndex && 'bg-success',
                i === currentIndex && 'bg-teal',
                i > currentIndex && 'bg-slate-200',
              )}
              title={`${s}${i < currentIndex ? ' (done)' : i === currentIndex ? ' (current)' : ''}`}
            />
            {i < STAGES.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-4',
                  i < currentIndex ? 'bg-success' : 'bg-slate-200',
                )}
              />
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-text-secondary mb-2">
        {stage === 'pending'
          ? VOCABULARY.DATA_PENDING_NEUTRAL
          : <><span>Stage {currentIndex + 1} of 6: {stage.charAt(0).toUpperCase() + stage.slice(1)}</span><MetricHelp metric="migration.stageProgress" /></>}
      </div>

      {recordCounts && (
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-text-muted">Clean: {recordCounts.clean}</span>
          <span className="text-xs text-text-muted">Minor: {recordCounts.minor}</span>
          <span className="text-xs text-text-muted">Significant: {recordCounts.significant}</span>
          <span className="text-xs text-text-muted">Structural: {recordCounts.structural}</span>
          {typeof recordCounts.anomalous === 'number' && recordCounts.anomalous > 0 && (
            <span className="text-xs text-text-muted">Anomalous: {recordCounts.anomalous}</span>
          )}
        </div>
      )}

      {baselineCompletion && baselineCompletion.total > 0 && (
        <p className="text-xs text-text-muted mb-2">
          Baselines: {baselineCompletion.done}/{baselineCompletion.total}
          <MetricHelp metric="migration.reviewProgress" />
        </p>
      )}

      {typeof observationCount === 'number' && observationCount > 0 && (
        <Badge className="bg-slate-100 text-teal border-slate-200 text-[10px] mb-2">
          {observationCount} observation{observationCount !== 1 ? 's' : ''}
        </Badge>
      )}

      {lastActivity && (
        <time className="text-xs text-text-muted block">{formatDateTime(lastActivity)}</time>
      )}
    </div>
  );
}

interface MigrationEmptyStateProps {
  className?: string;
}

export function MigrationEmptyState({ className }: MigrationEmptyStateProps) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-text-secondary', className)}>
      <span>{UI_COPY.EMPTY_MIGRATION}</span>
    </div>
  );
}
