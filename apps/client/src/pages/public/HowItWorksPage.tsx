import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { SectionHeading } from '@/components/public/SectionHeading';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  HOW_IT_WORKS_PAGE,
  STEP_SUMMARY,
  STEP_DETAILS,
  POST_COMPLETION,
  HOW_IT_WORKS_DISCLAIMER,
} from '@/content/how-it-works';
import { FINAL_CTA } from '@/content/homepage';

export function HowItWorksPage() {
  usePageMeta(HOW_IT_WORKS_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={HOW_IT_WORKS_PAGE.title} subtitle={HOW_IT_WORKS_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Compact 4-step summary cards */}
        <section className="mb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEP_SUMMARY.map((step) => (
              <div
                key={step.step}
                className="border border-slate-200 rounded-lg p-4 text-center hover:border-crimson-300 hover:shadow-md transition-all duration-200"
              >
                <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-crimson text-white text-sm font-bold mb-3">
                  {step.step}
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{step.title}</h3>
              </div>
            ))}
          </div>
        </section>

        {/* Expanded step sections */}
        <div className="space-y-12 mb-16">
          {STEP_DETAILS.map((step) => (
            <section key={step.step}>
              <SectionHeading className="mb-4">
                Step {step.step}: {step.title}
              </SectionHeading>
              <p className="text-slate-600 font-medium mb-3">{step.description}</p>
              <p className="text-slate-700 leading-relaxed">{step.detail}</p>
            </section>
          ))}
        </div>

        {/* What Happens After Completion */}
        <section className="mb-12">
          <SectionHeading className="mb-4">{POST_COMPLETION.heading}</SectionHeading>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <p className="text-green-800 leading-relaxed">{POST_COMPLETION.text}</p>
          </div>
        </section>

        <p className="text-sm text-slate-500 italic mb-8">{HOW_IT_WORKS_DISCLAIMER}</p>
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
