import { useState } from 'react';
import { Link } from 'react-router';
import {
  Lock,
  Calculator,
  CheckCircle,
  LayoutDashboard,
  Handshake,
  ClipboardCheck,
  Shield,
  FileText,
  Link2,
  Info,
  ArrowRight,
  Building2,
  Users,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { LoginModal } from '@/components/public/LoginModal';
import { DisclaimerCallout } from '@/components/public/DisclaimerCallout';
import { CtaBanner } from '@/components/public/CtaBanner';
import { SectionWrapper } from '@/components/public/SectionWrapper';
import { SectionHeading } from '@/components/public/SectionHeading';
import {
  HERO,
  TRUST_STRIP,
  HOW_IT_WORKS,
  HOW_IT_WORKS_DISCLAIMER,
  LOAN_TIERS,
  LOAN_TIERS_NOTE,
  CAPABILITIES,
  REPAYMENT_RULES,
  REPAYMENT_DISCLAIMER,
  WHO_VLPRS_SERVES,
  TRUST_PILLARS,
  ENDORSEMENT,
  FINAL_CTA,
} from '@/content/homepage';
import { NEWS_ITEMS } from '@/content/news';

const CAPABILITY_ICONS = {
  Lock,
  Calculator,
  CheckCircle,
  LayoutDashboard,
  Handshake,
  ClipboardCheck,
} as const;

const TRUST_ICONS = {
  Shield,
  FileText,
  Link2,
} as const;

const SERVES_ICONS = {
  Building2,
  Users,
  UserCheck,
} as const;

export function HomePage() {
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      {/* AC3: Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-crimson-25 to-white">
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-crimson-50 rounded-full blur-3xl opacity-60 -translate-y-1/2" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-crimson-50 rounded-full blur-3xl opacity-40 translate-y-1/2" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left column (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <img
                src="/oyo-crest.png"
                alt="Oyo State Government Crest"
                className="h-20 w-20"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <h1 className="text-[32px] sm:text-[44px] font-brand font-bold text-slate-900 leading-tight">
                {HERO.title}
              </h1>
              <p className="text-lg text-slate-600 max-w-xl">
                {HERO.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  className="min-h-[44px]"
                  onClick={() => setLoginOpen(true)}
                >
                  {HERO.primaryCta.label}
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="min-h-[44px]"
                >
                  <Link to={HERO.secondaryCta.href}>
                    {HERO.secondaryCta.label}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>

            {/* Right column (5 cols) — Programme Notice */}
            <div className="lg:col-span-5">
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-900 mb-4">
                  {HERO.programmeNotice.title}
                </h2>
                <ul className="space-y-3">
                  {HERO.programmeNotice.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-slate-400 border-t border-slate-100 pt-3">
                  {HERO.programmeNotice.finePrint}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AC4: Trust Strip */}
      <section className="border-y border-slate-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-500 mb-3">{TRUST_STRIP.text}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {TRUST_STRIP.badges.map((badge) => (
              <Badge key={badge} variant="info" className="text-xs">
                {badge}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* AC5: How It Works */}
      <SectionWrapper>
        <SectionHeading centered>How It Works</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_IT_WORKS.map((step) => (
            <div
              key={step.step}
              className="rounded-xl border border-slate-200 bg-white p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200"
            >
              <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-crimson text-white text-sm font-bold mb-3">
                {step.step}
              </span>
              <h3 className="font-semibold text-slate-900 mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-slate-600">{step.description}</p>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 mt-6 justify-center text-sm text-slate-500">
          <Info className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
          <p>{HOW_IT_WORKS_DISCLAIMER}</p>
        </div>
      </SectionWrapper>

      {/* AC6: Loan Category Cards */}
      <SectionWrapper variant="light">
        <SectionHeading centered>Eligibility &amp; Loan Categories</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {LOAN_TIERS.map((tier) => (
            <div
              key={tier.levels}
              className="rounded-xl border border-slate-200 bg-white p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200"
            >
              <h3 className="text-sm font-semibold text-slate-500 mb-1">
                {tier.levels}
              </h3>
              <p className="font-mono text-2xl font-bold text-slate-900 mb-2">
                Up to &#8358;{tier.amount}
              </p>
              <p className="text-sm text-slate-500 mb-1">{tier.tenure}</p>
              <p className="text-sm font-medium text-crimson mb-3">Interest: 13.33% p.a.</p>
              <Link
                to="/scheme/repayment"
                className="text-sm font-medium text-teal hover:text-teal-hover transition-colors"
              >
                See repayment rules &rarr;
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-slate-500 mt-6">
          {LOAN_TIERS_NOTE}
        </p>
      </SectionWrapper>

      {/* AC7: Key Capabilities */}
      <SectionWrapper>
        <SectionHeading centered>Key Capabilities</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((cap) => {
            const Icon = CAPABILITY_ICONS[cap.icon];
            return (
              <div
                key={cap.title}
                className="rounded-xl border border-slate-200 bg-white p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200"
              >
                <Icon className="h-8 w-8 text-teal-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-2">
                  {cap.title}
                </h3>
                <p className="text-sm text-slate-600">{cap.description}</p>
              </div>
            );
          })}
        </div>
      </SectionWrapper>

      {/* AC8: Repayment & Settlement Rules */}
      <SectionWrapper variant="light">
        <SectionHeading centered>Repayment &amp; Settlement Rules</SectionHeading>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left — Accordion (8 cols) */}
          <div className="lg:col-span-8">
            <Accordion type="single" collapsible className="space-y-2">
              {REPAYMENT_RULES.map((rule, i) => (
                <AccordionItem
                  key={i}
                  value={`rule-${i}`}
                  className="rounded-lg border border-slate-200 bg-white px-4"
                >
                  <AccordionTrigger className="text-left font-medium text-slate-900 hover:no-underline">
                    {rule.title}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-600">
                    {rule.content}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Right — Disclaimer (4 cols) */}
          <div className="lg:col-span-4">
            <DisclaimerCallout title={REPAYMENT_DISCLAIMER.title}>
              <p className="mb-3">{REPAYMENT_DISCLAIMER.content}</p>
              <Link
                to={REPAYMENT_DISCLAIMER.faqLink.href}
                className="font-medium text-teal-700 hover:text-teal-900 transition-colors"
              >
                {REPAYMENT_DISCLAIMER.faqLink.label} &rarr;
              </Link>
            </DisclaimerCallout>
          </div>
        </div>
      </SectionWrapper>

      {/* AC9: Who VLPRS Serves */}
      <SectionWrapper>
        <SectionHeading centered>Who VLPRS Serves</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {WHO_VLPRS_SERVES.map((role) => {
            const Icon = SERVES_ICONS[role.icon];
            return (
              <div
                key={role.title}
                className="rounded-xl border border-slate-200 bg-white p-6 text-center hover:border-crimson-300 hover:shadow-md transition-all duration-200"
              >
                <Icon className="h-10 w-10 text-teal-600 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-900 mb-1">
                  {role.title}
                </h3>
                <p className="text-sm text-slate-600">{role.description}</p>
              </div>
            );
          })}
        </div>
      </SectionWrapper>

      {/* AC10: Trust & Compliance */}
      <SectionWrapper variant="light">
        <SectionHeading centered>Trust &amp; Compliance</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRUST_PILLARS.map((pillar) => {
            const Icon = TRUST_ICONS[pillar.icon];
            return (
              <div
                key={pillar.title}
                className="rounded-xl border border-slate-200 bg-white p-6 text-center hover:border-crimson-300 hover:shadow-md transition-all duration-200"
              >
                <Icon className="h-10 w-10 text-teal-600 mx-auto mb-4" />
                <h3 className="font-semibold text-slate-900 mb-2">
                  {pillar.title}
                </h3>
                <p className="text-sm text-slate-600">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>
      </SectionWrapper>

      {/* AC11: Endorsement Banner */}
      <SectionWrapper>
        <blockquote className="bg-slate-50 border-l-4 border-[var(--color-crimson)] p-8 rounded-r-lg">
          <p className="text-lg text-slate-700 italic mb-4">
            {ENDORSEMENT.quote}
          </p>
          <cite className="text-sm font-medium text-slate-500 not-italic">
            {ENDORSEMENT.attribution}
          </cite>
        </blockquote>
      </SectionWrapper>

      {/* AC12: News Section */}
      <SectionWrapper variant="light">
        <SectionHeading centered>News &amp; Announcements</SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {NEWS_ITEMS.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-6 hover:border-crimson-300 hover:shadow-md transition-all duration-200"
            >
              <time className="text-xs text-slate-400">{item.date}</time>
              <h3 className="font-semibold text-slate-900 mt-1 mb-2">
                {item.title}
              </h3>
              <p className="text-sm text-slate-600 mb-3">{item.excerpt}</p>
              <Link
                to={`/resources/news/${item.slug}`}
                className="text-sm font-medium text-teal hover:text-teal-hover transition-colors"
              >
                Read more &rarr;
              </Link>
            </article>
          ))}
        </div>
      </SectionWrapper>

      {/* AC13: Final CTA */}
      <CtaBanner
        heading={FINAL_CTA.heading}
        description={FINAL_CTA.description}
        primaryCta={{
          label: FINAL_CTA.primaryCta.label,
          onClick: () => setLoginOpen(true),
        }}
        secondaryCta={FINAL_CTA.secondaryCta}
        variant="dark"
      />

      <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}
