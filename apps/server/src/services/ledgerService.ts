import { ledgerDb } from '../db/immutable';
import { db } from '../db/index';
import { loans } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/appError';
import { VOCABULARY, type CreateLedgerEntryInput } from '@vlprs/shared';

export async function createEntry(postedBy: string, data: CreateLedgerEntryInput) {
  // Look up loan to auto-populate staff_id and mda_id
  const [loan] = await db.select().from(loans).where(eq(loans.id, data.loanId));
  if (!loan) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  return ledgerDb.insert({
    loanId: data.loanId,
    staffId: loan.staffId,
    mdaId: loan.mdaId,
    entryType: data.entryType,
    amount: data.amount,
    principalComponent: data.principalComponent,
    interestComponent: data.interestComponent,
    periodMonth: data.periodMonth,
    periodYear: data.periodYear,
    payrollBatchReference: data.payrollBatchReference ?? null,
    source: data.source ?? null,
    postedBy,
  });
}

export async function getEntriesByLoan(loanId: string, mdaId?: string) {
  if (mdaId) {
    return ledgerDb.selectByMdaAndLoan(mdaId, loanId);
  }
  return ledgerDb.selectByLoan(loanId);
}
