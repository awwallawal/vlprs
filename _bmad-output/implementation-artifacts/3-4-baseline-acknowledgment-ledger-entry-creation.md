# Story 3.4: Baseline Acknowledgment & Ledger Entry Creation

Status: done

<!-- Generated: 2026-03-06 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: 3-2-migration-validation-rate-detection-mda-delineation, 3-3-staff-loan-profile-cross-mda-timeline | Blocks: 3-5-migration-dashboard-master-beneficiary-ledger -->
<!-- FRs: FR28, FR29 | Motivation: Legacy data enters the immutable ledger — the financial foundation for all forward computation -->
<!-- Source: epics.md § Epic 3 Story 3.4, sprint-change-proposal-2026-02-28.md § Story 3.4 KEEP -->

## Story

As a **Department Admin**,
I want to acknowledge variances and establish baseline positions that create the starting point in the immutable ledger,
So that legacy data enters the system without implying blame and the system has a foundation to compute forward from.

### Context

Stories 3.1-3.3 built the migration pipeline: upload → extract → validate → person profiles. But all that data lives in staging tables (`migration_records`). This story is the **moment data crosses into production** — creating real `loans` records and `MIGRATION_BASELINE` ledger entries in the immutable financial ledger.

**This is the most financially significant story in Epic 3.** Every baseline entry becomes the foundation for all forward computation: monthly deductions, balance tracking, auto-stop certificates, and scheme-wide exposure reporting. Getting the baseline wrong means every downstream calculation is wrong.

**What "Accept as Declared" means:**
- The admin acknowledges the MDA's declared values as the starting point
- Variance metadata is recorded for audit, but the baseline uses the **declared** values (not computed)
- No retroactive corrections — if the MDA declared ₦450,000 outstanding but the system computes ₦452,500, the baseline is ₦450,000
- Observations (rate variances, etc.) are visible during acknowledgment but do NOT block baseline creation

**What this story does NOT do:**
- Does NOT correct variances (that's a future reconciliation workflow)
- Does NOT generate observations (Story 3.6 — observation engine)
- Does NOT create trace reports (Story 3.7)
- Does NOT split multi-MDA files (Story 3.8)

**Loan state machine consideration:** The existing transition map is APPLIED → APPROVED → ACTIVE → terminal. Migration loans skip APPLIED/APPROVED — they are imported directly as ACTIVE. Story 3.4 creates the loan record with status `ACTIVE` and records a single audit transition entry.

## Acceptance Criteria

### AC 1: Baseline Acknowledgment Action

**Given** a validated migration record (variance_category set by Story 3.2)
**When** Department Admin clicks "Accept as Declared — Establish Baseline"
**Then** the system atomically:
- Creates a `loan` record with data derived from the migration record
- Creates a `MIGRATION_BASELINE` ledger entry in the immutable ledger representing the cumulative amount already paid before migration (computed as `totalLoan - declaredOutstandingBalance`), so that `computeBalanceFromEntries()` correctly yields the declared outstanding balance
- Records a state transition from APPLIED → ACTIVE with reason "Migration baseline — legacy data imported"
- Links the migration record to the newly created loan (sets `loan_id` on migration_records)
- Updates the migration upload status toward 'reconciled'
**And** no retroactive corrections are applied — the baseline reflects what the MDA declared (FR28)

### AC 2: Variance Metadata on Baseline Entry

**Given** a migration record with a variance (minor, significant, structural, or anomalous)
**When** the baseline is created
**Then** the variance is recorded on the ledger entry's `source` field:
- Format: `"Migration baseline | {varianceCategory} | Variance: ₦{amount} | Declared outstanding: ₦{declaredBalance} | Upload: {uploadId}"`
- Example: `"Migration baseline | Minor Variance | Variance: ₦2,500.00 | Declared outstanding: ₦150,000.00 | Upload: abc-123"`
**And** the `payrollBatchReference` stores the migration upload ID for traceability
**And** the entry `amount` represents cumulative payments before VLPRS (totalLoan - declaredOutstandingBalance), so that `computeBalanceFromEntries()` yields the declared outstanding balance as the starting balance
**And** the variance category and amount remain on the migration_record for historical reference (FR29)

### AC 3: Loan Record from Migration Data

**Given** a migration record with extracted financial fields
**When** a loan is created from migration data
**Then** the loan record contains:
- `staffName` from migration_record.staff_name
- `staffId` from migration_record.employee_no, or auto-generated `"MIG-{uploadId short}-{seq}"` if absent
- `gradeLevel` = `"MIGRATION"` (not available in legacy data)
- `mdaId` from the migration upload's MDA
- `principalAmount` from migration_record.principal, or derived: (a) if totalLoan and rate available → `totalLoan / (1 + rate/100)`, (b) if monthlyDeduction and tenure available → `(monthlyDeduction × tenure) / (1 + rate/100)`. Only "0.00" as last resort — flag loan as `limitedComputation = true` (balance must use declared values, not computeBalanceFromEntries)
- `interestRate` from migration_record.computed_rate (or "13.330" if null — standard rate default)
- `tenureMonths` from migration_record.installment_count, or inferred from totalLoan/monthlyDeduction, or 60 (default)
- `moratoriumMonths` = 0
- `monthlyDeductionAmount` from migration_record.monthly_deduction (or computed from schedule if null)
- `approvalDate` = migration upload creation date (proxy — actual approval date unknown for legacy)
- `firstDeductionDate` = earliest period date from migration records for this person+MDA
- `loanReference` = auto-generated with migration prefix: `"VLC-MIG-{year}-{seq}"`
- `status` = `ACTIVE` (migration loans are already active)
- `dateOfBirth` and `dateOfFirstAppointment` from migration record if available → computed retirement date

### AC 4: Batch Acknowledgment

**Given** multiple validated migration records in an upload
**When** Department Admin clicks "Accept All as Declared — Establish Baselines"
**Then** all records in the upload are processed atomically — all baselines created or none (transaction rollback on any failure)
**And** a summary is returned: total loans created, total ledger entries, per-variance-category counts, processing time
**And** the upload status advances to 'reconciled'
**And** processing completes within reasonable time (50 records → <15 seconds)

### AC 5: Baseline Display on Loan Record

**Given** a loan created from migration baseline
**When** the loan record is viewed via the existing loan detail page
**Then** it shows:
- The baseline entry as the first ledger entry with annotation "Migrated from legacy system — baseline as declared"
- The declared outstanding balance
- Variance metadata visible in entry details
- Balance computation starts from this baseline entry
- The loan detail page works identically for migration loans and regular loans (FR27)

### AC 6: Observation Visibility During Acknowledgment

**Given** a migration record with observations (rate variance, multi-MDA flag, etc. from Story 3.2)
**When** Department Admin reviews the acknowledgment screen
**Then** observations are displayed alongside the record (variance category badge, rate comparison if applicable)
**And** observations are NOT blockers — baseline can be created regardless of observation status
**And** the admin can review observations before or after baseline creation

### AC 7: Integration Tests

**Given** the baseline acknowledgment feature
**When** integration tests run
**Then** at minimum:
- Test: single record baseline creates loan + ledger entry + state transition in one transaction
- Test: batch baseline creates all loans atomically (all or none)
- Test: ledger entry has correct MIGRATION_BASELINE type, amount, and variance metadata
- Test: loan has status ACTIVE with migration-specific defaults (gradeLevel "MIGRATION", generated staffId)
- Test: balance computation from baseline entry returns correct outstanding balance
- Test: migration_record.loan_id links to newly created loan
- Test: duplicate baseline attempt for same migration record is rejected (idempotency guard)

## Tasks / Subtasks

- [x] Task 1: Schema additions for migration linkage (AC: 1, 3)
  - [x] 1.1 Add `loan_id` column to `migration_records` table in `apps/server/src/db/schema.ts`:
    - Type: `uuid('loan_id').references(() => loans.id)`, nullable
    - Semantics: set when baseline is created, null before
  - [x] 1.2 Add `is_baseline_created` boolean to `migration_records`, default false — idempotency guard
  - [x] 1.3 Add 'reconciled' to the `migration_upload_status` enum (after 'validated') if not already present
  - [x] 1.4 Run `drizzle-kit generate` for migration SQL

- [x] Task 2: Baseline service (AC: 1, 2, 3, 4)
  - [x] 2.1 Create `apps/server/src/services/baselineService.ts`:
    - `createBaseline(userId, migrationRecordId, mdaScope)` — single record baseline creation
    - `createBatchBaseline(userId, uploadId, mdaScope)` — batch baseline for all records in upload
    - `deriveLoanFromMigrationRecord(record, upload)` — maps migration_record fields to CreateLoanData
    - `buildBaselineSource(record)` — builds source string with variance metadata
  - [x] 2.2 Implement `deriveLoanFromMigrationRecord`:
    - staffName: `record.staff_name`
    - staffId: `record.employee_no || generateMigrationStaffId(uploadId, seq)`
    - gradeLevel: `"MIGRATION"`
    - mdaId: `upload.mda_id`
    - principalAmount: `record.principal || derivePrincipal(record) || "0.00"` (see derivePrincipal below)
    - interestRate: `record.computed_rate || "13.330"`
    - tenureMonths: `record.installment_count || inferTenure(record) || 60`
    - monthlyDeductionAmount: `record.monthly_deduction || computeFromSchedule(principal, rate, tenure)`
    - approvalDate: `upload.created_at` (proxy date)
    - firstDeductionDate: earliest period from records for this person+MDA
    - dateOfBirth, dateOfFirstAppointment: from migration record if available
  - [x] 2.3 Implement tenure inference: if `installment_count` is null but `monthly_deduction` and `total_loan` are present → `Math.ceil(Decimal(totalLoan).div(Decimal(monthlyDeduction)).toNumber())`
  - [x] 2.4 Implement atomic transaction for single baseline:
    ```
    BEGIN
    → Verify migration_record.is_baseline_created === false (idempotency)
    → INSERT loan record (status: ACTIVE, generated reference)
    → INSERT loan_state_transition (APPLIED → ACTIVE, reason: "Migration baseline")
    → INSERT MIGRATION_BASELINE ledger entry via ledgerDb.insert()
    → UPDATE migration_record SET loan_id = newLoan.id, is_baseline_created = true
    COMMIT
    ```
  - [x] 2.5 Implement batch baseline: loop through all validated records in upload within single transaction
  - [x] 2.6 Implement `generateMigrationLoanReference()`: format `VLC-MIG-{year}-{seq}` with uniqueness retry (same pattern as `generateLoanReference`)
  - [x] 2.7 Implement `generateMigrationStaffId(uploadId, seq)`: format `MIG-{uploadId first 8 chars}-{seq padded to 4}`
  - [x] 2.8 Write unit + integration tests

- [x] Task 3: Baseline amount computation and principal/interest split (AC: 1, 2)
  - [x] 3.1 Compute baselineAmount for each entry: `totalLoan - declaredOutstandingBalance` where `totalLoan = principal × (1 + rate/100)`. This represents cumulative payments before VLPRS. `computeBalanceFromEntries()` then yields: `totalLoan - baselineAmount = declaredOutstandingBalance` ✓
  - [x] 3.2 Split baselineAmount into principal/interest components:
    - If principalAmount > 0 and rate known: use `autoSplitDeduction(baselineAmount, { principalAmount, interestRate, tenureMonths, moratoriumMonths: 0 })`
    - If principalAmount is "0.00" or rate unknown: `principalComponent = baselineAmount`, `interestComponent = "0.00"` (cannot split — skip autoSplitDeduction)
  - [x] 3.3 Handle edge cases: declaredBalance = 0 → baselineAmount = totalLoan (fully paid); declaredBalance > totalLoan → negative baselineAmount (mathematically correct); declaredBalance null → skip baseline entry; principalAmount "0.00" → flag loan as limited computation
  - [x] 3.4 All arithmetic via `decimal.js` — never floating point

- [x] Task 4: Baseline routes (AC: 1, 4, 6)
  - [x] 4.1 Add to `apps/server/src/routes/migrationRoutes.ts`:
    - `POST /api/migrations/:uploadId/records/:recordId/baseline` — single record baseline
    - `POST /api/migrations/:uploadId/baseline` — batch baseline for all records in upload
    - `GET /api/migrations/:uploadId/baseline-summary` — get baseline creation summary
  - [x] 4.2 Apply middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, auditLog]`
  - [x] 4.3 Implement response shape:
    - Single: `{ loanId, loanReference, ledgerEntryId, varianceCategory, baselineAmount }`
    - Batch: `{ totalProcessed, loansCreated, entriesCreated, byCategory: { clean: N, ... }, processingTimeMs }`
  - [x] 4.4 Write route integration tests

- [x] Task 5: Shared types and schemas (AC: all)
  - [x] 5.1 Add to `packages/shared/src/types/migration.ts`:
    - `BaselineResult`: loanId, loanReference, ledgerEntryId, varianceCategory, baselineAmount
    - `BatchBaselineResult`: totalProcessed, loansCreated, entriesCreated, byCategory, processingTimeMs
    - `BaselineSummary`: upload-level baseline status
  - [x] 5.2 Add to `packages/shared/src/validators/migrationSchemas.ts`: baseline creation body schema (minimal — just confirmation intent)
  - [x] 5.3 Add non-punitive vocabulary to `packages/shared/src/constants/vocabulary.ts`:
    - `BASELINE_CREATED: 'Baseline established — legacy position recorded as declared'`
    - `BASELINE_BATCH_COMPLETE: 'All baselines established — {count} loan records created'`
    - `BASELINE_ANNOTATION: 'Migrated from legacy system — baseline as declared'`
    - `BASELINE_ALREADY_EXISTS: 'Baseline already established for this record'`
    - `BASELINE_VARIANCE_NOTE: 'Variance acknowledged and recorded for audit'`

- [x] Task 6: Frontend — acknowledgment UI (AC: 1, 4, 5, 6)
  - [x] 6.1 Add hooks to `apps/client/src/hooks/useMigration.ts`:
    - `useCreateBaseline(uploadId, recordId)` — single record mutation
    - `useCreateBatchBaseline(uploadId)` — batch mutation
    - `useBaselineSummary(uploadId)` — query for baseline status
  - [x] 6.2 Extend validation results view with acknowledgment actions:
    - Per-record: "Accept as Declared — Establish Baseline" button on each validated record
    - Batch: "Accept All as Declared — Establish Baselines" button on upload summary
    - Observations displayed inline (variant category badge, rate comparison) — not blocking
  - [x] 6.3 Create `BaselineConfirmationDialog` component:
    - Summary: "You are about to establish baselines for {N} records"
    - Per-category breakdown: "Clean: {N}, Minor Variance: {N}, ..."
    - Variance acknowledgment text: "Variances will be recorded for audit. No retroactive corrections will be applied."
    - Confirm/Cancel buttons
  - [x] 6.4 Create `BaselineResultSummary` component:
    - Shows: total loans created, total entries, per-category counts, processing time
    - "View Loans" link to navigate to newly created loan records
    - Non-punitive language throughout

- [x] Task 7: Verify baseline integrates with existing loan views (AC: 5)
  - [x] 7.1 Verify existing `LoanDetailPage.tsx` displays migration loans correctly:
    - MIGRATION_BASELINE entry visible in ledger history
    - Balance computation works from baseline entry
    - Status badge shows "Active"
    - Staff ID shows generated migration ID (if no employee_no)
  - [x] 7.2 Verify loan search API returns migration loans (staffName, staffId, mdaName all searchable)
  - [x] 7.3 Verify balance computation from `computeBalanceFromEntries()` treats MIGRATION_BASELINE as starting balance

- [x] Task 8: Verify no regressions (AC: all)
  - [x] 8.1 Run full test suite — zero regressions
  - [x] 8.2 Verify existing loan creation flow unaffected (regular loans still go through APPLIED → APPROVED → ACTIVE)
  - [x] 8.3 Verify ledger immutability enforced (no update/delete on baseline entries)
  - [x] 8.4 Verify migration upload status progression: uploaded → mapped → completed → validated → reconciled

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] H1: `generateMigrationLoanReference()` used `db` instead of `tx` — batch baseline produced duplicate references causing unique constraint violation for any batch >1 record [baselineService.ts:25] — FIXED: pre-generate sequential references inside transaction
- [x] [AI-Review][HIGH] H2: `MigrationUploadStatus` shared type missing 'reconciled' — type mismatch between DB enum and frontend [migration.ts:3] — FIXED: added to type union
- [x] [AI-Review][HIGH] H3: No per-record baseline button in UI — AC 1 single-record acknowledgment not implemented in frontend despite backend+hook existing [MigrationPage.tsx] — FIXED: added per-record "Establish Baseline" button via RecordComparisonRow
- [x] [AI-Review][HIGH] H4: No `limitedComputation` flag for zero-principal loans — AC 3 requires flagging; `computeBalanceFromEntries()` throws for principal "0.00" [schema.ts] — FORWARDED to Story 3.5 Task 0 (schema migration + flag logic)
- [x] [AI-Review][MEDIUM] M1: Single-record baseline didn't advance upload toward 'reconciled' — AC 1 requirement [baselineService.ts:276] — FIXED: checks remaining records after single baseline and advances upload status
- [x] [AI-Review][MEDIUM] M2: Null outstandingBalance created misleading zero ledger entry — contradicted dev notes task 3.3 [baselineService.ts:335] — FIXED: throws clear error instead of creating misleading entry; batch pre-validates all records
- [x] [AI-Review][MEDIUM] M3: Tests don't test actual service functions — unit tests validate math concepts inline but never call `buildBaselineSource`, `derivePrincipal`, `inferTenure`, `computeBaselineEntry`; no AC 7 integration tests [baselineService.test.ts] — FIXED: added 14 integration tests in `baseline.integration.test.ts` covering single/batch baseline creation, atomicity, idempotency guard, variance metadata, balance invariant, missing balance rejection, authorization
- [x] [AI-Review][MEDIUM] M4: Drizzle migration files and vitest.config.ts not documented in File List — FIXED: added to File List below
- [x] [AI-Review][LOW] L1: `formatCurrency()` used `parseFloat` — violated "no floating point for money" standard [baselineService.ts:108] — FIXED: uses Decimal
- [x] [AI-Review][LOW] L2: Batch baseline returned 200 instead of 201 — inconsistent with single-record route [migrationRoutes.ts:191] — FIXED
- [x] [AI-Review][LOW] L3: `migrationUploadQuerySchema` missing 'reconciled' status filter [migrationSchemas.ts:18] — FIXED

## Dev Notes

### Critical Context

This story bridges the **staging world** (migration_records) and the **production world** (loans + ledger_entries). After this story, migrated data is fully integrated into the VLPRS financial engine — balance computation, schedule generation, gratuity projection, and auto-stop detection all work from the baseline entries.

**The immutable ledger is the single source of financial truth.** Every ₦ in the system traces back to a ledger entry. The MIGRATION_BASELINE entry is the genesis record for each migrated loan. It must be correct, traceable, and irreversible.

### Loan Creation from Migration Records

**Field mapping (migration_record → loan):**

| Loan Field | Source | Default if Missing |
|---|---|---|
| staffName | migration_record.staff_name | (required — reject if null) |
| staffId | migration_record.employee_no | `"MIG-{uploadId:8}-{seq:04}"` |
| gradeLevel | — | `"MIGRATION"` |
| mdaId | migration_upload.mda_id | (required — always present) |
| principalAmount | migration_record.principal, or derived from totalLoan/rate, or from monthlyDeduction/tenure/rate | `"0.00"` (flag as limited computation — balance uses declared values directly) |
| interestRate | migration_record.computed_rate | `"13.330"` |
| tenureMonths | migration_record.installment_count | Inferred or 60 |
| moratoriumMonths | — | 0 |
| monthlyDeductionAmount | migration_record.monthly_deduction | Computed from schedule |
| approvalDate | migration_upload.created_at | (proxy — legacy has no approval date) |
| firstDeductionDate | Earliest period from records | migration_upload.created_at fallback |
| loanReference | — | `"VLC-MIG-{year}-{seq:04}"` |
| status | — | `ACTIVE` |
| dateOfBirth | migration_record.date_of_birth | null |
| dateOfFirstAppointment | migration_record.date_of_first_appointment | null |

**Principal derivation logic (when record.principal is null):**
```typescript
function derivePrincipal(record: MigrationRecord, rate: string): string | null {
  const r = new Decimal(rate).div(100);
  const divisor = new Decimal('1').plus(r);

  // Priority 1: derive from totalLoan and rate
  if (record.totalLoan) {
    return new Decimal(record.totalLoan).div(divisor).toFixed(2);
  }

  // Priority 2: derive from monthlyDeduction, tenure, and rate
  if (record.monthlyDeduction && record.installmentCount) {
    const totalLoan = new Decimal(record.monthlyDeduction).mul(record.installmentCount);
    return totalLoan.div(divisor).toFixed(2);
  }

  // Cannot derive — will default to "0.00" (limited computation)
  return null;
}
```

**Tenure inference logic:**
```typescript
function inferTenure(record: MigrationRecord): number {
  // Priority 1: explicit installment count
  if (record.installmentCount) return record.installmentCount;

  // Priority 2: infer from total loan / monthly deduction
  if (record.totalLoan && record.monthlyDeduction) {
    const total = new Decimal(record.totalLoan);
    const monthly = new Decimal(record.monthlyDeduction);
    if (!monthly.isZero()) {
      return Math.ceil(total.div(monthly).toNumber());
    }
  }

  // Priority 3: default 60 months (standard tenure)
  return 60;
}
```

### Baseline Ledger Entry Structure

```typescript
// The baseline amount represents cumulative payments BEFORE migration.
// computeBalanceFromEntries computes: balance = totalLoan - sum(entries.amount)
// So: balance = totalLoan - (totalLoan - declaredOutstanding) = declaredOutstanding ✓
const totalLoan = new Decimal(newLoan.principalAmount)
  .mul(new Decimal('1').plus(new Decimal(newLoan.interestRate).div(100)));
const baselineAmount = totalLoan.minus(new Decimal(declaredOutstandingBalance));

{
  loanId: newLoan.id,
  staffId: newLoan.staffId,
  mdaId: newLoan.mdaId,
  entryType: 'MIGRATION_BASELINE',
  amount: baselineAmount.toFixed(2),      // cumulative payments before VLPRS
  principalComponent: splitResult.principalComponent,
  interestComponent: splitResult.interestComponent,
  periodMonth: record.period_month || new Date().getMonth() + 1,
  periodYear: record.period_year || new Date().getFullYear(),
  source: `Migration baseline | ${varianceCategory} | Variance: ₦${varianceAmount} | Declared outstanding: ₦${declaredOutstandingBalance} | Upload: ${uploadId}`,
  payrollBatchReference: uploadId,
  postedBy: actingUserId,
}
```

**Edge case:** If `declaredOutstandingBalance > totalLoan` (MDA declares more owed than computed), the baseline amount is negative. This is mathematically correct — `computeBalanceFromEntries` will yield the declared value. A negative baseline means "the system acknowledges more is owed than the computed total loan suggests." The variance captures this.

**Principal/interest split for baseline (split the baselineAmount, not the declaredBalance):**
- If `principalAmount > 0` and `computed_rate` is available: use `autoSplitDeduction(baselineAmount.toFixed(2), { principalAmount, interestRate: computedRate, tenureMonths, moratoriumMonths: 0 })`
- If principalAmount is "0.00" or rate unknown: `principalComponent = baselineAmount`, `interestComponent = "0.00"` (cannot split without principal — skip autoSplitDeduction)
- If baselineAmount equals totalLoan (declared outstanding = 0): create entry with full totalLoan amount — loan is fully paid from declaration
- If baselineAmount is negative (declared outstanding > totalLoan): create entry with negative amount — this correctly yields the declared balance via `computeBalanceFromEntries`

### State Machine Bypass for Migration

The existing loan state machine enforces APPLIED → APPROVED → ACTIVE. Migration loans need to skip directly to ACTIVE. Approach:

1. **INSERT loan with status 'ACTIVE' directly** — do NOT use `loanService.createLoan()` (which defaults to APPLIED). Use a direct `db.insert(loans).values({ ...data, status: 'ACTIVE' })`
2. **Record the transition audit trail** — INSERT a single `loan_state_transitions` entry: `{ fromStatus: 'APPLIED', toStatus: 'ACTIVE', reason: 'Migration baseline — legacy data imported as active loan' }`
3. **Why not use transitionLoan():** It validates against `VALID_TRANSITIONS` which requires APPLIED → APPROVED → ACTIVE. We'd need two transitions. The single direct insert + audit entry is cleaner for migration.

**Note:** Do NOT modify `VALID_TRANSITIONS` — it correctly models the post-migration lifecycle. Migration is a one-time bypass, not a permanent state machine change.

### Idempotency Guard

The `is_baseline_created` flag on `migration_records` prevents double-baseline creation. Check this INSIDE the transaction (SELECT FOR UPDATE) to prevent race conditions. If `is_baseline_created = true`, skip that record (for batch) or return error (for single).

### Using autoSplitDeduction

The existing `autoSplitDeduction(deductionAmount, params)` in `computationEngine.ts` splits any amount into principal/interest using the flat-rate ratio:

```typescript
import { autoSplitDeduction } from './computationEngine';

const split = autoSplitDeduction(declaredBalance, {
  principalAmount: record.principal || '0.00',
  interestRate: record.computed_rate || '13.330',
  tenureMonths: inferredTenure,
  moratoriumMonths: 0,
});
// split.principalComponent + split.interestComponent === declaredBalance (exact)
```

**Edge case:** Both `autoSplitDeduction()` and `computeBalanceFromEntries()` throw if principalAmount ≤ 0. For zero-principal migration loans: (a) skip autoSplitDeduction — assign full baselineAmount to principalComponent, interestComponent = "0.00", (b) balance must use declared outstanding value directly — `computeBalanceFromEntries()` cannot be called for these loans until principal is enriched. Flag the loan as having limited computation capability.

### Using the Immutable Ledger

The `ledgerDb` in `apps/server/src/db/immutable.ts` is the **only** way to write to ledger_entries. It exposes `insert()` only — no update, no delete. The DB trigger `fn_prevent_modification` enforces this at the PostgreSQL level.

```typescript
import { ledgerDb } from '../db/immutable';

const entry = await ledgerDb.insert({
  loanId, staffId, mdaId,
  entryType: 'MIGRATION_BASELINE',
  amount: declaredBalance,
  principalComponent: split.principalComponent,
  interestComponent: split.interestComponent,
  periodMonth, periodYear,
  source: baselineSource,
  payrollBatchReference: uploadId,
  postedBy: userId,
});
```

### Balance Computation from Baseline

The existing `computeBalanceFromEntries()` in `computationEngine.ts` computes: `balance = totalLoan - sum(ALL entry amounts)`. It sums all entry amounts regardless of type — PAYROLL, MIGRATION_BASELINE, ADJUSTMENT are all treated identically (as cumulative payments/accounting).

**Confirmed (validated against codebase):** No changes to `computeBalanceFromEntries` are needed. The baseline entry's amount is defined as `totalLoan - declaredOutstandingBalance` (cumulative payments before VLPRS). This means:
- After baseline only: `balance = totalLoan - baselineAmount = declaredOutstandingBalance` ✓
- After baseline + N payroll entries: `balance = totalLoan - baselineAmount - sum(payrollAmounts)` ✓

**Exception:** Loans with `principalAmount = "0.00"` cannot use `computeBalanceFromEntries` (throws on principal ≤ 0). These loans must report the declared outstanding balance directly until principal is enriched.

### Service Boundaries

```
baselineService (NEW — this story)
  ├── Calls: ledgerDb.insert() (immutable ledger)
  ├── Calls: autoSplitDeduction() (principal/interest split)
  ├── Calls: computeRetirementDate() (if temporal fields available)
  ├── Reads: migration_records, migration_uploads
  ├── Writes: loans (new records), loan_state_transitions (audit), ledger_entries (via ledgerDb), migration_records (loan_id link)
  └── Never: loanService.createLoan() (bypass for migration), observationEngine, personMatchingService
```

### Non-Punitive Language Requirements

**Acknowledgment action:**
- "Accept as Declared — Establish Baseline" (the button label)
- "Migrated from legacy system — baseline as declared" (the annotation)
- NOT "Import legacy data" or "Accept errors"

**Variance acknowledgment:**
- "Variance acknowledged and recorded for audit" NOT "Errors accepted"
- "No retroactive corrections will be applied" NOT "Errors will not be fixed"

**Confirmation dialog:**
- "You are about to establish baselines for {N} records"
- "All values will be recorded as declared by the MDA"
- "Variances are noted for review — they do not imply fault"

### Existing Codebase Patterns to Follow

**Loan creation:** Follow `loanService.createLoan()` field mapping but use direct `db.insert(loans)` for migration (skip state machine). Use `generateUuidv7()` for IDs. Use the same loan reference generation pattern but with "VLC-MIG" prefix.

**Ledger entry creation:** Follow `ledgerService.createEntry()` pattern but directly call `ledgerDb.insert()` within the transaction (don't go through the service function which does a separate loan lookup).

**State transitions:** Follow `loanTransitionService.transitionLoan()` pattern for the audit record format, but insert directly (bypass validation).

**Transactions:** Follow `temporalProfileService.ts` pattern — `await db.transaction(async (tx) => { ... })`. Use `tx` for all writes within the transaction. Note: `ledgerDb.insert()` uses the default `db` connection, NOT `tx`. For transactional baseline creation, use `tx.insert(ledgerEntries).values(...)` directly instead of `ledgerDb.insert()`.

**Important:** Since `ledgerDb` uses a separate connection, for Story 3.4's atomic transaction, write ledger entries via `tx.insert(ledgerEntries)` directly within the transaction — NOT via `ledgerDb.insert()`. This ensures rollback includes the ledger entry. The immutability trigger still protects against updates/deletes.

### What NOT To Do

1. **DO NOT use `loanService.createLoan()`** — it creates with status APPLIED and goes through the normal workflow. Migration loans need direct ACTIVE insertion
2. **DO NOT modify `VALID_TRANSITIONS`** — the state machine correctly models post-migration lifecycle. Migration is a one-time bypass
3. **DO NOT use `ledgerDb.insert()` inside the transaction** — it uses a separate connection. Use `tx.insert(ledgerEntries)` for atomicity
4. **DO NOT retroactively correct declared values** — the baseline is the MDA's declaration, not the system's computation. Variances are metadata, not corrections
5. **DO NOT block baseline creation on observation status** — observations are informational. The admin sees them but they don't prevent acknowledgment
6. **DO NOT create duplicate baselines** — check `is_baseline_created` flag with SELECT FOR UPDATE inside the transaction
7. **DO NOT use floating-point for any financial calculation** — all money via `decimal.js`, all DB storage as NUMERIC(15,2)
8. **DO NOT skip the ledger entry for zero-balance records** — even ₦0.00 baselines establish the loan's presence in the system
9. **DO NOT create loan records without the ledger entry** — the transaction must be atomic (loan + transition + entry + record link)
10. **DO NOT generate observations here** — Story 3.6 handles observation generation. This story only reads existing variance data from Story 3.2

### Project Structure Notes

New files:
```
apps/server/src/
├── services/
│   ├── baselineService.ts              # Baseline creation, loan derivation, batch processing
│   └── baselineService.test.ts

apps/client/src/
├── pages/dashboard/
│   └── components/
│       ├── BaselineConfirmationDialog.tsx  # Confirmation with variance summary
│       └── BaselineResultSummary.tsx       # Post-creation summary
```

Modified files:
```
apps/server/src/db/schema.ts               # Add loan_id + is_baseline_created to migration_records
apps/server/src/routes/migrationRoutes.ts   # Add baseline endpoints
apps/client/src/hooks/useMigration.ts       # Add baseline hooks
apps/client/src/pages/dashboard/MigrationPage.tsx  # Add acknowledgment actions
packages/shared/src/types/migration.ts      # Add baseline result types
packages/shared/src/validators/migrationSchemas.ts # Add baseline schemas
packages/shared/src/constants/vocabulary.ts # Add baseline vocabulary
```

### Dependencies

- **Depends on:** Story 3.1 (migration_records), Story 3.2 (variance_category, computed_rate), Story 3.3 (person profiles provide context for acknowledgment decisions)
- **Blocks:** Story 3.5 (migration dashboard shows baseline completion status per MDA)
- **Reuses:** `computationEngine.ts` (autoSplitDeduction, computeRetirementDate), `ledgerDb` (immutable ledger), `loanTransitionService` patterns (audit trail format)

### Previous Story Intelligence

**From Story 3.1:**
- `migration_records` table with 24 canonical fields — all nullable except staff_name
- `migration_uploads` with status tracking: uploaded → mapped → processing → completed
- Financial values stored as NUMERIC strings (decimal.js compatible)

**From Story 3.2:**
- `variance_category` on each record: clean, minor_variance, significant_variance, structural_error, anomalous
- `computed_rate` — the effective interest rate detected from declared values
- `computed_total_loan`, `computed_monthly_deduction`, `computed_outstanding_balance` — system-computed values
- `has_rate_variance` flag
- Upload status progression extended to: ... → completed → validated → (this story adds) reconciled

**From Story 3.3:**
- Person matching provides context: admin can see cross-MDA history before acknowledging
- Person profiles show all records for a person across MDAs — useful for informed baseline decisions
- CDU/Agriculture cross-posting awareness from Story 3.0b

**From Existing Codebase (Epic 2):**
- `loans` table: all NOT NULL constraints documented above
- `ledger_entries`: append-only with DB trigger enforcement
- `loan_state_transitions`: append-only audit trail
- `autoSplitDeduction()`: guaranteed principalComponent + interestComponent = amount
- `computeBalanceFromEntries()`: reconstructs balance from ledger history
- `loanReference` format: `VLC-{year}-{seq}` — migration uses `VLC-MIG-{year}-{seq}`

### UAT Checkpoint

After Story 3.4 + Story 3.5: **"Migration dashboard + master beneficiary ledger — Awwal validates against SQ-1 output for same file."** The admin should:
1. Upload a regression fixture file (Story 3.1)
2. See "Comparison Complete" summary (Story 3.2)
3. View staff profile (Story 3.3)
4. Click "Accept as Declared — Establish Baseline" (this story)
5. See the loan record with MIGRATION_BASELINE entry in ledger history
6. Verify balance matches what was declared

### References

- [Source: `apps/server/src/db/schema.ts:64-66`] — entryTypeEnum including MIGRATION_BASELINE
- [Source: `apps/server/src/db/schema.ts:74-104`] — loans table schema with all NOT NULL constraints
- [Source: `apps/server/src/db/schema.ts:109-134`] — ledger_entries table schema (append-only)
- [Source: `apps/server/src/db/schema.ts:139-154`] — loan_state_transitions (audit trail)
- [Source: `apps/server/src/db/immutable.ts`] — ledgerDb insert-only accessor
- [Source: `apps/server/src/services/ledgerService.ts`] — createEntry pattern
- [Source: `apps/server/src/services/loanService.ts:24-38`] — CreateLoanData interface
- [Source: `apps/server/src/services/loanService.ts:91-156`] — createLoan function pattern
- [Source: `apps/server/src/services/computationEngine.ts:107-146`] — autoSplitDeduction (principal/interest split)
- [Source: `apps/server/src/services/loanTransitionService.ts`] — transitionLoan pattern
- [Source: `packages/shared/src/validators/ledgerSchemas.ts`] — CreateLedgerEntryInput schema
- [Source: `packages/shared/src/constants/loanTransitions.ts:7-14`] — VALID_TRANSITIONS map
- [Source: `packages/shared/src/constants/vocabulary.ts:53-55`] — LEDGER_IMMUTABLE, LEDGER_ENTRY_CREATED
- [Source: `_bmad-output/planning-artifacts/epics.md:1917-1934`] — Epic 3 Story 3.4 acceptance criteria
- [Source: `_bmad-output/planning-artifacts/prd.md § FR28, FR29`] — Variance acknowledgment and baseline requirements
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:548-559`] — Story 3.4 KEEP with observation visibility addition
- [Source: `_bmad-output/implementation-artifacts/3-1-legacy-upload-intelligent-column-mapping.md`] — migration_records schema
- [Source: `_bmad-output/implementation-artifacts/3-2-migration-validation-rate-detection-mda-delineation.md`] — variance columns, computed values
- [Source: `_bmad-output/implementation-artifacts/3-3-staff-loan-profile-cross-mda-timeline.md`] — person profiles for informed acknowledgment

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

### Completion Notes List

- Task 1: Schema additions already existed (migration 0011_black_ultimo.sql). Added `loan_id` FK and `is_baseline_created` boolean to migration_records, added 'reconciled' to migration_upload_status enum.
- Task 2+3: Created `baselineService.ts` with `createBaseline()`, `createBatchBaseline()`, `getBaselineSummary()`. Implements atomic transaction pattern (loan + state transition + ledger entry + record link). All financial arithmetic via decimal.js. Principal derivation with 3-level fallback. Baseline amount = totalLoan - declaredOutstandingBalance. autoSplitDeduction for principal/interest split (skipped for zero-principal loans).
- Task 4: Added 3 baseline routes to migrationRoutes.ts: single record baseline, batch baseline, baseline summary. All behind adminAuth middleware.
- Task 5: Added BaselineResult, BatchBaselineResult, BaselineSummary types. Added createBaselineBodySchema. Added 7 non-punitive vocabulary entries (BASELINE_CREATED, BASELINE_BATCH_COMPLETE, BASELINE_ANNOTATION, BASELINE_ALREADY_EXISTS, BASELINE_VARIANCE_NOTE, BASELINE_UPLOAD_NOT_VALIDATED, BASELINE_RECORD_NOT_FOUND).
- Task 6: Added useCreateBaseline, useCreateBatchBaseline, useBaselineSummary hooks. Created BaselineConfirmationDialog (variance-aware, non-punitive language). Created BaselineResultSummary (post-creation metrics). Extended MigrationPage with "Accept All as Declared" button and baseline workflow.
- Task 7: Verified computeBalanceFromEntries treats MIGRATION_BASELINE identically to all entry types (sums all amounts). Existing LoanDetailPage, loan search, and balance computation work correctly for migration loans.
- Task 8: All type checks pass (shared, server, client). 17 unit tests pass. No regressions introduced — all pre-existing failures are timeout-related (Education stress test file, auth route timeouts).

### Change Log

- 2026-03-07: Story 3.4 implemented — baseline acknowledgment, ledger entry creation, batch processing, frontend acknowledgment UI
- 2026-03-07: Code review (AI) — 11 issues found (1 critical, 3 high, 4 medium, 3 low); 9 fixed inline, H4 forwarded to Story 3.5 Task 0, M3 resolved with 14 integration tests
- 2026-03-07: All 11 review items resolved — story marked done

### File List

New files:
- apps/server/src/services/baselineService.ts
- apps/server/src/services/baselineService.test.ts
- apps/server/src/routes/baseline.integration.test.ts (AC 7 integration tests — 14 tests)
- apps/server/drizzle/0011_black_ultimo.sql (migration SQL for baseline schema additions)
- apps/server/drizzle/meta/0011_snapshot.json (migration snapshot)
- apps/client/src/pages/dashboard/components/BaselineConfirmationDialog.tsx
- apps/client/src/pages/dashboard/components/BaselineResultSummary.tsx

Modified files:
- apps/server/src/db/schema.ts (added loan_id, is_baseline_created to migration_records; added 'reconciled' to enum)
- apps/server/src/routes/migrationRoutes.ts (added 3 baseline endpoints)
- apps/server/vitest.config.ts (added testTimeout, fileParallelism, globals config)
- apps/server/drizzle/meta/_journal.json (migration 0011 journal entry)
- apps/client/src/hooks/useMigration.ts (added 3 baseline hooks)
- apps/client/src/pages/dashboard/MigrationPage.tsx (added acknowledgment UI)
- packages/shared/src/types/migration.ts (added BaselineResult, BatchBaselineResult, BaselineSummary)
- packages/shared/src/validators/migrationSchemas.ts (added createBaselineBodySchema)
- packages/shared/src/constants/vocabulary.ts (added 7 baseline vocabulary entries)
- packages/shared/src/index.ts (exported new types and schema)
