import { randomBytes } from 'node:crypto';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index';
import { users, refreshTokens, mdas } from '../db/schema';
import { hashPassword, comparePassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { hashToken } from '../lib/tokenHash';
import { generateUuidv7 } from '../lib/uuidv7';
import { AppError } from '../lib/appError';
import { env } from '../config/env';
import { ROLES, VOCABULARY } from '@vlprs/shared';
import type { User, RegisterRequest, LoginRequest } from '@vlprs/shared';

export interface LoginResult {
  accessToken: string;
  user: User;
  refreshToken: {
    raw: string;
    expiresMs: number;
  };
}

function sanitiseUser(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role,
    mdaId: row.mdaId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days
  const value = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}

export async function register(data: RegisterRequest): Promise<User> {
  // Validate role-mdaId combination
  if (data.role === ROLES.MDA_OFFICER && !data.mdaId) {
    throw new AppError(400, 'VALIDATION_FAILED', VOCABULARY.VALIDATION_FAILED, [
      { field: 'mdaId', message: 'MDA is required for mda_officer role' },
    ]);
  }
  if ((data.role === ROLES.SUPER_ADMIN || data.role === ROLES.DEPT_ADMIN) && data.mdaId) {
    throw new AppError(400, 'VALIDATION_FAILED', VOCABULARY.VALIDATION_FAILED, [
      { field: 'mdaId', message: 'MDA must not be set for this role' },
    ]);
  }

  // If mdaId provided, verify it exists
  if (data.mdaId) {
    const [mda] = await db.select({ id: mdas.id }).from(mdas).where(eq(mdas.id, data.mdaId));
    if (!mda) {
      throw new AppError(400, 'VALIDATION_FAILED', VOCABULARY.VALIDATION_FAILED, [
        { field: 'mdaId', message: 'The specified MDA does not exist' },
      ]);
    }
  }

  // Check for duplicate email (case-insensitive)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${data.email})`);

  if (existing) {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', VOCABULARY.EMAIL_ALREADY_EXISTS);
  }

  // Hash password
  const hashed = await hashPassword(data.password);

  // Insert user
  const [newUser] = await db
    .insert(users)
    .values({
      id: generateUuidv7(),
      email: data.email,
      hashedPassword: hashed,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      mdaId: data.mdaId ?? null,
    })
    .returning();

  return sanitiseUser(newUser);
}

export async function login(data: LoginRequest): Promise<LoginResult> {
  // Find user by email (case-insensitive)
  const [user] = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${data.email})`);

  if (!user) {
    throw new AppError(401, 'LOGIN_UNSUCCESSFUL', VOCABULARY.LOGIN_UNSUCCESSFUL);
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_INACTIVE', VOCABULARY.ACCOUNT_INACTIVE);
  }

  // Check lockout
  if (user.lockedUntil) {
    if (user.lockedUntil > new Date()) {
      throw new AppError(423, 'ACCOUNT_TEMPORARILY_LOCKED', VOCABULARY.ACCOUNT_TEMPORARILY_LOCKED);
    }
    // Lockout expired — clear it
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, user.id));
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }

  // Compare password
  const passwordValid = await comparePassword(data.password, user.hashedPassword);

  if (!passwordValid) {
    const newAttempts = user.failedLoginAttempts + 1;
    const updateData: { failedLoginAttempts: number; lockedUntil?: Date | null } = {
      failedLoginAttempts: newAttempts,
    };

    if (newAttempts >= env.MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + env.LOCKOUT_DURATION_MINUTES * 60 * 1000,
      );
    }

    await db.update(users).set(updateData).where(eq(users.id, user.id));

    if (newAttempts >= env.MAX_LOGIN_ATTEMPTS) {
      throw new AppError(423, 'ACCOUNT_TEMPORARILY_LOCKED', VOCABULARY.ACCOUNT_TEMPORARILY_LOCKED);
    }
    throw new AppError(401, 'LOGIN_UNSUCCESSFUL', VOCABULARY.LOGIN_UNSUCCESSFUL);
  }

  // Successful login — reset failed attempts
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, user.id));

  // Single concurrent session — revoke all existing tokens before issuing new
  await revokeAllUserTokens(user.id);

  // Generate access token
  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    mdaId: user.mdaId,
  });

  // Generate refresh token
  const rawRefreshToken = randomBytes(64).toString('hex');
  const tokenHash = hashToken(rawRefreshToken);
  const expiresMs = parseExpiry(env.REFRESH_TOKEN_EXPIRY);
  const expiresAt = new Date(Date.now() + expiresMs);

  await db.insert(refreshTokens).values({
    id: generateUuidv7(),
    userId: user.id,
    tokenHash,
    expiresAt,
    lastUsedAt: new Date(),
  });

  return {
    accessToken,
    user: sanitiseUser(user),
    refreshToken: {
      raw: rawRefreshToken,
      expiresMs,
    },
  };
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: {
    raw: string;
    expiresMs: number;
  };
}

export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt),
      ),
    );
  return result.rowCount ?? 0;
}

export async function refreshToken(tokenFromCookie: string): Promise<RefreshResult> {
  if (!tokenFromCookie) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALID', VOCABULARY.REFRESH_TOKEN_INVALID);
  }

  const tokenHashValue = hashToken(tokenFromCookie);

  // Use error indicators instead of throwing inside the transaction,
  // because Drizzle rolls back on throw — which would undo revocations.
  const txResult = await db.transaction(async (tx) => {
    const [storedToken] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHashValue));

    if (!storedToken) {
      return { error: new AppError(401, 'REFRESH_TOKEN_INVALID', VOCABULARY.REFRESH_TOKEN_INVALID) };
    }

    // Reuse detection — token already revoked means theft
    if (storedToken.revokedAt !== null) {
      await tx.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, storedToken.userId),
            isNull(refreshTokens.revokedAt),
          ),
        );
      return { error: new AppError(401, 'TOKEN_REUSE_DETECTED', VOCABULARY.TOKEN_REUSE_DETECTED) };
    }

    // Check absolute expiry (7 days)
    if (storedToken.expiresAt < new Date()) {
      await tx.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, storedToken.id));
      return { error: new AppError(401, 'REFRESH_TOKEN_EXPIRED', VOCABULARY.REFRESH_TOKEN_EXPIRED) };
    }

    // Inactivity timeout check
    const inactivityMs = env.INACTIVITY_TIMEOUT_MINUTES * 60 * 1000;
    if (Date.now() - storedToken.lastUsedAt.getTime() > inactivityMs) {
      await tx.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, storedToken.id));
      return { error: new AppError(401, 'SESSION_INACTIVE', VOCABULARY.SESSION_INACTIVE) };
    }

    // Atomically revoke old token — AND revoked_at IS NULL prevents race condition
    const revokeResult = await tx.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.id, storedToken.id),
          isNull(refreshTokens.revokedAt),
        ),
      );

    // If no rows affected, another concurrent request already revoked this token
    if ((revokeResult.rowCount ?? 0) === 0) {
      await tx.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, storedToken.userId),
            isNull(refreshTokens.revokedAt),
          ),
        );
      return { error: new AppError(401, 'TOKEN_REUSE_DETECTED', VOCABULARY.TOKEN_REUSE_DETECTED) };
    }

    // Re-check user is still active
    const [user] = await tx.select().from(users).where(eq(users.id, storedToken.userId));
    if (!user || !user.isActive) {
      await tx.update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(refreshTokens.userId, storedToken.userId),
            isNull(refreshTokens.revokedAt),
          ),
        );
      return { error: new AppError(401, 'ACCOUNT_INACTIVE', VOCABULARY.ACCOUNT_INACTIVE) };
    }

    // Generate new refresh token
    const rawRefreshToken = randomBytes(64).toString('hex');
    const newTokenHash = hashToken(rawRefreshToken);
    const expiresMs = parseExpiry(env.REFRESH_TOKEN_EXPIRY);
    const expiresAt = new Date(Date.now() + expiresMs);

    await tx.insert(refreshTokens).values({
      id: generateUuidv7(),
      userId: user.id,
      tokenHash: newTokenHash,
      expiresAt,
      lastUsedAt: new Date(),
    });

    // Generate new access token with current user claims
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      mdaId: user.mdaId,
    });

    return {
      data: {
        accessToken,
        refreshToken: {
          raw: rawRefreshToken,
          expiresMs,
        },
      },
    };
  });

  if ('error' in txResult) throw txResult.error;
  return txResult.data;
}

export async function logout(userId: string): Promise<void> {
  await revokeAllUserTokens(userId);
}

export async function changePassword(userId: string, newPasswordHash: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(users)
      .set({ hashedPassword: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt),
        ),
      );
  });
}
