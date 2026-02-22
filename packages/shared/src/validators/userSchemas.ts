import { z } from 'zod/v4';

export const createUserSchema = z.object({
  email: z.email('Please use a valid email format'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['dept_admin', 'mda_officer']),
  mdaId: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z.object({
  mdaId: z.string().uuid(),
});

export const deactivateUserSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const deleteUserSchema = z.object({
  confirmEmail: z.email('Please provide a valid email'),
});
