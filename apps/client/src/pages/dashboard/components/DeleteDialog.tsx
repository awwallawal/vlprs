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
import { useDeleteUser } from '@/hooks/useUserAdmin';
import { useIsMobile } from '@/hooks/use-mobile';

interface DeleteDialogProps {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteDialog({ user, open, onOpenChange }: DeleteDialogProps) {
  const [confirmEmail, setConfirmEmail] = useState('');
  const deleteUser = useDeleteUser();
  const isMobile = useIsMobile();

  const emailMatches = user ? confirmEmail === user.email : false;

  const handleConfirm = async () => {
    if (!user || !emailMatches) return;
    try {
      await deleteUser.mutateAsync({ id: user.id, confirmEmail });
      toast.success(`${user.firstName} ${user.lastName}'s account has been permanently removed`);
      setConfirmEmail('');
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete user';
      toast.error(message);
    }
  };

  const description = user
    ? UI_COPY.DELETE_CONFIRM.replace('{name}', `${user.firstName} ${user.lastName}`)
    : '';

  const formContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="delete-confirm-email">{UI_COPY.DELETE_TYPE_EMAIL}</Label>
        <Input
          id="delete-confirm-email"
          placeholder={user?.email ?? ''}
          value={confirmEmail}
          onChange={(e) => setConfirmEmail(e.target.value)}
          className="focus-visible:ring-teal border-[#E2E8F0]"
        />
      </div>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleConfirm}
          disabled={!emailMatches || deleteUser.isPending}
        >
          {deleteUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete Permanently
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Delete Account</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="mt-4">{formContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {formContent}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
