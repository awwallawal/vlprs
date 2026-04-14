import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatCount } from '@/lib/formatters';
import { useMdaDetail, useMdaLoans } from '@/hooks/useMdaData';
import { useSubmissionHistory } from '@/hooks/useSubmissionData';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { HealthScoreBadge } from '@/components/shared/HealthScoreBadge';
import { StatusDistributionBar } from '@/components/shared/StatusDistributionBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { LoanClassification } from '@vlprs/shared';

const SUBMISSION_STATUS_MAP = {
  confirmed: { variant: 'complete' as const, label: 'Confirmed' },
  processing: { variant: 'pending' as const, label: 'Processing' },
  rejected: { variant: 'review' as const, label: 'Rejected' },
} as const;

const CLASSIFICATION_BADGE: Record<LoanClassification, { variant: 'complete' | 'review' | 'pending' | 'info'; label: string }> = {
  COMPLETED: { variant: 'complete', label: 'Completed' },
  ON_TRACK: { variant: 'complete', label: 'On Track' },
  OVERDUE: { variant: 'review', label: 'Overdue' },
  STALLED: { variant: 'pending', label: 'Stalled' },
  OVER_DEDUCTED: { variant: 'info', label: 'Over-Deducted' },
};

export function MdaDetailPage() {
  const { mdaId } = useParams<{ mdaId: string }>();
  const navigate = useNavigate();
  const [loanPage, setLoanPage] = useState(1);
  useEffect(() => { setLoanPage(1); }, [mdaId]);
  const mdaDetail = useMdaDetail(mdaId!);
  const submissions = useSubmissionHistory(mdaId!);
  const mdaLoansQuery = useMdaLoans(mdaId!, undefined, loanPage);
  const mdaLoans = mdaLoansQuery.data?.data ?? [];
  const loanPagination = mdaLoansQuery.data?.pagination;

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2 text-text-secondary"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* MDA header with health score */}
      <div>
        {mdaDetail.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ) : mdaDetail.data ? (
          <>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">
                {mdaDetail.data.name}
              </h1>
              {mdaDetail.data.healthScore != null && mdaDetail.data.healthBand && (
                <HealthScoreBadge
                  score={mdaDetail.data.healthScore}
                  band={mdaDetail.data.healthBand}
                />
              )}
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              Code: {mdaDetail.data.code}
            </p>
            {mdaDetail.data.officerName && (
              <p className="text-sm text-text-secondary">
                Liaison Officer: {mdaDetail.data.officerName}
              </p>
            )}
          </>
        ) : (
          <p className="text-text-secondary">MDA not found.</p>
        )}
      </div>

      {/* Summary cards + status distribution */}
      <section aria-label="MDA summary">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {mdaDetail.isPending ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-white p-6">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-32" />
              </div>
            ))
          ) : mdaDetail.data ? (
            <>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-sm text-text-secondary mb-1">Loan Count</p>
                <p className="text-2xl font-bold font-mono">
                  {formatCount(mdaDetail.data.loanCount)}
                </p>
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-sm text-text-secondary mb-1">Total Exposure</p>
                <NairaDisplay
                  amount={mdaDetail.data.totalExposure}
                  variant="body"
                  className="text-2xl font-bold"
                />
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-sm text-text-secondary mb-1">Declared Recovery</p>
                <NairaDisplay
                  amount={mdaDetail.data.declaredRecovery ?? mdaDetail.data.expectedMonthlyDeduction ?? '0'}
                  variant="body"
                  className="text-2xl font-bold"
                />
                <p className="text-xs text-text-muted mt-1">What MDA declares monthly</p>
              </div>
            </>
          ) : null}
        </div>

        {/* Declared Recovery vs Collection Potential */}
        {!mdaDetail.isPending && mdaDetail.data && (mdaDetail.data.declaredRecovery || mdaDetail.data.expectedMonthlyDeduction) && (
          <div className="mt-4 rounded-lg border bg-white p-4">
            <p className="text-xs font-medium text-text-secondary mb-2">Recovery Analysis</p>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <span className="text-text-secondary">
                Declared: <NairaDisplay amount={mdaDetail.data.declaredRecovery ?? mdaDetail.data.expectedMonthlyDeduction ?? '0'} variant="table" className="font-medium" />/month
              </span>
              <span className="text-text-secondary">
                Scheme Expected: <NairaDisplay amount={mdaDetail.data.collectionPotential ?? '0'} variant="table" className="font-medium" />/month
              </span>
              {mdaDetail.data.recoveryVariancePercent !== null && mdaDetail.data.recoveryVariancePercent !== undefined && (
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  Math.abs(mdaDetail.data.recoveryVariancePercent) < 1
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700',
                )}>
                  {mdaDetail.data.recoveryVariancePercent > 0 ? '+' : ''}
                  {mdaDetail.data.recoveryVariancePercent.toFixed(1)}% variance
                </span>
              )}
              {mdaDetail.data.recoveryVarianceAmount && Number(mdaDetail.data.recoveryVarianceAmount) !== 0 && (
                <span className="text-xs text-text-muted">
                  (<NairaDisplay amount={mdaDetail.data.recoveryVarianceAmount} variant="compact" /> gap)
                </span>
              )}
            </div>
          </div>
        )}

        {/* Status distribution summary */}
        {!mdaDetail.isPending && mdaDetail.data?.statusDistribution && (
          <div className="mt-4 space-y-3">
            <StatusDistributionBar distribution={mdaDetail.data.statusDistribution} className="h-3" />
            <div className="flex flex-wrap gap-4 text-xs text-text-secondary">
              <span>Completed: {mdaDetail.data.statusDistribution.completed}</span>
              <span>On-Track: {mdaDetail.data.statusDistribution.onTrack}</span>
              <span>Overdue: {mdaDetail.data.statusDistribution.overdue}</span>
              <span>Stalled: {mdaDetail.data.statusDistribution.stalled}</span>
              <span>Over-Deducted: {mdaDetail.data.statusDistribution.overDeducted}</span>
            </div>
          </div>
        )}
      </section>

      {/* Migration uploads for this MDA */}
      {mdaDetail.data?.migrationUploads && mdaDetail.data.migrationUploads.length > 0 && (
        <section aria-label="Migration uploads">
          <h2 className="mb-4 text-lg font-semibold text-text-primary">
            Data Uploads
          </h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Filename</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Records</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
                </tr>
              </thead>
              <tbody>
                {mdaDetail.data.migrationUploads.map((upload: { id: string; filename: string; status: string; totalRecords: number; createdAt: string }) => (
                  <tr key={upload.id} className="border-b">
                    <td className="px-4 py-3 font-medium text-text-primary">{upload.filename}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDate(upload.createdAt)}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-secondary">{formatCount(upload.totalRecords)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={upload.status === 'validated' || upload.status === 'reconciled' ? 'complete' : 'pending'}>
                        {upload.status.charAt(0).toUpperCase() + upload.status.slice(1)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Submission history table */}
      <section aria-label="Submission history">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Monthly Submissions
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Date</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Records</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {submissions.isPending
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-12" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    </tr>
                  ))
                : submissions.data?.items?.map((record) => {
                    const badge = SUBMISSION_STATUS_MAP[record.status];
                    return (
                      <tr
                        key={record.id}
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/dashboard/submissions/${record.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/dashboard/submissions/${record.id}`);
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-text-primary font-mono">
                          <Link
                            to={`/dashboard/submissions/${record.id}`}
                            className="hover:underline"
                          >
                            {record.referenceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {formatDate(record.submissionDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">
                          {formatCount(record.recordCount)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!submissions.isPending && submissions.data && submissions.data.items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-secondary">
              No monthly submissions yet. This section will populate once the MDA submits their first monthly return via CSV or manual entry.
            </p>
          )}
        </div>
      </section>

      {/* Loan list with classification badges */}
      <section aria-label="MDA loans">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Loans</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff Name</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff ID</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Loan Ref</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Outstanding Balance</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">Classification</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Last Deduction</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Retirement Date</th>
              </tr>
            </thead>
            <tbody>
              {mdaLoansQuery.isPending
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3"><Skeleton className="h-4 w-36" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3 text-right"><Skeleton className="ml-auto h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="mx-auto h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                    </tr>
                  ))
                : mdaLoans.map((loan) => {
                    const badge = loan.classification
                      ? CLASSIFICATION_BADGE[loan.classification]
                      : null;
                    return (
                      <tr
                        key={loan.loanId}
                        className={cn(
                          'border-b transition-colors hover:bg-slate-50',
                          'cursor-pointer',
                        )}
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/dashboard/mda/${mdaId}/loan/${loan.loanId}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/dashboard/mda/${mdaId}/loan/${loan.loanId}`);
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {loan.staffName}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          {loan.staffId ?? '—'}
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
                          {loan.lastDeductionDate ? formatDate(loan.lastDeductionDate) : '—'}
                        </td>
                        <td className="px-4 py-3 text-text-secondary">
                          {loan.computedRetirementDate ? formatDate(loan.computedRetirementDate) : '—'}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!mdaLoansQuery.isPending && mdaLoans.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-secondary">
              No loans found for this MDA.
            </p>
          )}
        </div>

        {/* Pagination */}
        {loanPagination && loanPagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <p className="text-sm text-text-secondary">
              Showing {((loanPagination.page - 1) * loanPagination.pageSize) + 1}–{Math.min(loanPagination.page * loanPagination.pageSize, loanPagination.totalItems)} of {formatCount(loanPagination.totalItems)} loans
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={loanPagination.page <= 1}
                onClick={() => setLoanPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loanPagination.page >= loanPagination.totalPages}
                onClick={() => setLoanPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

export { MdaDetailPage as Component };
