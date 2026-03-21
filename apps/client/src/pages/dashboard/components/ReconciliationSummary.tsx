import { useState } from 'react';
import { Info, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { UI_COPY } from '@vlprs/shared';
import { useReconciliationSummary, useResolveDiscrepancy } from '@/hooks/useReconciliation';
import type { ReconciliationDetail, Role } from '@vlprs/shared';

interface ReconciliationSummaryProps {
  submissionId: string;
  userRole?: Role;
  mdaId?: string;
  className?: string;
}

const STATUS_BADGE_MAP: Record<string, { variant: 'complete' | 'review' | 'info' | 'pending'; label: string }> = {
  matched: { variant: 'complete', label: UI_COPY.EVENT_RECONCILIATION_MATCHED },
  date_discrepancy: { variant: 'review', label: UI_COPY.EVENT_RECONCILIATION_DATE_DISCREPANCY },
  unconfirmed_event: { variant: 'review', label: UI_COPY.EVENT_RECONCILIATION_UNCONFIRMED },
  new_csv_event: { variant: 'info', label: UI_COPY.EVENT_RECONCILIATION_NEW },
};

export function ReconciliationSummary({
  submissionId,
  userRole,
  mdaId,
  className,
}: ReconciliationSummaryProps) {
  const { data, isPending, isError } = useReconciliationSummary(submissionId);
  const resolveMutation = useResolveDiscrepancy(submissionId, mdaId);

  const [resolveDialog, setResolveDialog] = useState<{
    open: boolean;
    eventId: string;
    action: 'MATCHED' | 'UNCONFIRMED';
  }>({ open: false, eventId: '', action: 'MATCHED' });
  const [reason, setReason] = useState('');

  const canResolve = userRole === 'super_admin' || userRole === 'dept_admin';

  // Loading state
  if (isPending) {
    return (
      <div className={cn('rounded-lg bg-slate-50 p-4 space-y-3', className)}>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-4 w-52" />
      </div>
    );
  }

  // Error state (L1 fix)
  if (isError) {
    return (
      <section className={cn('rounded-lg bg-slate-50 p-4', className)}>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Info className="h-4 w-4 text-text-muted" aria-hidden="true" />
          <span>Unable to load reconciliation summary. Please try again later.</span>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const { counts, details } = data;
  const totalEvents = counts.matched + counts.dateDiscrepancy + counts.unconfirmed + counts.newCsvEvent;

  // Empty state: no events to reconcile
  if (totalEvents === 0) {
    return (
      <section className={cn('rounded-lg bg-slate-50 p-4', className)}>
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Info className="h-4 w-4 text-[#0D7377]" aria-hidden="true" />
          <span>No employment events to reconcile</span>
        </div>
      </section>
    );
  }

  // All-clear state
  const allClear = counts.dateDiscrepancy === 0 && counts.unconfirmed === 0;

  function openResolveDialog(eventId: string, action: 'MATCHED' | 'UNCONFIRMED') {
    setResolveDialog({ open: true, eventId, action });
    setReason('');
  }

  function handleResolve() {
    if (reason.length < 10) return;
    resolveMutation.mutate(
      { eventId: resolveDialog.eventId, status: resolveDialog.action, reason },
      { onSuccess: () => setResolveDialog({ open: false, eventId: '', action: 'MATCHED' }) },
    );
  }

  return (
    <section
      aria-labelledby="reconciliation-summary-heading"
      className={cn('rounded-lg border-l-4 border-[#0D7377] bg-slate-50 p-4 space-y-4', className)}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5 text-[#0D7377]" aria-hidden="true" />
        <h2
          id="reconciliation-summary-heading"
          className="text-base font-semibold text-text-primary"
        >
          {UI_COPY.RECONCILIATION_SUMMARY_HEADER}
        </h2>
      </div>

      {/* All-clear banner */}
      {allClear && (
        <div className="flex items-center gap-2 text-sm text-[#16A34A]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>All events reconciled — no items requiring attention</span>
        </div>
      )}

      {/* Summary count badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="complete">
          {counts.matched} confirmed
        </Badge>
        {counts.dateDiscrepancy > 0 && (
          <Badge variant="review">
            {counts.dateDiscrepancy} date {counts.dateDiscrepancy === 1 ? 'difference' : 'differences'}
          </Badge>
        )}
        {counts.unconfirmed > 0 && (
          <Badge variant="review">
            {counts.unconfirmed} pending confirmation
          </Badge>
        )}
        {counts.newCsvEvent > 0 && (
          <Badge variant="info">
            {counts.newCsvEvent} new from submission
          </Badge>
        )}
      </div>

      {/* Detail table */}
      {details.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-text-secondary">
                <th className="pb-2 pr-3 font-medium">Staff ID</th>
                <th className="pb-2 pr-3 font-medium">Staff Name</th>
                <th className="pb-2 pr-3 font-medium">Event Type</th>
                <th className="pb-2 pr-3 font-medium">CSV Date</th>
                <th className="pb-2 pr-3 font-medium">Event Date</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 pr-3 font-medium">Days Diff</th>
                {canResolve && <th className="pb-2 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {details.map((detail, idx) => (
                <DetailRow
                  key={`${detail.staffId}-${detail.eventType}-${idx}`}
                  detail={detail}
                  canResolve={canResolve}
                  onResolve={openResolveDialog}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resolution confirmation dialog */}
      <Dialog
        open={resolveDialog.open}
        onOpenChange={(open) => {
          if (!open) setResolveDialog({ open: false, eventId: '', action: 'MATCHED' });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resolveDialog.action === 'MATCHED'
                ? UI_COPY.RECONCILIATION_CONFIRM_DESPITE_VARIANCE
                : UI_COPY.RECONCILIATION_REJECT_MATCH}
            </DialogTitle>
            <DialogDescription>
              Please provide a reason for this resolution (minimum 10 characters).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for resolution..."
            rows={3}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResolveDialog({ open: false, eventId: '', action: 'MATCHED' })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={reason.length < 10 || resolveMutation.isPending}
            >
              {resolveMutation.isPending ? 'Resolving...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ─── Detail Row ──────────────────────────────────────────────────────

function DetailRow({
  detail,
  canResolve,
  onResolve,
}: {
  detail: ReconciliationDetail;
  canResolve: boolean;
  onResolve: (eventId: string, action: 'MATCHED' | 'UNCONFIRMED') => void;
}) {
  const badgeInfo = STATUS_BADGE_MAP[detail.reconciliationStatus] ?? {
    variant: 'pending' as const,
    label: detail.reconciliationStatus,
  };

  const showActions =
    canResolve && detail.reconciliationStatus === 'date_discrepancy' && detail.employmentEventId;

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-3 text-text-primary">{detail.staffId}</td>
      <td className="py-2 pr-3 text-text-primary">{detail.staffName}</td>
      <td className="py-2 pr-3 text-text-secondary">{detail.eventType}</td>
      <td className="py-2 pr-3 text-text-secondary">{detail.csvEventDate ?? '—'}</td>
      <td className="py-2 pr-3 text-text-secondary">{detail.employmentEventDate ?? '—'}</td>
      <td className="py-2 pr-3">
        <Badge variant={badgeInfo.variant}>{badgeInfo.label}</Badge>
      </td>
      <td className="py-2 pr-3 text-text-secondary">
        {detail.daysDifference !== null ? `${detail.daysDifference}d` : '—'}
      </td>
      {canResolve && (
        <td className="py-2">
          {showActions && (
            <div className="flex gap-1">
              <button
                type="button"
                className="text-xs text-[#0D7377] hover:underline"
                onClick={() => onResolve(detail.employmentEventId!, 'MATCHED')}
              >
                Confirm
              </button>
              <span className="text-text-muted">|</span>
              <button
                type="button"
                className="text-xs text-text-secondary hover:underline"
                onClick={() => onResolve(detail.employmentEventId!, 'UNCONFIRMED')}
              >
                Reject
              </button>
            </div>
          )}
        </td>
      )}
    </tr>
  );
}
