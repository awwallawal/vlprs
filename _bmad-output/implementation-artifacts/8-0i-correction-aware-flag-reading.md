# Story 8.0i: Correction-Aware Flag Reading

Status: ready-for-dev

## Story

As a **Department Admin**,
I want event flag corrections (filed in Story 7.3) to be respected by all downstream services — reconciliation engine, comparison engine, inactive loan detector, and pre-submission service,
So that correcting a flag actually changes how the system treats the loan, not just how it displays on the detail page.

**Origin:** Tech debt item #4 from E7+E6 retro (2026-03-29). Story 7.3 created the correction records but downstream services still read the original `submission_rows.eventFlag`. Zero-debt-forward: a correction that doesn't propagate is a half-delivered feature.

**Dependencies:** None — independent of 8.0a–8.0h. Can run in parallel with 8.0h.

## Acceptance Criteria

1. **Given** a submission row with `eventFlag = 'RETIREMENT'` and a correction record changing it to `'NONE'`, **When** the reconciliation engine processes this submission, **Then** it treats the row as a regular deduction row (no event), not a retirement event.

2. **Given** a submission row with `eventFlag = 'NONE'` and a correction record changing it to `'TRANSFER_OUT'`, **When** the comparison engine runs, **Then** it excludes this row from regular deduction comparison (event-flagged rows are excluded).

3. **Given** a staff member whose latest submission row has `eventFlag = 'NONE'` with a correction to `'LEAVE_WITHOUT_PAY'`, **When** the inactive loan detector checks this staff member, **Then** it uses the corrected flag value in the observation description and exclusion logic.

4. **Given** a staff member whose latest submission row has `eventFlag = 'NONE'` with a correction to `'RETIREMENT'`, **When** the pre-submission service checks for zero-deduction staff without events, **Then** it excludes this staff member (they have an effective event flag, even though the original is NONE).

5. **Given** a correction record exists, **When** any downstream service reads the effective flag, **Then** the LATEST correction (by `created_at DESC`) for that loan + submission row pair is used, not the first correction.

6. **Given** no correction record exists for a submission row, **When** any downstream service reads the effective flag, **Then** it uses the original `submission_rows.eventFlag` unchanged (backward compatible).

7. **Given** the `getEffectiveEventFlag()` helper, **When** called, **Then** it performs at most ONE additional query per batch (not per-row) by bulk-loading corrections for all relevant loan IDs upfront.

## Tasks / Subtasks

- [ ] Task 1: Create `getEffectiveEventFlags()` bulk helper (AC: 5, 6, 7)
  - [ ] 1.1: Create `apps/server/src/services/effectiveEventFlagHelper.ts` with:
    ```typescript
    /**
     * Bulk-load the latest event flag correction for each (loanId, submissionRowId) pair.
     * Returns a Map keyed by submissionRowId → corrected eventFlag.
     * If no correction exists for a row, the row won't be in the Map (caller uses original).
     */
    export async function getEffectiveEventFlags(
      submissionRowIds: string[]
    ): Promise<Map<string, EventFlagType>>
    ```
  - [ ] 1.2: Query `loan_event_flag_corrections` for all rows WHERE `submissionRowId IN (?)`, ordered by `createdAt DESC`, deduplicated to latest per `submissionRowId` using `DISTINCT ON`:
    ```sql
    SELECT DISTINCT ON (submission_row_id) submission_row_id, new_event_flag
    FROM loan_event_flag_corrections
    WHERE submission_row_id IN (...)
    ORDER BY submission_row_id, created_at DESC
    ```
  - [ ] 1.3: Also create a single-row convenience wrapper:
    ```typescript
    export async function getEffectiveEventFlag(
      submissionRowId: string,
      originalFlag: EventFlagType
    ): Promise<EventFlagType>
    ```
    Returns the corrected flag if a correction exists, otherwise returns `originalFlag`.
  - [ ] 1.4: Handle edge case: `submissionRowId` is nullable on `loan_event_flag_corrections` (schema line 749). For corrections without a `submissionRowId`, fall back to matching by `loanId` only. Add an overload:
    ```typescript
    export async function getEffectiveEventFlagsByLoan(
      loanIds: string[]
    ): Promise<Map<string, EventFlagType>>
    ```
    Uses `DISTINCT ON (loan_id)` ordered by `created_at DESC`.
  - [ ] 1.5: Unit test in `apps/server/src/services/effectiveEventFlagHelper.test.ts` (**new file**): no corrections → empty Map returned
  - [ ] 1.6: Unit test in same file: one correction → Map contains corrected flag
  - [ ] 1.7: Unit test in same file: multiple corrections for same row → latest (by createdAt) wins
  - [ ] 1.8: Unit test in same file: corrections for different rows → each gets its own corrected flag

- [ ] Task 2: Apply to reconciliation engine (AC: 1)
  - [ ] 2.1: In `apps/server/src/services/reconciliationEngine.ts`, modify `_reconcile()` (lines 45-59):
    - After querying submission rows, collect all `submissionRowId` values
    - Call `getEffectiveEventFlags(submissionRowIds)` once
    - Replace each row's `eventFlag` with the effective flag before processing
    - The WHERE clause `event_flag != 'NONE'` stays in the DB query (it's a pre-filter for performance), but AFTER fetching, apply corrections: a row with original `RETIREMENT` corrected to `NONE` should be REMOVED from the event rows set; a row not in the initial query but corrected FROM `NONE` TO an event flag won't be caught — add a supplementary query for corrections that change `NONE` → event flag for this submission
  - [ ] 2.2: Modify `getReconciliationSummary()` (lines 292-304) — same pattern: apply corrections after query
  - [ ] 2.3: Integration test in `apps/server/src/services/reconciliationEngine.test.ts`: correction `RETIREMENT` → `NONE` causes row to be treated as regular deduction
  - [ ] 2.4: Integration test in same file: no corrections → behavior unchanged

- [ ] Task 3: Apply to comparison engine (AC: 2)
  - [ ] 3.1: In `apps/server/src/services/comparisonEngine.ts`, modify `compareSubmission()` (lines 61-78):
    - After querying submission rows (line 61-69), collect submission row IDs
    - Call `getEffectiveEventFlags(submissionRowIds)` once
    - In the filter (line 73: `row.eventFlag !== 'NONE'`), use effective flag instead of original:
      ```typescript
      const effectiveFlag = correctionMap.get(row.id) ?? row.eventFlag;
      if (effectiveFlag !== 'NONE') return false; // skip event rows
      ```
  - [ ] 3.2: Integration test in `apps/server/src/services/comparisonEngine.test.ts`: correction `NONE` → `TRANSFER_OUT` causes row to be excluded from comparison
  - [ ] 3.3: Integration test in same file: no corrections → behavior unchanged

- [ ] Task 4: Apply to inactive loan detector (AC: 3)
  - [ ] 4.1: In `apps/server/src/services/inactiveLoanDetector.ts`, modify `getSubmissionContext()` (lines 209-247):
    - This uses raw SQL (lines 220-232) — after fetching results, collect the submission row IDs. **Add `sr.id` to the SELECT** — it is currently missing (only selects `sr.staff_id, sr.event_flag, sr.amount_deducted, ms.mda_id`) and is required for correction lookup
    - Call `getEffectiveEventFlags(submissionRowIds)` once
    - Replace `row.event_flag` with the effective flag in the Map construction (lines 234-247)
  - [ ] 4.2: In the detection logic (lines 267-272), the effective flag is already in the Map from step 4.1 — no additional change needed there
  - [ ] 4.3: Add `sr.id` to the raw SQL SELECT clause (confirmed missing — current SELECT is `sr.staff_id, sr.event_flag, sr.amount_deducted, ms.mda_id`)
  - [ ] 4.4: Unit test in `apps/server/src/services/inactiveLoanDetector.test.ts`: correction `NONE` → `LEAVE_WITHOUT_PAY` changes observation description
  - [ ] 4.5: Unit test in same file: no corrections → behavior unchanged

- [ ] Task 5: Apply to pre-submission service (AC: 4)
  - [ ] 5.1: In `apps/server/src/services/preSubmissionService.ts`, modify the query (lines 82-98):
    - The current WHERE clause filters `eq(submissionRows.eventFlag, 'NONE')` at the DB level (line 96)
    - Option A (preferred): keep the DB filter as pre-filter, then post-filter with corrections — query rows WHERE original flag is NONE, then remove any whose effective flag is NOT NONE
    - Option B: remove the DB filter entirely and do all filtering in JS — less efficient, only use if corrections are common enough to warrant it
    - Go with Option A: after fetching, collect row IDs, call `getEffectiveEventFlags()`, filter out rows where correction changed NONE to something else
  - [ ] 5.2: Also handle the reverse: rows with original flag != NONE corrected to NONE should appear in the zero-deduction list. Add a supplementary query for corrections FROM event → NONE for the relevant period
  - [ ] 5.3: Unit test in `apps/server/src/services/preSubmissionService.test.ts`: correction `NONE` → `RETIREMENT` removes staff from zero-deduction warning list
  - [ ] 5.4: Unit test in same file: no corrections → behavior unchanged

- [ ] Task 6: Full regression and verification (AC: all)
  - [ ] 6.1: Run `pnpm typecheck` — zero errors
  - [ ] 6.2: Run `pnpm test` — zero regressions
  - [ ] 6.3: Run `pnpm lint` — zero new warnings
  - [ ] 6.4: Manual test: file an event flag correction (Story 7.3 UI) → trigger reconciliation → verify corrected flag is used → check inactive loan detector → verify corrected flag appears in observation

## Dev Notes

### The Core Problem

Story 7.3 built the correction UI and storage but the corrections are **display-only**. The original `submission_rows.eventFlag` column is immutable (append-only table, line 742 of schema.ts). Four downstream services read the original column directly — corrections are invisible to them.

### Correction Table Schema

**File:** `apps/server/src/db/schema.ts` (lines 741-760)

```typescript
loan_event_flag_corrections:
  id              UUID PK
  loanId          UUID FK → loans.id          (required)
  staffId         VARCHAR(50)                  (required)
  submissionRowId UUID FK → submission_rows.id (nullable)
  originalEventFlag event_flag_type            (required)
  newEventFlag    event_flag_type              (required)
  correctionReason TEXT                        (required, min 10 chars)
  correctedBy     UUID FK → users.id          (required)
  createdAt       TIMESTAMPTZ                  (required)
```

**Indexes:** `idx_loan_event_flag_corrections_loan_id`, `idx_loan_event_flag_corrections_created_at`

**Key design:** Append-only. Multiple corrections can exist for the same row. The latest by `createdAt` wins.

### The 4 Callsites — Exact Locations

| # | Service | File | Lines | Column Read | How It Uses the Flag |
|---|---------|------|-------|-------------|---------------------|
| 1 | Reconciliation Engine | `reconciliationEngine.ts` | 50, 57 (Query 1); 295, 302 (Query 2) | `submissionRows.eventFlag` | WHERE `!= 'NONE'` — finds event rows for mid-cycle reconciliation |
| 2 | Comparison Engine | `comparisonEngine.ts` | 64, 73 | `submissionRows.eventFlag` | Filter `!== 'NONE'` — excludes event rows from deduction comparison |
| 3 | Inactive Loan Detector | `inactiveLoanDetector.ts` | 221, 237, 267, 271-272 | `sr.event_flag` (raw SQL) | Checks `=== 'NONE'` and `!== 'NONE'` for observation logic |
| 4 | Pre-Submission Service | `preSubmissionService.ts` | 96 | `submissionRows.eventFlag` | WHERE `== 'NONE'` — finds staff with zero deduction and no event |

### Design Decision: Bulk Load, Not Per-Row Query

The helper loads corrections in bulk using `WHERE submissionRowId IN (...)` — one query per service call, not one query per row. This respects the N+1 query budget team agreement.

For the inactive loan detector (which uses raw SQL), the correction lookup happens after the initial query, using the submission row IDs from the results.

### DISTINCT ON for Latest Correction

PostgreSQL's `DISTINCT ON` efficiently picks the latest correction per submission row:

```sql
SELECT DISTINCT ON (submission_row_id) submission_row_id, new_event_flag
FROM loan_event_flag_corrections
WHERE submission_row_id IN ($1, $2, ...)
ORDER BY submission_row_id, created_at DESC
```

This returns exactly one row per submission_row_id — the most recent correction.

### Bidirectional Correction Impact

Corrections can go BOTH directions:
- **Event → NONE** (e.g., `RETIREMENT` corrected to `NONE`): Row should now be treated as a regular deduction
- **NONE → Event** (e.g., `NONE` corrected to `TRANSFER_OUT`): Row should now be treated as an event

The DB-level WHERE clauses pre-filter by original flag. Post-filtering with corrections handles:
- Removing rows from the result set (event corrected to NONE)
- But NOT adding rows that were filtered out (NONE corrected to event)

For completeness, services that filter `WHERE eventFlag = 'NONE'` (pre-submission) or `WHERE eventFlag != 'NONE'` (reconciliation) need a supplementary check for corrections in the opposite direction. The simplest approach: run a supplementary query on `loan_event_flag_corrections` for the relevant period to find corrections that would add/remove rows.

### submissionRowId Nullable Caveat

`submissionRowId` is nullable on the corrections table (schema line 749). Some corrections may have been filed without a specific submission row (e.g., correcting a flag on a loan without knowing which submission row). For these, fall back to `loanId`-based lookup. The `getEffectiveEventFlagsByLoan()` overload handles this case.

### Event Flag Enum Values

```typescript
'NONE' | 'RETIREMENT' | 'DEATH' | 'SUSPENSION' | 'TRANSFER_OUT' | 'TRANSFER_IN' |
'LEAVE_WITHOUT_PAY' | 'REINSTATEMENT' | 'TERMINATION' (DEPRECATED — retained for PostgreSQL compatibility) |
'ABSCONDED' | 'SERVICE_EXTENSION' | 'DISMISSAL'
```

Source: `apps/server/src/db/schema.ts` lines 592-599

### What This Story Does NOT Change

- **Correction creation** — Story 7.3's UI and `eventFlagCorrectionService.ts` unchanged
- **submission_rows.eventFlag** — remains immutable (never modified)
- **Correction display on detail page** — already works (Story 7.3)
- **Employment event creation from corrections** — already suggested by correction service (lines 49-72)
- **Observation engine** — the retro listed this as a callsite, but analysis shows the observation engine reads from `migration_records` (migration-time observations), not `submission_rows.eventFlag`. The observation engine is NOT affected. Pre-submission service is the actual 4th callsite

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Correction table schema | `apps/server/src/db/schema.ts` | 741-760 |
| Correction service | `apps/server/src/services/eventFlagCorrectionService.ts` | 9-87 (create), 89-125 (list) |
| Reconciliation engine | `apps/server/src/services/reconciliationEngine.ts` | 45-59, 292-304 |
| Comparison engine | `apps/server/src/services/comparisonEngine.ts` | 61-78 |
| Inactive loan detector | `apps/server/src/services/inactiveLoanDetector.ts` | 209-272 |
| Pre-submission service | `apps/server/src/services/preSubmissionService.ts` | 82-98 |
| Event flag enum | `apps/server/src/db/schema.ts` | 592-599 |
| New helper (to create) | `apps/server/src/services/effectiveEventFlagHelper.ts` | — |

### Testing Standards

- Co-located unit tests: `effectiveEventFlagHelper.test.ts`
- Integration tests in each affected service's test file
- Vitest framework
- Test BOTH directions: event→NONE and NONE→event

### Non-Punitive Vocabulary

- "Correction applied" (not "Override" or "Fix")
- "Effective flag" (not "True flag" or "Correct flag")
- Corrections are neutral — they reflect updated information, not error fixing

### Team Agreements Applicable

- **Extend, don't fork** — add correction layer on top of existing queries, don't rewrite them
- **N+1 query budget** — bulk load corrections once per service call, not per row
- **Zero-debt-forward** — this IS the debt item being resolved

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#Debt Item #4 — Correction-aware flag reading]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0i]
- [Source: apps/server/src/db/schema.ts:741-760 — loan_event_flag_corrections table]
- [Source: apps/server/src/db/schema.ts:592-599 — eventFlagTypeEnum values]
- [Source: apps/server/src/db/schema.ts:645 — submission_rows.eventFlag column]
- [Source: apps/server/src/services/eventFlagCorrectionService.ts:9-87 — Correction creation (display-only)]
- [Source: apps/server/src/services/reconciliationEngine.ts:45-59 — Reads original eventFlag]
- [Source: apps/server/src/services/comparisonEngine.ts:61-78 — Reads original eventFlag]
- [Source: apps/server/src/services/inactiveLoanDetector.ts:209-272 — Reads original event_flag (raw SQL)]
- [Source: apps/server/src/services/preSubmissionService.ts:82-98 — Reads original eventFlag]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
