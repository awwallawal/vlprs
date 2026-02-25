import { describe, it, expect } from 'vitest';
import { createLoanSchema } from './loanSchemas';

const validInput = {
  staffId: 'OY/HLT/0231',
  staffName: 'Adebayo Olusegun',
  gradeLevel: 'GL 12',
  mdaId: '01936e2e-76b0-7000-8000-000000000001',
  principalAmount: '500000.00',
  interestRate: '6.000',
  tenureMonths: 36,
  moratoriumMonths: 0,
  monthlyDeductionAmount: '15278.00',
  approvalDate: '2024-03-15',
  firstDeductionDate: '2024-04-01',
};

describe('createLoanSchema', () => {
  it('accepts valid loan data', () => {
    const result = createLoanSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const result = createLoanSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects invalid money format (no decimals)', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      principalAmount: '500000',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid money format (3 decimals)', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      principalAmount: '500000.000',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid interest rate with 1-3 decimal places', () => {
    expect(createLoanSchema.safeParse({ ...validInput, interestRate: '6.0' }).success).toBe(true);
    expect(createLoanSchema.safeParse({ ...validInput, interestRate: '6.00' }).success).toBe(true);
    expect(createLoanSchema.safeParse({ ...validInput, interestRate: '6.000' }).success).toBe(true);
  });

  it('rejects negative tenure', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      tenureMonths: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero tenure', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      tenureMonths: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative moratorium months', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      moratoriumMonths: -1,
    });
    expect(result.success).toBe(false);
  });

  it('accepts zero moratorium months', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      moratoriumMonths: 0,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID for mdaId', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      mdaId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date format for approvalDate', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      approvalDate: '15/03/2024',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty staffId', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      staffId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects float tenure', () => {
    const result = createLoanSchema.safeParse({
      ...validInput,
      tenureMonths: 36.5,
    });
    expect(result.success).toBe(false);
  });
});
