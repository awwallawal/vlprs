import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Clock, AlertTriangle, Download, Loader2, Send } from 'lucide-react';
import { formatDate } from '@/lib/formatters';
import { useLoanDetail } from '@/hooks/useLoanData';
import { useCertificate, useDownloadCertificatePdf, useResendNotifications } from '@/hooks/useCertificate';
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
import { MetricHelp } from '@/components/shared/MetricHelp';
import { FlagExceptionDialog } from './components/FlagExceptionDialog';
import { LoanAnnotations } from './components/LoanAnnotations';
import { EventFlagCorrections } from './components/EventFlagCorrections';
import { useExceptions } from '@/hooks/useExceptionData';
import { useAuthStore } from '@/stores/authStore';
import type { LoanStatus } from '@vlprs/shared';

const LOAN_STATUS_MAP = {
  ACTIVE: { variant: 'info', label: 'Active' },
  COMPLETED: { variant: 'complete', label: 'Completed' },
  APPLIED: { variant: 'pending', label: 'Applied' },
  APPROVED: { variant: 'pending', label: 'Approved' },
  TRANSFERRED: { variant: 'review', label: 'Transferred' },
  WRITTEN_OFF: { variant: 'review', label: 'Written Off' },
  RETIRED: { variant: 'complete', label: 'Retired' },
  DECEASED: { variant: 'complete', label: 'Deceased' },
  SUSPENDED: { variant: 'review', label: 'Suspended' },
  LWOP: { variant: 'review', label: 'Leave Without Pay' },
  TRANSFER_PENDING: { variant: 'pending', label: 'Transfer Pending' },
} satisfies Record<LoanStatus, { variant: 'complete' | 'pending' | 'review' | 'info'; label: string }>;

export function LoanDetailPage() {
  const { mdaId, loanId } = useParams<{ mdaId: string; loanId: string }>();
  const navigate = useNavigate();
  const loanDetail = useLoanDetail(loanId!);
  const isCompleted = loanDetail.data?.status === 'COMPLETED';
  const certificate = useCertificate(loanId!, isCompleted);
  const downloadPdf = useDownloadCertificatePdf(loanId!);
  const resendNotifications = useResendNotifications(loanId!);
  const [flagOpen, setFlagOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const canFlag = user?.role === 'super_admin' || user?.role === 'dept_admin';
  const isSuperAdmin = user?.role === 'super_admin';

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
                <MetricHelp metric="loan.gradeLevelTier" />
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
                <MetricHelp metric="loan.outstandingBalance" />
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

      {/* Auto-Stop Certificate (Story 8.2 + 8.3 notifications) */}
      {isCompleted && (
        <section aria-label="Auto-Stop Certificate">
          {certificate.data ? (
            <div className="rounded-lg border-2 border-[#B8860B] bg-gradient-to-r from-green-50 to-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-green-700">
                    Loan Completed — Auto-Stop Certificate Available
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    Certificate {certificate.data.certificateId} — generated{' '}
                    {formatDate(certificate.data.generatedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span>
                      {certificate.data.notifiedMdaAt
                        ? `MDA notified on ${formatDate(certificate.data.notifiedMdaAt)}`
                        : 'MDA notification pending'}
                    </span>
                    <span>
                      {certificate.data.notifiedBeneficiaryAt
                        ? `Beneficiary notified on ${formatDate(certificate.data.notifiedBeneficiaryAt)}`
                        : certificate.data.notificationNotes?.includes('no_email_on_file')
                          ? 'No beneficiary email on file'
                          : 'Beneficiary notification pending'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => downloadPdf.mutate()}
                    disabled={downloadPdf.isPending}
                  >
                    {downloadPdf.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Download Certificate
                  </Button>
                  {isSuperAdmin && (
                    <Button
                      variant="outline"
                      onClick={() => resendNotifications.mutate()}
                      disabled={resendNotifications.isPending}
                    >
                      {resendNotifications.isPending ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Resend Notifications
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : certificate.isPending ? (
            <div className="rounded-lg border bg-white p-6">
              <Skeleton className="h-6 w-64" />
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary">
                Certificate is being generated...
              </p>
            </div>
          )}
        </section>
      )}

      {/* Exception flagging */}
      {canFlag && loanDetail.data && (
        <ExceptionFlagSection loanId={loanId!} flagOpen={flagOpen} setFlagOpen={setFlagOpen} />
      )}

      {/* Annotations & Event Flag Corrections (Story 7.3) */}
      {loanId && (
        <section aria-label="Annotations and corrections" className="space-y-4">
          <LoanAnnotations loanId={loanId} />
          <EventFlagCorrections loanId={loanId} />
        </section>
      )}

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

function ExceptionFlagSection({ loanId, flagOpen, setFlagOpen }: { loanId: string; flagOpen: boolean; setFlagOpen: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { data: result } = useExceptions({ loanId, status: 'open', limit: 1 });
  const openCount = result?.total ?? 0;

  return (
    <section aria-label="Exception flagging" className="space-y-3">
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={() => setFlagOpen(true)}>
          <AlertTriangle className="h-4 w-4 mr-1" />
          Flag as Exception
        </Button>
      </div>
      {openCount > 0 && (
        <p className="text-sm text-text-secondary">
          {openCount} open exception{openCount !== 1 ? 's' : ''} for this loan —{' '}
          <button
            type="button"
            className="text-teal hover:text-teal-hover underline"
            onClick={() => navigate(`/dashboard/exceptions?loanId=${loanId}&status=open`)}
          >
            View in queue
          </button>
        </p>
      )}
      <FlagExceptionDialog open={flagOpen} onOpenChange={setFlagOpen} loanId={loanId} />
    </section>
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
