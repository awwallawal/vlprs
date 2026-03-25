import { z } from 'zod';
import { EVENT_FLAG_VALUES } from './submissionSchemas.js';

export const addAnnotationSchema = z.object({
  content: z.string().min(1, 'Annotation content is required').max(2000, 'Annotation content must be 2000 characters or fewer'),
});

export const correctEventFlagSchema = z.object({
  originalEventFlag: z.enum(EVENT_FLAG_VALUES),
  newEventFlag: z.enum(EVENT_FLAG_VALUES),
  correctionReason: z.string().min(10, 'Correction reason must be at least 10 characters').max(1000, 'Correction reason must be 1000 characters or fewer'),
  submissionRowId: z.string().uuid().optional(),
}).refine((data) => data.originalEventFlag !== data.newEventFlag, {
  message: 'New event flag must differ from the original',
  path: ['newEventFlag'],
});
