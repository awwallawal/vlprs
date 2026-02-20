import { db } from '../db';
import { users } from '../db/schema';
import { isNull, and } from 'drizzle-orm';
import { withMdaScope } from '../lib/mdaScope';

const DEFAULT_LIMIT = 100;

/**
 * List users with MDA scoping.
 * - mdaScope = null: returns all active users (admin view)
 * - mdaScope = string: returns users for that MDA only
 *
 * Pagination will be expanded in Story 1.9a (User Account Lifecycle).
 */
export async function listUsers(mdaScope: string | null, limit = DEFAULT_LIMIT) {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      mdaId: users.mdaId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        withMdaScope(users.mdaId, mdaScope),
      ),
    )
    .limit(limit);

  return result;
}
