import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import type { User, UserListItem, PaginatedResponse } from '@vlprs/shared';
import { getMockUsersResponse, MOCK_MDAS } from '@/mocks/users';

// ─── Queries ───────────────────────────────────────────────

export interface UserFilters {
  role?: string;
  mdaId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * Fetches paginated user list with filters.
 * @target GET /api/users
 * @wire Replace queryFn with apiClient call when backend is wired
 */
export function useUsers(filters?: UserFilters) {
  return useQuery<PaginatedResponse<UserListItem>>({
    queryKey: ['users', filters],
    queryFn: async () => getMockUsersResponse(filters),
    // Wire: queryFn: () => {
    //   const params = new URLSearchParams();
    //   if (filters) {
    //     Object.entries(filters).forEach(([key, value]) => {
    //       if (value !== undefined && value !== '') params.set(key, String(value));
    //     });
    //   }
    //   const qs = params.toString();
    //   return apiClient<PaginatedResponse<UserListItem>>(`/users${qs ? `?${qs}` : ''}`);
    // },
  });
}

export interface MdaOption {
  id: string;
  name: string;
  code: string;
}

/**
 * Fetches available MDAs for assignment dropdowns.
 * @target GET /api/mdas
 * @wire Replace queryFn with apiClient call when backend is wired
 */
export function useMdas() {
  return useQuery<MdaOption[]>({
    queryKey: ['mdas'],
    queryFn: async () => MOCK_MDAS,
    staleTime: 5 * 60_000,
  });
}

// ─── Mutations ─────────────────────────────────────────────

/**
 * Creates a new user and sends invitation email.
 * @target POST /api/users
 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      mdaId?: string | null;
    }) => apiClient<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/**
 * Deactivates a user account.
 * @target POST /api/users/:id/deactivate
 */
export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiClient<User>(`/users/${id}/deactivate`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/**
 * Reactivates a deactivated user account.
 * @target POST /api/users/:id/reactivate
 */
export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<User>(`/users/${id}/reactivate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/**
 * Soft-deletes a user account (requires email confirmation).
 * @target DELETE /api/users/:id
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmEmail }: { id: string; confirmEmail: string }) =>
      apiClient<void>(`/users/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmEmail }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/**
 * Reassigns an MDA officer to a different MDA.
 * @target PATCH /api/users/:id
 */
export function useReassignMda() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mdaId }: { id: string; mdaId: string }) =>
      apiClient<User>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ mdaId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

/**
 * Sends a password reset email to a user.
 * @target POST /api/users/:id/reset-password
 */
export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
