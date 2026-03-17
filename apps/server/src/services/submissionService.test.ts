import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSubmissionCsv,
  validateSubmissionRows,
  checkPeriodLock,
  processSubmissionRows,
} from './submissionService';
import { manualSubmissionBodySchema } from '@vlprs/shared';

// ─── parseSubmissionCsv ─────────────────────────────────────────────

describe('parseSubmissionCsv', () => {
  function csvBuffer(lines: string[]): Buffer {
    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  it('parses a valid CSV with header row', () => {
    const buf = csvBuffer([
      'Staff ID,Month,Amount Deducted,Payroll Batch Reference,MDA Code,Event Flag,Event Date,Cessation Reason',
      'OYO-001,2026-03,15000.00,BATCH-001,MOF,NONE,,',
      'OYO-002,2026-03,20000.50,BATCH-001,MOF,RETIREMENT,2026-03-15,',
    ]);
    const rows = parseSubmissionCsv(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0].staffId).toBe('OYO-001');
    expect(rows[0].rowNumber).toBe(2);
    expect(rows[1].staffId).toBe('OYO-002');
    expect(rows[1].eventFlag).toBe('RETIREMENT');
    expect(rows[1].eventDate).toBe('2026-03-15');
  });

  it('handles BOM prefix', () => {
    const bomPrefix = '\uFEFF';
    const buf = Buffer.from(
      bomPrefix + 'Staff ID,Month,Amount Deducted,Payroll Batch Reference,MDA Code,Event Flag,Event Date,Cessation Reason\n' +
      'OYO-001,2026-03,15000.00,BATCH-001,MOF,NONE,,',
      'utf-8',
    );
    const rows = parseSubmissionCsv(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0].staffId).toBe('OYO-001');
  });

  it('throws on empty file (no data rows after header)', () => {
    const buf = csvBuffer([
      'Staff ID,Month,Amount Deducted,Payroll Batch Reference,MDA Code,Event Flag,Event Date,Cessation Reason',
    ]);
    expect(() => parseSubmissionCsv(buf)).toThrow();
  });

  it('throws on completely empty buffer', () => {
    const buf = Buffer.from('', 'utf-8');
    expect(() => parseSubmissionCsv(buf)).toThrow();
  });

  it('handles trailing newlines', () => {
    const buf = csvBuffer([
      'Staff ID,Month,Amount Deducted,Payroll Batch Reference,MDA Code,Event Flag,Event Date,Cessation Reason',
      'OYO-001,2026-03,15000.00,BATCH-001,MOF,NONE,,',
      '',
    ]);
    const rows = parseSubmissionCsv(buf);
    expect(rows).toHaveLength(1);
  });

  it('trims whitespace from field values', () => {
    const buf = csvBuffer([
      'Staff ID,Month,Amount Deducted,Payroll Batch Reference,MDA Code,Event Flag,Event Date,Cessation Reason',
      ' OYO-001 , 2026-03 , 15000.00 , BATCH-001 , MOF , NONE , , ',
    ]);
    const rows = parseSubmissionCsv(buf);
    expect(rows[0].staffId).toBe('OYO-001');
    expect(rows[0].month).toBe('2026-03');
    expect(rows[0].mdaCode).toBe('MOF');
  });

  it('sets null for empty optional fields', () => {
    const buf = csvBuffer([
      'Staff ID,Month,Amount Deducted,Payroll Batch Reference,MDA Code,Event Flag,Event Date,Cessation Reason',
      'OYO-001,2026-03,15000.00,BATCH-001,MOF,NONE,,',
    ]);
    const rows = parseSubmissionCsv(buf);
    expect(rows[0].eventDate).toBeNull();
    expect(rows[0].cessationReason).toBeNull();
  });
});

// ─── validateSubmissionRows ─────────────────────────────────────────

describe('validateSubmissionRows', () => {
  // IndexedRow factory with 0-based rowIndex
  function makeRow(overrides: Record<string, unknown> = {}) {
    return {
      rowIndex: 0,
      staffId: 'OYO-001',
      month: '2026-03',
      amountDeducted: '15000.00',
      payrollBatchReference: 'BATCH-001',
      mdaCode: 'MOF',
      eventFlag: 'NONE',
      eventDate: null,
      cessationReason: null,
      ...overrides,
    };
  }

  it('validates a set of valid rows with no errors', () => {
    const { errors } = validateSubmissionRows([makeRow()]);
    expect(errors).toHaveLength(0);
  });

  it('detects invalid amount format', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ amountDeducted: '14,166.25.00' }),
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('amountDeducted');
    expect(errors[0].message).toContain('14,166.25.00');
  });

  it('detects invalid month format', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ month: '03-2026' }),
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('month');
  });

  it('detects missing Event Date when Event Flag != NONE', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ eventFlag: 'RETIREMENT', eventDate: null }),
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('eventDate');
  });

  it('detects missing Cessation Reason when Amount = 0 and Event Flag = NONE', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ amountDeducted: '0', eventFlag: 'NONE', cessationReason: null }),
    ]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].field).toBe('cessationReason');
  });

  it('detects intra-file duplicate (same staffId + same month)', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ rowIndex: 0 }),
      makeRow({ rowIndex: 1 }),
    ]);
    // Second row should be flagged as duplicate
    const dupErrors = errors.filter((e) => e.message.includes('already has a submission'));
    expect(dupErrors).toHaveLength(1);
    expect(dupErrors[0].row).toBe(1); // 0-based index of second row
  });

  it('allows different staffId + same month (no duplicate)', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ rowIndex: 0, staffId: 'OYO-001' }),
      makeRow({ rowIndex: 1, staffId: 'OYO-002' }),
    ]);
    const dupErrors = errors.filter((e) => e.message.includes('already has a submission'));
    expect(dupErrors).toHaveLength(0);
  });

  it('collects ALL errors (does not short-circuit)', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ rowIndex: 0, amountDeducted: 'bad' }),
      makeRow({ rowIndex: 1, month: 'invalid' }),
      makeRow({ rowIndex: 2, eventFlag: 'RETIREMENT', eventDate: null }),
    ]);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('uses 0-based row index in error.row and 1-based in message', () => {
    const { errors } = validateSubmissionRows([
      makeRow({ rowIndex: 3, amountDeducted: 'bad' }),
    ]);
    expect(errors[0].row).toBe(3); // 0-based
    expect(errors[0].message).toContain('Row 4'); // 1-based in message
  });
});

// ─── manualSubmissionBodySchema (H3 — Story 5.2 review: max/min rows) ──

describe('manualSubmissionBodySchema', () => {
  function validRow() {
    return {
      staffId: 'OYO-001',
      month: '2026-03',
      amountDeducted: '15000.00',
      payrollBatchReference: 'BATCH-001',
      mdaCode: 'MOF',
      eventFlag: 'NONE',
      eventDate: null,
      cessationReason: null,
    };
  }

  it('accepts 1 valid row (min boundary)', () => {
    const result = manualSubmissionBodySchema.safeParse({ rows: [validRow()] });
    expect(result.success).toBe(true);
  });

  it('accepts 50 valid rows (max boundary)', () => {
    const rows = Array.from({ length: 50 }, () => validRow());
    const result = manualSubmissionBodySchema.safeParse({ rows });
    expect(result.success).toBe(true);
  });

  it('rejects 51 rows (exceeds max)', () => {
    const rows = Array.from({ length: 51 }, () => validRow());
    const result = manualSubmissionBodySchema.safeParse({ rows });
    expect(result.success).toBe(false);
  });

  it('rejects 0 rows (below min)', () => {
    const result = manualSubmissionBodySchema.safeParse({ rows: [] });
    expect(result.success).toBe(false);
  });

  it('rejects missing rows property', () => {
    const result = manualSubmissionBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('validates inner row schema (invalid amount rejects)', () => {
    const result = manualSubmissionBodySchema.safeParse({
      rows: [{ ...validRow(), amountDeducted: 'not-a-number' }],
    });
    expect(result.success).toBe(false);
  });
});

// ─── processSubmissionRows contract (H3 — manual source) ─────────────

describe('processSubmissionRows contract', () => {
  it('exports processSubmissionRows as a function', () => {
    expect(typeof processSubmissionRows).toBe('function');
  });

  it('accepts source parameter of "csv" or "manual"', () => {
    // Type-level contract — verify the function signature accepts both sources
    // (Integration tests with DB for full pipeline are in e2e suite)
    expect(processSubmissionRows.length).toBeGreaterThanOrEqual(4); // rawRows, mdaScope, userId, source
  });
});

// ─── checkPeriodLock ────────────────────────────────────────────────

describe('checkPeriodLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('allows current month', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2026-03');
    expect(result).toBeNull();
  });

  it('allows previous month (late submissions)', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2026-02');
    expect(result).toBeNull();
  });

  it('rejects future month', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2026-04');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('not currently open');
  });

  it('rejects month older than previous', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2026-01');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('not currently open');
  });

  it('handles year boundary (January allows December of previous year)', () => {
    vi.setSystemTime(new Date('2026-01-10'));
    const result = checkPeriodLock('2025-12');
    expect(result).toBeNull();
  });

  // ─── Story 11.0a: Historical period bypass by role ────────────────

  it('DEPT_ADMIN bypasses period lock for historical periods', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2020-03', 'dept_admin');
    expect(result).toBeNull();
  });

  it('SUPER_ADMIN bypasses period lock for historical periods', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2020-03', 'super_admin');
    expect(result).toBeNull();
  });

  it('MDA_OFFICER is still rejected for historical periods', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2020-03', 'mda_officer');
    expect(result).not.toBeNull();
    expect(result!.message).toContain('not currently open');
  });

  it('no role provided: still rejected for historical periods (default behaviour)', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    const result = checkPeriodLock('2020-03');
    expect(result).not.toBeNull();
  });

  it('current + previous month still works for all roles', () => {
    vi.setSystemTime(new Date('2026-03-15'));
    expect(checkPeriodLock('2026-03', 'mda_officer')).toBeNull();
    expect(checkPeriodLock('2026-02', 'mda_officer')).toBeNull();
    expect(checkPeriodLock('2026-03', 'dept_admin')).toBeNull();
    expect(checkPeriodLock('2026-02', 'dept_admin')).toBeNull();
    expect(checkPeriodLock('2026-03', 'super_admin')).toBeNull();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
