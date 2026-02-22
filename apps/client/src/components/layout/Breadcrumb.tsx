import { useLocation, useParams, Link } from 'react-router';
import { ChevronRight } from 'lucide-react';

const PATH_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  operations: 'Operations',
  submissions: 'Submissions',
  reports: 'Reports',
  exceptions: 'Exceptions',
  migration: 'Migration',
  admin: 'Admin',
  mda: 'MDA',
  loan: 'Loan',
  placeholder: 'Feature',
};

// Mock MDA name lookup — will be replaced with real data in future stories
const MOCK_MDA_NAMES: Record<string, string> = {
  'mda-001': 'Ministry of Finance',
  'mda-002': 'Ministry of Education',
  'mda-003': 'Ministry of Health',
  'mda-004': 'Ministry of Works and Transport',
  'mda-005': 'Ministry of Agriculture',
};

// Mock loan ref lookup — will be replaced with real data in future stories
const MOCK_LOAN_REFS: Record<string, string> = {
  'loan-001': 'VL-2024-00451',
  'loan-002': 'VL-2024-00832',
  'loan-003': 'VL-2023-01204',
  'loan-004': 'VL-2024-00623',
  'loan-005': 'VL-2023-00195',
};

function getMdaLabel(mdaId: string): string {
  return MOCK_MDA_NAMES[mdaId] ?? `MDA ${mdaId}`;
}

function getLoanLabel(loanId: string): string {
  return MOCK_LOAN_REFS[loanId] ?? `Loan ${loanId}`;
}

interface BreadcrumbItem {
  label: string;
  path: string;
}

function buildCrumbs(
  segments: string[],
  params: Record<string, string | undefined>,
): BreadcrumbItem[] {
  const crumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  for (let i = 0; i < segments.length && crumbs.length < 3; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Skip the 'dashboard' segment if it's the first one — we use it as root label
    if (i === 0 && segment === 'dashboard') {
      crumbs.push({ label: 'Dashboard', path: '/dashboard' });
      continue;
    }

    // If the previous segment was 'mda' and this is the mdaId
    if (segments[i - 1] === 'mda' && params.mdaId === segment) {
      crumbs.push({ label: getMdaLabel(segment), path: currentPath });
      continue;
    }

    // If the previous segment was 'loan' and this is the loanId
    if (segments[i - 1] === 'loan' && params.loanId === segment) {
      crumbs.push({ label: getLoanLabel(segment), path: currentPath });
      continue;
    }

    // Skip 'mda' and 'loan' path segments themselves — use the param value instead
    if (segment === 'mda' || segment === 'loan') {
      continue;
    }

    const label = PATH_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, path: currentPath });
  }

  return crumbs;
}

export function Breadcrumb() {
  const location = useLocation();
  const params = useParams();
  const segments = location.pathname.split('/').filter(Boolean);
  const crumbs = buildCrumbs(segments, params);

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
      <ol className="flex items-center gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;

          return (
            <li key={crumb.path} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
              )}
              {isLast ? (
                <span className="text-text-primary font-medium" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.path} className="hover:text-teal transition-colors">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export { Breadcrumb as Component };
