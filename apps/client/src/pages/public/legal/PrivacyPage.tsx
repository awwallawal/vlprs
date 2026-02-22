import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { PRIVACY_PAGE, PRIVACY_SECTIONS } from '@/content/privacy';

export function PrivacyPage() {
  usePageMeta(PRIVACY_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={PRIVACY_PAGE.title} subtitle={PRIVACY_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="space-y-8">
          {PRIVACY_SECTIONS.map((section) => (
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
