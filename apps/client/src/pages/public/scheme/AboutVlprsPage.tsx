import { CheckCircle, XCircle } from 'lucide-react';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { SectionHeading } from '@/components/public/SectionHeading';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  ABOUT_VLPRS_PAGE,
  CORE_PRINCIPLE,
  WHAT_VLPRS_DOES,
  WHAT_VLPRS_DOES_NOT,
} from '@/content/about-vlprs';
import { FINAL_CTA } from '@/content/homepage';

export function AboutVlprsPage() {
  usePageMeta(ABOUT_VLPRS_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={ABOUT_VLPRS_PAGE.title} subtitle={ABOUT_VLPRS_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Core Principle */}
        <section className="mb-12">
          <h2 className="sr-only">Core Principle</h2>
          <blockquote className="bg-slate-50 text-center py-8 rounded-xl text-xl font-medium text-slate-700 px-6">
            &ldquo;{CORE_PRINCIPLE}&rdquo;
          </blockquote>
        </section>

        {/* Does / Does Not */}
        <section className="mb-12">
          <SectionHeading className="mb-6">
            What VLPRS Does &amp; Does Not Do
          </SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Does card */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">What VLPRS Does</h3>
              </div>
              <ul className="space-y-3">
                {WHAT_VLPRS_DOES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-green-800">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Does Not card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="h-6 w-6 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-700">What VLPRS Does NOT Do</h3>
              </div>
              <ul className="space-y-3">
                {WHAT_VLPRS_DOES_NOT.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
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
