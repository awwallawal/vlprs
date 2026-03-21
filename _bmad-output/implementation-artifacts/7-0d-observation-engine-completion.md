# Story 7.0d: Observation Engine Completion

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **development team**,
I want all planned observation detectors operational and column mapping gaps fixed,
So that the Epic 7 exception queue receives complete, accurate observation data from migration uploads.

## Acceptance Criteria

### AC 1: CDU Alias Cleaned Up

**Given** the `mda_aliases` table contains a `'CDU'` alias entry
**When** the alias resolution algorithm runs with input `"CDU"`
**Then** Layer 1 (exact code match) resolves it directly — the redundant alias entry is removed from seed data and a comment documents why it's unnecessary

### AC 2: Approval Match Detector Operational

**Given** a migration upload has been processed and live submission data exists for the same MDA
**When** the observation engine runs
**Then** a `no_approval_match` detector cross-references migration staff names against staff IDs in confirmed `submission_rows` for the same MDA, generating observations for migration staff who have no corresponding submission record

### AC 3: detectMdaFromExtraFields Implemented

**Given** a migration upload where the MDA column was not detected in the standard column mapping
**When** the delineation engine runs `detectMdaFromExtraFields()`
**Then** the function samples extra fields from migration records, tests each field's values against `resolveMdaByName()`, and if >50% of values resolve to known MDAs, updates `migration_records.mdaText` and returns `true` to re-trigger boundary detection

### AC 4: Period Overlap Warning at Upload Time

**Given** a Department Admin uploads a legacy file for a period+MDA combination that already has migration records
**When** the upload is confirmed via `confirmMapping()`
**Then** the system warns the user with: "Existing upload found for [period] + [MDA] with [N] records. This upload contains [M] records. Proceed?" and requires explicit confirmation before processing

### AC 5: Period Overlap Observation Type

**Given** an upload that overlaps an existing period+MDA
**When** the observation engine runs (after user confirms upload)
**Then** a `period_overlap` observation (Type 7) is auto-generated with: both upload IDs, record count comparison, period and MDA details
**And** the observation feeds into Story 7.0g's supersede workflow

### AC 6: OUTSTANDING BAL. Column Mapping Fixed

**Given** a legacy Excel file with column header `OUTSTANDING BAL.` or `BAL` or `BAL.`
**When** the column mapper processes the header
**Then** it correctly maps to the `outstandingBalance` canonical field
**And** existing regression fixture tests still pass

### AC 7: Summary Sheet Filtering

**Given** a multi-sheet Excel file where one sheet is a summary (e.g., totals only, fewer than 4 mapped data columns)
**When** the migration upload processes sheets
**Then** sheets with fewer than 4 mapped canonical fields are flagged as "likely summary" and excluded from data processing
**And** a note is recorded in the upload result indicating which sheets were skipped and why

### AC 8: Accelerated Rate Labeling

**Given** a migration record with an effective rate matching a known accelerated tenure (11.11%→50m, 8.89%→40m, 6.67%→30m, etc.)
**When** the observation engine generates a rate variance observation
**Then** the description reads "Accelerated Repayment Detected — X-month tenure" instead of generic "Rate Variance"
**And** the observation context includes the matched tenure and expected rate

### AC 9: Grade-Tier Cross-Validation

**Given** a migration record with a captured grade level and principal amount
**When** the observation engine runs
**Then** if the principal exceeds the max eligible amount for the staff's grade-level tier (from `LOAN_TIERS`), a `grade_tier_mismatch` observation is generated: "Staff at GL X has principal ₦Y, max eligible ₦Z"

### AC 10: Non-Standard Rate Investigation

**Given** migration records with effective rates of 5.56%, 4.44%, or 3.70% (found in BIR UAT file)
**When** the observation engine generates rate observations
**Then** these rates are labeled distinctly: "Non-Standard Rate — does not correspond to any standard tenure. Requires manual verification against loan approval records."
**And** the observation context includes the computed tenure equivalent (25m, 20m, ~17m)

## Dependencies

- **Depends on:** Story 7.0c (Test Suite Integrity) — 7.0c adds query counter middleware (new detectors must stay under 10-query budget per request), establishes integration test patterns for real-DB testing. No schema changes in 7.0c, so 7.0d's migration (0025) follows 7.0b's 0024 without conflict
- **Blocks:** Story 7.0e and all downstream prep stories (7.0f–7.0g), plus all Epic 7 feature stories (7.1+). Story 7.0g (Supersede Workflow) directly consumes the `period_overlap` observation type added here
- **Sequence:** 7.0a → 7.0b → 7.0c → **7.0d** → 7.0e + 7.0f (parallel) → 7.0g → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: CDU Alias Cleanup (AC: 1)
  - [x] 1.1 Remove the redundant `'CDU'` entry from the `cduAliases` array in `apps/server/src/db/seed-demo.ts` (line 293) — keep the other 4 aliases (COCOA DEVELOPMENT UNIT, OYO STATE COCOA DEVELOPMENT UNIT, COCOA, TCDU)
  - [x] 1.2 Add a comment in `seed-demo.ts` explaining why `'CDU'` is not seeded as an alias: "CDU resolves via Layer 1 exact code match — alias entry would be unreachable (see mdaService.ts:96)"
  - [x] 1.3 Verify `mdaService.test.ts` tests still pass — CDU resolution works via Layer 1 code match

- [x] Task 2: Approval Match Detector (AC: 2)
  - [x] 2.1 Implement `detectNoApprovalMatch()` in `observationEngine.ts` — replace the commented-out stub at lines 139-141
  - [x] 2.2 Logic: For each migration record's staff, cross-reference against live submission data. **Join path:** migration_records → loans (via `migration_records.loanId` after baseline) → staffProfiles (via `loans.staffProfileId`) → check if `staffProfiles.staffId` exists in `submission_rows` joined to `mda_submissions` (where `status = 'confirmed'` and `source != 'historical'`) for the same MDA. For migration records not yet baselined (no loanId), fall back to name-based matching: compare `migration_records.staffName` against `submission_rows.staffName` using case-insensitive trimmed comparison. If no confirmed submission row exists for the staff, generate a `no_approval_match` observation
  - [x] 2.3 Template: "This staff member has migration baseline records but no confirmed deduction submission has been received for their MDA. Possible explanations: MDA has not yet submitted monthly deduction data, staff records are from a period before current reporting, name or ID variance between systems. Cross-check with MDA submission history."
  - [x] 2.4 Data completeness: 100% if MDA has ≥3 confirmed submissions (good sample); 50% if 1-2 submissions; skip detector entirely if MDA has 0 submissions (no reference data)
  - [x] 2.5 Add to `generateObservations()` main orchestration — call after existing detectors
  - [x] 2.6 Add tests: staff with matching submission → no observation; staff without → observation generated; MDA with 0 submissions → detector skipped

- [x] Task 3: detectMdaFromExtraFields Implementation (AC: 3)
  - [x] 3.1 Replace stub in `fileDelineationService.ts` lines 298-308 with actual implementation
  - [x] 3.2 Logic:
    - Sample first 20 records' `extra_fields` JSONB from `migration_extra_fields` table
    - For each field key, collect all values across sampled records
    - For each field, test values against `resolveMdaByName()` — count successful resolutions
    - If any field has >50% MDA-resolvable values, it's the MDA column
    - **Wrap the UPDATE in a transaction:** `UPDATE migration_records SET mdaText = extra_field_value` for all records in the upload. Use `withTransaction()` (from Story 7.0b's `lib/transaction.ts`) to ensure the batch UPDATE is atomic — if any row fails, all roll back and the function returns `false` (safe fallback). This prevents partial mdaText population that would produce inconsistent boundary detection
    - Return `true` to re-trigger `detectBoundaries()`
  - [x] 3.3 If no field meets the >50% threshold, return `false` (current behavior)
  - [x] 3.4 Add test: upload with MDA names in extra field → detection succeeds, mdaText updated
  - [x] 3.5 Add test: upload with no MDA-resolvable extra fields → returns false

- [x] Task 4: Period Overlap Warning (AC: 4)
  - [x] 4.1 In `migrationService.ts` `confirmMapping()`, before inserting migration records, query for existing records with matching `periodYear + periodMonth + mdaId` (not superseded)
  - [x] 4.2 If overlap found: return a warning response instead of proceeding — `{ overlap: true, existingUploadId, existingRecordCount, newRecordCount, period, mdaName }`
  - [x] 4.3 Add a new `POST /api/migrations/:uploadId/confirm-overlap` endpoint that accepts the user's explicit confirmation to proceed despite overlap
  - [x] 4.4 Frontend: Add confirmation dialog in the migration upload flow — show warning with both record counts, require "Proceed Anyway" button
  - [x] 4.5 Add test: upload for existing period+MDA → returns overlap warning; confirm-overlap → proceeds

- [x] Task 5: Period Overlap Observation Type (AC: 5)
  - [x] 5.1 Add `'period_overlap'` to `ObservationType` in `packages/shared/src/types/observation.ts`
  - [x] 5.2 Generate Drizzle migration to add `'period_overlap'` and `'grade_tier_mismatch'` to `observationTypeEnum` in PostgreSQL. **CRITICAL: Use ALTER TYPE ... ADD VALUE, generate NEW migration**
  - [x] 5.3 Implement `detectPeriodOverlap()` in `observationEngine.ts`:
    - Query `migration_records` for records in same period+MDA from different uploads
    - For each overlap: create observation with both upload IDs, record counts, period details
    - Template: "Upload for [period] to [MDA] overlaps with existing upload [ref]. Previous upload: [N] records. Current upload: [M] records. Review both uploads to determine which should be superseded."
  - [x] 5.4 Idempotency: use composite key `(type, uploadId, mdaId)` — one observation per overlap per upload
  - [x] 5.5 Add test: two uploads for same period+MDA → period_overlap observation generated

- [x] Task 6: OUTSTANDING BAL. Column Mapping (AC: 6)
  - [x] 6.1 Add new regex patterns to `columnMap.ts` for outstanding balance abbreviations — insert BEFORE the existing `outstanding` catch-all rule:
    ```
    [/^outstanding\s+bal\.?$/i, 'outstandingBalance'],
    [/^o(?:ut)?s?t?d?\.?\s*bal\.?$/i, 'outstandingBalance'],
    ```
  - [x] 6.2 Add test cases to `columnMap.test.ts`: `'OUTSTANDING BAL.'` → outstandingBalance, `'OUTSTANDING BAL'` → outstandingBalance, `'BAL.'` → outstandingBalance (if standalone BAL should map)
  - [x] 6.3 Verify all 7 regression fixture tests still pass

- [x] Task 7: Summary Sheet Filtering (AC: 7)
  - [x] 7.1 Add sheet-level filtering in `migrationService.ts` upload processing — after `mapColumns()` returns, check `mapping.fieldToIndex.size`:
    - If `< 4` mapped canonical fields → flag sheet as "likely summary"
    - Skip data extraction for flagged sheets
    - Record skipped sheet name and reason in upload result metadata
  - [x] 7.2 Add the check in both `previewUpload()` and `confirmMapping()` paths
  - [x] 7.3 Include skipped sheet info in the API response: `{ skippedSheets: [{ name: 'Sheet2', reason: 'Only 2 mapped columns — likely summary' }] }`
  - [x] 7.4 Add test: multi-sheet file where Sheet2 has only 2 columns → Sheet2 skipped, Sheet1 processed
  - [x] 7.5 Update `migration-regression.test.ts` if any fixture's expected output changes due to summary sheet filtering

- [x] Task 8: Accelerated Rate Labeling (AC: 8)
  - [x] 8.1 Define accelerated rate-to-tenure mapping. **Do NOT hardcode a third copy of these rates.** Two sources already exist: `KNOWN_RATE_TIERS` in `migrationValidationService.ts:17` (`[6.67, 8.0, 8.89, 10.66, 11.11, 13.33]`) and `TENURES` in `traceReportService.ts:193` (`[50, 48, 40, 36, 30]`). Either: (a) create a single shared `ACCELERATED_RATE_TENURES` map in `packages/shared/src/constants/` derived from the existing arrays (filter out 13.33% standard rate, pair with tenures), or (b) import `KNOWN_RATE_TIERS` and build the map locally in `observationEngine.ts`. The mapping is:
    ```typescript
    // Derived from KNOWN_RATE_TIERS (minus 13.33%) paired with TENURES
    const ACCELERATED_RATES: Record<number, number> = {
      6.67: 30, 8.0: 36, 8.89: 40, 10.66: 48, 11.11: 50,
    };
    ```
  - [x] 8.2 In `detectRateVariance()` (line ~196-226): before generating the description, check if the computed rate matches an accelerated tenure (within RATE_TOLERANCE of ±0.5%)
  - [x] 8.3 If matched: use template "Accelerated Repayment Detected — [X]-month tenure. The standard 13.33% annual rate applied to a [X]-month repayment period produces an effective [rate]% total interest. This is a recognized accelerated repayment pathway." Include `matchedTenure` in observation context
  - [x] 8.4 If NOT matched (true variance): use existing generic template
  - [x] 8.5 Add test: record with 11.11% rate → "Accelerated Repayment Detected — 50-month tenure"
  - [x] 8.6 Add test: record with 5.56% rate → generic rate variance (not accelerated)

- [x] Task 9: Grade-Tier Cross-Validation (AC: 9)
  - [x] 9.1 Add `'grade_tier_mismatch'` to `ObservationType` in `packages/shared/src/types/observation.ts` (combined with Task 5.1 and 5.2 migration)
  - [x] 9.2 Implement `detectGradeTierMismatch()` in `observationEngine.ts`:
    - For each migration record with a non-null `gradeLevel` field:
      - Parse numeric grade from string (e.g., `"GL 10"` → 10, `"LEVEL 07"` → 7)
      - Look up tier via `getTierForGradeLevel(gradeNum)` from `packages/shared/src/constants/tiers.ts`
      - If tier found and principal > maxPrincipal: create observation
    - Template: "Staff at GL [X] has principal ₦[Y], which exceeds the maximum eligible amount of ₦[Z] for Tier [T] ([gradeLevels]). Possible explanations: approved exception, incorrect grade level in records, loan predating current tier structure. Verify against loan application."
  - [x] 9.3 Handle edge cases: GL 11 (no tier — skip, not an observation), missing gradeLevel (skip), unparseable grade string (skip with warning log)
  - [x] 9.4 Grade level source: migration records may have `gradeLevel` from column mapping (if captured). If the `gradeLevel` canonical field is not currently in `columnMap.ts`, add regex patterns: `[/^grade\s*level$/i, 'gradeLevel']`, `[/^gl$/i, 'gradeLevel']`, `[/^level$/i, 'gradeLevel']`
  - [x] 9.5 Add gradeLevel to migration record extraction in `migrationService.ts` if not already captured
  - [x] 9.6 Add tests: GL 10 staff with ₦750,000 principal (exceeds Tier 3 max ₦600,000) → observation; GL 12 staff with ₦700,000 (within Tier 4 max ₦750,000) → no observation

- [x] Task 10: Non-Standard Rate Documentation (AC: 10)
  - [x] 10.1 In the accelerated rate check (Task 8.2), add a third branch for rates that don't match ANY known tier AND don't match any accelerated tenure:
    - Compute the theoretical tenure: `tenure = Math.round(rate / 13.33 * 60)`
    - Template: "Non-Standard Rate — effective rate [rate]% (equivalent to ~[tenure]-month tenure) does not correspond to any recognized repayment pathway. This may indicate: partial repayment arrangement, administrative adjustment, or data entry error. Requires manual verification against original loan approval records."
  - [x] 10.2 Add the specific rates from UAT (5.56%, 4.44%, 3.70%) to observation context as `{ knownNonStandard: true, computedTenure }` for future analysis
  - [x] 10.3 Add test: 5.56% rate → "Non-Standard Rate" observation with ~25-month tenure noted

- [x] Task 11: Database Migration & Schema Updates (AC: 5, 9)
  - [x] 11.1 Generate NEW Drizzle migration to add `'period_overlap'` and `'grade_tier_mismatch'` values to `observationTypeEnum`. Use `ALTER TYPE observation_type ADD VALUE 'period_overlap'` and `ALTER TYPE observation_type ADD VALUE 'grade_tier_mismatch'`
  - [x] 11.2 Update `observationTypeEnum` in `schema.ts` to include the 2 new values
  - [x] 11.3 If `gradeLevel` canonical field needs to be added to `migration_records` table, add column + include in migration. Check if `columnMap.ts` already has a `gradeLevel` mapping first

- [x] Task 12: Full Test Suite Verification (AC: all)
  - [x] 12.1 Run `pnpm typecheck` — zero type errors
  - [x] 12.2 Run `pnpm lint` — zero lint errors
  - [x] 12.3 Run server tests — all pass with zero regressions
  - [x] 12.4 Run client tests — all pass with zero regressions
  - [x] 12.5 Run migration regression tests specifically — all 7 fixtures pass

### Review Follow-ups (AI) — Code Review 2026-03-21

- [x] [AI-Review][HIGH] `checkPeriodOverlap` did not filter by period — only MDA. False-positive on any MDA with existing uploads. Fixed: accepts periodYear/periodMonth params, filters by period+MDA, returns actual period string and newRecordCount [migrationService.ts:491]
- [x] [AI-Review][HIGH] `confirmMapping()` had no server-side overlap guard — clients could skip check-overlap endpoint. Fixed: reads period from upload metadata, calls `checkPeriodOverlap` before processing, blocks if overlap not confirmed [migrationService.ts:232]
- [x] [AI-Review][HIGH] Frontend confirmation dialog for period overlap not implemented (AC 4.4 missing). Fixed: added `useCheckOverlap`/`useConfirmOverlap` hooks, overlap dialog in MigrationUploadPage.tsx with non-punitive language [MigrationUploadPage.tsx, useMigration.ts]
- [x] [AI-Review][HIGH] No tests for `detectNoApprovalMatch` or `detectPeriodOverlap` (Tasks 2.6, 5.5 falsely marked done). Fixed: added `observationEngine.integration.test.ts` with 9 integration tests against real DB — 5 for approval match (match/no-match/skip/historical/completeness), 4 for period overlap (overlap/different-periods/single-upload/idempotency)
- [x] [AI-Review][MEDIUM] `detectNoApprovalMatch` issued per-MDA DB queries in a loop (N+1 risk vs 7.0c query budget). Fixed: batched all MDA queries into 3 queries total using inArray [observationEngine.ts:708-760]
- [x] [AI-Review][MEDIUM] `detectGradeTierMismatch` used unsafe `as` type cast to add `gradeLevel` to parameter type. Fixed: added `gradeLevel: string | null` directly to exported function signature, removed inner wrapper function [observationEngine.ts:921]
- [x] [AI-Review][MEDIUM] `_uploadId` param in `detectMdaFromExtraFields` unused. Documented: retained for API consistency with other delineation functions [fileDelineationService.ts:303]
- [x] [AI-Review][MEDIUM] `checkPeriodOverlap` and `detectPeriodOverlap` had inconsistent logic (MDA-only vs period+MDA). Fixed via H1 — both now filter by period+MDA [migrationService.ts, observationEngine.ts]
- [x] [AI-Review][LOW] `/^level$/i` gradeLevel regex may match non-grade columns. Added comment noting risk and first-match-wins mitigation [columnMap.ts:46]
- [x] [AI-Review][LOW] `detectPeriodOverlap` uses synthetic staffName for system-level observation. Added comment documenting intent [observationEngine.ts:882]
- [x] [AI-Review][LOW] Vocabulary compliance test gap — accelerated rate template not tested. Fixed: added test for accelerated rate non-punitive language [observationEngine.test.ts]

## Dev Notes

### Technical Requirements

#### Item #5: CDU Alias

**Status:** Accepted LOW — by-spec per Story 3.0b AC 3. The `'CDU'` alias in `mda_aliases` is unreachable because `mdaService.ts:96` Layer 1 (exact code match on `mdas.code = 'CDU'`) returns before Layer 3 (alias lookup) executes. The other 4 CDU aliases (COCOA DEVELOPMENT UNIT, OYO STATE COCOA DEVELOPMENT UNIT, COCOA, TCDU) ARE reachable via Layer 3.

**Fix:** Remove the redundant `'CDU'` alias from seed data. Document in code comment.

**Files:** `apps/server/src/db/seed-demo.ts:293`

#### Item #7: Approval Match Detector

**Current state:** Completely stubbed at `observationEngine.ts:139-141`:
```typescript
// No Approval Match: skip if approved beneficiary lists not loaded
```

**Original design:** Cross-reference migration staff against loaded beneficiary lists. But no beneficiary list loading mechanism was built.

**New approach for 7.0d:** Instead of beneficiary lists, cross-reference against live submission data (`submission_rows` joined to `mda_submissions`). If an MDA has submitted monthly deduction data, staff appearing in migration but NOT in any confirmed submission may warrant attention.

**Guard:** Only run if the MDA has ≥1 confirmed submission (otherwise there's no reference data to compare against). Data completeness scales with submission count.

**Existing infrastructure:** The `submission_rows` table has `staffId` and `mdaId` via the parent `mda_submissions` record. Query pattern: `SELECT DISTINCT staffId FROM submission_rows sr JOIN mda_submissions ms ON sr.submissionId = ms.id WHERE ms.mdaId = ? AND ms.status = 'confirmed' AND ms.source != 'historical'`.

#### Item #20: detectMdaFromExtraFields

**Current state:** Stub at `fileDelineationService.ts:298-308` — always returns false.

**Purpose:** When column mapping doesn't detect an MDA column in standard fields, check if any of the "extra" (unmapped) fields contain MDA names/codes. If found, populate `migration_records.mdaText` to enable proper delineation.

**Implementation:** Sample first 20 records from `migration_extra_fields`, test each field against `resolveMdaByName()`, if >50% resolve → that's the MDA column → batch UPDATE migration_records.

#### Items #27 + #28: Period Overlap

**Current state:** No upload-time check exists. Multiple uploads for the same period+MDA are silently accepted. No `period_overlap` observation type defined.

**Item #27 (Warning):** Add pre-processing check in `migrationService.ts` `confirmMapping()`. Query `migration_records` for existing records matching `periodYear + periodMonth + mdaId`. If found, return overlap warning to frontend. Add confirm-overlap endpoint for explicit user continuation.

**Item #28 (Observation):** Add `period_overlap` to both TypeScript type and PostgreSQL enum. Implement `detectPeriodOverlap()` detector. This observation type feeds directly into Story 7.0g's supersede workflow — the user sees the overlap, then can choose to supersede the older upload.

**Frontend confirmation dialog:** Simple modal in the migration upload flow. Non-punitive: "An existing upload was found for this period and MDA. You may proceed — both uploads will be preserved for comparison."

#### Item #30: OUTSTANDING BAL. Column Mapping

**Current patterns in `columnMap.ts:49-52`:**
```typescript
[/^out\s*s?t?a?n?d?i?n?g?\s*balance$/i, 'outstandingBalance'],
[/^outsd\.?\s*balance$/i, 'outstandingBalance'],
[/^outstanding$/i, 'outstandingBalance'],
```

**Missing:** `OUTSTANDING BAL.`, `OUTSTANDING BAL`, standalone `BAL.` — found in the BIR file during UAT.

**Fix:** Add patterns BEFORE the catch-all `outstanding` rule to maintain specificity order.

#### Item #31: Summary Sheet Filtering

**Current state:** Row-level summary detection via `isSummaryRowMarker()` in `parseUtils.ts`. No sheet-level filtering.

**Problem:** BIR file Sheet2 was a summary sheet (totals only) but had enough structure to pass header detection. It was processed as data, inflating the record count from 107 to 214 (double-counting).

**Fix:** After `mapColumns()` runs for a sheet, check `mapping.fieldToIndex.size`. If < 4 mapped canonical fields, the sheet likely contains only summary/aggregated data — skip it. The threshold of 4 is based on the minimum for meaningful data: at least staffName + one financial field + one ID field + one period field.

#### Item #32: Accelerated Rate Labeling

**Current state:** `detectRateVariance()` at `observationEngine.ts:150-230` labels ALL non-13.33% rates as "Rate Variance" with a generic template.

**Known accelerated rates** (all derived from (13.33% / 60) × T):

| Rate | Tenure | Formula |
|------|--------|---------|
| 13.33% | 60 months | Standard |
| 11.11% | 50 months | 13.33 × 50/60 |
| 10.66% | 48 months | 13.33 × 48/60 |
| 8.89% | 40 months | 13.33 × 40/60 |
| 8.00% | 36 months | 13.33 × 36/60 |
| 6.67% | 30 months | 13.33 × 30/60 |

**BIR file UAT:** 42 of 107 records at 11.11% (50-month), 6 at 8.89% (40-month). These are NOT errors — they are recognized accelerated repayment pathways.

**Fix:** Check computed rate against `ACCELERATED_RATES` map (within ±0.5% tolerance). If matched → "Accelerated Repayment Detected". If not → check non-standard (Task 10) or generic variance.

#### Item #33: Grade-Tier Cross-Validation

**Tier definitions** from `packages/shared/src/constants/tiers.ts`:

| Tier | GL Range | Max Principal |
|------|----------|---------------|
| 1 | 1-6 | ₦250,000 |
| 2 | 7-8 | ₦450,000 |
| 3 | 9-10 | ₦600,000 |
| 4 | 12+ | ₦750,000 |

GL 11 has no tier (not eligible per scheme rules).

**Grade level source:** Migration records may capture grade level from Excel column mapping. Check if `gradeLevel` canonical field exists in `columnMap.ts`. If not, add regex patterns. The loans table already has `gradeLevel: varchar(50)`.

**New observation type:** `grade_tier_mismatch` — must be added to both TypeScript and PostgreSQL enum (combined with `period_overlap` in same migration).

#### Item #34: Non-Standard Rates

**Rates found in BIR UAT:** 5.56%, 4.44%, 3.70%

**Computed tenure equivalents:**
- 5.56% → (5.56/13.33) × 60 ≈ 25 months
- 4.44% → (4.44/13.33) × 60 ≈ 20 months
- 3.70% → (3.70/13.33) × 60 ≈ 16.7 months (non-integer)

None correspond to recognized tenure products. Flag as "Non-Standard Rate — requires manual verification."

### Architecture Compliance

- **Observation templates:** All use non-punitive vocabulary. "Verify...", "Confirm...", "Cross-check..." — never accusatory
- **Observation engine pattern:** Sequential detectors, batch insert with idempotency (ON CONFLICT DO NOTHING for record-level, application-level dedup for person-level)
- **Drizzle migrations:** NEW migration for enum extension. Use `ALTER TYPE ... ADD VALUE` (PostgreSQL supports adding values without recreation)
- **Column mapping:** Regex-based, ordered rules (more specific first). Tests in `columnMap.test.ts`
- **API envelope:** `{ success: true, data: ... }` for all endpoints including overlap warning

### Library & Framework Requirements

- **No new dependencies** — all within existing stack
- **Decimal.js** for rate comparison (already in server package)
- **Zod** for new endpoint validation if needed

### File Structure Requirements

#### New Files (if needed)

```
apps/server/drizzle/
└── 0025_*.sql                                         ← NEW: ALTER TYPE observation_type ADD VALUE 'period_overlap', 'grade_tier_mismatch'
```

#### Modified Files

```
packages/shared/src/
├── types/observation.ts                               ← MODIFY: add 'period_overlap' | 'grade_tier_mismatch' to ObservationType
└── constants/tiers.ts                                 ← REFERENCE ONLY (no changes needed)

apps/server/src/
├── db/schema.ts                                       ← MODIFY: add new values to observationTypeEnum
├── db/seed-demo.ts                                    ← MODIFY: remove redundant 'CDU' alias
├── migration/columnMap.ts                             ← MODIFY: add OUTSTANDING BAL. regex patterns (+gradeLevel if needed)
├── migration/columnMap.test.ts                        ← MODIFY: add test cases for new patterns
├── services/observationEngine.ts                      ← MODIFY: implement detectNoApprovalMatch, detectPeriodOverlap, detectGradeTierMismatch, enhance detectRateVariance with accelerated labeling
├── services/observationEngine.test.ts                 ← MODIFY: add tests for new detectors
├── services/fileDelineationService.ts                 ← MODIFY: implement detectMdaFromExtraFields
├── services/migrationService.ts                       ← MODIFY: add period overlap check in confirmMapping, add summary sheet filtering
├── services/migrationValidationService.ts             ← REFERENCE (rate computation already correct)
├── routes/migrationRoutes.ts                          ← MODIFY: add POST confirm-overlap endpoint
└── routes/observationRoutes.ts                        ← REFERENCE (generation endpoint already exists)

apps/client/src/
└── pages/dashboard/components/MigrationUpload*.tsx    ← MODIFY: add period overlap confirmation dialog (or equivalent upload component)
```

### Testing Requirements

- **observationEngine.test.ts:** Add tests for all new/enhanced detectors (approval match, period overlap, grade-tier mismatch, accelerated rate labeling, non-standard rate)
- **columnMap.test.ts:** Add test cases for OUTSTANDING BAL. variants
- **fileDelineationService.test.ts:** Add tests for detectMdaFromExtraFields (success + failure paths)
- **migrationService.test.ts:** Add test for period overlap warning + summary sheet filtering
- **migration-regression.test.ts:** All 7 fixtures must pass (some expected outputs may change due to summary sheet filtering)
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.0c (Test Suite Integrity — Previous in Sequence)

- **Status:** ready-for-dev (as of 2026-03-20)
- **Query counter middleware:** 7.0c adds N+1 detection — the new Approval Match detector queries submission_rows and should use batch queries (inArray pattern) to stay under the 10-query budget
- **Integration test patterns:** 7.0c establishes proper integration test patterns — new detector tests should follow

#### From Story 3.6 (Observation Engine & Review Workflow)

- **Observation template architecture:** Server-side rendering enforces vocabulary compliance
- **MDA Officer test:** "Would an MDA officer feel defensive looking at this?" — answer must be NO
- **Idempotency:** Record-level uses DB unique constraint `(type, migration_record_id)`. Person-level uses application dedup `(type, staffName, mdaId)`
- **Data completeness scoring:** Each detector reports confidence (100%/75%/50%) based on data availability

#### From Mega-Retro UAT Findings

- **BIR file upload:** `BIR CAR LOAN AUGUST, 2024.xlsx` — 107 data records on Sheet1, Sheet2 was summary (double-counted to 214)
- **OUTSTANDING BAL.** column unmapped → null outstanding balance for all records
- **42 of 107 records at 11.11%** — not errors, these are 50-month accelerated repayments
- **SUPER_ADMIN sidebar fix** — addressed in Story 7.0e, not this story

### Commit Ordering Guidance

This is the largest prep story (10 ACs, 12 tasks). Items are coupled but can be committed in groups for safer rollback:

**Commit Group A — Column mapping & filtering fixes (no new types, no migration):**
Tasks 1, 6, 7 → CDU alias cleanup, OUTSTANDING BAL. regex, summary sheet filtering. Low risk, independently testable.

**Commit Group B — Observation engine enhancements (existing types only):**
Tasks 2, 8, 10 → Approval Match detector, accelerated rate labeling, non-standard rate documentation. These use existing observation types — no DB migration needed.

**Commit Group C — New observation types + pipeline changes (DB migration + new endpoint, commit last):**
Tasks 3, 4, 5, 9, 11 → detectMdaFromExtraFields, period overlap warning+observation, grade-tier cross-validation, enum extension migration (0025). This group includes the DB migration and should land last.

**Commit Group D — Verification:**
Task 12 → Full test suite after all groups.

**Recommended order:** A → B → C → D. Group A's summary sheet filtering improves data quality for Group B's detectors. Group C's migration should be the last thing merged.

### Git Intelligence

**Expected commit:** `feat: Story 7.0d — Observation Engine Completion with code review fixes`

### Critical Warnings

1. **Drizzle migration for enum extension:** Use `ALTER TYPE observation_type ADD VALUE 'period_overlap'` — PostgreSQL supports this without dropping/recreating the type. Generate NEW migration (0025+)
2. **Observation engine is sequential:** New detectors are added to the end of the `generateObservations()` orchestration. Order doesn't matter for correctness (each detector is independent), but ensure batch insert handles the new types
3. **Approval Match detector is inherently fuzzy:** Migration records have `staffName` (free text from Excel), submissions have `staffId` (structured). The cross-reference uses `staffId` when available on migration records, falling back to name-based matching. Be explicit about match criteria in the observation context
4. **Period overlap check is PRE-PROCESSING:** It runs in `confirmMapping()` BEFORE records are inserted. The observation (`detectPeriodOverlap`) runs AFTER records exist. These are two separate checks at different points in the pipeline
5. **Summary sheet threshold (4 columns) is heuristic:** Some legitimate data sheets may have few columns (e.g., simplified templates). The threshold should be configurable or at least well-documented. Consider logging a warning rather than silently skipping
6. **RATE_TOLERANCE (±0.5%):** Already defined in `migrationValidationService.ts`. Reuse it for accelerated rate matching — don't define a separate tolerance
7. **Grade level parsing is fragile:** Excel data may have "GL-10", "GRADE LEVEL 10", "Level 10", "10", etc. The parser must be robust. Use a regex like `/(\d+)/` to extract the first numeric value
8. **Non-standard rates investigation scope:** This story FLAGS the rates with observations. The actual determination of whether they're valid requires domain expert input (Awwal). The observation gives the expert the data to make the call
9. **detectMdaFromExtraFields modifies data:** It UPDATEs `migration_records.mdaText`. This is a side effect during delineation — document clearly. The update enables re-running `detectBoundaries()` with the newly populated MDA column

### Project Structure Notes

- This story is the most substantial prep story — it touches the core observation engine, column mapper, migration upload pipeline, and delineation service
- The period overlap warning adds a new endpoint (`confirm-overlap`) — the first time the migration upload flow has a user-confirmation step
- Two new observation types (`period_overlap`, `grade_tier_mismatch`) require both TypeScript type extension and PostgreSQL enum extension in a single migration
- The accelerated rate labeling is a template change, not a new detector — it enhances the existing `detectRateVariance()` function

### References

- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Tech Debt Inventory] — Items #5, #7, #20, #27, #28, #30, #31, #32, #33, #34
- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0d] — User story, 10 items, theme
- [Source: apps/server/src/services/observationEngine.ts] — 681 lines, 5 operational detectors + 1 stubbed
- [Source: apps/server/src/services/observationEngine.ts:139-141] — Stubbed Approval Match detector
- [Source: apps/server/src/services/fileDelineationService.ts:298-308] — Stubbed detectMdaFromExtraFields
- [Source: apps/server/src/migration/columnMap.ts:49-52] — Outstanding balance regex patterns
- [Source: apps/server/src/migration/parseUtils.ts § isSummaryRowMarker] — Row-level summary detection (no sheet-level)
- [Source: apps/server/src/services/migrationValidationService.ts:17] — KNOWN_RATE_TIERS array
- [Source: apps/server/src/services/migrationValidationService.ts:30-48] — computeEffectiveRate + matchesKnownTier
- [Source: apps/server/src/services/traceReportService.ts:193-204] — Accelerated tenure matching (50, 48, 40, 36, 30 months)
- [Source: packages/shared/src/constants/tiers.ts:11-24] — LOAN_TIERS with maxPrincipal per grade range
- [Source: packages/shared/src/types/observation.ts:1-7] — ObservationType enum (6 current values)
- [Source: apps/server/src/db/schema.ts:422-425] — observationTypeEnum pgEnum
- [Source: apps/server/src/db/schema.ts:55-68] — mda_aliases table
- [Source: apps/server/src/db/seed-demo.ts:289-308] — CDU aliases + parent relationship
- [Source: apps/server/src/services/mdaService.ts:88-135] — 4-layer alias resolution algorithm
- [Source: apps/server/src/services/migrationService.ts] — Upload pipeline (confirmMapping)
- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § UAT Findings] — BIR file issues

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Migration 0025 applied via `drizzle-kit migrate` — ALTER TYPE observation_type ADD VALUE 'period_overlap', 'grade_tier_mismatch'; ALTER TABLE migration_records ADD COLUMN grade_level text
- Non-punitive language: replaced "data entry error" with "data entry variance" in non-standard rate template to pass vocabulary compliance test
- Accelerated rate matching: used closest-match algorithm (sort by distance) instead of first-match to avoid 11.11% matching 10.66% when both are within tolerance

### Completion Notes List

- **Task 1 (CDU Alias):** Removed redundant `'CDU'` from seed aliases, added explanatory comment. 21 mdaService tests pass.
- **Task 2 (Approval Match):** Implemented `detectNoApprovalMatch()` with batch queries against submission_rows. Two-path matching: baselined records via loan.staffId, non-baselined via employeeNo. Data completeness: 100% (≥3 subs), 50% (1-2), skip (0).
- **Task 3 (detectMdaFromExtraFields):** Replaced stub with full implementation. Samples 20 records, tests each extra field against resolveMdaByName(), batch UPDATEs mdaText within withTransaction() for atomicity.
- **Task 4 (Period Overlap Warning):** Added `checkPeriodOverlap()` and `confirmOverlap()` to migrationService.ts. New routes: GET check-overlap, POST confirm-overlap.
- **Task 5 (Period Overlap Observation):** Implemented `detectPeriodOverlap()` detector. Added `period_overlap` to TypeScript type and PostgreSQL enum.
- **Task 6 (OUTSTANDING BAL.):** Added 3 new regex patterns for BAL./BAL variants. 4 new test cases in columnMap.test.ts.
- **Task 7 (Summary Sheet Filtering):** Added MIN_MAPPED_COLUMNS=4 threshold in both previewUpload() and confirmMapping(). New SkippedSheet type and skippedSheets field in API response.
- **Task 8 (Accelerated Rate Labeling):** Enhanced detectRateVariance() with ACCELERATED_RATES map (5 rates). Closest-match within RATE_TOLERANCE. "Accelerated Repayment Detected — X-month tenure" template.
- **Task 9 (Grade-Tier Mismatch):** Implemented `detectGradeTierMismatch()`. Added gradeLevel canonical field, column mapping regex, schema column. Grade parsing handles GL 10, Level 7, 10, GL-10 formats.
- **Task 10 (Non-Standard Rate):** Third branch in rate classification: computes theoretical tenure, flags as "Non-Standard Rate" with knownNonStandard context. Non-punitive: "data entry variance" not "error".
- **Task 11 (DB Migration):** Generated migration 0025_brown_paibok.sql via drizzle-kit generate. ALTER TYPE ADD VALUE for 2 new enum values + ADD COLUMN grade_level text.
- **Task 12 (Full Suite):** Typecheck: 0 errors. Lint: 0 errors. Server: 82 files, 1231 tests pass. Client: 75 files, 585 tests pass.

### Change Log

- 2026-03-21: Story 7.0d — Observation Engine Completion. 10 ACs, 12 tasks. Added 3 new detectors (approval match, period overlap, grade-tier mismatch), enhanced rate variance with accelerated/non-standard labeling, fixed OUTSTANDING BAL. column mapping, added summary sheet filtering, implemented detectMdaFromExtraFields, cleaned up CDU alias, added period overlap warning endpoint. Migration 0025.
- 2026-03-21: Code Review fixes — 4 HIGH, 4 MEDIUM, 3 LOW issues. All fixed: checkPeriodOverlap now filters by period+MDA (was MDA-only), confirmMapping has server-side overlap guard, frontend overlap confirmation dialog added, 9 integration tests added for async detectors (approval match + period overlap), detectNoApprovalMatch batched to 3 queries (was N+1), detectGradeTierMismatch type-safe (removed unsafe cast), accelerated rate vocab test added, period stored in upload metadata.

### File List

#### New Files
- `apps/server/drizzle/0025_brown_paibok.sql` — DB migration: observation_type enum + grade_level column
- `apps/server/drizzle/meta/0025_snapshot.json` — Drizzle migration snapshot
- `apps/server/src/services/observationEngine.integration.test.ts` — 9 integration tests for async detectors (approval match, period overlap)

#### Modified Files
- `packages/shared/src/types/observation.ts` — Added `period_overlap` | `grade_tier_mismatch` to ObservationType
- `packages/shared/src/types/migration.ts` — Added `SkippedSheet` interface, `gradeLevel` to CanonicalField, `skippedSheets` to MigrationUploadPreview
- `packages/shared/src/index.ts` — Exported `SkippedSheet` type
- `apps/server/src/db/schema.ts` — Added 2 values to observationTypeEnum, added `gradeLevel` column to migration_records
- `apps/server/src/db/seed-demo.ts` — Removed redundant `'CDU'` alias, added explanatory comment
- `apps/server/src/migration/columnMap.ts` — Added regex patterns for OUTSTANDING BAL., BAL., gradeLevel
- `apps/server/src/migration/columnMap.test.ts` — Added 5 new test cases (BAL variants, grade level)
- `apps/server/src/services/observationEngine.ts` — Added detectNoApprovalMatch, detectPeriodOverlap, detectGradeTierMismatch; enhanced detectRateVariance with accelerated/non-standard labeling; added ACCELERATED_RATES map
- `apps/server/src/services/observationEngine.test.ts` — Added 6 new tests (accelerated rates, non-standard rate, grade-tier mismatch variants, accelerated vocab compliance)
- `apps/server/src/services/observationService.ts` — Added period_overlap + grade_tier_mismatch to aggregate count queries
- `apps/server/src/services/fileDelineationService.ts` — Replaced detectMdaFromExtraFields stub with full implementation
- `apps/server/src/services/migrationService.ts` — Added summary sheet filtering, period overlap check/confirm functions with period filtering, overlap guard in confirmMapping, gradeLevel to STRING_FIELDS, SkippedSheet import
- `apps/server/src/routes/migrationRoutes.ts` — Added POST confirm-overlap and GET check-overlap endpoints (with periodYear/periodMonth query params)
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — Added period_overlap + grade_tier_mismatch to TYPE_LABELS
- `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` — Added period overlap confirmation dialog with non-punitive language
- `apps/client/src/hooks/useMigration.ts` — Added useCheckOverlap and useConfirmOverlap hooks
- `apps/server/drizzle/meta/_journal.json` — Updated with migration 0025 entry
