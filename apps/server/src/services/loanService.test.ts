import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { mdas, loans } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import * as loanService from './loanService';

let testMdaId: string;

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
