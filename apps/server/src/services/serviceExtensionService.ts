import { eq, and, sql } from 'drizzle-orm';
import { addYears } from 'date-fns';
import { db } from '../db/index';
import { loans, serviceExtensions, users } from '../db/schema';
import { withMdaScope } from '../lib/mdaScope';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type { ServiceExtension } from '@vlprs/shared';
import { toDateString } from '../lib/dateUtils';

// ─── recordServiceExtension ─────────────────────────────────────────

export async function recordServiceExtension(
  userId: string,
  loanId: string,
  newRetirementDate: string,
  approvingAuthorityReference: string,
  notes: string,
  mdaScope: string | null | undefined,
): Promise<ServiceExtension> {
  return db.transaction(async (tx) => {
    // 1. Read loan with row lock + concurrent user fetch
    const conditions = [eq(loans.id, loanId)];
    const scopeCondition = withMdaScope(loans.mdaId, mdaScope);
    if (scopeCondition) conditions.push(scopeCondition);

    const [loanRows, userRows] = await Promise.all([
      tx.select().from(loans).where(and(...conditions)).for('update'),
      tx.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, userId)),
    ]);

    const [loan] = loanRows;
    const [user] = userRows;

    if (!loan) {
      // 403 vs 404 distinction for MDA scoping
      if (mdaScope) {
        const [exists] = await tx.select({ id: loans.id }).from(loans).where(eq(loans.id, loanId));
        if (exists) {
          throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
        }
      }
      throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
    }

    // 2. Validate temporal profile is complete
    if (!loan.computedRetirementDate) {
      throw new AppError(422, 'SERVICE_EXTENSION_INCOMPLETE_PROFILE',
        VOCABULARY.SERVICE_EXTENSION_INCOMPLETE_PROFILE);
    }

    // 3. Validate extension date is after current retirement date
    const currentRetirement = loan.computedRetirementDate;
    const extensionDate = new Date(newRetirementDate);
    if (extensionDate <= currentRetirement) {
      throw new AppError(422, 'SERVICE_EXTENSION_DATE_NOT_AFTER',
        VOCABULARY.SERVICE_EXTENSION_DATE_NOT_AFTER
          .replace('{currentDate}', toDateString(currentRetirement)));
    }

    // 4. Validate max 10-year extension
    const maxDate = addYears(currentRetirement, 10);
    if (extensionDate > maxDate) {
      throw new AppError(422, 'SERVICE_EXTENSION_MAX_EXCEEDED',
        VOCABULARY.SERVICE_EXTENSION_MAX_EXCEEDED);
    }

    // 5. Insert extension record
    const [record] = await tx.insert(serviceExtensions).values({
      loanId,
      originalComputedDate: currentRetirement,
      newRetirementDate: extensionDate,
      approvingAuthorityReference,
      notes,
      createdBy: userId,
    }).returning();

    // 6. Update loan's retirement date
    await tx.update(loans)
      .set({ computedRetirementDate: extensionDate, updatedAt: new Date() })
      .where(eq(loans.id, loanId));

    return {
      id: record.id,
      loanId: record.loanId,
      originalComputedDate: toDateString(record.originalComputedDate),
      newRetirementDate: toDateString(record.newRetirementDate),
      approvingAuthorityReference: record.approvingAuthorityReference,
      notes: record.notes,
      createdBy: record.createdBy,
      createdByName: user ? `${user.firstName} ${user.lastName}` : '',
      createdAt: record.createdAt.toISOString(),
    };
  });
}

// ─── getServiceExtensions ───────────────────────────────────────────

export async function getServiceExtensions(
  loanId: string,
  mdaScope: string | null | undefined,
): Promise<ServiceExtension[]> {
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

  // Fetch extensions with user name JOIN, ordered chronologically (oldest first)
  const rows = await db
    .select({
      id: serviceExtensions.id,
      loanId: serviceExtensions.loanId,
      originalComputedDate: serviceExtensions.originalComputedDate,
      newRetirementDate: serviceExtensions.newRetirementDate,
      approvingAuthorityReference: serviceExtensions.approvingAuthorityReference,
      notes: serviceExtensions.notes,
      createdBy: serviceExtensions.createdBy,
      createdByName: sql<string>`${users.firstName} || ' ' || ${users.lastName}`,
      createdAt: serviceExtensions.createdAt,
    })
    .from(serviceExtensions)
    .innerJoin(users, eq(serviceExtensions.createdBy, users.id))
    .where(eq(serviceExtensions.loanId, loanId))
    .orderBy(serviceExtensions.createdAt);

  return rows.map((r) => ({
    id: r.id,
    loanId: r.loanId,
    originalComputedDate: toDateString(r.originalComputedDate),
    newRetirementDate: toDateString(r.newRetirementDate),
    approvingAuthorityReference: r.approvingAuthorityReference,
    notes: r.notes,
    createdBy: r.createdBy,
    createdByName: r.createdByName,
    createdAt: r.createdAt.toISOString(),
  }));
}
