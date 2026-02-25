import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { loans, mdas } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { AppError } from '../lib/appError';
import { withMdaScope } from '../lib/mdaScope';
import { VOCABULARY } from '@vlprs/shared';
import type { Loan } from '@vlprs/shared';

// ─── Types ───────────────────────────────────────────────────────────

interface ActingUser {
  userId: string;
  role: string;
  mdaId: string | null;
}

interface CreateLoanData {
  staffId: string;
  staffName: string;
  gradeLevel: string;
  mdaId: string;
  principalAmount: string;
  interestRate: string;
  tenureMonths: number;
  moratoriumMonths: number;
  monthlyDeductionAmount: string;
  approvalDate: string;
  firstDeductionDate: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD (date-only, no time component). */
function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toLoanResponse(row: typeof loans.$inferSelect): Loan {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: row.staffName,
    gradeLevel: row.gradeLevel,
    mdaId: row.mdaId,
    principalAmount: row.principalAmount,
    interestRate: row.interestRate,
    tenureMonths: row.tenureMonths,
    moratoriumMonths: row.moratoriumMonths,
    monthlyDeductionAmount: row.monthlyDeductionAmount,
    approvalDate: toDateString(row.approvalDate),
    firstDeductionDate: toDateString(row.firstDeductionDate),
    loanReference: row.loanReference,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function generateLoanReference(maxRetries = 3): Promise<string> {
  const currentYear = new Date().getFullYear();

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const [result] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(loans)
      .where(sql`EXTRACT(YEAR FROM ${loans.createdAt}) = ${currentYear}`);

    const nextNum = parseInt(result.count, 10) + 1 + attempt;
    const padded = String(nextNum).padStart(Math.max(4, String(nextNum).length), '0');
    const reference = `VLC-${currentYear}-${padded}`;

    // Check uniqueness
    const [existing] = await db
      .select({ id: loans.id })
      .from(loans)
      .where(eq(loans.loanReference, reference));

    if (!existing) return reference;
  }

  throw new AppError(500, 'DUPLICATE_LOAN_REFERENCE', VOCABULARY.DUPLICATE_LOAN_REFERENCE);
}

// ─── Service Functions ──────────────────────────────────────────────

export async function createLoan(_actingUser: ActingUser, data: CreateLoanData): Promise<Loan> {
  // Verify MDA exists
  const [mda] = await db.select({ id: mdas.id }).from(mdas).where(eq(mdas.id, data.mdaId));
  if (!mda) {
    throw new AppError(404, 'MDA_NOT_FOUND', VOCABULARY.MDA_NOT_FOUND);
  }

  const MAX_INSERT_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_INSERT_RETRIES; attempt++) {
    const loanReference = await generateLoanReference();

    try {
      const [row] = await db
        .insert(loans)
        .values({
          id: generateUuidv7(),
          staffId: data.staffId,
          staffName: data.staffName,
          gradeLevel: data.gradeLevel,
          mdaId: data.mdaId,
          principalAmount: data.principalAmount,
          interestRate: data.interestRate,
          tenureMonths: data.tenureMonths,
          moratoriumMonths: data.moratoriumMonths,
          monthlyDeductionAmount: data.monthlyDeductionAmount,
          approvalDate: new Date(data.approvalDate),
          firstDeductionDate: new Date(data.firstDeductionDate),
          loanReference,
          status: 'APPLIED',
        })
        .returning();

      return toLoanResponse(row);
    } catch (err: unknown) {
      // PostgreSQL unique_violation error code = 23505
      const isUniqueViolation =
        err instanceof Error && 'code' in err && (err as Error & { code: string }).code === '23505';
      if (isUniqueViolation && attempt < MAX_INSERT_RETRIES - 1) continue;
      throw err;
    }
  }

  throw new AppError(500, 'DUPLICATE_LOAN_REFERENCE', VOCABULARY.DUPLICATE_LOAN_REFERENCE);
}

export async function getLoanById(
  id: string,
  mdaScope?: string | null,
): Promise<Loan> {
  const conditions = [eq(loans.id, id)];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [row] = await db
    .select()
    .from(loans)
    .where(and(...conditions));

  if (!row) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  return toLoanResponse(row);
}
