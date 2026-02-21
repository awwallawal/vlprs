import { eq, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';

/**
 * Applies MDA scoping to a Drizzle query WHERE clause.
 *
 * Usage:
 *   db.select().from(loans).where(
 *     and(
 *       withMdaScope(loans.mdaId, req.mdaScope),
 *       isNull(loans.deletedAt),
 *     )
 *   );
 *
 * When mdaScope is null (super_admin/dept_admin): returns undefined (no filter)
 * When mdaScope is a string (mda_officer): returns eq(column, mdaScope)
 */
export function withMdaScope(
  mdaIdColumn: AnyColumn,
  mdaScope: string | null | undefined,
): SQL | undefined {
  if (mdaScope === null || mdaScope === undefined) {
    return undefined;
  }
  return eq(mdaIdColumn, mdaScope);
}
