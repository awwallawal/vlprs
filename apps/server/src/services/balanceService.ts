import { db } from '../db';
import { loans } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { withMdaScope } from '../lib/mdaScope';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import { ledgerDb } from '../db/immutable';
import { computeBalanceForLoan } from './computationEngine';

export async function getOutstandingBalance(loanId: string, asOf?: Date, mdaScope?: string | null) {
  const conditions = [eq(loans.id, loanId)];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [loan] = await db
    .select({
      principalAmount: loans.principalAmount,
      interestRate: loans.interestRate,
      tenureMonths: loans.tenureMonths,
      limitedComputation: loans.limitedComputation,
    })
    .from(loans)
    .where(and(...conditions));

  if (!loan) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  const entries = asOf
    ? await ledgerDb.selectByLoanAsOf(loanId, asOf)
    : await ledgerDb.selectByLoan(loanId);

  return computeBalanceForLoan({
    limitedComputation: loan.limitedComputation,
    principalAmount: loan.principalAmount,
    interestRate: loan.interestRate,
    tenureMonths: loan.tenureMonths,
    entries,
    asOfDate: asOf ? asOf.toISOString().split('T')[0] : null,
  });
}
