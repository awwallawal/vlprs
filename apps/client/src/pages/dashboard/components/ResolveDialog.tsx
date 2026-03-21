import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ResolveDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (resolutionNote: string) => void;
  isPending?: boolean;
}

export function ResolveDialog({ open, onClose, onConfirm, isPending }: ResolveDialogProps) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!resolutionNote.trim()) {
      setError('Resolution note is required');
      return;
    }
    setError('');
    onConfirm(resolutionNote);
    setResolutionNote('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as Resolved</DialogTitle>
          <DialogDescription>
            Provide a resolution note explaining what was found and how this observation was addressed.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Textarea
            value={resolutionNote}
            onChange={(e) => {
              setResolutionNote(e.target.value);
              if (error) setError('');
            }}
            placeholder="Resolution note (required)..."
          />
          {error && <p className="text-xs text-amber-600 mt-1">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending}>
            {isPending ? 'Resolving...' : 'Resolve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
