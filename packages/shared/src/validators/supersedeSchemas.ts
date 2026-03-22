import { z } from 'zod';

export const supersedeSchema = z.object({
  replacementUploadId: z.string().uuid(),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

export type SupersedeBody = z.infer<typeof supersedeSchema>;
