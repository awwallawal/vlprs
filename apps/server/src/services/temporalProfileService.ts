import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { loans, temporalCorrections, users } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { AppError } from '../lib/appError';
import { computeRetirementDate, computeRemainingServiceMonths } from './computationEngine';
import { VOCABULARY } from '@vlprs/shared';
import type { TemporalProfile, TemporalCorrection, LoanDetail } from '@vlprs/shared';
import { toDateString } from '../lib/dateUtils';

// ─── buildTemporalProfile ───────────────────────────────────────────

export function buildTemporalProfile(loan: {
  dateOfBirth: Date | null;
  dateOfFirstAppointment: Date | null;
  computedRetirementDate: Date | null;
}): TemporalProfile {
  const { dateOfBirth, dateOfFirstAppointment, computedRetirementDate } = loan;

  if (dateOfBirth && dateOfFirstAppointment && computedRetirementDate) {
    const { computationMethod } = computeRetirementDate(dateOfBirth, dateOfFirstAppointment);
    const remainingServiceMonths = computeRemainingServiceMonths(computedRetirementDate);

    return {
      dateOfBirth: toDateString(dateOfBirth),
      dateOfFirstAppointment: toDateString(dateOfFirstAppointment),
      computedRetirementDate: toDateString(computedRetirementDate),
      computationMethod,
      profileStatus: 'complete',
      remainingServiceMonths,
      profileIncompleteReason: null,
    };
  }

  return {
    dateOfBirth: toDateString(dateOfBirth),
    dateOfFirstAppointment: toDateString(dateOfFirstAppointment),
    computedRetirementDate: null,
    computationMethod: null,
    profileStatus: 'incomplete',
    remainingServiceMonths: null,
    profileIncompleteReason: VOCABULARY.TEMPORAL_PROFILE_INCOMPLETE,
  };
}

// ─── updateTemporalProfile ──────────────────────────────────────────

export async function updateTemporalProfile(
  userId: string,
  loanId: string,
  updates: { dateOfBirth?: string; dateOfFirstAppointment?: string },
  reason: string,
  mdaScope: string | null | undefined,
): Promise<LoanDetail> {
  // Lazy import to avoid circular dependency (loanService → temporalProfile → loanService)
  const { getLoanDetail } = await import('./loanService');

  await db.transaction(async (tx) => {
    // 1. Read loan with row lock
    const conditions = [eq(loans.id, loanId)];
    const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
    if (scopeCondition) conditions.push(scopeCondition);

    const [loan] = await tx.select().from(loans).where(and(...conditions)).for('update');

    if (!loan) {
      // Distinguish 404 vs 403
      if (mdaScope) {
        const [exists] = await tx.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId));
        if (exists) {
          throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
        }
      }
      throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
    }

    // 2. Business logic validation
    if (updates.dateOfBirth) {
      const newDob = new Date(updates.dateOfBirth);
      if (newDob > new Date()) {
        throw new AppError(422, 'TEMPORAL_DOB_FUTURE', VOCABULARY.TEMPORAL_DOB_FUTURE);
      }
    }

    const effectiveDob = updates.dateOfBirth ? new Date(updates.dateOfBirth) : loan.dateOfBirth;
    const effectiveAppt = updates.dateOfFirstAppointment
      ? new Date(updates.dateOfFirstAppointment)
      : loan.dateOfFirstAppointment;

    if (effectiveDob && effectiveAppt && effectiveAppt < effectiveDob) {
      throw new AppError(422, 'TEMPORAL_APPT_BEFORE_DOB', VOCABULARY.TEMPORAL_APPT_BEFORE_DOB);
    }

    // 3. Record corrections for each changed field
    const corrections: Array<{
      loanId: string;
      fieldName: string;
      oldValue: Date | null;
      newValue: Date;
      oldRetirementDate: Date | null;
      correctedBy: string;
      reason: string;
      newRetirementDate?: Date | null;
    }> = [];

    if (updates.dateOfBirth && toDateString(loan.dateOfBirth) !== updates.dateOfBirth) {
      corrections.push({
        loanId,
        fieldName: 'date_of_birth',
        oldValue: loan.dateOfBirth,
        newValue: new Date(updates.dateOfBirth),
        oldRetirementDate: loan.computedRetirementDate,
        correctedBy: userId,
        reason,
      });
    }

    if (updates.dateOfFirstAppointment && toDateString(loan.dateOfFirstAppointment) !== updates.dateOfFirstAppointment) {
      corrections.push({
        loanId,
        fieldName: 'date_of_first_appointment',
        oldValue: loan.dateOfFirstAppointment,
        newValue: new Date(updates.dateOfFirstAppointment),
        oldRetirementDate: loan.computedRetirementDate,
        correctedBy: userId,
        reason,
      });
    }

    // No actual date changes — skip DB writes (L3 review fix)
    if (corrections.length === 0) {
      return;
    }

    // 4. Update loan dates
    const updateFields: Partial<typeof loans.$inferInsert> = { updatedAt: new Date() };
    if (updates.dateOfBirth) updateFields.dateOfBirth = new Date(updates.dateOfBirth);
    if (updates.dateOfFirstAppointment) updateFields.dateOfFirstAppointment = new Date(updates.dateOfFirstAppointment);

    // 5. Recompute retirement date
    if (effectiveDob && effectiveAppt) {
      const { retirementDate } = computeRetirementDate(effectiveDob, effectiveAppt);
      updateFields.computedRetirementDate = retirementDate;
    } else {
      updateFields.computedRetirementDate = null;
    }

    await tx.update(loans).set(updateFields).where(eq(loans.id, loanId));

    // 6. Insert correction records (with newRetirementDate now known)
    for (const c of corrections) {
      await tx.insert(temporalCorrections).values({
        ...c,
        newRetirementDate: updateFields.computedRetirementDate ?? null,
      });
    }
  });

  // Return updated loan detail (outside transaction — fresh read)
  return getLoanDetail(loanId, mdaScope);
}

// ─── getTemporalCorrections ────────────────────────────────────────

export async function getTemporalCorrections(
  loanId: string,
  mdaScope: string | null | undefined,
): Promise<TemporalCorrection[]> {
  // Verify loan exists + MDA scope
  const conditions = [eq(loans.id, loanId)];
  const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  const [loan] = await db.select({ id: loans.id, mdaId: loans.mdaId })
    .from(loans)
    .where(and(...conditions));

  if (!loan) {
    if (mdaScope) {
      const [exists] = await db.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId));
      if (exists) {
        throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
      }
    }
    throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
  }

  // Fetch corrections with user name JOIN
  const rows = await db
    .select({
      id: temporalCorrections.id,
      loanId: temporalCorrections.loanId,
      fieldName: temporalCorrections.fieldName,
      oldValue: temporalCorrections.oldValue,
      newValue: temporalCorrections.newValue,
      oldRetirementDate: temporalCorrections.oldRetirementDate,
      newRetirementDate: temporalCorrections.newRetirementDate,
      correctedBy: temporalCorrections.correctedBy,
      correctedByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      reason: temporalCorrections.reason,
      createdAt: temporalCorrections.createdAt,
    })
    .from(temporalCorrections)
    .innerJoin(users, eq(temporalCorrections.correctedBy, users.id))
    .where(eq(temporalCorrections.loanId, loanId))
    .orderBy(temporalCorrections.createdAt);

  return rows.map((r) => ({
    id: r.id,
    loanId: r.loanId,
    fieldName: r.fieldName,
    oldValue: toDateString(r.oldValue),
    newValue: toDateString(r.newValue)!,
    oldRetirementDate: toDateString(r.oldRetirementDate),
    newRetirementDate: toDateString(r.newRetirementDate),
    correctedBy: r.correctedBy,
    correctedByName: r.correctedByName,
    reason: r.reason,
    createdAt: r.createdAt.toISOString(),
  }));
}
