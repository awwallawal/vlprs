import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { SectionWrapper } from '@/components/public/SectionWrapper';
import { SectionHeading } from '@/components/public/SectionHeading';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  ABOUT_PAGE,
  MISSION,
  VISION,
  CORE_VALUES,
  PROGRAMME_LEADERS,
  PROGRAMME_GOVERNANCE,
  INSTITUTIONAL_STORY,
  ABOUT_QUICK_LINKS,
  AUTHORITY_CALLOUT,
} from '@/content/about';
import { FINAL_CTA } from '@/content/homepage';

export function AboutPage() {
  usePageMeta(ABOUT_PAGE.meta);

  const principalLeader = PROGRAMME_LEADERS[0];
  const directorate = PROGRAMME_LEADERS.slice(1);

  return (
    <>
      <ContentPageHeader title={ABOUT_PAGE.title} subtitle={ABOUT_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      {/* Featured Principal Leader */}
      <SectionWrapper>
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-crimson to-crimson-dark" />
            <div className="p-8 sm:p-10 flex flex-col sm:flex-row items-center sm:items-start gap-8">
              {principalLeader.image ? (
                <img
                  src={principalLeader.image}
                  alt={principalLeader.name}
                  className="w-32 h-32 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-crimson-50 shadow-md shrink-0"
                />
              ) : (
                <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-full bg-crimson-50 border-4 border-crimson-50 shadow-md flex items-center justify-center shrink-0">
                  <span className="text-4xl font-bold text-crimson">
                    {principalLeader.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="text-center sm:text-left">
                <p className="text-sm font-semibold text-crimson uppercase tracking-wider mb-1">
                  {principalLeader.role}
                </p>
                <h2 className="text-2xl sm:text-3xl font-brand font-semibold text-slate-900 mb-3">
                  {principalLeader.name}
                </h2>
                <p className="text-slate-600 leading-relaxed max-w-xl">
                  {principalLeader.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* Directorate Grid */}
      <SectionWrapper variant="light">
        <SectionHeading centered>The Directorate</SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {directorate.map((leader) => (
            <div
              key={leader.role}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-crimson-300 hover:shadow-md transition-all duration-200"
            >
              <div className="h-1 bg-crimson-50" />
              <div className="p-6 flex flex-col items-center text-center">
                {leader.image ? (
                  <img
                    src={leader.image}
                    alt={leader.name}
                    className="w-24 h-24 rounded-full object-cover border-2 border-slate-100 shadow-sm mb-4"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-100 shadow-sm flex items-center justify-center mb-4">
                    <span className="text-2xl font-bold text-slate-400">
                      {leader.name.charAt(0)}
                    </span>
                  </div>
                )}
                <h3 className="font-brand font-semibold text-slate-900 mb-1">
                  {leader.name}
                </h3>
                <p className="text-sm font-medium text-crimson mb-3">
                  {leader.role}
                </p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {leader.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionWrapper>

      {/* Mission & Vision side-by-side */}
      <SectionWrapper>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="border-l-4 border-crimson pl-6">
            <h2 className="text-xl font-brand font-semibold text-slate-900 mb-4">
              Our Mission
            </h2>
            <p className="text-slate-700 leading-relaxed">{MISSION}</p>
          </div>
          <div className="border-l-4 border-teal pl-6">
            <h2 className="text-xl font-brand font-semibold text-slate-900 mb-4">
              Our Vision
            </h2>
            <p className="text-slate-700 leading-relaxed">{VISION}</p>
          </div>
        </div>
      </SectionWrapper>

      {/* Core Values */}
      <SectionWrapper variant="light">
        <SectionHeading centered>Core Values</SectionHeading>
        <div className="flex flex-wrap justify-center gap-4">
          {CORE_VALUES.map((value) => (
            <Badge
              key={value}
              variant="secondary"
              className="text-base px-6 py-2.5 font-brand font-medium"
            >
              {value}
            </Badge>
          ))}
        </div>
      </SectionWrapper>

      {/* Programme Governance */}
      <SectionWrapper>
        <SectionHeading centered>Programme Governance</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="rounded-xl border border-slate-200 bg-white p-8 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
            <h3 className="text-lg font-brand font-semibold text-slate-900 mb-3">
              {PROGRAMME_GOVERNANCE.committee.heading}
            </h3>
            <p className="text-slate-700 leading-relaxed">
              {PROGRAMME_GOVERNANCE.committee.text}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-8 hover:border-crimson-300 hover:shadow-md transition-all duration-200">
            <h3 className="text-lg font-brand font-semibold text-slate-900 mb-3">
              {PROGRAMME_GOVERNANCE.agOffice.heading}
            </h3>
            <p className="text-slate-700 leading-relaxed">
              {PROGRAMME_GOVERNANCE.agOffice.text}
            </p>
          </div>
        </div>
      </SectionWrapper>

      {/* Institutional Story + Authority Callout + Quick Links */}
      <SectionWrapper variant="light">
        <div className="max-w-4xl mx-auto">
          <SectionHeading centered>Institutional Story</SectionHeading>
          <p className="text-slate-700 leading-relaxed text-center mb-10">
            {INSTITUTIONAL_STORY}
          </p>

          <div className="bg-crimson-50 border-l-4 border-[var(--color-primary)] p-6 rounded-r-lg mb-10">
            <p className="text-base font-brand font-medium text-slate-800 text-center">
              {AUTHORITY_CALLOUT}
            </p>
          </div>

          <nav aria-label="Quick links" className="text-center">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Quick Links
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {ABOUT_QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className="text-sm text-teal hover:text-teal-hover underline"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </SectionWrapper>

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
