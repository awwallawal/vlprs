# Story 8.0a: Migration Computation Model — Scheme Formula & Three-Vector Display

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **Accountant General**,
I want the migration validation to compute loan figures using the authoritative scheme formula (P x 13.33% / 60) and display three comparison vectors (Scheme Expected, Reverse Engineered, MDA Declared),
So that I can see exactly where discrepancies originate — whether from the scheme rules, the MDA's spreadsheet, or the system's rate detection.

**Origin:** UAT Findings #4, #5 from E7+E6 retro (2026-03-29). Awwal's manual calculation exposed that VLPRS reverse-engineers rate from Excel's already-wrong data instead of computing from the authoritative scheme formula.

## Acceptance Criteria

1. **Given** a migration record with principal and tenure, **When** validation runs, **Then** the system computes a Scheme Expected vector using the authoritative formula: Monthly Interest = (Principal x 0.1333) / 60 (always dividing by 60 regardless of tenure), Total Interest = Monthly Interest x Tenure, Total Loan = Principal + Total Interest.

2. **Given** a validated migration record, **When** stored in the database, **Then** three complete vectors are persisted: Scheme Expected (new columns), Reverse Engineered (existing `computed*` columns), and MDA Declared (existing declared columns).

3. **Given** a validated migration record, **When** viewing validation results in the UI, **Then** a three-column comparison displays all three vectors side-by-side for Total Loan, Monthly Deduction, and Total Interest.

4. **Given** all three vectors are computed, **When** determining variance category, **Then** variance is measured as the MAX absolute difference between Scheme Expected and MDA Declared values (not Reverse Engineered vs Declared as before).

5. **Given** three vectors with differences, **When** displayed in the comparison table, **Then** the field with the largest absolute variance is highlighted with an amber indicator.

6. **Given** a record in the expanded computation accordion, **When** viewing computation details, **Then** the exact formula used for each vector is shown with intermediate values (e.g., "Standard Interest = 450,000 x 13.33% = 59,985; Monthly Interest = 59,985 / 60 = 999.75").

7. **Given** a migration record WITHOUT a declared `installmentCount`, **When** computing the Scheme Expected vector, **Then** tenure is inferred from the detected rate tier (e.g., 6.67% -> 30 months) if possible, or marked as "insufficient data" if neither installmentCount nor a known rate tier is available. The system MUST NOT silently default to 60 months.

## Tasks / Subtasks

- [x] Task 1: Add `computeSchemeExpected` function to computationEngine (AC: 1, 7)
  - [x] 1.1: Add `SchemeExpectedResult` type to `packages/shared/src/types/computation.ts` (or relevant shared types file) with fields: `monthlyInterest`, `monthlyPrincipal`, `monthlyDeduction`, `totalInterest`, `totalLoan`, `apparentRate` (all strings)
  - [x] 1.2: Implement `computeSchemeExpected(principal: string, tenureMonths: number): SchemeExpectedResult` in `apps/server/src/services/computationEngine.ts` using Decimal.js — formula: `monthlyInterest = (P x 0.1333) / 60` (ALWAYS divide by 60, never by tenure)
  - [x] 1.3: Add `inferTenureFromRate(computedRate: string): number | null` helper that maps known rate tiers to tenure (13.33%->60, 11.11%->50, 10.66%->48, 8.89%->40, 8.00%->36, 6.67%->30, 5.33%->24) — returns null if rate doesn't match any tier. Use tolerance-based matching (±0.05 absolute), consistent with the existing `matchesKnownTier()` pattern in migrationValidationService, because `computeEffectiveRate()` returns a string with rounding artefacts (e.g., `"6.663"` not `"6.67"`)
  - [x] 1.4: Unit tests in `apps/server/src/services/computationEngine.test.ts`: verify against retro worked example (Principal 450,000 / 30-month -> Monthly Interest 999.75, Total Interest 29,992.50, Total Loan 479,992.50)
  - [x] 1.5: Unit tests in same file: verify all 7 known tenure/apparent-rate pairs produce correct values
  - [x] 1.6: Unit test in same file: verify the /60 invariant — monthly interest is identical for same principal regardless of tenure

- [x] Task 2: Add scheme expected columns to `migration_records` schema (AC: 2)
  - [x] 2.1: Add 3 nullable columns to `migrationRecords` in `apps/server/src/db/schema.ts`: `schemeExpectedTotalLoan` (numeric 15,2), `schemeExpectedMonthlyDeduction` (numeric 15,2), `schemeExpectedTotalInterest` (numeric 15,2)
  - [x] 2.2: Run `drizzle-kit generate` to create a NEW migration (never re-generate existing migrations)
  - [x] 2.3: Verify migration applies cleanly to dev database

- [x] Task 3: Extend shared types for three-vector model (AC: 3)
  - [x] 3.1: Add `SchemeExpectedValues` interface to `packages/shared/src/types/migration.ts` with fields: `totalLoan`, `monthlyDeduction`, `totalInterest` (all `string | null`)
  - [x] 3.2: Extend `ValidationResultRecord` with `schemeExpectedValues: SchemeExpectedValues` field — keep existing `computedValues` field as-is (it represents the reverse-engineered vector)
  - [x] 3.3: Add `apparentRate` field to `ValidationResultRecord` (string | null) — the scheme formula's apparent rate for the detected tenure

- [x] Task 4: Extend `migrationValidationService.validateRecord()` for three-vector computation (AC: 1, 4, 7)
  - [x] 4.1: Import `computeSchemeExpected` and `inferTenureFromRate` from computationEngine
  - [x] 4.2: In `validateRecord()`, after existing rate computation: determine tenure for scheme formula using priority order: (a) `installmentCount` if available AND > 0 (treat null, undefined, 0, and negative as unavailable), (b) `inferTenureFromRate(computedRate)` if rate matches known tier within tolerance, (c) null if neither available
  - [x] 4.3: Compute scheme expected vector if tenure is available — if not, set scheme expected fields to null (don't silently default to 60). Map engine output to API type: `SchemeExpectedResult.totalLoan → SchemeExpectedValues.totalLoan`, `.monthlyDeduction → .monthlyDeduction`, `.totalInterest → .totalInterest` (the remaining engine fields — `monthlyInterest`, `monthlyPrincipal`, `apparentRate` — are used only in the accordion display, not persisted)
  - [x] 4.4: Add scheme expected fields to `RecordValidationResult` interface
  - [x] 4.5: Change variance categorisation: use MAX diff of Scheme Expected vs MDA Declared (instead of Reverse Engineered vs Declared). If scheme expected is null (insufficient data), fall back to existing reverse-engineered comparison
  - [x] 4.6: Update batch SQL in `validateUpload()` to persist new scheme expected columns
  - [x] 4.7: Unit tests in `apps/server/src/services/migrationValidationService.test.ts`: three-vector validation with retro worked example (450,000/30mo) — verify all three vectors differ and variance uses scheme expected
  - [x] 4.8: Unit test in same file: record without installmentCount but with known rate tier -> scheme expected computed from inferred tenure
  - [x] 4.9: Unit test in same file: record with neither installmentCount nor known rate -> scheme expected is null, falls back to reverse-engineered variance

- [x] Task 5: Update `getValidationResults` API response (AC: 3)
  - [x] 5.1: Include `schemeExpectedTotalLoan`, `schemeExpectedMonthlyDeduction`, `schemeExpectedTotalInterest` columns in the query select
  - [x] 5.2: Map scheme expected values into `schemeExpectedValues` field on each `ValidationResultRecord` in the response
  - [x] 5.3: Add `apparentRate` to response — this is a **virtual field** computed at query time from the stored `computedRate` using the tier table (no new DB column needed). Map `computedRate` → apparent rate via `inferTenureFromRate` then `apparentRate = 13.33% × tenure / 60`
  - [x] 5.4: Integration test: POST validate -> GET results -> verify response contains all three vectors

- [x] Task 6: Three-vector display in `RecordComparisonRow` (AC: 3, 5)
  - [x] 6.1: Refactor table layout to show three-column comparison: Scheme Expected | Reverse Engineered | MDA Declared — for Total Loan, Monthly Deduction, and Total Interest rows
  - [x] 6.2: Highlight the cell with the largest absolute variance **between Scheme Expected and MDA Declared** using amber background (non-punitive — no red). This matches the variance pair defined in AC 4
  - [x] 6.3: Add `MetricHelp` tooltips on column headers explaining what each vector represents
  - [x] 6.4: Handle null scheme expected values gracefully — show "Insufficient data" with explanation tooltip

- [x] Task 7: Update `ComputationTransparencyAccordion` (AC: 6)
  - [x] 7.1: Show formula breakdown for Scheme Expected vector: "Standard Interest = P x 13.33% = X; Monthly Interest = X / 60 = Y" with all intermediate values
  - [x] 7.2: Show formula for Reverse Engineered vector: "Detected Rate = ((TotalLoan - Principal) / Principal) x 100 = Z%"
  - [x] 7.3: Non-punitive variance explanation: "A variance of NX was observed between the scheme formula and the declared values" (use VOCABULARY constants)

- [x] Task 8: Update `ValidationSummaryCard` (AC: 4)
  - [x] 8.1: Update rate variance info banner to reference scheme formula: "X record(s) show a variance between the authoritative scheme formula (13.33% / 60) and the declared values"
  - [x] 8.2: Ensure summary counts reflect scheme-vs-declared variance categorisation

- [x] Task 9: Update `IndividualTraceReport` MathBox (AC: 6)
  - [x] 9.1: Add Scheme Expected vector to the rate analysis display alongside existing Apparent Rate and Standard Test sections
  - [x] 9.2: Update conclusion text to reference scheme formula as the authoritative computation

- [x] Task 10: Full regression suite and clean-room validation (AC: all)
  - [x] 10.1: Run full existing test suite — zero regressions required (69 files, 957 tests, 0 failures)
  - [x] 10.2: Run linting and typecheck across monorepo (all pass — shared, server, client)
  - [x] 10.3: Clean-room validation test: upload a known BIR record (Principal 450,000, 30-month), verify all three vector values match manual calculation from AC1

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] Task 5.4 integration test not implemented — `getValidationResults` mapping (apparentRate virtual field, schemeExpectedValues shape) had zero test coverage [migrationValidation.integration.test.ts] — FIXED: 2 integration tests added (three-vector shape + rate-inferred tenure), also fixed `.toString()` → `.toFixed(2)` for apparentRate trailing zeros
- [x] [AI-Review][HIGH] File List missing 2 Drizzle meta files: `_journal.json` and `0031_snapshot.json` — reconciliation FAIL [story File List]
- [x] [AI-Review][HIGH] ComputationTransparencyAccordion formula display broken for rate-inferred tenure — Monthly Interest shows "—" and tenure shows "?" when installmentCount is null but scheme expected was computed via rate inference [ComputationTransparencyAccordion.tsx:72-77]
- [x] [AI-Review][HIGH] MathBox silently defaults tenure to 60 via `?? 60` — violates AC7 [IndividualTraceReport.tsx:93]
- [x] [AI-Review][MEDIUM] Accordion Total Interest row shows `record.interestTotal` (declared) for Rev. Engineered column — should show computed total interest [ComputationTransparencyAccordion.tsx:138]
- [x] [AI-Review][MEDIUM] MathBox uses JS floating-point for financial display values — mitigated by .toFixed(2) but inconsistent with server Decimal.js [IndividualTraceReport.tsx:90-95]
- [x] [AI-Review][MEDIUM] `getLargestVarianceField` return type includes unreachable 'totalInterest' — dead type union member [RecordComparisonRow.tsx:25,30]
- [x] [AI-Review][LOW] Story claims ±0.05 tolerance "consistent with matchesKnownTier()" but matchesKnownTier uses ±0.5 — documentation inaccuracy [story Dev Notes Task 1.3]
- [x] [AI-Review][LOW] Variance MAX includes outstanding balance (RE vs Declared) alongside scheme expected comparisons — reasonable but deviates from AC4 literal wording [migrationValidationService.ts:197-199]

## Dev Notes

### Critical Domain Context: The Scheme Formula

The Oyo State loan scheme uses a single fixed rate (13.33%) with a unique interest calculation that divides by 60 ALWAYS, regardless of the chosen tenure:

```
Standard Interest    = Principal x 13.33%
Monthly Interest     = Standard Interest / 60         <- ALWAYS 60, never the chosen tenure
Monthly Principal    = Principal / Tenure
Monthly Deduction    = Monthly Principal + Monthly Interest
Total Interest       = Monthly Interest x Tenure       = Principal x 13.33% x (Tenure/60)
Total Loan           = Principal + Total Interest
```

**This means the existing `computeRepaymentSchedule()` function CANNOT be reused for scheme expected computation** — it divides `totalInterest / tenure` (line 35 of computationEngine.ts), while the scheme formula divides by 60. A new dedicated function is required.

**Worked Example (from retro — ALATISE BOSEDE SUSAINAH, BIR, Principal 450,000, 30-month tenure):**

| Vector | Monthly Interest | Total Interest | Total Loan |
|--------|-----------------|---------------|------------|
| **Scheme Expected** (Px13.33%/60) | 999.75 | 29,992.50 | **479,992.50** |
| **Reverse Engineered** (6.663% from Excel) | 999.45 | 29,983.50 | 479,983.50 |
| **MDA Declared** (raw Excel values) | 999.50 | 29,985.00 | 479,985.00 |

All three disagree. Scheme Expected is authoritative per domain rules.

### Apparent Rate Table (Known Tiers)

Because monthly interest is always (P x 0.1333)/60, shorter tenures produce lower apparent rates. General formula: `apparentRate = 13.33% × tenure / 60`. Known tiers:

| Tenure (months) | Apparent Rate | Formula |
|-----------------|--------------|---------|
| 60 | 13.33% | 13.33% x 60/60 |
| 50 | 11.11% | 13.33% x 50/60 |
| 48 | 10.66% | 13.33% x 48/60 |
| 40 | 8.89% | 13.33% x 40/60 |
| 36 | 8.00% | 13.33% x 36/60 |
| 30 | 6.67% | 13.33% x 30/60 |
| 24 | 5.33% | 13.33% x 24/60 |

Use this table for `inferTenureFromRate()` — reverse lookup from detected rate to tenure.

### Current Validation Flow (What Exists)

**File:** `apps/server/src/services/migrationValidationService.ts`

1. `computeEffectiveRate(principal, totalLoan)` — reverse-engineers rate: `((totalLoan - principal) / principal) x 100` (line 30-40)
2. `inferTenure(record)` — uses `installmentCount` or `totalLoan/monthlyDeduction` heuristic, defaults to 60 (line 209-230)
3. `validateRecord()` (defined line 85) calls `computeRepaymentSchedule()` with the reverse-engineered rate (computation at lines 122-127)
4. Variance = MAX(abs(declared - computed)) for totalLoan, monthlyDeduction, outstandingBalance (line 140-155)
5. Batch update SQL persists results to `migration_records` (line 312-334)

**What this story changes:**
- ADD scheme expected computation alongside existing reverse-engineered computation
- CHANGE variance categorisation to use scheme expected vs declared (not reverse-engineered vs declared)
- KEEP existing reverse-engineered values for comparison display (extend, don't fork)
- ADD three-vector display on frontend

### Tenure Inference for Scheme Formula (CRITICAL)

The existing `inferTenure()` function (line 209) defaults to 60 months when tenure can't be determined. For scheme expected computation, this silent default is UNACCEPTABLE because it produces wrong values for non-60-month loans.

**New approach for scheme formula tenure:**
1. Use `installmentCount` if available and > 0 (from Excel)
2. If not, use `inferTenureFromRate(computedRate)` to map detected rate to known tenure
3. If neither available -> set scheme expected to null (don't compute, don't default)

**DO NOT modify the existing `inferTenure()` function (line 209)** — it serves the reverse-engineered path and has other callers. Create `inferTenureFromRate()` as a completely separate function in `computationEngine.ts`.

### Schema Change Details

Add 3 nullable columns to `migration_records` table (intentionally NO `schemeExpectedOutstandingBalance` — outstanding balance depends on payment history, not the scheme formula; the cascade problem of outstanding > totalLoan is addressed in Story 8.0b's inspect-and-correct flow):

```typescript
// In apps/server/src/db/schema.ts, inside migrationRecords definition:
schemeExpectedTotalLoan: numeric('scheme_expected_total_loan', { precision: 15, scale: 2 }),
schemeExpectedMonthlyDeduction: numeric('scheme_expected_monthly_deduction', { precision: 15, scale: 2 }),
schemeExpectedTotalInterest: numeric('scheme_expected_total_interest', { precision: 15, scale: 2 }),
```

**Drizzle migration rules:** Generate a NEW migration file. Never re-generate an existing migration. See `docs/drizzle-migrations.md` for full reference.

### Batch SQL Update Pattern

The existing batch update in `validateUpload()` (line 316-334) uses a VALUES-based batch update. Extend it to include the 3 new columns:

```sql
UPDATE migration_records AS mr SET
  -- existing columns
  variance_category = v.vc::variance_category,
  variance_amount = v.va,
  computed_rate = v.cr,
  -- ... existing columns ...
  -- NEW scheme expected columns
  scheme_expected_total_loan = v.setl,
  scheme_expected_monthly_deduction = v.semd,
  scheme_expected_total_interest = v.seti
FROM (VALUES ...) AS v(id, vc, va, cr, hrv, ctl, cmd, cob, setl, semd, seti)
WHERE mr.id = v.id
```

### Frontend Three-Vector Display Pattern

**Precedent:** Story 7.0i implemented three-way reconciliation (Expected vs Declared vs Actual) with a similar comparison display. Adapt the **visual design pattern only** (three-column layout, amber highlight, non-punitive language) — do NOT import or extend 7.0i components (`ThreeWayReconciliationPage.tsx`, `useThreeWayReconciliation.ts`), as those operate on a completely different data model (submission rows vs migration records):
- Three-column layout with headers
- Amber highlight on largest variance cell (Scheme Expected vs MDA Declared)
- Non-punitive language throughout

**Components to modify:**
- `apps/client/src/pages/dashboard/components/RecordComparisonRow.tsx` — main comparison display
- `apps/client/src/pages/dashboard/components/ComputationTransparencyAccordion.tsx` — expanded formula details
- `apps/client/src/pages/dashboard/components/ValidationSummaryCard.tsx` — summary banner
- `apps/client/src/pages/dashboard/components/IndividualTraceReport.tsx` — trace report MathBox

**Shared types to extend:**
- `packages/shared/src/types/migration.ts` — ValidationResultRecord, ValidatedMigrationRecord

### What This Story Does NOT Change

- **Baseline creation logic** — Story 8.0b handles the inspect-and-correct flow before baseline acceptance. This story only adds computation and display — it does NOT block or correct bad data at baseline.
- **Existing reverse-engineered values** — KEPT in `computed*` columns. Extend, don't fork.

### Non-Punitive Vocabulary Reminders

- "Variance" not "Discrepancy" or "Error"
- "Observation" not "Anomaly"
- Amber/teal indicators, NEVER red for variance display
- Source: `packages/shared/src/constants/vocabulary.ts`

### Decimal.js Configuration

All financial arithmetic must use Decimal.js with project-wide config:
```typescript
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });
```
This is already set in both `computationEngine.ts` (line 6) and `migrationValidationService.ts` (line 13).

### Team Agreements Applicable to This Story

- **Extend, don't fork** — Add scheme expected alongside existing reverse-engineered, don't replace
- **Clean-room validation** — After implementation, test with: purge -> upload single known file -> verify every number
- **Role-based UAT walkthrough** — Test as SUPER_ADMIN (uploads), DEPT_ADMIN (views results)
- **N+1 query budget** — The validation query already loads all records in one query; adding 3 columns doesn't change query count
- **Transaction scope** — The batch update already runs in a transaction (line 312); extend, don't add a new transaction

### Previous Story Learnings

**From 7.0a (Financial Precision Hardening):**
- `parseFinancialNumberToDecimal()` returns Decimal objects — use for input parsing
- All money values as strings in types and API responses — never number
- `computeBalanceForLoan()` wrapper handles `limitedComputation` flag for zero-principal loans

**From 7.0i (Three-Way Reconciliation):**
- Three-source comparison pattern: display all three side-by-side, highlight largest variance
- Tolerance thresholds: <1 for "match", configurable for other categories
- Fire-and-forget pattern for async computation (not needed here — validation is synchronous)

### Project Structure Notes

- Server services: `apps/server/src/services/`
- Shared types: `packages/shared/src/types/`
- Client components: `apps/client/src/pages/dashboard/components/`
- Client hooks: `apps/client/src/hooks/useMigration.ts`
- DB schema: `apps/server/src/db/schema.ts`
- Migrations: `apps/server/drizzle/`
- Tests co-located with source files

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#Finding Detail: Three-Vector Computation Model]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0a]
- [Source: .claude/projects/memory/domain_loan_computation.md — Authoritative scheme formula]
- [Source: apps/server/src/services/migrationValidationService.ts — Current validation implementation]
- [Source: apps/server/src/services/computationEngine.ts — Current computation engine]
- [Source: apps/server/src/db/schema.ts#L328 — migration_records schema]
- [Source: packages/shared/src/types/migration.ts — Shared migration types]
- [Source: apps/client/src/pages/dashboard/components/RecordComparisonRow.tsx — Current record display]
- [Source: apps/client/src/pages/dashboard/components/ComputationTransparencyAccordion.tsx — Current formula display]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Typecheck fix: `VARIANCE_NEUTRAL_PREFIX` initially added to `UI_COPY` but referenced via `VOCABULARY` — corrected to use `UI_COPY` consistently

### Completion Notes List

- **Task 1:** Added `SchemeExpectedResult` type, `computeSchemeExpected()` function with /60 invariant, and `inferTenureFromRate()` helper with ±0.05 tolerance matching. 24 new unit tests cover retro worked example, all 7 rate tiers, /60 invariant, and edge cases.
- **Task 2:** Added 3 nullable columns (`scheme_expected_total_loan`, `scheme_expected_monthly_deduction`, `scheme_expected_total_interest`) via migration 0031.
- **Task 3:** Added `SchemeExpectedValues` interface and `apparentRate` field to `ValidationResultRecord`. Extended `ValidatedMigrationRecord` with 3 new DB column fields.
- **Task 4:** Extended `validateRecord()` with separate `inferSchemeExpectedTenure()` (no silent defaults), scheme expected computation, and variance now uses MAX(Scheme Expected vs MDA Declared) with fallback to reverse-engineered. Batch SQL update extended for 3 new columns. 3 new unit tests.
- **Task 5:** `getValidationResults()` now maps scheme expected values and computes `apparentRate` as virtual field at query time.
- **Task 6:** `RecordComparisonRow` refactored to three-column layout (Scheme Expected | Rev. Engineered | MDA Declared) for Total Loan and Monthly Deduction. Amber highlight on largest variance cell. `RecordComparisonHeader` with MetricHelp tooltips. Insufficient data gracefully handled.
- **Task 7:** `ComputationTransparencyAccordion` shows formula breakdown for both vectors. Three-column comparison table. Non-punitive variance explanation.
- **Task 8:** `ValidationSummaryCard` rate variance banner updated to reference "authoritative scheme formula (13.33% ÷ 60)".
- **Task 9:** `IndividualTraceReport` MathBox shows Scheme Expected computation with intermediate values. Conclusion text references scheme formula as authoritative.
- **Task 10:** Full regression suite: 69 files, 957 tests, 0 failures. Typecheck: all 4 packages pass.

### File List

**New files:**
- `apps/server/drizzle/0031_grey_lizard.sql` — Migration: 3 scheme expected columns
- `apps/server/drizzle/meta/0031_snapshot.json` — Drizzle migration snapshot for 0031

**Modified files:**
- `apps/server/drizzle/meta/_journal.json` — Drizzle migration journal updated for migration 0031
- `packages/shared/src/types/computation.ts` — Added `SchemeExpectedResult` interface
- `packages/shared/src/types/migration.ts` — Added `SchemeExpectedValues` interface, `apparentRate` to `ValidationResultRecord`, scheme expected fields to `ValidatedMigrationRecord`
- `packages/shared/src/index.ts` — Exported `SchemeExpectedResult`, `SchemeExpectedValues`
- `packages/shared/src/constants/vocabulary.ts` — Added `VARIANCE_NEUTRAL_PREFIX` to `UI_COPY`
- `packages/shared/src/constants/metricGlossary.ts` — Added `schemeExpected`, `reverseEngineered`, `mdaDeclared` entries to `MIGRATION_HELP`
- `apps/server/src/services/computationEngine.ts` — Added `computeSchemeExpected()`, `inferTenureFromRate()`, rate tier table
- `apps/server/src/services/computationEngine.test.ts` — 24 new tests for scheme expected computation and tenure inference
- `apps/server/src/services/migrationValidationService.ts` — Extended `validateRecord()` with three-vector computation, `inferSchemeExpectedTenure()`, updated variance to use scheme expected, extended batch SQL
- `apps/server/src/services/migrationValidationService.test.ts` — 3 new tests for three-vector validation
- `apps/server/src/db/schema.ts` — Added 3 scheme expected columns to `migrationRecords`
- `apps/client/src/pages/dashboard/components/RecordComparisonRow.tsx` — Refactored to three-column display with `RecordComparisonHeader`
- `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` — Uses new `RecordComparisonHeader`
- `apps/client/src/pages/dashboard/components/ComputationTransparencyAccordion.tsx` — Three-vector formula breakdown and comparison
- `apps/client/src/pages/dashboard/components/ValidationSummaryCard.tsx` — Updated rate variance banner
- `apps/client/src/pages/dashboard/components/IndividualTraceReport.tsx` — Scheme expected vector in MathBox

## Change Log

- **2026-03-30:** Implemented Story 8.0a — Scheme formula computation (P × 13.33% ÷ 60), three-vector display (Scheme Expected / Reverse Engineered / MDA Declared), variance now measured against authoritative scheme formula. 27 new tests, 15 files changed, migration 0031 for 3 new DB columns.
- **2026-03-30:** Code review fixes — Fixed accordion formula display for rate-inferred tenure (H2), MathBox tenure default violating AC7 (H3), Total Interest Rev. Engineered column showing declared values (M1), dead type union member in getLargestVarianceField (M3), added variance comment (L2), updated File List with 2 missing Drizzle meta files (H1). Resolved C1: added 2 integration tests for three-vector response shape + rate-inferred tenure path, fixed apparentRate `.toString()` → `.toFixed(2)` trailing zeros bug.
