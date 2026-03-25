import { db } from '../db/index.js';
import { loanAnnotations, users } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import type { LoanAnnotation } from '@vlprs/shared';
import { validateLoanAccess } from './loanAccessHelper.js';

export async function addAnnotation(
  loanId: string,
  content: string,
  userId: string,
  mdaScope: string | null,
): Promise<LoanAnnotation> {
  await validateLoanAccess(loanId, mdaScope);

  const [annotation] = await db
    .insert(loanAnnotations)
    .values({ loanId, content, createdBy: userId })
    .returning();

  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    id: annotation.id,
    loanId: annotation.loanId,
    content: annotation.content,
    createdBy: { userId, name: user ? `${user.firstName} ${user.lastName}` : 'Unknown' },
    createdAt: annotation.createdAt.toISOString(),
  };
}

export async function getAnnotations(
  loanId: string,
  mdaScope: string | null,
): Promise<LoanAnnotation[]> {
  await validateLoanAccess(loanId, mdaScope);

  const rows = await db
    .select({
      id: loanAnnotations.id,
      loanId: loanAnnotations.loanId,
      content: loanAnnotations.content,
      createdBy: loanAnnotations.createdBy,
      createdAt: loanAnnotations.createdAt,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
    })
    .from(loanAnnotations)
    .innerJoin(users, eq(loanAnnotations.createdBy, users.id))
    .where(eq(loanAnnotations.loanId, loanId))
    .orderBy(desc(loanAnnotations.createdAt));

  return rows.map((r) => ({
    id: r.id,
    loanId: r.loanId,
    content: r.content,
    createdBy: { userId: r.createdBy, name: `${r.authorFirstName} ${r.authorLastName}` },
    createdAt: r.createdAt.toISOString(),
  }));
}
