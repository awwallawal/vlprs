import { cn } from '@/lib/utils';
import type { HealthBand } from '@vlprs/shared';

interface HealthScoreBadgeProps {
  score: number;
  band: HealthBand;
  className?: string;
}

const BAND_STYLES: Record<HealthBand, { bg: string; text: string; label: string }> = {
  healthy: { bg: 'bg-green-100', text: 'text-green-800', label: 'Healthy' },
  attention: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Attention' },
  'for-review': { bg: 'bg-slate-100', text: 'text-slate-600', label: 'For Review' },
};

export function HealthScoreBadge({ score, band, className }: HealthScoreBadgeProps) {
  const style = BAND_STYLES[band];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        style.bg,
        style.text,
        className,
      )}
      aria-label={`Health score: ${Math.round(score)} — ${style.label}`}
    >
      <span className="font-mono">{Math.round(score)}</span>
      <span>{style.label}</span>
    </span>
  );
}
