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
import { Loader2 } from 'lucide-react';
import { useResetPassword } from '@/hooks/useUserAdmin';
import { useIsMobile } from '@/hooks/use-mobile';

interface ResetPasswordDialogProps {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResetPasswordDialog({ user, open, onOpenChange }: ResetPasswordDialogProps) {
  const resetPassword = useResetPassword();
  const isMobile = useIsMobile();

  const handleConfirm = async () => {
    if (!user) return;
    try {
      await resetPassword.mutateAsync(user.id);
      toast.success(`${UI_COPY.PASSWORD_RESET_SENT_TO} ${user.email}`);
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reset password';
      toast.error(message);
    }
  };

  const description = user
    ? UI_COPY.RESET_PASSWORD_CONFIRM.replace('{email}', user.email)
    : '';

  const buttons = (
    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
      <Button variant="ghost" onClick={() => onOpenChange(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm} disabled={resetPassword.isPending}>
        {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Reset Password
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Reset Password</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{buttons}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset Password</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>{buttons}</AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
