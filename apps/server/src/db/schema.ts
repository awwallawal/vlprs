/**
 * Drizzle ORM schema — single file for all table definitions.
 *
 * Conventions:
 * - Tables: snake_case, plural (e.g., users, ledger_entries)
 * - Columns: snake_case (e.g., staff_id, created_at)
 * - PKs: UUIDv7 via lib/uuidv7.ts
 * - Timestamps: Always timestamptz (UTC)
 * - Money: NUMERIC(15,2) — never FLOAT
 * - Soft deletes: deleted_at timestamp
 * - Booleans: is_ or has_ prefix
 */

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { generateUuidv7 } from '../lib/uuidv7';

// ─── Enums ──────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['super_admin', 'dept_admin', 'mda_officer']);

// ─── MDAs (stub — expanded in Epic 2) ──────────────────────────────
export const mdas = pgTable('mdas', {
  id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Users ──────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    email: varchar('email', { length: 255 }).notNull().unique(),
    hashedPassword: text('hashed_password').notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    role: roleEnum('role').notNull(),
    mdaId: uuid('mda_id').references(() => mdas.id),
    isActive: boolean('is_active').notNull().default(true),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_users_email').on(table.email),
  ],
);

// ─── Refresh Tokens ─────────────────────────────────────────────────
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    userId: uuid('user_id').notNull().references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_refresh_tokens_token_hash').on(table.tokenHash),
    index('idx_refresh_tokens_user_revoked').on(table.userId, table.revokedAt),
  ],
);
