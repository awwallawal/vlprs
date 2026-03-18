import { z } from 'zod';
import {
  EMPLOYMENT_EVENT_TYPES,
  REFERENCE_REQUIRED_TYPES,
  FUTURE_DATE_ALLOWED_TYPES,
} from '../types/employmentEvent';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Schema for creating an employment event.
 * 5 core fields + 1 conditional (newRetirementDate for Service Extension).
 * Uses .superRefine() for:
 *   - Conditional Reference Number requirement
 *   - Event-type-specific Effective Date validation
 *   - Conditional newRetirementDate required for Service Extension
 */
export const createEmploymentEventSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
  eventType: z.enum(EMPLOYMENT_EVENT_TYPES),
  effectiveDate: z.string().regex(ISO_DATE_REGEX, 'Effective Date must be in YYYY-MM-DD format'),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  newRetirementDate: z.string().regex(ISO_DATE_REGEX, 'New Retirement Date must be in YYYY-MM-DD format').optional(),
  confirmDuplicate: z.boolean().optional(),
}).superRefine((data, ctx) => {
  // Reference Number required for specific event types
  if (
    REFERENCE_REQUIRED_TYPES.includes(data.eventType) &&
    (!data.referenceNumber || data.referenceNumber.trim() === '')
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reference Number is required for this event type',
      path: ['referenceNumber'],
    });
  }

  // Effective Date — event-type-specific future date validation
  const effectiveDate = new Date(data.effectiveDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (!isNaN(effectiveDate.getTime()) && effectiveDate > now) {
    if (!FUTURE_DATE_ALLOWED_TYPES.includes(data.eventType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Future dates are not permitted for this event type',
        path: ['effectiveDate'],
      });
    } else {
      // Cap at 12 months in the future
      const maxFuture = new Date(now);
      maxFuture.setMonth(maxFuture.getMonth() + 12);
      if (effectiveDate > maxFuture) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Effective Date cannot be more than 12 months in the future',
          path: ['effectiveDate'],
        });
      }
    }
  }

  // New Retirement Date — required for Service Extension, must be future
  if (data.eventType === 'SERVICE_EXTENSION') {
    if (!data.newRetirementDate || data.newRetirementDate.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'New Retirement Date is required for Service Extension events',
        path: ['newRetirementDate'],
      });
    } else {
      const newRetDate = new Date(data.newRetirementDate);
      if (!isNaN(newRetDate.getTime()) && newRetDate <= now) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'New Retirement Date must be a future date',
          path: ['newRetirementDate'],
        });
      }
    }
  }
});

export const staffLookupQuerySchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
});

export const transferSearchQuerySchema = z.object({
  query: z.string().min(2, 'Search term must be at least 2 characters'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(20),
});

export const confirmTransferSchema = z.object({
  transferId: z.string().uuid('Transfer ID must be a valid UUID'),
  side: z.enum(['outgoing', 'incoming']),
});

export const claimTransferSchema = z.object({
  staffId: z.string().min(1, 'Staff ID is required'),
});

export const employmentEventListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  mdaId: z.string().uuid().optional(),
});
