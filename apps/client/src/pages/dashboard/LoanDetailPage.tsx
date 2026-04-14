import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, AlertTriangle, Download, Loader2, Send, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/formatters';
import { useLoanDetail, useUpdateStaffId } from '@/hooks/useLoanData';
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
  const updateStaffId = useUpdateStaffId(loanId!);
  const isCompleted = loanDetail.data?.status === 'COMPLETED';
  const certificate = useCertificate(loanId!, isCompleted);
  const downloadPdf = useDownloadCertificatePdf(loanId!);
  const resendNotifications = useResendNotifications(loanId!);
  const [flagOpen, setFlagOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState(false);
  const [staffIdDraft, setStaffIdDraft] = useState('');
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
                {loanDetail.data.staffName}
              </h1>
              <Badge variant={LOAN_STATUS_MAP[loanDetail.data.status].variant}>
                {LOAN_STATUS_MAP[loanDetail.data.status].label}
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2">
              {editingStaffId ? (
                <>
                  <Input
                    value={staffIdDraft}
                    onChange={(e) => setStaffIdDraft(e.target.value)}
                    className="h-7 w-48 font-mono text-sm"
                    placeholder="e.g. OY/BIR/001"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && staffIdDraft.trim().length >= 2) {
                        updateStaffId.mutate({ staffId: staffIdDraft.trim() }, {
                          onSuccess: () => { setEditingStaffId(false); toast.success('Staff ID updated'); },
                          onError: (err) => toast.error(err.message),
                        });
                      }
                      if (e.key === 'Escape') setEditingStaffId(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (staffIdDraft.trim().length >= 2) {
                        updateStaffId.mutate({ staffId: staffIdDraft.trim() }, {
                          onSuccess: () => { setEditingStaffId(false); toast.success('Staff ID updated'); },
                          onError: (err) => toast.error(err.message),
                        });
                      }
                    }}
                    disabled={staffIdDraft.trim().length < 2 || updateStaffId.isPending}
                    className="p-1 rounded text-teal hover:bg-teal/10 disabled:opacity-40"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingStaffId(false)}
                    className="p-1 rounded text-text-muted hover:bg-slate-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm text-text-secondary font-mono">
                    Staff ID: {loanDetail.data.staffId ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setStaffIdDraft(loanDetail.data?.staffId ?? ''); setEditingStaffId(true); }}
                    className="p-1 rounded text-text-muted hover:text-teal hover:bg-teal/10 transition-colors"
                    title="Edit Staff ID"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {loanDetail.data.staffId?.startsWith('MIG-') && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Needs real ID</span>
                  )}
                </>
              )}
            </div>
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
                {loanDetail.data.loanReference}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Grade Level
              </p>
              <p className="font-medium text-text-primary">
                {loanDetail.data.gradeLevel}
              </p>
              {loanDetail.data.gradeLevel !== 'MIGRATION' && loanDetail.data.gradeLevel?.startsWith('Levels') && (
                <p className="text-xs text-text-muted mt-1">Inferred from principal amount</p>
              )}
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">Loan Amount</p>
              <NairaDisplay
                amount={loanDetail.data.principalAmount}
                variant="body"
                className="font-bold text-lg"
              />
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">Tenure</p>
              <p className="font-medium text-text-primary">
                {loanDetail.data.migrationContext?.installmentsPaid ?? loanDetail.data.balance.installmentsCompleted} paid /{' '}
                {loanDetail.data.migrationContext?.installmentsOutstanding ?? loanDetail.data.balance.installmentsRemaining} remaining
              </p>
              <p className="text-xs text-text-muted mt-1">
                {loanDetail.data.tenureMonths} total installments
              </p>
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Outstanding Balance
                <MetricHelp metric="loan.outstandingBalance" />
              </p>
              <NairaDisplay
                amount={loanDetail.data.balance.computedBalance}
                variant="body"
                className="font-bold text-lg"
              />
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Monthly Deduction
              </p>
              <NairaDisplay
                amount={loanDetail.data.monthlyDeductionAmount}
                variant="body"
                className="font-medium"
              />
            </div>
            <div className="rounded-lg border bg-white p-6">
              <p className="text-sm text-text-secondary mb-1">
                Retirement Date
              </p>
              <p className="font-medium text-text-primary">
                {loanDetail.data.temporalProfile?.computedRetirementDate
                  ? formatDate(loanDetail.data.temporalProfile.computedRetirementDate)
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

      {/* Repayment Schedule */}
      {loanDetail.data?.schedule && (
        <section aria-label="Repayment schedule">
          <Accordion type="single" collapsible>
            <AccordionItem value="schedule">
              <AccordionTrigger className="text-sm font-medium text-text-secondary hover:no-underline">
                Repayment Schedule ({loanDetail.data.schedule.schedule.length} months)
              </AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="px-3 py-2 text-left font-medium text-text-secondary">#</th>
                        <th className="px-3 py-2 text-right font-medium text-text-secondary">Principal</th>
                        <th className="px-3 py-2 text-right font-medium text-text-secondary">Interest</th>
                        <th className="px-3 py-2 text-right font-medium text-text-secondary">Total</th>
                        <th className="px-3 py-2 text-right font-medium text-text-secondary">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loanDetail.data.schedule.schedule.map((row) => (
                        <tr key={row.monthNumber} className="border-b last:border-b-0">
                          <td className="px-3 py-1.5 text-text-secondary">{row.monthNumber}</td>
                          <td className="px-3 py-1.5 text-right font-mono"><NairaDisplay amount={row.principalComponent} variant="table" /></td>
                          <td className="px-3 py-1.5 text-right font-mono"><NairaDisplay amount={row.interestComponent} variant="table" /></td>
                          <td className="px-3 py-1.5 text-right font-mono"><NairaDisplay amount={row.totalDeduction} variant="table" /></td>
                          <td className="px-3 py-1.5 text-right font-mono"><NairaDisplay amount={row.runningBalance} variant="table" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      )}

      {/* Calculation details */}
      {loanDetail.data?.balance && (
        <section aria-label="Calculation details">
          <Accordion type="single" collapsible>
            <AccordionItem value="calculation">
              <AccordionTrigger className="text-sm font-medium text-text-secondary hover:no-underline">
                How was the balance calculated?
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-mono">{loanDetail.data.balance.derivation.formula}</p>
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    <span>Total Loan:</span>
                    <span className="font-mono text-right"><NairaDisplay amount={loanDetail.data.balance.derivation.totalLoan} variant="table" /></span>
                    <span>Total Paid:</span>
                    <span className="font-mono text-right"><NairaDisplay amount={loanDetail.data.balance.totalAmountPaid} variant="table" /></span>
                    <span>Outstanding:</span>
                    <span className="font-mono text-right"><NairaDisplay amount={loanDetail.data.balance.computedBalance} variant="table" /></span>
                  </div>
                  <p className="text-xs text-text-muted">{loanDetail.data.ledgerEntryCount} ledger {loanDetail.data.ledgerEntryCount === 1 ? 'entry' : 'entries'}</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      )}
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

export { LoanDetailPage as Component };
