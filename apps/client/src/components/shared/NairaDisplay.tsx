import { cn } from '@/lib/utils';
import { formatNaira, formatCompactNaira } from '@/lib/formatters';

const variantStyles = {
  hero: 'text-2xl sm:text-3xl xl:text-4xl font-bold',
  body: 'text-base',
  table: 'text-sm',
  compact: 'text-sm',
};

interface NairaDisplayProps {
  amount: string;
  variant?: 'hero' | 'body' | 'table' | 'compact';
  className?: string;
}

export function NairaDisplay({ amount, variant = 'body', className }: NairaDisplayProps) {
  const fullValue = formatNaira(amount);

  let displayValue = fullValue;

  // Hero variant: use compact notation (₦2.42B) for large numbers
  if (variant === 'hero') {
    displayValue = formatCompactNaira(amount);
  }

  // Compact variant: strip trailing .00 for round numbers
  if (variant === 'compact' && displayValue.endsWith('.00')) {
    displayValue = displayValue.slice(0, -3);
  }

  return (
    <span
      className={cn('font-mono', variantStyles[variant], className)}
      style={{ fontVariantNumeric: 'tabular-nums' }}
      title={variant === 'hero' ? fullValue : undefined}
      aria-label={fullValue}
    >
      {displayValue}
    </span>
  );
}
