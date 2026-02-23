import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordFormSchema, UI_COPY } from '@vlprs/shared';
import type { Role } from '@vlprs/shared';
import { toast } from 'sonner';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, ShieldCheck } from 'lucide-react';
import { useChangePassword } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { ROLE_HOME_ROUTES } from '@/components/layout/navItems';
import { getPasswordStrength, STRENGTH_LABELS, STRENGTH_COLORS } from '@/lib/passwordStrength';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function PasswordChangeScreen() {
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const navigate = useNavigate();
  const changePassword = useChangePassword();

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

      // Update auth store to clear mustChangePassword
      if (user && accessToken) {
        setAuth(accessToken, { ...user, mustChangePassword: false });
      }

      toast.success(UI_COPY.PASSWORD_UPDATED_WELCOME);

      const homeRoute = user ? ROLE_HOME_ROUTES[user.role as Role] : '/dashboard';
      navigate(homeRoute, { replace: true });
    } catch (error: unknown) {
      if (error instanceof Error && (error as { status?: number }).status === 401) {
        form.setError('currentPassword', { message: 'Current password is incorrect' });
      } else {
        const message = error instanceof Error ? error.message : 'Failed to change password';
        toast.error(message);
      }
    }
  };

  // Password strength indicator
  const newPassword = form.watch('newPassword');
  const strength = getPasswordStrength(newPassword || '');
  const strengthLabel = STRENGTH_LABELS[strength] ?? '';
  const strengthColor = STRENGTH_COLORS[strength] ?? '';

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 rounded-full bg-teal/10 p-3">
            <ShieldCheck className="h-8 w-8 text-teal" aria-hidden="true" />
          </div>
          <CardTitle className="text-xl">Set Your Password</CardTitle>
          <CardDescription>
            You must change your temporary password before continuing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Current Temporary Password <span className="text-destructive">*</span>
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

              <Button
                type="submit"
                className="w-full"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Set Password
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
