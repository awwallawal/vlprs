import { useState } from 'react';
import { CheckCircle2, Info, Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { useHistoricalReconciliation, useFlagDiscrepancy } from '@/hooks/useHistoricalSubmission';
import { UI_COPY } from '@vlprs/shared';
import type { HistoricalReconciliationDetail } from '@vlprs/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface HistoricalReconciliationProps {
  submissionId: string;
  className?: string;
}

export function HistoricalReconciliation({ submissionId, className }: HistoricalReconciliationProps) {
  const { data, isPending } = useHistoricalReconciliation(submissionId);
  const flagMutation = useFlagDiscrepancy(submissionId);
  const [flagDialog, setFlagDialog] = useState<{ open: boolean; staffId: string }>({ open: false, staffId: '' });
  const [reason, setReason] = useState('');

  if (isPending) {
    return (
      <div className={cn('rounded-lg bg-slate-50 p-4 space-y-3', className)}>
        <Skeleton className="h-6 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!data) return null;

  // No baseline state (AC 9)
  if (data.noBaseline) {
    return (
      <div className={cn('rounded-lg bg-slate-50 p-4', className)}>
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-5 w-5 text-[#0D7377]" aria-hidden="true" />
          <h2 className="text-base font-semibold text-text-primary">
            {UI_COPY.HISTORICAL_RECONCILIATION_HEADER}
          </h2>
        </div>
        <p className="text-sm text-text-secondary">
          {UI_COPY.HISTORICAL_NO_BASELINE_MESSAGE}
        </p>
      </div>
    );
  }

  const allClear = data.varianceCount === 0;

  function openFlagDialog(staffId: string) {
    setFlagDialog({ open: true, staffId });
    setReason('');
  }

  function handleFlag() {
    flagMutation.mutate(
      { staffId: flagDialog.staffId, reason },
      {
        onSuccess: () => {
          setFlagDialog({ open: false, staffId: '' });
          toast.success(UI_COPY.HISTORICAL_FLAG_FOR_REVIEW + ' — Discrepancy flagged for review');
        },
      },
    );
  }

  return (
    <div className={cn('rounded-lg bg-slate-50 p-4 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5 text-[#0D7377]" aria-hidden="true" />
        <h2 className="text-base font-semibold text-text-primary">
          {UI_COPY.HISTORICAL_RECONCILIATION_HEADER}
        </h2>
      </div>

      {/* Summary badges */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="complete" className="text-sm">
          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
          {data.matchedCount} {UI_COPY.HISTORICAL_MATCHED_LABEL}
        </Badge>
        {data.varianceCount > 0 && (
          <Badge variant="review" className="text-sm">
            <Info className="mr-1 h-3.5 w-3.5" />
            {data.varianceCount} {UI_COPY.HISTORICAL_VARIANCE_LABEL}
          </Badge>
        )}
        <span className="text-sm text-text-secondary">
          {UI_COPY.HISTORICAL_MATCH_RATE.replace('{rate}', String(data.matchRate))}
        </span>
      </div>

      {/* All-clear state */}
      {allClear && (
        <div className="flex items-center gap-2 text-sm text-[#16A34A]">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{UI_COPY.HISTORICAL_ALL_CLEAR}</span>
        </div>
      )}

      {/* Detail table */}
      {data.details.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-text-secondary">
                <th className="pb-2 pr-3 font-medium">Staff ID</th>
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 font-medium text-right">Declared</th>
                <th className="pb-2 pr-3 font-medium text-right">Baseline</th>
                <th className="pb-2 pr-3 font-medium text-right">Variance</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {data.details.map((detail) => (
                <DetailRow
                  key={detail.staffId}
                  detail={detail}
                  onFlag={openFlagDialog}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Flag dialog */}
      <Dialog open={flagDialog.open} onOpenChange={(open) => setFlagDialog({ ...flagDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{UI_COPY.HISTORICAL_FLAG_FOR_REVIEW}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              Flag Staff ID <strong>{flagDialog.staffId}</strong> for Department Admin review.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for flagging (at least 10 characters)..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-text-muted">{reason.length}/10 characters minimum</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFlagDialog({ open: false, staffId: '' })}>
              Cancel
            </Button>
            <Button
              onClick={handleFlag}
              disabled={reason.length < 10 || flagMutation.isPending}
            >
              {flagMutation.isPending ? 'Flagging...' : 'Flag for Review'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  detail,
  onFlag,
}: {
  detail: HistoricalReconciliationDetail;
  onFlag: (staffId: string) => void;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="py-2 pr-3 font-mono text-xs">{detail.staffId}</td>
      <td className="py-2 pr-3">{detail.staffName}</td>
      <td className="py-2 pr-3 text-right">
        <NairaDisplay amount={detail.declaredAmount} variant="table" />
      </td>
      <td className="py-2 pr-3 text-right">
        <NairaDisplay amount={detail.baselineAmount} variant="table" />
      </td>
      <td className="py-2 pr-3 text-right">
        <NairaDisplay amount={detail.variance} variant="table" />
      </td>
      <td className="py-2 pr-3">
        {detail.matchStatus === 'matched' ? (
          <Badge variant="complete" className="text-xs">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {UI_COPY.HISTORICAL_MATCHED_LABEL}
          </Badge>
        ) : detail.flagged ? (
          <Badge variant="review" className="text-xs">
            <Flag className="mr-1 h-3 w-3" />
            Flagged
          </Badge>
        ) : (
          <Badge variant="review" className="text-xs">
            <Info className="mr-1 h-3 w-3" />
            {UI_COPY.HISTORICAL_VARIANCE_LABEL}
          </Badge>
        )}
      </td>
      <td className="py-2">
        {detail.matchStatus === 'variance' && !detail.flagged && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => onFlag(detail.staffId)}
          >
            <Flag className="mr-1 h-3 w-3" />
            Flag
          </Button>
        )}
        {detail.flagged && detail.flagReason && (
          <span className="text-xs text-text-muted" title={detail.flagReason}>
            {detail.flagReason.length > 30
              ? detail.flagReason.slice(0, 30) + '...'
              : detail.flagReason}
          </span>
        )}
      </td>
    </tr>
  );
}
