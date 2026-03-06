# Story 3.2: Migration Validation, Rate Detection & MDA Delineation

Status: done

<!-- Generated: 2026-03-06 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: 3-1-legacy-upload-intelligent-column-mapping (ready-for-dev) | Blocks: 3-3-staff-loan-profile-cross-mda-timeline, 3-4-baseline-acknowledgment-ledger-entry-creation -->
<!-- FRs: FR26, partial FR87 (rate variance observation), partial FR89 (MDA delineation detection) -->
<!-- Source: epics.md § Epic 3 Story 3.2, sprint-change-proposal-2026-02-28.md § Story 3.2 EXTEND -->

## Story

As a **Department Admin**,
I want imported records automatically validated, categorised by variance severity, and checked for rate anomalies and multi-MDA content,
So that I can focus attention on significant discrepancies while knowing clean records are safe and observations are generated automatically.

### Context

Story 3.1 uploads legacy files and extracts raw records into `migration_records`. This story takes those raw records and runs them through the computation engine to:

1. **Categorise each record** by variance severity (Clean through Anomalous)
2. **Detect interest rate anomalies** — SQ-1 found 577 of 3,449 loans (16.7%) have non-standard rates across 6 tiers
3. **Detect multi-MDA content** — flag files containing records for multiple MDAs (CDU-in-Agriculture pattern)
4. **Generate a validation summary** with non-punitive language

This is the second half of the upload pipeline. After this story, imported records have a variance category and the admin sees a "Comparison Complete" summary. The validation results feed into Story 3.3 (staff profiles), Story 3.4 (baseline acknowledgment), and Story 3.6 (observation engine).

**What this story does NOT do:** Full observation engine with 6 types (Story 3.6), person matching / cross-MDA timelines (Story 3.3), baseline ledger entries (Story 3.4), file delineation UI with boundary adjustment (Story 3.8). This story detects and flags — downstream stories act on the flags.

**Rate tiers from SQ-1 analysis (577 non-standard loans):**

| Rate | Count | % | Notes |
|------|-------|---|-------|
| 13.33% | 2,745 | 79.6% | Standard (expected) |
| 11.11% | 171 | 5.0% | Alternate tier |
| 8.0% | 93 | 2.7% | Correlates with 36-month tenure |
| 8.89% | 92 | 2.7% | Pattern-based variant |
| 10.66% | 75 | 2.2% | Rare variant |
| 6.67% | 45 | 1.3% | Rarest variant |

## Acceptance Criteria

### AC 1: Record Variance Categorisation

**Given** a processed migration upload (from Story 3.1) with extracted `migration_records`
**When** the system validates each record against the computation engine
**Then** each record is categorised as one of (FR26):
- **Clean** — declared values match computed values within ₦1 (sub-kobo rounding noise only)
- **Minor Variance** — difference between ₦1 and ₦499 (real but small — always surfaced, never hidden)
- **Significant Variance** — difference ≥₦500 (substantial — demands attention)
- **Structural Error** — wrong rate or formula detected (rate differs from 13.33% AND values don't match any known rate tier)
- **Anomalous** — unexplainable by any known pattern
**And** the variance category is stored on the `migration_records` row
**And** the variance amount (₦) is stored for sorting/filtering

### AC 2: Interest Rate Detection

**Given** the validation step
**When** a record has both `principal` and `totalLoan` values
**Then** the system computes the effective interest rate: `(totalLoan - principal) / principal × 100`
**And** compares against the standard 13.33%
**And** if the rate differs, checks against known rate tiers (6.67%, 8.0%, 8.89%, 10.66%, 11.11%)
**And** stores the computed rate on the migration record
**And** if rate differs from 13.33%, flags the record with `has_rate_variance = true` and stores the computed rate for the observation engine (Story 3.6, partial FR87)

### AC 3: Multi-MDA Detection

**Given** a single uploaded file with extracted records
**When** the system scans the MDA column values across records
**Then** if records contain values for multiple MDAs within the same sheet (e.g., "COCOA DEVELOPMENT UNIT" marker mid-sheet in an Agriculture file):
- The upload is flagged with `has_multi_mda = true`
- Detected MDA boundaries are stored: start row, end row, detected MDA name, record count, confidence score
- The flag is surfaced in the validation summary for the admin (partial FR89)
**And** actual boundary adjustment and record re-assignment is deferred to Story 3.8 (FileDelineationPreview)

### AC 4: Validation Summary

**Given** the categorisation result
**When** Department Admin views the migration validation report
**Then** a summary shows: count and percentage per category (e.g., "Clean: 14 records (61%), Minor Variance: 5 (22%)...")
**And** the header reads "Comparison Complete" (not "Errors Found" or "Validation Results")
**And** all language is non-punitive per `vocabulary.ts`
**And** records with rate variances are highlighted with an amber indicator (never red)
**And** multi-MDA detection results are shown if applicable

### AC 5: Validation Triggers Automatically

**Given** a migration upload that has completed record extraction (Story 3.1 status: 'completed')
**When** the admin triggers validation (or it auto-runs after extraction confirmation)
**Then** all records in the upload are validated in a single batch
**And** the upload status advances from 'completed' to 'validated'
**And** the validation results are persisted (category per record, summary per upload)
**And** processing completes within reasonable time (500 records should validate in <30 seconds)

### AC 6: Validation Result API

**Given** a validated upload
**When** the client requests `GET /api/migrations/:id/validation`
**Then** the response includes:
- Per-category summary: `{ clean: N, minorVariance: N, significantVariance: N, structuralError: N, anomalous: N }`
- Per-record detail: `{ recordId, staffName, varianceCategory, varianceAmount, computedRate, declaredValues, computedValues }`
- Multi-MDA flag and detected boundaries (if applicable)
- Rate variance flag count
**And** results are filterable by category, sortable by variance amount

## Tasks / Subtasks

- [x] Task 1: Schema additions for validation results (AC: 1, 2, 3)
  - [x] 1.1 Add columns to `migration_records` in `apps/server/src/db/schema.ts`:
    - `variance_category` (enum: 'clean', 'minor_variance', 'significant_variance', 'structural_error', 'anomalous', nullable — null before validation)
    - `variance_amount` (numeric 15,2 nullable — absolute ₦ difference)
    - `computed_rate` (numeric 6,3 nullable — effective interest rate %)
    - `has_rate_variance` (boolean, default false)
    - `computed_total_loan` (numeric 15,2 nullable — system-computed total)
    - `computed_monthly_deduction` (numeric 15,2 nullable)
    - `computed_outstanding_balance` (numeric 15,2 nullable)
  - [x] 1.2 Add columns to `migration_uploads`:
    - `has_multi_mda` (boolean, default false)
    - `multi_mda_boundaries` (jsonb nullable — `[{ startRow, endRow, detectedMda, recordCount, confidence }]`)
    - `validation_summary` (jsonb nullable — `{ clean, minorVariance, significantVariance, structuralError, anomalous, rateVarianceCount }`)
  - [x] 1.3 Add 'validated' to the `migration_upload_status` enum (after 'completed')
  - [x] 1.4 Run `drizzle-kit generate` for migration SQL

- [x] Task 2: Validation service (AC: 1, 2, 5)
  - [x] 2.1 Create `apps/server/src/services/migrationValidationService.ts`:
    - `validateUpload(uploadId)` — batch validate all records in an upload
    - `validateRecord(record)` — validate single migration_record against computation engine
    - `computeEffectiveRate(principal, totalLoan)` — `(totalLoan - principal) / principal × 100` using Decimal.js
    - `categoriseVariance(declaredBalance, computedBalance, computedRate)` — returns variance category + amount
  - [x] 2.2 Implement rate tier detection: check computed rate against known tiers `[6.67, 8.0, 8.89, 10.66, 11.11, 13.33]` with ±0.5% tolerance (rounding differences)
  - [x] 2.3 Implement variance categorisation logic:
    - Compute expected values using `computeRepaymentSchedule()` from computationEngine
    - Compare declared vs computed for: totalLoan, monthlyDeduction, outstandingBalance
    - Use the largest absolute difference for category threshold
    - Handle missing fields gracefully (many Era 1 records lack interest breakdown)
  - [x] 2.4 Implement batch validation: validate all records in upload atomically, update each record's variance columns, compute upload-level summary, update upload status to 'validated'
  - [x] 2.5 Write unit tests for rate computation and categorisation edge cases

- [x] Task 3: Multi-MDA detection (AC: 3)
  - [x] 3.1 Create `apps/server/src/migration/mdaDelineation.ts`:
    - `detectMultiMda(records)` — scan MDA column values for changes within a sheet
    - Returns: `{ hasMultiMda: boolean, boundaries: MdaBoundary[] }`
  - [x] 3.2 CDU detection: check for "COCOA DEVELOPMENT UNIT", "CDU", "COCOA", "TCDU" values in MDA column using existing `mdaService.resolveMdaByName()` to resolve each MDA value
  - [x] 3.3 Confidence scoring: exact MDA name match = High, alias match = Medium, ambiguous = Low
  - [x] 3.4 Store boundaries on upload record in `multi_mda_boundaries` JSONB
  - [x] 3.5 Write unit tests for CDU-in-Agriculture detection using regression fixtures (fixture #5: `agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx`)

- [x] Task 4: Validation routes and API (AC: 4, 5, 6)
  - [x] 4.1 Add to `apps/server/src/routes/migrationRoutes.ts`:
    - `POST /api/migrations/:id/validate` — trigger validation for an upload
    - `GET /api/migrations/:id/validation` — get validation results (summary + per-record detail)
  - [x] 4.2 Apply same middleware stack as Story 3.1: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, auditLog]`
  - [x] 4.3 Implement response shape: `{ summary: {...}, records: [...], multiMda: {...} }`
  - [x] 4.4 Add pagination for records list (default 50 per page, sortable by variance_amount desc)
  - [x] 4.5 Write route integration tests

- [x] Task 5: Shared types and schemas (AC: all)
  - [x] 5.1 Add to `packages/shared/src/types/migration.ts`:
    - `VarianceCategory` enum: 'clean' | 'minor_variance' | 'significant_variance' | 'structural_error' | 'anomalous'
    - `ValidationSummary` type: counts per category + rate variance count
    - `MdaBoundary` type: startRow, endRow, detectedMda, recordCount, confidence
    - `ValidatedMigrationRecord` type extending MigrationRecord with computed values
  - [x] 5.2 Add to `packages/shared/src/validators/migrationSchemas.ts`: validation result query schema
  - [x] 5.3 Add non-punitive vocabulary to `packages/shared/src/constants/vocabulary.ts` (note: `UI_COPY.COMPARISON_COMPLETE` already exists — do NOT duplicate; add new constants alongside it):
    - `VARIANCE_CATEGORY_LABELS: { clean: 'Clean', minor_variance: 'Minor Variance', ... }`
    - `RATE_VARIANCE_DESCRIPTION: 'Rate differs from standard — for review'`

- [x] Task 6: Frontend — validation results UI (AC: 4)
  - [x] 6.1 Add validation hooks to `apps/client/src/hooks/useMigration.ts`: `useValidateUpload()`, `useValidationResults()`
  - [x] 6.2 Extend MigrationPage with validation result view:
    - "Comparison Complete" header (from vocabulary constants)
    - Category breakdown bar chart (teal for Clean, gold for variances, grey for Anomalous — never red)
    - Records table filterable by category, sortable by variance amount
    - Each record row: staff name, declared values, computed values, variance amount, category badge
    - Rate variance indicator: amber info badge with rate comparison
    - Multi-MDA banner (if detected): "This file contains records for multiple MDAs — review recommended"
  - [x] 6.3 Create `ValidationSummaryCard` component: category counts + percentages, progress-bar style breakdown
  - [x] 6.4 Create `RecordComparisonRow` component: declared vs computed side-by-side for a single record

- [x] Task 7: Regression validation (AC: all)
  - [x] 7.1 Create `apps/server/src/services/migrationValidationService.test.ts`:
    - Test variance categorisation for known values (hand-computed)
    - Test rate computation: `(283325 - 250000) / 250000 × 100 = 13.33%` (Tier 1 standard)
    - Test rate variance: `(486000 - 450000) / 450000 × 100 = 8.0%` (OLANIYAN case)
    - Test multi-MDA detection on Agriculture fixture (fixture #5)
    - Test edge cases: missing principal (can't compute rate), missing totalLoan, Era 1 minimal records
  - [x] 7.2 Run full test suite — zero regressions

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] Task 4.5 route integration tests — create `apps/server/src/routes/migrationValidation.integration.test.ts` covering POST /validate, GET /validation, auth, pagination, schema validation [migrationRoutes.ts:122-152]
- [x] [AI-Review][HIGH] N+1 DB update in validateUpload — refactored to batch UPDATE using VALUES clause (100 records/batch) [migrationValidationService.ts:318-333]
- [x] [AI-Review][HIGH] Structural errors returned null computed values — now continues computation to provide comparison data [migrationValidationService.ts:107-117]
- [x] [AI-Review][MEDIUM] Incomplete File List — added drizzle/meta/_journal.json and drizzle/meta/0009_snapshot.json [story file]
- [x] [AI-Review][MEDIUM] Step indicator didn't show validation phase — added 5th step for comparison [MigrationPage.tsx:128-139]
- [x] [AI-Review][MEDIUM] RecordComparisonRow loose floating-point rate comparison — replaced with tolerance check [RecordComparisonRow.tsx:51]
- [x] [AI-Review][MEDIUM] Zero-record uploads validated silently — added guard throwing AppError [migrationValidationService.ts:292]
- [x] [AI-Review][LOW] Dead code in partial validation path — removed unreachable block [migrationValidationService.ts:192-208]
- [x] [AI-Review][LOW] Fragile camelCase-to-snake_case mapping — extracted to CATEGORY_FILTER_KEYS lookup [ValidationSummaryCard.tsx:60-67]
- [x] [AI-Review][LOW] MDA delineation test missing boundary assertions — added startRow, endRow, recordCount checks [mdaDelineation.test.ts:137-149]

## Dev Notes

### Critical Context

This story builds directly on Story 3.1's `migration_records` table. Every record extracted in 3.1 now gets validated against the computation engine. The key insight from SQ-1: **16.7% of loans have non-standard interest rates. These are NOT errors — they reflect valid alternate rate tiers.** The categorisation must distinguish between "rate differs from standard" (expected, just needs acknowledgment) and "values are mathematically inconsistent" (genuine structural error).

### Rate Computation Formula

**Effective rate from declared values:**
```typescript
import Decimal from 'decimal.js';

function computeEffectiveRate(principal: string, totalLoan: string): string | null {
  if (!principal || !totalLoan) return null;
  const p = new Decimal(principal);
  const t = new Decimal(totalLoan);
  if (p.isZero()) return null;
  // effectiveRate = (totalLoan - principal) / principal × 100
  return t.minus(p).div(p).mul(100).toDecimalPlaces(3).toString();
}
```

**Known rate tiers** (match with ±0.5% tolerance for rounding):
```typescript
const KNOWN_RATE_TIERS = [6.67, 8.0, 8.89, 10.66, 11.11, 13.33];
const STANDARD_RATE = 13.33;
const RATE_TOLERANCE = 0.5; // % tolerance for rounding differences
```

**Verification (from SQ-1 OLANIYAN case):**
- Principal: ₦450,000, Declared Total: ₦485,991
- Rate: `(485991 - 450000) / 450000 × 100 = 7.998%` → rounds to 8.0% ✓
- Cross-check: `450000 × 1.08 = 486000` (Δ₦9 = rounding) ✓

### Variance Categorisation Algorithm

```
For each migration_record:
  1. Extract declared values: principal, totalLoan, monthlyDeduction, outstandingBalance

  2. If principal AND totalLoan exist:
     → computedRate = (totalLoan - principal) / principal × 100
     → If computedRate ≠ 13.33% (beyond tolerance):
        → Check if computedRate matches a KNOWN_RATE_TIER
        → has_rate_variance = true
        → Use computedRate (not 13.33%) for expected value computation

  3. If sufficient fields exist for computation:
     → Use computeRepaymentSchedule(principal, rate, tenure) from computationEngine
     → Compare declared monthly deduction vs computed
     → Compare declared outstanding balance vs computed
     → varianceAmount = max(|declaredBalance - computedBalance|, |declaredDeduction - computedDeduction|)

  4. Categorise:
     → varianceAmount < 1           → 'clean' (sub-kobo rounding noise)
     → varianceAmount 1-499         → 'minor_variance' (real but small — always surfaced)
     → varianceAmount ≥ 500         → 'significant_variance' (substantial — demands attention)
     → rate not in KNOWN_RATE_TIERS → 'structural_error'
     → no pattern matches           → 'anomalous'

  5. Edge cases (many Era 1 records):
     → Missing principal or totalLoan → skip rate computation, categorise on available fields
     → Missing monthlyDeduction → skip deduction comparison
     → All financial fields null → 'anomalous' (no data to validate)
     → Only staffName present → 'anomalous' with note "Insufficient data for validation"
```

### Using the Existing Computation Engine

`computationEngine.ts` provides `computeRepaymentSchedule(params)`:

```typescript
interface ComputationParams {
  principalAmount: string;   // e.g., "250000.00"
  interestRate: string;      // e.g., "13.330" (% per annum, flat rate)
  tenureMonths: number;      // e.g., 60
  moratoriumMonths: number;  // typically 0 for migration
}

interface RepaymentSchedule {
  totalInterest: string;
  totalLoan: string;
  monthlyPrincipal: string;
  monthlyInterest: string;
  monthlyDeduction: string;
  // ... schedule array with 60 rows
}
```

**For migration validation**, the challenge is that **tenure is often not explicitly stated**. Approach:
- If `installmentCount` is present → use as tenure
- If `monthlyDeduction` AND `totalLoan` are present → infer tenure: `Math.ceil(totalLoan / monthlyDeduction)`
- If neither available → use standard 60-month default, flag as "tenure inferred"
- Always record the inference method for transparency

### Multi-MDA Detection (CDU-in-Agriculture Pattern)

SQ-1 discovered that **every Agriculture file** has "COCOA DEVELOPMENT UNIT" as a marker in the MDA column mid-sheet. Detection algorithm:

```
For each sheet in upload:
  mdaValues = Set()
  For each migration_record in sheet (ordered by source_row):
    If record.mda field is present AND non-empty:
      resolvedMda = mdaService.resolveMdaByName(record.mda)
      mdaValues.add(resolvedMda.code || record.mda)

  If mdaValues.size > 1:
    hasMultiMda = true
    For each MDA boundary change:
      Store: { startRow, endRow, detectedMda, recordCount, confidence }
```

The `mda` canonical field from column mapping (Story 3.1) already captures the raw MDA column value per record. This story just needs to scan those values for changes.

CDU alias variants to match (from SQ-1 / Story 3.0b):
- `CDU`, `COCOA DEVELOPMENT UNIT`, `OYO STATE COCOA DEVELOPMENT UNIT`, `COCOA`, `TCDU`

All should resolve to MDA code `CDU` via `mdaService.resolveMdaByName()`.

### Service Boundaries (from architecture.md)

```
migrationValidationService (NEW — this story)
  ├── Calls: computationEngine (for expected values), mdaService (for MDA resolution)
  ├── Reads: migration_records (from Story 3.1)
  ├── Writes: migration_records (variance columns), migration_uploads (summary, multi-mda flag)
  └── Never: ledgerService, observationEngine (those are downstream stories)
```

This service is deliberately separated from `migrationService` (Story 3.1) because:
- Different concern (extraction vs validation)
- Can be tested independently
- Will be called by the observation engine (Story 3.6) as a dependency

### Non-Punitive Language Requirements

**Headers and labels:**
- "Comparison Complete" NOT "Validation Results" or "Errors Found"
- "Variance" NOT "Error" or "Discrepancy"
- "For review" NOT "Flagged" or "Suspect"
- "Rate differs from standard" NOT "Wrong rate" or "Rate error"
- "Requires clarification" NOT "Suspicious" or "Questionable"

**Category display colours:**
- Clean → teal badge
- Minor Variance → light gold badge
- Significant Variance → gold badge
- Structural Error → amber badge
- Anomalous → grey badge with info icon
- **NEVER red** for any migration data observation

**Vocabulary constants** to add (extend existing `vocabulary.ts`):
```typescript
// Migration validation
COMPARISON_COMPLETE: 'Comparison Complete',
VARIANCE_CLEAN: 'Clean — values match computed schedule',
VARIANCE_MINOR: 'Minor Variance — small difference within tolerance',
VARIANCE_SIGNIFICANT: 'Significant Variance — requires review',
VARIANCE_STRUCTURAL: 'Rate Variance — rate differs from standard',
VARIANCE_ANOMALOUS: 'Requires clarification — no matching pattern found',
RATE_DIFFERS: 'Rate differs from the standard 13.33% — this is an observation for review, not an error',
MULTI_MDA_DETECTED: 'This file contains records for multiple MDAs — review recommended before proceeding',
INSUFFICIENT_DATA: 'Insufficient data for full validation — available fields compared',
```

### Existing Codebase Patterns to Follow

All patterns from Story 3.1 Dev Notes apply here. Additional notes:

**Computation engine usage:** Import and call `computeRepaymentSchedule` — do NOT reimplement financial math. All arithmetic via `decimal.js`.

**Service pattern:** Follow `mdaService.ts` — export async functions, accept `mdaScope`, throw `AppError`, use `VOCABULARY` constants.

**Schema pattern:** Add columns to existing `migration_records` and `migration_uploads` tables (Story 3.1 creates them). Use `numeric(15,2)` for money, `boolean` for flags, `jsonb` for structured metadata.

### What NOT To Do

1. **DO NOT reimplement interest rate computation** — use `computeRepaymentSchedule()` from `computationEngine.ts`. It uses `decimal.js` with proper precision
2. **DO NOT use floating-point for rate comparison** — use `Decimal.js`. The 0.5% tolerance must be computed with Decimal arithmetic
3. **DO NOT treat rate variances as errors** — SQ-1 proved 6 valid rate tiers exist. "Structural Error" category should only be used when the rate doesn't match ANY known tier
4. **DO NOT implement the full observation engine** — that's Story 3.6. This story flags records with `has_rate_variance` and stores computed rates. Story 3.6 generates the actual observation records with templates
5. **DO NOT implement file delineation UI** — that's Story 3.8 (FileDelineationPreview). This story only detects multi-MDA content and stores boundary data
6. **DO NOT implement cross-MDA person matching** — that's Story 3.3. This story validates records within a single upload, not across uploads
7. **DO NOT create ledger entries** — that's Story 3.4. This story produces validated migration_records, not loans or ledger entries
8. **DO NOT use red colours or punitive language** — amber/gold for attention, grey for anomalous, teal for clean. Never red.
9. **DO NOT skip Era 1 records** — they have fewer fields (no interest breakdown, no MDA column) but should still be categorised. Missing fields → reduced validation scope, not rejection
10. **DO NOT assume all records have principal AND totalLoan** — Era 1 records may lack these. Compute rate only when both are present; otherwise categorise on available fields

### Project Structure Notes

New files:
```
apps/server/src/
├── services/
│   ├── migrationValidationService.ts      # Validation, rate detection, categorisation
│   └── migrationValidationService.test.ts
├── migration/
│   ├── mdaDelineation.ts                  # Multi-MDA detection logic
│   └── mdaDelineation.test.ts

apps/client/src/
├── pages/dashboard/
│   └── components/
│       ├── ValidationSummaryCard.tsx       # Category breakdown + bar chart
│       └── RecordComparisonRow.tsx         # Declared vs computed side-by-side
```

Modified files:
```
apps/server/src/db/schema.ts               # Add validation columns to migration tables
apps/server/src/routes/migrationRoutes.ts   # Add validate + validation-results endpoints
apps/client/src/hooks/useMigration.ts       # Add validation hooks
apps/client/src/pages/dashboard/MigrationPage.tsx  # Add validation results view
packages/shared/src/types/migration.ts      # Add variance/validation types
packages/shared/src/validators/migrationSchemas.ts # Add validation schemas
packages/shared/src/constants/vocabulary.ts # Add migration validation vocabulary
```

### Dependencies

- **Depends on:** Story 3.1 (migration_records table and data extraction), Story 3.0b (CDU parent/agency for MDA resolution)
- **Blocks:** Story 3.3 (uses variance_category for display), Story 3.4 (baseline acknowledgment requires validated records), Story 3.6 (observation engine reads has_rate_variance flags)
- **Reuses:** `computationEngine.ts` (computeRepaymentSchedule), `mdaService.ts` (resolveMdaByName), `vocabulary.ts` (non-punitive constants)

### Previous Story Intelligence (from Story 3.1)

- `migration_records` table has all 24 canonical fields as nullable columns (22 from SQ-1 + dateOfBirth + dateOfFirstAppointment)
- Records include `source_file`, `source_sheet`, `source_row` for traceability
- Era detection already done per record (stored on migration_records)
- Period (year/month) already extracted per record
- Financial values stored as NUMERIC strings (decimal.js compatible)
- Extra fields stored separately in `migration_extra_fields`
- Upload status progression: uploaded → mapped → processing → completed → (this story adds) validated

### UAT Checkpoint

After Stories 3.1 + 3.2: **"First legacy upload through UI — Awwal validates against SQ-1 output for same file."** Use one of the 7 regression fixture files. Awwal should see:
- Upload succeeds (Story 3.1)
- "Comparison Complete" summary with category breakdown (this story)
- Rate variance records highlighted with amber badges
- All values matching what SQ-1 computed for the same file

### References

- [Source: `apps/server/src/services/computationEngine.ts`] — computeRepaymentSchedule, autoSplitDeduction, computeBalanceFromEntries
- [Source: `apps/server/src/services/computationEngine.test.ts`] — Hand-verified test cases (250K/13.33%/60mo, 750K, moratorium, edge cases)
- [Source: `apps/server/src/services/mdaService.ts`] — resolveMdaByName (4-layer matching) for MDA detection
- [Source: `packages/shared/src/constants/vocabulary.ts`] — Non-punitive vocabulary constants
- [Source: `scripts/legacy-report/crossref.ts`] — SQ-1 rate computation, person timelines, CDU delineation
- [Source: `tests/fixtures/legacy-migration/agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx`] — Multi-MDA fixture (CDU in Agriculture)
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md` § Story 3.2 EXTEND] — Detailed scope with rate tiers and delineation
- [Source: `_bmad-output/planning-artifacts/prd.md` § FR26] — Variance categorisation requirement
- [Source: `_bmad-output/planning-artifacts/prd.md` § FR87] — Observation engine (partial — rate variance detection in this story)
- [Source: `_bmad-output/planning-artifacts/prd.md` § FR89] — MDA delineation (partial — detection in this story)
- [Source: `_bmad-output/planning-artifacts/architecture.md` § Data Flow: Observation Pipeline] — Migration → validation → observation pipeline
- [Source: `_bmad-output/planning-artifacts/architecture.md` § Service Boundaries`] — migrationService, comparisonEngine, observationEngine dependencies
- [Source: `_bmad-output/implementation-artifacts/3-1-legacy-upload-intelligent-column-mapping.md`] — Predecessor story (migration_records schema, canonical fields, row filtering)
- [Source: `_bmad-output/implementation-artifacts/3-0a-regression-fixture-suite.md`] — Fixture files and expected outputs for regression testing

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None required — no blocking issues during implementation.

### Completion Notes List

- Task 1: Added `variance_category` enum and 7 validation columns to `migration_records`, 3 columns to `migration_uploads`, 'validated' status to upload enum. Migration `0009_sleepy_sauron.sql` generated and applied.
- Task 2: Created `migrationValidationService.ts` with `computeEffectiveRate()`, `validateRecord()`, `validateUpload()`, `getValidationResults()`. Uses Decimal.js for all financial arithmetic. Rate tier detection with 6 known tiers and ±0.5% tolerance. Variance categorisation: clean (<₦1), minor (₦1-499), significant (≥₦500), structural (unknown rate tier), anomalous (no data). Tenure inference from installmentCount → monthlyDeduction/totalLoan → default 60.
- Task 3: Created `mdaDelineation.ts` with `detectMultiMda()`. Scans mdaText values for boundary changes, resolves via `resolveMdaByName()`, assigns confidence (high/medium/low). Handles CDU-in-Agriculture pattern.
- Task 4: Added `POST /api/migrations/:id/validate` and `GET /api/migrations/:id/validation` routes with same middleware stack as Story 3.1. Pagination, filtering by category, sorting by variance_amount/staff_name/source_row.
- Task 5: Added `VarianceCategory`, `ValidationSummary`, `MdaBoundary`, `ValidatedMigrationRecord`, `ValidationResultRecord`, `ValidationResult` types. Added `validationResultQuerySchema`. Extended vocabulary with non-punitive validation constants and UI_COPY with category labels.
- Task 6: Added `useValidateUpload()` and `useValidationResults()` hooks. Created `ValidationSummaryCard` (progress bar breakdown, category counts, multi-MDA banner, rate variance info) and `RecordComparisonRow` (declared vs computed side-by-side). Extended MigrationPage with validation flow (complete → validating → validated steps).
- Task 7: 27 unit tests for validation service (rate computation, tier matching, variance categorisation, edge cases), 9 unit tests for MDA delineation. All 36 new tests pass. Full suite: 657 passed, 4 pre-existing EDUCATION fixture timeouts (not related to this story).

### Change Log

- 2026-03-06: Story 3.2 implementation complete — migration validation, rate detection, MDA delineation
- 2026-03-06: Code review (AI) — 10 findings (3 high, 4 medium, 3 low), all fixed: route integration tests added, N+1→batch UPDATE, structural errors now compute values, step indicator extended, dead code removed, zero-record guard added, float comparison fixed, category mapping refactored, MDA test assertions added

### File List

New files:
- apps/server/src/services/migrationValidationService.ts
- apps/server/src/services/migrationValidationService.test.ts
- apps/server/src/migration/mdaDelineation.ts
- apps/server/src/migration/mdaDelineation.test.ts
- apps/server/drizzle/0009_sleepy_sauron.sql
- apps/server/drizzle/meta/0009_snapshot.json
- apps/server/src/routes/migrationValidation.integration.test.ts
- apps/client/src/pages/dashboard/components/ValidationSummaryCard.tsx
- apps/client/src/pages/dashboard/components/RecordComparisonRow.tsx

Modified files:
- apps/server/src/db/schema.ts
- apps/server/drizzle/meta/_journal.json
- apps/server/src/routes/migrationRoutes.ts
- apps/client/src/hooks/useMigration.ts
- apps/client/src/pages/dashboard/MigrationPage.tsx
- packages/shared/src/types/migration.ts
- packages/shared/src/validators/migrationSchemas.ts
- packages/shared/src/constants/vocabulary.ts
- packages/shared/src/index.ts
- _bmad-output/implementation-artifacts/sprint-status.yaml
