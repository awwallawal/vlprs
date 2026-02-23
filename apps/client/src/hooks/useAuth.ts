import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';

/**
 * Self-service password change for authenticated users.
 * @target POST /api/auth/change-password
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiClient<void>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}
