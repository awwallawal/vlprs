import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface PromoteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (priority: 'high' | 'medium' | 'low') => void;
  isPending?: boolean;
}

export function PromoteDialog({ open, onClose, onConfirm, isPending }: PromoteDialogProps) {
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote to Exception</DialogTitle>
          <DialogDescription>
            This will create a formal exception record for operational follow-up.
          </DialogDescription>
        </DialogHeader>
        <div>
          <label className="text-sm font-medium text-text-primary block mb-2">Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as 'high' | 'medium' | 'low')}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(priority)} disabled={isPending}>
            {isPending ? 'Promoting...' : 'Promote to Exception'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
