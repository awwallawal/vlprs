import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/formatters';
import { UI_COPY } from '@vlprs/shared';

const priorityConfig = {
  high: { border: 'border-l-danger', label: 'High', badgeVariant: 'outline' as const },
  medium: { border: 'border-l-gold', label: 'Medium', badgeVariant: 'review' as const },
  low: { border: 'border-l-teal', label: 'Low', badgeVariant: 'info' as const },
};

interface ExceptionQueueRowProps {
  priority: 'high' | 'medium' | 'low';
  category: string;
  staffId?: string;
  staffName?: string;
  mdaName: string;
  description: string;
  createdAt: string;
  status?: 'open' | 'resolved';
  onClick?: () => void;
  className?: string;
}

export function ExceptionQueueRow({
  priority,
  category,
  staffId,
  staffName,
  mdaName,
  description,
  createdAt,
  status = 'open',
  onClick,
  className,
}: ExceptionQueueRowProps) {
  const config = priorityConfig[priority];
  const isResolved = status === 'resolved';

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-lg border border-l-4 bg-white px-4 py-3 transition-colors',
        config.border,
        isResolved && 'opacity-60',
        onClick && 'cursor-pointer hover:bg-surface',
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
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant={config.badgeVariant}>{config.label}</Badge>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn('text-sm font-medium text-text-primary', isResolved && 'line-through')}>
            {mdaName}
          </span>
          <Badge variant="pending">{category.replace(/_/g, ' ')}</Badge>
        </div>
        <p className={cn('text-sm text-text-secondary truncate', isResolved && 'line-through')}>
          {description}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {staffName && (
            <span className="text-xs text-text-muted">
              {staffName}{staffId ? ` (${staffId})` : ''}
            </span>
          )}
          <time className="text-xs text-text-muted">{formatDateTime(createdAt)}</time>
        </div>
      </div>
    </div>
  );
}

interface ExceptionEmptyStateProps {
  className?: string;
}

export function ExceptionEmptyState({ className }: ExceptionEmptyStateProps) {
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-text-secondary', className)}>
      <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
      <span>{UI_COPY.EMPTY_EXCEPTIONS}</span>
    </div>
  );
}
