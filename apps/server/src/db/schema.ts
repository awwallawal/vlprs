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
  numeric,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generateUuidv7 } from '../lib/uuidv7';

// ─── Enums ──────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['super_admin', 'dept_admin', 'mda_officer']);

// ─── MDAs ───────────────────────────────────────────────────────────
export const mdas = pgTable('mdas', {
  id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  abbreviation: varchar('abbreviation', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─── MDA Aliases ────────────────────────────────────────────────────
export const mdaAliases = pgTable(
  'mda_aliases',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    alias: varchar('alias', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_mda_aliases_mda_id').on(table.mdaId),
    uniqueIndex('idx_mda_aliases_alias_lower').on(sql`LOWER(${table.alias})`),
  ],
);

// ─── Entry Type Enum (Story 2.2) ────────────────────────────────────
export const entryTypeEnum = pgEnum('entry_type', [
  'PAYROLL', 'ADJUSTMENT', 'MIGRATION_BASELINE', 'WRITE_OFF',
]);

// ─── Loan Status Enum ───────────────────────────────────────────────
export const loanStatusEnum = pgEnum('loan_status', [
  'APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF',
]);

// ─── Loans ──────────────────────────────────────────────────────────
export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    staffId: varchar('staff_id', { length: 50 }).notNull(),
    staffName: varchar('staff_name', { length: 255 }).notNull(),
    gradeLevel: varchar('grade_level', { length: 50 }).notNull(),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    principalAmount: numeric('principal_amount', { precision: 15, scale: 2 }).notNull(),
    interestRate: numeric('interest_rate', { precision: 5, scale: 3 }).notNull(),
    tenureMonths: integer('tenure_months').notNull(),
    moratoriumMonths: integer('moratorium_months').notNull().default(0),
    monthlyDeductionAmount: numeric('monthly_deduction_amount', { precision: 15, scale: 2 }).notNull(),
    approvalDate: timestamp('approval_date', { withTimezone: true, mode: 'date' }).notNull(),
    firstDeductionDate: timestamp('first_deduction_date', { withTimezone: true, mode: 'date' }).notNull(),
    loanReference: varchar('loan_reference', { length: 50 }).notNull().unique(),
    status: loanStatusEnum('status').notNull().default('APPLIED'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_loans_staff_id').on(table.staffId),
    index('idx_loans_mda_id').on(table.mdaId),
    // loan_reference unique constraint already creates a btree index — no explicit index needed
    index('idx_loans_status').on(table.status),
  ],
);

// ─── Ledger Entries (Story 2.2) ────────────────────────────────────
// Append-only, immutable financial ledger. No updated_at, no deleted_at.
// Immutability enforced by DB trigger (fn_prevent_modification).
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    staffId: varchar('staff_id', { length: 50 }).notNull(),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    entryType: entryTypeEnum('entry_type').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    principalComponent: numeric('principal_component', { precision: 15, scale: 2 }).notNull(),
    interestComponent: numeric('interest_component', { precision: 15, scale: 2 }).notNull(),
    periodMonth: integer('period_month').notNull(),
    periodYear: integer('period_year').notNull(),
    payrollBatchReference: varchar('payroll_batch_reference', { length: 100 }),
    source: varchar('source', { length: 255 }),
    postedBy: uuid('posted_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ledger_entries_loan_id').on(table.loanId),
    index('idx_ledger_entries_mda_id').on(table.mdaId),
    index('idx_ledger_entries_staff_id').on(table.staffId),
    index('idx_ledger_entries_created_at').on(table.createdAt),
    index('idx_ledger_entries_period').on(table.periodYear, table.periodMonth),
  ],
);

// ─── Loan State Transitions (Story 2.7) ────────────────────────────
// Append-only, immutable transition audit trail. No updatedAt, no deletedAt.
// Immutability enforced by DB trigger (fn_prevent_modification).
export const loanStateTransitions = pgTable(
  'loan_state_transitions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    fromStatus: loanStatusEnum('from_status').notNull(),
    toStatus: loanStatusEnum('to_status').notNull(),
    transitionedBy: uuid('transitioned_by').notNull().references(() => users.id),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_loan_state_transitions_loan_id').on(table.loanId),
    index('idx_loan_state_transitions_created_at').on(table.createdAt),
  ],
);

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
    mustChangePassword: boolean('must_change_password').notNull().default(false),
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

// ─── Audit Log (Story 1.5) ─────────────────────────────────────────
// Append-only, immutable audit trail. No updated_at, no deleted_at.
// Immutability enforced by DB trigger (fn_prevent_modification).
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    userId: uuid('user_id').references(() => users.id),
    email: varchar('email', { length: 255 }),
    role: varchar('role', { length: 50 }),
    mdaId: uuid('mda_id'),
    action: varchar('action', { length: 100 }).notNull(),
    resource: varchar('resource', { length: 255 }),
    method: varchar('method', { length: 10 }),
    requestBodyHash: varchar('request_body_hash', { length: 64 }),
    responseStatus: integer('response_status'),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    userAgent: text('user_agent'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_audit_log_user_id').on(table.userId),
    index('idx_audit_log_created_at').on(table.createdAt),
    index('idx_audit_log_action').on(table.action),
  ],
);
