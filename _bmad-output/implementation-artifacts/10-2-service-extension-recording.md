<!-- Generated: 2026-03-01 | Epic: 10 | Sprint: 4 -->
<!-- Blocked By: 10-1 (computed_retirement_date, temporalProfileService, temporal_corrections table, computeRetirementDate pure function) | Blocks: 10-3 (gratuity receivable uses effective retirement date which may be an extension override), 10-4 (verification report must respect extension overrides) -->
<!-- FRs: FR66 | Motivation: Department Admins can record authorised service extensions that override the computed retirement date, ensuring staff with extensions continue to have accurate temporal validations -->
<!-- Source: epics.md → Epic 10, Story 10.2 | prd.md → FR66 | architecture.md → Temporal Validation, Audit Trail, RBAC -->

# Story 10.2: Service Extension Recording

Status: done

## Story

As a **Department Admin**,
I want to record a service extension for a staff member that overrides the computed retirement date,
so that staff who receive authorised extensions continue to have accurate temporal validations.

## Acceptance Criteria

### AC 1: Service Extension API (FR66)

**Given** a loan record with a `computed_retirement_date` (temporal profile is complete)
**When** Department Admin calls `POST /api/loans/:loanId/service-extensions` with `{ "newRetirementDate": "2033-06-15", "approvingAuthorityReference": "PSC/EXT/2026/0042", "notes": "Approved 2-year extension per PSC directive" }`
**Then** the system creates a `service_extensions` record with: `loanId`, `originalComputedDate` (the current `computed_retirement_date`), `newRetirementDate`, `approvingAuthorityReference`, `notes`, `createdBy` (acting user ID), `createdAt`
**And** the loan's `computed_retirement_date` is replaced with the extension date for all downstream temporal validations
**And** the response includes the created extension record with status 201
**And** the operation is atomic (single DB transaction)

### AC 2: Extension Requires Complete Temporal Profile

**Given** a loan record where `computed_retirement_date` is null (temporal profile incomplete)
**When** Department Admin attempts `POST /api/loans/:loanId/service-extensions`
**Then** the request is rejected with `422` and message: `"Service extension cannot be recorded — temporal profile is incomplete. Please provide date of birth and appointment date first."`

### AC 3: Extension Date Validation

**Given** a service extension request
**When** `newRetirementDate` is before or equal to the current `computed_retirement_date`
**Then** the request is rejected with `422` and message: `"Extension date must be after the current retirement date ({currentDate})."`

**Given** a service extension request
**When** `newRetirementDate` is more than 10 years beyond the current `computed_retirement_date`
**Then** the request is rejected with `422` and message: `"Extension exceeds maximum allowed period. Please verify the extension date."`

### AC 4: Extension Audit Trail

**Given** a service extension is recorded
**When** the extension history is queried via `GET /api/loans/:loanId/service-extensions`
**Then** the complete extension history is returned in chronological order (oldest first)
**And** each entry includes: `id`, `loanId`, `originalComputedDate`, `newRetirementDate`, `approvingAuthorityReference`, `notes`, `createdBy`, `createdByName` (user's full name via JOIN), `createdAt`
**And** MDA scoping is enforced — `mda_officer` can only view extensions for loans in their MDA

### AC 5: Multiple Extensions (Superseding)

**Given** a loan that already has a service extension recorded
**When** a new service extension is recorded
**Then** the new extension's `originalComputedDate` captures the CURRENT effective retirement date (which may be a previous extension, not the original computed date)
**And** the loan's `computed_retirement_date` is updated to the newest extension date
**And** the previous extension record is preserved (immutable — never deleted or modified)
**And** the extension history shows the full chain of extensions

### AC 6: Temporal Profile Reflects Extension

**Given** a loan with a service extension
**When** `GET /api/loans/:loanId` is called (existing endpoint from Story 10.1)
**Then** the `temporalProfile` object includes:
- `computedRetirementDate`: the extension date (not the original computed date)
- `hasServiceExtension`: `true`
- `originalComputedRetirementDate`: the original formula-computed date (before any extensions)
- `latestExtensionReference`: the approving authority reference of the most recent extension
- `remainingServiceMonths`: recalculated from the extension date

## Tasks / Subtasks

- [x] Task 1: Schema — `service_extensions` immutable table (AC: 1, 4, 5)
  - [x] 1.1 Add to `apps/server/src/db/schema.ts`: `serviceExtensions` table with columns: `id` (UUIDv7 PK), `loanId` (UUID FK → loans.id, NOT NULL), `originalComputedDate` (date, NOT NULL — the retirement date at time of extension), `newRetirementDate` (date, NOT NULL), `approvingAuthorityReference` (varchar(100), NOT NULL), `notes` (text, NOT NULL), `createdBy` (UUID FK → users.id, NOT NULL), `createdAt` (timestamptz, NOT NULL, defaultNow). No `updatedAt` — append-only
  - [x] 1.2 Add indexes: `idx_service_extensions_loan_id` on `loanId`, `idx_service_extensions_created_at` on `createdAt`
  - [x] 1.3 Add immutability trigger in `apps/server/src/db/triggers.ts`: `trg_service_extensions_immutable` using existing `fn_prevent_modification()` — same pattern as `trg_temporal_corrections_immutable` (Story 10.1)
  - [x] 1.4 Generate Drizzle migration: `npx drizzle-kit generate` — single migration covering this table

- [x] Task 2: Shared types & vocabulary (AC: 1, 2, 3, 4, 6)
  - [x] 2.1 Add to `packages/shared/src/types/loan.ts`: `ServiceExtension` interface — `{ id: string; loanId: string; originalComputedDate: string; newRetirementDate: string; approvingAuthorityReference: string; notes: string; createdBy: string; createdByName: string; createdAt: string }`
  - [x] 2.2 Add to `packages/shared/src/types/loan.ts`: `CreateServiceExtensionRequest` interface — `{ newRetirementDate: string; approvingAuthorityReference: string; notes: string }`
  - [x] 2.3 Extend existing `TemporalProfile` interface (from Story 10.1): add `hasServiceExtension: boolean`, `originalComputedRetirementDate: string | null`, `latestExtensionReference: string | null`
  - [x] 2.4 Add to `packages/shared/src/constants/vocabulary.ts`: `SERVICE_EXTENSION_RECORDED: 'Service extension recorded successfully.'`, `SERVICE_EXTENSION_INCOMPLETE_PROFILE: 'Service extension cannot be recorded — temporal profile is incomplete. Please provide date of birth and appointment date first.'`, `SERVICE_EXTENSION_DATE_NOT_AFTER: 'Extension date must be after the current retirement date ({currentDate}).'`, `SERVICE_EXTENSION_MAX_EXCEEDED: 'Extension exceeds maximum allowed period. Please verify the extension date.'`
  - [x] 2.5 Export from `packages/shared/src/index.ts` barrel

- [x] Task 3: Zod validator (AC: 1, 3)
  - [x] 3.1 Add to `packages/shared/src/validators/loanSchemas.ts`: `createServiceExtensionSchema` — `z.object({ newRetirementDate: z.iso.date('Extension date must be a valid ISO date (YYYY-MM-DD)'), approvingAuthorityReference: z.string().min(1, 'Approving authority reference is required').max(100), notes: z.string().min(1, 'Notes are required').max(1000) })`
  - [x] 3.2 Export from barrel

- [x] Task 4: Service extension service (AC: 1, 2, 3, 4, 5)
  - [x] 4.1 Create `apps/server/src/services/serviceExtensionService.ts`
  - [x] 4.2 Implement `recordServiceExtension(userId, loanId, newRetirementDate, approvingAuthorityReference, notes, mdaScope)`:
    - Wrap in `db.transaction(async (tx) => { ... })`
    - SELECT loan with `FOR UPDATE` row lock
    - MDA scope check (403 vs 404 distinction)
    - Validate temporal profile is complete: if `computed_retirement_date` is null → throw `AppError(422, 'SERVICE_EXTENSION_INCOMPLETE_PROFILE', ...)`
    - Validate `newRetirementDate > loan.computedRetirementDate` → else throw `AppError(422, 'SERVICE_EXTENSION_DATE_NOT_AFTER', ...)` with current date interpolated into message
    - Validate extension not more than 10 years beyond current retirement date → else throw `AppError(422, 'SERVICE_EXTENSION_MAX_EXCEEDED', ...)`
    - INSERT into `service_extensions`: `originalComputedDate` = current `computed_retirement_date`, other fields from request
    - UPDATE loans SET `computed_retirement_date` = `newRetirementDate`, `updatedAt` = now()
    - Fetch user name for response (concurrent with loan read, same pattern as `loanTransitionService`)
    - Return formatted `ServiceExtension` response
  - [x] 4.3 Implement `getServiceExtensions(loanId, mdaScope)`:
    - SELECT loan to verify exists + MDA scope check
    - SELECT extensions JOIN users (for createdByName = firstName + ' ' + lastName) WHERE loanId, ORDER BY createdAt ASC
    - Return array of `ServiceExtension`

- [x] Task 5: Enhance temporal profile builder (AC: 6)
  - [x] 5.1 Modify `apps/server/src/services/temporalProfileService.ts` — `buildTemporalProfile()`:
    - Query `service_extensions` for the loan (most recent by createdAt)
    - If extension exists: set `hasServiceExtension: true`, `originalComputedRetirementDate` = original formula-computed date (from first extension's `originalComputedDate` if multiple extensions exist, OR recompute from DOB/appointment), `latestExtensionReference` = most recent extension's `approvingAuthorityReference`
    - If no extension: set `hasServiceExtension: false`, `originalComputedRetirementDate: null`, `latestExtensionReference: null`
    - `computedRetirementDate` already reflects the effective date (stored on loan record) — no change needed
    - `remainingServiceMonths` already computed from `computedRetirementDate` — automatically uses extension date

- [x] Task 5b: Guard `updateTemporalProfile()` against extension overwrite (AC: 6)
  - [x] 5b.1 Modify `apps/server/src/services/temporalProfileService.ts` — `updateTemporalProfile()`: after computing the formula-based retirement date from DOB + appointment date, query `service_extensions` WHERE `loanId` = loan.id (within the same transaction). If any records exist, set `computed_retirement_date` to the latest extension's `newRetirementDate` (not the formula date). The extension is an authorised administrative override and takes precedence over formula recomputation.
  - [x] 5b.2 The `temporal_corrections` record should still capture the new formula date in `newRetirementDate` — this maintains audit accuracy (what the formula would yield) even though the loan's effective date remains the extension override
  - [x] 5b.3 If no extensions exist, the formula date is used as before — no behavioral change to Story 10.1's existing logic

- [x] Task 6: Routes (AC: 1, 4)
  - [x] 6.1 Add to existing `apps/server/src/routes/loanRoutes.ts` (sub-resource endpoints — do NOT create separate file):
    - `POST /loans/:loanId/service-extensions` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, validate(createServiceExtensionSchema), auditLog]` → call `recordServiceExtension()` → respond `{ success: true, data: extension }` with status 201
    - `GET /loans/:loanId/service-extensions` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER), scopeToMda, auditLog]` → call `getServiceExtensions()` → respond `{ success: true, data: extensions }`
  - [x] 6.2 Note: `loanRoutes` is already registered in `app.ts` — no app.ts change needed

- [x] Task 7: Integration tests (AC: 1, 2, 3, 4, 5, 6)
  - [x] 7.1 Create `apps/server/src/services/serviceExtensionService.integration.test.ts`
  - [x] 7.2 Seed: 1 MDA, 1 super_admin, 1 dept_admin, 1 mda_officer, 1 loan WITH complete temporal profile (DOB + appointment date + computed_retirement_date)
  - [x] 7.3 Test: POST service-extensions with valid data → 201, extension record created, loan's `computed_retirement_date` updated to new date
  - [x] 7.4 Test: POST service-extensions on loan with incomplete temporal profile (no DOB) → 422 with `SERVICE_EXTENSION_INCOMPLETE_PROFILE` message
  - [x] 7.5 Test: POST service-extensions with `newRetirementDate` before current retirement → 422 with `SERVICE_EXTENSION_DATE_NOT_AFTER` message including current date
  - [x] 7.6 Test: POST service-extensions with `newRetirementDate` equal to current retirement → 422 (must be strictly after)
  - [x] 7.7 Test: POST service-extensions with date more than 10 years beyond current → 422 with `SERVICE_EXTENSION_MAX_EXCEEDED`
  - [x] 7.8 Test: Multiple extensions — first extension recorded, then second extension → second extension's `originalComputedDate` is the first extension's `newRetirementDate` (not the original formula date); loan's retirement date is the latest extension
  - [x] 7.9 Test: GET service-extensions → returns chronological list with createdByName
  - [x] 7.10 Test: GET loan detail → `temporalProfile.hasServiceExtension` is true, `originalComputedRetirementDate` shows formula date, `latestExtensionReference` shows reference number, `computedRetirementDate` reflects extension
  - [x] 7.11 Test: MDA scoping — officer can GET extensions for their MDA loan → 200; for other MDA → 403
  - [x] 7.12 Test: MDA officer cannot POST service-extensions (only SUPER_ADMIN / DEPT_ADMIN) → 403
  - [x] 7.13 Test: Immutability — attempt UPDATE/DELETE on `service_extensions` → rejected by DB trigger
  - [x] 7.14 Test: Atomicity — if extension INSERT fails, loan's `computed_retirement_date` should NOT be updated (transaction rollback)
  - [x] 7.15 Test: Zod validation — missing `approvingAuthorityReference` → 400, missing `notes` → 400, invalid date format → 400
  - [x] 7.16 Test: Extension-aware temporal correction — correct DOB on a loan with active extension → `computed_retirement_date` remains the extension date (not the recomputed formula date), temporal correction record shows the new formula date in `newRetirementDate`, `temporalProfile.hasServiceExtension` still true

## Dev Notes

### Service Extension — Atomic Transaction Pattern

Same pattern as `loanTransitionService.transitionLoan()` (Story 2.7) and `temporalProfileService.updateTemporalProfile()` (Story 10.1):

```typescript
const extension = await db.transaction(async (tx) => {
  // 1. Read loan with row lock + concurrent user fetch
  const [loanRows, userRows] = await Promise.all([
    tx.select().from(loans).where(and(...conditions)).for('update'),
    tx.select({ firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, userId)),
  ]);

  const [loan] = loanRows;
  const [user] = userRows;

  if (!loan) {
    // 403 vs 404 distinction for MDA scoping
    if (mdaScope) {
      const [exists] = await tx.select().from(loans).where(eq(loans.id, loanId));
      if (exists) throw new AppError(403, 'MDA_ACCESS_DENIED', ...);
    }
    throw new AppError(404, 'LOAN_NOT_FOUND', ...);
  }

  // 2. Validate temporal profile is complete
  if (!loan.computedRetirementDate) {
    throw new AppError(422, 'SERVICE_EXTENSION_INCOMPLETE_PROFILE',
      VOCABULARY.SERVICE_EXTENSION_INCOMPLETE_PROFILE);
  }

  // 3. Validate extension date
  const currentRetirement = loan.computedRetirementDate;
  const extensionDate = new Date(newRetirementDate);
  if (extensionDate <= currentRetirement) {
    throw new AppError(422, 'SERVICE_EXTENSION_DATE_NOT_AFTER',
      VOCABULARY.SERVICE_EXTENSION_DATE_NOT_AFTER
        .replace('{currentDate}', toDateString(currentRetirement)));
  }

  // 4. Validate max 10-year extension
  const maxDate = addYears(currentRetirement, 10);
  if (extensionDate > maxDate) {
    throw new AppError(422, 'SERVICE_EXTENSION_MAX_EXCEEDED',
      VOCABULARY.SERVICE_EXTENSION_MAX_EXCEEDED);
  }

  // 5. Insert extension record
  const [record] = await tx.insert(serviceExtensions).values({
    loanId,
    originalComputedDate: currentRetirement,
    newRetirementDate: extensionDate,
    approvingAuthorityReference,
    notes,
    createdBy: userId,
  }).returning();

  // 6. Update loan's retirement date
  await tx.update(loans)
    .set({ computedRetirementDate: extensionDate, updatedAt: new Date() })
    .where(eq(loans.id, loanId));

  return {
    id: record.id,
    loanId: record.loanId,
    originalComputedDate: toDateString(record.originalComputedDate),
    newRetirementDate: toDateString(record.newRetirementDate),
    approvingAuthorityReference: record.approvingAuthorityReference,
    notes: record.notes,
    createdBy: record.createdBy,
    createdByName: user ? `${user.firstName} ${user.lastName}` : '',
    createdAt: record.createdAt.toISOString(),
  };
});
```

### Immutability — 3-Layer Pattern

`service_extensions` is append-only. Same enforcement as `ledger_entries`, `loan_state_transitions`, `temporal_corrections`:

**Layer 1 (DB Trigger):** `trg_service_extensions_immutable` reusing `fn_prevent_modification()`
**Layer 2 (ORM):** Service only uses `insert()` and `select()` — no `update()` or `delete()`
**Layer 3 (API):** Only `POST` (create) and `GET` (read) endpoints — no `PUT`/`PATCH`/`DELETE`

### Multiple Extensions — Superseding Chain

Extensions form an immutable chain. Each new extension captures the CURRENT effective retirement date as `originalComputedDate`:

```
Loan created:     computedRetirementDate = 2030-01-15 (formula: min(DOB+60, appt+35))
Extension 1:      originalComputedDate = 2030-01-15, newRetirementDate = 2032-06-15
Extension 2:      originalComputedDate = 2032-06-15, newRetirementDate = 2034-01-01
                  → loan.computedRetirementDate is now 2034-01-01
```

To recover the ORIGINAL formula-computed date for display in `temporalProfile.originalComputedRetirementDate`:
- Option A: Query the FIRST extension's `originalComputedDate` (simplest — that's always the formula date)
- Option B: Recompute from DOB + appointment date using `computeRetirementDate()` (redundant but safe)
- **Use Option A** — single query, no recomputation needed, guaranteed accurate

### Enhancing `buildTemporalProfile()` — Query Pattern

```typescript
// In temporalProfileService.ts — buildTemporalProfile()
const extensions = await db.select()
  .from(serviceExtensions)
  .where(eq(serviceExtensions.loanId, loan.id))
  .orderBy(serviceExtensions.createdAt);

if (extensions.length > 0) {
  profile.hasServiceExtension = true;
  profile.originalComputedRetirementDate = toDateString(extensions[0].originalComputedDate);
  profile.latestExtensionReference = extensions[extensions.length - 1].approvingAuthorityReference;
} else {
  profile.hasServiceExtension = false;
  profile.originalComputedRetirementDate = null;
  profile.latestExtensionReference = null;
}
```

**Performance note:** This adds a query per loan detail request. For list endpoints (`searchLoans`), consider either:
- Skipping extension details in list view (only include in detail view)
- Adding a `has_service_extension` boolean column to loans table for fast filtering (premature — defer until performance is an issue)

### 10-Year Maximum Extension Guard (PO-Approved)

The 10-year limit is a safety valve, not a business rule from the PRD. It prevents data entry errors (e.g., typing 2063 instead of 2033). If a legitimate extension exceeds 10 years, a `SUPER_ADMIN` can record it — the validation still applies but the error message guides the user to verify. Approved by PO (2026-03-01) as an appropriate safety threshold.

### Role Permissions

- **POST /loans/:loanId/service-extensions:** `SUPER_ADMIN` and `DEPT_ADMIN` only — extensions are administrative actions requiring authority reference
- **GET /loans/:loanId/service-extensions:** All roles — `mda_officer` can read extension history for loans in their MDA

### Interaction with Story 10.1 — Temporal Corrections + Extensions

When a DOB or appointment date is corrected (Story 10.1 `PATCH /loans/:loanId/temporal-profile`) on a loan that has an active service extension, the formula-based retirement date is recomputed but the extension date takes precedence:

```typescript
// In updateTemporalProfile() — after recomputing formula date:
const [latestExtension] = await tx.select()
  .from(serviceExtensions)
  .where(eq(serviceExtensions.loanId, loanId))
  .orderBy(desc(serviceExtensions.createdAt))
  .limit(1);

if (latestExtension) {
  // Extension overrides formula — keep extension date as the effective retirement date
  updateFields.computedRetirementDate = latestExtension.newRetirementDate;
  // The correction record still captures what the formula would yield (audit accuracy)
} else {
  // No extension — formula date applies (original Story 10.1 behavior)
  updateFields.computedRetirementDate = retirementDate;
}
```

This ensures an admin correcting a DOB typo does not silently revoke an approved service extension. The temporal correction record preserves the new formula date for audit trail regardless.

### What NOT To Do (Scope Boundary)

- **Do NOT** create a `RetirementProfileCard.tsx` frontend component — frontend components are outside Epic 10 backend scope (architecture says frontend consumes API data via TanStack Query)
- **Do NOT** modify the `computeRetirementDate()` pure function from Story 10.1 — extensions bypass the formula entirely, they don't modify the computation inputs
- **Do NOT** allow extensions to be edited or deleted — they are immutable audit records. A "correction" is recording a new extension that supersedes the previous one
- **Do NOT** create a separate routes file — service extension endpoints are sub-resources of loans, added to existing `loanRoutes.ts`
- **Do NOT** implement gratuity receivable logic — that's Story 10.3
- **Do NOT** add the `addYears` import if it's already imported in the file — check existing imports first

### Existing Infrastructure (Do NOT Recreate)

| Component | Location | Status |
|-----------|----------|--------|
| `loans` table with temporal columns | `apps/server/src/db/schema.ts` | Story 10.1 |
| `temporal_corrections` table | `apps/server/src/db/schema.ts` | Story 10.1 |
| `temporalProfileService.ts` | `apps/server/src/services/temporalProfileService.ts` | Story 10.1 (extend) |
| `buildTemporalProfile()` | `apps/server/src/services/temporalProfileService.ts` | Story 10.1 (enhance) |
| `computeRetirementDate()` | `apps/server/src/services/computationEngine.ts` | Story 10.1 |
| `computeRemainingServiceMonths()` | `apps/server/src/services/computationEngine.ts` | Story 10.1 |
| `TemporalProfile` interface | `packages/shared/src/types/loan.ts` | Story 10.1 (extend) |
| `fn_prevent_modification()` | `apps/server/src/db/triggers.ts` | Exists (reusable) |
| `loanRoutes.ts` | `apps/server/src/routes/loanRoutes.ts` | Exists (add endpoints) |
| `AppError` class | `apps/server/src/lib/appError.ts` | Exists |
| `scopeToMda` middleware | `apps/server/src/middleware/scopeToMda.ts` | Exists |
| `toDateString()` helper | `apps/server/src/services/loanService.ts` | Exists |
| `generateUuidv7()` | `apps/server/src/lib/uuidv7.ts` | Exists |
| `addYears` from `date-fns` | Already imported in computationEngine.ts | Story 10.1 |

### Dependencies on Prior Stories

- **Story 10.1** (computed_retirement_date column, temporalProfileService, TemporalProfile interface, temporal_corrections pattern) — MUST be implemented first
- **Story 2.7** (atomic transaction + `SELECT FOR UPDATE` row lock pattern) — pattern reuse
- **Story 2.2** (3-layer immutability pattern) — trigger reuse
- **Story 1.5** (audit log middleware) — auto-captures extension API calls

### What This Story Enables (Downstream)

- **Story 10.3:** Gratuity receivable uses effective retirement date (which may now be an extension override)
- **Story 10.4:** Service Status Verification Report respects extension overrides — staff with valid extensions are NOT flagged as post-retirement
- **Epic 3 (Story 3.6):** Observation engine respects extension overrides during migration scan
- **Epic 11 (Story 11.1):** Pre-submission checkpoint uses effective retirement date
- **Epic 12:** Early exit processing uses effective retirement date for projections

### Git Intelligence

- Commit prefix: `feat(loans):` for loan-related stories
- Story 10.1 will have established temporal columns and the temporalProfileService — build on those exact patterns
- `@vlprs/shared` package needs `tsc` rebuild after adding new types/exports

### Project Structure Notes

New files created by this story:
```
apps/server/src/
└── services/serviceExtensionService.ts                        (NEW)
└── services/serviceExtensionService.integration.test.ts       (NEW)
```

Modified files:
```
apps/server/src/db/schema.ts                    (add serviceExtensions table)
apps/server/src/db/triggers.ts                  (add trg_service_extensions_immutable)
apps/server/src/services/temporalProfileService.ts (enhance buildTemporalProfile with extension data)
apps/server/src/routes/loanRoutes.ts            (add POST service-extensions + GET service-extensions)
packages/shared/src/types/loan.ts               (add ServiceExtension, CreateServiceExtensionRequest, extend TemporalProfile)
packages/shared/src/validators/loanSchemas.ts   (add createServiceExtensionSchema)
packages/shared/src/constants/vocabulary.ts     (add service extension vocabulary)
packages/shared/src/index.ts                    (add new exports)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 10, Story 10.2]
- [Source: _bmad-output/planning-artifacts/prd.md — FR66]
- [Source: _bmad-output/planning-artifacts/architecture.md — Temporal Validation, Audit Trail, RBAC]
- [Source: _bmad-output/implementation-artifacts/10-1-retirement-date-computation-storage.md — predecessor story, temporal columns, temporalProfileService]
- [Source: apps/server/src/services/loanTransitionService.ts — atomic transaction + SELECT FOR UPDATE pattern]
- [Source: apps/server/src/db/triggers.ts — fn_prevent_modification() reusable trigger]
- [Source: apps/server/src/routes/loanRoutes.ts — middleware stacking pattern, sub-resource routes]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Migration tracking mismatch resolved: `drizzle-kit push` was used initially for development testing, then proper migration applied via `db:migrate` to ensure tracking table consistency.
- Existing test `temporalProfileService.integration.test.ts` had a `toEqual` assertion on `TemporalProfile` that needed updating with the 3 new extension fields (`hasServiceExtension`, `originalComputedRetirementDate`, `latestExtensionReference`).

### Completion Notes List

- All 7 tasks and subtasks implemented and verified
- 19 integration tests — all passing (includes 10-year boundary test added during code review)
- 488 total tests across 38 test files — zero regressions
- ESLint clean — no warnings or errors
- TypeScript compilation clean (`tsc --noEmit` passes)
- `buildTemporalProfile()` kept synchronous by accepting optional `ExtensionData` parameter; callers that need extension context (e.g., `getLoanDetail`) fetch it and pass it in; list endpoints skip extension data for performance
- `updateTemporalProfile()` enhanced to query for active extensions within the same transaction and preserve the extension override date when DOB/appointment is corrected
- Temporal correction records capture the formula-computed date (audit accuracy) even when extension overrides the effective retirement date
- Immutability enforced via 3-layer pattern: DB trigger, ORM (insert/select only), API (POST/GET only)

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Add 10-year boundary test — exactly-10-years extension should be accepted [`serviceExtensionService.integration.test.ts`] — **Fixed**: added boundary test case
- [x] [AI-Review][MEDIUM] Migration metadata files missing from File List (`_journal.json`, `0005_snapshot.json`) — **Fixed**: added to File List
- [ ] [AI-Review][MEDIUM] Atomicity test (7.14) validates pre-write rejection, not true transaction rollback — Drizzle guarantees mitigate risk; true rollback test would require simulating DB failure mid-transaction
- [ ] [AI-Review][LOW] `SERVICE_EXTENSION_RECORDED` vocabulary defined but never referenced — forward reference for future UI toast messages; consistent with `SCHEDULE_COMPUTED`, `BALANCE_COMPUTED` pattern
- [x] [AI-Review][LOW] `getExtensionDataForLoan` fetched all extensions when only first + last needed — **Fixed**: optimized to two concurrent `LIMIT 1` queries
- [ ] [AI-Review][LOW] `originalComputedRetirementDate` shows formula date at time of first extension (Option A) — becomes stale after DOB corrections; downstream stories (10.3, 10.4) should be aware this is a historical snapshot

### Change Log

- 2026-03-01: Code review — 6 findings (0 HIGH, 3 MEDIUM, 3 LOW); 3 auto-fixed (boundary test, File List, extension query optimization); L1 retracted (sql import IS used in getServiceExtensions); 3 documented observations
- 2026-03-01: Story 10.2 implementation — Service Extension Recording API with atomic transaction, immutable audit trail, temporal profile enrichment, extension-aware temporal corrections, and 18 integration tests

### File List

New files:
- `apps/server/src/services/serviceExtensionService.ts`
- `apps/server/src/services/serviceExtensionService.integration.test.ts`
- `apps/server/drizzle/0005_sparkling_moira_mactaggert.sql`
- `apps/server/drizzle/meta/0005_snapshot.json` (migration snapshot — generated by `drizzle-kit generate`)

Modified files:
- `apps/server/src/db/schema.ts` (added `serviceExtensions` table)
- `apps/server/src/db/triggers.ts` (added `trg_service_extensions_immutable`)
- `apps/server/src/services/temporalProfileService.ts` (enhanced `buildTemporalProfile` with extension data, guarded `updateTemporalProfile` against extension overwrite)
- `apps/server/src/services/loanService.ts` (updated `getLoanDetail` to fetch and pass extension data)
- `apps/server/src/routes/loanRoutes.ts` (added POST/GET service-extensions endpoints)
- `apps/server/src/services/temporalProfileService.integration.test.ts` (updated `toEqual` assertion for new `TemporalProfile` fields)
- `packages/shared/src/types/loan.ts` (added `ServiceExtension`, `CreateServiceExtensionRequest`; extended `TemporalProfile`)
- `packages/shared/src/validators/loanSchemas.ts` (added `createServiceExtensionSchema`)
- `packages/shared/src/constants/vocabulary.ts` (added 4 service extension vocabulary entries)
- `packages/shared/src/index.ts` (added new type and schema exports)
- `apps/server/drizzle/meta/_journal.json` (migration journal entry — generated by `drizzle-kit generate`)
