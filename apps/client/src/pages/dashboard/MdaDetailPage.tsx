import { useParams, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate, formatCount } from '@/lib/formatters';
import { useMdaDetail } from '@/hooks/useMdaData';
import { useSubmissionHistory } from '@/hooks/useSubmissionData';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MOCK_LOAN_DETAILS } from '@/mocks/loanDetail';
import type { LoanSummary, LoanStatus } from '@vlprs/shared';

const SUBMISSION_STATUS_MAP = {
  confirmed: { variant: 'complete' as const, label: 'Confirmed' },
  processing: { variant: 'pending' as const, label: 'Processing' },
  rejected: { variant: 'review' as const, label: 'Rejected' },
} as const;

const LOAN_STATUS_MAP: Record<LoanStatus, { variant: 'complete' | 'pending' | 'review' | 'info'; label: string }> = {
  ACTIVE: { variant: 'info', label: 'Active' },
  COMPLETED: { variant: 'complete', label: 'Completed' },
  APPLIED: { variant: 'pending', label: 'Applied' },
  APPROVED: { variant: 'pending', label: 'Approved' },
  TRANSFERRED: { variant: 'review', label: 'Transferred' },
  WRITTEN_OFF: { variant: 'review', label: 'Written Off' },
};

export function MdaDetailPage() {
  const { mdaId } = useParams<{ mdaId: string }>();
  const navigate = useNavigate();
  const mdaDetail = useMdaDetail(mdaId!);
  const submissions = useSubmissionHistory(mdaId!);

  // Loans for this MDA via TanStack Query (mock → swap queryFn when wiring to GET /api/mdas/:id/loans)
  const mdaLoansQuery = useQuery<LoanSummary[]>({
    queryKey: ['mda', mdaId!, 'loans'],
    queryFn: async () => {
      const name = mdaDetail.data?.name;
      if (!name) return [];
      return Object.values(MOCK_LOAN_DETAILS).filter(
        (loan) => loan.mdaName === name,
      );
    },
    enabled: !!mdaDetail.data?.name,
    staleTime: 30_000,
  });
  const mdaLoans = mdaLoansQuery.data ?? [];

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2 text-text-secondary"
        onClick={() => navigate('/dashboard')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      {/* MDA header */}
      <div>
        {mdaDetail.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-48" />
          </div>
        ) : mdaDetail.data ? (
          <>
            <h1 className="text-2xl font-bold text-text-primary">
              {mdaDetail.data.name}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              Code: {mdaDetail.data.code}
            </p>
            <p className="text-sm text-text-secondary">
              Liaison Officer: {mdaDetail.data.officerName}
            </p>
          </>
        ) : (
          <p className="text-text-secondary">MDA not found.</p>
        )}
      </div>

      {/* Summary cards */}
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
                <p className="text-sm text-text-secondary mb-1">
                  Total Exposure
                </p>
                <NairaDisplay
                  amount={mdaDetail.data.totalExposure}
                  variant="body"
                  className="text-2xl font-bold"
                />
              </div>
              <div className="rounded-lg border bg-white p-6">
                <p className="text-sm text-text-secondary mb-1">
                  Monthly Recovery
                </p>
                <NairaDisplay
                  amount={mdaDetail.data.monthlyRecovery}
                  variant="body"
                  className="text-2xl font-bold"
                />
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* Submission history table */}
      <section aria-label="Submission history">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          Submission History
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Reference
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Date
                </th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">
                  Records
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {submissions.isPending
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-40" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Skeleton className="ml-auto h-4 w-12" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </td>
                    </tr>
                  ))
                : submissions.data?.map((record) => {
                    const badge = SUBMISSION_STATUS_MAP[record.status];
                    return (
                      <tr key={record.id} className="border-b">
                        <td className="px-4 py-3 font-medium text-text-primary font-mono">
                          {record.referenceNumber}
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
          {!submissions.isPending &&
            submissions.data &&
            submissions.data.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-text-secondary">
                No submission history available.
              </p>
            )}
        </div>
      </section>

      {/* Loan list */}
      <section aria-label="MDA loans">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">Loans</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Staff Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Staff ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Loan Ref
                </th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">
                  Outstanding Balance
                </th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {mdaDetail.isPending
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-36" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-32" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-4 w-28" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Skeleton className="ml-auto h-4 w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                    </tr>
                  ))
                : mdaLoans.map((loan) => {
                    const badge = LOAN_STATUS_MAP[loan.status];
                    return (
                      <tr
                        key={loan.loanId}
                        className={cn(
                          'border-b transition-colors hover:bg-slate-50',
                          'cursor-pointer',
                        )}
                        role="link"
                        tabIndex={0}
                        onClick={() =>
                          navigate(
                            `/dashboard/mda/${mdaId}/loan/${loan.loanId}`,
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(
                              `/dashboard/mda/${mdaId}/loan/${loan.loanId}`,
                            );
                          }
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {loan.borrowerName}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          {loan.staffId ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          {loan.loanRef}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <NairaDisplay
                            amount={loan.outstandingBalance}
                            variant="table"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
          {!mdaDetail.isPending && mdaLoans.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-text-secondary">
              No loans found for this MDA.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

export { MdaDetailPage as Component };
