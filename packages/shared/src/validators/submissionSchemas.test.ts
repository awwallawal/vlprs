import { describe, it, expect } from 'vitest';
import { submissionRowSchema, submissionListQuerySchema } from './submissionSchemas';

function validRow(overrides: Record<string, unknown> = {}) {
  return {
    staffId: 'OYO-001',
    month: '2026-03',
    amountDeducted: '15000.00',
    payrollBatchReference: 'BATCH-001',
    mdaCode: 'MOF',
    eventFlag: 'NONE' as const,
    eventDate: null,
    cessationReason: null,
    ...overrides,
  };
}

describe('submissionRowSchema', () => {
  it('accepts a valid row with Event Flag = NONE', () => {
    const result = submissionRowSchema.safeParse(validRow());
    expect(result.success).toBe(true);
  });

  it('accepts a valid row with Event Flag ≠ NONE and Event Date provided', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'RETIREMENT', eventDate: '2026-03-15' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects when Event Flag ≠ NONE and Event Date is blank', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'RETIREMENT', eventDate: null }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain('Event Date is required when Event Flag is not NONE');
    }
  });

  it('rejects when Event Flag ≠ NONE and Event Date is empty string', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'DEATH', eventDate: '' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects when Amount = 0, Event Flag = NONE, and Cessation Reason is blank', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ amountDeducted: '0', eventFlag: 'NONE', cessationReason: null }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain(
        'Cessation Reason is required when Amount is 0 and Event Flag is NONE',
      );
    }
  });

  it('accepts when Amount = 0, Event Flag = NONE, and Cessation Reason is provided', () => {
    const result = submissionRowSchema.safeParse(
      validRow({
        amountDeducted: '0',
        eventFlag: 'NONE',
        cessationReason: 'Staff on leave without pay',
      }),
    );
    expect(result.success).toBe(true);
  });

  it('does NOT require Cessation Reason when Amount = 0 but Event Flag ≠ NONE', () => {
    const result = submissionRowSchema.safeParse(
      validRow({
        amountDeducted: '0',
        eventFlag: 'RETIREMENT',
        eventDate: '2026-03-01',
        cessationReason: null,
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects invalid month format', () => {
    const result = submissionRowSchema.safeParse(validRow({ month: '03-2026' }));
    expect(result.success).toBe(false);
  });

  it('rejects month with invalid month number', () => {
    const result = submissionRowSchema.safeParse(validRow({ month: '2026-13' }));
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric amount', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ amountDeducted: '14,166.25.00' }),
    );
    expect(result.success).toBe(false);
  });

  it('accepts amount with commas (forgiving parse)', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ amountDeducted: '14,166.25' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects negative amount', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ amountDeducted: '-500' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects empty Staff ID', () => {
    const result = submissionRowSchema.safeParse(validRow({ staffId: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects empty Payroll Batch Reference', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ payrollBatchReference: '' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects invalid Event Flag value', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'INVALID' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects invalid Event Date format when Event Flag ≠ NONE', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'RETIREMENT', eventDate: 'not-a-date' }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const msgs = result.error.issues.map((i) => i.message);
      expect(msgs).toContain('Event Date must be a valid date (YYYY-MM-DD)');
    }
  });

  it('accepts valid Event Date format when Event Flag ≠ NONE', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'RETIREMENT', eventDate: '2026-03-15' }),
    );
    expect(result.success).toBe(true);
  });

  // Story 11.2b — extended event flag values
  it('accepts new event flag DISMISSAL with Event Date (Story 11.2b)', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'DISMISSAL', eventDate: '2026-03-15' }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts new event flag ABSCONDED with Event Date (Story 11.2b)', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'ABSCONDED', eventDate: '2026-03-10' }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts new event flag SERVICE_EXTENSION with Event Date (Story 11.2b)', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'SERVICE_EXTENSION', eventDate: '2026-04-01' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects deprecated TERMINATION event flag (Story 11.2b)', () => {
    const result = submissionRowSchema.safeParse(
      validRow({ eventFlag: 'TERMINATION', eventDate: '2026-03-15' }),
    );
    expect(result.success).toBe(false);
  });
});

describe('submissionListQuerySchema', () => {
  it('applies defaults for page and pageSize', () => {
    const result = submissionListQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.pageSize).toBe(20);
    }
  });

  it('accepts valid period filter', () => {
    const result = submissionListQuerySchema.safeParse({ period: '2026-03' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid period format', () => {
    const result = submissionListQuerySchema.safeParse({ period: '2026-13' });
    expect(result.success).toBe(false);
  });

  it('rejects pageSize > 100', () => {
    const result = submissionListQuerySchema.safeParse({ pageSize: 200 });
    expect(result.success).toBe(false);
  });
});
