import { FileSpreadsheet, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { usePageMeta } from '@/hooks/usePageMeta';
import { DOWNLOADS_PAGE, DOWNLOAD_RESOURCES } from '@/content/downloads';
import { FINAL_CTA } from '@/content/homepage';

const FORMAT_ICONS = {
  CSV: FileSpreadsheet,
  PDF: FileText,
};

const FORMAT_COLOURS = {
  CSV: 'text-green-600',
  PDF: 'text-red-500',
};

export function DownloadsPage() {
  usePageMeta(DOWNLOADS_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={DOWNLOADS_PAGE.title} subtitle={DOWNLOADS_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {DOWNLOAD_RESOURCES.map((resource) => {
            const Icon = FORMAT_ICONS[resource.format];
            const isAvailable = resource.status === 'available';

            return (
              <div
                key={resource.name}
                className={`border border-slate-200 rounded-lg p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200 ${!isAvailable ? 'opacity-80 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-6 w-6 ${FORMAT_COLOURS[resource.format]}`} />
                    <h3 className="font-semibold text-slate-900">{resource.name}</h3>
                  </div>
                  <Badge variant="secondary">{resource.format}</Badge>
                </div>
                <p className="text-sm text-slate-600 mb-4">{resource.description}</p>
                <div className="flex items-center justify-between">
                  {resource.fileSize && (
                    <span className="text-xs text-slate-400">{resource.fileSize}</span>
                  )}
                  {isAvailable && resource.downloadUrl ? (
                    <Button asChild variant="secondary" size="sm">
                      <a href={resource.downloadUrl} download>
                        Download
                      </a>
                    </Button>
                  ) : (
                    <Badge variant="secondary">Coming Soon</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CtaBanner
        heading={FINAL_CTA.heading}
        description={FINAL_CTA.description}
        primaryCta={FINAL_CTA.primaryCta}
        secondaryCta={FINAL_CTA.secondaryCta}
        variant="light"
      />
    </>
  );
}
