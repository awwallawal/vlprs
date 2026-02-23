import { useState } from 'react';
import { toast } from 'sonner';
import { UI_COPY } from '@vlprs/shared';
import type { UserListItem } from '@vlprs/shared';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useDeactivateUser } from '@/hooks/useUserAdmin';
import { useIsMobile } from '@/hooks/use-mobile';

interface DeactivateDialogProps {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeactivateDialog({ user, open, onOpenChange }: DeactivateDialogProps) {
  const [reason, setReason] = useState('');
  const deactivate = useDeactivateUser();
  const isMobile = useIsMobile();

  const handleConfirm = async () => {
    if (!user) return;
    try {
      await deactivate.mutateAsync({ id: user.id, reason: reason || undefined });
      toast.success(`${user.firstName} ${user.lastName}'s account has been deactivated`);
      setReason('');
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to deactivate user';
      toast.error(message);
    }
  };

  const description = user
    ? UI_COPY.DEACTIVATE_CONFIRM.replace('{name}', `${user.firstName} ${user.lastName}`)
    : '';

  const formFields = (
    <div className="space-y-4">
      {user && (
        <p className="text-sm font-medium">{user.email}</p>
      )}
      <div className="space-y-2">
        <Label htmlFor={isMobile ? 'deactivate-reason-mobile' : 'deactivate-reason'}>Reason (optional)</Label>
        <Input
          id={isMobile ? 'deactivate-reason-mobile' : 'deactivate-reason'}
          placeholder="Enter reason for deactivation"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="focus-visible:ring-teal border-[#E2E8F0]"
        />
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={deactivate.isPending}>
          {deactivate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Deactivate
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Deactivate Account</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{formFields}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Deactivate Account</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2">
          {formFields}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
