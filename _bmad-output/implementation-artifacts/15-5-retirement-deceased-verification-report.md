# Story 15.5: Retirement & Deceased Verification Report

Status: ready-for-dev

## Story

As a **Department Admin**,
I want to cross-reference the Committee's retiree/deceased list against system records,
So that I can identify retirees whose retirement events haven't been recorded, activate their gratuity settlement pathways, and record deceased beneficiaries for outstanding balance tracking.

**Origin:** Epic 15, FR95. Connects to existing Pathway 4 (gratuity deduction via `gratuityProjectionService`). Full specification: `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md` § "Retirement & Deceased Verification."

**Dependencies:**
- Story 15.1 (Committee List Upload) — provides `approved_beneficiaries` records with `listType = 'RETIREE'` or `'DECEASED'`
- Story 15.2 (Fuzzy Name Matching Engine) — matching engine for name resolution
- Story 8.0a (Scheme Formula) — three-vector validation for "No Match + Full Data" pathway
- Story 8.0b (Record Detail View) — inspect-and-correct flow pattern for financial data review

## Acceptance Criteria

1. **Given** retiree/deceased records exist in `approved_beneficiaries` (uploaded via Story 15.1 Track 2), **When** the Department Admin navigates to the Verification Report page, **Then** the system displays all retiree/deceased records grouped by verification status.

2. **Given** a retiree matches a loan with a retirement event already recorded, **Then** status: "Retirement Recorded" with event date and gratuity pathway status (active/computed/not available). Green badge.

3. **Given** a retiree matches an active loan with NO retirement event recorded, **Then** status: "Retirement Not Yet Recorded — Action Required" with a "Record Retirement Event" button. Amber badge.

4. **Given** a retiree matches a loan with stalled balance (3+ months no deduction) and no retirement event, **Then** status: "High Priority — Likely Retirement Gap" with prominent amber-gold styling. This is the gap the committee list surfaces.

5. **Given** a deceased beneficiary (LATE prefix) matches an active loan, **Then** status: "Deceased — Record Event" with outstanding balance displayed. Note: "Estate/guarantor recovery — policy determination required." No auto-settlement.

6. **Given** no match found but 17-column financial data exists on the record, **Then** status: "No Loan Record — Create from Committee Data?" with three-vector validation preview (Scheme Expected / Committee Declared). Department Admin can approve loan creation + immediate RETIRED/DECEASED status.

7. **Given** the Department Admin selects multiple retirees and clicks "Batch Record Retirements", **Then** a preview shows proposed actions, and on confirm: RETIRED employment events are filed for each in individual transactions with provenance `source: 'RETIREE_LIST_BATCH_IMPORT'`. Pathway 4 (`gratuityProjectionService`) activates for each.

8. **Given** deceased records are batch-processed, **Then** DECEASED employment events are filed → loan status transitions to DECEASED (terminal). Outstanding balance is recorded but no auto-settlement pathway activates.

9. **Given** a "No Match + Full Data" record is approved for loan creation, **Then** the system creates a loan record from the three-vector validated financial data, inserts a MIGRATION_BASELINE ledger entry, files a RETIRED/DECEASED employment event, and transitions the loan to the appropriate terminal status — all in a single atomic transaction with provenance tagging.

## Tasks / Subtasks

- [ ] Task 1: Create verification report service (AC: 1, 2, 3, 4, 5, 6)
  - [ ] 1.1: Create `apps/server/src/services/retirementVerificationService.ts` with:
    ```typescript
    export async function generateVerificationReport(
      filters?: { batchId?: string; mdaId?: string },
      mdaScope?: string | null
    ): Promise<VerificationReport>
    ```
  - [ ] 1.2: Query `approved_beneficiaries` WHERE `list_type IN ('RETIREE', 'DECEASED')`, filtered by batch/MDA
  - [ ] 1.3: For each record, run matching against `loans` table (reuse Story 15.2 engine if `match_status = 'UNMATCHED'`, otherwise use stored `matched_loan_id`):
    - **Matched + retirement event exists:** Query `employment_events` for loan → `RETIREMENT_RECORDED`
    - **Matched + no retirement event:** Check stalled balance (ledger entries, 3+ months gap) → `RETIREMENT_GAP` or `NO_RETIREMENT_EVENT`
    - **Matched + deceased:** → `DECEASED_ACTIVE_LOAN`
    - **No match + 17-col data:** Check if financial fields (principal, totalLoan, etc.) are populated → `NO_MATCH_FULL_DATA`
    - **No match + no data:** → `NO_MATCH_NO_DATA`
  - [ ] 1.4: For matched records, fetch gratuity pathway status via `gratuityProjectionService.getGratuityProjection(loanId)` — returns null if temporal profile incomplete
  - [ ] 1.5: Response type:
    ```typescript
    interface VerificationReport {
      summary: {
        total: number;
        retirementRecorded: number;
        actionRequired: number;
        highPriority: number;
        deceasedPending: number;
        noMatchFullData: number;
        noMatchNoData: number;
      };
      records: VerificationRecord[];
    }

    interface VerificationRecord {
      beneficiaryId: string;
      name: string;
      mdaName: string;
      listType: 'RETIREE' | 'DECEASED';
      verificationStatus: VerificationStatus;
      matchedLoan?: { loanId, loanReference, staffId, principalAmount, status, outstandingBalance };
      retirementEvent?: { eventId, eventDate, eventType };
      gratuityStatus?: 'active' | 'computed' | 'not_available';
      financialData?: { principal, totalLoan, outstandingBalance };  // from 17-col data
      matchConfidence?: number;
    }

    type VerificationStatus =
      | 'RETIREMENT_RECORDED'      // green — all good
      | 'NO_RETIREMENT_EVENT'      // amber — action required
      | 'RETIREMENT_GAP'           // amber-gold — high priority (stalled + no event)
      | 'DECEASED_ACTIVE_LOAN'     // amber — needs DECEASED event
      | 'NO_MATCH_FULL_DATA'       // teal — offer loan creation
      | 'NO_MATCH_NO_DATA';        // gray — informational only
    ```
  - [ ] 1.6: Unit test in `apps/server/src/services/retirementVerificationService.test.ts` (**new file**): retiree matched to loan with retirement event → RETIREMENT_RECORDED
  - [ ] 1.7: Unit test in same file: retiree matched to active loan, no event → NO_RETIREMENT_EVENT
  - [ ] 1.8: Unit test in same file: retiree matched to stalled loan → RETIREMENT_GAP
  - [ ] 1.9: Unit test in same file: LATE prefix beneficiary matched to active loan → DECEASED_ACTIVE_LOAN
  - [ ] 1.10: Unit test in same file: no match with 17-col data → NO_MATCH_FULL_DATA

- [ ] Task 2: Create batch retirement filing service (AC: 7, 8)
  - [ ] 2.1: Create `batchFileRetirementEvents()` in `retirementVerificationService.ts`:
    ```typescript
    export async function batchFileRetirementEvents(
      beneficiaryIds: string[],
      userId: string,
      mdaScope?: string | null
    ): Promise<BatchRetirementResult>
    ```
  - [ ] 2.2: For each beneficiary (individual transactions per record — Team Decision 3):
    - Verify beneficiary exists and has a `matched_loan_id`
    - Fetch the matched loan to get `staffId` — `createEmploymentEvent()` takes `staffId` (NOT `loanId`), it resolves the loan internally via staffId + mdaScope
    - Verify loan is in ACTIVE status (not already RETIRED/DECEASED)
    - Call existing `createEmploymentEvent()` from `employmentEventService.ts` with 4 params:
      - `data: { staffId: loan.staffId, eventType: beneficiary.listType === 'DECEASED' ? 'DECEASED' : 'RETIRED', effectiveDate: new Date().toISOString(), referenceNumber: 'RETIREE_LIST_BATCH_IMPORT-{batchId}', notes: 'Batch filed from Committee retiree/deceased list' }`
      - `mdaScope: mdaScope`
      - `userId: userId`
      - `userRole: userRole` (from authenticated user context — required 4th parameter)
  - [ ] 2.3: Collect results per record: `{ beneficiaryId, success, loanId, newStatus, error? }`
  - [ ] 2.4: Update `approved_beneficiaries`: set `onboarding_status = 'RETIRED'` or `'DECEASED'`. NOTE: these are NEW status values introduced by this story — the column is `varchar(50)` so no migration needed. Known values are now: `NOT_YET_OPERATIONAL` (15.1 default), `OPERATIONAL` (15.3), `RETIRED` (this story), `DECEASED` (this story)
  - [ ] 2.5: Return `BatchRetirementResult`:
    ```typescript
    { processed: number, succeeded: number, failed: number, results: RecordResult[] }
    ```
  - [ ] 2.6: Unit test in same file: batch file 3 retirements → 3 employment events created, loans transitioned to RETIRED
  - [ ] 2.7: Unit test in same file: one record fails (loan already RETIRED) → other records still succeed (individual transactions)
  - [ ] 2.8: Unit test in same file: deceased batch → loan transitions to DECEASED

- [ ] Task 3: Create loan creation from committee data (AC: 6, 9)
  - [ ] 3.1: Create `createLoanFromCommitteeData()` in `retirementVerificationService.ts`:
    ```typescript
    export async function createLoanFromCommitteeData(
      beneficiaryId: string,
      resolvedValues: 'scheme_expected' | 'committee_declared',
      userId: string,
    ): Promise<LoanCreationResult>
    ```
  - [ ] 3.2: In a single atomic transaction:
    1. Fetch beneficiary record (must have 17-col financial data populated)
    2. Derive loan data — adapt `deriveLoanFromMigrationRecord()` pattern from `baselineService.ts`:
       - `staffName` from beneficiary name
       - `staffId` generated as `COM-{batchId_short}-{seq}` (committee-derived, distinguishable from migration `MIG-*`)
       - `principalAmount` from beneficiary data (using scheme expected or committee declared per `resolvedValues`)
       - `interestRate: '13.330'` (standard scheme rate)
       - `tenureMonths` inferred from data or from `inferTenureFromRate()` (8.0a)
       - `mdaId` from `mda_canonical_id`
       - `status: 'ACTIVE'` initially
    3. Insert loan record
    4. Insert ACTIVE state transition audit entry
    5. Compute and insert MIGRATION_BASELINE ledger entry (reuse `computeBaselineEntry()` from baselineService)
    6. File RETIRED or DECEASED employment event → transitions loan to terminal status
    7. Insert terminal state transition audit entry
  - [ ] 3.3: Update `approved_beneficiaries`: set `matched_loan_id`, `match_status = 'CONFIRMED'`, `onboarding_status = 'RETIRED'` or `'DECEASED'`
  - [ ] 3.4: Provenance: loan `source` field includes `'Created from Committee retiree list — batch {batchLabel}'`
  - [ ] 3.5: Unit test in same file: create loan from 17-col retiree data → loan created + baseline + RETIRED
  - [ ] 3.6: Unit test in same file: create loan from deceased data → loan created + baseline + DECEASED

- [ ] Task 4: Create verification API endpoints (AC: 1, 7, 8, 9)
  - [ ] 4.1: Add to `apps/server/src/routes/committeeListRoutes.ts` (created in 15.1):
    - `GET /api/committee-lists/verification-report` — returns `VerificationReport`. Query params: `batchId`, `mdaId`. Auth: DEPT_ADMIN, SUPER_ADMIN
    - `POST /api/committee-lists/batch-file-events` — batch file retirement/deceased events. Body: `{ beneficiaryIds: string[] }`. Returns `BatchRetirementResult`
    - `POST /api/committee-lists/create-loan` — create loan from committee data. Body: `{ beneficiaryId, resolvedValues }`. Returns `LoanCreationResult`
  - [ ] 4.2: Integration test in `apps/server/src/routes/committeeList.integration.test.ts` (extends 15.1's file): verification report returns correct statuses for mixed retiree/deceased records
  - [ ] 4.3: Integration test in same file: batch file events → employment events created with provenance
  - [ ] 4.4: Integration test in same file: create loan from committee data → loan + baseline + transition in single transaction

- [ ] Task 5: Create Verification Report page (AC: 1, 2, 3, 4, 5, 6)
  - [ ] 5.1: Create `apps/client/src/pages/dashboard/RetirementVerificationPage.tsx`:
    - Route: `/dashboard/committee-lists/verification`
    - Accessible from CommitteeListsPage (15.1) — "Verification Report" button on retiree batches
  - [ ] 5.2: **Summary cards row** — 6 cards:
    - Retirement Recorded (green), Action Required (amber), High Priority (amber-gold), Deceased Pending (amber), No Match + Data (teal), No Match (gray)
  - [ ] 5.3: **Status filter tabs**: All | Action Required | High Priority | Deceased | No Match
  - [ ] 5.4: **Records table**: Name, MDA, Type (Retiree/Deceased badge), Status (badge), Matched Loan, Outstanding Balance, Actions
  - [ ] 5.5: **Row expansion** — click to expand showing:
    - For matched: loan details (reference, principal, status, balance, gratuity pathway status)
    - For "No Match + Full Data": three-vector preview (Scheme Expected vs Committee Declared)
  - [ ] 5.6: **Batch action bar** — checkbox selection + "Batch Record Retirements" / "Batch Record Deceased" buttons with confirmation dialog
  - [ ] 5.7: **"Create Loan" action** for NO_MATCH_FULL_DATA records — opens confirmation dialog with three-vector display, resolution selector (scheme expected / committee declared), and "Create Loan + Record Event" button

- [ ] Task 6: Create TanStack Query hooks (AC: all)
  - [ ] 6.1: Add to `apps/client/src/hooks/useCommitteeList.ts`:
    ```typescript
    useVerificationReport(batchId?, mdaId?)       // GET
    useBatchFileEvents()                          // POST mutation
    useCreateLoanFromCommittee()                  // POST mutation
    ```
  - [ ] 6.2: Query keys:
    ```typescript
    ['committee', 'verification', { batchId, mdaId }]
    ```
  - [ ] 6.3: On mutation success: invalidate verification report + onboarding dashboard queries

- [ ] Task 7: Full regression and verification (AC: all)
  - [ ] 7.1: Run `pnpm typecheck` — zero errors
  - [ ] 7.2: Run `pnpm test` — zero regressions
  - [ ] 7.3: Manual test: upload retiree file (15.1 Track 2) → run matching → open verification report → batch file retirements for matched records → verify employment events created + gratuity pathway active → verify "No Match + Full Data" → create loan → verify loan + baseline + RETIRED status

## Dev Notes

### The Six Verification Statuses

| Status | Badge | Meaning | Action |
|---|---|---|---|
| `RETIREMENT_RECORDED` | Green | Retiree matched, retirement event exists | None — verified |
| `NO_RETIREMENT_EVENT` | Amber | Retiree matched to active loan, no event | "Record Retirement Event" button |
| `RETIREMENT_GAP` | Amber-Gold | Matched, stalled 3+ months, no event | High priority — this is the gap the committee list surfaces |
| `DECEASED_ACTIVE_LOAN` | Amber | LATE prefix, matched to active loan | "Record Deceased Event" button |
| `NO_MATCH_FULL_DATA` | Teal | No loan match, but 17-col financial data exists | "Create Loan from Committee Data" |
| `NO_MATCH_NO_DATA` | Gray | No match, no financial data | Informational — connects to onboarding pipeline |

### Existing Employment Event Infrastructure (Reuse Everything)

**File:** `apps/server/src/services/employmentEventService.ts`

`createEmploymentEvent()` handles all the complexity:
- Loan status transition (ACTIVE → RETIRED or DECEASED)
- Duplicate guard (30-day window, bypassable)
- Audit trail (loan_state_transitions)
- Fire-and-forget email notification
- MDA scope enforcement

**EVENT_TO_STATUS_MAP:**
```typescript
RETIRED → 'RETIRED'    // terminal
DECEASED → 'DECEASED'  // terminal
```

Story 15.5 calls `createEmploymentEvent()` — does NOT reimplement transition logic.

### Gratuity Pathway Activation

`gratuityProjectionService.getGratuityProjection(loanId)` returns projections only if the loan has a `computedRetirementDate` in its temporal profile. For committee-derived retirees:

- **Matched loan with temporal data:** Gratuity computes automatically after RETIRED event
- **Matched loan without temporal data:** Returns null — "not available" (temporal profile incomplete)
- **New loan from committee data:** Temporal data unlikely (committee file has no DOB/DOA) → gratuity unavailable initially

The verification report shows gratuity status as `'active'` / `'computed'` / `'not_available'` so the Department Admin knows which retirees need temporal profile completion.

### Loan Creation: Adapting the Baseline Pattern

`deriveLoanFromMigrationRecord()` in `baselineService.ts` (lines 138-215) provides the template. The committee data pathway differs:

| Aspect | Migration Baseline | Committee Loan Creation |
|---|---|---|
| Source | Migration record (migration_records table) | Approved beneficiary (approved_beneficiaries table) |
| Staff ID | From Excel `employeeNo` or generated `MIG-*` | Generated `COM-{batchId}-{seq}` |
| Financial data | 17 columns in migration record | 17 columns in approved_beneficiaries |
| Initial status | ACTIVE | ACTIVE → immediately transitions to RETIRED/DECEASED |
| Ledger entry | MIGRATION_BASELINE | MIGRATION_BASELINE (same type — committee data is also legacy) |
| Provenance | `source: 'Migration baseline | ...'` | `source: 'Created from Committee retiree list — batch {label}'` |

### Individual Transactions (Team Decision 3)

Each retirement/deceased event is filed in its own transaction. Why:
- `createEmploymentEvent()` triggers `transitionLoan()` which involves ledger, state transitions, and potentially gratuity
- One giant batch transaction risks deadlocks across multiple loan records
- Partial success is acceptable — 47 out of 50 succeed, 3 fail with clear error messages

### Deceased: Informational Only

From the epic spec:
> "Deceased: informational only (estate/guarantor recovery is policy-driven)"

When a DECEASED event is filed:
- Loan → DECEASED (terminal status)
- Outstanding balance recorded
- **No automated settlement** — estate claims are outside VLPRS
- UI shows: "Estate/guarantor recovery — policy determination required"

### "No Match + No Data" Records

These are committee-listed retirees/deceased who:
1. Don't match any loan in the system (fuzzy matching failed)
2. Don't have 17-column financial data (came from a 5-column list, or data was incomplete)

These connect to the **onboarding pipeline** — they were approved but never had deductions started (NOT_YET_OPERATIONAL), and now they've retired. They represent potential write-off candidates or data gaps.

### Three-Vector Validation for Loan Creation

When creating a loan from "No Match + Full Data", the UI shows the three-vector comparison (reusing 8.0a infrastructure):
- **Scheme Expected:** P×13.33%÷60 — authoritative
- **Committee Declared:** Raw values from the 17-column file
- Department Admin selects which values to use for the loan record

This reuses the same `computeSchemeExpected()` function from Story 8.0a.

### What This Story Does NOT Build

- **Matching engine** — Story 15.2 (called here)
- **Committee list upload** — Story 15.1 (provides data)
- **New settlement pathways** — existing Pathway 4 (gratuity) activates automatically
- **Estate/guarantor recovery automation** — out of scope (policy-driven)
- **Payment/disbursement verification** — parked as potential Story 15.7

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Employment event service | `apps/server/src/services/employmentEventService.ts` | createEmploymentEvent, EVENT_TO_STATUS_MAP |
| Gratuity projection | `apps/server/src/services/gratuityProjectionService.ts` | getGratuityProjection |
| Loan transitions | `packages/shared/src/constants/loanTransitions.ts` | VALID_TRANSITIONS, TERMINAL_STATUSES |
| Baseline service (loan creation pattern) | `apps/server/src/services/baselineService.ts` | 138-215 (deriveLoanFromMigrationRecord), 217-279 (computeBaselineEntry) |
| Scheme expected (8.0a) | `apps/server/src/services/computationEngine.ts` | computeSchemeExpected |
| Matching engine (15.2) | `apps/server/src/services/nameMatchingEngine.ts` | tokenSetSimilarity |
| Committee list routes (15.1) | `apps/server/src/routes/committeeListRoutes.ts` | Add verification endpoints |
| Committee list hooks (15.1) | `apps/client/src/hooks/useCommitteeList.ts` | Add verification hooks |
| Approved beneficiaries (15.1) | `apps/server/src/db/schema.ts` | Created in Story 15.1 |
| New service | `apps/server/src/services/retirementVerificationService.ts` | To be created |
| New page | `apps/client/src/pages/dashboard/RetirementVerificationPage.tsx` | To be created |
| Epic 15 spec | `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md` | § Retirement & Deceased Verification |

### Non-Punitive Vocabulary

- "Retirement Not Yet Recorded" not "Missing retirement event"
- "Action Required" not "Error" or "Overdue"
- "Likely Retirement Gap" — observation, not accusation
- "Estate/guarantor recovery — policy determination required" — acknowledges this is a human decision
- "Create from Committee Data" not "Force-create" or "Override"

### Testing Standards

- Co-located tests: `retirementVerificationService.test.ts`
- Integration tests in committee list routes
- Vitest framework
- Test all 6 verification statuses
- Test individual transaction isolation (one failure doesn't block others)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 15.5]
- [Source: _bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md — § Retirement & Deceased Verification, § The Four Settlement Pathways]
- [Source: _bmad-output/planning-artifacts/epic-15-team-review.md — Decision 3 (individual transactions), Decision 5 (DECEASED separation), Decision 7 (17-col schema)]
- [Source: apps/server/src/services/employmentEventService.ts — createEmploymentEvent, EVENT_TO_STATUS_MAP]
- [Source: apps/server/src/services/gratuityProjectionService.ts — getGratuityProjection]
- [Source: packages/shared/src/constants/loanTransitions.ts — VALID_TRANSITIONS (RETIRED/DECEASED terminal)]
- [Source: apps/server/src/services/baselineService.ts:138-215 — deriveLoanFromMigrationRecord (loan creation pattern)]
- [Source: apps/server/src/services/baselineService.ts:217-279 — computeBaselineEntry (ledger entry pattern)]
- [Source: apps/server/src/services/computationEngine.ts — computeSchemeExpected (8.0a)]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
