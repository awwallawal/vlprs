import { useState } from 'react';
import { toast } from 'sonner';
import { UI_COPY } from '@vlprs/shared';
import type { UserListItem } from '@vlprs/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useReassignMda, useMdas } from '@/hooks/useUserAdmin';
import { useIsMobile } from '@/hooks/use-mobile';

interface ReassignMdaDialogProps {
  user: UserListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMdaName?: string;
}

export function ReassignMdaDialog({
  user,
  open,
  onOpenChange,
  currentMdaName,
}: ReassignMdaDialogProps) {
  const [newMdaId, setNewMdaId] = useState('');
  const reassignMda = useReassignMda();
  const { data: mdas } = useMdas();
  const isMobile = useIsMobile();

  const handleConfirm = async () => {
    if (!user || !newMdaId) return;
    try {
      await reassignMda.mutateAsync({ id: user.id, mdaId: newMdaId });
      const newMda = mdas?.find((m) => m.id === newMdaId);
      toast.success(
        `${user.firstName} ${user.lastName} reassigned to ${newMda?.name ?? 'new MDA'}`,
      );
      setNewMdaId('');
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reassign MDA';
      toast.error(message);
    }
  };

  const formContent = (
    <div className="space-y-4">
      {currentMdaName && (
        <div className="space-y-1">
          <Label className="text-muted-foreground">Current MDA</Label>
          <p className="text-sm font-medium">{currentMdaName}</p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="new-mda">New MDA</Label>
        <Select value={newMdaId} onValueChange={setNewMdaId}>
          <SelectTrigger id="new-mda" className="focus:ring-teal border-[#E2E8F0]">
            <SelectValue placeholder="Select new MDA" />
          </SelectTrigger>
          <SelectContent>
            {mdas
              ?.filter((m) => m.id !== user?.mdaId)
              .map((mda) => (
                <SelectItem key={mda.id} value={mda.id}>
                  {mda.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">{UI_COPY.REASSIGN_MDA_NOTE}</p>
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!newMdaId || reassignMda.isPending}>
          {reassignMda.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Reassign MDA
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Reassign MDA</SheetTitle>
            <SheetDescription>
              Change the MDA assignment for {user?.firstName} {user?.lastName}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">{formContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign MDA</DialogTitle>
          <DialogDescription>
            Change the MDA assignment for {user?.firstName} {user?.lastName}
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
