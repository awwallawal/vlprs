import { z } from 'zod/v4';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const loginSchema = z.object({
  email: z.email('Please use a valid email format'),
  password: z.string().min(1, 'Please enter your password'),
});

export const registerSchema = z.object({
  email: z.email('Please use a valid email format'),
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['super_admin', 'dept_admin', 'mda_officer']),
  mdaId: z.string().nullable().optional(),
});
