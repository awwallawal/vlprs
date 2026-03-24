# Story 7.2: Automatic Inactive Loan Detection

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **system**,
I want to automatically detect loans with no deduction recorded for 60+ consecutive days and flag them,
So that potential issues (undeclared transfers, separations, payroll errors) are surfaced proactively.

## Acceptance Criteria

### AC 1: Inactive Loan Detection (FR57)

**Given** the inactive loan detection process
**When** the system evaluates active loans
**Then** any loan with no ledger entry for 60+ consecutive days is detected as inactive
**And** loans with a recent employment event explaining the gap (LWOP_START, SUSPENDED, ABSCONDED, TRANSFERRED_OUT) are excluded as "expected inactivity"

### AC 2: Automatic Exception Creation

**Given** a detected inactive loan with no expected employment event
**When** the detection process completes
**Then** an observation is created (`type = 'inactive_loan'`, `status = 'promoted'`) and an exception is auto-created with category `'inactive'` and priority `'medium'`
**And** the description includes: "No deduction recorded for X days. Last deduction: [date]. MDA declared event flag: NONE."

### AC 3: Idempotent Detection

**Given** the detection process runs multiple times
**When** a loan has already been flagged as an inactive exception (open or resolved)
**Then** a duplicate observation/exception is NOT created for the same loan
**And** only newly-inactive loans (not previously flagged) receive exceptions

### AC 4: Exception Queue Integration

**Given** an auto-flagged inactive loan exception
**When** it appears in the exception queue (Story 7.1)
**Then** it follows the same resolution workflow: admin can view loan detail, enter resolution note, select action taken, and resolve

### AC 5: Scheduled Background Detection

**Given** the server is running
**When** the detection scheduler fires (every 6 hours)
**Then** the inactive loan detection runs automatically for all active loans across all MDAs
**And** the scheduler does NOT run in test mode (`NODE_ENV === 'test'`)

### AC 6: On-Demand Detection Endpoint

**Given** a SUPER_ADMIN or DEPT_ADMIN
**When** they trigger detection via `POST /api/exceptions/detect-inactive`
**Then** the detection runs immediately (scoped to MDA for DEPT_ADMIN, all MDAs for SUPER_ADMIN)
**And** returns the count of newly created exceptions

### AC 7: Dashboard Attention Item Enhancement

**Given** the existing `detectZeroDeductionLoans()` attention item in `attentionItemService.ts`
**When** inactive loans are detected
**Then** the attention item description is enhanced to show: "X inactive loans — Y auto-flagged as exceptions, Z pending review"
**And** the drill-down URL navigates to the exception queue filtered by category `'inactive'`

## Dependencies

- **Depends on:** Story 7.1 (Exception Flagging & Queue) — provides `exceptionService`, exception routes, and resolution workflow
- **Feeds into:** Story 7.3 (Record Annotations) — can add annotations to explain inactivity
- **Sequence:** 7.0a → ... → 7.0i → 7.1 → **7.2** → 7.3

## Tasks / Subtasks

- [x] Task 1: Schema Addition — Observation Type (AC: 2)
  - [x] 1.1 Add `'inactive_loan'` to `observationTypeEnum` in `schema.ts`. Generate Drizzle migration: `ALTER TYPE observation_type ADD VALUE 'inactive_loan'`
  - [x] 1.2 Update `ObservationType` in `packages/shared/src/types/observation.ts`
  - [x] 1.3 Generate NEW Drizzle migration

- [x] Task 2: Inactive Loan Detection Service (AC: 1, 2, 3)
  - [x] 2.1 Create `apps/server/src/services/inactiveLoanDetector.ts`
  - [x] 2.2 Implement `detectInactiveLoans(mdaScope?: string | null, systemUserId: string)`:
    - Query all ACTIVE loans: `SELECT l.id, l.staffId, l.staffName, l.mdaId, MAX(le.createdAt) AS lastEntry FROM loans l LEFT JOIN ledger_entries le ON l.id = le.loanId WHERE l.status = 'ACTIVE' GROUP BY l.id`
    - Filter: loans where `lastEntry < NOW() - INTERVAL '60 days'` OR `lastEntry IS NULL`
    - If `mdaScope` provided, filter by `l.mdaId = mdaScope`
  - [x] 2.3 Implement expected-inactivity exclusion:
    - For each inactive loan, check `employment_events` for recent events (within 90 days) with type in `['LWOP_START', 'SUSPENDED', 'ABSCONDED', 'TRANSFERRED_OUT']`
    - If found → skip (expected inactivity, the loan status should have changed but may lag)
    - Batch query: `SELECT loanId, eventType FROM employment_events WHERE loanId IN (...) AND effectiveDate > NOW() - INTERVAL '90 days' ORDER BY effectiveDate DESC`
  - [x] 2.4 Implement submission-row cross-reference:
    - For each remaining inactive loan, check if the MDA's latest confirmed submission includes this staff with `eventFlag = 'NONE'` and `amountDeducted = '0.00'`
    - If submission shows ₦0 + NONE → enhance description: "MDA submitted ₦0 with no event flag — potential payroll error or undeclared separation"
    - If no submission data → note: "No MDA submission data available for cross-reference"
  - [x] 2.5 Implement idempotency check (AC 3):
    - Before creating observations, query existing observations: `type = 'inactive_loan' AND loanId = X AND status IN ('promoted', 'unreviewed')`
    - Skip loans that already have an open inactive observation
    - Resolved observations don't block — if a loan was resolved but becomes inactive again, a new observation is created
  - [x] 2.6 Create observations + auto-promote for each newly-inactive loan. **Use the observation-first path (NOT `flagLoanAsException`):**
    - Step 1: Create observation: `type = 'inactive_loan'`, `staffName`, `staffId`, `mdaId`, `loanId`, `description`, `context: { lastDeductionDate, daysSinceDeduction, hasSubmissionData, submissionEventFlag }`
    - Step 2: Promote via `observationService.promoteToException(observationId, systemUserId, 'medium')` — this creates the exception and links it to the observation
    - **Do NOT use `exceptionService.flagLoanAsException()`** — that creates a `manual_exception` observation type, which is wrong for auto-detection. The observation type must be `inactive_loan` (created in step 1), and `promoteToException()` preserves it
  - [x] 2.7 Return: `{ detected: number, excluded: number, newExceptions: number, alreadyFlagged: number }`

- [x] Task 3: Background Scheduler (AC: 5)
  - [x] 3.1 Add `startInactiveLoanScheduler()` function to `inactiveLoanDetector.ts`:
    - Uses `setInterval` with 6-hour period (21,600,000 ms)
    - First run after 5-minute server startup delay (avoid load spike)
    - Guard: `if (env.NODE_ENV === 'test') return` — no scheduling in test mode
    - Uses a system user ID for the `promotedBy` field (query or create a system user)
    - Wraps detection in try/catch with `logger.error` on failure (fire-and-forget, never crashes server)
  - [x] 3.2 Initialize from `apps/server/src/index.ts` after server listen (alongside integrityChecker from 7.0f)
  - [x] 3.3 Log each run: `logger.info({ detected, excluded, newExceptions, alreadyFlagged }, 'Inactive loan detection completed')`

- [x] Task 4: On-Demand API Endpoint (AC: 6)
  - [x] 4.1 Add `POST /api/exceptions/detect-inactive` to `exceptionRoutes.ts` (from Story 7.1)
  - [x] 4.2 Middleware: `authenticate → requirePasswordChange → authorise(SUPER_ADMIN, DEPT_ADMIN) → scopeToMda → writeLimiter → auditLog`
  - [x] 4.3 Handler: call `detectInactiveLoans(req.mdaScope, req.user.userId)`
  - [x] 4.4 Set `req.auditAction = 'INACTIVE_LOAN_DETECTION_RUN'`
  - [x] 4.5 Return `200` with detection result summary

- [x] Task 5: Attention Item Enhancement (AC: 7)
  - [x] 5.1 Update `detectZeroDeductionLoans()` in `attentionItemService.ts`:
    - After detecting inactive loans, query exception counts: `SELECT count(*) FROM exceptions WHERE category = 'inactive_loan' AND status = 'open'`
    - Enhance description: "X inactive loans — Y flagged as exceptions, Z pending review"
    - Update drill-down URL: `/dashboard/exceptions?category=inactive_loan`
  - [x] 5.2 Alternatively, add a separate attention item for auto-flagged exceptions (keep detectZeroDeductionLoans unchanged, add new detectInactiveExceptions detector)

- [x] Task 6: Frontend — Detection Trigger (AC: 6)
  - [x] 6.0 Add `inactive_loan: 'Inactive Loan'` to TYPE_LABELS in `ObservationCard.tsx` and TYPE_OPTIONS in `ObservationsList.tsx`. Auto-promoted inactive loan observations appear in the observation list — without the label, they display with missing type text. (Follows pattern from 7.0g, 7.0i, 7.1 which each added their new observation types to these components)
  - [x] 6.1 In `ExceptionsPage.tsx` (from 7.1): add "Run Inactive Detection" button (visible to SUPER_ADMIN and DEPT_ADMIN)
  - [x] 6.2 On click: call `POST /api/exceptions/detect-inactive`
  - [x] 6.3 On success: toast "Detection complete — X new exceptions created", invalidate exception queries
  - [x] 6.4 Add `useDetectInactive()` mutation hook to `useExceptionData.ts`

- [x] Task 7: Backend Tests (AC: all)
  - [x] 7.1 Create `apps/server/src/services/inactiveLoanDetector.test.ts`:
    - Test: loan with no ledger entry for 60+ days → detected as inactive
    - Test: loan with recent ledger entry (< 60 days) → NOT detected
    - Test: loan with LWOP_START event within 90 days → excluded (expected inactivity)
    - Test: loan with no employment event → NOT excluded
    - Test: idempotency — second run doesn't create duplicate for already-flagged loan
    - Test: resolved exception allows re-flagging if loan becomes inactive again
    - Test: MDA scoping — DEPT_ADMIN detection only finds their MDA's loans
    - Test: description includes "No deduction recorded for X days" with correct day count
    - Test: submission cross-reference enhances description when ₦0 + NONE
  - [x] 7.2 Test: scheduler does NOT start in test mode

- [x] Task 8: Full Test Suite Verification (AC: all)
  - [x] 8.1 Run `pnpm typecheck` — zero type errors
  - [x] 8.2 Run `pnpm lint` — zero lint errors
  - [x] 8.3 Run server tests — all pass (1346 tests, migration count test fixed after applying migration 0029)
  - [x] 8.4 Run client tests — all pass with zero regressions (616 tests, ExceptionsPage mock updated for useDetectInactive)

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] `dataCompleteness` uses decimal 0.8/0.5 instead of integer 80/50 — displays as "0.8%" [inactiveLoanDetector.ts:172]
- [x] [AI-Review][MEDIUM] File List missing `_journal.json` and `0029_snapshot.json` [story file]
- [x] [AI-Review][MEDIUM] `buildDescription` fallthrough returns "No MDA submission data" when data exists [inactiveLoanDetector.ts:271]
- [x] [AI-Review][MEDIUM] Attention item exception count uses scheme-wide numbers in per-MDA context [attentionItemService.ts:71-95]
- [x] [AI-Review][MEDIUM] Scheduler test asserts `expect(true).toBe(true)` — no-op [inactiveLoanDetector.test.ts:291-298]
- [x] [AI-Review][LOW] Sequential observation creation loop — 2N DB calls — batched to N+1 [inactiveLoanDetector.ts:155-188]

## Dev Notes

### Technical Requirements

#### Detection Query

**Core query** — extends the existing `detectZeroDeductionLoans()` pattern from `attentionItemService.ts:41-79`:

```sql
SELECT l.id, l.staff_id, l.staff_name, l.mda_id, m.name AS mda_name,
       MAX(le.created_at)::date AS last_deduction_date,
       EXTRACT(DAY FROM NOW() - MAX(le.created_at))::int AS days_since
FROM loans l
JOIN mdas m ON l.mda_id = m.id
LEFT JOIN ledger_entries le ON l.id = le.loan_id
WHERE l.status = 'ACTIVE'
  AND l.deleted_at IS NULL
GROUP BY l.id, l.staff_id, l.staff_name, l.mda_id, m.name
HAVING MAX(le.created_at) < NOW() - INTERVAL '60 days'
   OR MAX(le.created_at) IS NULL
```

**Batch employment event check** (exclude expected inactivity):
```sql
SELECT DISTINCT loan_id
FROM employment_events
WHERE loan_id IN (...)
  AND event_type IN ('LWOP_START', 'SUSPENDED', 'ABSCONDED', 'TRANSFERRED_OUT')
  AND effective_date > NOW() - INTERVAL '90 days'
```

Loans in this result set are **excluded** — their inactivity has an explanation.

#### Expected Inactivity Events

```typescript
const EXPECTED_INACTIVITY_EVENTS: EmploymentEventType[] = [
  'LWOP_START',        // On leave without pay — deductions pause
  'SUSPENDED',         // Disciplinary suspension — deductions pause
  'ABSCONDED',         // Staff absent — deductions impossible
  'TRANSFERRED_OUT',   // In transit between MDAs — deductions paused
];
```

**NOT excluded:** RETIRED, DECEASED, DISMISSED — these should have transitioned the loan out of ACTIVE status. If the loan is still ACTIVE despite these events, that's a separate data quality issue.

#### Idempotency Design

**Key rule:** One open observation per loan per type. If `observations` has `type = 'inactive_loan' AND loanId = X AND status IN ('promoted', 'unreviewed')`, skip.

**Resolved observations don't block:** If an admin resolved the exception (e.g., "verified — waiting for MDA response") but the loan remains inactive 60+ days later, a NEW observation is created. This surfaces recurrent inactivity.

**Implementation:** Before batch inserting observations, query existing:
```typescript
const existingInactive = await db
  .select({ loanId: observations.loanId })
  .from(observations)
  .where(and(
    eq(observations.type, 'inactive_loan'),
    inArray(observations.loanId, candidateLoanIds),
    inArray(observations.status, ['promoted', 'unreviewed']),
  ));
const alreadyFlagged = new Set(existingInactive.map(o => o.loanId));
const newCandidates = candidates.filter(c => !alreadyFlagged.has(c.loanId));
```

#### Description Template

```
"No deduction recorded for {days} days. Last deduction: {date}. {submissionContext}"
```

Where `submissionContext` is one of:
- "MDA submitted ₦0 with no event flag — potential payroll error or undeclared separation"
- "No MDA submission data available for cross-reference"
- "MDA declared event flag: {flag} — verify event processing status"

#### System User for Background Jobs

The `promotedBy` field requires a user ID. Background detection needs a "system" user:
- Query: `SELECT id FROM users WHERE email = 'system@vlprs.local'` (or similar)
- If no system user exists, use the first SUPER_ADMIN user as fallback
- Store the system user ID at startup for reuse

#### Scheduling Parameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Interval | 6 hours | Balance between freshness and DB load |
| Startup delay | 5 minutes | Avoid load spike on server restart |
| Test guard | `NODE_ENV !== 'test'` | Prevent test interference |
| Scope | All MDAs (background), MDA-scoped (on-demand) | Background covers everything; on-demand is admin-focused |

### Architecture Compliance

- **Observation-first pattern:** All exceptions trace to observations. Auto-detection creates observation then promotes
- **Fire-and-forget background:** Scheduler errors logged, not thrown. Server never crashes from detection failure
- **N+1 query budget:** Use batch queries (inArray) for employment events and existing observations — avoid per-loan queries
- **Non-punitive vocabulary:** "No deduction recorded" not "Missing payment". "Potential payroll error" not "Staff negligence"
- **MDA scoping:** On-demand endpoint respects `scopeToMda`; background run covers all MDAs

### Library & Framework Requirements

- **No new dependencies**
- **Drizzle ORM:** For schema migration (enum extension)

### File Structure Requirements

#### New Files

```
apps/server/src/
├── services/inactiveLoanDetector.ts                   ← NEW: detection logic + scheduler + on-demand
├── services/inactiveLoanDetector.test.ts              ← NEW: 9 test cases

apps/server/drizzle/
└── 0029_*.sql                                         ← NEW: ALTER TYPE observation_type ADD VALUE 'inactive_loan'. Migration sequence: 0024 (7.0b) → 0025 (7.0d) → 0026 (7.0g) → 0027 (7.0i) → 0028 (7.1) → **0029** (this story)
```

#### Modified Files

```
packages/shared/src/
├── types/observation.ts                               ← MODIFY: add 'inactive_loan' to ObservationType

apps/server/src/
├── db/schema.ts                                       ← MODIFY: add 'inactive_loan' to observationTypeEnum
├── routes/exceptionRoutes.ts                          ← MODIFY: add POST /exceptions/detect-inactive endpoint
├── services/attentionItemService.ts                   ← MODIFY: enhance detectZeroDeductionLoans with exception context
├── index.ts                                           ← MODIFY: initialize inactive loan scheduler

apps/client/src/
├── pages/dashboard/ExceptionsPage.tsx                 ← MODIFY: add "Run Inactive Detection" button
├── hooks/useExceptionData.ts                          ← MODIFY: add useDetectInactive mutation
```

### Testing Requirements

- **inactiveLoanDetector.test.ts:** 9 test cases (60-day threshold, event exclusion, idempotency, MDA scoping, description formatting, submission cross-reference, re-flagging after resolution)
- **Scheduler test:** Verify no interval started in test mode
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.1 (Exception Flagging & Queue — Previous in Sequence)

- **Status:** ready-for-dev (as of 2026-03-20)
- **exceptionService.ts:** Provides `flagLoanAsException()` for manual flags (creates `manual_exception` observation + exception atomically) and `resolveException()` for resolution. For auto-detection in Story 7.2, use the observation-first path: create observation, then `observationService.promoteToException()` — see Task 2.6 clarification
- **Exception routes:** `exceptionRoutes.ts` provides CRUD. Story 7.2 adds one new endpoint (`POST /exceptions/detect-inactive`) to the same file
- **Queue display:** Auto-created inactive exceptions appear alongside manual flags — no special UI handling needed (category badge shows "Inactive")

#### From Story 7.0f (System Health Monitoring)

- **Background scheduler pattern:** `setInterval` with startup delay and test guard. Story 7.2 follows the same pattern for inactive detection scheduling
- **integrityChecker.ts:** Reference for the caching and scheduling approach

#### From Attention Item Service (Story 4.2)

- **detectZeroDeductionLoans():** Existing 60-day detection at `attentionItemService.ts:41-79`. Uses LATERAL join with MAX(ledger_entries.created_at). The query is directly reusable — Story 7.2 extends it with employment event exclusion and exception creation

### Git Intelligence

**Expected commit:** `feat: Story 7.2 — Automatic Inactive Loan Detection with code review fixes`

### Critical Warnings

1. **observationId is NOT NULL on exceptions table:** Cannot create an exception without an observation. Always create the observation first, then promote
2. **Batch queries for N+1 prevention:** The detection touches loans, ledger_entries, employment_events, observations (existing check), and observations+exceptions (creation). Use `inArray()` batch patterns throughout. Target: ≤ 6 queries total for the entire detection run
3. **System user ID must exist:** Background scheduler needs a user ID for `promotedBy`. Fail gracefully if no system user found — log error and skip the run rather than crash
4. **60-day threshold is business logic:** The 60 consecutive days comes from FR57. Don't make it configurable in this story — hardcode as a named constant. Future enhancement can move it to scheme_config
5. **Employment event window (90 days) vs inactivity threshold (60 days):** The event window is intentionally wider to catch events that happened shortly before the inactivity started. A LWOP_START 75 days ago explains a 60-day deduction gap
6. **DO NOT modify detectZeroDeductionLoans core logic:** The attention item detector is a read-only dashboard feature. Story 7.2 adds a separate detection service that creates exceptions. The attention item is optionally enhanced to reference exception counts, but the core detection query stays independent
7. **Resolved exceptions don't block re-detection:** If an admin resolves an inactive exception ("verified — expected") but the loan remains inactive, the next detection run creates a NEW observation+exception. This is intentional — recurring inactivity should be surfaced

### Project Structure Notes

- This story is the second feature story in Epic 7, building directly on 7.1's exception infrastructure
- The detection service (`inactiveLoanDetector.ts`) is a standalone module with a clear purpose — detect and flag. It doesn't own the exception lifecycle (that's `exceptionService.ts` from 7.1)
- The background scheduler follows the established `setInterval` pattern from 7.0f's integrityChecker
- The on-demand endpoint enables admins to trigger detection without waiting for the scheduler — useful during UAT and after bulk data changes

### References

- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.2] — BDD acceptance criteria (FR57)
- [Source: apps/server/src/services/attentionItemService.ts:41-79] — Existing detectZeroDeductionLoans (60-day query pattern)
- [Source: apps/server/src/db/schema.ts § ledger_entries (lines 142-170)] — Append-only ledger, createdAt for last deduction
- [Source: apps/server/src/db/schema.ts § employment_events (lines 626-651)] — Event types for expected inactivity exclusion
- [Source: apps/server/src/services/employmentEventService.ts:18-30] — EVENT_TO_STATUS_MAP
- [Source: apps/server/src/services/observationService.ts:258-311] — promoteToException() function
- [Source: apps/server/src/db/schema.ts § exceptions (lines 480-503)] — Exception table (observationId NOT NULL constraint)
- [Source: _bmad-output/implementation-artifacts/7-0f-system-health-monitoring-foundation.md] — setInterval scheduler pattern
- [Source: _bmad-output/implementation-artifacts/7-1-exception-flagging-queue.md] — exceptionService and routes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- TypeScript unused import errors fixed (raw SQL queries don't reference schema vars directly)
- Migration 0029 applied to dev DB to fix migration count integration test (expected 30, had 29)
- ExceptionsPage.test.tsx mock updated to include `useDetectInactive` export
- `observationService.ts` `getObservationCounts` updated to include `inactive_loan` in the byType Record

### Completion Notes List

- **Task 1:** Added `'inactive_loan'` to `observationTypeEnum` (schema.ts), `ObservationType` (shared types), generated migration `0029_light_emma_frost.sql`
- **Task 2:** Created `inactiveLoanDetector.ts` — full detection pipeline: 60-day threshold query, employment event exclusion (LWOP_START, SUSPENDED, ABSCONDED, TRANSFERRED_OUT within 90 days), idempotency check (skip open observations), submission cross-reference for description enrichment, observation-first creation + auto-promote via `promoteToException()`
- **Task 3:** Background scheduler with 6hr interval, 5min startup delay, test guard, graceful shutdown. Initialized from `index.ts` alongside integrityChecker
- **Task 4:** `POST /api/exceptions/detect-inactive` endpoint with writeAuth middleware, MDA scoping, audit logging
- **Task 5:** Enhanced `detectZeroDeductionLoans()` to query open inactive exceptions and enrich description/URL when exceptions exist
- **Task 6:** Added `inactive_loan` label to ObservationCard + ObservationsList, "Run Inactive Detection" button on ExceptionsPage with toast feedback, `useDetectInactive()` mutation hook, `inactive_loan` category filter option
- **Task 7:** 10 tests in `inactiveLoanDetector.test.ts` covering all 9 detection scenarios + scheduler guard
- **Task 8:** All verification passed: typecheck (0 errors), lint (0 errors), server (1346 pass), client (616 pass)

### File List

#### New Files
- `apps/server/src/services/inactiveLoanDetector.ts` — detection service + scheduler
- `apps/server/src/services/inactiveLoanDetector.test.ts` — 10 test cases
- `apps/server/drizzle/0029_light_emma_frost.sql` — ALTER TYPE observation_type ADD VALUE 'inactive_loan'
- `apps/server/drizzle/meta/0029_snapshot.json` — migration 0029 schema snapshot

#### Modified Files
- `apps/server/drizzle/meta/_journal.json` — updated with migration 0029 entry
- `apps/server/src/db/schema.ts` — added 'inactive_loan' to observationTypeEnum
- `packages/shared/src/types/observation.ts` — added 'inactive_loan' to ObservationType union
- `apps/server/src/index.ts` — import + initialize inactive loan scheduler, stop on shutdown
- `apps/server/src/routes/exceptionRoutes.ts` — added POST /exceptions/detect-inactive endpoint
- `apps/server/src/services/attentionItemService.ts` — enhanced detectZeroDeductionLoans with exception context
- `apps/server/src/services/observationService.ts` — added inactive_loan to getObservationCounts byType
- `apps/client/src/pages/dashboard/ExceptionsPage.tsx` — Run Inactive Detection button, inactive_loan category filter
- `apps/client/src/hooks/useExceptionData.ts` — useDetectInactive mutation hook
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — inactive_loan TYPE_LABELS entry
- `apps/client/src/pages/dashboard/components/ObservationsList.tsx` — inactive_loan TYPE_OPTIONS entry
- `apps/client/src/pages/dashboard/ExceptionsPage.test.tsx` — added useDetectInactive to mock

### Change Log

- **2026-03-23:** Story 7.2 implemented — Automatic inactive loan detection with background scheduler, on-demand endpoint, observation-first auto-promotion, attention item enhancement, and frontend detection trigger. All 7 ACs satisfied. 10 new tests + full regression pass.
- **2026-03-24:** Code review fixes (6 issues) — H1: fixed dataCompleteness scale (0.8→80, 0.5→50); M1: added missing Drizzle meta files to File List; M2: fixed buildDescription fallthrough for non-zero submission amounts; M3: scoped attention item exception counts per-MDA instead of scheme-wide; M4: replaced no-op scheduler test with fake timer assertion; L1: batch-inserted observations to reduce DB calls from 2N to N+1.
