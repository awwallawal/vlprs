import { formatDateTime } from '@/lib/formatters';

export function BuildStatus() {
  const sprintLabel = import.meta.env.VITE_SPRINT_LABEL || 'Sprint 1';
  const nextMilestone = import.meta.env.VITE_NEXT_MILESTONE || '';
  const deployTimestamp = import.meta.env.VITE_DEPLOY_TIMESTAMP || '';

  return (
    <div className="space-y-0.5 text-[10px] leading-tight">
      <p className="font-semibold">{sprintLabel}</p>
      {deployTimestamp && (
        <p className="opacity-60">
          Deployed: {formatDateTime(deployTimestamp)}
        </p>
      )}
      {nextMilestone && (
        <p className="opacity-50">
          Next: {nextMilestone}
        </p>
      )}
    </div>
  );
}
