import { Info } from 'lucide-react';
import { Link } from 'react-router';

interface DisclaimerCalloutProps {
  title?: string;
  children: React.ReactNode;
  linkText?: string;
  linkHref?: string;
}

export function DisclaimerCallout({ title, children, linkText, linkHref }: DisclaimerCalloutProps) {
  return (
    <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <Info className="h-5 w-5 text-teal-700 mt-0.5 shrink-0" />
        <div>
          {title && <h4 className="font-semibold text-teal-900 mb-1">{title}</h4>}
          <div className="text-sm text-teal-800">{children}</div>
          {linkText && linkHref && (
            <Link
              to={linkHref}
              className="inline-block mt-2 text-sm font-medium text-teal-700 hover:text-teal-900 underline"
            >
              {linkText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
