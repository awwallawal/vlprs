# Story 7.0c: Test Suite Integrity

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **development team**,
I want every test in the suite to verify real production behavior,
So that green means green and the team can trust test results completely.

## Acceptance Criteria

### AC 1: Terminal-Status Test Redundancy Resolved

**Given** the `loanTransitions.test.ts` describe block "terminal statuses have zero outgoing transitions" (line 146)
**When** the test suite runs
**Then** the redundant 55 individual test cases (5 terminal × 11 targets) that overlap with the existing all-pairs matrix are consolidated into a single efficient test, and total test count is reduced without losing coverage

### AC 2: Migration Count Mismatch Fixed

**Given** the `migrate.integration.test.ts` test "migration count in tracking table matches _journal.json entry count" (line 97)
**When** the test suite runs
**Then** the test passes — `__drizzle_migrations` row count equals `_journal.json` entry count
**And** any hash mismatch from prior migration re-generation incidents is corrected

### AC 3: Pre-Submission Tests Use Real Database

**Given** the `preSubmissionService.test.ts` file that mocks `db.select` with canned data
**When** the pre-submission checkpoint is tested
**Then** tests use real database queries via integration test patterns (seed data, real queries, verify results), WHERE/JOIN conditions are validated, and MDA scoping is tested with multiple MDAs

### AC 4: File List Verification Enforced in Code Review

**Given** the code review workflow at `_bmad/bmm/workflows/4-implementation/code-review/`
**When** a code review runs
**Then** the file list verification step is a mandatory blocking gate (not optional checkbox), the instructions.xml fails the review if git-discovered files don't match the story's File List section, and the checklist item is clearly marked as `[BLOCKING]`

### AC 5: EDUCATION Fixture Timeouts Fixed

**Given** the EDUCATION fixture (`EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx`) in migration regression tests
**When** the regression test suite runs
**Then** the EDUCATION fixture tests complete within the test timeout without skipping or flaking
**And** no test in the regression suite produces intermittent timeout failures

### AC 6: Architecture Diagram Corrected

**Given** the architecture.md Data Flow: Monthly Submission Lifecycle diagram (lines ~1269-1283)
**When** a developer reads the architecture document
**Then** the diagram correctly shows: reconciliation runs INSIDE the transaction (after INSERT rows, before COMMIT), comparison runs OUTSIDE the transaction (after COMMIT), matching the actual codebase implementation in `submissionService.ts`

### AC 7: Query Counter Middleware for N+1 Detection

**Given** a request to any API endpoint in test or development mode
**When** the endpoint executes more than 10 database queries
**Then** a warning is logged with the endpoint path, method, query count, and query details
**And** in test mode, the warning is accessible for assertion in integration tests
**And** production mode is unaffected (middleware disabled)

## Dependencies

- **Depends on:** Story 7.0b (Type Safety & Schema Contracts) — 7.0b consolidates LOAN_STATUS_VALUES (affects terminal-status test imports), creates withTransaction helper (affects integration test patterns), and adds migration 0024 (affects migration count test expectations)
- **Blocks:** Story 7.0d and all downstream prep stories (7.0e–7.0g), plus all Epic 7 feature stories (7.1+). Per zero-debt-forward principle, no E7 feature work begins until all prep stories complete
- **Sequence:** 7.0a → 7.0b → **7.0c** → 7.0d → 7.0e + 7.0f (parallel) → 7.0g → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: Terminal-Status Test Redundancy (AC: 1)
  - [x] 1.1 Open `packages/shared/src/constants/loanTransitions.test.ts` — the describe block at line 146 ("terminal statuses have zero outgoing transitions") generates 55 individual `it()` calls (5 terminal statuses × 11 target statuses). This OVERLAPS with the all-pairs matrix at line 127 which already tests every (from, to) combination including terminal → any
  - [x] 1.2 Replace the 55-test parameterized block with a single efficient test that verifies: for each terminal status in `TERMINAL_STATUSES`, `VALID_TRANSITIONS[status]` is either undefined or an empty array. This tests the same invariant without 55 redundant assertions
  - [x] 1.3 Verify the all-pairs matrix at line 127 still covers terminal → any transitions (it does — the matrix iterates ALL_STATUSES × ALL_STATUSES)
  - [x] 1.4 Run tests — count should decrease by ~50+ while coverage stays identical

- [x] Task 2: Migration Count Mismatch Fix (AC: 2)
  - [x] 2.1 Run the migration count test: `pnpm --filter @vlprs/server vitest run migrate.integration` — check if it passes currently
  - [x] 2.2 If it fails: compare `_journal.json` entry count with `SELECT count(*) FROM drizzle.__drizzle_migrations` — identify the gap
  - [x] 2.3 If mismatch is due to Story 3.0b re-generation incident (documented in memory): verify all subsequent migrations (0006+) were applied correctly. If a tracking row is missing, insert it with the correct hash. If an extra row exists, remove it
  - [x] 2.4 Verify the test passes after fix. The test is at `apps/server/src/db/migrate.integration.test.ts:97-111`. **Note:** The expected migration count depends on which prior stories have landed — Story 7.0b adds migration 0024 (column drops). Ensure the dev database has all applied migrations in sync with `_journal.json` by running `pnpm --filter @vlprs/server db:migrate` before this test
  - [x] 2.5 If the test already passes (incident was resolved in a prior story): document this in completion notes and move on

- [x] Task 3: Pre-Submission Integration Tests (AC: 3)
  - [x] 3.1 Create `apps/server/src/services/preSubmissionService.integration.test.ts` — new integration test file using real database
  - [x] 3.2 Add `beforeAll()`: seed 2 MDAs, create test users, create active loans with retirement dates at various windows (6 months, 18 months, past), create submission rows with zero deductions
  - [x] 3.3 Test: approaching retirement returns only loans within 12-month window for the requested MDA
  - [x] 3.4 Test: zero-deduction detection returns only staff with ₦0 submissions
  - [x] 3.5 Test: MDA scoping — data from MDA-2 does not appear in MDA-1 results
  - [x] 3.6 Test: excludes non-ACTIVE loans (COMPLETED, TRANSFERRED, etc.) from all sections
  - [x] 3.7 Test: empty results when MDA has no matching data
  - [x] 3.8 Remove or keep the original `preSubmissionService.test.ts` — if pure-function unit tests exist (formatting, deduplication), keep those; delete the mock `db.select` infrastructure (lines 4-30)
  - [x] 3.9 Add `afterAll()` cleanup via `resetDb()`

- [x] Task 4: File List Verification — Blocking Gate (AC: 4)
  - [x] 4.1 Update `_bmad/bmm/workflows/4-implementation/code-review/checklist.md` line 12: change from `- [ ] File List reviewed and validated for completeness` to `- [ ] **[BLOCKING]** File List matches git diff — every file in `git diff` must appear in story File List and vice versa`
  - [x] 4.2 Update `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml`: in the file list reconciliation step (lines 34-40), add an explicit directive that file list mismatch BLOCKS review approval — the review cannot pass if files are missing from or extra in the story's File List section
  - [x] 4.3 Add a template section to the instructions that shows the expected output format for file list reconciliation: "Files in git but NOT in story: [list]" and "Files in story but NOT in git: [list]" with a clear PASS/FAIL verdict

- [x] Task 5: EDUCATION Fixture Timeout Fix (AC: 5)
  - [x] 5.1 Run the EDUCATION fixture test in isolation: `pnpm --filter @vlprs/server vitest run migration-regression -- -t "EDUCATION"` — measure actual execution time
  - [x] 5.2 If timing out: add a per-test timeout override for the EDUCATION fixture's `describe.each` entry — `{ timeout: 30000 }` (30s) vs the default 15s from vitest.config.ts
  - [x] 5.3 Alternatively: profile the EDUCATION file parsing — if the file has many sheets, check if `shouldSkipSheet()` filters efficiently. The fixture has non-vehicle-loan sheets (cooperative, housing loan, etc.) that should be skipped early
  - [x] 5.4 Verify all 7 fixture tests pass reliably (run 3 times to check for flakes)

- [x] Task 6: Architecture Diagram Correction (AC: 6)
  - [x] 6.1 Open `_bmad-output/planning-artifacts/architecture.md` — find the Data Flow: Monthly Submission Lifecycle diagram (around lines 1247-1290)
  - [x] 6.2 Correct the ordering to match the actual implementation in `submissionService.ts:439-569`:
    - Step 3: BEGIN TRANSACTION → INSERT submission + rows → `reconcileSubmission()` [INSIDE tx] → store reconciliation summary → COMMIT
    - Step 4: `compareSubmission()` [OUTSIDE tx, after commit, wrapped in try/catch]
    - Step 5: Exception auto-flagging
    - Step 6: Email notifications (fire-and-forget)
  - [x] 6.3 Add transaction boundary annotations to the diagram: `[INSIDE tx]` and `[OUTSIDE tx]` labels
  - [x] 6.4 Verify no other sections of architecture.md reference the incorrect ordering

- [x] Task 7: Query Counter Middleware (AC: 7)
  - [x] 7.1 Create `apps/server/src/middleware/queryCounter.ts`:
    - Extend `Express.Request` in `types/express.d.ts` with `queryCount?: number`
    - Middleware initializes `req.queryCount = 0` at request start
    - Intercept Drizzle queries by wrapping the `db` singleton's query methods
    - On `res.on('finish')`: if `queryCount > 10`, log warning via pino with `{ method, url, queryCount, threshold: 10 }`
    - Only active when `NODE_ENV !== 'production'`
  - [x] 7.2 Integrate into `apps/server/src/app.ts` middleware chain — place after `requestLogger`, before routes. Guard with `if (env.NODE_ENV !== 'production')` to ensure zero overhead in prod
  - [x] 7.3 Update `apps/server/src/types/express.d.ts`: add `queryCount?: number` to the Request interface
  - [x] 7.4 Create `apps/server/src/middleware/queryCounter.test.ts`: test that counter increments on db operations, test that warning fires when threshold exceeded, test that middleware is no-op in production mode
  - [x] 7.5 **Implementation approach — Drizzle logger option:** Configure `drizzle()` in `db/index.ts` to use a custom logger that increments the request-scoped counter. Drizzle's `logger` option accepts `{ logQuery(query, params) }` — use this to count queries. Access request context via Node.js `AsyncLocalStorage` (built-in, no dependency) since the logger callback has no access to `req`

- [x] Task 8: Full Test Suite Verification (AC: all)
  - [x] 8.1 Run `pnpm typecheck` — zero type errors
  - [x] 8.2 Run `pnpm lint` — zero lint errors
  - [x] 8.3 Run server tests: `pnpm --filter @vlprs/server test` — all tests pass (count will decrease slightly from terminal-status consolidation)
  - [x] 8.4 Run client tests: `pnpm --filter @vlprs/client test` — all 585+ tests pass
  - [x] 8.5 Verify zero regressions

## Dev Notes

### Technical Requirements

#### Item #1: Terminal-Status Test Redundancy

**Current state:** `packages/shared/src/constants/loanTransitions.test.ts`
- Line 127: All-pairs matrix — iterates ALL_STATUSES × ALL_STATUSES (11 × 11 = 121 test cases) covering every valid/invalid transition pair
- Line 146: Terminal-status block — iterates 5 terminals × 11 targets = 55 test cases, all verifying `isValidTransition(terminal, target) === false`
- **Overlap:** The all-pairs matrix already tests every terminal → target pair. The terminal block duplicates exactly those 55 pairs

**Origin:** Story 2.7 code review LOW: "Unit test redundancy: terminal-status describe block (18 tests) overlaps 36-pair matrix — consider consolidating." Originally 18 tests (3 terminals × 6 statuses in Story 2.7), now grown to 55 tests (5 terminals × 11 statuses after Epic 11 added new statuses).

**Fix:** Replace the `describe.each` block with a single test:
```typescript
it('terminal statuses have zero outgoing transitions in VALID_TRANSITIONS', () => {
  for (const terminal of TERMINAL_STATUSES) {
    const transitions = VALID_TRANSITIONS[terminal];
    expect(transitions ?? [], `${terminal} should have no valid transitions`).toHaveLength(0);
  }
});
```

This verifies the same invariant (no valid outgoing transitions from terminal states) in O(5) assertions instead of O(55). The all-pairs matrix still covers the behavioral `isValidTransition()` function for every pair.

#### Item #8: Migration Count Mismatch 849/850

**Context:** During Story 3.7 (Individual Trace Report), the test suite reported 849/850 server tests passing. The 1 failure was `migrate.integration.test.ts:97-111` — "migration count in tracking table matches _journal.json entry count."

**Root cause:** Story 3.0b re-generated migration 0006 after code review (added an index), which changed the hash in `_journal.json` but the tracking table still had the old hash. This was fixed by updating the tracking table hash (documented in `docs/drizzle-migrations.md`). The count mismatch may have been a transient state during that fix.

**Current state:** This may already be resolved (23 migrations have been applied since). Run the test first. If it passes, document resolution and move on. If it fails, diagnose and fix the specific mismatch.

**Test location:** `apps/server/src/db/migrate.integration.test.ts:97-111`

#### Item #17: Mock db.select Replacement

**Current state:** `apps/server/src/services/preSubmissionService.test.ts` (lines 4-30)
```typescript
vi.mock('../db/index', () => ({
  db: { select: vi.fn() },
}));

function mockQueryChain(result: unknown[]) {
  const chain = {};
  const self = () => chain;
  chain.from = vi.fn(self);
  chain.innerJoin = vi.fn(self);
  chain.where = vi.fn(self);  // ← Any WHERE accepted, never validated
  chain.orderBy = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.groupBy = vi.fn(self);
  chain.then = (resolve) => Promise.resolve(result).then(resolve);
  return chain;
}
```

**Problem:** WHERE/JOIN conditions are never validated. Tests pass canned data through stubbed chain methods and assert the service reshapes it correctly — but never verify the SQL filters data correctly.

**Replacement pattern:** Follow `submissionComparison.integration.test.ts` and `loanTransitionService.integration.test.ts`:
- Real DB with seeded test data via `db.insert()`
- `resetDb()` in `beforeAll()`/`afterAll()`
- `db.execute(sql\`TRUNCATE ... CASCADE\`)` in `beforeEach()` for isolation
- Tests exercise real Drizzle queries — verify WHERE filters, JOIN conditions, MDA scoping

**Service under test:** `preSubmissionService.ts` — `getCheckpointData(mdaId)` which queries:
1. Approaching retirement (loans with `computedRetirementDate` within 12 months)
2. Zero-deduction staff (submission rows with `amountDeducted = 0`)
3. Missing submission entries
4. Upcoming events

**Key assertions for new integration tests:**
- Only ACTIVE loans appear in results
- Only the requested MDA's data appears (multi-MDA scoping)
- Date window filtering is correct (12-month retirement boundary)
- Zero-deduction detection matches actual row data

#### Item #19: File List Verification Process

**Current state:** Code review checklist at `_bmad/bmm/workflows/4-implementation/code-review/checklist.md` line 12 has a checkbox item. The instructions.xml already performs git reconciliation (lines 34-40) but notes discrepancies informally.

**Problem:** 12 of 27 stories across E3-E11 had inaccurate file lists. Zero improvement from E10 team agreement. The check exists but is not enforced as a blocker.

**Fix:** Make it a blocking gate:
- Checklist: Mark as `[BLOCKING]` — review cannot pass if file list doesn't match
- Instructions: Add explicit directive that file list mismatch = review FAIL
- Template: Structured PASS/FAIL output for the reconciliation step

#### Item #22: EDUCATION Fixture Timeouts

**Current state:** `apps/server/src/migration/migration-regression.test.ts` line 20 includes `EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx` as one of 7 regression fixtures. No per-fixture timeout override exists. Default timeout: 15s (from `vitest.config.ts`).

**Problem:** The EDUCATION file is the "stress test" fixture (noted in sprint-status.yaml comments). It likely has many sheets including non-vehicle-loan sheets (cooperative, housing loan, etc.) that are filtered by `shouldSkipSheet()` but still require sheet parsing to evaluate.

**Fix options:**
1. **Increase timeout for EDUCATION fixture:** Add `{ timeout: 30000 }` to the test or describe block for this fixture
2. **Optimize parsing:** Ensure `shouldSkipSheet()` runs before any expensive operations (sheet_to_json, header detection)
3. **Both:** Increase timeout AND optimize

#### Item #25: Architecture Diagram Correction

**Current state:** `_bmad-output/planning-artifacts/architecture.md` around lines 1269-1283 shows comparison running BEFORE reconciliation, both outside the transaction.

**Actual implementation** (`submissionService.ts:439-569`):
1. `db.transaction(async (tx) => {` — opens transaction
2. `tx.insert(submissionRows)` — insert rows
3. `reconcileSubmission(submissionId, mdaId, tx)` — reconciliation INSIDE tx with tx handle
4. `tx.update(mdaSubmissions).set({ reconciliationSummary })` — store summary
5. `})` — transaction COMMITS
6. `compareSubmission(submissionId, mdaScope)` — comparison OUTSIDE tx, wrapped in try/catch

**Why it matters:** Transaction boundary is critical — reconciliation must be atomic with row insertion (if reconciliation fails, rows roll back). Comparison is non-critical (failure doesn't affect submission validity).

#### Query Counter Middleware (N+1 Detection)

**Implementation approach using Drizzle custom logger + AsyncLocalStorage:**

```typescript
// apps/server/src/middleware/queryCounter.ts
import { AsyncLocalStorage } from 'node:async_hooks';

interface QueryContext { count: number; }
export const queryStorage = new AsyncLocalStorage<QueryContext>();

// Drizzle logger that increments per-request counter
export const queryCounterLogger = {
  logQuery(query: string, _params: unknown[]) {
    const ctx = queryStorage.getStore();
    if (ctx) ctx.count++;
  },
};

// Express middleware
export function queryCounter(req: Request, res: Response, next: NextFunction) {
  const ctx: QueryContext = { count: 0 };
  queryStorage.run(ctx, () => {
    res.on('finish', () => {
      if (ctx.count > 10) {
        logger.warn({ method: req.method, url: req.originalUrl, queryCount: ctx.count, threshold: 10 },
          'N+1 WARNING: Query threshold exceeded');
      }
      req.queryCount = ctx.count;
    });
    next();
  });
}
```

Then in `apps/server/src/db/index.ts`:
```typescript
import { queryCounterLogger } from '../middleware/queryCounter';
import { env } from '../config/env';

export const db = drizzle(env.DATABASE_URL, {
  schema,
  logger: env.NODE_ENV !== 'production' ? queryCounterLogger : false,
});
```

**Key design decisions:**
- `AsyncLocalStorage` for request-scoped counting without polluting Express.Request
- Drizzle's built-in `logger` option for query interception (no proxy hacking)
- Zero overhead in production (logger disabled)
- `req.queryCount` still set for test assertions if needed

**Important — logger is SILENT in test mode:** `apps/server/src/lib/logger.ts:5` sets `level: 'silent'` when `NODE_ENV === 'test'`. This means the `logger.warn()` call in the middleware produces **zero output** during test runs. The `logger.warn()` is for **dev-mode visibility only**. In test mode, assert N+1 violations via `req.queryCount` (set on `res.on('finish')`), not log output. The `queryCounter.test.ts` tests should verify `req.queryCount` values, not captured log lines.

### Architecture Compliance

- **Test co-location:** New `.integration.test.ts` files next to source files
- **resetDb() pattern:** Use existing `apps/server/src/test/resetDb.ts` for cleanup
- **Middleware pattern:** queryCounter follows same Express middleware pattern as requestLogger, auditLog
- **BMAD workflow changes:** Checklist and instructions modifications follow existing XML/Markdown conventions

### Library & Framework Requirements

- **No new dependencies** — AsyncLocalStorage is built into Node.js (stable since v16)
- **Vitest** `^3.2.1`: Test runner
- **Drizzle logger option:** Built into drizzle-orm (no additional package)

### File Structure Requirements

#### New Files

```
apps/server/src/
├── services/preSubmissionService.integration.test.ts  ← NEW: real DB integration tests
├── middleware/queryCounter.ts                          ← NEW: N+1 detection middleware
└── middleware/queryCounter.test.ts                     ← NEW: middleware unit tests
```

#### Modified Files

```
packages/shared/src/
└── constants/loanTransitions.test.ts                  ← MODIFY: consolidate terminal-status describe block

apps/server/src/
├── db/index.ts                                        ← MODIFY: add Drizzle logger for query counting (non-prod)
├── db/migrate.integration.test.ts                     ← MODIFY: verify/fix migration count mismatch (if needed)
├── app.ts                                             ← MODIFY: add queryCounter middleware (non-prod only)
├── types/express.d.ts                                 ← MODIFY: add queryCount to Request interface
├── services/preSubmissionService.test.ts              ← MODIFY: remove mock db.select infrastructure, keep pure unit tests
└── migration/migration-regression.test.ts             ← MODIFY: add timeout for EDUCATION fixture

_bmad-output/planning-artifacts/
└── architecture.md                                    ← MODIFY: correct reconciliation/comparison ordering in data flow diagram

_bmad/bmm/workflows/4-implementation/code-review/
├── checklist.md                                       ← MODIFY: mark file list verification as [BLOCKING]
└── instructions.xml                                   ← MODIFY: add blocking directive for file list mismatch
```

### Testing Requirements

- **preSubmissionService.integration.test.ts:** 5-7 integration tests with real DB (retirement window, zero-deduction, MDA scoping, inactive exclusion, empty results)
- **queryCounter.test.ts:** 3 tests (counter increments, threshold warning, production no-op)
- **loanTransitions.test.ts:** Verify consolidated test still catches all terminal-status invariants
- **migration-regression.test.ts:** All 7 fixtures pass reliably (3 runs, zero flakes)
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.0b (Type Safety & Schema Contracts — Previous in Sequence)

- **Status:** ready-for-dev (as of 2026-03-20)
- **LOAN_STATUS_VALUES consolidated:** 7.0b creates `packages/shared/src/constants/loanStatuses.ts` — the terminal-status test at line 147 currently hardcodes `['COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF', 'RETIRED', 'DECEASED']`. After 7.0b, this should import from `TERMINAL_STATUSES` constant (already exists in `loanTransitions.ts`)
- **withTransaction helper:** 7.0b creates `apps/server/src/lib/transaction.ts` — the preSubmission integration tests may need to understand transaction behavior
- **Column drops:** 7.0b drops `hasMultiMda`/`multiMdaBoundaries` — migration 0024 will exist. Migration count test should account for this

#### From Mega-Retro Team Agreements

1. **File list verification as code review checklist item** — this story implements the enforcement mechanism
2. **Red-green review check** — reviewer verifies tests fail when implementation removed
3. **N+1 query budget** — this story implements the detection mechanism
4. **Zero-debt-forward** — this IS the debt resolution story

### Git Intelligence

**Recent commit pattern:** `feat: Story 7.0b — Type Safety & Schema Contracts with code review fixes`
**Expected commit:** `feat: Story 7.0c — Test Suite Integrity with code review fixes`

### Critical Warnings

1. **DO NOT delete test coverage** — consolidating 55 tests into 1 must maintain the same invariant verification. The all-pairs matrix at line 127 provides behavioral coverage; the new single test verifies the data structure invariant
2. **Migration count test is DB-state-dependent** — it compares live DB state with filesystem. Ensure the dev database has all migrations applied (`pnpm --filter @vlprs/server db:migrate`) before running
3. **preSubmissionService.integration.test.ts needs careful seeding** — the service queries across multiple tables (loans, mdaSubmissions, submissionRows, employmentEvents). Seed data must be comprehensive
4. **AsyncLocalStorage context propagation** — the Drizzle logger callback runs synchronously within the async context. AsyncLocalStorage propagates correctly through async/await chains. No special handling needed
5. **Query counter must not count middleware queries** — audit log writes (fire-and-forget) happen on `res.on('finish')` after the response. The counter should only count queries during request handling, not post-response cleanup. Since the `finish` event fires after `res.json()`, the counter report also fires on `finish` — register the reporting callback AFTER the audit log's callback by using middleware ordering
6. **Architecture.md is a planning artifact** — edit it directly. No migration or schema change needed
7. **BMAD workflow files are framework files** — edit `_bmad/bmm/workflows/...` directly. These are project-level configuration, not generated files

### Project Structure Notes

- This story primarily modifies test files and infrastructure — minimal production code changes
- The query counter middleware is the only production code addition, but it's guarded by `NODE_ENV !== 'production'`
- The architecture diagram fix is a documentation correction, not a code change
- The BMAD workflow changes affect the development process, not the application

### References

- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Tech Debt Inventory] — Items #1, #8, #17, #19, #22, #25, query counter
- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0c] — User story, 7 items, theme statement
- [Source: packages/shared/src/constants/loanTransitions.test.ts:127-156] — All-pairs matrix + redundant terminal-status block
- [Source: _bmad-output/implementation-artifacts/2-7-loan-lifecycle-states-transitions.md:113] — Original LOW finding: "Unit test redundancy: terminal-status describe block"
- [Source: apps/server/src/db/migrate.integration.test.ts:97-111] — Migration count mismatch test
- [Source: _bmad-output/implementation-artifacts/3-7-individual-trace-report-generation.md:775] — "849/850 server tests pass (1 pre-existing migration count mismatch)"
- [Source: apps/server/src/services/preSubmissionService.test.ts:4-30] — Mock db.select infrastructure
- [Source: _bmad-output/implementation-artifacts/11-1-pre-submission-checkpoint-screen.md] — Story 11.1 acknowledged mock pattern as tech debt
- [Source: apps/server/src/routes/submissionComparison.integration.test.ts] — Model integration test pattern
- [Source: apps/server/src/migration/migration-regression.test.ts:20] — EDUCATION fixture
- [Source: apps/server/vitest.config.ts] — Default timeout: 15s
- [Source: _bmad-output/planning-artifacts/architecture.md § lines ~1269-1283] — Incorrect data flow ordering
- [Source: apps/server/src/services/submissionService.ts:439-569] — Actual reconciliation/comparison ordering
- [Source: _bmad-output/implementation-artifacts/11-3-event-reconciliation-engine.md:235] — Reconciliation inside tx documentation
- [Source: _bmad/bmm/workflows/4-implementation/code-review/checklist.md:12] — Existing file list checkbox
- [Source: _bmad/bmm/workflows/4-implementation/code-review/instructions.xml:34-40] — File list reconciliation step
- [Source: apps/server/src/middleware/requestLogger.ts] — Existing middleware pattern (res.on('finish'))
- [Source: apps/server/src/db/index.ts] — Drizzle db singleton (logger option available)
- [Source: apps/server/src/lib/logger.ts] — Pino setup (silent in test mode)
- [Source: apps/server/src/test/resetDb.ts] — Database reset utility for integration tests

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — no HALT conditions triggered.

### Completion Notes List

- **Task 1 (Terminal-Status Redundancy):** Replaced 55-test parameterized block with single efficient test iterating `TERMINAL_STATUSES` and checking `VALID_TRANSITIONS[status]` is empty. Shared test count reduced by 54 (from ~311 to 257). All-pairs matrix at line 87 still provides full behavioral coverage.
- **Task 2 (Migration Count Mismatch):** Already resolved — DB migration count (25) matches `_journal.json` entry count (25). All 6 migration integration tests pass. The 3.0b hash mismatch incident was fixed in a prior story and 23 subsequent migrations applied cleanly.
- **Task 3 (Pre-Submission Integration Tests):** Created 7 integration tests with real DB: retirement window filtering, zero-deduction detection, MDA scoping, inactive loan exclusion, missing submission row detection, last submission date, empty MDA results. Deleted entire mock-based `preSubmissionService.test.ts` (no pure unit tests existed — all tests used `vi.mock('../db/index')` and `mockQueryChain()`).
- **Task 4 (File List Verification Gate):** Updated code review checklist to mark file list verification as `[BLOCKING]`. Updated instructions.xml to add structured PASS/FAIL reconciliation verdict and directive that mismatch blocks review approval.
- **Task 5 (EDUCATION Fixture Timeout):** Added `{ timeout: 30_000 }` to all 3 `it()` calls in `describe.each(FIXTURES)`. EDUCATION fixture takes ~2s per test (well within 30s, but was close to 15s default under CI load). All 21 regression tests pass (7 fixtures × 3 tests).
- **Task 6 (Architecture Diagram):** Corrected Data Flow: Monthly Submission Lifecycle diagram to match actual implementation: reconciliation runs INSIDE transaction (Step 3), comparison runs OUTSIDE transaction (Step 4, wrapped in try/catch). Added `[INSIDE tx]` and `[OUTSIDE tx]` labels. No other sections referenced the incorrect ordering.
- **Task 7 (Query Counter Middleware):** Implemented using AsyncLocalStorage + Drizzle custom logger. `queryCounterLogger` counts queries per-request via `AsyncLocalStorage<QueryContext>`. Express middleware wraps requests in storage context, logs pino warning when threshold (10) exceeded on `res.on('finish')`. `req.queryCount` set for test assertions. Zero production overhead — logger disabled when `NODE_ENV === 'production'`. 3 tests: counter increments, supertest health check, cross-context isolation.
- **Task 8 (Full Verification):** Typecheck: 0 errors. Lint: 0 errors (15 pre-existing warnings in reconciliationEngine.test.ts unchanged). Server: 1221 tests / 82 files. Client: 585 tests / 75 files. Shared: 257 tests / 10 files. Zero regressions.

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] queryCounter.test.ts — test "sets req.queryCount" didn't actually verify req.queryCount; rewrote to invoke middleware directly with mock req/res and assert req.queryCount === 2 after real DB queries [apps/server/src/middleware/queryCounter.test.ts:46-62]
- [x] [AI-Review][HIGH] Missing production no-op test (AC 7, Task 7.4 required it); added test verifying queryCounterLogger.logQuery() is safe no-op without AsyncLocalStorage context [apps/server/src/middleware/queryCounter.test.ts:90-95]
- [x] [AI-Review][MEDIUM] db/index.ts imported from middleware/ (inverted dependency); extracted queryStorage + queryCounterLogger to lib/queryContext.ts, both db/ and middleware/ now import from shared lib [apps/server/src/lib/queryContext.ts]
- [x] [AI-Review][MEDIUM] preSubmissionService.integration.test.ts used raw TRUNCATE instead of resetDb(); replaced with resetDb() to match 8 other integration tests [apps/server/src/services/preSubmissionService.integration.test.ts]
- [x] [AI-Review][MEDIUM] Test name "returns empty results for MDA with no submissions" contradicted assertions (result had 1 approaching retirement); renamed to "returns approaching retirement but null lastSubmissionDate for MDA with no submissions" [apps/server/src/services/preSubmissionService.integration.test.ts:345]
- [x] [AI-Review][LOW] Timeout comment claimed EDUCATION-specific but applied to all 7 fixtures; updated to clarify uniform 30s timeout [apps/server/src/migration/migration-regression.test.ts:180]

### Change Log

- 2026-03-21: Story 7.0c implementation complete — all 8 tasks, 7 ACs satisfied
- 2026-03-21: Code review — 6 findings (2H, 3M, 1L), all fixed. Extracted queryContext to lib/, rewrote queryCounter tests (direct middleware invocation + production safety), adopted resetDb(), fixed misleading test name + comment. Server: 1223 tests / 82 files (+2 new tests). Shared: 257 / 10. Zero regressions.

### File List

#### New Files
- `apps/server/src/lib/queryContext.ts` — AsyncLocalStorage + Drizzle query counter logger (shared by db/ and middleware/)
- `apps/server/src/services/preSubmissionService.integration.test.ts` — real DB integration tests replacing mock-based tests
- `apps/server/src/middleware/queryCounter.ts` — N+1 query detection Express middleware (imports from lib/queryContext)
- `apps/server/src/middleware/queryCounter.test.ts` — query counter middleware tests (5 tests: counter increment, direct req.queryCount verification, integration smoke, cross-context isolation, production safety)

#### Modified Files
- `packages/shared/src/constants/loanTransitions.test.ts` — consolidated 55-test terminal-status block into single efficient test
- `apps/server/src/db/index.ts` — added Drizzle custom logger for query counting (imports from lib/queryContext, non-prod only)
- `apps/server/src/app.ts` — integrated queryCounter middleware after requestLogger (non-prod only)
- `apps/server/src/types/express.d.ts` — added `queryCount?: number` to Express.Request
- `apps/server/src/migration/migration-regression.test.ts` — added 30s timeout to all fixture tests
- `_bmad-output/planning-artifacts/architecture.md` — corrected reconciliation/comparison ordering in data flow diagram
- `_bmad/bmm/workflows/4-implementation/code-review/checklist.md` — marked file list verification as [BLOCKING]
- `_bmad/bmm/workflows/4-implementation/code-review/instructions.xml` — added blocking directive and PASS/FAIL template for file list reconciliation

#### Deleted Files
- `apps/server/src/services/preSubmissionService.test.ts` — replaced by real DB integration tests
