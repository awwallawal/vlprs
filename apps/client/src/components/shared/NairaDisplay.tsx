import { cn } from '@/lib/utils';
import { formatNaira } from '@/lib/formatters';

const variantStyles = {
  hero: 'text-4xl font-bold',
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
  let displayValue = formatNaira(amount);

  // Compact variant: strip trailing .00 for round numbers
  if (variant === 'compact' && displayValue.endsWith('.00')) {
    displayValue = displayValue.slice(0, -3);
  }

  return (
    <span
      className={cn('font-mono', variantStyles[variant], className)}
      style={{ fontVariantNumeric: 'tabular-nums' }}
      aria-label={formatNaira(amount)}
    >
      {displayValue}
    </span>
  );
}
