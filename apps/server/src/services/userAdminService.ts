import { eq, and, isNull, sql, ilike, or, count } from 'drizzle-orm';
import { db } from '../db/index';
import { users, mdas } from '../db/schema';
import { hashPassword, generateTemporaryPassword } from '../lib/password';
import { generateUuidv7 } from '../lib/uuidv7';
import { AppError } from '../lib/appError';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../lib/email';
import { sanitiseUser, revokeAllUserTokens, changePassword } from './authService';
import { env } from '../config/env';
import {
  ROLES,
  VOCABULARY,
  canManageRole,
  type Role,
  type User,
} from '@vlprs/shared';

// ─── Types ───────────────────────────────────────────────────────────

interface ActingUser {
  userId: string;
  email: string;
  role: Role;
  mdaId: string | null;
}

interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  role: 'dept_admin' | 'mda_officer';
  mdaId?: string | null;
}

interface ListUsersFilters {
  role?: Role;
  mdaId?: string;
  status?: 'active' | 'inactive';
  search?: string;
  page?: number;
  pageSize?: number;
}

interface PaginatedUsers {
  data: (User & { isSelf: boolean })[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function assertNotSelf(actingUser: ActingUser, targetId: string): void {
  if (actingUser.userId === targetId) {
    throw new AppError(403, 'SELF_MANAGEMENT_DENIED', VOCABULARY.SELF_MANAGEMENT_DENIED);
  }
}

async function getTargetUser(targetId: string) {
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.id, targetId));

  if (!target) {
    throw new AppError(404, 'NOT_FOUND', VOCABULARY.USER_NOT_FOUND ?? 'User not found.');
  }
  return target;
}

function assertCanManage(actingRole: Role, targetRole: Role): void {
  if (targetRole === ROLES.SUPER_ADMIN) {
    throw new AppError(403, 'SUPER_ADMIN_CLI_ONLY', VOCABULARY.SUPER_ADMIN_CLI_ONLY);
  }
  if (!canManageRole(actingRole, targetRole)) {
    throw new AppError(403, 'HIERARCHY_INSUFFICIENT', VOCABULARY.HIERARCHY_INSUFFICIENT);
  }
}

// ─── Service Functions ───────────────────────────────────────────────

export async function createUser(actingUser: ActingUser, data: CreateUserData): Promise<User> {
  // Reject creating super_admin via API
  if ((data.role as string) === ROLES.SUPER_ADMIN) {
    throw new AppError(403, 'SUPER_ADMIN_CLI_ONLY', VOCABULARY.SUPER_ADMIN_CLI_ONLY);
  }

  // Hierarchy check
  assertCanManage(actingUser.role, data.role);

  // MDA validation
  if (data.role === ROLES.MDA_OFFICER && !data.mdaId) {
    throw new AppError(422, 'MDA_REQUIRED_FOR_OFFICER', VOCABULARY.MDA_REQUIRED_FOR_OFFICER);
  }
  if (data.role !== ROLES.MDA_OFFICER && data.mdaId) {
    throw new AppError(422, 'MDA_ONLY_FOR_OFFICER', VOCABULARY.MDA_ONLY_FOR_OFFICER);
  }

  // Check for duplicate email (case-insensitive)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${data.email})`);

  if (existing) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', VOCABULARY.EMAIL_ALREADY_EXISTS);
  }

  // Validate MDA exists (if provided)
  let mdaName: string | undefined;
  if (data.mdaId) {
    const [mda] = await db
      .select({ id: mdas.id, name: mdas.name })
      .from(mdas)
      .where(eq(mdas.id, data.mdaId));
    if (!mda) {
      throw new AppError(422, 'MDA_NOT_FOUND', 'The specified MDA does not exist.');
    }
    mdaName = mda.name;
  }

  // Generate temporary password
  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(temporaryPassword);

  // Insert user
  const [newUser] = await db
    .insert(users)
    .values({
      id: generateUuidv7(),
      email: data.email,
      hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      mdaId: data.mdaId ?? null,
      mustChangePassword: true,
    })
    .returning();

  // Send welcome email (fire-and-forget)
  void sendWelcomeEmail({
    to: data.email,
    firstName: data.firstName,
    temporaryPassword,
    role: data.role,
    mdaName,
    loginUrl: `${env.APP_URL}/login`,
  });

  return sanitiseUser(newUser);
}

export async function listUsers(
  actingUser: ActingUser,
  filters: ListUsersFilters = {},
): Promise<PaginatedUsers> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions
  const conditions = [isNull(users.deletedAt)];

  // Role-based visibility
  if (actingUser.role === ROLES.DEPT_ADMIN) {
    // dept_admin sees only mda_officer accounts
    conditions.push(eq(users.role, ROLES.MDA_OFFICER));
  }
  // super_admin sees all non-deleted users (no additional filter)

  // Optional filters
  if (filters.role) {
    conditions.push(eq(users.role, filters.role));
  }
  if (filters.mdaId) {
    conditions.push(eq(users.mdaId, filters.mdaId));
  }
  if (filters.status === 'active') {
    conditions.push(eq(users.isActive, true));
  } else if (filters.status === 'inactive') {
    conditions.push(eq(users.isActive, false));
  }
  if (filters.search) {
    const search = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(users.firstName, search),
        ilike(users.lastName, search),
        ilike(users.email, search),
      )!,
    );
  }

  const whereClause = and(...conditions);

  // Get total count
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(users)
    .where(whereClause);

  // Get paginated results
  const rows = await db
    .select()
    .from(users)
    .where(whereClause)
    .orderBy(users.createdAt)
    .limit(pageSize)
    .offset(offset);

  const data = rows.map((row) => ({
    ...sanitiseUser(row),
    isSelf: row.id === actingUser.userId,
  }));

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: Number(totalItems),
      totalPages: Math.ceil(Number(totalItems) / pageSize),
    },
  };
}

export async function deactivateUser(
  actingUser: ActingUser,
  targetId: string,
  _reason?: string,
): Promise<User> {
  assertNotSelf(actingUser, targetId);

  const target = await getTargetUser(targetId);
  assertCanManage(actingUser.role, target.role);

  // Check if already soft-deleted
  if (target.deletedAt) {
    throw new AppError(422, 'DELETED_CANNOT_REACTIVATE', VOCABULARY.DELETED_CANNOT_REACTIVATE);
  }

  // Last super_admin guard
  if (target.role === ROLES.SUPER_ADMIN) {
    const [{ value: activeCount }] = await db
      .select({ value: count() })
      .from(users)
      .where(
        and(
          eq(users.role, ROLES.SUPER_ADMIN),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );
    if (Number(activeCount) <= 1) {
      throw new AppError(422, 'LAST_SUPER_ADMIN', VOCABULARY.LAST_SUPER_ADMIN);
    }
  }

  // Deactivate and revoke tokens
  const [updated] = await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, targetId))
    .returning();

  await revokeAllUserTokens(targetId);

  return sanitiseUser(updated);
}

export async function reactivateUser(
  actingUser: ActingUser,
  targetId: string,
): Promise<User> {
  assertNotSelf(actingUser, targetId);

  const target = await getTargetUser(targetId);
  assertCanManage(actingUser.role, target.role);

  // Cannot reactivate a soft-deleted account
  if (target.deletedAt) {
    throw new AppError(422, 'DELETED_CANNOT_REACTIVATE', VOCABULARY.DELETED_CANNOT_REACTIVATE);
  }

  const [updated] = await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, targetId))
    .returning();

  return sanitiseUser(updated);
}

export async function softDeleteUser(
  actingUser: ActingUser,
  targetId: string,
  confirmEmail: string,
): Promise<void> {
  assertNotSelf(actingUser, targetId);

  const target = await getTargetUser(targetId);
  assertCanManage(actingUser.role, target.role);

  // Email confirmation match
  if (target.email.toLowerCase() !== confirmEmail.toLowerCase()) {
    throw new AppError(422, 'DELETE_CONFIRM_MISMATCH', VOCABULARY.DELETE_CONFIRM_MISMATCH);
  }

  // Soft delete: set deletedAt, deactivate, revoke tokens
  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, targetId));

  await revokeAllUserTokens(targetId);
}

export async function reassignMda(
  actingUser: ActingUser,
  targetId: string,
  newMdaId: string,
): Promise<User> {
  assertNotSelf(actingUser, targetId);

  const target = await getTargetUser(targetId);
  assertCanManage(actingUser.role, target.role);

  // Only mda_officer can have MDA assigned
  if (target.role !== ROLES.MDA_OFFICER) {
    throw new AppError(422, 'MDA_ONLY_FOR_OFFICER', VOCABULARY.MDA_ONLY_FOR_OFFICER);
  }

  // Validate new MDA exists
  const [mda] = await db
    .select({ id: mdas.id })
    .from(mdas)
    .where(eq(mdas.id, newMdaId));
  if (!mda) {
    throw new AppError(422, 'MDA_NOT_FOUND', 'The specified MDA does not exist.');
  }

  const [updated] = await db
    .update(users)
    .set({ mdaId: newMdaId, updatedAt: new Date() })
    .where(eq(users.id, targetId))
    .returning();

  return sanitiseUser(updated);
}

export async function resetPassword(
  actingUser: ActingUser,
  targetId: string,
): Promise<void> {
  assertNotSelf(actingUser, targetId);

  const target = await getTargetUser(targetId);
  assertCanManage(actingUser.role, target.role);

  // Generate temporary password
  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(temporaryPassword);

  // Update password and set mustChangePassword flag, revoke tokens
  await changePassword(targetId, hashedPassword);
  await db
    .update(users)
    .set({ mustChangePassword: true, updatedAt: new Date() })
    .where(eq(users.id, targetId));

  // Send password reset email (fire-and-forget)
  void sendPasswordResetEmail({
    to: target.email,
    firstName: target.firstName,
    temporaryPassword,
    loginUrl: `${env.APP_URL}/login`,
  });
}
