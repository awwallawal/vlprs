import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatCount } from '@/lib/formatters';
import { NairaDisplay } from './NairaDisplay';
import { Skeleton } from '@/components/ui/skeleton';

function useCountUp(target: number, duration = 200) {
  const [current, setCurrent] = useState(0);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (prefersReducedMotion.current) {
      setCurrent(target);
      return;
    }

    const start = performance.now();
    let rafId: number;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    }

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);

  return current;
}

interface HeroMetricCardProps {
  label: string;
  value: string | number;
  format: 'currency' | 'count' | 'percentage';
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
  onClick?: () => void;
  isPending?: boolean;
  className?: string;
}

const trendConfig = {
  up: { arrow: '\u2191', color: 'text-success' },
  down: { arrow: '\u2193', color: 'text-teal' },
  flat: { arrow: '\u2192', color: 'text-text-secondary' },
};

export function HeroMetricCard({
  label,
  value,
  format,
  trend,
  onClick,
  isPending: loading,
  className,
}: HeroMetricCardProps) {
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;
  const animatedCount = useCountUp(format === 'count' ? numericValue : 0);

  if (loading) {
    return (
      <div className={cn('rounded-lg border bg-white p-6', className)} data-testid="hero-metric-skeleton">
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-1 h-9 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }

  const displayValue = () => {
    switch (format) {
      case 'currency':
        return <NairaDisplay amount={String(value)} variant="hero" />;
      case 'count':
        return (
          <span
            className="text-4xl font-bold font-mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatCount(animatedCount)}
          </span>
        );
      case 'percentage':
        return (
          <span
            className="text-4xl font-bold font-mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {typeof value === 'number' ? value.toFixed(1) : value}%
          </span>
        );
    }
  };

  const ariaLabel = onClick
    ? `${label}: ${format === 'currency' ? `₦${value}` : value}. Click to view breakdown`
    : `${label}: ${format === 'currency' ? `₦${value}` : value}`;

  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-6 transition-shadow',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
      role={onClick ? 'link' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <p className="text-sm text-text-secondary mb-1">{label}</p>
      <div className="mb-1">{displayValue()}</div>
      {trend && (
        <p className={cn('text-xs', trendConfig[trend.direction].color)}>
          <span aria-hidden="true">{trendConfig[trend.direction].arrow}</span>{' '}
          {trend.label}
        </p>
      )}
    </div>
  );
}
