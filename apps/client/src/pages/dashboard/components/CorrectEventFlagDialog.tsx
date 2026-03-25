import { useState } from 'react';
import { toast } from 'sonner';
import { useCorrectEventFlag } from '@/hooks/useAnnotations';
import { EVENT_FLAG_VALUES, UI_COPY } from '@vlprs/shared';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const flagLabels = UI_COPY.EVENT_FLAG_LABELS as Record<string, string>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loanId: string;
  currentFlag: string;
  onEventSuggestion?: (eventType: string) => void;
}

export function CorrectEventFlagDialog({ open, onOpenChange, loanId, currentFlag, onEventSuggestion }: Props) {
  const mutation = useCorrectEventFlag(loanId);
  const [newFlag, setNewFlag] = useState('');
  const [reason, setReason] = useState('');

  function resetForm() {
    setNewFlag('');
    setReason('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  const handleSubmit = () => {
    if (!newFlag || newFlag === currentFlag) return;
    if (reason.length < 10) {
      toast.error('Correction reason must be at least 10 characters');
      return;
    }

    mutation.mutate(
      {
        originalEventFlag: currentFlag,
        newEventFlag: newFlag,
        correctionReason: reason,
      },
      {
        onSuccess: (data) => {
          toast.success(UI_COPY.EVENT_FLAG_CORRECTED);
          handleOpenChange(false);
          if (data.suggestCreateEvent && data.suggestedEventType && onEventSuggestion) {
            onEventSuggestion(data.suggestedEventType);
          }
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Correct Event Flag</DialogTitle>
          <DialogDescription>{UI_COPY.CORRECT_EVENT_FLAG_PROMPT}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              {UI_COPY.EVENT_FLAG_ORIGINAL}
            </label>
            <div className="px-3 py-2 bg-gray-50 rounded border text-sm text-text-primary">
              {flagLabels[currentFlag] ?? currentFlag}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              {UI_COPY.EVENT_FLAG_NEW}
            </label>
            <Select value={newFlag} onValueChange={setNewFlag}>
              <SelectTrigger>
                <SelectValue placeholder="Select new flag..." />
              </SelectTrigger>
              <SelectContent>
                {EVENT_FLAG_VALUES.filter((f) => f !== currentFlag).map((f) => (
                  <SelectItem key={f} value={f}>{flagLabels[f] ?? f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Correction Reason
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this correction is needed (min 10 characters)"
              rows={3}
              maxLength={1000}
            />
            <span className="text-xs text-text-muted">{reason.length}/1000</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!newFlag || newFlag === currentFlag || reason.length < 10 || mutation.isPending}
          >
            {mutation.isPending ? 'Saving...' : 'Save Correction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
