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

// ─── Person Match Enums (Story 3.3) ─────────────────────────────────
export const matchTypeEnum = pgEnum('match_type', [
  'exact_name', 'staff_id', 'surname_initial', 'fuzzy_name', 'manual',
]);

export const matchStatusEnum = pgEnum('match_status', [
  'auto_confirmed', 'pending_review', 'confirmed', 'rejected',
]);

// ─── Loan Status Enum ───────────────────────────────────────────────
// Canonical values: packages/shared/src/constants/loanStatuses.ts
export const loanStatusEnum = pgEnum('loan_status', [
  'APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF',
  'RETIRED', 'DECEASED', 'SUSPENDED', 'LWOP', 'TRANSFER_PENDING',
]);

// ─── Employment Event Type Enum (Story 11.2) ────────────────────────
export const employmentEventTypeEnum = pgEnum('employment_event_type', [
  'RETIRED', 'DECEASED', 'SUSPENDED', 'ABSCONDED', 'TRANSFERRED_OUT',
  'TRANSFERRED_IN', 'DISMISSED', 'LWOP_START', 'LWOP_END', 'REINSTATED',
  'SERVICE_EXTENSION',
]);

// ─── Reconciliation Status Enum (Story 11.2) ────────────────────────
export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'UNCONFIRMED', 'MATCHED', 'DATE_DISCREPANCY',
]);

// ─── Transfer Status Enum (Story 11.2) ──────────────────────────────
export const transferStatusEnum = pgEnum('transfer_status', [
  'PENDING', 'COMPLETED',
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
    limitedComputation: boolean('limited_computation').notNull().default(false),
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

// ─── Migration Upload Status Enum (Story 3.1, extended Story 3.2, Story 3.4) ─
export const migrationUploadStatusEnum = pgEnum('migration_upload_status', [
  'uploaded', 'mapped', 'processing', 'completed', 'validated', 'reconciled', 'failed',
]);

// ─── Migration Record Status Enum (Story 7.0g) ─────────────────────
export const migrationRecordStatusEnum = pgEnum('migration_record_status', [
  'active', 'superseded',
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
    delineationResult: jsonb('delineation_result'),
    validationSummary: jsonb('validation_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    // Supersession fields (Story 7.0g)
    supersededBy: uuid('superseded_by').references((): AnyPgColumn => migrationUploads.id),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    supersededReason: text('superseded_reason'),
    supersededByUserId: uuid('superseded_by_user_id').references(() => users.id),
  },
  (table) => [
    index('idx_migration_uploads_mda_id').on(table.mdaId),
    index('idx_migration_uploads_uploaded_by').on(table.uploadedBy),
    index('idx_migration_uploads_status').on(table.status),
    index('idx_migration_uploads_created_at').on(table.createdAt),
    index('idx_migration_uploads_superseded_by').on(table.supersededBy),
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
    gradeLevel: text('grade_level'),
    varianceCategory: varianceCategoryEnum('variance_category'),
    varianceAmount: numeric('variance_amount', { precision: 15, scale: 2 }),
    computedRate: numeric('computed_rate', { precision: 6, scale: 3 }),
    hasRateVariance: boolean('has_rate_variance').notNull().default(false),
    computedTotalLoan: numeric('computed_total_loan', { precision: 15, scale: 2 }),
    computedMonthlyDeduction: numeric('computed_monthly_deduction', { precision: 15, scale: 2 }),
    computedOutstandingBalance: numeric('computed_outstanding_balance', { precision: 15, scale: 2 }),
    loanId: uuid('loan_id').references(() => loans.id),
    isBaselineCreated: boolean('is_baseline_created').notNull().default(false),
    sourceFile: text('source_file').notNull(),
    sourceSheet: text('source_sheet').notNull(),
    sourceRow: integer('source_row').notNull(),
    // Supersession fields (Story 7.0g) — NULL = active (backward compatible)
    recordStatus: migrationRecordStatusEnum('status').default('active'),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
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
    index('idx_migration_records_status').on(table.recordStatus),
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

// ─── Person Matches (Story 3.3) ──────────────────────────────────────
// Cross-MDA person matching. Append-only — use status enum instead of soft delete.
export const personMatches = pgTable(
  'person_matches',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    personAName: text('person_a_name').notNull(),
    personAStaffId: text('person_a_staff_id'),
    personAMdaId: uuid('person_a_mda_id').notNull().references(() => mdas.id),
    personBName: text('person_b_name').notNull(),
    personBStaffId: text('person_b_staff_id'),
    personBMdaId: uuid('person_b_mda_id').notNull().references(() => mdas.id),
    matchType: matchTypeEnum('match_type').notNull(),
    confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
    status: matchStatusEnum('status').notNull().default('pending_review'),
    confirmedBy: uuid('confirmed_by').references(() => users.id),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_person_matches_person_a_mda_id').on(table.personAMdaId),
    index('idx_person_matches_person_b_mda_id').on(table.personBMdaId),
    index('idx_person_matches_status').on(table.status),
  ],
);

// ─── Observation Type Enum (Story 3.6) ──────────────────────────────
export const observationTypeEnum = pgEnum('observation_type', [
  'rate_variance', 'stalled_balance', 'negative_balance', 'multi_mda', 'no_approval_match', 'consecutive_loan', 'period_overlap', 'grade_tier_mismatch',
]);

// ─── Observation Status Enum (Story 3.6) ────────────────────────────
export const observationStatusEnum = pgEnum('observation_status', [
  'unreviewed', 'reviewed', 'resolved', 'promoted',
]);

// ─── Exception Priority Enum (Story 3.6) ────────────────────────────
export const exceptionPriorityEnum = pgEnum('exception_priority', [
  'high', 'medium', 'low',
]);

// ─── Exception Status Enum (Story 3.6) ──────────────────────────────
export const exceptionStatusEnum = pgEnum('exception_status', [
  'open', 'resolved',
]);

// ─── Observations (Story 3.6) ───────────────────────────────────────
export const observations = pgTable(
  'observations',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    type: observationTypeEnum('type').notNull(),
    staffName: varchar('staff_name', { length: 255 }).notNull(),
    staffId: varchar('staff_id', { length: 50 }),
    loanId: uuid('loan_id').references(() => loans.id),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    migrationRecordId: uuid('migration_record_id').references(() => migrationRecords.id),
    uploadId: uuid('upload_id').references(() => migrationUploads.id),
    description: text('description').notNull(),
    context: jsonb('context').notNull(),
    sourceReference: jsonb('source_reference'),
    status: observationStatusEnum('status').notNull().default('unreviewed'),
    reviewerId: uuid('reviewer_id').references(() => users.id),
    reviewerNote: text('reviewer_note'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    promotedExceptionId: uuid('promoted_exception_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_observations_type').on(table.type),
    index('idx_observations_mda_id').on(table.mdaId),
    index('idx_observations_status').on(table.status),
    index('idx_observations_staff_name').on(table.staffName),
    index('idx_observations_upload_id').on(table.uploadId),
    // NOTE: Only guards record-level observations. Person-level observations (migrationRecordId=NULL)
    // are guarded by application-level dedup in observationEngine.batchInsertObservations
    uniqueIndex('idx_observations_type_record').on(table.type, table.migrationRecordId),
  ],
);

// ─── Exceptions (Story 3.6) ─────────────────────────────────────────
// Lightweight exception queue for "Promote to Exception" handoff to Epic 7.
export const exceptions = pgTable(
  'exceptions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    observationId: uuid('observation_id').notNull().references(() => observations.id),
    staffName: varchar('staff_name', { length: 255 }).notNull(),
    staffId: varchar('staff_id', { length: 50 }),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    category: text('category').notNull(),
    description: text('description').notNull(),
    priority: exceptionPriorityEnum('priority').notNull().default('medium'),
    status: exceptionStatusEnum('status').notNull().default('open'),
    promotedBy: uuid('promoted_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_exceptions_observation_id').on(table.observationId),
    index('idx_exceptions_mda_id').on(table.mdaId),
    index('idx_exceptions_status').on(table.status),
  ],
);

// ─── Baseline Annotations (Story 7.0g) ─────────────────────────────
// Companion table for immutable ledger_entries. Append-only — no UPDATE, no DELETE.
// Records metadata about baseline entries without violating ledger immutability.
export const baselineAnnotations = pgTable(
  'baseline_annotations',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    ledgerEntryId: uuid('ledger_entry_id').notNull().references(() => ledgerEntries.id),
    annotationType: varchar('annotation_type', { length: 50 }).notNull(), // 'superseded' (extensible)
    note: text('note').notNull(),
    supersededUploadId: uuid('superseded_upload_id').references(() => migrationUploads.id),
    replacementUploadId: uuid('replacement_upload_id').references(() => migrationUploads.id),
    annotatedBy: uuid('annotated_by').notNull().references(() => users.id),
    annotatedAt: timestamp('annotated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_baseline_annotations_ledger_entry_id').on(table.ledgerEntryId),
  ],
);

// ─── Deduplication Candidate Status Enum (Story 3.8) ─────────────────
export const deduplicationCandidateStatusEnum = pgEnum('deduplication_candidate_status', [
  'pending', 'confirmed_multi_mda', 'reassigned', 'flagged',
]);

// ─── Deduplication Candidates (Story 3.8) ────────────────────────────
// Cross-file duplicate detection results between parent and sub-agency MDAs.
export const deduplicationCandidates = pgTable(
  'deduplication_candidates',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    parentMdaId: uuid('parent_mda_id').notNull().references(() => mdas.id),
    childMdaId: uuid('child_mda_id').notNull().references(() => mdas.id),
    staffName: varchar('staff_name', { length: 255 }).notNull(),
    staffId: varchar('staff_id', { length: 50 }),
    parentRecordCount: integer('parent_record_count').notNull(),
    childRecordCount: integer('child_record_count').notNull(),
    matchConfidence: numeric('match_confidence', { precision: 3, scale: 2 }).notNull(),
    matchType: text('match_type').notNull(), // 'exact_name' | 'surname_initial' | 'fuzzy_name' | 'staff_id'
    status: deduplicationCandidateStatusEnum('status').notNull().default('pending'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolutionNote: text('resolution_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_dedup_parent_mda').on(table.parentMdaId),
    index('idx_dedup_child_mda').on(table.childMdaId),
    index('idx_dedup_status').on(table.status),
    index('idx_dedup_staff_name').on(table.staffName),
    uniqueIndex('idx_dedup_unique_candidate').on(table.parentMdaId, table.childMdaId, table.staffName),
  ],
);

// ─── Submission Record Status Enum (Story 5.1) ───────────────────
export const submissionRecordStatusEnum = pgEnum('submission_record_status', [
  'processing', 'confirmed', 'rejected',
]);

// ─── Event Flag Type Enum (Story 5.1, extended Story 11.2b) ──────
export const eventFlagTypeEnum = pgEnum('event_flag_type', [
  'NONE', 'RETIREMENT', 'DEATH', 'SUSPENSION', 'TRANSFER_OUT',
  'TRANSFER_IN', 'LEAVE_WITHOUT_PAY', 'REINSTATEMENT',
  // DEPRECATED: Retained for PostgreSQL enum compatibility only. Application-level exclusion in EVENT_FLAG_VALUES.
  // Migrated to DISMISSAL in Story 11.2b. DO NOT use in business logic.
  'TERMINATION',
  'ABSCONDED', 'SERVICE_EXTENSION', 'DISMISSAL',
]);

// ─── MDA Submissions (Story 5.1, extended Story 5.2) ─────────────
// Submission header — one row per CSV upload or manual entry batch.
export const mdaSubmissions = pgTable(
  'mda_submissions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
    period: varchar('period', { length: 7 }).notNull(), // YYYY-MM
    referenceNumber: varchar('reference_number', { length: 50 }).notNull().unique(),
    status: submissionRecordStatusEnum('status').notNull().default('processing'),
    recordCount: integer('record_count').notNull(),
    source: varchar('source', { length: 10 }).notNull().default('csv'), // 'csv' | 'manual' | 'historical' | 'payroll'
    filename: varchar('filename', { length: 500 }),
    fileSizeBytes: integer('file_size_bytes'),
    validationErrors: jsonb('validation_errors'),
    alignedCount: integer('aligned_count').notNull().default(0),
    varianceCount: integer('variance_count').notNull().default(0),
    reconciliationSummary: jsonb('reconciliation_summary'), // Story 11.3: { matched, dateDiscrepancy, unconfirmed, newCsvEvent }
    historicalReconciliation: jsonb('historical_reconciliation'), // Story 11.4: { matchedCount, varianceCount, largestVarianceAmount, matchRate, noBaseline, flaggedRows }
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_mda_submissions_mda_id').on(table.mdaId),
    index('idx_mda_submissions_period').on(table.period),
    uniqueIndex('idx_mda_submissions_reference').on(table.referenceNumber),
  ],
);

// ─── Submission Rows (Story 5.1) ─────────────────────────────────
// Individual CSV rows — one row per CSV data row.
export const submissionRows = pgTable(
  'submission_rows',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    submissionId: uuid('submission_id').notNull().references(() => mdaSubmissions.id),
    rowNumber: integer('row_number').notNull(),
    staffId: varchar('staff_id', { length: 50 }).notNull(),
    month: varchar('month', { length: 7 }).notNull(), // YYYY-MM
    amountDeducted: numeric('amount_deducted', { precision: 15, scale: 2 }).notNull(),
    payrollBatchReference: varchar('payroll_batch_reference', { length: 100 }).notNull(),
    mdaCode: varchar('mda_code', { length: 50 }).notNull(),
    eventFlag: eventFlagTypeEnum('event_flag').notNull(),
    eventDate: date('event_date', { mode: 'date' }),
    cessationReason: varchar('cessation_reason', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_submission_rows_submission_id').on(table.submissionId),
    index('idx_submission_rows_staff_id').on(table.staffId),
    index('idx_submission_rows_month').on(table.month),
    index('idx_submission_rows_staff_month').on(table.staffId, table.month), // Story 11.4: efficient duplicate detection
  ],
);

// ─── Scheme Config (Story 4.1) ───────────────────────────────────
// Lightweight key-value configuration table for scheme-level settings.
// First entry: key = 'scheme_fund_total'. AG populates when committee confirms.
export const schemeConfig = pgTable(
  'scheme_config',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    key: varchar('key', { length: 100 }).notNull().unique(),
    value: text('value'),
    description: text('description'),
    updatedBy: uuid('updated_by').references(() => users.id),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

// ─── Employment Events (Story 11.2) ─────────────────────────────────
export const employmentEvents = pgTable(
  'employment_events',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    staffId: varchar('staff_id', { length: 50 }).notNull(),
    loanId: uuid('loan_id').references(() => loans.id),
    mdaId: uuid('mda_id').notNull().references(() => mdas.id),
    eventType: employmentEventTypeEnum('event_type').notNull(),
    effectiveDate: date('effective_date', { mode: 'date' }).notNull(),
    referenceNumber: varchar('reference_number', { length: 255 }),
    notes: text('notes'),
    newRetirementDate: date('new_retirement_date', { mode: 'date' }),
    reconciliationStatus: reconciliationStatusEnum('reconciliation_status').notNull().default('UNCONFIRMED'),
    filedBy: uuid('filed_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_employment_events_staff_id').on(table.staffId),
    index('idx_employment_events_mda_id').on(table.mdaId),
    index('idx_employment_events_reconciliation_status').on(table.reconciliationStatus),
    index('idx_employment_events_created_at').on(table.createdAt),
    index('idx_employment_events_staff_id_event_type').on(table.staffId, table.eventType), // Story 11.3: composite index for reconciliation matching
  ],
);

// ─── Transfers (Story 11.2) ─────────────────────────────────────────
export const transfers = pgTable(
  'transfers',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
    staffId: varchar('staff_id', { length: 50 }).notNull(),
    loanId: uuid('loan_id').notNull().references(() => loans.id),
    outgoingMdaId: uuid('outgoing_mda_id').notNull().references(() => mdas.id),
    incomingMdaId: uuid('incoming_mda_id').references(() => mdas.id),
    outgoingEventId: uuid('outgoing_event_id').references(() => employmentEvents.id),
    incomingEventId: uuid('incoming_event_id').references(() => employmentEvents.id),
    outgoingConfirmed: boolean('outgoing_confirmed').notNull().default(false),
    incomingConfirmed: boolean('incoming_confirmed').notNull().default(false),
    confirmedBy: uuid('confirmed_by').references(() => users.id),
    status: transferStatusEnum('status').notNull().default('PENDING'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_transfers_staff_id').on(table.staffId),
    index('idx_transfers_status').on(table.status),
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
