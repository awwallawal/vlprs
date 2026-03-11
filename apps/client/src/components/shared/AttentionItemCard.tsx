import { useNavigate } from 'react-router';
import {
  Info,
  CheckCircle2,
  AlertCircle,
  Clock,
  UserX,
  Pause,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { formatDateTime } from '@/lib/formatters';
import { UI_COPY } from '@vlprs/shared';
import type { AttentionItemType } from '@vlprs/shared';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>> = {
  zero_deduction: AlertCircle,
  post_retirement_active: Clock,
  missing_staff_id: UserX,
  overdue_loans: AlertCircle,
  stalled_deductions: Pause,
  quick_win: Zap,
};

const COUNT_UNIT: Partial<Record<AttentionItemType, [string, string]>> = {
  missing_staff_id: ['record', 'records'],
};
const DEFAULT_UNIT: [string, string] = ['loan', 'loans'];

interface AttentionItemCardProps {
  description: string;
  mdaName: string;
  category: 'review' | 'info' | 'complete';
  timestamp: string;
  type?: AttentionItemType;
  count?: number;
  amount?: string;
  drillDownUrl?: string;
  isNew?: boolean;
  className?: string;
}

export function AttentionItemCard({
  description,
  mdaName,
  category,
  timestamp,
  type,
  count,
  amount,
  drillDownUrl,
  isNew,
  className,
}: AttentionItemCardProps) {
  const navigate = useNavigate();
  const Icon = (type && ICON_MAP[type]) || Info;
  const isNavigable = !!drillDownUrl;
  const [countSingular, countPlural] = (type && COUNT_UNIT[type]) || DEFAULT_UNIT;

  const handleClick = isNavigable
    ? () => navigate(drillDownUrl!)
    : undefined;

  return (
    <div
      className={cn(
        'rounded-lg bg-attention-bg p-4 transition-colors',
        isNew && 'border-l-[3px] border-l-teal',
        isNavigable && 'cursor-pointer hover:bg-gold-50/80',
        className,
      )}
      role={isNavigable ? 'button' : undefined}
      tabIndex={isNavigable ? 0 : undefined}
      aria-label={isNavigable ? `${mdaName}: ${description}` : undefined}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (handleClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text-primary truncate">{mdaName}</span>
            <Badge variant={category}>{category}</Badge>
            {count != null && (
              <span className="text-xs font-medium text-text-secondary">
                {count} {count === 1 ? countSingular : countPlural}
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary">{description}</p>
          {amount && (
            <div className="mt-1">
              <NairaDisplay amount={amount} variant="compact" className="text-xs text-text-secondary" />
            </div>
          )}
          <time className="text-xs text-text-muted mt-1 block">{formatDateTime(timestamp)}</time>
        </div>
        {isNavigable && (
          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-text-muted" aria-hidden="true" />
        )}
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
