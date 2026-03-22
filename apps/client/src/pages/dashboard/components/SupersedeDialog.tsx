import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ObservationListItem } from '@vlprs/shared';

interface SupersedeDialogProps {
  open: boolean;
  observation: ObservationListItem | null;
  onClose: () => void;
  onConfirm: (supersededUploadId: string, replacementUploadId: string, reason: string) => void;
  isPending?: boolean;
}

export function SupersedeDialog({ open, observation, onClose, onConfirm, isPending }: SupersedeDialogProps) {
  const [reason, setReason] = useState('');

  // Reset reason when dialog closes or observation changes
  useEffect(() => {
    if (!open) setReason('');
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

  const canSubmit = reason.length >= 10 && olderUploadId && newerUploadId;

  const handleConfirm = () => {
    if (canSubmit) {
      onConfirm(olderUploadId, newerUploadId, reason);
      setReason('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
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
