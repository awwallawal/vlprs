import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { loginSchema, VOCABULARY, ROLES } from '@vlprs/shared';
import type { LoginRequest, LoginResponse } from '@vlprs/shared';
import { apiClient } from '@/lib/apiClient';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ROLE_ROUTES: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: '/dashboard',
  [ROLES.DEPT_ADMIN]: '/dashboard/operations',
  [ROLES.MDA_OFFICER]: '/dashboard/submissions',
};

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const { executeRecaptcha } = useGoogleReCaptcha?.() ?? {};
  const [serverError, setServerError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-crimson-25 to-white px-4 py-12">
      {/* Decorative blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-crimson-50 rounded-full blur-3xl opacity-60 -translate-y-1/2" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-crimson-50 rounded-full blur-3xl opacity-40 translate-y-1/2" />

      <div className="relative w-full max-w-md">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-crimson transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to homepage
        </Link>

        {/* Login card */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
          {/* Crimson top bar */}
          <div className="h-2 bg-gradient-to-r from-crimson to-crimson-dark" />

          {/* Card header */}
          <div className="pt-8 pb-4 px-8 text-center">
            <img
              src="/oyo-crest.png"
              alt="Oyo State Government Crest"
              className="h-16 w-16 mx-auto mb-4"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <h1 className="text-2xl font-brand font-bold text-slate-900">
              Vehicle Loan Scheme
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Staff Portal Login
            </p>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@oyo.gov.ng"
                  className="text-base h-11 focus-visible:ring-2 focus-visible:ring-teal"
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
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="text-base h-11 pr-11 focus-visible:ring-2 focus-visible:ring-teal"
                    {...register('password')}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    aria-invalid={!!errors.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
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
                <div className="rounded-lg bg-crimson-50 border border-crimson-300 px-4 py-3">
                  <p
                    className="text-sm text-crimson-dark text-center"
                    role="alert"
                    aria-live="polite"
                  >
                    {serverError}
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base min-h-[44px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            <p className="text-xs text-slate-400 text-center mt-6">
              Access is restricted to authorised personnel only.
              Contact the Car Loan Department for account enquiries.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
