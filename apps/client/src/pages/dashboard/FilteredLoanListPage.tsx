import { useSearchParams, useNavigate } from 'react-router';
import { useFilteredLoans } from '@/hooks/useFilteredLoans';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/formatters';
import type { LoanClassification } from '@vlprs/shared';

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

const CLASSIFICATION_BADGE: Record<string, { variant: 'complete' | 'review' | 'pending' | 'info'; label: string }> = {
  COMPLETED: { variant: 'complete', label: 'Completed' },
  ON_TRACK: { variant: 'complete', label: 'On Track' },
  OVERDUE: { variant: 'review', label: 'Overdue' },
  STALLED: { variant: 'pending', label: 'Stalled' },
  OVER_DEDUCTED: { variant: 'info', label: 'Over-Deducted' },
};

// Map filter params that are classification-based to classification API param
const CLASSIFICATION_FILTERS: Record<string, LoanClassification> = {
  overdue: 'OVERDUE',
  stalled: 'STALLED',
  'quick-win': 'ON_TRACK', // quick-win shows on-track loans with low balance
  onTrack: 'ON_TRACK',
  completed: 'COMPLETED',
  overDeducted: 'OVER_DEDUCTED',
};

// Attention item filters that use the custom filter param
const ATTENTION_FILTERS = new Set(['zero-deduction', 'post-retirement', 'missing-staff-id']);

export function FilteredLoanListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const filter = searchParams.get('filter') ?? '';
  const mdaId = searchParams.get('mda') ?? undefined;
  const sort = searchParams.get('sort') ?? undefined;

  // Determine if this is a classification-based filter or attention item filter
  const classification = CLASSIFICATION_FILTERS[filter];
  const attentionFilter = ATTENTION_FILTERS.has(filter) ? filter : undefined;

  const { data: result, isPending } = useFilteredLoans(
    attentionFilter,
    mdaId,
    sort,
    classification,
  );

  const loans = result?.data ?? [];
  const label = FILTER_LABELS[filter] ?? filter;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">{label}</h1>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff Name</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff ID</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">MDA</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Loan Ref</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Outstanding</th>
              <th className="px-4 py-3 text-center font-medium text-text-secondary">Classification</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Last Deduction</th>
            </tr>
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="mx-auto h-5 w-20 rounded-full" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  </tr>
                ))
              : loans.map((loan) => {
                  const badge = loan.classification
                    ? CLASSIFICATION_BADGE[loan.classification]
                    : null;

                  return (
                    <tr
                      key={loan.loanId}
                      className={cn(
                        'border-b transition-colors hover:bg-slate-50 cursor-pointer',
                      )}
                      role="link"
                      tabIndex={0}
                      onClick={() => navigate(
                        loan.mdaId
                          ? `/dashboard/mda/${loan.mdaId}/loan/${loan.loanId}`
                          : `/dashboard/loans?filter=${filter}`
                      )}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(
                            loan.mdaId
                              ? `/dashboard/mda/${loan.mdaId}/loan/${loan.loanId}`
                              : `/dashboard/loans?filter=${filter}`
                          );
                        }
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">
                        {loan.staffName}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">
                        {loan.staffId ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {loan.mdaName}
                      </td>
                      <td className="px-4 py-3 font-mono text-text-secondary">
                        {loan.loanReference}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <NairaDisplay amount={loan.outstandingBalance} variant="table" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {badge ? (
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        ) : (
                          <span className="text-text-secondary">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {loan.lastDeductionDate
                          ? formatDate(loan.lastDeductionDate)
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!isPending && loans.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-secondary">
            No loans found matching this filter.
          </p>
        )}
      </div>
    </div>
  );
}

export { FilteredLoanListPage as Component };
