import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { DisclaimerCallout } from '@/components/public/DisclaimerCallout';
import { SectionHeading } from '@/components/public/SectionHeading';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { usePageMeta } from '@/hooks/usePageMeta';
import { REPAYMENT_PAGE, SETTLEMENT_PATHS, REPAYMENT_SIDEBAR } from '@/content/repayment';
import { FINAL_CTA } from '@/content/homepage';

export function RepaymentRulesPage() {
  usePageMeta(REPAYMENT_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={REPAYMENT_PAGE.title} subtitle={REPAYMENT_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main content — 8 cols */}
          <div className="lg:col-span-8">
            <SectionHeading className="mb-6">Settlement Paths</SectionHeading>
            <Accordion type="multiple" defaultValue={SETTLEMENT_PATHS.map((_, i) => `item-${i}`)}>
              {SETTLEMENT_PATHS.map((path, index) => (
                <AccordionItem key={path.title} value={`item-${index}`}>
                  <AccordionTrigger className="text-lg font-semibold text-slate-900">
                    {path.title}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-slate-700 leading-relaxed mb-3">{path.description}</p>
                    <div className="bg-slate-50 rounded-lg p-4">
                      <p className="text-sm text-slate-600 italic">
                        <span className="font-medium not-italic">Example: </span>
                        {path.example}
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Sidebar — 4 cols */}
          <aside className="lg:col-span-4">
            <DisclaimerCallout
              title={REPAYMENT_SIDEBAR.title}
              linkText={REPAYMENT_SIDEBAR.linkText}
              linkHref={REPAYMENT_SIDEBAR.linkHref}
            >
              {REPAYMENT_SIDEBAR.text}
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
