import { Fragment } from 'react';
import { useLocation } from 'react-router';
import { Link } from 'react-router';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { NEWS_ITEMS } from '@/content/news';

const PATH_LABELS: Record<string, string> = {
  '': 'Home',
  about: 'About',
  scheme: 'The Scheme',
  overview: 'Programme Overview',
  'about-vlprs': 'About VLPRS',
  eligibility: 'Eligibility & Loan Categories',
  repayment: 'Repayment & Settlement Rules',
  'how-it-works': 'How It Works',
  resources: 'Resources',
  faq: 'Frequently Asked Questions',
  'submission-guide': 'MDA Submission Guide',
  downloads: 'Downloads & Forms',
  news: 'News & Announcements',
  'beneficiary-lists': 'Approved Beneficiary Lists',
  support: 'Help & Support',
  privacy: 'Privacy Policy',
  accessibility: 'Accessibility',
  disclaimer: 'Disclaimer',
  eoi: 'Expression of Interest',
};

// Segments that don't have a corresponding route — render as plain text, not links
const NON_ROUTABLE_SEGMENTS = new Set(['resources', 'scheme']);

function resolveLabel(segment: string, parentSegment?: string): string {
  // For news detail pages, look up the actual article title
  if (parentSegment === 'news' && !PATH_LABELS[segment]) {
    const article = NEWS_ITEMS.find((item) => item.slug === segment);
    if (article) return article.title;
  }
  return (
    PATH_LABELS[segment] ||
    segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function BreadcrumbNav() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const parentSegment = index > 0 ? segments[index - 1] : undefined;
    const label = resolveLabel(segment, parentSegment);
    const isLast = index === segments.length - 1;
    const isRoutable = !NON_ROUTABLE_SEGMENTS.has(segment);
    return { path, label, isLast, isRoutable };
  });

  return (
    <Breadcrumb className="py-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/">Home</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        {crumbs.map((crumb) => (
          <Fragment key={crumb.path}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : crumb.isRoutable ? (
                <BreadcrumbLink asChild>
                  <Link to={crumb.path}>{crumb.label}</Link>
                </BreadcrumbLink>
              ) : (
                <span className="text-muted-foreground">{crumb.label}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
