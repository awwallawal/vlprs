import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/router';

export default function App() {
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

  return (
    <QueryClientProvider client={queryClient}>
      {recaptchaKey ? (
        <GoogleReCaptchaProvider reCaptchaKey={recaptchaKey}>
          <RouterProvider router={router} />
        </GoogleReCaptchaProvider>
      ) : (
        <RouterProvider router={router} />
      )}
      <Toaster position="bottom-right" />
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
