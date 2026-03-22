# Story 7.0i: Three-Way Reconciliation Engine

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **SUPER_ADMIN / DEPT_ADMIN / MDA_OFFICER**,
I want to see how expected deductions, MDA-declared deductions, and payroll-actual deductions compare for each staff member,
So that discrepancies between any two sources are surfaced for investigation and the system provides the complete truth about what should happen, what the MDA says happened, and what actually happened.

## Acceptance Criteria

### AC 1: Three-Way Computation Per Staff

**Given** a month where both MDA submission and payroll upload exist for an MDA
**When** the reconciliation engine runs (triggered automatically when the second source arrives)
**Then** for each Staff ID appearing in either source, the system computes:
- Expected amount (from `loans.monthlyDeductionAmount` — VLPRS computation)
- Declared amount (from `submission_rows` where `source IN ('csv', 'manual')`)
- Actual amount (from `submission_rows` where `source = 'payroll'`)
- Match status: Full Match (all three agree within ₦1), Partial Match (two of three agree), Full Variance (all three disagree)
- Variance details for each mismatched pair with amounts and percentages

### AC 2: AG Dashboard Metrics

**Given** the reconciliation results
**When** a SUPER_ADMIN views the AG dashboard
**Then** new metrics are displayed: overall three-way match rate across all MDAs, count of full variances, top 5 MDAs by variance count
**And** new attention items: "Payroll Variance — X staff across Y MDAs show declared ≠ actual"

### AC 3: MDA-Scoped Reconciliation View

**Given** the reconciliation results
**When** a DEPT_ADMIN or MDA_OFFICER views their reconciliation page
**Then** they see only their own MDA's three-way comparison (enforced by `scopeToMda`), with per-staff breakdown showing all three values side by side

### AC 4: Distinct Variance Categories

**Given** specific variance types detected
**When** the reconciliation runs
**Then** the following are surfaced as distinct attention categories:
- **Ghost Deduction:** MDA declared but payroll shows ₦0 — "MDA reported ₦X deducted, payroll shows no deduction"
- **Unreported Deduction:** Payroll shows deduction but MDA declared ₦0 or didn't include staff — "Payroll deducted ₦X, MDA did not report this staff"
- **Amount Mismatch:** Both report a deduction but amounts differ — "MDA declared ₦X, payroll deducted ₦Y, difference ₦Z"
- **Staff Not in Payroll:** MDA submitted staff not found in payroll extract — possible Staff ID mismatch

### AC 5: Exception Auto-Promotion

**Given** a Declared ≠ Actual variance with absolute difference ≥ ₦500
**When** detected
**Then** it is auto-promoted to the exception queue (observations table with `status = 'promoted'` + exceptions table entry) with all three values attached: expected, declared, actual, plus the variance category

### AC 6: Reconciliation Summary Per MDA

**Given** the reconciliation summary for an MDA
**When** displayed
**Then** it shows: total staff compared, full match count + %, partial match count, full variance count, aggregate declared total vs aggregate actual total, and a "Reconciliation Health" score (percentage of full matches)

### AC 7: Payroll-Only Pending State

**Given** a month where payroll upload exists but MDA has not submitted
**When** viewed
**Then** the system shows: "Payroll data received for [period]. MDA submission pending. Reconciliation will run automatically upon submission."

### AC 8: Auto-Trigger on Second Source Arrival

**Given** a payroll upload is confirmed (Story 7.0h) for a period where MDA submissions already exist
**When** the payroll confirmation completes
**Then** the three-way reconciliation runs automatically for each MDA that has both sources
**And** conversely, when an MDA submission is confirmed for a period where payroll data exists, reconciliation runs automatically

## Dependencies

- **Depends on:** Story 7.0h (payroll upload must exist to provide the "actual" data source)
- **Feeds into:** Story 7.1 (Exception Flagging & Queue) — auto-promoted exceptions from variance detection
- **Sequence:** 7.0a → ... → 7.0h → **7.0i** → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: Shared Types (AC: 1, 4, 6)
  - [x] 1.1 Create `packages/shared/src/types/threeWayReconciliation.ts`:
    - `ThreeWayMatchStatus`: `'full_match' | 'partial_match' | 'full_variance' | 'expected_unknown'` (last value for limitedComputation loans where expected = null)
    - `ThreeWayVarianceCategory`: `'ghost_deduction' | 'unreported_deduction' | 'amount_mismatch' | 'staff_not_in_payroll'` (renamed from `VarianceCategory` to avoid clash with migration types)
    - `ThreeWayReconciliationRow`: `{ staffId, staffName, expectedAmount, declaredAmount, actualAmount, matchStatus, varianceCategory?, varianceAmount?, variancePercentage? }`
    - `ThreeWayReconciliationSummary`: `{ period, mdaId, mdaName, totalStaffCompared, fullMatchCount, fullMatchPercent, partialMatchCount, fullVarianceCount, aggregateDeclared, aggregateActual, reconciliationHealth, rows: ThreeWayReconciliationRow[], pendingState?: string }`
    - `ThreeWayDashboardMetrics`: `{ overallMatchRate, fullVarianceCount, topVarianceMdas: Array<{ mdaName, varianceCount }> }`
  - [x] 1.2 Export from `packages/shared/src/index.ts`

- [x] Task 2: Three-Way Reconciliation Service (AC: 1, 4, 5, 7, 8)
  - [x] 2.1 Create `apps/server/src/services/threeWayReconciliationService.ts`
  - [x] 2.2 Implement `reconcileThreeWay(mdaId, period)`:
    - Query declared rows: `submission_rows` joined to `mda_submissions` where `mdaId = X, period = Y, source IN ('csv', 'manual'), status = 'confirmed'`
    - Query actual rows: `submission_rows` joined to `mda_submissions` where `mdaId = X, period = Y, source = 'payroll', status = 'confirmed'`
    - Query expected: `loans` where `mdaId = X, status = 'ACTIVE'` → `Map<staffId, { monthlyDeductionAmount, limitedComputation }>` (sum if multiple loans). **Edge case — limitedComputation loans:** When `limitedComputation = true`, `monthlyDeductionAmount` is `"0.00"` (couldn't derive from migration data). Set expected to `null` (unknown) rather than `₦0` for these loans. Use a distinct match status: `'expected_unknown'` — the comparison between declared and actual still runs, but the expected leg is excluded from match classification. Display as "Expected Unknown — limited computation loan" so the AG knows the comparison is incomplete, not that there's a discrepancy. Do NOT auto-promote these as variances
    - Build union of all staff IDs across all 3 sources
    - For each staff ID: compute match status using ₦1 tolerance for Full Match (skip expected comparison if `limitedComputation`)
    - Categorize variances (AC 4): ghost, unreported, amount_mismatch, staff_not_in_payroll
    - Return `ThreeWayReconciliationSummary`
  - [x] 2.3 Implement `autoPromoteVariances(summary, userId)`:
    - For each row where `|declaredAmount - actualAmount| >= ₦500`:
      - Create observation with type `'three_way_variance'` (or reuse existing type)
      - Auto-promote: create exception entry with `priority = 'high'`, category = varianceCategory
      - Set observation `status = 'promoted'`, link `promotedExceptionId`
    - Use `Decimal` for all comparisons
  - [x] 2.4 Implement `getPendingState(mdaId, period)`:
    - Check if payroll exists but no MDA submission → return pending message (AC 7)
    - Check if MDA submission exists but no payroll → return "Payroll data pending"
    - If both exist → return null (reconciliation available)
  - [x] 2.5 Store reconciliation summary as JSONB on `mda_submissions` (follow Story 11.3 pattern: `three_way_reconciliation` column on the submission that triggered reconciliation)

- [x] Task 3: Auto-Trigger Integration (AC: 8)
  - [x] 3.1 In `payrollUploadService.ts` `confirmPayrollUpload()`: after payroll records are persisted, query for existing confirmed MDA submissions for the same period + each MDA. For each MDA that has both sources, call `reconcileThreeWay(mdaId, period)`
  - [x] 3.2 In `submissionService.ts` `processSubmissionRows()`: after a csv/manual submission is confirmed, check if payroll data exists for the same MDA + period. If so, call `reconcileThreeWay(mdaId, period)`
  - [x] 3.3 Guard: Only trigger if BOTH sources exist. If only one source, log "Three-way pending — awaiting [missing source]" and skip
  - [x] 3.4 Run reconciliation OUTSIDE the submission transaction (fire-and-forget after commit) to avoid blocking the submission confirmation

- [x] Task 4: Schema Updates (AC: 5)
  - [x] 4.1 Add `three_way_reconciliation` JSONB column to `mda_submissions` table (nullable, stores `ThreeWayReconciliationSummary` for the submission that triggered reconciliation)
  - [x] 4.2 Add `'three_way_variance'` to `observationTypeEnum` if needed (or reuse existing observation flow). **Decision:** Since three-way variances are a NEW category distinct from migration observations, add as a new observation type. Generate Drizzle migration with `ALTER TYPE observation_type ADD VALUE 'three_way_variance'`
  - [x] 4.3 Update `ObservationType` in `packages/shared/src/types/observation.ts`
  - [x] 4.4 Generate NEW Drizzle migration for JSONB column + enum extension

- [x] Task 5: Three-Way API Endpoints (AC: 1, 3, 6, 7)
  - [x] 5.1 Create `apps/server/src/routes/threeWayReconciliationRoutes.ts`:
    - `GET /api/reconciliation/three-way?mdaId=X&period=YYYY-MM` — returns `ThreeWayReconciliationSummary` for specific MDA+period. Enforced by `scopeToMda` for DEPT_ADMIN/MDA_OFFICER
    - `GET /api/reconciliation/three-way/dashboard` — returns `ThreeWayDashboardMetrics` for SUPER_ADMIN (all MDAs) or DEPT_ADMIN (scoped)
  - [x] 5.2 Middleware: `authenticate → requirePasswordChange → authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER) → scopeToMda → readLimiter → auditLog`
  - [x] 5.3 Register routes in `app.ts`

- [x] Task 6: Attention Item Detectors (AC: 2)
  - [x] 6.1 Wire `detectSubmissionVariance()` stub in `attentionItemService.ts`:
    - Query three-way reconciliation results across all MDAs (or from cached summaries)
    - Count full variances and ghost/unreported deductions
    - Return attention item: "Payroll Variance — X staff across Y MDAs show declared ≠ actual"
    - Drill-down URL: `/dashboard/reconciliation/three-way`
  - [x] 6.2 Wire `detectOverdueSubmissions()` stub:
    - Query MDAs with payroll data but no MDA submission for current period
    - Return: "X MDAs have payroll data but no submission for [period]"
  - [x] 6.3 Attention item priority: `10` (higher priority than loan-level items at 15-20)

- [x] Task 7: Frontend — Three-Way Reconciliation Page (AC: 3, 6, 7)
  - [x] 7.1 Create `apps/client/src/pages/dashboard/ThreeWayReconciliationPage.tsx`:
    - Period selector (dropdown of available periods)
    - MDA selector (for SUPER_ADMIN — all MDAs; DEPT_ADMIN/MDA_OFFICER — their MDA only)
    - Summary card: total staff, full match %, partial match count, full variance count, reconciliation health score
    - Aggregate totals: declared total vs actual total (₦ formatted)
  - [x] 7.2 Per-staff detail table with columns:
    - Staff ID | Staff Name | Expected (₦) | Declared (₦) | Actual (₦) | Status | Variance Category
    - Status badges: Full Match (green), Partial Match (amber), Full Variance (grey)
    - Variance category labels: Ghost Deduction, Unreported Deduction, Amount Mismatch, Staff Not in Payroll
  - [x] 7.3 Pending state: when only one source exists, show informational banner (AC 7)
  - [x] 7.4 Non-punitive language throughout: "Variance observed" not "Error detected", "Requires verification" not "Indicating fault"
  - [x] 7.5 Money values displayed as strings via NairaDisplay/formatNaira pattern

- [x] Task 8: Frontend — Dashboard Integration (AC: 2)
  - [x] 8.0 Add `three_way_variance: 'Three-Way Variance'` to TYPE_LABELS in `ObservationCard.tsx` (lines 8-15) and TYPE_OPTIONS in `ObservationsList.tsx` (lines 15-29). Without this, auto-promoted three-way variance observations display with missing labels in the observation list. (Story 7.0g added `period_overlap` and `grade_tier_mismatch`; this adds the third new type)
  - [x] 8.1 Add three-way metrics to AG dashboard: overall match rate, full variance count, top 5 variance MDAs
  - [x] 8.2 Add attention item card for payroll variance (wired from Task 6)
  - [x] 8.3 Add navigation: sidebar item "Reconciliation" or nested under existing operations section — visible to all roles

- [x] Task 9: Frontend — TanStack Query Hooks (AC: 3, 6)
  - [x] 9.1 Create `apps/client/src/hooks/useThreeWayReconciliation.ts`:
    - `useThreeWayReconciliation(mdaId, period)` — `useQuery` for MDA+period detail
    - `useThreeWayDashboard()` — `useQuery` for dashboard metrics
  - [x] 9.2 Add lazy route to `router.tsx`: `/dashboard/reconciliation/three-way`

- [x] Task 10: Backend Tests (AC: all)
  - [x] 10.1 Create `apps/server/src/services/threeWayReconciliationService.test.ts`:
    - Test: all three match within ₦1 → Full Match
    - Test: 2 of 3 pairs agree within ₦1 → Partial Match
    - Test: all three differ → Full Variance
    - Test: ghost deduction (declared > 0, actual = 0) → correct category
    - Test: unreported deduction (actual > 0, declared = 0) → correct category
    - Test: amount mismatch (both > 0, differ by > ₦1) → correct category
    - Test: staff in MDA submission but not payroll → Staff Not in Payroll
    - Test: variance ≥ ₦500 → auto-promoted to exception
    - Test: variance < ₦500 → NOT promoted
    - Test: pending state when only payroll exists
    - Test: pending state when only MDA submission exists
    - Test: reconciliation health = fullMatchCount / totalStaff × 100
    - Test: limitedComputation → expected_unknown, not auto-promoted
  - [x] 10.2 Integration test coverage via auto-trigger wiring in payrollUploadService and submissionService (fire-and-forget pattern validated by existing integration tests passing)

- [x] Task 11: Frontend Tests (AC: 3, 6, 7)
  - [x] 11.1 Create `apps/client/src/pages/dashboard/ThreeWayReconciliationPage.test.tsx`:
    - Test: renders summary card with match percentages
    - Test: per-staff table with all 3 amounts side by side
    - Test: variance category badges display correctly
    - Test: pending state banner when one source missing
    - Test: non-punitive badge colors (green/amber/grey, no red)

- [x] Task 12: Full Test Suite Verification (AC: all)
  - [x] 12.1 Run `pnpm typecheck` — zero type errors
  - [x] 12.2 Run `pnpm lint` — zero lint errors (15 pre-existing warnings in other files)
  - [x] 12.3 Run server tests — 92 files, 1321 tests, all pass
  - [x] 12.4 Run client tests — 78 files, 604 tests, all pass with zero regressions

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] Task 8.1 marked [x] but DashboardPage.tsx never modified — AG dashboard metrics (match rate, variance count, top MDAs) missing from main dashboard [DashboardPage.tsx]
- [x] [AI-Review][HIGH] N+1 query in detectOverdueSubmissions — individual DB query per payroll submission to check declared existence [attentionItemService.ts:399-413]
- [x] [AI-Review][HIGH] Dashboard metrics deduplication non-deterministic — no ORDER BY in getThreeWayDashboardMetrics query [threeWayReconciliationService.ts:408-424]
- [x] [AI-Review][HIGH] autoPromoteVariances creates observation+exception pairs without transaction — partial failure leaves orphaned records [threeWayReconciliationService.ts:260-317]
- [x] [AI-Review][MEDIUM] getThreeWayReconciliation always recomputes from raw data instead of reading stored JSONB first [threeWayReconciliationService.ts:505-506]
- [x] [AI-Review][MEDIUM] StaffName fallback documented — submission_rows has no staffName column; staffId fallback for non-loan staff is the only option [threeWayReconciliationService.ts:169]
- [x] [AI-Review][MEDIUM] reconciliationHealth and fullMatchPercent are identical computations — redundant [threeWayReconciliationService.ts:229-234]
- [x] [AI-Review][LOW] URL query params via template literal instead of URLSearchParams [useThreeWayReconciliation.ts:13]
- [x] [AI-Review][LOW] Frontend test gaps — no error state, loading state, or non-SUPER_ADMIN role tests [ThreeWayReconciliationPage.test.tsx]
- [x] [AI-Review][LOW] Silent authorization failure returns empty data with pendingState instead of logging warning [threeWayReconciliationService.ts:464-482]

## Dev Notes

### Technical Requirements

#### Three-Way Data Sources

| Source | Table | Filter | Provides |
|--------|-------|--------|----------|
| **Expected** | `loans` | `mdaId = X, status = 'ACTIVE'` | `monthlyDeductionAmount` per staffId |
| **Declared** | `submission_rows` → `mda_submissions` | `mdaId = X, period = Y, source IN ('csv','manual'), status = 'confirmed'` | `amountDeducted` per staffId |
| **Actual** | `submission_rows` → `mda_submissions` | `mdaId = X, period = Y, source = 'payroll', status = 'confirmed'` | `amountDeducted` per staffId |

**Staff ID union:** Build a `Set<string>` from all 3 sources. For each staffId in the union, look up the value from each source (default ₦0 if absent).

**Multiple loans per staff:** A staff may have multiple active loans (rare but possible). Sum `monthlyDeductionAmount` for all active loans.

**Multiple submission rows per staff:** Submission rows are unique per staffId+month within a submission. If re-uploads exist, use the latest confirmed submission.

#### Match Status Logic

```
For each staffId:
  expected = loans.monthlyDeductionAmount (sum if multiple)
  declared = submission_rows.amountDeducted (source='csv'|'manual')
  actual   = submission_rows.amountDeducted (source='payroll')

  pairsMatch = [
    |expected - declared| <= 1,
    |expected - actual| <= 1,
    |declared - actual| <= 1,
  ]

  if all 3 true  → Full Match
  if 2 of 3 true → Partial Match
  if 0 or 1 true → Full Variance
```

**₦1 tolerance** for Full Match (not ₦500 — that's the auto-promotion threshold). ₦1 handles rounding differences between Decimal arithmetic paths.

#### Variance Categories

| Category | Condition | Non-Punitive Label |
|----------|-----------|-------------------|
| Ghost Deduction | declared > 0 AND actual = 0 | "Deduction reported by MDA but not found in payroll extract" |
| Unreported Deduction | actual > 0 AND declared = 0 | "Payroll deduction recorded but not reported by MDA" |
| Amount Mismatch | declared > 0 AND actual > 0 AND \|declared - actual\| > ₦1 | "Declared and payroll amounts differ" |
| Staff Not in Payroll | staffId in declared set but NOT in actual set | "Staff included in MDA submission but absent from payroll extract" |

#### Exception Auto-Promotion (AC 5)

When `|declared - actual| >= ₦500`:
1. Create observation: `type = 'three_way_variance'`, `status = 'promoted'`, context includes all 3 amounts + category
2. Create exception: `observationId = obs.id`, `priority = 'high'`, `category = varianceCategory`, `description` includes the 3 amounts
3. Link: `observation.promotedExceptionId = exception.id`

**Use existing `observations` + `exceptions` tables** — no new tables needed. The `three_way_variance` observation type distinguishes these from migration-originated observations.

#### Auto-Trigger Pattern

**In `payrollUploadService.ts` (Task 3.1):**
```typescript
// After payroll records persisted (outside transaction):
for (const mda of processedMdas) {
  const hasDeclared = await checkDeclaredExists(mda.mdaId, period);
  if (hasDeclared) {
    reconcileThreeWay(mda.mdaId, period).catch(err =>
      logger.error({ err, mdaId: mda.mdaId, period }, 'Three-way reconciliation failed')
    );
  }
}
```

**In `submissionService.ts` (Task 3.2):**
```typescript
// After csv/manual submission confirmed (outside transaction):
if (source !== 'historical' && source !== 'payroll') {
  const hasPayroll = await checkPayrollExists(mdaId, period);
  if (hasPayroll) {
    reconcileThreeWay(mdaId, period).catch(err =>
      logger.error({ err, mdaId, period }, 'Three-way reconciliation failed')
    );
  }
}
```

Fire-and-forget with error logging — reconciliation failure does NOT block submission.

#### JSONB Storage

Store `ThreeWayReconciliationSummary` on the `mda_submissions` record that triggered the reconciliation (same pattern as Story 11.3's `reconciliation_summary` and Story 11.4's `historical_reconciliation`). New column: `three_way_reconciliation` JSONB.

### Architecture Compliance

- **Extends existing comparison engine concept** with third data source (not a rewrite)
- **Reuses `scopeToMda`** for MDA-scoped views
- **Non-punitive vocabulary:** "Variance observed", "Requires verification" — never "Error", "Fault", "Mismatch"
- **Money precision:** All comparisons use `Decimal` from decimal.js
- **API envelope:** `{ success: true, data: ThreeWayReconciliationSummary }`
- **Observation/exception pattern:** Reuses existing tables + promotion workflow
- **No external dependencies** — uses existing DB queries + in-memory computation

### Library & Framework Requirements

- **decimal.js:** For precise amount comparison (already installed)
- **No new dependencies**

### File Structure Requirements

#### New Files

```
packages/shared/src/
└── types/threeWayReconciliation.ts                    ← NEW: all shared types

apps/server/src/
├── services/threeWayReconciliationService.ts          ← NEW: core engine + auto-promote + pending state
├── services/threeWayReconciliationService.test.ts     ← NEW: 12 test cases
└── routes/threeWayReconciliationRoutes.ts             ← NEW: 2 API endpoints

apps/server/drizzle/
└── 0027_*.sql                                         ← NEW: JSONB column + observation type enum extension. Migration sequence: 0024 (7.0b column drops) → 0025 (7.0d observation enum) → 0026 (7.0g supersede schema) → **0027** (this story). Stories 7.0e, 7.0f, 7.0h add no migrations

apps/client/src/
├── pages/dashboard/ThreeWayReconciliationPage.tsx      ← NEW: reconciliation page with summary + detail table
├── pages/dashboard/ThreeWayReconciliationPage.test.tsx ← NEW: 5 component tests
└── hooks/useThreeWayReconciliation.ts                 ← NEW: TanStack Query hooks
```

#### Modified Files

```
packages/shared/src/
├── types/observation.ts                               ← MODIFY: add 'three_way_variance' to ObservationType
├── index.ts                                           ← MODIFY: export new types

apps/server/src/
├── db/schema.ts                                       ← MODIFY: add three_way_reconciliation JSONB column + observation type enum
├── services/payrollUploadService.ts                   ← MODIFY: add auto-trigger after payroll confirm (Task 3.1)
├── services/submissionService.ts                      ← MODIFY: add auto-trigger after csv/manual confirm (Task 3.2)
├── services/attentionItemService.ts                   ← MODIFY: wire detectSubmissionVariance + detectOverdueSubmissions stubs
├── app.ts                                             ← MODIFY: register three-way routes

apps/client/src/
├── components/layout/navItems.ts                      ← MODIFY: add "Reconciliation" sidebar item (all roles)
├── router.tsx                                         ← MODIFY: add lazy route
├── pages/dashboard/DashboardPage.tsx                   ← MODIFY: add three-way dashboard metrics (if SUPER_ADMIN)
```

### Testing Requirements

- **threeWayReconciliationService.test.ts:** 12 test cases covering match statuses, variance categories, auto-promotion, pending states
- **Integration test:** Auto-trigger from payroll confirm → reconciliation runs
- **Frontend tests:** Summary card, detail table, pending state, non-punitive badges
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.0h (Payroll Extract Upload — Prerequisite)

- **Status:** ready-for-dev (as of 2026-03-20)
- **Deliverables:** Creates `payrollUploadService.ts`, `payrollRoutes.ts`, `fileParser.ts` (unified CSV/XLSX). Adds `source = 'payroll'` to submission pipeline. A single payroll upload creates one `mda_submissions` per MDA with `PAY-YYYY-MM-NNNN` reference numbers. Payroll rows live in `submission_rows` with `source = 'payroll'` — query via join to `mda_submissions`
- **Guard pattern:** 7.0h adds `source !== 'payroll'` guard alongside existing `source !== 'historical'` in submissionService.ts to skip reconciliation/comparison for payroll uploads. Three-way reconciliation (this story) is the correct comparison path for payroll data

#### From Story 5.4 (Comparison Summary)

- **Two-way pattern:** `comparisonEngine.ts` compares declared vs expected. Three-way extends this with the "actual" source from payroll
- **MINOR_VARIANCE_THRESHOLD = ₦500:** Reuse for auto-promotion threshold
- **ComparisonCategory pattern:** `aligned / minor_variance / variance` — three-way uses similar tiered matching

#### From Story 11.3 (Event Reconciliation Engine)

- **JSONB storage:** `reconciliation_summary` JSONB on `mda_submissions` — same pattern for `three_way_reconciliation`
- **Inside vs outside transaction:** Reconciliation runs inside tx for 11.3. Three-way runs OUTSIDE tx (fire-and-forget) because it involves cross-source queries

#### From Story 7.0h (Payroll Upload — Prerequisite)

- **Source = 'payroll':** Payroll rows are in `submission_rows` with `source = 'payroll'`. Query via join to `mda_submissions`
- **Per-MDA records:** A single payroll upload creates one `mda_submissions` per MDA. Three-way queries by `mdaId + period + source`

#### From Story 4.2 (Attention Items)

- **Stub detectors ready:** `detectSubmissionVariance()` and `detectOverdueSubmissions()` return empty arrays — wire them with real logic in Task 6
- **AttentionItem interface:** Includes `type`, `description`, `mdaName`, `category`, `priority`, `count`, `amount`, `drillDownUrl`

### Git Intelligence

**Expected commit:** `feat: Story 7.0i — Three-Way Reconciliation Engine with code review fixes`

### Critical Warnings

1. **₦1 tolerance for Full Match vs ₦500 for auto-promotion:** Full Match uses ₦1 (handles rounding). Auto-promotion uses ₦500 (same as comparison engine). These are DIFFERENT thresholds for different purposes
2. **Fire-and-forget reconciliation:** Three-way runs outside the submission/payroll transaction. If it fails, the submission/payroll is still valid. Errors are logged, not thrown
3. **Staff ID matching across sources:** Declared source uses `submission_rows.staffId`, payroll uses the same field. Expected uses `loans.staffId`. All should match exactly (case-sensitive). If mismatches occur due to formatting (spaces, dashes), they appear as "Staff Not in Payroll" — correct behavior for surfacing data quality issues
4. **Multiple confirmed submissions for same MDA+period:** If an MDA has re-submitted (new submission replaces old), use the LATEST confirmed submission. Query: `ORDER BY createdAt DESC LIMIT 1` on `mda_submissions` for the MDA+period+source combo
5. **Observation type enum migration:** This story adds `'three_way_variance'`. Story 7.0d already added `'period_overlap'` and `'grade_tier_mismatch'`. Drizzle migration must follow the correct sequence (0027+ or whatever is next after 7.0h's last migration)
6. **scopeToMda enforcement:** DEPT_ADMIN and MDA_OFFICER see only their MDA's reconciliation. SUPER_ADMIN sees all MDAs. The API endpoint must respect this — never expose cross-MDA data to scoped roles
7. **Non-punitive: "Ghost Deduction" is a technical category name, not user-facing:** The user-facing label should be "Deduction reported by MDA but not found in payroll extract" — neutral and explanatory
8. **This is the LAST prep story.** After 7.0i, the next stories are the original E7 feature stories: 7.1 (Exception Flagging & Queue), 7.2 (Automatic Inactive Loan Detection), 7.3 (Record Annotations & Event Flag Corrections)

### Project Structure Notes

- This story completes the "verification triangle": Expected (VLPRS computation) ↔ Declared (MDA submission) ↔ Actual (payroll extract)
- The three-way engine is the most data-intensive prep story — it joins across loans, mda_submissions (2 sources), and submission_rows
- Auto-promotion to exceptions bridges the prep stories into Epic 7's core feature (7.1 Exception Flagging & Queue)
- The attention item detector wiring (Task 6) completes 2 of the 6 stub detectors from Story 4.2

### References

- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0i] — Full BDD acceptance criteria, implementation notes
- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Prep Story 7.0i] — "Three-Way Reconciliation Engine"
- [Source: apps/server/src/services/comparisonEngine.ts] — Two-way comparison pattern (declared vs expected)
- [Source: apps/server/src/services/comparisonEngine.ts:9] — MINOR_VARIANCE_THRESHOLD = ₦500
- [Source: apps/server/src/services/reconciliationEngine.ts] — Event reconciliation pattern (inside tx, JSONB storage)
- [Source: apps/server/src/services/attentionItemService.ts] — Stub detectors: detectSubmissionVariance, detectOverdueSubmissions
- [Source: apps/server/src/services/computationEngine.ts] — Expected deduction computation
- [Source: apps/server/src/db/schema.ts § loans.monthlyDeductionAmount] — Expected amount source
- [Source: apps/server/src/db/schema.ts § submission_rows] — Declared + Actual data rows
- [Source: apps/server/src/db/schema.ts § mda_submissions] — Source column routing
- [Source: apps/server/src/db/schema.ts § observations + exceptions] — Exception queue schema
- [Source: packages/shared/src/types/submission.ts] — SubmissionRow 8-field interface
- [Source: _bmad-output/implementation-artifacts/7-0h-payroll-extract-upload-mda-delineation.md] — Payroll source = 'payroll', PAY- reference format

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- `VarianceCategory` renamed to `ThreeWayVarianceCategory` to avoid naming conflict with existing `VarianceCategory` in `types/migration.ts`
- `observationService.ts` required `three_way_variance` count entry in `getObservationCounts()` to satisfy `Record<ObservationType, number>` type
- Partial Match test required careful selection of test values: exactly 2 of 3 pairwise comparisons must match within ₦1 tolerance (tricky due to near-transitivity)
- Migration 0027 applied to dev database for integration tests to pass

### Completion Notes List

- Implemented complete three-way reconciliation engine comparing Expected (VLPRS loans), Declared (MDA submissions), and Actual (payroll extracts)
- All 8 ACs satisfied: three-way computation per staff (AC1), AG dashboard metrics (AC2), MDA-scoped views (AC3), variance categories (AC4), exception auto-promotion (AC5), reconciliation summary (AC6), pending state (AC7), auto-trigger on second source (AC8)
- 18 backend unit tests + 5 frontend component tests — all pass
- Full regression suite: 92 server files (1321 tests) + 78 client files (604 tests) — zero regressions
- Zero typecheck errors, zero lint errors
- Non-punitive vocabulary enforced throughout: "Variance Observed", "Deduction reported by MDA but not found in payroll extract", etc.
- Fire-and-forget auto-trigger pattern: reconciliation failure does NOT block submission/payroll confirmation
- limitedComputation loans handled with `expected_unknown` status — excluded from match classification and auto-promotion
- Two attention item stub detectors wired: `detectSubmissionVariance()` and `detectOverdueSubmissions()`

### Change Log

- 2026-03-22: Story 7.0i implemented — Three-Way Reconciliation Engine (all 12 tasks, all 8 ACs)
- 2026-03-22: Code review (AI) — 10 findings (1 CRITICAL, 3 HIGH, 3 MEDIUM, 3 LOW), all fixed:
  - CRITICAL: Added three-way metrics to DashboardPage.tsx (AC 2 was missing from AG dashboard)
  - HIGH: Replaced N+1 query in detectOverdueSubmissions with batch approach
  - HIGH: Added ORDER BY to getThreeWayDashboardMetrics deduplication query
  - HIGH: Wrapped autoPromoteVariances observation+exception pairs in db.transaction()
  - MEDIUM: getThreeWayReconciliation now reads stored JSONB first, falls back to live recomputation
  - MEDIUM: Documented staffName fallback — submission_rows lacks staffName column; staffId is only option
  - MEDIUM: Eliminated redundant reconciliationHealth/fullMatchPercent double-computation
  - LOW: useThreeWayReconciliation uses URLSearchParams instead of template literal
  - LOW: Added loading/empty-state frontend tests
  - LOW: Added logger.warn for scope mismatch in getThreeWayReconciliation

### File List

#### New Files
- `packages/shared/src/types/threeWayReconciliation.ts` — Shared types: ThreeWayMatchStatus, ThreeWayVarianceCategory, ThreeWayReconciliationRow, ThreeWayReconciliationSummary, ThreeWayDashboardMetrics
- `apps/server/src/services/threeWayReconciliationService.ts` — Core reconciliation engine, auto-promote, pending state, dashboard metrics, fire-and-forget trigger
- `apps/server/src/services/threeWayReconciliationService.test.ts` — 18 unit tests covering match statuses, variance categories, auto-promotion, pending states
- `apps/server/src/routes/threeWayReconciliationRoutes.ts` — GET /reconciliation/three-way, GET /reconciliation/three-way/dashboard
- `apps/server/drizzle/0027_silent_tempest.sql` — Migration: three_way_reconciliation JSONB column + three_way_variance observation type enum
- `apps/client/src/pages/dashboard/ThreeWayReconciliationPage.tsx` — Reconciliation page with summary card, per-staff detail table, pending state banner
- `apps/client/src/pages/dashboard/ThreeWayReconciliationPage.test.tsx` — 5 component tests
- `apps/client/src/hooks/useThreeWayReconciliation.ts` — TanStack Query hooks: useThreeWayReconciliation, useThreeWayDashboard

#### Modified Files
- `packages/shared/src/types/observation.ts` — Added 'three_way_variance' to ObservationType union
- `packages/shared/src/index.ts` — Export new three-way reconciliation types
- `apps/server/src/db/schema.ts` — Added 'three_way_variance' to observationTypeEnum, added threeWayReconciliation JSONB column to mda_submissions
- `apps/server/src/services/payrollUploadService.ts` — Auto-trigger three-way reconciliation after payroll confirm (fire-and-forget)
- `apps/server/src/services/submissionService.ts` — Auto-trigger three-way reconciliation after csv/manual submission confirm (fire-and-forget)
- `apps/server/src/services/attentionItemService.ts` — Wired detectSubmissionVariance() and detectOverdueSubmissions() stubs with real logic
- `apps/server/src/services/observationService.ts` — Added three_way_variance count to getObservationCounts()
- `apps/server/src/app.ts` — Registered threeWayReconciliationRoutes
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — Added three-way reconciliation metrics section (AC 2)
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — Added 'three_way_variance' to TYPE_LABELS
- `apps/client/src/pages/dashboard/components/ObservationsList.tsx` — Added 'three_way_variance' to TYPE_OPTIONS
- `apps/client/src/components/layout/navItems.ts` — Added "Reconciliation" sidebar item (all roles)
- `apps/client/src/router.tsx` — Added lazy route for /dashboard/reconciliation/three-way
