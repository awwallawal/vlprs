import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { loginSchema, VOCABULARY, ROLES } from '@vlprs/shared';
import type { LoginRequest, LoginResponse } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

const ROLE_ROUTES: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: '/dashboard',
  [ROLES.DEPT_ADMIN]: '/operations',
  [ROLES.MDA_OFFICER]: '/submissions',
};

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { executeRecaptcha } = useGoogleReCaptcha?.() ?? {};
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: LoginRequest) => {
    setServerError('');

    let recaptchaToken = '';
    if (executeRecaptcha) {
      try {
        recaptchaToken = await executeRecaptcha('login');
      } catch {
        // reCAPTCHA failed — proceed without token in dev
      }
    }

    try {
      const result = await apiClient<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ ...data, recaptchaToken }),
      });

      setAuth(result.accessToken, result.user);
      const route = ROLE_ROUTES[result.user.role] || '/dashboard';
      navigate(route, { replace: true });
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === 'ACCOUNT_LOCKED') {
        setServerError(VOCABULARY.ACCOUNT_TEMPORARILY_LOCKED);
      } else if (error.code === 'ACCOUNT_INACTIVE') {
        setServerError(VOCABULARY.ACCOUNT_INACTIVE);
      } else {
        setServerError(VOCABULARY.LOGIN_UNSUCCESSFUL);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-[640px]">
        <CardHeader className="items-center space-y-4 pb-2">
          <img
            src="/oyo-crest.svg"
            alt="Oyo State Government Crest"
            className="h-16 w-16"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-text-primary">VLPRS</h1>
            <p className="text-sm text-text-secondary">
              Vehicle Loan Processing & Receivables System
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="text-base focus-visible:ring-2 focus-visible:ring-teal"
                {...register('email')}
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p
                  id="email-error"
                  className="text-sm text-gold-dark"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                className="text-base focus-visible:ring-2 focus-visible:ring-teal"
                {...register('password')}
                aria-describedby={errors.password ? 'password-error' : undefined}
                aria-invalid={!!errors.password}
              />
              {errors.password && (
                <p
                  id="password-error"
                  className="text-sm text-gold-dark"
                  role="alert"
                  aria-live="polite"
                >
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <p
                className="text-sm text-gold-dark text-center"
                role="alert"
                aria-live="polite"
              >
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base min-h-[44px]"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
