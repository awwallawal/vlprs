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

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Must contain at least one digit'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
