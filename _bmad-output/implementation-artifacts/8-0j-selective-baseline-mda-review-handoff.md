# Story 8.0j: Selective Baseline & MDA Review Handoff

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **AG/Department Admin**,
I want the batch baseline to auto-baseline clean records and flag variance records for MDA officer review, and as an **MDA Accounting Officer**, I want to review my MDA's flagged migration records and submit corrections with mandatory explanations — either individually through the system or by downloading a correction worksheet, correcting in Excel, and re-uploading,
so that records are corrected by the person with actual domain knowledge before baselines are established, with a complete audit trail of who corrected what and why.

**Origin:** Story 8.0b UAT escalations #2 + #3 (2026-04-01). The Alatishe case proved authority (DEPT_ADMIN) and knowledge (MDA_ADMIN) are separated — the Department Admin had to phone the MDA officer to learn that installments outstanding should be 22, not 42. The system must bridge this gap.

**Dependency:** Story 8.0b (correction infrastructure — correction columns, `correctRecord()`, `RecordDetailDrawer`, audit trail). Runs parallel with 8.0h + 8.0i.

## Acceptance Criteria

### AC1: Batch Baseline Confirmation Dialog — Selective Breakdown

**Given** a batch baseline operation on a validated upload,
**When** the DEPT_ADMIN clicks "Establish Baselines",
**Then** the confirmation dialog shows a breakdown:
- "X records will be baselined immediately (Clean + Minor Variance)."
- "Y records will be flagged for MDA review (Significant Variance + Structural Error + Anomalous)."
- DEPT_ADMIN confirms to proceed.
- On confirm: Clean + Minor records are baselined; Significant+ records are flagged with `flagged_for_review_at = NOW()` and `review_window_deadline = NOW() + 14 days`.

### AC2: MDA Dashboard — Migration Records Requiring Review

**Given** records flagged for MDA review after a selective batch baseline,
**When** the MDA Accounting Officer (`mda_officer` role) logs in,
**Then** they see a "Migration Records Requiring Your Review" section on their dashboard, filtered to their MDA only (via `scopeToMda`). Shows record count and review deadline (14 days from flagging date).

### AC3: RecordDetailDrawer — Correction with Mandatory Reason

**Given** the MDA officer (or DEPT_ADMIN) opens a flagged record in the RecordDetailDrawer,
**When** they want to correct values,
**Then** they can edit financial fields using the existing correction form with an additional **mandatory correction reason** text field (minimum 10 characters). The correction reason is required for ALL roles — DEPT_ADMIN and MDA_OFFICER alike. On save: `corrected_by`, `corrected_at`, `correction_reason`, and corrected value columns are all set.

### AC4: Mark Reviewed Without Correction

**Given** a flagged record where the MDA officer determines values are correct (variance is intentional),
**When** the officer clicks "Mark Reviewed — Values Correct",
**Then** the officer must provide a mandatory explanation (min 10 chars, e.g. "₦600,000 approved as special case by PS — above GL08 standard entitlement"). The system sets `corrected_by`, `corrected_at`, `correction_reason` with corrected value columns remaining `NULL` — signalling "reviewed, no correction needed."

### AC5: Download Correction Worksheet (.xlsx)

**Given** flagged records for an MDA,
**When** the MDA officer (or DEPT_ADMIN) clicks "Download Correction Worksheet",
**Then** the system exports an `.xlsx` file with:
- **(a) "Corrections" sheet:** Reference columns (Record ID, Staff Name, Staff ID, Grade, MDA, all declared values, scheme expected values, variance info — read-only context) plus empty correction columns (Corrected Outstanding Balance, Corrected Total Loan, Corrected Monthly Deduction, Corrected Installment Count, Corrected Installments Paid, Corrected Installments Outstanding, Correction Reason).
- **(b) "Instructions" sheet:** Explaining which columns to fill in, the mandatory reason requirement, and that leaving correction columns blank marks the record as "reviewed, values correct" (reason still required).
- Download timestamp embedded in a hidden "Metadata" sheet for conflict detection.

### AC6: Upload Correction Worksheet — Preview & Apply

**Given** a completed correction worksheet is uploaded,
**When** the system processes it,
**Then** a preview screen shows before applying:
- "X records with corrections ready to apply"
- "Y records marked as reviewed (values correct — reason provided, no corrections)"
- "Z records unchanged (skipped — no reason provided)"
- "N records already baselined since download (cannot correct)"
- "M records with conflicts (modified by another user since download)"
The officer reviews and clicks "Apply Corrections" to commit all in a single transaction.

### AC7: DEPT_ADMIN MDA Progress Tracker

**Given** the DEPT_ADMIN views the migration page after a selective batch baseline,
**When** MDA officers are reviewing,
**Then** a per-MDA progress tracker is visible showing: MDA name, records reviewed / total flagged, completion percentage bar, days remaining in review window (e.g. "11 days remaining", "3 days remaining", "Overdue (2 days) — [Extend]").

### AC8: 14-Day Review Window with 3-Day Countdown

**Given** a 14-day review window per MDA (from flagging date),
**When** 3 days remain (day 11),
**Then** the MDA officer's dashboard shows a countdown badge ("3 days remaining") and the DEPT_ADMIN progress tracker shows an amber warning on that MDA.

### AC9: Overdue Handling (No Auto-Escalation)

**Given** the review window expires,
**When** the DEPT_ADMIN views the progress tracker,
**Then** the MDA shows "Overdue (X days)" in amber with an **[Extend]** button. The system does NOT auto-escalate or auto-release — the DEPT_ADMIN decides: extend the window, correct directly (with mandatory reason), or follow up offline. Extension is logged (who, when, new deadline) but does not require a reason.

### AC10: DEPT_ADMIN Review of MDA-Corrected Records

**Given** MDA-reviewed records (corrections saved or "reviewed, values correct"),
**When** the DEPT_ADMIN clicks a reviewed record in the RecordDetailDrawer,
**Then** the drawer shows: correction details (original → corrected values if any), correction reason, who reviewed, when. DEPT_ADMIN can then "Establish Baseline" individually or use "Baseline All Reviewed" for batch processing of MDA-reviewed records.

## Tasks / Subtasks

- [x] **Task 1 — DB Migration: MDA Review Schema** (AC: 1,2,3,4,8,9)
  - [x] 1.1 Add `correction_reason` column (text, nullable) to `migration_records`
  - [x] 1.2 Add `flagged_for_review_at` column (timestamptz, nullable) to `migration_records`
  - [x] 1.3 Add `review_window_deadline` column (timestamptz, nullable) to `migration_records` — defaults to `flagged_for_review_at + 14 days` at application level
  - [x] 1.4 Add `review_window_extensions` column (jsonb, nullable, default `[]`) to `migration_records` — array of `{ extendedBy: uuid, extendedAt: timestamp, newDeadline: timestamp }`
  - [x] 1.5 Run `drizzle-kit generate` (next sequential migration — check `apps/server/drizzle/` for latest number at generation time), verify hash, commit meta snapshot
  - [x] 1.6 Add index on `(upload_id, flagged_for_review_at)` for review query performance

- [x] **Task 2 — Shared Types: MDA Review Contracts** (AC: all)
  - [x] 2.1 Extend `BatchBaselineResult` with `flaggedForReview: { count: number; byCategory: Record<string, number> }` and `autoBaselined: { count: number; byCategory: Record<string, number> }`
  - [x] 2.2 Add `FlaggedRecordSummary` type: `{ recordId, staffName, staffId, gradeLevel, mdaName, varianceCategory, varianceAmount, flaggedAt, reviewWindowDeadline, daysRemaining, countdownStatus: 'normal' | 'warning' | 'overdue' }`
  - [x] 2.3 Add `MdaReviewProgress` type: `{ mdaId, mdaName, totalFlagged, reviewed, pending, completionPct, daysRemaining, countdownStatus, windowDeadline }`
  - [x] 2.4 Add `CorrectionWorksheetPreview` type: `{ readyToApply, reviewedNoCorrection, skipped, alreadyBaselined, conflicts, records: Array<...> }`
  - [x] 2.5 Extend `MigrationRecordDetail` with `correctionReason: string | null`, `flaggedForReviewAt: string | null`, `reviewWindowDeadline: string | null`
  - [x] 2.6 Add Zod schemas: `submitReviewSchema` (corrections + mandatory reason), `markReviewedSchema` (reason only), `extendWindowSchema` (mdaId + uploadId)

- [x] **Task 3 — Selective Batch Baseline Logic** (AC: 1)
  - [x] 3.1 In `baselineService.ts` → `createBatchBaseline()`: after loading non-baselined records, partition into two sets: `autoBaselineRecords` (varianceCategory ∈ `['clean', 'minor_variance']`) and `flagForReviewRecords` (varianceCategory ∈ `['significant_variance', 'structural_error', 'anomalous']`)
  - [x] 3.2 Process `autoBaselineRecords` through existing baseline logic (loan creation + ledger entry)
  - [x] 3.3 Flag `flagForReviewRecords`: set `flagged_for_review_at = NOW()`, `review_window_deadline = NOW() + 14 days` in a batch update
  - [x] 3.4 Return extended `BatchBaselineResult` with both `autoBaselined` and `flaggedForReview` breakdowns
  - [x] 3.5 Existing `skippedRecords` logic remains for eligibility failures (balance exceeds loan, missing balance)

- [x] **Task 4 — MDA Review Service Functions** (AC: 2,3,4,7,8,9,10)
  - [x] 4.1 Create `apps/server/src/services/mdaReviewService.ts`
  - [x] 4.2 `getFlaggedRecords(uploadId, mdaScope, pagination)` — returns paginated flagged records with review state derived from: Pending = `flagged_for_review_at IS NOT NULL AND corrected_by IS NULL`; Reviewed = `corrected_by IS NOT NULL AND correction_reason IS NOT NULL`
  - [x] 4.3 `submitReview(recordId, uploadId, corrections, reason, userId, mdaScope)` — reuse existing `correctRecord()` logic but with mandatory `correction_reason`. Validate min 10 chars. Transaction-safe
  - [x] 4.4 `markReviewedNoCorrection(recordId, uploadId, reason, userId, mdaScope)` — sets `corrected_by`, `corrected_at`, `correction_reason` with all corrected value columns remaining NULL
  - [x] 4.5 `getMdaReviewProgress(uploadId)` — per-MDA aggregation: total flagged, reviewed count, completion %, days remaining, countdown status (normal/warning/overdue). Uses `flagged_for_review_at` + `review_window_deadline` for window computation
  - [x] 4.6 `extendReviewWindow(uploadId, mdaId, userId)` — updates `review_window_deadline += 14 days`, appends to `review_window_extensions` jsonb array. No reason required per AC9
  - [x] 4.7 `baselineReviewedRecords(uploadId, mdaScope, userId)` — Stage 3: baseline all records where `corrected_by IS NOT NULL AND correction_reason IS NOT NULL AND is_baseline_created = false`. Reuse existing `createBaseline()` per-record logic

- [x] **Task 5 — Correction Worksheet XLSX Export** (AC: 5)
  - [x] 5.1 Create `apps/server/src/services/correctionWorksheetService.ts`
  - [x] 5.2 `generateCorrectionWorksheet(uploadId, mdaScope)` — builds XLSX with three sheets using existing `xlsx` library (same import pattern as `fileParser.ts`)
  - [x] 5.3 "Corrections" sheet: read-only reference columns (Record ID, Staff Name, Staff ID, Grade Level, MDA, Declared OB, Declared Total Loan, Declared Monthly Deduction, Scheme Expected Total Loan, Scheme Expected Monthly Deduction, Variance Category, Variance Amount) + empty correction columns (Corrected OB, Corrected Total Loan, Corrected Monthly Deduction, Corrected Installment Count, Corrected Installments Paid, Corrected Installments Outstanding, Correction Reason)
  - [x] 5.4 "Instructions" sheet: static text explaining column usage, mandatory reason, blank-corrections = "reviewed, values correct"
  - [x] 5.5 "Metadata" sheet (hidden): `{ downloadedAt, uploadId, mdaId, recordCount }` for conflict detection on re-upload

- [x] **Task 6 — Correction Worksheet XLSX Import + Preview** (AC: 6)
  - [x] 6.1 `parseCorrectionWorksheet(buffer, uploadId, mdaScope)` — reads uploaded XLSX, validates structure against expected columns
  - [x] 6.2 Conflict detection: compare `downloadedAt` from Metadata sheet against each record's `corrected_at` — if record was modified after download, flag as conflict
  - [x] 6.3 Already-baselined detection: check `is_baseline_created` for each record ID — flag records baselined since download
  - [x] 6.4 Classification: records with correction values → "ready to apply"; records with reason but no corrections → "reviewed, values correct"; records with no reason → "skipped"; conflicts and already-baselined → separate categories
  - [x] 6.5 `applyCorrectionWorksheet(uploadId, parsedRecords, userId, mdaScope)` — applies all corrections in single transaction using existing `correctRecord()` pattern (row lock, snapshot, corrected_by/at/reason). For "reviewed, values correct" records, use `markReviewedNoCorrection()` logic
  - [x] 6.6 Return `CorrectionWorksheetPreview` for frontend display before applying

- [x] **Task 7 — MDA Review API Routes** (AC: 2,3,4,5,6,7,9,10)
  - [x] 7.1 Create new auth middleware variant: `reviewAuth = [authenticate, requirePasswordChange, authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER), scopeToMda]` — MDA_OFFICER gets MDA-scoped access, DEPT_ADMIN/SUPER_ADMIN get full access
  - [x] 7.2 `GET /api/migrations/:uploadId/review/records` — paginated flagged records (reviewAuth)
  - [x] 7.3 `PATCH /api/migrations/:uploadId/records/:recordId/review` — submit review with corrections + mandatory reason (reviewAuth)
  - [x] 7.4 `PATCH /api/migrations/:uploadId/records/:recordId/mark-reviewed` — mark reviewed without corrections + mandatory reason (reviewAuth)
  - [x] 7.5 `GET /api/migrations/:uploadId/review/progress` — per-MDA progress tracker (adminAuth — DEPT_ADMIN/SUPER_ADMIN only)
  - [x] 7.6 `POST /api/migrations/:uploadId/review/extend-window` — extend review window for specific MDA (adminAuth)
  - [x] 7.7 `GET /api/migrations/:uploadId/review/worksheet` — download correction worksheet XLSX (reviewAuth)
  - [x] 7.8 `POST /api/migrations/:uploadId/review/worksheet` — upload correction worksheet + return preview (reviewAuth)
  - [x] 7.9 `POST /api/migrations/:uploadId/review/worksheet/apply` — apply parsed worksheet corrections (reviewAuth)
  - [x] 7.10 `POST /api/migrations/:uploadId/baseline-reviewed` — baseline all reviewed records (adminAuth — Stage 3)

- [x] **Task 8 — Frontend Hooks: MDA Review Queries & Mutations** (AC: all)
  - [x] 8.1 In `useMigration.ts`: add `useFlaggedRecords(uploadId, filters?)` query
  - [x] 8.2 Add `useMdaReviewProgress(uploadId)` query
  - [x] 8.3 Add `useSubmitReview(uploadId)` mutation
  - [x] 8.4 Add `useMarkReviewed(uploadId)` mutation
  - [x] 8.5 Add `useExtendReviewWindow(uploadId)` mutation
  - [x] 8.6 Add `useBaselineReviewed(uploadId)` mutation
  - [x] 8.7 Add `useDownloadWorksheet(uploadId)` — returns blob for download
  - [x] 8.8 Add `useUploadWorksheet(uploadId)` mutation — returns preview
  - [x] 8.9 Add `useApplyWorksheet(uploadId)` mutation — commits worksheet corrections

- [x] **Task 9 — Batch Baseline Confirmation Dialog Update** (AC: 1)
  - [x] 9.1 Before executing batch baseline, call a new `GET /api/migrations/:uploadId/baseline-preview` endpoint (or compute client-side from validation results) to show the selective breakdown
  - [x] 9.2 Update the existing batch baseline confirmation dialog to show: "X Clean + Minor Variance records → auto-baseline" and "Y Significant+ records → flag for MDA review"
  - [x] 9.3 On confirm, call existing `useCreateBatchBaseline` mutation (server does the selective logic)
  - [x] 9.4 After completion, show result summary with counts for auto-baselined, flagged, and skipped (ineligible)

- [x] **Task 10 — MDA Officer Review Dashboard Section** (AC: 2,8)
  - [x] 10.1 Create `apps/client/src/pages/dashboard/components/MdaReviewSection.tsx` — "Migration Records Requiring Your Review" card
  - [x] 10.2 Show: total records pending, review deadline, countdown badge (teal for normal, amber for ≤3 days, amber for overdue)
  - [x] 10.3 Link to full review queue (opens the migration page review tab filtered to their MDA)
  - [x] 10.4 Conditionally render only for `mda_officer` role AND when flagged records exist
  - [x] 10.5 Wire into the MDA_OFFICER dashboard layout (existing role-based dashboard routing)

- [x] **Task 11 — RecordDetailDrawer: Correction Reason + Mark Reviewed** (AC: 3,4,10)
  - [x] 11.1 Add `correctionReason` textarea to the existing CorrectionForm (min 10 chars, required, placeholder: "Explain why these values are being corrected…")
  - [x] 11.2 Add "Mark Reviewed — Values Correct" button (visible when record is flagged but MDA officer determines no correction needed)
  - [x] 11.3 "Mark Reviewed" opens a reason-only dialog/inline form (min 10 chars, required)
  - [x] 11.4 Show review metadata on already-reviewed records: who reviewed, when, correction reason, original → corrected values (or "No corrections — values confirmed correct")
  - [x] 11.5 For DEPT_ADMIN viewing MDA-reviewed records: show review details + "Establish Baseline" button + "Baseline All Reviewed" batch action

- [x] **Task 12 — Correction Worksheet Download/Upload UI** (AC: 5,6)
  - [x] 12.1 Create `apps/client/src/pages/dashboard/components/CorrectionWorksheetActions.tsx` — "Download Correction Worksheet" button + "Upload Completed Worksheet" button
  - [x] 12.2 Download triggers `useDownloadWorksheet` → browser file save dialog
  - [x] 12.3 Upload triggers file picker → `useUploadWorksheet` → shows `CorrectionWorksheetPreview` component
  - [x] 12.4 Create `CorrectionWorksheetPreview.tsx` — shows categorized breakdown (ready to apply, reviewed-no-correction, skipped, already-baselined, conflicts) with expandable record lists
  - [x] 12.5 "Apply Corrections" button on preview → `useApplyWorksheet` mutation → success toast with counts
  - [x] 12.6 Conflict records shown with amber warning and details (who modified, when)

- [x] **Task 13 — DEPT_ADMIN MDA Progress Tracker** (AC: 7,9)
  - [x] 13.1 Create `apps/client/src/pages/dashboard/components/MdaReviewProgressTracker.tsx`
  - [x] 13.2 Per-MDA row: MDA name, reviewed/total count, completion progress bar, days remaining badge
  - [x] 13.3 Countdown badge styles: teal for >3 days, amber for ≤3 days, amber "Overdue (X days)" for expired
  - [x] 13.4 [Extend] button on overdue MDAs → calls `useExtendReviewWindow` → adds 14 days, refreshes tracker
  - [x] 13.5 "Baseline All Reviewed" button per MDA (enabled when reviewed > 0 and MDA has completed review)
  - [x] 13.6 Wrap all metrics with `<MetricHelp>` tooltips explaining derivations
  - [x] 13.7 Add "MDA Review" tab to MigrationPage tab bar (visible when any upload has flagged records)

- [x] **Task 14 — Integration + Unit Tests** (AC: all)
  - [x] 14.1 Integration: selective batch baseline — upload with mixed variance categories → verify Clean+Minor baselined, Significant+ flagged, skipped records correct
  - [x] 14.2 Integration: MDA review submission — flag record → submit correction with reason → verify corrected_by/at/reason set, correction values applied
  - [x] 14.3 Integration: mark reviewed without correction — verify corrected_by/at/reason set, correction value columns remain NULL
  - [x] 14.4 Integration: correction worksheet round-trip — download XLSX → parse → verify structure matches expected columns → upload with corrections → apply → verify records updated
  - [x] 14.5 Integration: worksheet conflict detection — correct a record after download → re-upload worksheet → verify conflict flagged
  - [x] 14.6 Integration: baseline reviewed records (Stage 3) — flag → MDA reviews → DEPT_ADMIN baselines reviewed records → verify loans created
  - [x] 14.7 Unit: review window computation — verify 14-day deadline, 3-day countdown threshold, overdue detection, extension logic
  - [x] 14.8 Unit: state detection helpers — Pending MDA Review vs MDA Reviewed vs Baselined from column values
  - [x] 14.9 Auth: verify MDA_OFFICER can only access own-MDA flagged records, cannot baseline, cannot extend window

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] C1: Write integration tests for Tasks 14.1–14.6 and 14.9 — selective batch baseline, MDA review submission, mark reviewed, worksheet round-trip, conflict detection, baseline reviewed records, auth scoping. Fixed: wrote `mdaReviewService.integration.test.ts` with 11 tests against real DB. Also fixed `getMdaReviewProgress` SQL aggregate Date coercion bug discovered during testing.
- [x] [AI-Review][HIGH] H1: `applyCorrectionWorksheet` wraps in `db.transaction()` but never passes `tx` to inner `correctRecord()`/`markReviewedNoCorrection()` — each runs its own independent transaction. Fixed: added optional `externalTx` parameter to both functions; `applyCorrectionWorksheet` passes `tx` through.
- [x] [AI-Review][HIGH] H2: `/worksheet/apply` endpoint accepts raw `req.body` with no Zod validation — security risk. Fixed: added `worksheetApplySchema` and `validate()` middleware.
- [x] [AI-Review][MEDIUM] M1: `extendReviewWindow` updates records one-by-one (N+1) without transaction or row lock. Fixed: single batch UPDATE within transaction with FOR UPDATE.
- [x] [AI-Review][MEDIUM] M2: `baselineReviewedRecords` has no transaction wrapping. Fixed: wrapped in `db.transaction()` with FOR UPDATE.
- [x] [AI-Review][MEDIUM] M3: `baselineReviewedRecords` hardcodes `role: 'dept_admin'`. Fixed: accepts `userRole` parameter from route handler.
- [x] [AI-Review][MEDIUM] M4: `parseCorrectionWorksheet` ignores `mdaScope` (`_mdaScope`). Fixed: filters DB query by mdaScope.
- [x] [AI-Review][MEDIUM] M5: File List missing `apps/server/drizzle/meta/_journal.json`. Fixed: added to File List.
- [x] [AI-Review][LOW] L1: `countdownBadge` duplicated in MdaReviewSection and MdaReviewProgressTracker. Fixed: exported from MdaReviewProgressTracker, imported in MdaReviewSection.
- [x] [AI-Review][LOW] L2: MetricHelp uses inline definitions despite glossary entries existing. Fixed: switched to glossary-backed `metric="migration.reviewWindow"` / `migration.reviewProgress` references.
- [x] [AI-Review][LOW] L3: `MdaReviewSection` queries 10 uploads but uses only the first. Fixed: changed to `limit: 1`.

## Dev Notes

### Three-Stage Pipeline Architecture

```
Stage 1: DEPT_ADMIN clicks "Establish Baselines"
  → Confirmation dialog shows selective breakdown
  → Clean + Minor Variance → auto-baseline (existing loan creation flow)
  → Significant Variance + Structural Error + Anomalous → flag for MDA review
  → flagged_for_review_at = NOW(), review_window_deadline = NOW() + 14 days

Stage 2: MDA_OFFICER reviews flagged records (own MDA only)
  → Online: open RecordDetailDrawer → correct values + mandatory reason → save
  → Online: "Mark Reviewed — Values Correct" + mandatory explanation
  → Offline: download .xlsx worksheet → fill corrections in Excel → re-upload → preview → apply
  → All paths set corrected_by, corrected_at, correction_reason

Stage 3: DEPT_ADMIN verifies MDA corrections
  → Views MDA progress tracker (per-MDA completion %)
  → Opens reviewed record → sees correction details + reason
  → "Establish Baseline" individually or "Baseline All Reviewed" batch
  → Existing baseline logic creates loan + ledger entry
```

### State Detection — No New Status Column

The epic requirement explicitly specifies state derivation from existing + new columns:

| State | Detection Logic |
|---|---|
| **Not flagged** | `flagged_for_review_at IS NULL` — normal flow (auto-baselined or DEPT_ADMIN corrected via 8.0b) |
| **Pending MDA Review** | `flagged_for_review_at IS NOT NULL` AND `corrected_by IS NULL` |
| **MDA Reviewed** | `flagged_for_review_at IS NOT NULL` AND `corrected_by IS NOT NULL` AND `correction_reason IS NOT NULL` |
| **Baselined** | `is_baseline_created = true` |

### Critical Role Mapping

The story requirement uses "MDA_ADMIN" as a label. In the codebase this maps to the **existing** `mda_officer` role. **No new role is needed.**

| Story Label | Codebase Role | `scopeToMda` Behaviour |
|---|---|---|
| DEPT_ADMIN | `dept_admin` | `req.mdaScope = null` (sees all MDAs) |
| MDA_ADMIN | `mda_officer` | `req.mdaScope = user.mdaId` (own MDA only) |
| SUPER_ADMIN | `super_admin` | `req.mdaScope = null` (sees all MDAs) |

### Separation of Duties Matrix

| Action | `super_admin` | `dept_admin` | `mda_officer` |
|---|---|---|---|
| Upload migration file | Yes | Yes | No |
| Batch baseline (triggers selective) | Yes | Yes | No |
| View all MDA records | Yes | Yes | No (own MDA only) |
| Open RecordDetailDrawer | Yes | Yes | Yes (own MDA only) |
| Submit corrections with reason | Yes | Yes | Yes (own MDA only) |
| Mark reviewed (no correction) | Yes | Yes | Yes (own MDA only) |
| Download correction worksheet | Yes | Yes | Yes (own MDA only) |
| Upload correction worksheet | Yes | Yes | Yes (own MDA only) |
| Establish baseline | Yes | Yes | No |
| Extend review window | Yes | Yes | No |
| View MDA progress tracker | Yes | Yes | No |

### Auth Middleware Patterns

Two auth stacks needed — reuse existing `adminAuth` pattern from `migrationRoutes.ts` (grep for `adminAuth`):

```typescript
// Existing — DEPT_ADMIN + SUPER_ADMIN only (upload, baseline, extend, progress)
const adminAuth = [authenticate, requirePasswordChange, authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN), scopeToMda];

// New — includes MDA_OFFICER for review actions (view flagged, correct, worksheet)
const reviewAuth = [authenticate, requirePasswordChange, authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER), scopeToMda];
```

`scopeToMda` already handles MDA isolation: `mda_officer` gets `req.mdaScope = user.mdaId`, others get `null`. Pass `mdaScope` to all service functions — they filter queries accordingly.

### Reusing Existing Correction Infrastructure (Story 8.0b)

Story 8.0b already built the correction foundation. **Extend, don't fork:**

| Component | Status | 8.0j Extension |
|---|---|---|
| `corrected_by` column | Exists | Reuse — set by MDA_OFFICER or DEPT_ADMIN |
| `corrected_at` column | Exists | Reuse |
| `corrected_outstanding_balance` etc. (7 cols) | Exists | Reuse for MDA corrections |
| `original_values_snapshot` (jsonb) | Exists | Reuse — first-correction snapshot logic |
| `correctRecord()` service function | Exists | Extend: add mandatory `correction_reason` parameter. For backward compat, make it required only when `flagged_for_review_at IS NOT NULL` |
| `RecordDetailDrawer` component | Exists | Extend: add correction reason textarea, "Mark Reviewed" button, review metadata display |
| `CorrectionForm` sub-component | Exists | Add correction reason field |
| `CorrectionHistory` sub-component | Exists | Show correction reason in audit trail |
| `BaselineSection` sub-component | Exists | Add "Baseline All Reviewed" batch action for DEPT_ADMIN |

**CRITICAL: `correctRecord()` already handles:**
- Row-level lock (`FOR UPDATE`)
- Original values snapshot on first correction
- Re-computation of scheme expected if installment count changed
- Re-computation of variance category after correction
- Outstanding balance auto-recompute

Just add the `correction_reason` field to the update and to `correctMigrationRecordSchema` (Zod).

### Batch Baseline Modification — Minimal Change

Current flow in `baselineService.ts` → `createBatchBaseline()`:
```
1. Load non-baselined records (FOR UPDATE)
2. For each: validateBaselineEligibility() → eligible or skipped
3. Process eligible records → create loan + ledger entry
4. Return BatchBaselineResult with skippedRecords
```

New flow:
```
1. Load non-baselined records (FOR UPDATE)
2. Partition by variance category:
   a. autoBaseline = records where varianceCategory ∈ ['clean', 'minor_variance']
   b. flagForReview = records where varianceCategory ∈ ['significant_variance', 'structural_error', 'anomalous']
   c. (Records with NULL variance are treated as needing review)
3. For autoBaseline: validateBaselineEligibility() → eligible or skipped → process
4. For flagForReview: batch UPDATE flagged_for_review_at, review_window_deadline
5. Return extended BatchBaselineResult with autoBaselined + flaggedForReview breakdowns
```

### XLSX Worksheet Implementation

Use existing `xlsx` library (already installed, imported as `import XLSX from 'xlsx'` in `fileParser.ts`).

**Export pattern:**
```typescript
import XLSX from 'xlsx';

const wb = XLSX.utils.book_new();

// Corrections sheet — reference + empty correction columns
const correctionsData = flaggedRecords.map(r => ({
  'Record ID': r.id,
  'Staff Name': r.staffName,
  // ... reference columns (read-only context)
  'Corrected Outstanding Balance': '', // empty for user to fill
  // ... correction columns
  'Correction Reason': '', // mandatory
}));
const ws1 = XLSX.utils.json_to_sheet(correctionsData);
XLSX.utils.book_append_sheet(wb, ws1, 'Corrections');

// Instructions sheet — static text
const ws2 = XLSX.utils.aoa_to_sheet([['Instructions'], ['...']]);
XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

// Metadata sheet — hidden, for conflict detection
const ws3 = XLSX.utils.json_to_sheet([{ downloadedAt: new Date().toISOString(), uploadId, mdaId, recordCount }]);
ws3['!cols'] = []; // hide columns
wb.Workbook = { Sheets: [{ Hidden: 0 }, { Hidden: 0 }, { Hidden: 2 }] }; // Hidden=2 = very hidden
XLSX.utils.book_append_sheet(wb, ws3, 'Metadata');

const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
```

**Import pattern (reuse `fileParser.ts` approach):**
```typescript
const wb = XLSX.read(buffer, { cellDates: true });
const corrections = XLSX.utils.sheet_to_json(wb.Sheets['Corrections']);
const metadata = XLSX.utils.sheet_to_json(wb.Sheets['Metadata']);
```

### Financial Arithmetic Standard

**MANDATORY** — enforced since Story 8.0b code review:
- **Server:** `Decimal.js` with `{ precision: 20, rounding: Decimal.ROUND_HALF_UP }`
- **Frontend:** Cents-based integer comparison (multiply by 100, compare as integers)
- **Never use `Number()` for financial arithmetic**
- **Test values compared as `.toFixed(2)` strings**

### Non-Punitive Vocabulary

Use vocabulary from `packages/shared/src/constants/vocabulary.ts`:
- "Requires review" not "flagged" or "error"
- "Significant Variance — requires review" not "discrepancy"
- "Mark Reviewed — Values Correct" not "approve" or "confirm error"
- "Migration Records Requiring Your Review" not "flagged records"
- "Additional context" not "correction reason" in user-facing text
- Amber indicators for attention, teal for completion (never red)
- "Overdue" in amber (not red) — non-punitive even for deadline breach

### MetricHelp Integration

Wrap all progress tracker metrics with `<MetricHelp>` from `apps/client/src/components/shared/MetricHelp.tsx`:
- "Records Reviewed" → explain how review count is derived
- "Completion %" → explain reviewed/total calculation
- "Days Remaining" → explain 14-day window from flagging date
- "Review Window" → explain the MDA review process purpose

Add glossary entries to the typed `METRIC_GLOSSARY` for compile-time enforcement.

### Review Window Computation

```typescript
// Deadline computation
const deadline = new Date(flaggedForReviewAt);
deadline.setDate(deadline.getDate() + 14);

// Days remaining
const now = new Date();
const msRemaining = deadline.getTime() - now.getTime();
const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

// Countdown status
const countdownStatus = daysRemaining > 3 ? 'normal' : daysRemaining > 0 ? 'warning' : 'overdue';
```

### MDA Dashboard Integration

The MDA_OFFICER dashboard needs a new section. Check how existing role-based dashboard sections are rendered — likely in `apps/client/src/pages/dashboard/DashboardPage.tsx` with role-conditional rendering. Add "Migration Records Requiring Your Review" card conditionally when flagged records exist for the officer's MDA.

### Testing Standards

- Co-located tests: `*.test.ts` next to source files or in `__tests__/` directories
- Financial values: use `.toFixed(2)` string comparisons, never floating-point equality
- Integration tests: use real DB via test helpers (`createTestUpload`, `createTestMigrationRecord`)
- Auth tests: verify MDA_OFFICER scoping (can't see other MDAs), DEPT_ADMIN sees all
- Worksheet round-trip: generate XLSX → parse → verify structure matches → apply → verify DB state
- Review window: test boundary conditions (day 11 = warning, day 14 = overdue, extension resets)

### Transaction Scope Documentation

- **Batch baseline (Stage 1):** Single transaction wraps auto-baseline + flagging. If any baseline fails, entire batch rolls back. Flagging is atomic with baseline.
- **Individual review submission:** Transaction wraps record lock + correction + reason. Same pattern as existing `correctRecord()`.
- **Worksheet apply:** Single transaction wraps ALL corrections from worksheet. Atomic — either all apply or none.
- **Baseline reviewed (Stage 3):** Single transaction wraps all reviewed record baselines for the selected scope.

### Project Structure Notes

- Alignment with monorepo structure: server services in `apps/server/src/services/`, routes in `apps/server/src/routes/`, shared types in `packages/shared/src/types/`
- New service file: `mdaReviewService.ts` (review logic) + `correctionWorksheetService.ts` (XLSX export/import)
- New frontend components in `apps/client/src/pages/dashboard/components/` alongside existing migration components
- DB migration in `apps/server/drizzle/` — dev agent must check latest migration number at generation time and use the next sequential number

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 8, Story 8.0j] — Full AC definitions and three-stage pipeline
- [Source: apps/server/src/services/baselineService.ts] — `createBatchBaseline()` function (grep for it — line numbers may drift from parallel stories)
- [Source: apps/server/src/services/migrationValidationService.ts] — `correctRecord()` function (grep for it — line numbers may drift from parallel stories)
- [Source: apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx] — Drawer to extend with review UI
- [Source: apps/server/src/middleware/authorise.ts] — Role-based auth pattern
- [Source: apps/server/src/middleware/scopeToMda.ts] — MDA data isolation
- [Source: packages/shared/src/constants/roles.ts] — Role enum (mda_officer = story's "MDA_ADMIN")
- [Source: apps/server/src/lib/fileParser.ts:9] — XLSX import pattern
- [Source: packages/shared/src/types/migration.ts] — BatchBaselineResult type (grep for `BatchBaselineResult` — line numbers drift as parallel stories modify this file)
- [Source: packages/shared/src/constants/vocabulary.ts] — Non-punitive language constants
- [Source: apps/client/src/components/shared/MetricHelp.tsx] — MetricHelp tooltip component
- [Source: apps/server/drizzle/] — Dev agent must glob for latest `NNNN_*.sql` and use next sequential number (do NOT hardcode — parallel stories may have added migrations)
- [Source: apps/server/src/db/schema.ts] — `migration_records` table (grep for `migrationRecords` — line numbers may drift from parallel stories)
- [Source: Story 8.0b implementation] — Correction infrastructure (7 correction columns, correctRecord(), RecordDetailDrawer, audit trail, skip-and-collect baseline pattern)
- [Source: Story 8.0a implementation] — Three-vector model, scheme formula, variance categorisation

### Previous Story Intelligence

**From Story 8.0b (HARD dependency):**
- Correction columns (7 financial + snapshot + correctedBy/At) already exist — reuse them
- `correctRecord()` uses transaction with row-level lock — maintain this pattern
- `RecordDetailDrawer` has CorrectionForm, CorrectionHistory, BaselineSection sub-components — extend, don't duplicate (size may have changed from parallel stories)
- Code review found: all financial arithmetic must use cents-based integers on frontend, Decimal.js on server
- `BatchBaselineResult.skippedRecords` pattern: records that fail eligibility are collected, not errored
- UAT discovery: Alatishe case proved MDA officer has domain knowledge DEPT_ADMIN lacks — this is WHY 8.0j exists

**From Story 8.0a (dependency):**
- Three-vector model: Scheme Expected | Reverse Engineered | MDA Declared
- Variance now computed as MAX diff between Scheme Expected vs MDA Declared
- `computeSchemeExpected()` and `inferTenureFromRate()` available in `computationEngine.ts`
- Scheme formula: P × 13.33% ÷ 60 (always /60 regardless of tenure)

**Git patterns (recent commits):**
- All stories include code review fixes in same commit message
- Commit format: `feat: Story X.Y — Title with code review fixes`
- 100% test pass rate, typecheck clean, zero lint warnings enforced

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — clean implementation with zero regressions.

### Completion Notes List

- **Task 1:** Added 4 columns to `migration_records` (correction_reason, flagged_for_review_at, review_window_deadline, review_window_extensions) + composite index. Migration 0037 applied cleanly.
- **Task 2:** Extended `BatchBaselineResult` with autoBaselined/flaggedForReview. Added `FlaggedRecordSummary`, `MdaReviewProgress`, `CorrectionWorksheetPreview` types. Added 4 Zod schemas (submitReviewSchema, markReviewedSchema, extendWindowSchema, flaggedRecordsQuerySchema).
- **Task 3:** Modified `createBatchBaseline()` to partition records by variance category — clean+minor auto-baseline, significant+ flagged for 14-day MDA review.
- **Task 4:** Created `mdaReviewService.ts` with 7 functions: getFlaggedRecords, submitReview, markReviewedNoCorrection, getMdaReviewProgress, extendReviewWindow, baselineReviewedRecords. Extended correctRecord with correctionReason field.
- **Task 5:** Created `correctionWorksheetService.ts` — XLSX export with 3 sheets (Corrections, Instructions, Metadata hidden). Uses existing xlsx library.
- **Task 6:** Worksheet import with conflict detection (baselined-since-download, modified-by-another-user), preview before apply, single-transaction commit.
- **Task 7:** Added 10 API routes with reviewAuth (includes MDA_OFFICER) and adminAuth patterns. MDA scoping via existing scopeToMda middleware.
- **Task 8:** Added 9 React Query hooks in useMigration.ts for all review operations.
- **Task 9:** Updated BaselineConfirmationDialog to show selective breakdown (auto-baseline vs flagged for review).
- **Task 10:** Created MdaReviewSection for MDA_OFFICER dashboard — shows pending count, deadline, link to review queue.
- **Task 11:** Extended RecordDetailDrawer: correction reason textarea for flagged records, MarkReviewedButton for "values correct" path, ReviewMetadata for review status display.
- **Task 12:** Created CorrectionWorksheetActions — download/upload buttons, WorksheetPreview with categorized breakdown and apply action.
- **Task 13:** Created MdaReviewProgressTracker — per-MDA progress bars, countdown badges, extend button, baseline-all-reviewed action. Added MDA Review tab to MigrationPage.
- **Task 14:** 18 unit tests: review window computation (6), state detection (4), variance partitioning (5), correction reason validation (3). Full regression suite: 1010/1010 pass.

### Change Log

- 2026-04-04: Story 8.0j implementation complete — selective baseline, MDA review handoff, correction worksheet, progress tracker. 14 tasks, 18 new tests, zero regressions.
- 2026-04-04: Code review fixes applied — transaction safety (H1: applyCorrectionWorksheet, M1: extendReviewWindow, M2: baselineReviewedRecords), security (H2: worksheetApplySchema validation), correctness (M3: role passthrough, M4: mdaScope enforcement), documentation (M5: journal.json in File List), DRY (L1: countdownBadge, L2: glossary MetricHelp, L3: query limit). Unit tests rewritten to import from actual module. 11 integration tests written (C1). Fixed `getMdaReviewProgress` SQL aggregate Date coercion bug discovered during integration testing.

### File List

**New Files:**
- `apps/server/drizzle/0037_mysterious_anthem.sql` — Migration adding 4 MDA review columns + index
- `apps/server/drizzle/meta/0037_snapshot.json` — Drizzle snapshot for migration 0037
- `apps/server/src/services/mdaReviewService.ts` — MDA review service (7 functions)
- `apps/server/src/services/mdaReviewService.test.ts` — 19 unit tests
- `apps/server/src/services/mdaReviewService.integration.test.ts` — 11 integration tests (Tasks 14.1–14.6, 14.9)
- `apps/server/src/services/correctionWorksheetService.ts` — XLSX export/import service
- `apps/client/src/pages/dashboard/components/MdaReviewSection.tsx` — MDA officer dashboard section
- `apps/client/src/pages/dashboard/components/MdaReviewProgressTracker.tsx` — DEPT_ADMIN progress tracker
- `apps/client/src/pages/dashboard/components/CorrectionWorksheetActions.tsx` — Download/upload worksheet UI

**Modified Files:**
- `apps/server/drizzle/meta/_journal.json` — Drizzle migration journal updated for migration 0037
- `apps/server/src/db/schema.ts` — Added 4 columns + 1 index to migrationRecords
- `apps/server/src/services/baselineService.ts` — Selective batch baseline partitioning logic
- `apps/server/src/services/migrationValidationService.ts` — Extended correctRecord with correctionReason, getRecordDetail with review fields
- `apps/server/src/routes/migrationRoutes.ts` — Added 10 MDA review API routes + reviewAuth middleware
- `packages/shared/src/types/migration.ts` — Extended BatchBaselineResult, MigrationRecordDetail; added 4 new types
- `packages/shared/src/validators/migrationSchemas.ts` — Added 4 Zod schemas
- `packages/shared/src/index.ts` — Exported new types and schemas
- `packages/shared/src/constants/metricGlossary.ts` — Added reviewWindow and reviewProgress glossary entries
- `apps/client/src/hooks/useMigration.ts` — Added 9 React Query hooks
- `apps/client/src/pages/dashboard/components/BaselineConfirmationDialog.tsx` — Selective breakdown display
- `apps/client/src/pages/dashboard/components/BaselineResultSummary.tsx` — Flagged-for-review count display
- `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx` — Correction reason, mark reviewed, review metadata
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — MdaReviewSection for MDA_OFFICER role
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — MDA Review tab
