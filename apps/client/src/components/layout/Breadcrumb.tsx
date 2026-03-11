import { useLocation, useParams, useSearchParams, Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import type { MdaSummary } from '@vlprs/shared';

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
  loans: 'Loans',
};

const METRIC_LABELS: Record<string, string> = {
  'active-loans': 'Active Loans',
  'total-exposure': 'Total Exposure',
  'fund-available': 'Fund Available',
  'monthly-recovery': 'Monthly Recovery',
  'loans-in-window': 'Loans in Window (60m)',
  'outstanding-receivables': 'Outstanding Receivables',
  'collection-potential': 'Collection Potential',
  'at-risk': 'At-Risk Amount',
  'completion-rate': 'Completion Rate (60m)',
  'completion-rate-lifetime': 'Completion Rate (All-Time)',
};

const FILTER_LABELS: Record<string, string> = {
  overdue: 'Overdue Loans',
  stalled: 'Stalled Deductions',
  'quick-win': 'Quick-Win Opportunities',
  'zero-deduction': 'Zero Deduction (60+ Days)',
  'post-retirement': 'Post-Retirement Active Loans',
  'missing-staff-id': 'Missing Staff ID',
  onTrack: 'On-Track Loans',
  completed: 'Completed Loans',
  overDeducted: 'Over-Deducted Loans',
};

interface BreadcrumbItem {
  label: string;
  path: string;
}

function buildCrumbs(
  segments: string[],
  params: Record<string, string | undefined>,
  getMdaName: (id: string) => string,
  getLoanRef: (id: string) => string,
  filterLabel: string | null,
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

    // Drill-down segment: next segment is the metric slug
    if (segment === 'drill-down') {
      continue;
    }

    // If previous segment was 'drill-down', this is the metric slug
    if (segments[i - 1] === 'drill-down') {
      const metricLabel = METRIC_LABELS[segment] ?? segment;
      crumbs.push({ label: metricLabel, path: currentPath });
      continue;
    }

    // If the previous segment was 'mda' and this is the mdaId
    if (segments[i - 1] === 'mda' && params.mdaId === segment) {
      crumbs.push({ label: getMdaName(segment), path: currentPath });
      continue;
    }

    // If the previous segment was 'loan' and this is the loanId
    if (segments[i - 1] === 'loan' && params.loanId === segment) {
      crumbs.push({ label: getLoanRef(segment), path: currentPath });
      continue;
    }

    // Skip 'mda' and 'loan' path segments themselves — use the param value instead
    if (segment === 'mda' || segment === 'loan') {
      continue;
    }

    // /dashboard/loans with filter param: show filter label
    if (segment === 'loans' && filterLabel) {
      crumbs.push({ label: filterLabel, path: currentPath });
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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const segments = location.pathname.split('/').filter(Boolean);

  // Use TanStack Query cache for MDA/loan labels — no extra API calls
  const getMdaName = (mdaId: string) => {
    const mdaData = queryClient.getQueryData<MdaSummary>(['mda', mdaId]);
    return mdaData?.name ?? `MDA ${mdaId.substring(0, 8)}`;
  };

  const getLoanRef = (loanId: string) => {
    const loanData = queryClient.getQueryData<{ loanReference: string }>(['loan', loanId]);
    return loanData?.loanReference ?? `Loan ${loanId.substring(0, 8)}`;
  };

  // Filter label for /dashboard/loans?filter=X
  const filter = searchParams.get('filter');
  const filterLabel = filter ? (FILTER_LABELS[filter] ?? filter) : null;

  const crumbs = buildCrumbs(segments, params, getMdaName, getLoanRef, filterLabel);

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
