import * as loanService from './loanService';
import { ledgerDb } from '../db/immutable';
import { computeBalanceFromEntries } from './computationEngine';

export async function getOutstandingBalance(loanId: string, asOf?: Date, mdaScope?: string | null) {
  const loan = await loanService.getLoanById(loanId, mdaScope);

  const entries = asOf
    ? await ledgerDb.selectByLoanAsOf(loanId, asOf)
    : await ledgerDb.selectByLoan(loanId);

  return computeBalanceFromEntries(
    loan.principalAmount,
    loan.interestRate,
    loan.tenureMonths,
    entries,
    asOf ? asOf.toISOString().split('T')[0] : null,
  );
}
