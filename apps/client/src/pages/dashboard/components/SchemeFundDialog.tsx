import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/apiClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SchemeFundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SchemeFundDialog({ open, onOpenChange }: SchemeFundDialogProps) {
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Reset form state when dialog opens
  useEffect(() => {
    if (open) {
      setAmount('');
      setError(null);
    }
  }, [open]);

  const mutation = useMutation<{ success: boolean; fundTotal: string }, Error & { status?: number }>({
    mutationFn: async () => {
      return apiClient<{ success: boolean; fundTotal: string }>('/dashboard/scheme-fund', {
        method: 'PUT',
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'metrics'] });
      toast.success('Scheme fund total updated successfully');
      setAmount('');
      setError(null);
      onOpenChange(false);
    },
    onError: (err) => {
      setError(err.message || 'Unable to update scheme fund total');
    },
  });

  const handleSave = () => {
    setError(null);
    const num = Number(amount);
    if (!amount || isNaN(num) || num <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Scheme Fund Total</DialogTitle>
          <DialogDescription>
            Enter the total fund amount approved for the Vehicle Loan Purchase &amp; Refund Scheme.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="scheme-fund-amount">Amount (₦)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary font-mono">₦</span>
              <Input
                id="scheme-fund-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 500000000"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                className="pl-8 font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
