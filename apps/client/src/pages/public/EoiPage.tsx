import { FileText } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { DisclaimerCallout } from '@/components/public/DisclaimerCallout';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { EOI_PAGE, EOI_DESCRIPTION, EOI_DISCLAIMER, EOI_LINKS } from '@/content/eoi';

export function EoiPage() {
  usePageMeta(EOI_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={EOI_PAGE.title}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto text-center py-24">
          <div className="border border-slate-200 rounded-lg shadow-sm p-8 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
            <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-900 mb-3">
              {EOI_PAGE.title}
            </h2>
            <Badge variant="secondary" className="mb-4">
              Coming Soon (Phase 2)
            </Badge>
            <p className="text-slate-600 mb-6">{EOI_DESCRIPTION}</p>

            <div className="mb-6">
              <DisclaimerCallout>{EOI_DISCLAIMER}</DisclaimerCallout>
            </div>

            <p className="text-xs text-slate-400 mb-6">Expected: Phase 2 release</p>
            <div className="flex flex-col gap-2">
              {EOI_LINKS.map((link) => (
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
