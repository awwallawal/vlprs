# Story 8.0b: Record Detail View & Pre-Baseline Inspection/Correction Flow

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Department Admin**,
I want to click on any migration record row to see a detailed breakdown of declared vs computed values for every field, with the ability to correct discrepancies before establishing the baseline,
So that I never accept impossible data (e.g. outstanding balance exceeding total loan) into the system where it cascades into every dashboard metric and report.

**Origin:** UAT Findings #2, #6 from E7+E6 retro (2026-03-29). Currently only "Establish Baseline" is clickable — no inspect, no correct, no guard against cascading wrong data.

**Dependency:** Story 8.0a (Migration Computation Model — Scheme Formula & Three-Vector Display) must be complete. This story assumes three scheme expected columns exist in the DB, `SchemeExpectedValues` type is available, and the three-vector comparison UI pattern is established.

## Acceptance Criteria

1. **Given** a validated migration record row in the validation results table, **When** the user clicks anywhere on the row (not just the baseline button), **Then** a detail drawer/panel opens showing all declared fields from the original Excel alongside all computed/scheme-expected fields for comparison.

2. **Given** the record detail view is open, **When** viewing financial fields, **Then** the three-vector comparison (Scheme Expected / Reverse Engineered / MDA Declared) from Story 8.0a is displayed prominently with the computation transparency accordion, plus all additional declared fields (staffName, staffId, grade, step, MDA, etc.) are shown in a structured layout.

3. **Given** a record where `declaredOutstandingBalance > computedTotalLoan` (or scheme expected total loan), **When** viewing the record detail, **Then** the outstanding balance field is highlighted with an amber warning indicator and an explanatory tooltip: "The declared outstanding balance exceeds the total loan amount. This would create a negative baseline entry affecting all downstream metrics."

4. **Given** a record with identified data issues (impossible outstanding balance, missing tenure, null scheme expected), **When** the user wants to correct a value before baseline, **Then** the user can edit the `outstandingBalance`, `totalLoan`, `monthlyDeduction`, and `installmentCount` fields directly in the detail view, with real-time recomputation of dependent values (baseline amount, variance).

5. **Given** a correction is made to a financial field, **When** the user clicks "Save Correction", **Then** the correction is persisted to the `migration_records` table with an audit trail (original value, corrected value, corrected_by, corrected_at), and the three-vector comparison updates to reflect corrected values where applicable.

6. **Given** a record with corrections saved, **When** the user clicks "Establish Baseline" from within the detail view, **Then** the baseline is created using the corrected values (not the original declared values), and the audit trail is preserved.

7. **Given** a record where `declaredOutstandingBalance > totalLoan` (computed or scheme expected), **When** the user attempts to establish baseline WITHOUT first correcting the outstanding balance, **Then** the system blocks the baseline with a clear non-punitive message: "The outstanding balance (₦X) exceeds the total loan (₦Y). Please review and correct this value before establishing the baseline." This guard applies to both single and batch baseline operations.

8. **Given** a batch baseline operation, **When** any record in the batch has `outstandingBalance > totalLoan`, **Then** the batch operation excludes that record (does not block the entire batch), reports it separately as "X record(s) require review — outstanding balance exceeds total loan", and provides a link to each excluded record's detail view.

9. **Given** the record detail view, **When** viewing a record that already has a baseline established, **Then** the detail view shows the record in read-only mode with the baseline creation details (date, baseline amount, loan reference) and the correction history if any corrections were made.

## Tasks / Subtasks

- [x] Task 1: Create record detail API endpoint (AC: 1, 2)
  - [x] 1.1: Add `GET /api/migrations/:uploadId/records/:recordId` endpoint in `apps/server/src/routes/migrationRoutes.ts` — returns full migration record with all declared + computed + scheme expected fields
  - [x] 1.2: Add `getRecordDetail(recordId: string, uploadId: string)` function in `apps/server/src/services/migrationValidationService.ts` — fetches single record with all columns including scheme expected values from 8.0a
  - [x] 1.3: Add Zod response schema for the detail endpoint in `packages/shared/src/types/migration.ts` — `MigrationRecordDetail` type with all fields grouped: personnel info, financial declared values, computed values, scheme expected values, variance metadata, baseline status
  - [x] 1.4: Integration test: GET record detail returns correct structure with all three vectors

- [x] Task 2: Add correction columns to migration_records schema (AC: 5)
  - [x] 2.1: Add correction audit columns to `migrationRecords` in `apps/server/src/db/schema.ts`:
    - `corrected_outstanding_balance` (numeric 15,2, nullable)
    - `corrected_total_loan` (numeric 15,2, nullable)
    - `corrected_monthly_deduction` (numeric 15,2, nullable)
    - `corrected_installment_count` (integer, nullable)
    - `original_values_snapshot` (jsonb, nullable) — stores original values before first correction
    - `corrected_by` (uuid, FK to users, nullable)
    - `corrected_at` (timestamptz, nullable)
  - [x] 2.2: Run `drizzle-kit generate` to create a NEW migration (never re-generate existing)
  - [x] 2.3: Verify migration applies cleanly to dev database

- [x] Task 3: Create correction API endpoint (AC: 4, 5)
  - [x] 3.1: Add `PATCH /api/migrations/:uploadId/records/:recordId/correct` endpoint in `apps/server/src/routes/migrationRoutes.ts`
  - [x] 3.2: Add Zod validation schema `correctMigrationRecordSchema` for the request body — allows partial updates to `outstandingBalance`, `totalLoan`, `monthlyDeduction`, `installmentCount` only
  - [x] 3.3: Implement `correctRecord(recordId, uploadId, corrections, userId)` in `apps/server/src/services/migrationValidationService.ts`:
    - Verify record exists and is not yet baselined (`isBaselineCreated === false` — this is a `boolean NOT NULL DEFAULT false` column, no null guard needed)
    - On first correction: snapshot original values into `original_values_snapshot` (jsonb)
    - Persist corrections to `corrected_*` columns
    - Re-compute scheme expected vector if `installmentCount` changed (call `computeSchemeExpected`)
    - Re-compute variance category using corrected values vs scheme expected. Include the original `varianceCategory` and `varianceAmount` in the `original_values_snapshot` (on first correction only), then overwrite the `varianceCategory` and `varianceAmount` columns with the recomputed values. No separate `correctedVarianceCategory` column needed — the snapshot preserves the audit trail
    - Set `corrected_by` and `corrected_at`
    - Return updated record detail
  - [x] 3.4: Integration test: correction persists and preserves original snapshot (including original varianceCategory)
  - [x] 3.5: Integration test: correction on already-baselined record is rejected (409 Conflict)
  - [x] 3.6: Integration test: re-correction updates corrected values but does NOT overwrite original snapshot
  - [x] 3.7: Integration test: correcting installmentCount triggers scheme expected recomputation

- [x] Task 4: Add outstanding balance validation guard to baseline (AC: 7, 8)
  - [x] 4.1: Add `validateBaselineEligibility(record)` helper in `apps/server/src/services/baselineService.ts` — checks: outstanding balance (using corrected value if exists, else declared) must not exceed total loan (using scheme expected if available, else computed, else declared)
  - [x] 4.2: Integrate guard into `createBaseline()` (single record) — throw AppError with code `BASELINE_BALANCE_EXCEEDS_LOAN` and non-punitive message if validation fails
  - [x] 4.3: Integrate guard into `createBatchBaseline()` — **remove the existing throw at lines 433-438** (which currently blocks the entire batch on missing balance) and replace with skip-and-collect logic: run `validateBaselineEligibility()` per record, skip ineligible ones, collect skipped records with reasons, process eligible records normally
  - [x] 4.4: Update `BatchBaselineResult` type to include `skippedRecords: Array<{ recordId: string, staffName: string, reason: string }>` as a **required** field (always present, empty array when no records skipped — avoids frontend null checks)
  - [x] 4.5: Integration test in `apps/server/src/routes/baseline.integration.test.ts`: single baseline blocked when outstanding > totalLoan, returns 422 with clear message
  - [x] 4.6: Integration test in same file: batch baseline skips bad records, processes good ones, reports both
  - [x] 4.7: Integration test in same file: corrected outstanding balance that is valid allows baseline through

- [x] Task 5: Update baseline to use corrected values (AC: 6)
  - [x] 5.1: Modify `computeBaselineEntry()` in `apps/server/src/services/baselineService.ts` — the ONLY record field this function reads is `outstandingBalance` (line 228). Change to: `correctedOutstandingBalance ?? outstandingBalance`. Do NOT add `correctedTotalLoan` here — `totalLoan` is derived from `principal + (principal × rate)` at line 226, not read from the record. Corrected `totalLoan` flows into the guard (`validateBaselineEligibility`) only
  - [x] 5.2: Modify `deriveLoanFromMigrationRecord()` at these specific lines:
    - Line 148: `inferTenure(record)` reads `record.installmentCount` internally — construct a shallow copy with `{ ...record, installmentCount: record.correctedInstallmentCount ?? record.installmentCount }` and pass the copy to `inferTenure()`. Do NOT modify `inferTenure()` itself
    - Line 151: `record.monthlyDeduction` → `record.correctedMonthlyDeduction ?? record.monthlyDeduction`
    - Lines 144-146 (`computedRate`, `principal`): NOT correctable — leave unchanged (out of AC4 scope)
  - [x] 5.3: Add `correctionApplied: boolean` flag to `BaselineResult` response
  - [x] 5.4: Unit test in `apps/server/src/services/baselineService.test.ts`: baseline with corrections uses corrected values
  - [x] 5.5: Unit test in same file: baseline without corrections uses original declared values (backward compatible)

- [x] Task 6: Create RecordDetailDrawer frontend component (AC: 1, 2, 3, 9)
  - [x] 6.1: Create `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx` — sliding drawer (shadcn Sheet component) triggered by row click
  - [x] 6.2: Personnel info section: staff name, staff ID, grade, step, MDA (read-only display)
  - [x] 6.3: Three-vector financial comparison section: reuse the three-column layout from 8.0a (`Scheme Expected | Reverse Engineered | MDA Declared`) with computation transparency accordion
  - [x] 6.4: Outstanding balance section with amber warning when declared > total loan, including tooltip explanation
  - [x] 6.5: Correction form section: editable fields for `outstandingBalance`, `totalLoan`, `monthlyDeduction`, `installmentCount` — only shown when record is not yet baselined
  - [x] 6.6: Baseline status section: if baselined, show creation date, baseline amount, loan reference, correction history
  - [x] 6.7: "Establish Baseline" button within drawer — calls existing single baseline endpoint, disabled when outstanding > totalLoan guard fails
  - [x] 6.8: Add `useMigrationRecordDetail(uploadId, recordId)` TanStack Query hook in `apps/client/src/hooks/useMigration.ts`

- [x] Task 7: Add correction mutation hook and form (AC: 4, 5)
  - [x] 7.1: Add `useCorrectMigrationRecord(uploadId, recordId)` mutation hook in `apps/client/src/hooks/useMigration.ts` — invalidates record detail and validation results queries on success
  - [x] 7.2: Implement correction form with click-to-edit pattern in `RecordDetailDrawer.tsx`:
    - Inline editable fields (click-to-edit pattern)
    - "Save Correction" button with loading state
  - [x] 7.3: Show correction history below form: original value → corrected value, who corrected, when
  - [x] 7.4: After correction saved, refresh the three-vector comparison if installmentCount changed

- [x] Task 8: Wire row click in validation results table (AC: 1)
  - [x] 8.1: Make `RecordComparisonRow` clickable — entire row triggers drawer open (except the existing "Establish Baseline" button which retains its direct action)
  - [x] 8.2: Add `cursor-pointer` and hover highlight to row styling
  - [x] 8.3: Pass `onRowClick(recordId)` handler from `MigrationUploadPage` to each `RecordComparisonRow`
  - [x] 8.4: Manage drawer open/close state and selected record ID in `MigrationUploadPage`

- [x] Task 9: Update batch baseline for guard and reporting (AC: 7, 8)
  - [x] 9.1: BaselineResultSummary shows skipped records warning with count
  - [x] 9.2: After batch baseline completes, show results summary with skipped records section
  - [x] 9.3: Skipped records list with clickable links that open the `RecordDetailDrawer` for each
  - [x] 9.4: BatchBaselineResult type updated with required `skippedRecords` field — hook handles automatically

- [x] Task 10: Full regression suite (AC: all)
  - [x] 10.1: Run full existing test suite — zero regressions required (69 unit test files/959 tests + 36 integration files/552 tests = all pass)
  - [x] 10.2: Run linting and typecheck across monorepo (shared, server, client all clean)
  - [x] 10.3: Manual validation: upload known BIR record with impossible outstanding balance → verify guard blocks baseline → correct value → verify baseline succeeds with corrected value

### Review Follow-ups (AI) — Code Review 2026-04-02

- [x] [AI-Review][HIGH] H1+H2: Replace `Number()` financial arithmetic in VarianceBreakdown and OutstandingBalanceComparison with cents-based integer comparison utilities to avoid floating-point precision divergence from server Decimal.js [RecordDetailDrawer.tsx:175,186,199,249,263]
- [x] [AI-Review][MEDIUM] M1: Replace hardcoded tier thresholds (250K/450K/600K/750K) in InferredGradeRow with `getTierForGradeLevel()` from `@vlprs/shared` [RecordDetailDrawer.tsx:80-81]
- [x] [AI-Review][MEDIUM] M2: Add `inputMode="decimal"` and `pattern` to financial text input fields in CorrectionForm for client-side validation [RecordDetailDrawer.tsx:371-429]
- [x] [AI-Review][MEDIUM] M3: Fix BaselineSection guard to use cents-based comparison instead of `Number()` for consistency with server-side Decimal.js guard [RecordDetailDrawer.tsx:551-553]
- [x] [AI-Review][MEDIUM] M4: Clarify auto-recompute UX — replace misleading "Use this value" with text explaining server auto-applies when outstanding balance is not manually overridden [RecordDetailDrawer.tsx:432-447]
- [x] [AI-Review][MEDIUM] M5: Add Drizzle meta files to story File List (meta/_journal.json, meta/0032_snapshot.json, meta/0033_snapshot.json) [story file]
- [x] [AI-Review][LOW] L1: Add error state handling to RecordDetailDrawer when API call fails [RecordDetailDrawer.tsx:576-580]
- [x] [AI-Review][LOW] L2: Add record detail query invalidation to useCreateBaseline.onSuccess so drawer refreshes to read-only state after baseline [useMigration.ts:136-139]
- [x] [AI-Review][LOW] L3: Add explanatory comment for upload existence check outside transaction pattern in correctRecord() [migrationValidationService.ts:702-718]

## Dev Notes

### Critical Domain Context: Why This Story Exists

UAT Finding #6 from the E7+E6 retro exposed a catastrophic cascade:

```
Declared Outstanding ₦671,979 (WRONG — exceeds total loan ₦479,985)
  → Baseline entry: ₦479,985 - ₦671,979 = -₦191,994 (NEGATIVE)
  → Balance computation: totalLoan - (-₦191,994) = totalLoan + ₦191,994
  → Inflates: Total Outstanding Receivables, MDA Health Score, Attention Items,
     Recovery Projections, Weekly AG Report, all E6 PDF reports
```

Currently "Establish Baseline" is accept-or-nothing with zero guard rails. This story adds the inspect → correct → guard → accept workflow.

### Dependency on Story 8.0a

This story assumes 8.0a is complete. Specifically:

| 8.0a Deliverable | How 8.0b Uses It |
|---|---|
| 3 new `scheme_expected_*` DB columns | Record detail view displays all three vectors |
| `SchemeExpectedValues` type | Part of `MigrationRecordDetail` response |
| `computeSchemeExpected()` function | Called during correction recomputation when `installmentCount` changes |
| `inferTenureFromRate()` function | Used in correction flow to recompute tenure |
| Three-column comparison UI pattern | Reused in `RecordDetailDrawer` |
| `apparentRate` field on `ValidationResultRecord` | Displayed in record detail |

### Current "Establish Baseline" Flow (What Exists)

**Backend:** `apps/server/src/services/baselineService.ts`

| Function | Lines | What It Does |
|---|---|---|
| `createBaseline()` | 283-383 | Single record: creates loan + state transition + ledger entry atomically |
| `createBatchBaseline()` | 385-508 | Batch: pre-validates outstanding balance exists (NOT valid), processes all records |
| `computeBaselineEntry()` | 217-279 | Computes `baselineAmount = totalLoan - declaredOutstandingBalance` (no validation) |
| `deriveLoanFromMigrationRecord()` | 138-215 | Derives loan data; uses computed rate or 13.33% default; infers tenure |

**Frontend:** `apps/client/src/pages/dashboard/components/RecordComparisonRow.tsx` (1-72 lines)
- Shows: staff name, variance badge, variance amount, declared vs computed totals
- Only action: "Establish Baseline" button — no row click, no detail view

**Frontend:** `apps/client/src/pages/dashboard/components/BaselineConfirmationDialog.tsx` (1-71 lines)
- Confirmation dialog for batch baseline — no guards, no skip logic

### What This Story Changes

1. **ADD** record detail drawer — clickable rows open full-field comparison view
2. **ADD** correction capability — edit financial fields before baseline with audit trail
3. **ADD** outstanding balance guard — blocks impossible values from creating negative baselines
4. **CHANGE** batch baseline — skip ineligible records instead of blindly processing all
5. **CHANGE** baseline computation — use corrected values when available
6. **KEEP** existing baseline API contract — extend, don't fork

### Schema Change: Correction Audit Columns

Add to `migration_records` table in `apps/server/src/db/schema.ts`:

```typescript
// Correction fields (pre-baseline inspection)
correctedOutstandingBalance: numeric('corrected_outstanding_balance', { precision: 15, scale: 2 }),
correctedTotalLoan: numeric('corrected_total_loan', { precision: 15, scale: 2 }),
correctedMonthlyDeduction: numeric('corrected_monthly_deduction', { precision: 15, scale: 2 }),
correctedInstallmentCount: integer('corrected_installment_count'),
originalValuesSnapshot: jsonb('original_values_snapshot'),
correctedBy: uuid('corrected_by').references(() => users.id),
correctedAt: timestamp('corrected_at', { withTimezone: true }),
```

**Drizzle migration rules:** Generate a NEW migration file. Never re-generate an existing migration. See `docs/drizzle-migrations.md`.

### Effective Value Pattern

Throughout the correction and baseline flow, use this priority order:

```typescript
// The "effective" value is: corrected if available, else declared
const effectiveOutstandingBalance = record.correctedOutstandingBalance ?? record.outstandingBalance;
const effectiveTotalLoan = record.correctedTotalLoan ?? record.totalLoan;
const effectiveMonthlyDeduction = record.correctedMonthlyDeduction ?? record.monthlyDeduction;
const effectiveInstallmentCount = record.correctedInstallmentCount ?? record.installmentCount;
```

This pattern keeps the original declared values intact while allowing corrections to override them in downstream computations.

### Outstanding Balance Guard Logic

```typescript
function validateBaselineEligibility(record: MigrationRecord): { eligible: boolean; reason?: string } {
  const effectiveOutstanding = record.correctedOutstandingBalance ?? record.outstandingBalance;
  // Use scheme expected total loan (most authoritative), fallback to computed, then declared
  const referenceTotalLoan = record.schemeExpectedTotalLoan ?? record.computedTotalLoan ?? record.totalLoan;

  if (effectiveOutstanding === null) {
    return { eligible: false, reason: 'BASELINE_MISSING_BALANCE' };
  }

  const outstanding = new Decimal(effectiveOutstanding);
  const totalLoan = new Decimal(referenceTotalLoan);

  // NOTE: This guard uses the authoritative reference totalLoan (scheme expected first).
  // computeBaselineEntry() derives its own totalLoan from principal + (principal × rate).
  // These may differ slightly (e.g., ₦479,992 vs ₦479,983) — by design. The guard is
  // conservative (uses most authoritative source), while baseline uses the derived value.
  if (outstanding.greaterThan(totalLoan)) {
    return {
      eligible: false,
      reason: `The outstanding balance (${formatNaira(outstanding)}) exceeds the total loan (${formatNaira(totalLoan)}). Please review and correct this value before establishing the baseline.`
    };
  }

  return { eligible: true };
}
```

### Frontend: RecordDetailDrawer Pattern

Use shadcn `Sheet` component (right-side drawer) — consistent with detail view patterns in the codebase:

```
┌─────────────────────────────────────────────────┐
│ Record Detail — ALATISE BOSEDE SUSAINAH    [×]  │
├─────────────────────────────────────────────────┤
│ PERSONNEL INFO                                  │
│ Staff Name: ALATISE BOSEDE SUSAINAH             │
│ Staff ID: OY/2345/BIR                           │
│ Grade: GL08  |  Step: 5  |  MDA: BIR            │
├─────────────────────────────────────────────────┤
│ FINANCIAL COMPARISON (Three-Vector)              │
│ ┌─────────────┬──────────┬──────────┬──────────┐│
│ │             │ Scheme   │ Reverse  │ MDA      ││
│ │             │ Expected │ Eng.     │ Declared ││
│ ├─────────────┼──────────┼──────────┼──────────┤│
│ │ Total Loan  │ 479,993  │ 479,984  │ 479,985  ││
│ │ Monthly Ded │ 16,999   │ 16,999   │ 16,999   ││
│ │ Total Int   │ 29,993   │ 29,984   │ 29,985   ││
│ └─────────────┴──────────┴──────────┴──────────┘│
│ [▸ Computation Transparency]                     │
├─────────────────────────────────────────────────┤
│ OUTSTANDING BALANCE                              │
│ Declared: ₦671,979  ⚠ Exceeds total loan        │
│ "This would create a negative baseline entry"    │
│                                                  │
│ CORRECTION (click to edit)                       │
│ Outstanding Balance: [₦671,979 → ___________]    │
│ Total Loan:          [₦479,985 → ___________]    │
│ Monthly Deduction:   [₦16,999  → ___________]    │
│ Installment Count:   [30       → ___________]    │
│                                                  │
│ Baseline Preview: ₦479,985 - ₦___ = ₦___        │
│                                                  │
│ [Save Correction]  [Establish Baseline]          │
└─────────────────────────────────────────────────┘
```

**Read-Only State (after baseline established — AC9):**

```
┌─────────────────────────────────────────────────┐
│ Record Detail — ALATISE BOSEDE SUSAINAH    [×]  │
├─────────────────────────────────────────────────┤
│ PERSONNEL INFO                                  │
│ (same as above)                                 │
├─────────────────────────────────────────────────┤
│ FINANCIAL COMPARISON (Three-Vector)              │
│ (same three-column table — all read-only)        │
├─────────────────────────────────────────────────┤
│ BASELINE DETAILS                                │
│ Status:     ✓ Baseline Established              │
│ Created:    2026-04-02 14:45                    │
│ Loan Ref:   VLC-MIG-2026-0023                   │
│ Baseline:   ₦479,985 - ₦351,988 = ₦127,997     │
│                                                  │
│ CORRECTION HISTORY (if any)                      │
│ Outstanding Balance: ₦671,979 → ₦351,988        │
│   Corrected by: admin@oyo.gov.ng on 2026-04-02  │
└─────────────────────────────────────────────────┘
```

### Correction History Display

When corrections exist, show audit trail:

```
CORRECTION HISTORY
─────────────────────────────────
Outstanding Balance: ₦671,979 → ₦351,988
  Corrected by: admin@oyo.gov.ng on 2026-04-02 14:30
```

### API Route Structure

Following architecture conventions (`/api/{resource}/{id}/{child}`):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/migrations/:uploadId/records/:recordId` | Record detail (new) |
| PATCH | `/api/migrations/:uploadId/records/:recordId/correct` | Apply correction (new) |
| POST | `/api/migrations/:uploadId/records/:recordId/baseline` | Establish baseline (existing — add guard) |
| POST | `/api/migrations/:uploadId/baseline` | Batch baseline (existing — add skip logic) |

### TanStack Query Keys

```typescript
queryKey: ['migrations', uploadId, 'records', recordId]  // single record detail
queryKey: ['migrations', uploadId, 'validation-results']  // existing — invalidate after correction
```

### Non-Punitive Vocabulary Reminders

- "Review required" not "Error" or "Invalid"
- "Variance observed" not "Discrepancy found"
- Amber/teal indicators, NEVER red
- "Exceeds" not "Violates"
- Source: `packages/shared/src/constants/vocabulary.ts`

### Testing Standards

- **Tests co-located** with source files (e.g., `baselineService.test.ts` next to `baselineService.ts`)
- **Integration tests** in route test files (e.g., `baseline.integration.test.ts`)
- **Vitest** for all unit/integration tests
- **Financial arithmetic** tests use Decimal.js string comparisons (never floating point)
- **Non-punitive error codes** tested: assert `BASELINE_BALANCE_EXCEEDS_LOAN`, not generic 422

### Team Agreements Applicable to This Story

- **Extend, don't fork** — add correction capability alongside existing baseline, don't replace
- **Clean-room validation** — after implementation: purge → upload single BIR file → verify guard triggers on bad outstanding balance → correct → baseline → verify dashboard figures
- **Role-based UAT walkthrough** — test as DEPT_ADMIN (inspects + corrects + baselines), SUPER_ADMIN (batch baseline with skips)
- **Transaction scope** — corrections are NOT in the baseline transaction (they're a separate PATCH). Baseline transaction remains atomic: loan + ledger + link. However, the correction operation itself (read → snapshot → update → recompute variance) MUST be wrapped in its own transaction to prevent race conditions between concurrent correction and baseline attempts
- **N+1 query budget** — record detail is 1 query (single row by PK). Correction is 1 UPDATE. No N+1 risk
- **Zero-debt-forward** — no partial implementation. Guard must work for both single and batch baselines

### Previous Story Learnings (8.0a)

8.0a (ready-for-dev, predecessor) will establish:
- `computeSchemeExpected()` function — reuse for correction recomputation
- `inferTenureFromRate()` function — reuse for tenure lookup after installmentCount correction
- Three-column comparison UI pattern — reuse in `RecordDetailDrawer`
- `SchemeExpectedValues` type — include in `MigrationRecordDetail` response
- Amber highlight pattern for largest variance cell — extend for outstanding balance warning

### What This Story Does NOT Change

- **Observation engine** — observations remain unaffected by corrections
- **Dashboard metrics** — dashboard reads from ledger entries, which are created after baseline (with corrected values). No separate dashboard change needed
- **Existing validation flow** — validation runs at upload time and produces variance categories. Corrections happen AFTER validation, before baseline
- **RecordComparisonRow appearance and content** — the row displays the same information as before; Task 8 adds a click handler and hover state but does not change the row's layout or displayed fields
- **Three-vector computation** — 8.0a handles all computation changes; this story only consumes the results

### Decimal.js Configuration

All financial arithmetic must use Decimal.js:
```typescript
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
```
Already configured in `computationEngine.ts` and `migrationValidationService.ts`.

### Project Structure Notes

- Server services: `apps/server/src/services/`
- Server routes: `apps/server/src/routes/`
- Shared types: `packages/shared/src/types/`
- Client components: `apps/client/src/pages/dashboard/components/`
- Client hooks: `apps/client/src/hooks/useMigration.ts`
- DB schema: `apps/server/src/db/schema.ts`
- Migrations: `apps/server/drizzle/`
- Tests co-located with source files

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#UAT Finding #2 — No record detail view]
- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#UAT Finding #6 — Cascade impact]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0b]
- [Source: _bmad-output/implementation-artifacts/8-0a-migration-computation-model-scheme-formula.md — Predecessor story]
- [Source: apps/server/src/services/baselineService.ts — Current baseline implementation]
- [Source: apps/server/src/services/baselineService.ts:217-279 — computeBaselineEntry (no validation)]
- [Source: apps/server/src/services/baselineService.ts:283-383 — createBaseline (single)]
- [Source: apps/server/src/services/baselineService.ts:385-508 — createBatchBaseline]
- [Source: apps/server/src/services/migrationValidationService.ts:370-484 — getValidationResults]
- [Source: apps/server/src/routes/migrationRoutes.ts:181-232 — Baseline endpoints]
- [Source: apps/server/src/db/schema.ts:328-392 — migration_records table]
- [Source: packages/shared/src/types/migration.ts — ValidationResultRecord, BaselineResult]
- [Source: apps/client/src/pages/dashboard/components/RecordComparisonRow.tsx — Current row display]
- [Source: apps/client/src/pages/dashboard/components/BaselineConfirmationDialog.tsx — Current batch dialog]
- [Source: apps/server/src/routes/baseline.integration.test.ts — Existing baseline tests]
- [Source: _bmad-output/planning-artifacts/architecture.md — API patterns, DB conventions, frontend patterns]
- [Source: .claude/projects/memory/domain_loan_computation.md — Scheme formula reference]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Migration 0031 tracking fix: scheme_expected columns were already in DB but not tracked — inserted tracking entry manually before applying 0032

### Completion Notes List

- **Task 1:** Created `GET /api/migrations/:uploadId/records/:recordId` endpoint with `getRecordDetail()` service function and `MigrationRecordDetail` shared type. Full three-vector response with personnel info, variance metadata, and baseline status. 5 integration tests.
- **Task 2:** Added 7 correction audit columns to `migration_records` (corrected_outstanding_balance, corrected_total_loan, corrected_monthly_deduction, corrected_installment_count, original_values_snapshot, corrected_by, corrected_at). Migration 0032 applied cleanly.
- **Task 3:** Created `PATCH /api/migrations/:uploadId/records/:recordId/correct` endpoint with `correctRecord()` service function, `correctMigrationRecordSchema` Zod validator, and transaction-safe correction logic. Snapshots original values on first correction, recomputes scheme expected when installmentCount changes, recomputes variance. 6 integration tests.
- **Task 4:** Added `validateBaselineEligibility()` guard to both single and batch baseline flows. Single baseline returns 422 when outstanding > totalLoan. Batch baseline skips ineligible records and collects them in `skippedRecords` array (required field on `BatchBaselineResult`). Updated existing test that expected 400 throw to expect skip-and-collect behavior. 3 new integration tests.
- **Task 5:** Updated `computeBaselineEntry()` to use `correctedOutstandingBalance ?? outstandingBalance`, `deriveLoanFromMigrationRecord()` to use corrected installmentCount and monthlyDeduction, and added `correctionApplied` flag to `BaselineResult`. 2 unit tests.
- **Task 6:** Created `RecordDetailDrawer.tsx` — shadcn Sheet (right-side drawer) with personnel info, three-vector financial comparison table, outstanding balance section with amber warning, correction form (click-to-edit), correction history, baseline status (read-only after baseline), and "Establish Baseline" button disabled when guard fails.
- **Task 7:** Added `useMigrationRecordDetail()` query hook and `useCorrectMigrationRecord()` mutation hook. Correction form with inline editable fields and loading state. Correction history shows original → corrected values with timestamp.
- **Task 8:** Made `RecordComparisonRow` clickable (cursor-pointer, row click handler with stopPropagation on baseline button). Drawer state managed in `MigrationUploadPage`.
- **Task 9:** Updated `BaselineResultSummary` to show skipped records with clickable "Review" links that open the detail drawer. `BatchBaselineResult` type includes required `skippedRecords` array.
- **Task 10:** Full regression: 69 unit test files (959 tests) + 36 integration files (552 tests) = 1,511 tests all pass. TypeScript clean across shared/server/client. Lint clean.

### File List

**New Files:**
- `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx` — Record detail drawer component
- `apps/server/drizzle/0032_tiresome_iron_fist.sql` — Migration for correction audit columns
- `apps/server/drizzle/meta/0032_snapshot.json` — Drizzle snapshot for migration 0032
- `apps/server/drizzle/meta/0033_snapshot.json` — Drizzle snapshot for migration 0033

**Modified Files:**
- `packages/shared/src/types/migration.ts` — Added `MigrationRecordDetail`, `correctionApplied` to `BaselineResult`, `skippedRecords` to `BatchBaselineResult`
- `packages/shared/src/validators/migrationSchemas.ts` — Added `correctMigrationRecordSchema`
- `packages/shared/src/index.ts` — Exported new types and schema
- `apps/server/src/db/schema.ts` — Added 7 correction columns to `migration_records` table
- `apps/server/src/services/migrationValidationService.ts` — Added `getRecordDetail()`, `correctRecord()` functions
- `apps/server/src/services/baselineService.ts` — Added `validateBaselineEligibility()` guard, updated `computeBaselineEntry()` and `deriveLoanFromMigrationRecord()` to use corrected values, batch baseline skip-and-collect logic
- `apps/server/src/routes/migrationRoutes.ts` — Added GET record detail and PATCH correction endpoints
- `apps/client/src/hooks/useMigration.ts` — Added `useMigrationRecordDetail()` and `useCorrectMigrationRecord()` hooks
- `apps/client/src/pages/dashboard/components/RecordComparisonRow.tsx` — Added `onRowClick` prop, cursor-pointer, stopPropagation on baseline button
- `apps/client/src/pages/dashboard/components/BaselineResultSummary.tsx` — Added skipped records display with review links
- `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` — Added drawer state, row click handler, RecordDetailDrawer integration
- `apps/server/src/routes/migrationValidation.integration.test.ts` — Added 11 tests (record detail + correction)
- `apps/server/src/routes/baseline.integration.test.ts` — Added 3 guard tests, updated 1 existing test for new skip behavior
- `apps/server/src/services/baselineService.test.ts` — Added 2 corrected values tests
- `apps/server/drizzle/meta/_journal.json` — Drizzle journal updated for migrations 0032+0033

### UAT-Driven Enhancements (post-implementation, same session)

- **Outstanding Balance Comparison:** Added Computed (Rev. Eng.) value alongside MDA Declared in the Outstanding Balance section, with variance and "Above computed" amber badge. Gives immediate reference for what the outstanding balance should be.
- **Inferred Grade from Principal:** Added `inferTierFromPrincipal()` reverse lookup in `packages/shared/src/constants/tiers.ts`. Detail drawer shows "Inferred Grade" (e.g., "Levels 9-10") next to declared grade with "Consistent" (teal) or "Above grade entitlement" (amber) badge. Server computes via `inferredGrade` field on `MigrationRecordDetail`.
- **Variance Breakdown:** Added per-field variance breakdown section in the drawer showing each field's contribution to the overall variance: Total Loan, Monthly Deduction, Outstanding Balance — each with `|Declared - Reference| = Variance`, reference source label, and "Largest" badge on the driving field. Answers "where does the variance come from?" without mental arithmetic.

- **Installments Outstanding Correction with Auto-Recompute:** Added `installmentsPaid` and `installmentsOutstanding` to the correction form (schema columns: `corrected_installments_paid`, `corrected_installments_outstanding`, migration 0033). When installments outstanding is corrected, the system auto-computes `outstandingBalance = monthlyDeduction x installmentsOutstanding` and shows a preview with "Use this value" button. Root cause found during UAT: ALATISE BOSEDE SUSAINAH had installments outstanding = 42 (should be 22 = 30 tenure - 8 paid), inflating outstanding balance from ₦351,989 to ₦671,979 via `₦15,999.50 x 42`. Account officer confirmed the data entry error.

**Retro Action Items (from UAT):**
- [ ] Add "Grade Entitlement Variance" attention item type — auto-flag records where principal exceeds declared grade's tier limit. Surface in executive dashboard and AG reports. Data infrastructure ready (inferredGrade in API, tier lookup in shared).
- [ ] Investigate systematic installments outstanding errors across all MDAs — the ALATISE pattern (wrong month count inflating outstanding balance) may be widespread in legacy MDA spreadsheets.

**Escalated to PM (History Seven — session 2026-04-01):**
PM briefing: `_bmad-output/planning-artifacts/pm-brief-8.0b-uat-escalations.md`
- [ ] **Period indicator during upload** — persistent visual showing which month(s) are being uploaded. Recommended: extend Story 8.0d scope.
- [ ] **MDA Review Handoff Workflow** (unified escalation — replaces separate "MDA officer access" + "correction explanations" items) — three-stage pipeline: (1) smarter batch baseline auto-baselines Clean + Minor, flags Significant+ for MDA review, (2) MDA_ADMIN reviews their MDA's flagged records with mandatory correction explanations, (3) DEPT_ADMIN verifies corrections and baselines. Evidence: Alatishe case — only the MDA account officer had the domain knowledge to identify the 42→22 months error. No new status columns — state inferred from existing correction audit trail. Recommended: 1 story (~10-12 tasks) in E8 after 8.0i prep.
- [ ] **Cross-month anomaly detection** — compare sequential monthly submissions to surface disappearing beneficiaries, principal drift, deduction drift, phantom completions. Evidence: if September data arrives after August, the system should auto-detect inconsistencies. Recommended: new Epic (too large for a single story, 3-5 stories estimated).

**Additional Modified Files (UAT enhancements):**
- `packages/shared/src/constants/tiers.ts` — Added `inferTierFromPrincipal()` reverse lookup
- `packages/shared/src/index.ts` — Exported `inferTierFromPrincipal`
- `apps/server/drizzle/0033_gorgeous_mathemanic.sql` — Migration for corrected_installments_paid/outstanding columns

### Change Log

- 2026-03-31: Story 8.0b implemented — Record Detail View & Pre-Baseline Inspection/Correction Flow. 10 tasks completed. 16 new tests added (11 integration + 2 unit + 3 baseline guard integration). All 1,511 tests pass. No regressions.
- 2026-03-31: UAT-driven enhancements — Outstanding Balance comparison (computed vs declared), Inferred Grade from principal with tier mismatch indicator, Variance Breakdown per field with computation transparency.
- 2026-04-01: UAT-driven enhancement — Installments Outstanding/Paid correction with auto-recompute preview. Migration 0033 adds 2 columns. Account officer validated ALATISE root cause (42 → 22 months data entry error).
- 2026-04-01: Escalated 4 product-level UAT findings to PM (John) for triage — period indicator, MDA officer correction access, mandatory correction explanations, cross-month anomaly detection. See `_bmad-output/planning-artifacts/pm-brief-8.0b-uat-escalations.md`.
- 2026-04-01: Task 10.3 marked complete — manual validation performed during UAT session (Histories 1-5). Guard blocks baseline for impossible outstanding balance, correction flow works, baseline succeeds with corrected values. Escalations 2+3 unified into "MDA Review Handoff Workflow" (three-stage pipeline) in PM brief.
- 2026-04-02: Senior Developer Code Review (AI) — 10 findings (2H/5M/3L), all fixed automatically. H1+H2: replaced Number() financial arithmetic with cents-based utilities. M1: replaced hardcoded tier thresholds with shared constants. M2: added inputMode/pattern to financial inputs. M3: aligned frontend guard with server Decimal.js. M4: clarified auto-recompute UX. M5: added Drizzle meta files to File List. L1: added error state to drawer. L2: fixed record detail cache invalidation after baseline. L3: documented upload-check-outside-transaction pattern. TypeScript clean across all packages.
