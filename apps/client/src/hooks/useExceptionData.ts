import { useQuery } from '@tanstack/react-query';
import type { ExceptionItem } from '@vlprs/shared';
import { MOCK_EXCEPTION_QUEUE } from '@/mocks/exceptionQueue';

/**
 * Fetches exception queue items.
 * @target GET /api/exceptions
 * @wire Sprint 9 (Epic 7: Exception Management)
 */
export function useExceptionQueue() {
  return useQuery<ExceptionItem[]>({
    queryKey: ['exceptions'],
    queryFn: async () => MOCK_EXCEPTION_QUEUE,
    staleTime: 30_000,
  });
}
