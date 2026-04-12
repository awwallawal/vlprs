import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatNairaOrDash } from '@/lib/formatters';
import { useSupersedeComparison } from '@/hooks/useMigrationData';
import { MetricHelp } from '@/components/shared/MetricHelp';
import type { ObservationListItem, FieldChange } from '@vlprs/shared';

interface SupersedeDialogProps {
  open: boolean;
  observation: ObservationListItem | null;
  onClose: () => void;
  onConfirm: (supersededUploadId: string, replacementUploadId: string, reason: string) => void;
  isPending?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  principal: 'Principal',
  totalLoan: 'Total Loan',
  monthlyDeduction: 'Monthly Deduction',
  outstandingBalance: 'Outstanding Balance',
  installmentCount: 'Installment Count',
  installmentsPaid: 'Installments Paid',
  installmentsOutstanding: 'Installments Outstanding',
  gradeLevel: 'Grade Level',
};

const MONEY_FIELDS = new Set([
  'principal',
  'totalLoan',
  'monthlyDeduction',
  'outstandingBalance',
]);

function formatChangeValue(field: string, value: string | null): string {
  if (value === null) return '—';
  if (MONEY_FIELDS.has(field)) return formatNairaOrDash(value);
  return value;
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

export function SupersedeDialog({ open, observation, onClose, onConfirm, isPending }: SupersedeDialogProps) {
  const [reason, setReason] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [showNewDetails, setShowNewDetails] = useState(false);
  const [showRemovedDetails, setShowRemovedDetails] = useState(false);

  // Reset dialog state when it closes
  useEffect(() => {
    if (!open) {
      setReason('');
      setShowDetails(false);
      setShowNewDetails(false);
      setShowRemovedDetails(false);
    }
  }, [open]);

  const context = observation?.context?.dataPoints as Record<string, unknown> | undefined;
  const olderUploadId = (context?.olderUploadId as string) ?? '';
  const newerUploadId = (context?.newerUploadId as string) ?? '';
  const olderFilename = (context?.olderFilename as string) ?? 'Unknown';
  const newerFilename = (context?.newerFilename as string) ?? 'Unknown';
  const olderRecordCount = (context?.olderRecordCount as number) ?? 0;
  const newerRecordCount = (context?.newerRecordCount as number) ?? 0;
  const period = (context?.period as string) ?? '';
  const mdaName = observation?.mdaName ?? '';

  const comparison = useSupersedeComparison(
    open && olderUploadId ? olderUploadId : null,
    open && newerUploadId ? newerUploadId : null,
  );

  const canSubmit = reason.length >= 10 && !!olderUploadId && !!newerUploadId;

  const handleConfirm = () => {
    if (canSubmit) {
      onConfirm(olderUploadId, newerUploadId, reason);
      setReason('');
    }
  };

  const diff = comparison.data;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Supersede Previous Upload</DialogTitle>
          <DialogDescription>
            The older upload will be marked as superseded. Its records will be excluded from
            dashboard counts while remaining available for audit.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-text-secondary">
              Upload <span className="font-medium">{olderFilename}</span>{' '}
              ({olderRecordCount} records) will be superseded by{' '}
              <span className="font-medium">{newerFilename}</span>{' '}
              ({newerRecordCount} records){period ? ` for ${period}` : ''}{mdaName ? ` — ${mdaName}` : ''}
            </p>
          </div>

          {/* Record-level comparison preview (Story 15.0n) */}
          <div className="bg-gray-50 border border-border rounded-lg p-3">
            <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Record Comparison
            </h4>

            {comparison.isLoading && (
              <p className="text-xs text-text-tertiary italic">Computing comparison…</p>
            )}

            {comparison.isError && (
              <p className="text-xs text-amber-600">
                Comparison could not be loaded. You can still proceed — the supersede action will work without this preview.
              </p>
            )}

            {diff && (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Unchanged <MetricHelp metric="migration.supersedeUnchanged" /></span>
                    <span className="font-medium text-text-primary">{diff.unchanged} records</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Modified <MetricHelp metric="migration.supersedeModified" /></span>
                    <span className="font-medium text-amber-700">{diff.modified} records</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">New <MetricHelp metric="migration.supersedeNew" /></span>
                    <span className="font-medium text-teal">{diff.newRecords} records</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Removed <MetricHelp metric="migration.supersedeRemoved" /></span>
                    <span className="font-medium text-text-primary">{diff.removed} records</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {diff.modified > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowDetails((v) => !v)}
                      className="text-xs text-teal hover:text-teal/80 underline"
                    >
                      {showDetails ? 'Hide modified' : 'View modified'}
                    </button>
                  )}
                  {diff.newDetails.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowNewDetails((v) => !v)}
                      className="text-xs text-teal hover:text-teal/80 underline"
                    >
                      {showNewDetails ? 'Hide new' : 'View new'}
                    </button>
                  )}
                  {diff.removedDetails.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowRemovedDetails((v) => !v)}
                      className="text-xs text-teal hover:text-teal/80 underline"
                    >
                      {showRemovedDetails ? 'Hide removed' : 'View removed'}
                    </button>
                  )}
                </div>

                {showDetails && diff.modifiedDetails.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3 space-y-2 max-h-64 overflow-y-auto">
                    {diff.modifiedDetails.map((record, idx) => (
                      <div key={`${record.staffName}-${idx}`} className="text-xs">
                        <p className="font-medium text-text-primary">
                          {record.staffName}
                          {record.staffId && (
                            <span className="text-text-tertiary font-normal"> ({record.staffId})</span>
                          )}
                        </p>
                        <ul className="mt-0.5 ml-3 space-y-0.5">
                          {record.changes.map((change: FieldChange) => (
                            <li key={change.field} className="text-text-secondary">
                              <span>{fieldLabel(change.field)}: </span>
                              <span className="text-text-tertiary">
                                {formatChangeValue(change.field, change.oldValue)}
                              </span>
                              <span className="mx-1 text-amber-600">→</span>
                              <span className="text-amber-700 font-medium">
                                {formatChangeValue(change.field, change.newValue)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {showNewDetails && diff.newDetails.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3 max-h-48 overflow-y-auto">
                    <p className="text-[11px] text-text-tertiary mb-1.5">Present in new upload only:</p>
                    <ul className="space-y-0.5">
                      {diff.newDetails.map((r, idx) => (
                        <li key={`new-${idx}`} className="text-xs text-text-primary">
                          {r.staffName}
                          {r.staffId && <span className="text-text-tertiary"> ({r.staffId})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {showRemovedDetails && diff.removedDetails.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3 max-h-48 overflow-y-auto">
                    <p className="text-[11px] text-text-tertiary mb-1.5">Present in old upload only:</p>
                    <ul className="space-y-0.5">
                      {diff.removedDetails.map((r, idx) => (
                        <li key={`removed-${idx}`} className="text-xs text-text-primary">
                          {r.staffName}
                          {r.staffId && <span className="text-text-tertiary"> ({r.staffId})</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label htmlFor="supersede-reason" className="text-xs font-medium text-text-muted block mb-1">
              Why is this upload being superseded? (min 10 characters)
            </label>
            <Textarea
              id="supersede-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Newer file contains corrected records from the MDA..."
              rows={3}
            />
            {reason.length > 0 && reason.length < 10 && (
              <p className="text-xs text-amber-600 mt-1">{10 - reason.length} more characters needed</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit || isPending}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isPending ? 'Superseding...' : 'Supersede Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
