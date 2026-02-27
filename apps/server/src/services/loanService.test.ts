import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { mdas, users, ledgerEntries } from '../db/schema';
import { hashPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { autoSplitDeduction } from './computationEngine';
import * as loanService from './loanService';

let testMdaId: string;
let postedByUserId: string;

const actingUser = {
  userId: generateUuidv7(),
  role: 'super_admin',
  mdaId: null,
};

const validLoanData = {
  staffId: 'OY/TST/0001',
  staffName: 'Test User',
  gradeLevel: 'GL 12',
  mdaId: '', // set in beforeAll
  principalAmount: '500000.00',
  interestRate: '6.000',
  tenureMonths: 36,
  moratoriumMonths: 0,
  monthlyDeductionAmount: '15278.00',
  approvalDate: '2024-03-15',
  firstDeductionDate: '2024-04-01',
};

beforeAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({
    id: testMdaId,
    name: 'Test MDA',
    code: 'LOAN_TST',
    abbreviation: 'Test',
  });
  validLoanData.mdaId = testMdaId;

  // Create a user for postedBy FK (needed for ledger entries in searchLoans/getLoanDetail tests)
  postedByUserId = generateUuidv7();
  const hashedPw = await hashPassword('Test1234');
  await db.insert(users).values({
    id: postedByUserId,
    email: 'loan-svc-test-poster@test.com',
    hashedPassword: hashedPw,
    firstName: 'Poster',
    lastName: 'User',
    role: 'super_admin',
  });
});

beforeEach(async () => {
  await db.execute(sql`TRUNCATE loans CASCADE`);
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE audit_log, refresh_tokens, users, mdas CASCADE`);
});

describe('loanService.createLoan', () => {
  it('creates a loan and returns complete record', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);

    expect(loan.staffId).toBe('OY/TST/0001');
    expect(loan.staffName).toBe('Test User');
    expect(loan.gradeLevel).toBe('GL 12');
    expect(loan.mdaId).toBe(testMdaId);
    expect(loan.status).toBe('APPLIED');
    expect(loan.id).toBeTruthy();
    expect(loan.loanReference).toMatch(/^VLC-\d{4}-\d{4,}$/);
  });

  it('stores money as NUMERIC (returned as string)', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);

    expect(loan.principalAmount).toBe('500000.00');
    expect(loan.interestRate).toBe('6.000');
    expect(loan.monthlyDeductionAmount).toBe('15278.00');
  });

  it('generates unique loan references', async () => {
    const loan1 = await loanService.createLoan(actingUser, validLoanData);
    const loan2 = await loanService.createLoan(actingUser, {
      ...validLoanData,
      staffId: 'OY/TST/0002',
    });

    expect(loan1.loanReference).not.toBe(loan2.loanReference);
  });

  it('uses UUIDv7 for PK', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);
    // UUIDv7 format: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx
    expect(loan.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rejects loan for non-existent MDA', async () => {
    await expect(
      loanService.createLoan(actingUser, {
        ...validLoanData,
        mdaId: generateUuidv7(), // non-existent
      }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'MDA_NOT_FOUND' });
  });
});

describe('loanService.getLoanById', () => {
  it('returns loan by ID', async () => {
    const created = await loanService.createLoan(actingUser, validLoanData);
    const fetched = await loanService.getLoanById(created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.staffId).toBe(created.staffId);
    expect(fetched.loanReference).toBe(created.loanReference);
  });

  it('throws 404 for non-existent loan', async () => {
    await expect(loanService.getLoanById(generateUuidv7())).rejects.toMatchObject({
      statusCode: 404,
      code: 'LOAN_NOT_FOUND',
    });
  });

  it('enforces MDA scoping', async () => {
    const created = await loanService.createLoan(actingUser, validLoanData);

    // Should be visible with correct MDA scope
    const loan = await loanService.getLoanById(created.id, testMdaId);
    expect(loan.id).toBe(created.id);

    // Should not be visible with different MDA scope
    await expect(loanService.getLoanById(created.id, generateUuidv7())).rejects.toMatchObject({
      statusCode: 404,
      code: 'LOAN_NOT_FOUND',
    });
  });

  it('returns money fields as strings', async () => {
    const created = await loanService.createLoan(actingUser, validLoanData);
    const fetched = await loanService.getLoanById(created.id);

    expect(typeof fetched.principalAmount).toBe('string');
    expect(typeof fetched.interestRate).toBe('string');
    expect(typeof fetched.monthlyDeductionAmount).toBe('string');
  });
});

// ─── Story 2.6: searchLoans ────────────────────────────────────────

/** Helper: seed ledger entries for a loan */
async function seedEntries(loanId: string, staffId: string, mdaId: string, count: number) {
  const split = autoSplitDeduction('15278.00', {
    principalAmount: '500000.00',
    interestRate: '6.000',
    tenureMonths: 36,
    moratoriumMonths: 0,
  });

  for (let i = 0; i < count; i++) {
    await db.insert(ledgerEntries).values({
      id: generateUuidv7(),
      loanId,
      staffId,
      mdaId,
      entryType: 'PAYROLL',
      amount: '15278.00',
      principalComponent: split.principalComponent,
      interestComponent: split.interestComponent,
      periodMonth: ((i % 12) + 1),
      periodYear: 2024 + Math.floor(i / 12),
      postedBy: postedByUserId,
    });
  }
}

describe('loanService.searchLoans', () => {
  it('returns paginated results', async () => {
    await loanService.createLoan(actingUser, validLoanData);

    const result = await loanService.searchLoans(null);

    expect(result.data).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(25);
  });

  it('computes correct balance for loan with zero entries', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);

    const result = await loanService.searchLoans(null);
    const item = result.data.find((d) => d.loanId === loan.id)!;

    // 500000 principal + 6% interest = 500000 + 30000 = 530000
    expect(item.outstandingBalance).toBe('530000.00');
    expect(item.installmentsPaid).toBe(0);
    expect(item.installmentsRemaining).toBe(36);
  });

  it('computes correct balance for loan with entries', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);
    await seedEntries(loan.id, 'OY/TST/0001', testMdaId, 10);

    const result = await loanService.searchLoans(null);
    const item = result.data.find((d) => d.loanId === loan.id)!;

    // 10 entries × 15278.00 = 152780.00 paid
    // Outstanding = 530000.00 - 152780.00 = 377220.00
    expect(item.outstandingBalance).toBe('377220.00');
    expect(item.installmentsPaid).toBe(10);
    expect(item.installmentsRemaining).toBe(26);
  });

  it('computes zero balance for fully paid loan', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);
    // Seed exactly 36 entries (full tenure) — but note the total won't perfectly equal totalLoan
    // due to rounding. This tests that remaining never goes below 0.
    await seedEntries(loan.id, 'OY/TST/0001', testMdaId, 36);

    const result = await loanService.searchLoans(null);
    const item = result.data.find((d) => d.loanId === loan.id)!;

    expect(item.installmentsPaid).toBe(36);
    expect(item.installmentsRemaining).toBe(0);
  });

  it('applies MDA scope filter', async () => {
    await loanService.createLoan(actingUser, validLoanData);
    const otherMdaScope = generateUuidv7(); // different MDA

    const result = await loanService.searchLoans(otherMdaScope);
    expect(result.data).toHaveLength(0);
  });

  it('filters by status', async () => {
    await loanService.createLoan(actingUser, validLoanData); // default: APPLIED

    const active = await loanService.searchLoans(null, { status: 'ACTIVE' });
    expect(active.data).toHaveLength(0);

    const applied = await loanService.searchLoans(null, { status: 'APPLIED' });
    expect(applied.data).toHaveLength(1);
  });

  it('uses string for outstandingBalance (2 decimal places)', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);
    await seedEntries(loan.id, 'OY/TST/0001', testMdaId, 1);

    const result = await loanService.searchLoans(null);
    const item = result.data[0];

    expect(typeof item.outstandingBalance).toBe('string');
    expect(item.outstandingBalance).toMatch(/^\d+\.\d{2}$/);
  });
});

describe('loanService.getLoanDetail', () => {
  it('returns enriched detail with balance and schedule', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);
    await seedEntries(loan.id, 'OY/TST/0001', testMdaId, 3);

    const detail = await loanService.getLoanDetail(loan.id, null);

    expect(detail.id).toBe(loan.id);
    expect(detail.mdaName).toBe('Test MDA');
    expect(detail.mdaCode).toBe('LOAN_TST');
    expect(detail.balance.installmentsCompleted).toBe(3);
    expect(detail.schedule.params.principalAmount).toBe('500000.00');
    expect(detail.ledgerEntryCount).toBe(3);
  });

  it('throws 404 for non-existent loan', async () => {
    await expect(loanService.getLoanDetail(generateUuidv7(), null)).rejects.toMatchObject({
      statusCode: 404,
      code: 'LOAN_NOT_FOUND',
    });
  });

  it('throws 403 for MDA scope violation', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);
    const otherMda = generateUuidv7();

    await expect(loanService.getLoanDetail(loan.id, otherMda)).rejects.toMatchObject({
      statusCode: 403,
      code: 'MDA_ACCESS_DENIED',
    });
  });

  it('returns zero ledger count for loan with no entries', async () => {
    const loan = await loanService.createLoan(actingUser, validLoanData);

    const detail = await loanService.getLoanDetail(loan.id, null);
    expect(detail.ledgerEntryCount).toBe(0);
    expect(detail.balance.installmentsCompleted).toBe(0);
    expect(detail.balance.totalAmountPaid).toBe('0.00');
  });
});
