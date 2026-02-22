import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { ACCESSIBILITY_PAGE, ACCESSIBILITY_SECTIONS } from '@/content/accessibility-statement';

export function AccessibilityPage() {
  usePageMeta(ACCESSIBILITY_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={ACCESSIBILITY_PAGE.title} subtitle={ACCESSIBILITY_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-8">
          {ACCESSIBILITY_SECTIONS.map((section) => (
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
