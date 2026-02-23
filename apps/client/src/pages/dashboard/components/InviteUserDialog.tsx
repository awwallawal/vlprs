import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createUserSchema, getManageableRoles, ROLES, UI_COPY } from '@vlprs/shared';
import type { Role } from '@vlprs/shared';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useCreateUser, useMdas } from '@/hooks/useUserAdmin';
import { useAuthStore } from '@/stores/authStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { ROLE_LABELS } from '@/components/layout/navItems';

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormValues {
  email: string;
  firstName: string;
  lastName: string;
  role: 'dept_admin' | 'mda_officer';
  mdaId?: string | null;
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const user = useAuthStore((s) => s.user);
  const isMobile = useIsMobile();
  const createUser = useCreateUser();
  const { data: mdas } = useMdas();
  const manageableRoles = user ? getManageableRoles(user.role as Role) : [];

  const form = useForm<FormValues, unknown, FormValues>({
    resolver: zodResolver(createUserSchema),
    mode: 'onBlur',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      role: manageableRoles.length === 1 ? (manageableRoles[0] as 'dept_admin' | 'mda_officer') : undefined,
      mdaId: null,
    },
  });

  const selectedRole = form.watch('role');

  const onSubmit = async (data: FormValues) => {
    try {
      await createUser.mutateAsync(data);
      toast.success(`${UI_COPY.INVITATION_SENT_TO} ${data.email}`);
      form.reset();
      onOpenChange(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      toast.error(message);
    }
  };

  const formContent = (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  First Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter first name"
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
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Last Name <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter last name"
                    className="focus-visible:ring-teal border-[#E2E8F0]"
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[#D4A017]" />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Email <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="user@vlprs.oyo.gov.ng"
                  className="focus-visible:ring-teal border-[#E2E8F0]"
                  {...field}
                />
              </FormControl>
              <FormDescription className="text-[#64748B]">
                A welcome email with temporary login credentials will be sent to this address
              </FormDescription>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Role <span className="text-destructive">*</span>
              </FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
                onOpenChange={() => field.onBlur()}
              >
                <FormControl>
                  <SelectTrigger className="focus:ring-teal border-[#E2E8F0]">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {manageableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="text-[#D4A017]" />
            </FormItem>
          )}
        />

        {selectedRole === ROLES.MDA_OFFICER && (
          <FormField
            control={form.control}
            name="mdaId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  MDA <span className="text-destructive">*</span>
                </FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? undefined}
                  onOpenChange={() => field.onBlur()}
                >
                  <FormControl>
                    <SelectTrigger className="focus:ring-teal border-[#E2E8F0]">
                      <SelectValue placeholder="Select MDA" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {mdas?.map((mda) => (
                      <SelectItem key={mda.id} value={mda.id}>
                        {mda.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage className="text-[#D4A017]" />
              </FormItem>
            )}
          />
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={createUser.isPending}
            className="w-full sm:w-auto"
          >
            {createUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Invitation
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
            <SheetTitle>{UI_COPY.INVITE_USER}</SheetTitle>
            <SheetDescription>
              Create a new user account and send an invitation email
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
          <DialogTitle>{UI_COPY.INVITE_USER}</DialogTitle>
          <DialogDescription>
            Create a new user account and send an invitation email
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
