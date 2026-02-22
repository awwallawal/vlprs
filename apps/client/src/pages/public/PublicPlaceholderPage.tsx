import { useLocation } from 'react-router';
import { Link } from 'react-router';
import { Construction } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';

const ROUTE_STORIES: Record<string, string> = {
  '/about': 'Story 14.2',
  '/scheme/overview': 'Story 14.2',
  '/scheme/about-vlprs': 'Story 14.2',
  '/scheme/eligibility': 'Story 14.2',
  '/scheme/repayment': 'Story 14.2',
  '/how-it-works': 'Story 14.2',
  '/resources/faq': 'Story 14.3',
  '/resources/submission-guide': 'Story 14.3',
  '/resources/downloads': 'Story 14.3',
  '/resources/news': 'Story 14.3',
  '/resources/beneficiary-lists': 'Story 14.3',
  '/support': 'Story 14.3',
  '/privacy': 'Story 14.3',
  '/accessibility': 'Story 14.3',
  '/disclaimer': 'Story 14.3',
  '/eoi': 'Story 14.3',
};

export function PublicPlaceholderPage() {
  const location = useLocation();
  const story = ROUTE_STORIES[location.pathname] ?? 'a future story';

  const pageName = location.pathname
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Page';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbNav />
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Construction className="h-16 w-16 text-slate-300" />
        <h1 className="text-2xl font-brand font-bold text-slate-900">{pageName}</h1>
        <p className="text-slate-600">
          This page is coming in {story}.
        </p>
        <Button asChild variant="outline" className="mt-4 min-h-[44px]">
          <Link to="/">&larr; Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
