import { Link } from 'react-router';
import { Mail, MapPin, Phone } from 'lucide-react';
import { BreadcrumbNav } from '@/components/public/BreadcrumbNav';
import { ContentPageHeader } from '@/components/public/ContentPageHeader';
import { CtaBanner } from '@/components/public/CtaBanner';
import { SectionHeading } from '@/components/public/SectionHeading';
import { usePageMeta } from '@/hooks/usePageMeta';
import {
  SUPPORT_PAGE,
  GUIDANCE_ITEMS,
  CONTACT_INFO,
  USEFUL_LINKS,
} from '@/content/support';
import { FINAL_CTA } from '@/content/homepage';

export function SupportPage() {
  usePageMeta(SUPPORT_PAGE.meta);

  return (
    <>
      <ContentPageHeader title={SUPPORT_PAGE.title} subtitle={SUPPORT_PAGE.subtitle}>
        <BreadcrumbNav />
      </ContentPageHeader>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Guidance banner */}
        <section className="bg-teal-50 border border-teal-200 rounded-xl p-8 mb-12">
          <h2 className="text-lg font-semibold text-teal-900 mb-4">
            Need help? Here&apos;s where to start:
          </h2>
          <div className="space-y-4">
            {GUIDANCE_ITEMS.map((item) => (
              <div key={item.audience} className="flex items-start gap-3">
                <span className="mt-1 h-2 w-2 rounded-full bg-teal shrink-0" />
                <div>
                  <span className="font-medium text-teal-900">{item.audience}:</span>{' '}
                  <span className="text-teal-800">{item.text} </span>
                  {item.linkHref.startsWith('/') ? (
                    <Link
                      to={item.linkHref}
                      className="text-teal font-medium hover:underline"
                    >
                      {item.linkLabel}
                    </Link>
                  ) : (
                    <a
                      href={item.linkHref}
                      className="text-teal font-medium hover:underline"
                    >
                      {item.linkLabel}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact Information */}
        <section id="contact" className="mb-12">
          <SectionHeading className="mb-6">Contact Information</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-slate-200 rounded-lg p-6 text-center hover:border-crimson-300 hover:shadow-md transition-all duration-200">
              <MapPin className="h-8 w-8 text-teal mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">{CONTACT_INFO.address.label}</h3>
              {CONTACT_INFO.address.lines.map((line) => (
                <p key={line} className="text-sm text-slate-600">
                  {line}
                </p>
              ))}
            </div>
            <div className="border border-slate-200 rounded-lg p-6 text-center hover:border-crimson-300 hover:shadow-md transition-all duration-200">
              <Mail className="h-8 w-8 text-teal mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">{CONTACT_INFO.email.label}</h3>
              <a
                href={`mailto:${CONTACT_INFO.email.value}`}
                className="text-sm text-teal hover:underline"
              >
                {CONTACT_INFO.email.value}
              </a>
            </div>
            <div className="border border-slate-200 rounded-lg p-6 text-center hover:border-crimson-300 hover:shadow-md transition-all duration-200">
              <Phone className="h-8 w-8 text-teal mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">{CONTACT_INFO.phone.label}</h3>
              <p className="text-sm text-slate-600">{CONTACT_INFO.phone.value}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-slate-500">Office hours: {CONTACT_INFO.hours}</p>
        </section>

        {/* Useful Links */}
        <section className="mb-12">
          <SectionHeading className="mb-4">Useful Links</SectionHeading>
          <ul className="space-y-2">
            {USEFUL_LINKS.map((link) => (
              <li key={link.href}>
                <Link to={link.href} className="text-teal hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
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
