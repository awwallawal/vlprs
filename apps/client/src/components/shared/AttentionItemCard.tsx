import { Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/formatters';
import { UI_COPY } from '@vlprs/shared';

interface AttentionItemCardProps {
  description: string;
  mdaName: string;
  category: 'review' | 'info' | 'complete';
  timestamp: string;
  isNew?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AttentionItemCard({
  description,
  mdaName,
  category,
  timestamp,
  isNew,
  onClick,
  className,
}: AttentionItemCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg bg-attention-bg p-4 transition-colors',
        isNew && 'border-l-[3px] border-l-teal',
        onClick && 'cursor-pointer hover:bg-gold-50/80',
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
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text-primary truncate">{mdaName}</span>
            <Badge variant={category}>{category}</Badge>
          </div>
          <p className="text-sm text-text-secondary">{description}</p>
          <time className="text-xs text-text-muted mt-1 block">{formatDateTime(timestamp)}</time>
        </div>
      </div>
    </div>
  );
}

interface AttentionEmptyStateProps {
  className?: string;
}

export function AttentionEmptyState({ className }: AttentionEmptyStateProps) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-text-secondary', className)}>
      <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
      <span>{UI_COPY.EMPTY_ATTENTION}</span>
    </div>
  );
}
