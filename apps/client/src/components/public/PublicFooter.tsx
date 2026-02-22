import { Link } from 'react-router';
import { Shield } from 'lucide-react';
import { FOOTER_LINKS } from '@/content/navigation';
import { ProgrammeDisclaimer } from '@/components/public/ProgrammeDisclaimer';

export function PublicFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Brand row */}
        <div className="flex items-center gap-4 mb-10 pb-8 border-b border-slate-800">
          <img
            src="/oyo-crest.png"
            alt="Oyo State Government Crest"
            className="h-12 w-12"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <span className="font-brand font-semibold text-white text-lg">
            Vehicle Loan Scheme
          </span>
        </div>

        {/* 4-column grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Column 1: About & Scheme */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              About & Scheme
            </h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.aboutScheme.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Resources
            </h3>
            <ul className="space-y-2">
              {FOOTER_LINKS.resources.map((link) => (
                <li key={link.href}>
                  <Link
                    to={link.href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Contact
            </h3>
            <address className="not-italic space-y-2 text-sm text-slate-400">
              <p>{FOOTER_LINKS.contact.office}</p>
              <p>{FOOTER_LINKS.contact.address}</p>
              <p>
                <a
                  href={`mailto:${FOOTER_LINKS.contact.email}`}
                  className="hover:text-white transition-colors"
                >
                  {FOOTER_LINKS.contact.email}
                </a>
              </p>
              <p>{FOOTER_LINKS.contact.phone}</p>
              <p className="text-slate-500">{FOOTER_LINKS.contact.hours}</p>
            </address>
          </div>

          {/* Column 4: Staff Portal */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">
              Staff Portal
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              Authorised staff can access the VLPRS dashboard for loan
              management and reporting.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center text-sm font-medium text-teal-400 hover:text-teal-300 transition-colors"
            >
              Login to Dashboard &rarr;
            </Link>
          </div>
        </div>

        {/* Programme Disclaimer */}
        <ProgrammeDisclaimer />

        {/* Bottom bar */}
        <div className="mt-8 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {FOOTER_LINKS.legal.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="hover:text-slate-300 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Shield className="h-3.5 w-3.5" />
              NDPA Compliant
            </span>
            <p className="text-xs text-slate-500">
              &copy; 2026 Oyo State Government. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
