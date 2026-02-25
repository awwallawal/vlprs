import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Clock } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { useLoanDetail } from '@/hooks/useLoanData';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import type { LoanStatus } from '@vlprs/shared';

const LOAN_STATUS_MAP: Record<LoanStatus, { variant: 'complete' | 'pending' | 'review' | 'info'; label: string }> = {
  ACTIVE: { variant: 'info', label: 'Active' },
  COMPLETED: { variant: 'complete', label: 'Completed' },
  APPLIED: { variant: 'pending', label: 'Applied' },
  APPROVED: { variant: 'pending', label: 'Approved' },
  TRANSFERRED: { variant: 'review', label: 'Transferred' },
  WRITTEN_OFF: { variant: 'review', label: 'Written Off' },
};

export function LoanDetailPage() {
  const { mdaId, loanId } = useParams<{ mdaId: string; loanId: string }>();
  const navigate = useNavigate();
  const loanDetail = useLoanDetail(loanId!);

  return (
    <div className="space-y-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2 text-text-secondary"
        onClick={() =>
          mdaId
            ? navigate(`/dashboard/mda/${mdaId}`)
            : navigate('/dashboard')
        }
      >
        <ArrowLeft className="h-4 w-4" />
        {mdaId ? 'Back to MDA' : 'Back to Dashboard'}
      </Button>

      {/* Loan header */}
      <div>
        {loanDetail.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : loanDetail.data ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-text-primary">
                {loanDetail.data.borrowerName}
              </h1>
              <Badge variant={LOAN_STATUS_MAP[loanDetail.data.status].variant}>
                {LOAN_STATUS_MAP[loanDetail.data.status].label}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-text-secondary font-mono">
              Staff ID: {loanDetail.data.staffId ?? '—'}
            </p>
          </>
        ) : (
          <p className="text-text-secondary">Loan not found.</p>
        )}
      </div>

      {/* Detail cards */}
      {loanDetail.isPending ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-white p-6">
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-6 w-36" />
            </div>
          ))}
        </div>
      ) : loanDetail.data ? (
        <section aria-label="Loan details">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">MDA</p>
              <p className="font-medium text-text-primary">
                {loanDetail.data.mdaName}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">Loan Reference</p>
              <p className="font-medium font-mono text-text-primary">
                {loanDetail.data.loanRef}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Grade Level Tier
              </p>
              <p className="font-medium text-text-primary">
                Tier {loanDetail.data.gradeLevelTier}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">Loan Amount</p>
              <NairaDisplay
                amount={loanDetail.data.principal}
                variant="body"
                className="font-bold text-lg"
              />
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">Tenure</p>
              <p className="font-medium text-text-primary">
                {loanDetail.data.installmentsPaid} paid /{' '}
                {loanDetail.data.installmentsRemaining} remaining
              </p>
              <p className="text-xs text-text-muted mt-1">
                {loanDetail.data.installmentsPaid +
                  loanDetail.data.installmentsRemaining}{' '}
                total installments
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Outstanding Balance
              </p>
              <NairaDisplay
                amount={loanDetail.data.outstandingBalance}
                variant="body"
                className="font-bold text-lg"
              />
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Last Deduction
              </p>
              <p className="font-medium text-text-primary">
                {loanDetail.data.lastDeductionDate
                  ? formatDate(loanDetail.data.lastDeductionDate)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Retirement Date
              </p>
              <p className="font-medium text-text-primary">
                {loanDetail.data.retirementDate
                  ? formatDate(loanDetail.data.retirementDate)
                  : '—'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {/* Placeholder sections for future features */}
      <section aria-label="Upcoming features" className="space-y-4">
        <PlaceholderSection
          title="Repayment Schedule"
          sprint="Coming in Sprint 2 (Epic 2)"
        />
        <PlaceholderSection
          title="Ledger History"
          sprint="Coming in Sprint 2 (Epic 2)"
        />
        <PlaceholderSection
          title="Annotations"
          sprint="Coming in Sprint 9 (Epic 7)"
        />
      </section>

      {/* Collapsed accordion: "How was this calculated?" */}
      <section aria-label="Calculation details">
        <Accordion type="single" collapsible>
          <AccordionItem value="calculation">
            <AccordionTrigger className="text-sm font-medium text-text-secondary hover:no-underline">
              How was this calculated?
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-text-secondary">
                Coming in Sprint 2 — Detailed calculation breakdown will be
                available when the loan amortization engine is implemented.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>
    </div>
  );
}

function PlaceholderSection({
  title,
  sprint,
}: {
  title: string;
  sprint: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-white p-6">
      <div className="flex items-center gap-2 text-text-secondary">
        <Clock className="h-4 w-4" />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      <p className="mt-1 text-sm text-text-muted">{sprint}</p>
    </div>
  );
}

export { LoanDetailPage as Component };
