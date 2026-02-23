import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordFormSchema, UI_COPY } from '@vlprs/shared';
import { toast } from 'sonner';
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useChangePassword } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPasswordStrength, STRENGTH_LABELS, STRENGTH_COLORS } from '@/lib/passwordStrength';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const changePassword = useChangePassword();
  const isMobile = useIsMobile();

  const form = useForm<FormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    mode: 'onBlur',
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: FormValues) => {
    try {
      await changePassword.mutateAsync({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      toast.success(UI_COPY.PASSWORD_UPDATED);
      form.reset();
      onOpenChange(false);
    } catch (error: unknown) {
      if (error instanceof Error && (error as { status?: number }).status === 401) {
        form.setError('currentPassword', { message: 'Current password is incorrect' });
      } else {
        const message = error instanceof Error ? error.message : 'Failed to change password';
        toast.error(message);
      }
    }
  };

  const newPassword = form.watch('newPassword');
  const strength = getPasswordStrength(newPassword || '');
  const strengthLabel = STRENGTH_LABELS[strength] ?? '';
  const strengthColor = STRENGTH_COLORS[strength] ?? '';

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Current Password <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  className="focus-visible:ring-teal border-[#E2E8F0]"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                New Password <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  className="focus-visible:ring-teal border-[#E2E8F0]"
                  {...field}
                />
              </FormControl>
              {newPassword && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColor : 'bg-muted'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{strengthLabel}</p>
                </div>
              )}
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Confirm New Password <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="password"
                  className="focus-visible:ring-teal border-[#E2E8F0]"
                  {...field}
                />
              </FormControl>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={changePassword.isPending}>
            {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Update Password
          </Button>
        </div>
      </form>
    </Form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Change Password</SheetTitle>
            <SheetDescription>
              Enter your current password and choose a new one
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
          <DialogTitle>Change Password</DialogTitle>
          <DialogDescription>
            Enter your current password and choose a new one
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
