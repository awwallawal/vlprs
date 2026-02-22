import { cn } from '@/lib/utils';

interface ContentPageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

export function ContentPageHeader({
  title,
  subtitle,
  children,
  className,
}: ContentPageHeaderProps) {
  return (
    <div className={cn('bg-gradient-to-b from-crimson-25 to-white', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
        {/* Children slot — typically BreadcrumbNav */}
        {children}
        <h1 className="text-3xl sm:text-4xl font-brand font-semibold text-slate-900 mt-2">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 text-lg text-slate-600 max-w-3xl">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
