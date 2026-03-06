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
  date,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { generateUuidv7 } from '../lib/uuidv7';

// ─── Enums ──────────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['super_admin', 'dept_admin', 'mda_officer']);

// ─── MDAs ───────────────────────────────────────────────────────────
export const mdas = pgTable(
  'mdas',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    name: varchar('name', { length: 255 }).notNull(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    abbreviation: varchar('abbreviation', { length: 100 }).notNull(),
    parentMdaId: uuid('parent_mda_id').references((): AnyPgColumn => mdas.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_mdas_parent_mda_id').on(table.parentMdaId),
  ],
);

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
    dateOfBirth: date('date_of_birth', { mode: 'date' }),
    dateOfFirstAppointment: date('date_of_first_appointment', { mode: 'date' }),
    computedRetirementDate: date('computed_retirement_date', { mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_loans_staff_id').on(table.staffId),
    index('idx_loans_mda_id').on(table.mdaId),
    // loan_reference unique constraint already creates a btree index — no explicit index needed
    index('idx_loans_status').on(table.status),
    index('idx_loans_computed_retirement_date').on(table.computedRetirementDate),
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

// ─── Temporal Corrections (Story 10.1) ──────────────────────────────
// Append-only, immutable temporal correction audit trail. No updatedAt, no deletedAt.
// Immutability enforced by DB trigger (fn_prevent_modification).
export const temporalCorrections = pgTable(
  'temporal_corrections',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    fieldName: text('field_name').notNull(),
    oldValue: date('old_value', { mode: 'date' }),
    newValue: date('new_value', { mode: 'date' }).notNull(),
    oldRetirementDate: date('old_retirement_date', { mode: 'date' }),
    newRetirementDate: date('new_retirement_date', { mode: 'date' }),
    correctedBy: uuid('corrected_by').notNull().references(() => users.id),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_temporal_corrections_loan_id').on(table.loanId),
    index('idx_temporal_corrections_created_at').on(table.createdAt),
  ],
);

// ─── Service Extensions (Story 10.2) ─────────────────────────────────
// Append-only, immutable service extension records. No updatedAt, no deletedAt.
// Immutability enforced by DB trigger (fn_prevent_modification).
export const serviceExtensions = pgTable(
  'service_extensions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    originalComputedDate: date('original_computed_date', { mode: 'date' }).notNull(),
    newRetirementDate: date('new_retirement_date', { mode: 'date' }).notNull(),
    approvingAuthorityReference: varchar('approving_authority_reference', { length: 100 }).notNull(),
    notes: text('notes').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_service_extensions_loan_id').on(table.loanId),
    index('idx_service_extensions_created_at').on(table.createdAt),
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

// ─── Migration Upload Status Enum (Story 3.1, extended Story 3.2) ───
export const migrationUploadStatusEnum = pgEnum('migration_upload_status', [
  'uploaded', 'mapped', 'processing', 'completed', 'validated', 'failed',
]);

// ─── Variance Category Enum (Story 3.2) ─────────────────────────────
export const varianceCategoryEnum = pgEnum('variance_category', [
  'clean', 'minor_variance', 'significant_variance', 'structural_error', 'anomalous',
]);

// ─── Migration Uploads (Story 3.1) ──────────────────────────────────
export const migrationUploads = pgTable(
  'migration_uploads',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
    filename: varchar('filename', { length: 500 }).notNull(),
    fileSizeBytes: integer('file_size_bytes').notNull(),
    sheetCount: integer('sheet_count').notNull().default(0),
    totalRecords: integer('total_records').notNull().default(0),
    status: migrationUploadStatusEnum('status').notNull().default('uploaded'),
    eraDetected: integer('era_detected'),
    metadata: jsonb('metadata'),
    hasMultiMda: boolean('has_multi_mda').notNull().default(false),
    multiMdaBoundaries: jsonb('multi_mda_boundaries'),
    validationSummary: jsonb('validation_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_migration_uploads_mda_id').on(table.mdaId),
    index('idx_migration_uploads_uploaded_by').on(table.uploadedBy),
    index('idx_migration_uploads_status').on(table.status),
    index('idx_migration_uploads_created_at').on(table.createdAt),
  ],
);

// ─── Migration Records (Story 3.1) ──────────────────────────────────
export const migrationRecords = pgTable(
  'migration_records',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    uploadId: uuid('upload_id').notNull().references(() => migrationUploads.id),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    mdaText: text('mda_text'),
    sheetName: text('sheet_name').notNull(),
    rowNumber: integer('row_number').notNull(),
    era: integer('era').notNull(),
    periodYear: integer('period_year'),
    periodMonth: integer('period_month'),
    serialNumber: text('serial_number'),
    staffName: text('staff_name').notNull(),
    principal: numeric('principal', { precision: 15, scale: 2 }),
    interestTotal: numeric('interest_total', { precision: 15, scale: 2 }),
    totalLoan: numeric('total_loan', { precision: 15, scale: 2 }),
    monthlyDeduction: numeric('monthly_deduction', { precision: 15, scale: 2 }),
    monthlyInterest: numeric('monthly_interest', { precision: 15, scale: 2 }),
    monthlyPrincipal: numeric('monthly_principal', { precision: 15, scale: 2 }),
    totalInterestPaid: numeric('total_interest_paid', { precision: 15, scale: 2 }),
    totalOutstandingInterest: numeric('total_outstanding_interest', { precision: 15, scale: 2 }),
    totalLoanPaid: numeric('total_loan_paid', { precision: 15, scale: 2 }),
    outstandingBalance: numeric('outstanding_balance', { precision: 15, scale: 2 }),
    installmentCount: integer('installment_count'),
    installmentsPaid: integer('installments_paid'),
    installmentsOutstanding: integer('installments_outstanding'),
    employeeNo: text('employee_no'),
    refId: text('ref_id'),
    commencementDate: text('commencement_date'),
    startDate: text('start_date'),
    endDate: text('end_date'),
    station: text('station'),
    remarks: text('remarks'),
    dateOfBirth: text('date_of_birth'),
    dateOfFirstAppointment: text('date_of_first_appointment'),
    varianceCategory: varianceCategoryEnum('variance_category'),
    varianceAmount: numeric('variance_amount', { precision: 15, scale: 2 }),
    computedRate: numeric('computed_rate', { precision: 6, scale: 3 }),
    hasRateVariance: boolean('has_rate_variance').notNull().default(false),
    computedTotalLoan: numeric('computed_total_loan', { precision: 15, scale: 2 }),
    computedMonthlyDeduction: numeric('computed_monthly_deduction', { precision: 15, scale: 2 }),
    computedOutstandingBalance: numeric('computed_outstanding_balance', { precision: 15, scale: 2 }),
    sourceFile: text('source_file').notNull(),
    sourceSheet: text('source_sheet').notNull(),
    sourceRow: integer('source_row').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_migration_records_upload_id').on(table.uploadId),
    index('idx_migration_records_mda_id').on(table.mdaId),
    index('idx_migration_records_staff_name').on(table.staffName),
    index('idx_migration_records_created_at').on(table.createdAt),
    index('idx_migration_records_variance_category').on(table.varianceCategory),
    index('idx_migration_records_has_rate_variance').on(table.hasRateVariance),
  ],
);

// ─── Migration Extra Fields (Story 3.1) ─────────────────────────────
export const migrationExtraFields = pgTable(
  'migration_extra_fields',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    recordId: uuid('record_id').notNull().references(() => migrationRecords.id),
    fieldName: text('field_name').notNull(),
    fieldValue: text('field_value'),
    sourceHeader: text('source_header').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_migration_extra_fields_record_id').on(table.recordId),
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
