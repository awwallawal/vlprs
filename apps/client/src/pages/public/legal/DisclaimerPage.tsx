import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { DISCLAIMER_PAGE, DISCLAIMER_SECTIONS } from '@/content/programme-disclaimer';

export function DisclaimerPage() {
  usePageMeta(DISCLAIMER_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={DISCLAIMER_PAGE.title} subtitle={DISCLAIMER_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-8">
          {DISCLAIMER_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-brand font-bold text-slate-900 mb-3">{section.title}</h2>
              <p className="text-slate-700 leading-relaxed">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
