# Story 16.1: Cross-Month Diffing Engine & Anomaly Detection

Status: ready-for-dev

## Story

As the **Accountant General / Department Admin**,
I want the system to automatically compare consecutive monthly submissions for each MDA and detect anomalies at the individual record level,
so that data integrity issues are surfaced proactively rather than requiring manual cell-by-cell spreadsheet comparison.

**Origin:** Story 8.0b UAT escalation #4 (2026-04-01). Discovery spike (16.0) completed 2026-04-02.

**Dependencies:** Story 8.0d (Multi-Sheet Period Handling — accurate period fields). No E15 dependency.

## Acceptance Criteria

### AC1: Auto-Trigger on Submission Confirmation

**Given** a new MDA submission is confirmed (source: 'csv' or 'manual', not 'historical'),
**When** the comparison engine completes in `processSubmissionRows()`,
**Then** the cross-month diff runs automatically in its own try/catch (awaited but failure-safe — failures are logged but don't fail the submission).

### AC2: Disappearing Beneficiary Detection

**Given** staff X appears in month N's confirmed submission for MDA Y,
**When** month N+1's submission for MDA Y is confirmed and staff X is absent,
**Then** a `disappearing_beneficiary` finding is created with severity based on employment event context (High if no explaining event, Medium if event on file).

### AC3: Reappearing Beneficiary Detection

**Given** staff X was present in month N-1, absent in month N, present again in month N+1,
**When** month N+1's submission is confirmed,
**Then** a `reappearing_beneficiary` finding is created (Medium severity) noting the gap duration.

### AC4: Deduction Change Detection

**Given** staff X appears in both month N and N+1 submissions,
**When** `amountDeducted` differs between months,
**Then** a `deduction_change` finding is created with severity: Low (<₦500), Medium (₦500–₦5,000), High (>₦5,000).

### AC5: Phantom Completion Detection

**Given** staff X was present in month N but absent in month N+1,
**When** the staff's active loan has remaining balance > 0 and no completion/write-off event exists,
**Then** a `phantom_completion` finding is created (High severity).

### AC6: New Mid-Stream Appearance Detection

**Given** staff X appears in current month's submission,
**When** no prior confirmed submissions exist for this staff + MDA combination,
**Then** a `new_midstream_appearance` finding is created (Medium severity).

### AC7: Auto-Link to Employment Events

**Given** a `disappearing_beneficiary` finding for staff X,
**When** an employment event (RETIRED, TRANSFERRED_OUT, DECEASED, DISMISSED, LWOP_START) exists for staff X in the relevant MDA with effective date within 60 days of the submission period,
**Then** the finding is auto-populated with `autoLinkedEventId` and `autoExplanation`, and severity downgraded to Medium.

### AC8: First-Submission Baseline Handling

**Given** an MDA's first-ever confirmed submission,
**When** no previous confirmed submission exists for this MDA,
**Then** no cross-month findings are generated (this establishes the baseline).

### AC9: Gap-Tolerant Comparison

**Given** MDA Y submitted for January and March but not February,
**When** March submission is confirmed,
**Then** the diff compares March against January (most recent previous confirmed), not against a non-existent February.

### AC10: Idempotent Execution

**Given** the diff has already run for a submission pair,
**When** re-triggered (e.g. reprocessing),
**Then** existing findings for this pair are deleted and regenerated (idempotent).

### AC11: Cross-Month Summary on Submission

**Given** the diff completes for a submission,
**Then** `cross_month_findings_count` and `cross_month_findings_summary` (jsonb: `{ byType, bySeverity, autoLinkedCount }`) are stored on the `mda_submissions` record for O(1) access.

## Tasks / Subtasks

- [ ] **Task 1 — DB Migration: Cross-Month Schema** (AC: all)
  - [ ] 1.1 Define enum `cross_month_finding_type`: `'disappearing_beneficiary' | 'reappearing_beneficiary' | 'deduction_change' | 'phantom_completion' | 'new_midstream_appearance'`
  - [ ] 1.2 Define enum `finding_severity`: `'low' | 'medium' | 'high'`
  - [ ] 1.3 Define enum `finding_status`: `'unreviewed' | 'expected' | 'resolved'`
  - [ ] 1.4 Create `cross_month_findings` table: id, current_submission_id (FK), previous_submission_id (FK), mda_id (FK), staff_id, staff_name, finding_type, severity, current_value (jsonb), previous_value (jsonb), variance_amount (numeric 15,2), auto_linked_event_id (FK nullable → employment_events), auto_explanation (text nullable), status (default 'unreviewed'), reviewed_by (FK nullable → users), reviewed_at (timestamptz nullable), resolution_note (text nullable), created_at, updated_at
  - [ ] 1.5 Add indexes: `(current_submission_id)`, `(mda_id, created_at)`, `(staff_id)`, `(finding_type, status)`
  - [ ] 1.6 Add columns to `mda_submissions`: `cross_month_findings_count` (integer nullable), `cross_month_findings_summary` (jsonb nullable)
  - [ ] 1.7 Run `drizzle-kit generate` — Drizzle auto-assigns the next sequential migration number. Do NOT hardcode or assume a specific number; parallel stories may have added migrations. Verify hash, commit meta snapshot.

- [ ] **Task 2 — Shared Types** (AC: all)
  - [ ] 2.1 Add `CrossMonthFinding` type in `packages/shared/src/types/crossMonth.ts`: all fields from schema + computed `daysRemaining` for display
  - [ ] 2.2 Add `CrossMonthSummary` type: `{ byType: Record<FindingType, number>, bySeverity: Record<Severity, number>, autoLinkedCount: number, total: number }`
  - [ ] 2.3 Add `CrossMonthDiffResult` type: `{ submissionId, previousSubmissionId, mdaId, findings: CrossMonthFinding[], summary: CrossMonthSummary }`
  - [ ] 2.4 Export `FindingType`, `FindingSeverity`, `FindingStatus` union types
  - [ ] 2.5 Add Zod response schemas for API validation

- [ ] **Task 3 — Core Diffing Service** (AC: 1,8,9,10)
  - [ ] 3.1 Create `apps/server/src/services/crossMonthDiffService.ts`
  - [ ] 3.2 `diffSubmission(submissionId, mdaId)` — main entry point
  - [ ] 3.3 Find most recent previous confirmed submission for same MDA (gap-tolerant — AC9)
  - [ ] 3.4 If no previous submission, return early (first-submission baseline — AC8)
  - [ ] 3.5 Load submission_rows for both submissions, indexed by staffId
  - [ ] 3.6 Delete existing findings for this submission pair (idempotent — AC10)
  - [ ] 3.7 Run all 5 detectors (Tasks 4–8), collect findings
  - [ ] 3.8 Batch insert findings into `cross_month_findings`
  - [ ] 3.9 Update `mda_submissions` with summary counts (AC11)

- [ ] **Task 4 — Disappearing Beneficiary Detector** (AC: 2,7)
  - [ ] 4.1 `detectDisappearingBeneficiaries(previousRows, currentRows, mdaId)` — find staffIds in previous but not in current
  - [ ] 4.2 For each missing staff: query `employment_events` for explaining events within 60 days of submission period
  - [ ] 4.3 If event found: severity = Medium, populate autoLinkedEventId + autoExplanation
  - [ ] 4.4 If no event: severity = High, autoExplanation = null
  - [ ] 4.5 Return `CrossMonthFinding[]` with previous_value containing last known amountDeducted

- [ ] **Task 5 — Reappearing Beneficiary Detector** (AC: 3)
  - [ ] 5.1 `detectReappearingBeneficiaries(previousRows, currentRows, mdaId)` — find staffIds in current and in historical submissions (≥2 months ago) but NOT in previous
  - [ ] 5.2 Query earlier confirmed submissions for same MDA (limit to 6-month lookback window) to confirm staff had prior presence. Use existing `submission_rows` index on `(staff_id, month)`.
  - [ ] 5.3 Compute gap duration (number of months absent)
  - [ ] 5.4 Return findings with severity = Medium, autoExplanation noting gap

- [ ] **Task 6 — Deduction Change Detector** (AC: 4)
  - [ ] 6.1 `detectDeductionChanges(previousRows, currentRows)` — find staffIds present in both, compare amountDeducted
  - [ ] 6.2 Use Decimal.js for precise comparison (reuse comparisonEngine precision pattern)
  - [ ] 6.3 Severity: abs(diff) < 500 → Low, 500–5000 → Medium, > 5000 → High
  - [ ] 6.4 Store variance_amount, current_value with current amount, previous_value with previous amount

- [ ] **Task 7 — Phantom Completion Detector** (AC: 5)
  - [ ] 7.1 `detectPhantomCompletions(previousRows, currentRows, mdaId)` — subset of disappearing staff (reuse disappearing list from Task 4)
  - [ ] 7.2 Batch-query `loans` table for disappearing staffIds where `status = 'ACTIVE'` (use `inArray(loans.staffId, staffIds)` — `loans.staffId` indexed via `idx_loans_staff_id`)
  - [ ] 7.3 For matched loans: compute outstanding balance via `balanceService.getOutstandingBalance(loanId)` or batch-aggregate from `ledger_entries` (join `loans` with `ledger_entries`, sum `principal_component`, check `principalAmount - totalPaid > 0`). **Note:** `loans` has NO stored balance column — balance is always computed from the immutable ledger.
  - [ ] 7.4 Check no completion or write-off transition exists (query `loan_state_transitions` for `toStatus IN ('COMPLETED', 'WRITTEN_OFF')`)
  - [ ] 7.5 Return findings with severity = High, current_value including `{ loanBalance, loanReference, loanStatus }`

- [ ] **Task 8 — New Mid-Stream Appearance Detector** (AC: 6)
  - [ ] 8.1 `detectNewMidstreamAppearances(currentRows, mdaId)` — find staffIds in current with no prior submissions for this MDA
  - [ ] 8.2 Query `submission_rows` joined with `mda_submissions` for same MDA, earlier periods
  - [ ] 8.3 Return findings with severity = Medium

- [ ] **Task 9 — Submission Confirmation Hook** (AC: 1)
  - [ ] 9.1 In `submissionService.ts → processSubmissionRows()`, add a NEW try/catch block AFTER the comparison engine's try/catch (which ends at ~line 517). Place it before the function's final return. This is a separate try/catch, not nested inside the comparison block:
    ```typescript
    // Cross-month diff (awaited, failure-safe — own try/catch)
    try {
      await diffSubmission(submissionId, mdaId);
    } catch (err) {
      logger.warn({ err, submissionId }, 'Cross-month diff failed (non-blocking)');
    }
    ```
  - [ ] 9.2 The `source === 'historical'` early return at ~line 467 already exits before this hook point, so no additional skip check needed. Confirm this by reading the flow.

- [ ] **Task 10 — Integration Tests** (AC: 1,2,3,4,5,6,7,8,9,10,11)
  - [ ] 10.1 Test full pipeline: create 2 submissions with overlapping/different staff → verify all 5 finding types
  - [ ] 10.2 Test first-submission baseline: no findings generated
  - [ ] 10.3 Test gap tolerance: skip a month → compare against most recent
  - [ ] 10.4 Test idempotency: run diff twice → same finding count
  - [ ] 10.5 Test auto-linking: create employment event → verify finding severity downgraded

- [ ] **Task 11 — Unit Tests** (AC: 2,3,4,5,6,7)
  - [ ] 11.1 Test each detector in isolation with synthetic data
  - [ ] 11.2 Test severity thresholds (₦500 and ₦5,000 boundaries) with Decimal.js string comparisons
  - [ ] 11.3 Test auto-link event matching with 60-day window boundary conditions

- [ ] **Task 12 — Vocabulary Constants** (AC: all)
  - [ ] 12.1 Add cross-month finding labels to `packages/shared/src/constants/vocabulary.ts`:
    - `CROSS_MONTH_STAFF_ABSENT`: "Staff absent from submission"
    - `CROSS_MONTH_STAFF_RETURNED`: "Staff returned after absence"
    - `CROSS_MONTH_DEDUCTION_CHANGED`: "Deduction amount changed"
    - `CROSS_MONTH_PHANTOM_COMPLETION`: "Loan balance remaining, staff absent"
    - `CROSS_MONTH_NEW_APPEARANCE`: "First appearance in MDA submissions"
  - [ ] 12.2 Add severity display labels:
    - `SEVERITY_HIGH`: "Review suggested"
    - `SEVERITY_MEDIUM`: "For awareness"
    - `SEVERITY_LOW`: "Minor change"
  - [ ] 12.3 Import and use these constants in the diff service — never hardcode label strings

- [ ] **Task 13 — Summary Computation** (AC: 11)
  - [ ] 13.1 After findings generated, compute summary: `{ byType, bySeverity, autoLinkedCount }`
  - [ ] 13.2 Update `mda_submissions.cross_month_findings_count` and `cross_month_findings_summary`
  - [ ] 13.3 Test summary accuracy against raw findings

## Dev Notes

### Prep Story Context (15.0a–15.0n)

- **15.0a:** `apiClient` unwrap bug fixed. For new paginated endpoints returning FLAT format (pagination at top level alongside `data`), use `authenticatedFetch + parseJsonResponse` — not `apiClient`. Check server response shape before choosing.
- **15.0b:** `generateObservations()` now auto-fires after baseline (fire-and-forget). The cross-month diffing engine fires on submission confirmation — same fire-and-forget pattern. Follow `baselineService.ts` post-transaction convention.
- **15.0n:** Supersede comparison service (`supersedeComparisonService.ts`) may exist by the time 16.1 is implemented. Its staff-matching + field-diff pattern is architecturally similar to cross-month diffing. Check for code reuse opportunities (shared diff utilities).
- **15.0j:** MetricHelp tooltips now expected on every metric. Ensure any new dashboard metrics from E16 include glossary entries in `metricGlossary.ts`.

### Dynamic Migration Numbering & Line-Number Drift

This story adds a new table, enums, and mda_submissions columns requiring a Drizzle migration. The migration number is auto-assigned by `drizzle-kit generate` — do NOT assume any specific number. Parallel stories (8.0d, 8.0h, 8.0j) also add migrations; the actual sequence depends on execution order. All `schema.ts` line numbers referenced below are approximate — use `grep` to locate targets (e.g., `grep -n 'migrationRecords\|mda_submissions\|submission_rows'`) rather than relying on hardcoded line numbers.

### Architecture: Awaited-but-Failure-Safe Hook

The cross-month diff follows the same pattern as the comparison engine in `submissionService.ts`. The comparison engine (line ~487) runs OUTSIDE the main submission transaction in a try/catch — it IS awaited, but failures don't block the submission response (the catch returns zero counts). The cross-month diff hooks in immediately after with its own try/catch:

```
processSubmissionRows() flow:
  1. Insert submission + rows (transaction) ← line ~395-425
  2. Reconcile events (inside transaction) ← line ~427-432
  3. Early return if source === 'historical' ← line ~467
  4. Compare declared vs expected (awaited, failure-safe try/catch) ← line ~486-517
  5. Cross-month diff (awaited, failure-safe try/catch) ← NEW, own try/catch after step 4
```

**Note:** The three-way reconciliation at line ~480 IS truly fire-and-forget (`.then()/.catch()`, no await). The comparison engine and cross-month diff are different — they are awaited but wrapped in try/catch so failures are graceful.

### Staff Matching Strategy

Primary match: `staffId` (VARCHAR 50). The `submission_rows` table has a composite index `idx_submission_rows_staff_month` on `(staff_id, month)` which is optimised for exactly this query pattern.

**Finding the previous submission:**
```sql
SELECT * FROM mda_submissions 
WHERE mda_id = ? AND status = 'confirmed' AND id != ?
ORDER BY created_at DESC LIMIT 1
```
This is gap-tolerant by design — it returns the most recent confirmed submission regardless of month gaps.

### Auto-Link Event Matching

Query pattern for auto-linking disappearances to employment events:
```sql
SELECT * FROM employment_events
WHERE staff_id = ? AND mda_id = ?
  AND event_type IN ('RETIRED', 'DECEASED', 'TRANSFERRED_OUT', 'DISMISSED', 'LWOP_START')
  AND effective_date BETWEEN (submission_period_start - 60 days) AND (submission_period_end + 60 days)
ORDER BY effective_date DESC LIMIT 1
```

The 60-day window is wider than the reconciliation engine's 7-day tolerance because cross-month comparison spans calendar months, not individual submissions.

**Auto-link event types (5 of 11):** `RETIRED, TRANSFERRED_OUT, DECEASED, DISMISSED, LWOP_START`
**Excluded event types:** `SUSPENDED` (disciplinary, staff may still have deductions), `ABSCONDED` (similar to phantom — should surface, not suppress), `TRANSFERRED_IN` (arrival, not departure), `LWOP_END` (return, not departure), `REINSTATED` (return), `SERVICE_EXTENSION` (continuation, not departure). Only events that explain a staff member's absence from payroll are auto-linked.

### Finding Value JSONBs

Store contextual data for display in the finding detail:
```typescript
// current_value example
{ amountDeducted: "16999.00", eventFlag: "NONE", month: "2024-10", staffId: "OY/12345" }

// previous_value example
{ amountDeducted: "16999.00", eventFlag: "NONE", month: "2024-09", staffId: "OY/12345" }
```

For `phantom_completion`, include loan data:
```typescript
{ loanBalance: "351989.00", loanReference: "LN-2024-0042", loanStatus: "ACTIVE" }
```

### Severity Thresholds

Reuse the comparison engine's ₦500 threshold for deduction changes:
- `DEDUCTION_CHANGE_MINOR = new Decimal(500)` — below this = Low
- `DEDUCTION_CHANGE_SIGNIFICANT = new Decimal(5000)` — above this = High
- Between = Medium

All comparisons use `Decimal.js` (server standard since Story 8.0a).

### Idempotency Pattern

Cross-month findings use **delete-then-recreate** scoped to the submission pair. This differs from the observation engine (which uses `onConflictDoNothing` with DB constraints). Delete+recreate is correct here because findings are tied to a specific current+previous submission pair, and reprocessing should replace stale findings entirely:
```typescript
// Delete existing findings for this submission pair, then regenerate
await tx.delete(crossMonthFindings)
  .where(and(
    eq(crossMonthFindings.currentSubmissionId, submissionId),
    eq(crossMonthFindings.previousSubmissionId, previousSubmissionId),
  ));
// Then batch-insert fresh findings + update summary in same transaction
```

### N+1 Query Budget

The diffing service should batch-load data to stay within budget:
1. Load current submission rows (1 query)
2. Find previous submission (1 query)
3. Load previous submission rows (1 query)
4. Batch-load employment events for all disappearing staff (1 query with `IN` clause)
5. Batch-load active loans for disappearing staff (1 query — `loans` table, `IN` clause on `staffId`)
6. Batch-load ledger aggregates for matched loans (1 query — `SUM(principal_component)` grouped by `loanId` to compute outstanding balance)
7. Batch-load historical submissions for reappearing/new-midstream detection (1 query, 6-month lookback limit)
8. Delete existing findings (1 query)
9. Batch insert new findings (1 query)
10. Update submission summary (1 query)

Total: 10 queries. Within budget.

### Transaction Scope

The diff runs OUTSIDE the main submission transaction (separate try/catch). Findings are inserted in their own transaction. This means:
- Submission succeeds even if diff fails
- Findings may be briefly inconsistent if diff is interrupted (acceptable — idempotent re-run fixes)
- The diff's own transaction wraps: delete old findings + insert new + update summary

### Edge Case: Superseded Submissions

When a submission is superseded (replaced by a new upload for same MDA+period), the supersede flow deletes the old `mda_submissions` record. Use `ON DELETE CASCADE` on `cross_month_findings.current_submission_id` and `previous_submission_id` FKs so findings are auto-cleaned. When the replacement submission is confirmed, the diff will regenerate findings with the new submission as the current pair.

### Non-Punitive Vocabulary

- Finding type labels: "Staff absent from submission" not "Missing beneficiary"
- Severity labels: "Review suggested" (High), "For awareness" (Medium), "Minor change" (Low)
- Auto-explanation: "Staff retired on 2025-03-15 — RETIREMENT event on file" (factual, not judgmental)

### Project Structure Notes

- New service: `apps/server/src/services/crossMonthDiffService.ts`
- New shared types: `packages/shared/src/types/crossMonth.ts`
- DB migration: `apps/server/drizzle/` — next sequential number after whatever is latest at implementation time
- Schema additions: `apps/server/src/db/schema.ts` — new table + enums + mda_submissions columns

### References

All line numbers below are approximate — parallel stories modify these files. Use `grep` to locate targets at implementation time.

- [Source: apps/server/src/services/submissionService.ts:~486-517] — Comparison engine try/catch pattern (hook point — grep for `compareSubmission`)
- [Source: apps/server/src/services/comparisonEngine.ts] — Variance thresholds (`MINOR_VARIANCE_THRESHOLD`) and Decimal.js precision (grep for `MINOR_VARIANCE`)
- [Source: apps/server/src/services/reconciliationEngine.ts] — Event matching pattern (grep for `reconcileSubmission`)
- [Source: apps/server/src/services/balanceService.ts] — `getOutstandingBalance()` for phantom completion detector (grep for `getOutstandingBalance`)
- [Source: apps/server/src/db/schema.ts] — `submission_rows` table (grep for `submissionRows`), `employment_events` (grep for `employmentEvents`), `mda_submissions` (grep for `mdaSubmissions`), `loans` (grep for `export const loans`)
- [Source: packages/shared/src/constants/vocabulary.ts] — Non-punitive language constants
- [Source: Story 16.0 discovery spike] — Schema design, reuse surface, anomaly taxonomy

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
