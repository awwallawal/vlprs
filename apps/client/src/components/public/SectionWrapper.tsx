import { cn } from '@/lib/utils';

const VARIANT_STYLES = {
  default: 'bg-white',
  light: 'bg-slate-50',
  dark: 'bg-slate-900 text-white',
  primary: 'bg-crimson-50',
} as const;

interface SectionWrapperProps {
  children: React.ReactNode;
  className?: string;
  variant?: keyof typeof VARIANT_STYLES;
  id?: string;
}

export function SectionWrapper({
  children,
  className,
  variant = 'default',
  id,
}: SectionWrapperProps) {
  return (
    <section id={id} className={cn('py-16 lg:py-24', VARIANT_STYLES[variant], className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}
