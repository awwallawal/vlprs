import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { DisclaimerCallout } from '@/components/public/DisclaimerCallout';
import { SectionHeading } from '@/components/public/SectionHeading';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  ELIGIBILITY_PAGE,
  ELIGIBILITY_LOAN_TIERS,
  ELIGIBILITY_CONDITIONS,
  RETIREMENT_PROVISION_TEXT,
  ELIGIBILITY_DISCLAIMER,
} from '@/content/eligibility';
import { FINAL_CTA } from '@/content/homepage';

export function EligibilityPage() {
  usePageMeta(ELIGIBILITY_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={ELIGIBILITY_PAGE.title} subtitle={ELIGIBILITY_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Loan Tiers */}
        <section className="mb-12">
          <SectionHeading className="mb-6">Loan Tiers</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ELIGIBILITY_LOAN_TIERS.map((tier) => (
              <div
                key={tier.levels}
                className="border border-slate-200 rounded-lg p-6 text-center hover:border-crimson-300 hover:shadow-md transition-all duration-200"
              >
                <p className="text-sm font-medium text-slate-500 mb-2">{tier.levels}</p>
                <p className="font-mono text-2xl font-bold text-slate-900 mb-2">
                  ₦{tier.amount}
                </p>
                <p className="text-sm text-slate-600 mb-1">{tier.tenure}</p>
                <p className="text-xs text-slate-400">Interest: {tier.interest}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Eligibility Conditions */}
        <section className="mb-12">
          <SectionHeading className="mb-4">Eligibility Conditions</SectionHeading>
          <ul className="space-y-3">
            {ELIGIBILITY_CONDITIONS.map((condition) => (
              <li key={condition} className="flex items-start gap-3 text-slate-700">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-teal shrink-0" />
                {condition}
              </li>
            ))}
          </ul>
        </section>

        {/* Retirement Provision */}
        <section className="mb-12">
          <DisclaimerCallout title="Retirement Provision">
            {RETIREMENT_PROVISION_TEXT}
          </DisclaimerCallout>
        </section>

        <p className="text-sm text-slate-500 italic mb-12">{ELIGIBILITY_DISCLAIMER}</p>
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
