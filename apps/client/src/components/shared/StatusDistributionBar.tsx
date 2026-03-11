import { cn } from '@/lib/utils';
import type { StatusDistribution } from '@vlprs/shared';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface StatusDistributionBarProps {
  distribution: StatusDistribution;
  className?: string;
}

const SEGMENT_CONFIG = [
  { key: 'completed' as const, label: 'Completed', color: 'bg-green-500' },
  { key: 'onTrack' as const, label: 'On-Track', color: 'bg-teal' },
  { key: 'overdue' as const, label: 'Overdue', color: 'bg-amber-500' },
  { key: 'stalled' as const, label: 'Stalled', color: 'bg-slate-400' },
  { key: 'overDeducted' as const, label: 'Over-Deducted', color: 'bg-teal-300' },
];

export function StatusDistributionBar({ distribution, className }: StatusDistributionBarProps) {
  const total =
    distribution.completed +
    distribution.onTrack +
    distribution.overdue +
    distribution.stalled +
    distribution.overDeducted;

  if (total === 0) {
    return (
      <div
        className={cn('h-2 w-full rounded-full bg-slate-100', className)}
        aria-label="Status distribution: no loans"
      />
    );
  }

  const segments = SEGMENT_CONFIG
    .filter(({ key }) => distribution[key] > 0)
    .map(({ key, label, color }) => ({
      key,
      label,
      color,
      count: distribution[key],
      percent: (distribution[key] / total) * 100,
    }));

  const ariaLabel = `Status distribution: ${segments.map((s) => `${s.count} ${s.label.toLowerCase()}`).join(', ')}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn('flex h-2 w-full overflow-hidden rounded-full bg-slate-100', className)}
            aria-label={ariaLabel}
            role="img"
          >
            {segments.map((segment) => (
              <div
                key={segment.key}
                className={cn('h-full transition-all', segment.color)}
                style={{ width: `${segment.percent}%` }}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center gap-2">
                <div className={cn('h-2 w-2 rounded-full', segment.color)} />
                <span>{segment.label}: {segment.count} ({segment.percent.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
