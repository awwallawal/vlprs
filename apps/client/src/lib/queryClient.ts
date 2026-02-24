import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error) => {
        // Don't retry auth errors — they need a re-login, not a retry
        const status = (error as { status?: number }).status;
        if (status === 401 || status === 403) return false;
        return failureCount < 3;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
  },
});
