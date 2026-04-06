# Story 15.0d: DevAutoSeed Separation — Admin Users vs Demo Loans

Status: done

## Story

As a **developer**,
I want the dev auto-seed to only create admin user accounts (not demo loans or scheme config) when the database is empty,
So that a Docker volume reset restores login ability without polluting the database with fake financial data that overwrites real uploads.

**Origin:** UAT Finding #39 (High) from E8 retro. Docker volume loss triggered full demo seed including 7 fake loans, destroying Awwal's 171 real BIR migration records. Scheme fund total reset from real value to ₦500M demo value.

**Priority:** HIGH — prevents data loss on volume reset. Quick story (infrastructure only, no UI).

## Acceptance Criteria

1. **Given** a Docker volume reset (empty database) and server start in development mode, **When** `devAutoSeed()` runs, **Then** only admin user accounts are created (AG super_admin, Deputy AG super_admin, Dept Admin dept_admin, and MDA officer accounts for testing). No demo loans, no scheme_config overwrite.

2. **Given** the database already has active admin users from a previous seed, **When** `devAutoSeed()` runs on server start, **Then** no additional users are created (idempotent via `onConflictDoNothing`).

3. **Given** a developer wants to load demo loan data for local testing, **When** they run `pnpm seed:demo`, **Then** the explicit CLI command seeds 7 mock loans and scheme_config. This is opt-in, not automatic.

4. **Given** scheme_config already has a real `scheme_fund_total` value (e.g., ₦2B set by AG), **When** `pnpm seed:demo` is run, **Then** scheme_config uses `onConflictDoNothing` — the existing real value is preserved, not overwritten.

5. **Given** existing tests for server startup, seed, and purge, **When** the separation is applied, **Then** all tests pass with zero regressions.

6. **Given** the server logs on startup, **When** `devAutoSeed()` seeds admin users, **Then** the log message clearly states "seeded N admin users (no demo loans)" to distinguish from a full demo seed.

## Root Cause Analysis

### Current Flow (Broken)

```
Server startup (NODE_ENV=development)
  → devAutoSeed()
    → SELECT COUNT(*) FROM users WHERE is_active = true
    → IF count = 0:
        → runDemoSeed()  ← PROBLEM: seeds EVERYTHING
          → 6 demo users (3 admin + 3 MDA officers)
          → 7 mock loans with fake financial data
          → scheme_config overwrite (₦500M, onConflictDoUpdate)
```

### The Three Conflated Concerns

| Concern | Current Location | Should Be | Auto? |
|---------|-----------------|-----------|-------|
| Admin user accounts | `seed-demo.ts` via `devAutoSeed` | `devAutoSeed.ts` directly | YES — needed for login |
| Demo loans (7 mock) | `seed-demo.ts` via `devAutoSeed` | `seed-demo.ts` CLI only | NO — explicit opt-in |
| Scheme config (₦500M) | `seed-demo.ts` via `devAutoSeed` | `seed-demo.ts` CLI only | NO — explicit opt-in |

### scheme_config Overwrite Bug

```typescript
// seed-demo.ts:197-207 — CURRENT (DANGEROUS)
.onConflictDoUpdate({
  target: schemeConfig.key,
  set: { value: '500000000.00', updatedBy: agUserId },  // ← OVERWRITES REAL VALUE
});
```

If AG sets scheme_fund_total to ₦2B, then devAutoSeed fires → value reset to ₦500M.

## Tasks / Subtasks

- [x] Task 1: Refactor `devAutoSeed.ts` to seed ONLY admin users (AC: 1, 2, 6)
  - [x] 1.1: Rewrote `devAutoSeed.ts` — removed `runDemoSeed()` call, replaced with inline admin user seeding. Uses `hashPassword`, `generateUuidv7`, `onConflictDoNothing` for idempotency. Inserts 6 users per-row (not bulk) matching the `seed-demo.ts` pattern.
  - [x] 1.2: Removed the dynamic `import('./seed-demo')` and `runDemoSeed()` call entirely.
  - [x] 1.3: Verified MDA codes: `HEALTH`, `EDUCATION`, `BIR` all confirmed in `packages/shared/src/constants/mdas.ts` (lines 7, 28, 31, 44).

- [x] Task 2: Update `seed-demo.ts` to be CLI-only (AC: 3)
  - [x] 2.1: Verified CLI entry point at lines 214-227 works standalone — `isDirectRun` check is independent of `devAutoSeed`.
  - [x] 2.2: `runDemoSeed()` function signature unchanged — still exported for CLI and test consumers.
  - [x] 2.3: Added `console.log('Running FULL demo seed (admin users + demo loans + scheme config)...')` at top of `runDemoSeed()`.

- [x] Task 3: Fix scheme_config overwrite (AC: 4)
  - [x] 3.1: Changed `onConflictDoUpdate` to `onConflictDoNothing({ target: schemeConfig.key })` — existing real `scheme_fund_total` value is preserved.
  - [x] 3.2: Verified: if AG sets scheme_fund_total to a real value, `pnpm seed:demo` will not overwrite it.

- [x] Task 4: Update log messages for clarity (AC: 6)
  - [x] 4.1: `devAutoSeed.ts` logs "seeded N admin users (no demo loans)" — covered by Task 1 rewrite.
  - [x] 4.2: CLI entry point already logs `Seeded ${userCount} users, ${loanCount} loans` — unchanged.

- [x] Task 5: Verify and test (AC: 5)
  - [x] 5.1: Full unit suite: 79 files, 1045 tests, 0 failures. Full integration suite: 40 files, 595 tests, 0 failures.
  - [x] 5.2: `seed-demo.ts` CLI entry point verified — `runDemoSeed()` still exported and callable.
  - [x] 5.3: `devAutoSeed()` no longer imports or calls `runDemoSeed()` — only seeds admin users.
  - [x] 5.4: Replaced `runDemoSeed()` with `seedReferenceMdas()` in `seed-verification.integration.test.ts` `beforeAll` — test only needs MDAs, not demo loans. Import updated accordingly.
  - [x] 5.5: No existing test files for devAutoSeed or seed-demo — no mock updates needed. TypeScript compiles cleanly.

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] M1: Create integration test for `devAutoSeed` — complete rewrite (28→73 lines) had zero test coverage. Created `devAutoSeed.integration.test.ts` with 4 tests: seeds 6 users, idempotent, no loans/scheme_config, MDA IDs assigned — **FIXED**
- [x] [AI-Review][LOW] L1: BIR officer addition to `seed-demo.ts:166` — intentional: BIR was the UAT test MDA, needed for Team Agreement #12 role-specific testing. Both `devAutoSeed` and `seed-demo` now have matching 6-user lists — **RESOLVED** (confirmed with PO)
- [x] [AI-Review][LOW] L2: `DEMO_SEED_PASSWORD` env var already aligned in both files — `seed-demo.ts:8` and `devAutoSeed.ts:34` both read `process.env.DEMO_SEED_PASSWORD || 'DemoPass1'`. No `.env.example` entry needed: password is logged on every dev startup, default is well-known — **RESOLVED** (no inconsistency)
- [x] [AI-Review][LOW] L3: Add warning log when MDA code not found for officer accounts — `mdaId` silently set to `null` if `seedReferenceMdas()` hasn't run [devAutoSeed.ts:40-44] — **FIXED**

## Dev Notes

### Fix Strategy: Inline Admin Seeding, CLI-Only Demo

The fix separates two concerns:
1. **devAutoSeed** (automatic on startup) → admin users ONLY
2. **seed-demo.ts** (explicit CLI `pnpm seed:demo`) → everything (users + loans + scheme config)

### Startup Ordering Precondition

`devAutoSeed()` queries the `mdas` table to resolve MDA IDs for officer accounts. This depends on `seedReferenceMdas()` having already run. The current startup sequence in `index.ts:42-47` guarantees this:

```
seedReferenceMdas()     ← runs BEFORE app.listen()
app.listen() callback   ← devAutoSeed() runs INSIDE this callback
```

**Do NOT move `devAutoSeed()` before `seedReferenceMdas()` in the startup sequence.** If calling `devAutoSeed()` from test setup, ensure MDAs are seeded first (call `seedReferenceMdas()` or use a truncate+reseed pattern).

The current `runDemoSeed()` calls `seedReferenceMdas()` internally (line 144) — the refactored `devAutoSeed` does NOT, relying on the startup ordering instead. This is intentional: `seedReferenceMdas()` is idempotent but still costs a DB round-trip, and it already runs on every startup regardless.

### Key Files

| File | Action |
|------|--------|
| `apps/server/src/db/devAutoSeed.ts` | Refactor: remove `runDemoSeed()` call, inline admin user seeding |
| `apps/server/src/db/seed-demo.ts` | Fix: `onConflictDoNothing` for scheme_config. Add CLI log message. |
| `apps/server/src/db/seed-verification.integration.test.ts` | Cleanup: replace `runDemoSeed()` with `seedReferenceMdas()` in `beforeAll` (only needs MDAs, not demo loans) |

**No changes needed to:**
- `apps/server/src/index.ts` — startup flow unchanged (still calls `devAutoSeed()` in dev)
- `apps/server/src/db/seedReferenceMdas.ts` — MDA seeding unchanged (already idempotent)
- `apps/server/scripts/purge-demo-data.ts` — purge script unchanged
- Any client-side files

### Current Demo Users (All 6 Preserved in devAutoSeed)

| Email | Role | MDA |
|-------|------|-----|
| `ag@vlprs.oyo.gov.ng` | super_admin | None |
| `deputy.ag@vlprs.oyo.gov.ng` | super_admin | None |
| `admin@vlprs.oyo.gov.ng` | dept_admin | None |
| `health.officer@vlprs.oyo.gov.ng` | mda_officer | Health |
| `education.officer@vlprs.oyo.gov.ng` | mda_officer | Education |
| `bir.officer@oyo.gov.ng` | mda_officer | BIR |

All 6 users are needed for role-specific testing (Team Agreement #12). They use `onConflictDoNothing` on email — safe and idempotent.

### Current Demo Loans (7 — Moved to CLI-Only)

7 hardcoded loans with fake staff data (Adebayo, Fatimah, Ibrahim, etc.) with amounts ranging ₦150k–₦1M. These are ONLY created when `pnpm seed:demo` is run explicitly.

### Startup Call Chain (After Fix)

```
Server startup (NODE_ENV=development)
  → runMigrations()
  → seedReferenceMdas()   ← MDAs + system user (all environments)
  → app.listen()
  → devAutoSeed()          ← ONLY admin users (dev only)
      → IF no active users: insert 6 accounts, log "no demo loans"
      → IF users exist: skip (idempotent)
```

### Architecture Compliance

- **Idempotency:** All inserts use `onConflictDoNothing` — safe to run repeatedly
- **Environment guard:** `devAutoSeed()` only runs when `NODE_ENV=development` (index.ts:44)
- **No production impact:** Production uses `seed:prod` script, never `devAutoSeed`

### Testing Standards

- **Framework:** Vitest
- **No existing test files:** Neither `devAutoSeed.test.ts` nor `seed-demo.test.ts` exist
- **Known consumer:** `seed-verification.integration.test.ts:50` calls `runDemoSeed()` in `beforeAll` — replace with `seedReferenceMdas()` (Task 5.4)
- **`runDemoSeed()` still exported:** Other integration tests that may call it will continue to work — the function signature is unchanged

### Team Agreement Compliance

- **Agreement #12: Role-specific UAT** — all 6 user accounts preserved for role testing
- **Agreement #5: File list verification** — dev must include exact file list in completion notes

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Finding #39]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-04-06.md` — Prep-12 assignment]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0d specification, line ~3464]
- [Source: `apps/server/src/db/devAutoSeed.ts` — current auto-seed logic]
- [Source: `apps/server/src/db/seed-demo.ts` — demo data seeder (lines 138-211)]
- [Source: `apps/server/src/index.ts` — startup sequence (lines 44-46)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- TypeScript compiles cleanly with zero errors
- Full unit suite: 79 files, 1045 tests, 0 failures
- Full integration suite: 40 files, 595 tests, 0 failures
- MDA codes verified against `packages/shared/src/constants/mdas.ts`: HEALTH (line 31), EDUCATION (line 44), BIR (line 28)

### Completion Notes List

- Rewrote `devAutoSeed.ts` to seed 6 admin user accounts only (no demo loans, no scheme config) — uses per-row insert with `onConflictDoNothing` for idempotency
- Removed dynamic `import('./seed-demo')` from `devAutoSeed.ts` — complete separation of auto-seed and demo seed
- Fixed `seed-demo.ts` scheme_config: `onConflictDoUpdate` → `onConflictDoNothing` — prevents overwriting real AG-set scheme_fund_total
- Added CLI identification log to `runDemoSeed()`: "Running FULL demo seed (admin users + demo loans + scheme config)..."
- Updated `seed-verification.integration.test.ts` to use `seedReferenceMdas()` instead of `runDemoSeed()` — test only needs MDAs, not demo loans
- Transaction scope: `devAutoSeed` does NOT use a transaction (individual inserts with `onConflictDoNothing`), matching the lightweight nature of the operation
- Startup ordering preserved: `seedReferenceMdas()` runs before `devAutoSeed()` in `index.ts` (lines 42-47)

### File List

**Modified:**
- `apps/server/src/db/devAutoSeed.ts` — Complete rewrite: removed `runDemoSeed()` import/call, replaced with inline admin user seeding (6 accounts, `onConflictDoNothing`, structured logging)
- `apps/server/src/db/seed-demo.ts` — Changed `scheme_config` insert from `onConflictDoUpdate` to `onConflictDoNothing`; added CLI identification log to `runDemoSeed()`
- `apps/server/src/db/seed-verification.integration.test.ts` — Replaced `runDemoSeed()` with `seedReferenceMdas()` in `beforeAll` (only needs MDAs, not demo loans)

**Created:**
- `apps/server/src/db/devAutoSeed.integration.test.ts` — 4 integration tests: user seeding, idempotency, no-loans/scheme_config guard, MDA ID assignment

## Change Log

- 2026-04-06: Separated devAutoSeed from full demo seed. Auto-seed now creates only admin users; demo loans + scheme config require explicit `pnpm seed:demo`. Fixed scheme_config overwrite bug. All 1640 tests pass (1045 unit + 595 integration).
- 2026-04-06: Code review fixes — created `devAutoSeed.integration.test.ts` (4 tests: user seeding, idempotency, no-loans guard, MDA assignment). Added MDA-not-found warning log. BIR officer confirmed intentional (UAT MDA). Password env var already aligned in both files. 4 findings (0H 1M 3L), all resolved.
