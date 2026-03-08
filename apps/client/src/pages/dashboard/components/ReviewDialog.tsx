import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (note?: string) => void;
  isPending?: boolean;
}

export function ReviewDialog({ open, onClose, onConfirm, isPending }: ReviewDialogProps) {
  const [note, setNote] = useState('');

  const handleConfirm = () => {
    onConfirm(note || undefined);
    setNote('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Reviewed</DialogTitle>
          <DialogDescription>
            Confirm that you have reviewed this observation. You may optionally add a note.
          </DialogDescription>
        </DialogHeader>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note..."
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[80px]"
        />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Reviewing...' : 'Review'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
