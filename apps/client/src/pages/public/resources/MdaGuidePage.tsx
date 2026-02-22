import { Button } from '@/components/ui/Button';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { DisclaimerCallout } from '@/components/public/DisclaimerCallout';
import { SectionHeading } from '@/components/public/SectionHeading';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  MDA_GUIDE_PAGE,
  CSV_FIELDS,
  CONDITIONAL_RULES,
  SUBMISSION_STEPS,
  SIDEBAR_INFO,
} from '@/content/mda-guide';
import { FINAL_CTA } from '@/content/homepage';

export function MdaGuidePage() {
  usePageMeta(MDA_GUIDE_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={MDA_GUIDE_PAGE.title} subtitle={MDA_GUIDE_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main content — 8 cols */}
          <div className="lg:col-span-8 space-y-12">
            {/* The 8 CSV Fields */}
            <section>
              <SectionHeading className="mb-4">The 8 CSV Fields</SectionHeading>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <caption className="sr-only">CSV submission template field definitions</caption>
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th scope="col" className="text-left py-3 pr-4 font-semibold text-slate-900">
                        Field Name
                      </th>
                      <th scope="col" className="text-left py-3 pr-4 font-semibold text-slate-900">
                        Description
                      </th>
                      <th scope="col" className="text-left py-3 font-semibold text-slate-900">
                        Required
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {CSV_FIELDS.map((field) => (
                      <tr key={field.name} className="border-b border-slate-100">
                        <td className="py-3 pr-4 font-medium text-slate-900 whitespace-nowrap">
                          {field.name}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{field.description}</td>
                        <td className="py-3 text-slate-600">{field.required}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Conditional Fields */}
            <section>
              <SectionHeading className="mb-4">Conditional Fields</SectionHeading>
              <ul className="space-y-2">
                {CONDITIONAL_RULES.map((rule) => (
                  <li key={rule} className="flex items-start gap-3 text-slate-700">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-teal shrink-0" />
                    {rule}
                  </li>
                ))}
              </ul>
            </section>

            {/* Step-by-Step Process */}
            <section>
              <SectionHeading className="mb-6">Step-by-Step Process</SectionHeading>
              <div className="space-y-6">
                {SUBMISSION_STEPS.map((step) => (
                  <div key={step.step} className="flex gap-4">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-teal text-white flex items-center justify-center text-sm font-bold">
                      {step.step}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{step.title}</h3>
                      <p className="mt-1 text-slate-600">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Screenshots placeholder */}
            <section>
              <SectionHeading className="mb-4">Screenshots</SectionHeading>
              <div className="bg-slate-100 rounded border-2 border-dashed border-slate-300 p-8 text-center text-slate-400">
                Screenshots to be added after Sprint 8
              </div>
            </section>
          </div>

          {/* Sidebar — 4 cols */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
                Quick Reference
              </h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Deadline</dt>
                  <dd className="font-medium text-slate-900">{SIDEBAR_INFO.deadline}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Format</dt>
                  <dd className="font-medium text-slate-900">{SIDEBAR_INFO.format}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Encoding</dt>
                  <dd className="font-medium text-slate-900">{SIDEBAR_INFO.encoding}</dd>
                </div>
              </dl>
              <Button asChild variant="secondary" className="w-full mt-4">
                <a href={SIDEBAR_INFO.templateUrl} download>
                  Download CSV Template
                </a>
              </Button>
            </div>

            <DisclaimerCallout linkText="Contact Support" linkHref="/support">
              Need help with your submission? Our team is available to assist.
            </DisclaimerCallout>
          </aside>
        </div>
      </div>

      <div className="mt-16">
        <CtaBanner
          heading={FINAL_CTA.heading}
          description={FINAL_CTA.description}
          primaryCta={FINAL_CTA.primaryCta}
          secondaryCta={FINAL_CTA.secondaryCta}
          variant="light"
        />
      </div>
    </>
  );
}
