import { describe, it, expect } from 'vitest';
import { emailSchema } from './index';

describe('emailSchema', () => {
  it('validates a correct email', () => {
    const result = emailSchema.safeParse('user@vlprs.gov.ng');
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
  });
});
