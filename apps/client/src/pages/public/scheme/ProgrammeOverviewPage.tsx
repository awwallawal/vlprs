import { Link } from 'react-router';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { DisclaimerCallout } from '@/components/public/DisclaimerCallout';
import { SectionHeading } from '@/components/public/SectionHeading';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  SCHEME_PAGE,
  SCHEME_OBJECTIVES,
  POLICY_BASIS,
  BENEFITS_TO_STAFF,
  ROLE_OF_AG_OFFICE,
  SCHEME_SIDEBAR_DISCLAIMER,
  SCHEME_QUICK_LINKS,
  SCHEME_PROGRAMME_DISCLAIMER,
} from '@/content/scheme';
import { FINAL_CTA } from '@/content/homepage';

export function ProgrammeOverviewPage() {
  usePageMeta(SCHEME_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={SCHEME_PAGE.title} subtitle={SCHEME_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Main content — 8 cols */}
          <div className="lg:col-span-8 space-y-12">
            <section>
              <SectionHeading className="mb-4">
                {SCHEME_OBJECTIVES.heading}
              </SectionHeading>
              <ul className="space-y-3">
                {SCHEME_OBJECTIVES.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-teal shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <SectionHeading className="mb-4">{POLICY_BASIS.heading}</SectionHeading>
              <div className="space-y-4">
                {POLICY_BASIS.paragraphs.map((p) => (
                  <p key={p} className="text-slate-700 leading-relaxed">
                    {p}
                  </p>
                ))}
              </div>
            </section>

            <section>
              <SectionHeading className="mb-4">
                {BENEFITS_TO_STAFF.heading}
              </SectionHeading>
              <ul className="space-y-3">
                {BENEFITS_TO_STAFF.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-teal shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <SectionHeading className="mb-4">
                {ROLE_OF_AG_OFFICE.heading}
              </SectionHeading>
              <ul className="space-y-3">
                {ROLE_OF_AG_OFFICE.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-slate-700">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-teal shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-sm text-slate-500 italic">{SCHEME_PROGRAMME_DISCLAIMER}</p>
          </div>

          {/* Sidebar — 4 cols */}
          <aside className="lg:col-span-4 space-y-6">
            <DisclaimerCallout>{SCHEME_SIDEBAR_DISCLAIMER}</DisclaimerCallout>

            <nav aria-label="Quick links">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                Quick Links
              </h3>
              <ul className="space-y-2">
                {SCHEME_QUICK_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-teal hover:text-teal-hover underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
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
