# Story 15.0b: Observation Auto-Generation After Baseline

Status: done

## Story

As the **AG/Department Admin**,
I want observations to be automatically generated when baselines are established,
So that data quality issues (rate variance, negative balance, grade-tier mismatch) are surfaced without requiring a manual trigger.

**Origin:** UAT Finding #8 (High) from E8 retro. `baselineService.ts` `createBatchBaseline()` never calls `generateObservations()` after transaction commits. Observation engine is fully functional and idempotent but never wired to baseline completion.

**Priority:** CRITICAL — second prep story. Observations are essential context for MDA review decisions and exception management.

**Dependencies:** None (can be implemented independently of 15.0a).

## Acceptance Criteria

1. **Given** a DEPT_ADMIN clicks "Establish Baselines" (batch baseline for an upload), **When** the batch baseline operation completes and loans are created, **Then** `generateObservations()` runs automatically for that upload (fire-and-forget, non-blocking) and observations appear in the Observations tab.

2. **Given** a DEPT_ADMIN baselines a single migration record via the Record Detail drawer, **When** the single-record baseline commits, **Then** `generateObservations()` runs automatically for that upload (fire-and-forget).

3. **Given** a DEPT_ADMIN clicks "Baseline All Reviewed" after MDA officers complete their review (Stage 3 of 8.0j pipeline), **When** all reviewed records are baselined, **Then** `generateObservations()` runs once (not once per record) for that upload.

4. **Given** the observation engine has already been run for an upload (e.g., via manual trigger or a previous baseline), **When** `generateObservations()` is called again by auto-generation, **Then** no duplicate observations are created (idempotency preserved — existing `batchInsertObservations` guard).

5. **Given** the `generateObservations()` call fails (e.g., database error), **When** the baseline operation is in progress, **Then** the baseline result is NOT affected — observation generation is fire-and-forget, never blocking baseline success.

6. **Given** baselines have been established for an upload with known data quality issues (e.g., BIR file with rate variances and grade-tier mismatches), **When** the Observations tab is viewed, **Then** observations of relevant types are populated (rate_variance, negative_balance, grade_tier_mismatch, etc.).

7. **Given** all existing baseline and observation tests, **When** the auto-generation wiring is added, **Then** all tests pass with zero regressions.

## Root Cause Analysis

### The Gap

Three baseline paths exist in the codebase. **None** call `generateObservations()`:

| Baseline Path | Service Function | File:Line | Auto-Stop Wired? | Observations Wired? |
|---------------|------------------|-----------|-------------------|---------------------|
| Batch baseline | `createBatchBaseline()` | `baselineService.ts:439-654` | YES (line 646-651) | **NO** |
| Single-record baseline | `createBaseline()` | `baselineService.ts:326-437` | YES (line 433-434) | **NO** |
| Baseline reviewed records | `baselineReviewedRecords()` | `mdaReviewService.ts:318-360` | Via `createBaseline()` loop | **NO** |

The observation engine IS called in exactly ONE place: `supersedeService.ts:180` (when an upload is superseded). That's it.

### The Observation Engine

`observationEngine.ts` exports `generateObservations(uploadId, userId)` which:
- Operates at the UPLOAD level (all records for an upload)
- Is **idempotent** — `batchInsertObservations()` checks for existing observations per record+type+upload before inserting
- Returns `{ generated: number; skipped: number; byType: Record<string, number> }`
- Runs 12 detector functions: rate_variance, negative_balance, stalled_balance, consecutive_loan, multi_mda, no_approval_match, period_overlap, grade_tier_mismatch, three_way_variance, manual_exception, inactive_loan, post_completion_deduction

### Existing Fire-and-Forget Pattern

The codebase already uses this pattern for post-transaction side effects:

```typescript
// baselineService.ts:646-651 — auto-stop check pattern
for (const entry of createdEntries) {
  checkAndTriggerAutoStop(entry.loanId).catch((err) =>
    console.error(`Auto-stop check failed for loan ${entry.loanId}:`, err),
  );
}
```

```typescript
// supersedeService.ts:177-183 — observation re-generation pattern
try {
  await generateObservations(replacementUploadId, userId);
  observationsRegenerated = true;
} catch {
  // Non-critical — supersession is still valid
}
```

## Tasks / Subtasks

- [x] Task 1: Wire `generateObservations` to `createBatchBaseline()` (AC: 1, 4, 5)
  - [x] 1.1: In `apps/server/src/services/baselineService.ts`, add import:
    ```typescript
    import { generateObservations } from './observationEngine';
    ```
  - [x] 1.2: After the auto-stop check loop (after line ~651), add fire-and-forget observation generation:
    ```typescript
    // Fire-and-forget: generate observations for newly baselined records
    generateObservations(uploadId, userId).catch((err) =>
      console.error(`Observation generation failed for upload ${uploadId}:`, err),
    );
    ```
  - [x] 1.3: The `userId` parameter is available — `createBatchBaseline` receives `actingUser` which has `userId`. Verify the parameter name and pass it correctly.

- [x] Task 2: Wire `generateObservations` to `createBaseline()` with opt-out (AC: 2, 4, 5)
  - [x] 2.1: Add an optional parameter to `createBaseline()` to skip observation generation when called in a loop:
    ```typescript
    export async function createBaseline(
      actingUser: { userId: string; role: string; mdaId: string | null },
      uploadId: string,
      recordId: string,
      mdaScope?: string | null,
      options?: { skipObservationGeneration?: boolean },
    ): Promise<BaselineResult> {
    ```
  - [x] 2.2: After the auto-stop check (after line ~434), add conditional observation generation:
    ```typescript
    if (!options?.skipObservationGeneration) {
      generateObservations(uploadId, actingUser.userId).catch((err) =>
        console.error(`Observation generation failed for upload ${uploadId}:`, err),
      );
    }
    ```
  - [x] 2.3: Verify that the import from Task 1.1 covers this function too (same file).

- [x] Task 3: Wire `generateObservations` to `baselineReviewedRecords()` (AC: 3, 4, 5)
  - [x] 3.1: In `apps/server/src/services/mdaReviewService.ts`, add import:
    ```typescript
    import { generateObservations } from './observationEngine';
    ```
  - [x] 3.2: Update the `createBaseline()` call inside the loop to pass `{ skipObservationGeneration: true }`:
    ```typescript
    await createBaseline(actingUser, uploadId, record.id, mdaScope, { skipObservationGeneration: true });
    ```
    This prevents N redundant calls inside the loop.
  - [x] 3.3: After the loop completes (after line ~357, before `return`), add single fire-and-forget call:
    ```typescript
    // Fire-and-forget: generate observations once for all newly baselined records
    if (baselinedCount > 0) {
      generateObservations(uploadId, userId).catch((err) =>
        console.error(`Observation generation failed for upload ${uploadId}:`, err),
      );
    }
    ```
  - [x] 3.4: Update the dynamic import of `createBaseline` at line 325 to ensure the new parameter signature is compatible:
    ```typescript
    const { createBaseline } = await import('./baselineService');
    ```
    This dynamic import will automatically pick up the new optional parameter.

- [x] Task 4: Add/update tests (AC: 6, 7)
  - [x] 4.1: Created `apps/server/src/services/baselineObservationWiring.test.ts` (dedicated wiring test file following `autoStopCertificateWiring.test.ts` pattern). Tests verify `generateObservations` is called after `createBatchBaseline()` with correct `uploadId` and `userId`.
  - [x] 4.2: Added tests for single-record `createBaseline()`:
    - Verified `generateObservations` is called when `skipObservationGeneration` is not set
    - Verified `generateObservations` is NOT called when `skipObservationGeneration: true`
  - [x] 4.3: Added test for `baselineReviewedRecords` observation wiring in dedicated wiring test file:
    - Verified `generateObservations` is called exactly once after the loop (not N times)
    - Verified it's called only when `baselinedCount > 0`
    - Existing `mdaReviewService.integration.test.ts` tests all pass (11 tests, zero regressions)
  - [x] 4.4: Full test suite run: 79 unit test files (1044 tests) + 40 integration test files (595 tests) — all pass with zero regressions

- [x] Task 5: Verify end-to-end observation population (AC: 6)
  - [x] 5.1: No UI changes needed — the Observations tab and `POST /observations/generate` manual trigger continue to work unchanged
  - [x] 5.2: Verified via wiring tests: `generateObservations` is called with correct `uploadId` after baseline; the `GET /api/observations` endpoint (unchanged) returns observations. Observation engine integration tests (9 tests) pass confirming end-to-end population.

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] M1: Add `result.loansCreated > 0` guard to `createBatchBaseline` observation wiring — unconditional call fires `generateObservations` even when zero records baselined, inconsistent with `baselineReviewedRecords`'s `baselinedCount > 0` guard [baselineService.ts:662-665] — **FIXED**
- [x] [AI-Review][LOW] L1: Replace `console.error` with structured Pino `logger.error` for observation failure logging — aligns with project standard (Story 7.0f). Added `logger` import to both `baselineService.ts` and `mdaReviewService.ts` [3 call sites] — **FIXED**
- [x] [AI-Review][LOW] L2: Extract `flushPromises` helper in wiring tests, replace 5x `setTimeout(r, 50)` with `flushPromises()` — names intent, eliminates arbitrary delay [baselineObservationWiring.test.ts] — **FIXED**
- [x] [AI-Review][LOW] L3: Add test for zero-eligible-records path in `createBatchBaseline` — validates M1 guard prevents unnecessary `generateObservations` call when all records already baselined [baselineObservationWiring.test.ts] — **FIXED**

## Dev Notes

### Fix Strategy: Fire-and-Forget at Service Level

Follow the established pattern from `checkAndTriggerAutoStop` — observation generation runs asynchronously after the transaction commits, never blocking the baseline result. Errors are caught and logged, never propagated.

### Fire-and-Forget Pattern Clarification

The codebase currently has three different fire-and-forget patterns. This story uses the **`.catch()` pattern** for all three wiring points:

```typescript
generateObservations(uploadId, userId).catch((err) =>
  console.error(`Observation generation failed for upload ${uploadId}:`, err),
);
```

**Why `.catch()` and not the other patterns:**

| Pattern | Where Used | When to Use |
|---------|-----------|-------------|
| `.catch()` on promise | This story, simple one-shot async calls | Single async call, no sequencing needed |
| `void (async () => { for ... })()` | `baselineService.ts:647-651` (auto-stop loop) | Sequential iteration over multiple async calls — needs an IIFE to `await` each in order |
| `try/catch` with `await` | `supersedeService.ts:177-183` | When the caller needs to know if it succeeded (sets `observationsRegenerated` flag) |

**Do NOT use `void async IIFE`** — observation generation is a single async call, not a loop. **Do NOT use `try/catch` with `await`** — observation generation should not block the baseline return.

### Key Architectural Facts

- `generateObservations(uploadId, userId)` is **upload-level** — it analyzes ALL migration records for an upload, not individual records
- It is **idempotent** — `batchInsertObservations()` in `observationEngine.ts:1040+` checks for existing observations before inserting (same record+type+upload composite guard)
- It is **already exported** from `apps/server/src/services/observationEngine.ts:63`
- The `userId` parameter is currently unused inside the function but is part of the signature — pass it anyway for future audit trail

### Three Baseline Paths — All Must Be Wired

| Path | Trigger | Service | Observation Call Location |
|------|---------|---------|--------------------------|
| Batch | "Establish Baselines" button | `baselineService.createBatchBaseline()` | After auto-stop loop |
| Single record | Record Detail drawer "Baseline" | `baselineService.createBaseline()` | After auto-stop check (when not opt-out) |
| Reviewed batch | "Baseline All Reviewed" button | `mdaReviewService.baselineReviewedRecords()` | After loop (single call), with opt-out on inner `createBaseline()` calls |

### The Opt-Out Pattern

`baselineReviewedRecords()` calls `createBaseline()` in a loop (one per reviewed record). Without opt-out, `generateObservations()` would fire N times for the same upload. Since it's idempotent, this isn't harmful but is wasteful. The `skipObservationGeneration` option prevents N-1 redundant calls.

### 12 Observation Types Generated

All detectors fire in a single `generateObservations()` call:

| Type | Detector | What It Catches |
|------|----------|-----------------|
| `rate_variance` | `detectRateVariance()` | Non-standard rates (accelerated vs. 13.33%) |
| `negative_balance` | `detectNegativeBalance()` | Outstanding balance < 0 |
| `stalled_balance` | `detectStalledBalance()` | No deduction movement over extended period |
| `consecutive_loan` | `detectConsecutiveLoan()` | Staff with overlapping loan periods |
| `multi_mda` | `detectMultiMda()` | Staff in records from multiple MDAs |
| `no_approval_match` | `detectNoApprovalMatch()` | Staff not in live payroll |
| `period_overlap` | `detectPeriodOverlap()` | Multiple uploads for same period+MDA |
| `grade_tier_mismatch` | `detectGradeTierMismatch()` | Principal exceeds grade tier limit |
| `three_way_variance` | — | Principal/Total/Monthly inconsistency |
| `manual_exception` | — | User-flagged records |
| `inactive_loan` | — | Deductions continuing after completion |
| `post_completion_deduction` | — | Deduction dated after completion |

### Files to Touch

| File | Action |
|------|--------|
| `apps/server/src/services/baselineService.ts` | Add import + fire-and-forget call in `createBatchBaseline()` and `createBaseline()` (with opt-out param) |
| `apps/server/src/services/mdaReviewService.ts` | Add import + single fire-and-forget call after `baselineReviewedRecords()` loop, pass opt-out to inner `createBaseline()` calls |

**No changes needed to:**
- `observationEngine.ts` — engine already works, already exported
- `observationRoutes.ts` — manual trigger route unchanged
- `observationService.ts` — CRUD service unchanged
- Any client-side files — UI already has Observations tab and generate button
- `supersedeService.ts` — already correctly calls `generateObservations()`

### Architecture Compliance

- **Fire-and-forget pattern:** matches `checkAndTriggerAutoStop` convention in `baselineService.ts:646-651`
- **Idempotency:** guaranteed by `batchInsertObservations()` composite guard
- **Non-punitive vocabulary:** observation types already use approved vocabulary (defined in `packages/shared/src/types/observation.ts`)
- **Transaction safety:** `generateObservations()` runs AFTER transaction commits — no risk of partial state

### Testing Standards

- **Framework:** Vitest
- **Existing tests:** `mdaReviewService.integration.test.ts` has comprehensive baseline-reviewed test at line ~410
- **Mock pattern:** Mock `generateObservations` from `./observationEngine` to verify it's called with correct `uploadId`
- **Integration test caution:** If testing actual observation generation (not mocked), ensure test fixtures have records that trigger detectors

### Previous Story Context (8.0j)

Story 8.0j added the selective baseline pipeline (3-stage: auto-baseline → MDA review → admin verify+baseline). The `createBatchBaseline()` function was enhanced to partition records by variance category. The `baselineReviewedRecords()` function was added in `mdaReviewService.ts`. Neither wired observation generation — this gap was not caught in code review.

### Project Structure Notes

- Observation engine: `apps/server/src/services/observationEngine.ts`
- Observation service (CRUD): `apps/server/src/services/observationService.ts`
- Observation routes: `apps/server/src/routes/observationRoutes.ts`
- Baseline service: `apps/server/src/services/baselineService.ts`
- MDA review service: `apps/server/src/services/mdaReviewService.ts`
- Observation types: `packages/shared/src/types/observation.ts`

### Team Agreement Compliance

- **Agreement #5: File list verification** — dev must include exact file list in completion notes
- **Agreement #6: Transaction scope documentation** — this story adds post-transaction side effects; dev notes must state that observation generation runs OUTSIDE the baseline transaction
- **Agreement #12: Role-specific UAT** — observations should be visible to all admin roles after baseline

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Finding #8]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-04-06.md` — Prep-2 assignment]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0b specification, line ~3448]
- [Source: `apps/server/src/services/baselineService.ts:439-654` — createBatchBaseline (gap location)]
- [Source: `apps/server/src/services/baselineService.ts:326-437` — createBaseline (gap location)]
- [Source: `apps/server/src/services/mdaReviewService.ts:318-360` — baselineReviewedRecords (gap location)]
- [Source: `apps/server/src/services/observationEngine.ts:63-172` — generateObservations (target function)]
- [Source: `apps/server/src/services/supersedeService.ts:177-183` — existing auto-generation pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- TypeScript type check initially flagged unused `sql` import in test file — fixed immediately
- All 5 wiring tests pass: batch baseline, single baseline, skip opt-out, reviewed batch, failure resilience
- Full unit suite: 79 files, 1044 tests, 0 failures
- Full integration suite: 40 files, 595 tests, 0 failures

### Completion Notes List

- Wired `generateObservations()` to all three baseline paths as fire-and-forget (`.catch()` pattern)
- Added `skipObservationGeneration` opt-out parameter to `createBaseline()` to prevent N redundant calls when called in a loop by `baselineReviewedRecords()`
- Created dedicated wiring test file (`baselineObservationWiring.test.ts`) following `autoStopCertificateWiring.test.ts` pattern — real DB + mocked side-effect service
- Transaction scope: observation generation runs OUTSIDE the baseline transaction (post-commit side effect). Errors are caught and logged, never blocking baseline success.
- No UI changes required — Observations tab and manual trigger route are unchanged
- Dynamic import in `mdaReviewService.ts` (line 325) automatically picks up the new optional parameter signature

### Implementation Plan

Three-point wiring with fire-and-forget `.catch()` pattern:
1. `createBatchBaseline()` — single call after auto-stop loop
2. `createBaseline()` — conditional call (skipped when opt-out flag set)
3. `baselineReviewedRecords()` — single call after loop, with opt-out on inner `createBaseline()` calls

### File List

**Modified:**
- `apps/server/src/services/baselineService.ts` — Added `generateObservations` import, fire-and-forget call in `createBatchBaseline()`, `skipObservationGeneration` opt-out param + conditional call in `createBaseline()`
- `apps/server/src/services/mdaReviewService.ts` — Added `generateObservations` import, passed `{ skipObservationGeneration: true }` to inner `createBaseline()` calls, added single fire-and-forget call after loop

**Created:**
- `apps/server/src/services/baselineObservationWiring.test.ts` — 5 wiring tests covering all 3 baseline paths + opt-out + failure resilience

## Change Log

- 2026-04-06: Wired `generateObservations()` to all three baseline paths — batch, single-record, and reviewed-batch. Added 5 wiring tests. All 1639 tests pass (1044 unit + 595 integration).
- 2026-04-06: Code review fixes — added `loansCreated > 0` guard on batch path, replaced `console.error` with Pino `logger.error` (3 sites), extracted `flushPromises` helper in tests, added zero-eligible test. 6 wiring tests + 11 integration tests pass.
