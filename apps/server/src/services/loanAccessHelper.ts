import { db } from '../db/index.js';
import { loans } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/appError.js';
import { VOCABULARY } from '@vlprs/shared';

/**
 * Validates that a loan exists and the caller has MDA-scoped access to it.
 * Shared by annotationService and eventFlagCorrectionService.
 */
export async function validateLoanAccess(loanId: string, mdaScope: string | null) {
  const [loan] = await db
    .select({ id: loans.id, mdaId: loans.mdaId, staffId: loans.staffId })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  if (!loan) {
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.ANNOTATION_LOAN_NOT_FOUND);
  }

  if (mdaScope && loan.mdaId !== mdaScope) {
    throw new AppError(403, 'MDA_SCOPE_VIOLATION', 'You can only access loans in your assigned MDA');
  }

  return loan;
}
