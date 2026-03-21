# Story 7.0b: Type Safety & Schema Contracts

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **development team**,
I want all API surfaces validated at both ends with compile-time type safety enforced,
So that type drift between layers is caught at build time rather than in code review.

## Acceptance Criteria

### AC 1: LOAN_STATUS_VALUES Single Source of Truth

**Given** the loan status values defined in 3 places (DB enum, Zod validator, TypeScript type)
**When** a developer needs to reference valid loan statuses
**Then** a single `LOAN_STATUS_VALUES` constant in `packages/shared/src/constants/` is the canonical source, the Zod validator in `loanSchemas.ts` derives from it (fixing the stale 6-value array to include all 11 values), and the `LoanStatus` type is derived from the constant

### AC 2: Server-Side Zod Response Validation Pattern Established

**Given** the existing request validation middleware (`validate.ts`)
**When** a response is sent from any endpoint with a registered response schema
**Then** a `validateResponse()` middleware validates the response body against the schema before sending, logging a warning in development and throwing `500 RESPONSE_VALIDATION_ERROR` in test mode
**And** the pattern is applied to the highest-risk endpoints: dashboard (5), reconciliation (2), and submission processing (5)

### AC 3: TERMINATION Enum Guard

**Given** the deprecated `TERMINATION` value in `eventFlagTypeEnum` (retained for PostgreSQL backward compatibility)
**When** any code attempts to use `TERMINATION` as an event flag value
**Then** Zod validation rejects it at application boundaries (already done via `EVENT_FLAG_VALUES`), a TypeScript branded type excludes it from the active `EventFlagType`, and the schema definition includes a documentation comment explaining the exclusion

### AC 4: EVENT_FLAG_LABELS Type-Safe Lookup

**Given** the `EVENT_FLAG_LABELS` object in `vocabulary.ts`
**When** accessed for display purposes
**Then** it uses `satisfies Record<EventFlagType, string>` for compile-time exhaustiveness (not `as Record<string, string>`), and the 2 callsite casts in `SubmissionDetailPage.tsx` and `ManualEntryRow.tsx` are removed

### AC 5: Redundant Multi-MDA Columns Consolidated

**Given** `hasMultiMda` (boolean) and `multiMdaBoundaries` (JSONB) columns on `migration_uploads` that duplicate data in `delineationResult` (JSONB)
**When** any service needs multi-MDA state
**Then** all reads use `delineationResult.delineated` and `delineationResult.sections` instead, the redundant columns are dropped via Drizzle migration, and `migrationValidationService.ts` writes to `delineationResult` instead of the legacy columns

### AC 6: withTransaction Helper

**Given** 21 inline `db.transaction()` blocks across 13 services
**When** a service needs transactional execution
**Then** a `withTransaction()` helper in `apps/server/src/lib/transaction.ts` provides: typed transaction handle (`TxHandle`), optional `existingTx` parameter for composable transactions, consistent error handling pattern
**And** the existing `transitionLoan` pattern (optional `existingTx`) is preserved as the model

### AC 7: Express 5 param() Retrofit Complete

**Given** the `param()` helper in `apps/server/src/lib/params.ts`
**When** any route accesses `req.params`
**Then** all route files use `param(req.params.xxx)` instead of raw `req.params.xxx as string`
**And** specifically `observationRoutes.ts` is retrofitted (3 instances)

### AC 8: Event Enum Exhaustiveness Guard

**Given** the `EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP` mapping between two independent enums
**When** a new event flag type or employment event type is added
**Then** a compile-time error surfaces if the mapping is not updated, using `satisfies Record<EventFlagType, ...>` constraint
**And** the deprecated `TERMINATION` key is explicitly mapped to `null` with a documentation comment

## Dependencies

- **Depends on:** Story 7.0a (Financial Precision Hardening) — 7.0a adds decimal.js to client package.json; 7.0b should assume this is done. No schema changes in 7.0a, so 7.0b's migration (0024) won't conflict
- **Blocks:** Story 7.0c and all downstream prep stories (7.0d–7.0g), plus all Epic 7 feature stories (7.1+). Per zero-debt-forward principle, no E7 feature work begins until all prep stories complete
- **Sequence:** 7.0a → **7.0b** → 7.0c → 7.0d → 7.0e + 7.0f (parallel) → 7.0g → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: LOAN_STATUS_VALUES Consolidation (AC: 1)
  - [x] 1.1 Create `packages/shared/src/constants/loanStatuses.ts` with canonical `LOAN_STATUS_VALUES` array containing all 11 values: `['APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED', 'WRITTEN_OFF', 'RETIRED', 'DECEASED', 'SUSPENDED', 'LWOP', 'TRANSFER_PENDING'] as const`
  - [x] 1.2 Export `LoanStatusValue` type derived from the constant: `type LoanStatusValue = (typeof LOAN_STATUS_VALUES)[number]`
  - [x] 1.3 Update `packages/shared/src/validators/loanSchemas.ts`: remove the hardcoded 6-value `LOAN_STATUS_VALUES` array, import from `../constants/loanStatuses`, use `z.enum(LOAN_STATUS_VALUES)` — this fixes the stale validator that currently rejects RETIRED, DECEASED, SUSPENDED, LWOP, TRANSFER_PENDING
  - [x] 1.4 Update `packages/shared/src/types/loan.ts`: derive `LoanStatus` from `LoanStatusValue` or keep the union but add a compile-time check that it matches `LOAN_STATUS_VALUES`
  - [x] 1.5 Add cross-reference comment to `apps/server/src/db/schema.ts` line 84: `// Canonical values: packages/shared/src/constants/loanStatuses.ts`
  - [x] 1.6 Export `LOAN_STATUS_VALUES` and `LoanStatusValue` from `packages/shared/src/index.ts`
  - [x] 1.7 Update `LoanDetailPage.tsx` `LOAN_STATUS_MAP` to use imported `LOAN_STATUS_VALUES` for exhaustiveness check
  - [x] 1.8 Add test: verify `LOAN_STATUS_VALUES` matches `loanStatusEnum` values from DB schema (compile-time + runtime alignment)

- [x] Task 2: Zod Response Validation Pattern (AC: 2)
  - [x] 2.1 Create `apps/server/src/middleware/validateResponse.ts` — middleware that intercepts `res.json()`, validates against schema, logs warning in dev mode, throws `AppError(500, 'RESPONSE_VALIDATION_ERROR')` in test mode, passes through in production (safety net, not blocker)
  - [x] 2.2 Define the standard API envelope schema in `packages/shared/src/validators/apiSchemas.ts`: `apiResponseSchema(dataSchema)` that wraps any data schema in `z.object({ success: z.literal(true), data: dataSchema })`
  - [x] 2.3 Apply `validateResponse()` to dashboard routes (5 endpoints in `dashboardRoutes.ts`: GET /metrics, PUT /scheme-fund, GET /breakdown, GET /attention, GET /compliance) — response schemas already exist in `dashboardSchemas.ts`
  - [x] 2.4 Apply to reconciliation routes (2 endpoints in `reconciliationRoutes.ts`) — response schemas already exist in `reconciliationSchemas.ts`
  - [x] 2.5 Apply to submission routes (5 endpoints in `submissionRoutes.ts`) — create response schemas if missing
  - [x] 2.6 Add test for `validateResponse` middleware: verify schema violation produces 500 in test mode, verify valid response passes through unchanged
  - [x] 2.7 Add architecture doc comment in `validateResponse.ts` explaining the 3-mode behavior (dev: warn, test: throw, prod: pass)

- [x] Task 3: TERMINATION Guard & Documentation (AC: 3)
  - [x] 3.1 Add documentation comment to `schema.ts` line 550 (`TERMINATION` entry): `// DEPRECATED: Retained for PostgreSQL enum compatibility only. Application-level exclusion in EVENT_FLAG_VALUES. Migrated to DISMISSAL in Story 11.2b. DO NOT use in business logic.`
  - [x] 3.2 Create `ActiveEventFlagType` type in `packages/shared/src/types/submission.ts` that excludes TERMINATION: `type ActiveEventFlagType = Exclude<EventFlagType, 'TERMINATION'>` — use this in all business logic signatures
  - [x] 3.3 Add compile-time exhaustiveness test: verify `EVENT_FLAG_VALUES` matches `ActiveEventFlagType` exactly
  - [x] 3.4 Verify existing test in `submissionSchemas.test.ts` line 175 still passes: "rejects deprecated TERMINATION event flag"

- [x] Task 4: EVENT_FLAG_LABELS Type Safety (AC: 4)
  - [x] 4.1 Update `vocabulary.ts` (line 312-324): remove `as Record<string, string>` cast, replace with `satisfies Record<ActiveEventFlagType, string>` (or `EventFlagType` minus TERMINATION) — compile-time exhaustiveness check
  - [x] 4.2 Update `SubmissionDetailPage.tsx` (line 20): remove `as Record<string, string>` cast on `UI_COPY.EVENT_FLAG_LABELS` — the type is now narrow enough for direct indexing
  - [x] 4.3 Update `ManualEntryRow.tsx` (line 188): remove `as Record<string, string>` cast — use type-safe lookup directly
  - [x] 4.4 Verify typecheck passes with no casts needed

- [x] Task 5: Redundant Multi-MDA Column Consolidation (AC: 5)
  - [x] 5.1 Update `migrationValidationService.ts` `validateUpload()`: replace writes to `hasMultiMda` and `multiMdaBoundaries` with writing a proper `delineationResult` JSONB (use `fileDelineationService.detectBoundaries()` result shape)
  - [x] 5.2 Update all reads: `migrationValidationService.ts` reads that access `hasMultiMda` → read `delineationResult.delineated` instead; reads of `multiMdaBoundaries` → read `delineationResult.sections`
  - [x] 5.3 Update frontend `ValidationSummaryCard.tsx`: adapt to receive multi-MDA state from `delineationResult` instead of separate `hasMultiMda`/`multiMdaBoundaries` fields
  - [x] 5.4 Update `fileDelineationService.ts` `saveDelineationResult()`: stop writing to `hasMultiMda` and `multiMdaBoundaries` (only write `delineationResult`)
  - [x] 5.4a **CHECKPOINT: Run full test suite before column drop.** Run `pnpm typecheck && pnpm --filter @vlprs/server test && pnpm --filter @vlprs/client test`. All tests must pass with code no longer reading/writing the legacy columns but the columns still present in the DB. This proves the code is fully migrated to `delineationResult` and it is safe to drop the columns. Do NOT proceed to 5.5 until this passes
  - [x] 5.5 Generate Drizzle migration to drop `has_multi_mda` and `multi_mda_boundaries` columns from `migration_uploads` table. **CRITICAL: Generate NEW migration, never re-run existing**
  - [x] 5.6 Remove column definitions from `schema.ts` (lines 301-302)
  - [x] 5.7 Update shared types: remove `hasMultiMda` and `multiMdaBoundaries` from any migration upload response types
  - [x] 5.8 Add tests: verify delineation result correctly replaces both legacy column reads

- [x] Task 6: withTransaction Helper (AC: 6)
  - [x] 6.1 Create `apps/server/src/lib/transaction.ts`:
    - Export `TxHandle` type (reuse from `loanTransitionService.ts` if already exported, or define as `Parameters<Parameters<typeof db.transaction>[0]>[0]`)
    - Export `withTransaction<T>(fn: (tx: TxHandle) => Promise<T>, existingTx?: TxHandle): Promise<T>` — if `existingTx` provided, runs `fn(existingTx)` directly; otherwise wraps in `db.transaction()`
  - [x] 6.2 Migrate `loanTransitionService.ts` to use `withTransaction` — replace inline pattern, keep the `existingTx` parameter on `transitionLoan()`
  - [x] 6.3 Migrate 3 highest-risk transaction blocks to `withTransaction`: `employmentEventService.ts` (3 blocks — most tx bugs in retro), `submissionService.ts` (1 block), `historicalSubmissionService.ts` (2 blocks)
  - [x] 6.4 Add JSDoc on `withTransaction` documenting: purpose, composability pattern, error handling (Drizzle auto-rollback on throw)
  - [x] 6.5 Add test for `withTransaction`: verify it runs in existing tx when provided, opens new tx when not, rolls back on error
  - [x] 6.6 Leave remaining 15 transaction blocks for future migration (incremental adoption, not big-bang)

- [x] Task 7: Express 5 param() Retrofit (AC: 7)
  - [x] 7.1 Update `observationRoutes.ts`: replace 3 instances of `req.params.id as string` with `param(req.params.id)`, add `import { param } from '../lib/params'`
  - [x] 7.2 Grep entire `apps/server/src/routes/` for any remaining `req.params.` without `param()` — fix any found
  - [x] 7.3 Add ESLint rule or comment convention to prevent future `req.params.x as string` patterns

- [x] Task 8: Event Enum Exhaustiveness Guard (AC: 8)
  - [x] 8.1 Update `EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP` in `eventTypeMapping.ts`: add `satisfies Record<EventFlagType, EmploymentEventType | EmploymentEventType[] | null>` constraint
  - [x] 8.2 Add `TERMINATION: null` entry to the mapping with comment: `// DEPRECATED — retained for compile-time exhaustiveness only. Application validation rejects TERMINATION before this mapping is reached.`
  - [x] 8.3 Add compile-time exhaustiveness test: verify all `EventFlagType` values have a mapping entry
  - [x] 8.4 Consider adding `_assertNever()` utility to `packages/shared/src/` for switch-based exhaustiveness checks in future code

- [x] Task 9: Full Test Suite Verification (AC: all)
  - [x] 9.1 Run `pnpm typecheck` — zero type errors
  - [x] 9.2 Run `pnpm lint` — zero lint errors
  - [x] 9.3 Run server tests: `pnpm --filter @vlprs/server test` — all 1,186+ tests pass
  - [x] 9.4 Run client tests: `pnpm --filter @vlprs/client test` — all 585+ tests pass
  - [x] 9.5 Verify zero regressions — no existing test should break

- [x] Review Follow-ups (AI) — Code Review 2026-03-21
  - [x] [AI-Review][HIGH] H1: Remove residual `as EventFlagType` cast at `SubmissionDetailPage.tsx:271` — AC 4 requires all callsite casts removed [apps/client/src/pages/dashboard/SubmissionDetailPage.tsx:271]
  - [x] [AI-Review][HIGH] H2: Extract inline response schema from `reconciliationRoutes.ts:52` into `reconciliationSchemas.ts` — response schemas must be defined centrally, not inlined [apps/server/src/routes/reconciliationRoutes.ts:52]
  - [x] [AI-Review][HIGH] H3: Fix scheme-fund endpoint envelope — returns `{ success, fundTotal }` instead of standard `{ success, data: { fundTotal } }`, causing `apiClient` to return `undefined` since it unwraps `body.data` [apps/server/src/routes/dashboardRoutes.ts:233-244]
  - [x] [AI-Review][MEDIUM] M1: `ActiveEventFlagType` is a no-op `Exclude` — add documentation comment explaining equivalence since `EventFlagType` already excludes TERMINATION [packages/shared/src/types/submission.ts:19]
  - [x] [AI-Review][MEDIUM] M2: AC 8 TERMINATION mapping not in `EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP` — add documentation comment explaining exclusion at type level [packages/shared/src/constants/eventTypeMapping.ts:13]
  - [x] [AI-Review][MEDIUM] M3: `ValidationResult.multiMda.hasMultiMda` type still in `migration.ts` — add documentation comment noting backward-compat computation from `delineationResult` [packages/shared/src/types/migration.ts:181]
  - [x] [AI-Review][LOW] L1: Drizzle auto-generated files missing from story File List — `drizzle/meta/_journal.json` (modified) and `drizzle/meta/0024_snapshot.json` (new) [story file]
  - [x] [AI-Review][LOW] L2: `loanTransitions.test.ts:5-8` hardcodes all 11 statuses instead of importing `LOAN_STATUS_VALUES` — violates single-source-of-truth from AC 1 [packages/shared/src/constants/loanTransitions.test.ts:5-8]

## Dev Notes

### Technical Requirements

#### Item #2: LOAN_STATUS_VALUES — Single Source of Truth

**Current state — 3 sources of truth:**

| Location | Values | Status |
|----------|--------|--------|
| `schema.ts:84-88` (DB enum) | 11 values | Correct — authoritative for DB |
| `loanSchemas.ts:3` (Zod validator) | **6 values** | **STALE** — missing RETIRED, DECEASED, SUSPENDED, LWOP, TRANSFER_PENDING |
| `loan.ts:4` (TypeScript type) | 11 values | Correct — union type |

**Bug risk:** The stale Zod validator in `loanSchemas.ts` currently rejects valid transitions to newer statuses (RETIRED, DECEASED, etc.) because `searchLoansQuerySchema.status` and `transitionLoanSchema.toStatus` use the outdated 6-value array.

**Canonical location:** Create `packages/shared/src/constants/loanStatuses.ts` following the pattern of existing constants files (`roles.ts`, `tiers.ts`, `loanTransitions.ts`).

**Implementation pattern:**
```typescript
// packages/shared/src/constants/loanStatuses.ts
export const LOAN_STATUS_VALUES = [
  'APPLIED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'TRANSFERRED',
  'WRITTEN_OFF', 'RETIRED', 'DECEASED', 'SUSPENDED', 'LWOP', 'TRANSFER_PENDING',
] as const;

export type LoanStatusValue = (typeof LOAN_STATUS_VALUES)[number];
```

Then in `loanSchemas.ts`:
```typescript
import { LOAN_STATUS_VALUES } from '../constants/loanStatuses';
// DELETE: const LOAN_STATUS_VALUES = ['APPLIED', ...] as const;
// USE: z.enum(LOAN_STATUS_VALUES) — now always in sync
```

**Files to modify:**
- `packages/shared/src/constants/loanStatuses.ts` — NEW
- `packages/shared/src/validators/loanSchemas.ts:3` — delete hardcoded array, import from constants
- `packages/shared/src/types/loan.ts:4` — derive from or align with `LoanStatusValue`
- `packages/shared/src/index.ts` — add export
- `apps/server/src/db/schema.ts:84` — add cross-reference comment
- `apps/client/src/pages/dashboard/LoanDetailPage.tsx:17` — `LOAN_STATUS_MAP` can use imported constant

#### Item #9: Zod Response Validation — Establish Pattern

**Current state:** 86 endpoints, zero response validation. Request validation well-established via `validate.ts` middleware.

**Scope for this story:** Establish the pattern + apply to 12 high-risk endpoints (5 dashboard + 2 reconciliation + 5 submission). NOT all 86 (incremental adoption).

**3-mode behavior:**
- **Dev mode** (`NODE_ENV === 'development'`): Log warning with schema violations, still send response
- **Test mode** (`NODE_ENV === 'test'`): Throw `AppError(500, 'RESPONSE_VALIDATION_ERROR')` — breaks tests if response shape drifts
- **Production** (`NODE_ENV === 'production'`): Pass through unchanged — safety net, not a blocker for users

**Existing response schemas (ready to use):**
- `dashboardSchemas.ts` — `dashboardMetricsSchema`, `attentionItemsResponseSchema`, `complianceResponseSchema`
- `reconciliationSchemas.ts` — `reconciliationSummarySchema`

**New schemas needed:**
- `submissionSchemas.ts` — add response schemas for upload confirmation, submission list, submission detail

**Middleware implementation:**
```typescript
// apps/server/src/middleware/validateResponse.ts
export function validateResponse<T>(schema: z.ZodType<T>) {
  return (_req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const result = schema.safeParse(body);
      if (!result.success) {
        if (process.env.NODE_ENV === 'test') {
          throw new AppError(500, 'RESPONSE_VALIDATION_ERROR', 'Response failed schema validation');
        }
        console.warn('[validateResponse] Schema violation:', result.error.issues);
      }
      return originalJson(body);
    } as typeof res.json;
    next();
  };
}
```

**DO NOT intercept `res.status().json()` separately** — Express chains internally, the `.json()` override handles all cases.

#### Item #15: TERMINATION Dead Enum Value

**Current state:** `TERMINATION` exists in `eventFlagTypeEnum` (schema.ts:550) but is excluded from `EVENT_FLAG_VALUES` (submissionSchemas.ts:3-7). Zero business logic references. Test explicitly rejects it (submissionSchemas.test.ts:175).

**Why it stays in DB enum:** PostgreSQL does not support `ALTER TYPE ... DROP VALUE`. Removing it would require dropping and recreating the entire enum type, which is disruptive and unnecessary.

**Action:** Document the exclusion with schema comments + create `ActiveEventFlagType` branded type for business logic signatures.

#### Item #18: EVENT_FLAG_LABELS Unsafe Cast

**Current state:** `vocabulary.ts:312-324` uses `as Record<string, string>`. Two callsites add their own `as Record<string, string>` casts.

**Fix:** Replace `as Record<string, string>` with `satisfies Record<ActiveEventFlagType, string>` — TypeScript's `satisfies` operator provides compile-time exhaustiveness checking while preserving the narrow literal types.

**Important:** The `satisfies` constraint must use `ActiveEventFlagType` (excluding TERMINATION), not the full `EventFlagType`, because TERMINATION has no label entry.

#### Item #21: Redundant hasMultiMda + multiMdaBoundaries Columns

**Current state on `migration_uploads` table:**
- `hasMultiMda: boolean` — duplicates `delineationResult.delineated`
- `multiMdaBoundaries: jsonb` — flattened subset of `delineationResult.sections`
- `delineationResult: jsonb` — full source of truth

**Write locations:**
- `fileDelineationService.ts:413,465-474` — writes all 3 columns (redundant writes)
- `migrationValidationService.ts:343-344` — writes `hasMultiMda` + `multiMdaBoundaries` via legacy `detectMultiMda()` but does NOT write `delineationResult`

**Read locations:**
- `migrationValidationService.ts:343-344,448-449` — reads `hasMultiMda` + `multiMdaBoundaries`
- `fileDelineationService.ts:40-52,323-334` — reads `delineationResult`
- `ValidationSummaryCard.tsx` — receives `multiMda: { hasMultiMda, boundaries }`

**Consolidation path:**
1. Update `migrationValidationService.ts` to write `delineationResult` (full JSONB) instead of legacy columns
2. Update all reads to derive from `delineationResult`
3. Update frontend to adapt to new response shape
4. Generate migration to drop the 2 columns
5. Remove from schema.ts

**Migration safety:** Generate NEW Drizzle migration. Next available number is 0024+. Never re-run existing migrations.

#### withTransaction Helper

**Current state:** 21 inline `db.transaction()` blocks across 13 services. The `transitionLoan` function in `loanTransitionService.ts` already implements the optional `existingTx` composability pattern.

**Existing TxHandle type:** Defined at `loanTransitionService.ts:12` — reuse or centralize.

**Scope for this story:** Create the helper + migrate 6 highest-risk blocks (employmentEventService: 3, submissionService: 1, historicalSubmissionService: 2). Leave the remaining 15 for incremental adoption.

**Design:**
```typescript
// apps/server/src/lib/transaction.ts
import { db } from '../db';

export type TxHandle = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withTransaction<T>(
  fn: (tx: TxHandle) => Promise<T>,
  existingTx?: TxHandle,
): Promise<T> {
  if (existingTx) return fn(existingTx);
  return db.transaction(fn);
}
```

**DO NOT modify Drizzle's rollback behavior** — Drizzle auto-rolls back on thrown errors. The helper preserves this.

#### Express 5 param() Retrofit

**Current state:** Helper at `apps/server/src/lib/params.ts`. 14 of 15 route files already use it. Only `observationRoutes.ts` needs retrofit (3 instances of `req.params.id as string`).

**Minimal change:** Add import + replace 3 lines in `observationRoutes.ts`.

#### Event Enum Exhaustiveness

**Current state:** `EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP` in `eventTypeMapping.ts:13-28` maps 11 of 12 EventFlagType values. TERMINATION is missing (no entry). The `Record<EventFlagType, ...>` type annotation doesn't enforce completeness because it's a type assertion, not a constraint.

**Fix:** Add `satisfies Record<EventFlagType, ...>` — this forces the compiler to verify every EventFlagType key has an entry. Add `TERMINATION: null` with deprecation comment.

### Architecture Compliance

- **API envelope:** `{ success: true, data: T }` — response validation schemas must wrap with `apiResponseSchema(dataSchema)`
- **Middleware pattern:** `validateResponse()` follows same Express middleware pattern as `validate()` and `validateQuery()`
- **Shared package:** All type constants in `packages/shared/src/constants/`, all Zod schemas in `packages/shared/src/validators/`
- **Drizzle migrations:** NEW migration for column drops — next available 0024+
- **Transaction helper:** `apps/server/src/lib/transaction.ts` follows existing lib pattern (jwt.ts, password.ts, params.ts)

### Library & Framework Requirements

- **No new dependencies** — all tools already in the monorepo
- **TypeScript `satisfies`:** Requires TS 4.9+ — project uses `^5.7.3` (confirmed)
- **Zod:** Already in shared package and server
- **Drizzle-kit:** For migration generation

### File Structure Requirements

#### New Files

```
packages/shared/src/
├── constants/loanStatuses.ts                          ← NEW: canonical LOAN_STATUS_VALUES + LoanStatusValue type
└── validators/apiSchemas.ts                           ← NEW: apiResponseSchema(dataSchema) envelope wrapper

apps/server/src/
├── middleware/validateResponse.ts                     ← NEW: response validation middleware (3-mode: dev/test/prod)
├── middleware/validateResponse.test.ts                ← NEW: middleware unit tests
└── lib/transaction.ts                                 ← NEW: withTransaction helper + TxHandle type
```

#### Modified Files

```
packages/shared/src/
├── constants/eventTypeMapping.ts                      ← MODIFY: add satisfies constraint + TERMINATION: null entry
├── constants/vocabulary.ts                            ← MODIFY: replace as Record<string,string> with satisfies on EVENT_FLAG_LABELS
├── types/loan.ts                                      ← MODIFY: derive LoanStatus from LoanStatusValue
├── types/submission.ts                                ← MODIFY: add ActiveEventFlagType = Exclude<EventFlagType, 'TERMINATION'>
├── validators/loanSchemas.ts                          ← MODIFY: delete hardcoded array, import LOAN_STATUS_VALUES
├── validators/submissionSchemas.ts                    ← MODIFY: add response schemas for submission endpoints
├── index.ts                                           ← MODIFY: add exports for new constants/types

apps/server/src/
├── db/schema.ts                                       ← MODIFY: drop hasMultiMda + multiMdaBoundaries columns, add TERMINATION doc comment
├── routes/dashboardRoutes.ts                          ← MODIFY: add validateResponse middleware to 5 endpoints
├── routes/reconciliationRoutes.ts                     ← MODIFY: add validateResponse middleware to 2 endpoints
├── routes/submissionRoutes.ts                         ← MODIFY: add validateResponse middleware to 5 endpoints
├── routes/observationRoutes.ts                        ← MODIFY: replace 3x req.params.id as string with param()
├── services/migrationValidationService.ts             ← MODIFY: write delineationResult instead of hasMultiMda/multiMdaBoundaries
├── services/fileDelineationService.ts                 ← MODIFY: stop writing redundant columns
├── services/loanTransitionService.ts                  ← MODIFY: import TxHandle from lib/transaction.ts, use withTransaction
├── services/employmentEventService.ts                 ← MODIFY: use withTransaction for 3 tx blocks
├── services/submissionService.ts                      ← MODIFY: use withTransaction for 1 tx block
├── services/historicalSubmissionService.ts             ← MODIFY: use withTransaction for 2 tx blocks

apps/server/drizzle/
└── 0024_*.sql                                         ← NEW: migration to drop has_multi_mda + multi_mda_boundaries columns

apps/client/src/
├── pages/dashboard/LoanDetailPage.tsx                 ← MODIFY: use imported LOAN_STATUS_VALUES for exhaustiveness
├── pages/dashboard/SubmissionDetailPage.tsx            ← MODIFY: remove as Record<string,string> cast on EVENT_FLAG_LABELS
├── pages/dashboard/components/ManualEntryRow.tsx       ← MODIFY: remove as Record<string,string> cast
├── pages/dashboard/components/ValidationSummaryCard.tsx ← MODIFY: adapt to delineationResult shape
```

### Testing Requirements

- **Co-locate tests:** `validateResponse.test.ts` next to `validateResponse.ts`
- **LOAN_STATUS_VALUES test:** Runtime check that constant matches DB enum values
- **validateResponse tests:** Schema violation → 500 in test mode, valid response passes through
- **withTransaction tests:** Runs in existing tx when provided, opens new when not, rolls back on error
- **Exhaustiveness tests:** Compile-time verification that all enum values have mapping entries
- **Column drop test:** Verify migration applies cleanly, existing queries work without dropped columns
- **Full suite:** All 1,186+ server tests + 585+ client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.0a (Financial Precision Hardening — Previous in Sequence)

- **Status:** in-progress (as of 2026-03-20)
- **Relevant pattern:** Story 7.0a adds `computeBalanceForLoan()` wrapper that takes a loan object — may need `limitedComputation` flag in types
- **decimal.js on client:** 7.0a adds decimal.js to client package.json — 7.0b should assume this is done
- **No schema changes in 7.0a:** 7.0b's migration (0024) won't conflict

#### From Mega-Retro Team Agreements

1. **File list verification** — code review checklist item. Accurate file list required
2. **Zero-debt-forward** — this IS the debt resolution story
3. **Red-green review check** — reviewer verifies tests fail when implementation removed
4. **Transaction scope documentation** — dev notes must state tx boundaries for DB-write stories. The `withTransaction` helper is the structural enforcement of this agreement
5. **N+1 query budget** — response validation middleware must not add queries

#### From Story 11.4 (Last Completed Story)

- **Express 5 param() already used:** `historicalSubmissionRoutes.ts` uses `param()` — pattern is established
- **JSONB patterns:** `historical_reconciliation` JSONB on `mda_submissions` — same JSONB-consolidation pattern applies to delineationResult
- **Zod schemas in shared:** `historicalSubmissionSchemas.ts` — request-only validation, no response validation (consistent with tech debt)

### Commit Ordering Guidance

This story's 8 ACs cluster into two independent groups that can be committed separately for safer rollback:

**Commit Group A — Type Safety (compile-time only, zero runtime changes):**
Tasks 1, 3, 4, 8 → LOAN_STATUS_VALUES, TERMINATION guard, EVENT_FLAG_LABELS satisfies, enum exhaustiveness

**Commit Group B — Runtime Contracts & Infrastructure:**
Tasks 2, 6, 7 → response validation middleware, withTransaction helper, param() retrofit

**Commit Group C — DB Migration (irreversible, commit last):**
Task 5 → column consolidation + Drizzle migration

**Recommended order:** A → B → C → Task 9 (full verification). If the column drop in Group C encounters issues, Groups A and B are already safely landed. Task 9 runs after all groups.

### Git Intelligence

**Recent commit pattern:** `feat: Story 7.0a — Financial Precision Hardening with code review fixes`
**Expected commit:** `feat: Story 7.0b — Type Safety & Schema Contracts with code review fixes`

### Critical Warnings

1. **LOAN_STATUS_VALUES stale validator is a REAL BUG** — the Zod validator in `loanSchemas.ts` only has 6 of 11 values. Transitions to RETIRED/DECEASED/SUSPENDED/LWOP/TRANSFER_PENDING will fail Zod validation. Fix immediately in Task 1
2. **Drizzle migration for column drops:** Generate NEW migration (0024+). Test that `migrationValidationService` and `fileDelineationService` work without the dropped columns BEFORE generating the migration. Never re-run existing migrations
3. **validateResponse in production is PASS-THROUGH** — never block user requests in production due to schema drift. Only enforce in test mode. Dev mode logs warnings
4. **withTransaction scope:** Only migrate 6 of 21 blocks in this story. Remaining 15 can adopt incrementally. Do NOT do a big-bang migration
5. **EVENT_FLAG_LABELS satisfies requires ActiveEventFlagType** (excluding TERMINATION), not full EventFlagType — because TERMINATION has no label entry and shouldn't
6. **satisfies vs as:** `satisfies` preserves the narrow literal types while checking conformance. `as` erases them. Use `satisfies` everywhere in this story
7. **Do not modify EVENT_FLAG_VALUES array** — it already correctly excludes TERMINATION. Only add TypeScript-level guards
8. **Column drop migration is irreversible** — ensure all reads are updated before dropping. Test the complete flow: upload → validate → delineate → confirm, all reading from `delineationResult` only
9. **TxHandle centralization:** If `loanTransitionService.ts` already exports `TxHandle`, import it into the new `transaction.ts` to avoid duplication. If it's inline, move it to `transaction.ts` and re-export from `loanTransitionService.ts` for backward compatibility

### Project Structure Notes

- This story touches all 3 layers (shared constants/types/validators, server middleware/services/routes, client components) and adds 1 database migration
- The response validation pattern is designed for incremental adoption — 12 endpoints in this story, remaining 74 can be added as teams encounter drift
- The `withTransaction` helper follows the existing `apps/server/src/lib/` utility pattern alongside `params.ts`, `jwt.ts`, `password.ts`
- Column consolidation (Task 5) is the only task with a database migration — all other tasks are code-level changes

### References

- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Tech Debt Inventory] — Items #2, #9, #15, #18, #21, withTransaction, param() retrofit, enum exhaustiveness
- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0b] — User story, 8 items, theme statement
- [Source: packages/shared/src/validators/loanSchemas.ts:3] — Stale LOAN_STATUS_VALUES (6 of 11)
- [Source: packages/shared/src/types/loan.ts:4] — LoanStatus union type (11 values, correct)
- [Source: apps/server/src/db/schema.ts:84-88] — loanStatusEnum pgEnum definition (11 values)
- [Source: apps/server/src/db/schema.ts:546-552] — eventFlagTypeEnum with TERMINATION
- [Source: apps/server/src/db/schema.ts:301-303] — hasMultiMda, multiMdaBoundaries, delineationResult columns
- [Source: apps/server/src/middleware/validate.ts] — Existing request validation middleware (model for response validation)
- [Source: packages/shared/src/validators/dashboardSchemas.ts] — Existing response schemas (unused, ready for validateResponse)
- [Source: packages/shared/src/validators/reconciliationSchemas.ts] — Existing response schemas
- [Source: packages/shared/src/constants/vocabulary.ts:312-324] — EVENT_FLAG_LABELS with unsafe cast
- [Source: packages/shared/src/constants/eventTypeMapping.ts:13-28] — EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP (missing exhaustiveness)
- [Source: packages/shared/src/validators/submissionSchemas.ts:3-7] — EVENT_FLAG_VALUES (excludes TERMINATION, correct)
- [Source: apps/server/src/lib/params.ts] — param() helper definition
- [Source: apps/server/src/routes/observationRoutes.ts:79,95,111] — 3 instances needing param() retrofit
- [Source: apps/server/src/services/loanTransitionService.ts:12,90-102] — TxHandle type + existingTx pattern
- [Source: apps/server/src/services/fileDelineationService.ts:413,465-474] — Redundant column writes
- [Source: apps/server/src/services/migrationValidationService.ts:343-344] — Legacy column writes
- [Source: apps/client/src/pages/dashboard/SubmissionDetailPage.tsx:20] — EVENT_FLAG_LABELS cast
- [Source: apps/client/src/pages/dashboard/components/ManualEntryRow.tsx:188] — EVENT_FLAG_LABELS cast
- [Source: apps/client/src/pages/dashboard/components/ValidationSummaryCard.tsx] — Multi-MDA frontend component
- [Source: apps/client/src/pages/dashboard/LoanDetailPage.tsx:17] — LOAN_STATUS_MAP

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- validateResponse middleware initially threw on 4xx error responses (status check fix required)
- mdaBreakdownRowSchema.statusDistribution had wrong fields (active/completed/other → completed/onTrack/overdue/stalled/overDeducted)
- Migration 0024 needed to be applied to test DB before migration count test could pass

### Completion Notes List

- **Task 1 (AC 1):** Created `LOAN_STATUS_VALUES` canonical constant with all 11 values. Fixed stale 6-value Zod validator in `loanSchemas.ts`. Derived `LoanStatus` type from constant. Added `satisfies` exhaustiveness check on `LoanDetailPage.tsx` LOAN_STATUS_MAP.
- **Task 2 (AC 2):** Created `validateResponse()` middleware with 3-mode behavior (dev: warn, test: throw, prod: pass). Only validates 2xx responses. Applied to 12 endpoints (5 dashboard, 2 reconciliation, 5 submission). Created `apiResponseSchema()` envelope helper. Created response schemas for breakdown, scheme-fund, submission upload/list/detail.
- **Task 3 (AC 3):** Enhanced TERMINATION deprecation comment in schema.ts. Created `ActiveEventFlagType = Exclude<EventFlagType, 'TERMINATION'>`. Added compile-time exhaustiveness test verifying EVENT_FLAG_VALUES matches ActiveEventFlagType.
- **Task 4 (AC 4):** Replaced `as Record<string, string>` on EVENT_FLAG_LABELS with `satisfies Record<ActiveEventFlagType, string>`. Removed unsafe casts from SubmissionDetailPage.tsx and ManualEntryRow.tsx.
- **Task 5 (AC 5):** Consolidated hasMultiMda + multiMdaBoundaries into delineationResult. Updated migrationValidationService writes/reads, fileDelineationService writes. Generated migration 0024 to drop columns. Frontend unchanged (API response shape preserved).
- **Task 6 (AC 6):** Created `withTransaction()` helper with composable `existingTx` parameter. Centralized TxHandle type. Migrated 6 blocks: loanTransitionService (1), employmentEventService (3), submissionService (1), historicalSubmissionService (2). 15 remaining blocks left for incremental adoption.
- **Task 7 (AC 7):** Retrofitted 3 instances in observationRoutes.ts from `req.params.id as string` to `param(req.params.id)`. Verified zero remaining unsafe param casts across all route files.
- **Task 8 (AC 8):** Changed EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP from type annotation to `satisfies Record<EventFlagType, ...>` for compile-time exhaustiveness.
- **Task 9 (AC all):** Typecheck: 0 errors. Lint: 0 errors. Server: 1,223 tests pass. Client: 585 tests pass. Zero regressions.

### File List

#### New Files
- `packages/shared/src/constants/loanStatuses.ts` — canonical LOAN_STATUS_VALUES + LoanStatusValue type
- `packages/shared/src/constants/loanStatuses.test.ts` — runtime alignment tests
- `packages/shared/src/constants/eventFlagGuard.test.ts` — exhaustiveness tests for EVENT_FLAG_VALUES
- `packages/shared/src/validators/apiSchemas.ts` — apiResponseSchema envelope wrapper
- `apps/server/src/middleware/validateResponse.ts` — response validation middleware (3-mode)
- `apps/server/src/middleware/validateResponse.test.ts` — middleware unit tests
- `apps/server/src/lib/transaction.ts` — withTransaction helper + TxHandle type
- `apps/server/src/lib/transaction.test.ts` — transaction helper tests
- `apps/server/drizzle/0024_robust_darkhawk.sql` — migration: drop has_multi_mda + multi_mda_boundaries
- `apps/server/drizzle/meta/0024_snapshot.json` — Drizzle auto-generated migration snapshot
- `apps/server/drizzle/meta/_journal.json` — Drizzle auto-generated migration journal (modified)

#### Modified Files
- `packages/shared/src/constants/eventTypeMapping.ts` — satisfies constraint
- `packages/shared/src/constants/vocabulary.ts` — satisfies on EVENT_FLAG_LABELS, removed unsafe cast
- `packages/shared/src/types/loan.ts` — derive LoanStatus from LoanStatusValue
- `packages/shared/src/types/submission.ts` — added ActiveEventFlagType
- `packages/shared/src/validators/loanSchemas.ts` — import LOAN_STATUS_VALUES from constants
- `packages/shared/src/validators/submissionSchemas.ts` — added response schemas
- `packages/shared/src/validators/dashboardSchemas.ts` — added breakdown + scheme-fund response schemas
- `packages/shared/src/index.ts` — added new exports
- `apps/server/src/db/schema.ts` — dropped hasMultiMda + multiMdaBoundaries columns, added comments
- `apps/server/src/routes/dashboardRoutes.ts` — added validateResponse to 5 endpoints
- `apps/server/src/routes/reconciliationRoutes.ts` — added validateResponse to 2 endpoints
- `apps/server/src/routes/submissionRoutes.ts` — added validateResponse to 5 endpoints
- `apps/server/src/routes/observationRoutes.ts` — param() retrofit (3 instances)
- `apps/server/src/services/migrationValidationService.ts` — write delineationResult, read from delineationResult
- `apps/server/src/services/fileDelineationService.ts` — stopped writing redundant columns
- `apps/server/src/services/loanTransitionService.ts` — use withTransaction, re-export TxHandle
- `apps/server/src/services/employmentEventService.ts` — use withTransaction (3 blocks)
- `apps/server/src/services/submissionService.ts` — use withTransaction (1 block)
- `apps/server/src/services/historicalSubmissionService.ts` — use withTransaction (2 blocks)
- `apps/client/src/pages/dashboard/LoanDetailPage.tsx` — satisfies on LOAN_STATUS_MAP
- `apps/client/src/pages/dashboard/SubmissionDetailPage.tsx` — removed unsafe cast
- `apps/client/src/pages/dashboard/components/ManualEntryRow.tsx` — removed unsafe cast
- `apps/client/src/pages/dashboard/components/SchemeFundDialog.tsx` — fixed mutation type to match apiClient envelope unwrapping
- `packages/shared/src/constants/loanTransitions.test.ts` — import LOAN_STATUS_VALUES instead of hardcoded array
- `packages/shared/src/types/migration.ts` — added backward-compat documentation on ValidationResult.multiMda
- `packages/shared/src/validators/reconciliationSchemas.ts` — added resolveDiscrepancyResponseSchema

### Change Log

- 2026-03-21: Story 7.0b implemented — 8 ACs covering type safety consolidation (LOAN_STATUS_VALUES, TERMINATION guard, EVENT_FLAG_LABELS satisfies, event enum exhaustiveness), runtime contracts (validateResponse middleware on 12 endpoints, withTransaction helper migrated to 6 blocks), Express 5 param() retrofit, and redundant column consolidation (has_multi_mda + multi_mda_boundaries dropped via migration 0024)
- 2026-03-21: Code review fixes — H1: removed residual EventFlagType cast in SubmissionDetailPage. H2: extracted inline schema from reconciliationRoutes into reconciliationSchemas. H3: fixed scheme-fund endpoint to use standard API envelope (was returning non-standard shape causing apiClient to return undefined). M1-M3: added documentation comments on ActiveEventFlagType, eventTypeMapping, and ValidationResult. L1: added Drizzle auto-generated files to File List. L2: imported LOAN_STATUS_VALUES in loanTransitions.test.ts
- 2026-03-21: **Post-deploy hotfix** — Server crash-loop in production caused by missing `.js` extension on ESM import in `loanSchemas.ts` (`from '../constants/loanStatuses'`). Root cause: `tsconfig.base.json` uses `"moduleResolution": "bundler"` which accepts bare imports that Node.js ESM rejects at runtime. Fix: added `.js` extension to the broken import. Prevention: overrode shared package tsconfig to `"module": "nodenext"` / `"moduleResolution": "nodenext"` — TypeScript now enforces `.js` extensions at compile time, making bare imports a build error instead of a production crash. Also fixed 6 other bare type-only imports for consistency, tightened Docker health check intervals (30s→10s), and replaced fragile fixed-sleep CI health check with a retry loop (12×15s).
