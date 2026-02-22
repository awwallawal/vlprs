import { Link } from 'react-router';
import { ArrowRight, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FeatureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  linkText: string;
  linkHref: string;
  className?: string;
}

export function FeatureCard({
  title,
  description,
  icon: Icon,
  linkText,
  linkHref,
  className,
}: FeatureCardProps) {
  return (
    <Card
      className={cn(
        'group h-full hover:border-crimson-300 hover:shadow-md transition-all duration-200',
        className,
      )}
    >
      <CardContent className="flex flex-col h-full p-6">
        <div className="w-12 h-12 rounded-lg bg-crimson-50 flex items-center justify-center mb-4">
          <Icon className="h-6 w-6 text-crimson" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4 flex-1">{description}</p>
        <Link
          to={linkHref}
          className="inline-flex items-center text-sm font-medium text-crimson hover:text-crimson-dark transition-colors"
        >
          {linkText}
          <ArrowRight className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}
