import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  children: React.ReactNode;
  className?: string;
  subtitle?: string;
  centered?: boolean;
}

export function SectionHeading({
  children,
  className,
  subtitle,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div className={cn('mb-10 lg:mb-12', centered && 'text-center', className)}>
      <h2
        className={cn(
          'text-2xl sm:text-3xl lg:text-4xl font-brand font-semibold text-slate-900',
        )}
      >
        {children}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'mt-4 text-lg text-slate-600 max-w-3xl',
            centered && 'mx-auto',
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
