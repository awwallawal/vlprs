import { Link } from 'react-router';
import { Button } from '@/components/ui/button';

interface CtaBannerProps {
  heading: string;
  description?: string;
  primaryCta: { label: string; href?: string; onClick?: () => void };
  secondaryCta?: { label: string; href: string };
  variant?: 'light' | 'dark';
}

export function CtaBanner({
  heading,
  description,
  primaryCta,
  secondaryCta,
  variant = 'light',
}: CtaBannerProps) {
  const isDark = variant === 'dark';

  return (
    <section
      className={
        isDark
          ? 'bg-slate-900 text-white py-16 text-center'
          : 'bg-slate-50 border rounded-xl py-12 text-center'
      }
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2
          className={`text-2xl sm:text-3xl font-brand font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}
        >
          {heading}
        </h2>
        {description && (
          <p
            className={`max-w-2xl mx-auto mb-8 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
          >
            {description}
          </p>
        )}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          {primaryCta.onClick ? (
            <Button
              size="lg"
              className={
                isDark
                  ? 'bg-white text-slate-900 hover:bg-slate-100 min-h-[44px]'
                  : 'min-h-[44px]'
              }
              onClick={primaryCta.onClick}
            >
              {primaryCta.label}
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className={
                isDark
                  ? 'bg-white text-slate-900 hover:bg-slate-100 min-h-[44px]'
                  : 'min-h-[44px]'
              }
            >
              <Link to={primaryCta.href ?? '/'}>{primaryCta.label}</Link>
            </Button>
          )}
          {secondaryCta && (
            <Button
              asChild
              variant="outline"
              size="lg"
              className={
                isDark
                  ? 'border-white text-white bg-transparent hover:bg-white/10 min-h-[44px]'
                  : 'min-h-[44px]'
              }
            >
              <Link to={secondaryCta.href}>{secondaryCta.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
