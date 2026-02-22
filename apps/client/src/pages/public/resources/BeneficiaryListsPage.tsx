import { Clock } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  BENEFICIARY_LISTS_PAGE,
  BENEFICIARY_LISTS_DESCRIPTION,
  BENEFICIARY_LISTS_FEATURES,
  BENEFICIARY_LISTS_LINKS,
} from '@/content/beneficiary-lists';

export function BeneficiaryListsPage() {
  usePageMeta(BENEFICIARY_LISTS_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={BENEFICIARY_LISTS_PAGE.title}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto text-center py-24">
          <div className="border border-slate-200 rounded-lg shadow-sm p-8 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
            <Clock className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              {BENEFICIARY_LISTS_PAGE.title}
            </h2>
            <Badge variant="secondary" className="mb-4">
              Coming Soon (Phase 2)
            </Badge>
            <p className="text-slate-600 mb-4">{BENEFICIARY_LISTS_DESCRIPTION}</p>
            <ul className="text-sm text-slate-500 space-y-1 mb-6">
              {BENEFICIARY_LISTS_FEATURES.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <p className="text-xs text-slate-400 mb-6">Expected: Phase 2 release</p>
            <div className="flex flex-col gap-2">
              {BENEFICIARY_LISTS_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm text-teal hover:underline"
                >
                  → {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
