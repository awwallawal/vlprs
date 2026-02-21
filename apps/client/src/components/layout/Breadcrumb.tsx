import { useLocation, Link } from 'react-router';
import { ChevronRight } from 'lucide-react';

const PATH_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  operations: 'Operations',
  submissions: 'Submissions',
  reports: 'Reports',
  exceptions: 'Exceptions',
  migration: 'Migration',
  history: 'History',
};

export function Breadcrumb() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const crumbs = segments.slice(0, 3); // max 3 levels

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
      <ol className="flex items-center gap-1">
        {crumbs.map((segment, index) => {
          const path = '/' + crumbs.slice(0, index + 1).join('/');
          const label = PATH_LABELS[segment] || segment;
          const isLast = index === crumbs.length - 1;

          return (
            <li key={path} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-muted" />}
              {isLast ? (
                <span className="text-text-primary font-medium">{label}</span>
              ) : (
                <Link to={path} className="hover:text-teal transition-colors">
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
