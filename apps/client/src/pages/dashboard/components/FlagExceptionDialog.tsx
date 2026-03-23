import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { useFlagException } from '@/hooks/useExceptionData';
import { useLoanSearch } from '@/hooks/useLoanData';
import { EXCEPTION_CATEGORY_PRESETS, UI_COPY } from '@vlprs/shared';
import type { ExceptionPriority } from '@vlprs/shared';

interface FlagExceptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected loan ID (from LoanDetailPage). When omitted, shows a loan search field. */
  loanId?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  over_deduction: 'Over-deduction',
  under_deduction: 'Under-deduction',
  inactive: 'Inactive',
  data_mismatch: 'Data Mismatch',
  post_retirement: 'Post-retirement',
  duplicate_staff_id: 'Duplicate Staff ID',
};

export function FlagExceptionDialog({ open, onOpenChange, loanId: preselectedLoanId }: FlagExceptionDialogProps) {
  const [priority, setPriority] = useState<ExceptionPriority>('medium');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState(preselectedLoanId ?? '');
  const [loanQuery, setLoanQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const flagMutation = useFlagException();

  // Debounce loan search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(loanQuery), 300);
    return () => clearTimeout(timer);
  }, [loanQuery]);

  // Sync preselectedLoanId when it changes (e.g., dialog opened from LoanDetailPage)
  useEffect(() => {
    if (preselectedLoanId) setSelectedLoanId(preselectedLoanId);
  }, [preselectedLoanId]);

  const { data: loanResults } = useLoanSearch(
    !preselectedLoanId && debouncedQuery.length >= 2 ? debouncedQuery : '',
  );

  const effectiveCategory = category === '__other' ? customCategory : category;
  const isValid = selectedLoanId !== '' && effectiveCategory.length >= 3 && notes.length >= 10;

  function handleSubmit() {
    if (!isValid) return;
    flagMutation.mutate(
      { loanId: selectedLoanId, priority, category: effectiveCategory, notes },
      {
        onSuccess: () => {
          toast.success('Exception flagged — added to queue');
          handleOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to flag exception');
        },
      },
    );
  }

  function resetForm() {
    setPriority('medium');
    setCategory('');
    setCustomCategory('');
    setNotes('');
    setLoanQuery('');
    setDebouncedQuery('');
    if (!preselectedLoanId) setSelectedLoanId('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Flag as Exception</DialogTitle>
          <DialogDescription>{UI_COPY.EXCEPTION_FLAG_PROMPT}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Loan selector (only when no preselected loan) */}
          {!preselectedLoanId && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-primary">Loan</label>
              {selectedLoanId ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-primary truncate flex-1">
                    {loanResults?.find((r) => r.loanId === selectedLoanId)?.staffName ?? selectedLoanId}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedLoanId(''); setLoanQuery(''); }}>
                    Change
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                    <Input
                      placeholder="Search by name, Staff ID, or loan ref..."
                      value={loanQuery}
                      onChange={(e) => setLoanQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {debouncedQuery.length >= 2 && loanResults && loanResults.length > 0 && (
                    <div className="max-h-40 overflow-y-auto border rounded space-y-0">
                      {loanResults.map((r) => (
                        <button
                          key={r.loanId}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface transition-colors border-b last:border-0"
                          onClick={() => { setSelectedLoanId(r.loanId); setLoanQuery(''); }}
                        >
                          <span className="font-medium">{r.staffName}</span>
                          {r.staffId && <span className="text-text-muted ml-2 font-mono text-xs">{r.staffId}</span>}
                          <span className="text-text-secondary ml-2 text-xs">{r.mdaName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {debouncedQuery.length >= 2 && loanResults && loanResults.length === 0 && (
                    <p className="text-xs text-text-muted">No loans found</p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Priority */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Priority</label>
            <div className="flex gap-2">
              {(['high', 'medium', 'low'] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priority === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPriority(p)}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {EXCEPTION_CATEGORY_PRESETS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c] || c.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
                <SelectItem value="__other">Other...</SelectItem>
              </SelectContent>
            </Select>
            {category === '__other' && (
              <Input
                placeholder="Enter custom category..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
              />
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Notes <span className="text-text-muted">(min 10 characters)</span>
            </label>
            <Textarea
              placeholder="Describe the issue..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-text-muted">{notes.length}/10 characters minimum</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || flagMutation.isPending}
          >
            {flagMutation.isPending ? 'Flagging...' : 'Flag Exception'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
