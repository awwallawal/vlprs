import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { mdas, users, loans } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import * as ledgerService from './ledgerService';

let testMdaId: string;
let testUserId: string;
let testLoanId: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE ledger_entries, loans, audit_log, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Ledger Test MDA',
    code: 'LDGR',
    abbreviation: 'Ledger Test',
  });

  testUserId = generateUuidv7();
  await db.insert(users).values({
    id: testUserId,
    email: 'ledger-test@test.com',
    hashedPassword: 'hashed',
    firstName: 'Ledger',
    lastName: 'Tester',
    role: 'super_admin',
  });

  testLoanId = generateUuidv7();
  await db.insert(loans).values({
    id: testLoanId,
    staffId: 'STAFF-001',
    staffName: 'Test Staff',
    gradeLevel: 'GL-07',
    mdaId: testMdaId,
    principalAmount: '500000.00',
    interestRate: '4.000',
    tenureMonths: 48,
    monthlyDeductionAmount: '12500.00',
    approvalDate: new Date(),
    firstDeductionDate: new Date(),
    loanReference: 'VLC-2026-LDGR',
    status: 'ACTIVE',
  });
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE ledger_entries CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE ledger_entries, loans, audit_log, refresh_tokens, users, mdas CASCADE`);
});

const validEntryData = {
  loanId: '', // set in tests
  entryType: 'PAYROLL' as const,
  amount: '12500.00',
  principalComponent: '10000.00',
  interestComponent: '2500.00',
  periodMonth: 3,
  periodYear: 2026,
  source: 'Monthly payroll deduction',
};

describe('ledgerService.createEntry', () => {
  it('creates a ledger entry with auto-populated staffId and mdaId', async () => {
    const entry = await ledgerService.createEntry(testUserId, {
      ...validEntryData,
      loanId: testLoanId,
    });

    expect(entry.id).toBeTruthy();
    expect(entry.loanId).toBe(testLoanId);
    expect(entry.staffId).toBe('STAFF-001');
    expect(entry.mdaId).toBe(testMdaId);
    expect(entry.postedBy).toBe(testUserId);
    expect(entry.entryType).toBe('PAYROLL');
  });

  it('stores money as strings (NUMERIC)', async () => {
    const entry = await ledgerService.createEntry(testUserId, {
      ...validEntryData,
      loanId: testLoanId,
    });

    expect(entry.amount).toBe('12500.00');
    expect(entry.principalComponent).toBe('10000.00');
    expect(entry.interestComponent).toBe('2500.00');
    expect(typeof entry.amount).toBe('string');
  });

  it('throws 404 for non-existent loan', async () => {
    await expect(
      ledgerService.createEntry(testUserId, {
        ...validEntryData,
        loanId: generateUuidv7(),
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'LOAN_NOT_FOUND' });
  });

  it('uses UUIDv7 for PK', async () => {
    const entry = await ledgerService.createEntry(testUserId, {
      ...validEntryData,
      loanId: testLoanId,
    });

    expect(entry.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('ledgerService.getEntriesByLoan', () => {
  it('returns entries for a loan in chronological order', async () => {
    // Insert two entries
    await ledgerService.createEntry(testUserId, {
      ...validEntryData,
      loanId: testLoanId,
      periodMonth: 1,
      periodYear: 2026,
    });
    await ledgerService.createEntry(testUserId, {
      ...validEntryData,
      loanId: testLoanId,
      periodMonth: 2,
      periodYear: 2026,
    });

    const entries = await ledgerService.getEntriesByLoan(testLoanId);
    expect(entries).toHaveLength(2);
    // chronological order: first entry before second
    expect(entries[0].periodMonth).toBe(1);
    expect(entries[1].periodMonth).toBe(2);
  });

  it('returns empty array for loan with no entries', async () => {
    const entries = await ledgerService.getEntriesByLoan(testLoanId);
    expect(entries).toHaveLength(0);
  });

  it('filters by MDA when mdaId is provided', async () => {
    await ledgerService.createEntry(testUserId, {
      ...validEntryData,
      loanId: testLoanId,
    });

    // Correct MDA
    const entries = await ledgerService.getEntriesByLoan(testLoanId, testMdaId);
    expect(entries).toHaveLength(1);

    // Wrong MDA
    const noEntries = await ledgerService.getEntriesByLoan(testLoanId, generateUuidv7());
    expect(noEntries).toHaveLength(0);
  });
});
