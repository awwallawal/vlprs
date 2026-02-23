import { z } from 'zod/v4';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve .env from project root (../../.. from apps/server/src/config/)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  JWT_SECRET: z.string().default('change-me-in-production'),
  JWT_EXPIRY: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRY: z.string().default('7d'),
  SUPER_ADMIN_EMAIL: z.string().optional(),
  SUPER_ADMIN_PASSWORD: z.string().optional(),
  SUPER_ADMIN_FIRST_NAME: z.string().default('Super'),
  SUPER_ADMIN_LAST_NAME: z.string().default('Admin'),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().default(15),
  CSRF_SECRET: z.string().min(32).default('change-csrf-secret-in-production'),
  INACTIVITY_TIMEOUT_MINUTES: z.coerce.number().default(30),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@vlprs.oyo.gov.ng'),
  APP_URL: z.string().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);

if (env.NODE_ENV === 'production' && env.CSRF_SECRET === 'change-csrf-secret-in-production') {
  throw new Error('CSRF_SECRET must be set to a unique value in production');
}
if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'change-me-in-production') {
  throw new Error('JWT_SECRET must be set to a unique value in production');
}
