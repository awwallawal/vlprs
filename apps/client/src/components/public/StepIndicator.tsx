import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  step: number;
  title: string;
  description: string;
  icon: LucideIcon;
  isLast?: boolean;
  className?: string;
}

export function StepIndicator({
  step,
  title,
  description,
  icon: Icon,
  isLast = false,
  className,
}: StepIndicatorProps) {
  return (
    <div className={cn('relative flex flex-col items-center text-center', className)}>
      {/* Icon circle with step badge */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-full bg-crimson-50 flex items-center justify-center">
          <Icon className="w-7 h-7 text-crimson" />
        </div>
        <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-crimson text-white text-sm font-semibold flex items-center justify-center">
          {step}
        </span>
      </div>

      {/* Text */}
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-2">
        {title}
      </h3>
      <p className="text-sm text-slate-600 max-w-[200px]">{description}</p>

      {/* Connector — desktop horizontal */}
      {!isLast && (
        <div className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-0.5 bg-slate-200" />
      )}
      {/* Connector — mobile vertical */}
      {!isLast && (
        <div className="lg:hidden absolute top-16 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-200" />
      )}
    </div>
  );
}
