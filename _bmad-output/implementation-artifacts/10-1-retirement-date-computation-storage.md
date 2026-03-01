<!-- Generated: 2026-03-01 | Epic: 10 | Sprint: 4 -->
<!-- Blocked By: 2-1 (loans table, loanStatusEnum, loanService), 2-7 (loanStateTransitions immutability pattern), 1-5 (audit log middleware) | Blocks: 10-2 (service extension requires computed_retirement_date), 10-3 (gratuity receivable requires retirement date), 10-4 (verification report queries computed_retirement_date) -->
<!-- FRs: FR65 | Motivation: Establish authoritative retirement date computation powering all downstream temporal validations (Epic 3 migration scan, Epic 11 pre-submission checkpoint, Epic 12 early exit) -->
<!-- Source: epics.md → Epic 10, Story 10.1 | prd.md → FR65 | architecture.md → Temporal Validation, Computation Engine, Audit Trail -->

# Story 10.1: Retirement Date Computation & Storage

Status: done

## Story

As a **Department Admin**,
I want the system to compute each staff member's retirement date from their date of birth and date of first appointment,
so that all temporal validations (pre-submission, migration scan, early exit) have an authoritative retirement date.

## Acceptance Criteria

### AC 1: Retirement Date Computation (FR65)

**Given** a loan record with `date_of_birth` and `date_of_first_appointment` fields (both `DATE` type, nullable)
**When** both dates are present
**Then** the system computes retirement date as `min(DOB + 60 years, appointment_date + 35 years)` and stores it as `computed_retirement_date` on the loan record
**And** the response includes which computation path was used (`dob_60` or `appt_35`)

### AC 2: Automatic Recomputation on Date Correction (FR65)

**Given** either `date_of_birth` or `date_of_first_appointment` is corrected (updated)
**When** the correction is saved via `PATCH /api/loans/:loanId/temporal-profile`
**Then** `computed_retirement_date` is recomputed automatically and all downstream temporal validations use the new date
**And** the correction is audit-logged in an immutable `temporal_corrections` table with: `loanId`, `fieldName` (which field changed), `oldValue`, `newValue`, `correctedBy` (user ID), `reason`, `createdAt`
**And** both the loan update and correction record are committed atomically (single DB transaction)

### AC 3: Incomplete Temporal Profile Handling

**Given** a loan record where `date_of_birth` or `date_of_first_appointment` is missing (null)
**When** the loan detail is retrieved via API
**Then** `computed_retirement_date` is `null`
**And** `temporalProfileStatus` returns `"incomplete"` with a message: `"Profile Incomplete — DOB/appointment date required"`
**And** the record is excluded from retirement-based validations until the missing field is provided

### AC 4: Temporal Profile on Loan Detail

**Given** a loan record with complete temporal data
**When** `GET /api/loans/:loanId` is called (existing endpoint, enhanced response)
**Then** the response includes a `temporalProfile` object with: `dateOfBirth`, `dateOfFirstAppointment`, `computedRetirementDate`, `computationMethod` (`dob_60` | `appt_35`), `profileStatus` (`complete` | `incomplete`), `remainingServiceMonths` (computed from today to retirement date, null if incomplete)

### AC 5: Temporal Profile on Loan Creation/Update

**Given** a loan is created or updated via the existing loan API
**When** `date_of_birth` and `date_of_first_appointment` are both provided
**Then** `computed_retirement_date` is automatically computed and stored before the response is returned
**And** if only one date is provided, `computed_retirement_date` remains null and `profileStatus` is `incomplete`

## Tasks / Subtasks

- [x] Task 1: Schema — Add temporal columns to `loans` table (AC: 1, 3, 5)
  - [x] 1.1 Add to `apps/server/src/db/schema.ts` on the `loans` table: `dateOfBirth` (`date('date_of_birth')`), `dateOfFirstAppointment` (`date('date_of_first_appointment')`), `computedRetirementDate` (`date('computed_retirement_date')`) — all three nullable
  - [x] 1.2 Add index: `idx_loans_computed_retirement_date` on `computedRetirementDate` (powers Epic 3 migration scan and Epic 4 dashboard queries)
  - [x] 1.3 Generate Drizzle migration: `npx drizzle-kit generate` — produces migration 0004
  - [x] 1.4 Apply migration: `npx drizzle-kit push` or run migration

- [x] Task 2: Schema — `temporal_corrections` immutable audit table (AC: 2)
  - [x] 2.1 Add to `apps/server/src/db/schema.ts`: `temporalCorrections` table with columns: `id` (UUIDv7 PK), `loanId` (UUID FK → loans.id, NOT NULL), `fieldName` (text, NOT NULL — `'date_of_birth'` or `'date_of_first_appointment'`), `oldValue` (date, nullable — null if field was previously empty), `newValue` (date, NOT NULL), `oldRetirementDate` (date, nullable — previous computed value), `newRetirementDate` (date, nullable — new computed value, null if profile still incomplete after correction), `correctedBy` (UUID FK → users.id, NOT NULL), `reason` (text, NOT NULL), `createdAt` (timestamptz, NOT NULL, defaultNow). No `updatedAt` — append-only
  - [x] 2.2 Add indexes: `idx_temporal_corrections_loan_id` on `loanId`, `idx_temporal_corrections_created_at` on `createdAt`
  - [x] 2.3 Add immutability trigger in `apps/server/src/db/triggers.ts`: `trg_temporal_corrections_immutable` using existing `fn_prevent_modification()` — same pattern as `trg_ledger_entries_immutable` and `trg_loan_state_transitions_immutable`
  - [x] 2.4 Migration generated alongside Task 1.3 (single migration file)

- [x] Task 3: Pure computation function (AC: 1, 4)
  - [x] 3.1 Add to `apps/server/src/services/computationEngine.ts`: `computeRetirementDate(dateOfBirth: Date, dateOfFirstAppointment: Date): { retirementDate: Date; computationMethod: 'dob_60' | 'appt_35' }` — pure function, no DB access
    - Compute `dobPlus60 = addYears(dateOfBirth, 60)` using `date-fns`
    - Compute `apptPlus35 = addYears(dateOfFirstAppointment, 35)` using `date-fns`
    - Return `min(dobPlus60, apptPlus35)` with the method that produced the minimum
  - [x] 3.2 Add to `apps/server/src/services/computationEngine.ts`: `computeRemainingServiceMonths(retirementDate: Date, asOfDate?: Date): number` — returns months from `asOfDate` (defaults to today) to `retirementDate`. Returns 0 if already past retirement. Uses `differenceInMonths` from `date-fns`
  - [x] 3.3 Input validation: throw if `dateOfBirth` is in the future, throw if `dateOfFirstAppointment` is before `dateOfBirth`

- [x] Task 4: Shared types & vocabulary (AC: 1, 2, 3, 4)
  - [x] 4.1 Add to `packages/shared/src/types/loan.ts`: `TemporalProfile` interface — `{ dateOfBirth: string | null; dateOfFirstAppointment: string | null; computedRetirementDate: string | null; computationMethod: 'dob_60' | 'appt_35' | null; profileStatus: 'complete' | 'incomplete'; remainingServiceMonths: number | null; profileIncompleteReason: string | null }`
  - [x] 4.2 Add to `packages/shared/src/types/loan.ts`: `TemporalCorrection` interface — `{ id: string; loanId: string; fieldName: string; oldValue: string | null; newValue: string; oldRetirementDate: string | null; newRetirementDate: string | null; correctedBy: string; correctedByName: string; reason: string; createdAt: string }`
  - [x] 4.3 Add to `packages/shared/src/types/loan.ts`: `UpdateTemporalProfileRequest` interface — `{ dateOfBirth?: string; dateOfFirstAppointment?: string; reason: string }`
  - [x] 4.4 Extend existing `Loan` interface: add `temporalProfile: TemporalProfile` field
  - [x] 4.5 Add to `packages/shared/src/constants/vocabulary.ts`: `TEMPORAL_PROFILE_INCOMPLETE: 'Profile Incomplete — DOB/appointment date required'`, `TEMPORAL_PROFILE_UPDATED: 'Temporal profile updated and retirement date recomputed.'`, `TEMPORAL_DOB_FUTURE: 'Date of birth cannot be in the future.'`, `TEMPORAL_APPT_BEFORE_DOB: 'Date of first appointment cannot precede date of birth.'`, `TEMPORAL_CORRECTION_RECORDED: 'Date correction recorded with full audit trail.'`
  - [x] 4.6 Export from `packages/shared/src/index.ts` barrel

- [x] Task 5: Zod validators (AC: 2, 5)
  - [x] 5.1 Add to `packages/shared/src/validators/loanSchemas.ts`: `updateTemporalProfileSchema` — `z.object({ dateOfBirth: z.iso.date().optional(), dateOfFirstAppointment: z.iso.date().optional(), reason: z.string().min(1, 'Reason is required').max(500) }).refine(data => data.dateOfBirth || data.dateOfFirstAppointment, { message: 'At least one date field must be provided' })`
  - [x] 5.2 Update existing `createLoanSchema`: add optional `dateOfBirth: z.iso.date().optional()` and `dateOfFirstAppointment: z.iso.date().optional()` fields. Note: temporal dates are optional at creation to support migration and incremental data entry. A future story should enforce required-at-creation once data collection is normalized (ref: Architecture Constraint #10).
  - [x] 5.3 Export from barrel

- [x] Task 6: Temporal profile service (AC: 1, 2, 3, 4, 5)
  - [x] 6.1 Create `apps/server/src/services/temporalProfileService.ts`
  - [x] 6.2 Implement `buildTemporalProfile(loan)`: takes a loan row, returns `TemporalProfile` object. If both dates present → compute retirement date and remaining service months. If either missing → return incomplete status with reason
  - [x] 6.3 Implement `updateTemporalProfile(userId, loanId, updates, reason, mdaScope)`:
    - Wrap in `db.transaction(async (tx) => { ... })`
    - SELECT loan with `FOR UPDATE` row lock (prevent concurrent modifications)
    - MDA scope check (403 vs 404 distinction — same pattern as `loanTransitionService`)
    - For each changed date field: record in `temporal_corrections` table (old value, new value, old retirement date)
    - Update loan record with new dates
    - Recompute `computed_retirement_date` if both dates now present (or set to null if still incomplete)
    - Record new retirement date in correction record
    - Return updated loan with `temporalProfile`
  - [x] 6.4 Implement `getTemporalCorrections(loanId, mdaScope)`:
    - SELECT loan to verify exists + MDA scope check
    - SELECT corrections JOIN users (for correctedByName) WHERE loanId, ORDER BY createdAt ASC
    - Return array of `TemporalCorrection`

- [x] Task 7: Enhance existing loan service & routes (AC: 4, 5)
  - [x] 7.1 Modify `apps/server/src/services/loanService.ts` — `toLoanResponse()`: call `buildTemporalProfile()` to include `temporalProfile` in every loan response. This means `getLoanById()`, `searchLoans()`, and `getLoanDetail()` all automatically include temporal data
  - [x] 7.2 Modify `apps/server/src/services/loanService.ts` — `createLoan()`: if `dateOfBirth` and `dateOfFirstAppointment` are provided, compute and store `computedRetirementDate` on INSERT
  - [x] 7.3 Add to existing `apps/server/src/routes/loanRoutes.ts` (sub-resource endpoints — do NOT create separate file):
    - `PATCH /loans/:loanId/temporal-profile` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, validate(updateTemporalProfileSchema), auditLog]` → call `updateTemporalProfile()` → respond `{ success: true, data: updatedLoan }` with status 200
    - `GET /loans/:loanId/temporal-corrections` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER), scopeToMda, auditLog]` → call `getTemporalCorrections()` → respond `{ success: true, data: corrections }`
  - [x] 7.4 Note: `loanRoutes` is already registered in `app.ts` — no app.ts change needed

- [x] Task 8: Unit tests — retirement date computation (AC: 1)
  - [x] 8.1 Add tests to `apps/server/src/services/computationEngine.test.ts` (existing file — add `describe('computeRetirementDate')` block):
  - [x] 8.2 Test DOB+60 wins: DOB 1970-01-15, appointment 1995-06-01 → retirement 2030-01-15 (DOB+60=2030-01-15, appt+35=2030-06-01 — DOB wins, earlier)
  - [x] 8.3 Test appt+35 wins: DOB 1965-03-20, appointment 1998-01-01 → retirement 2025-03-20 (DOB+60=2025, appt+35=2033 — DOB wins). Adjust: DOB 1975-06-15, appointment 1990-01-01 → retirement 2025-01-01 (DOB+60=2035, appt+35=2025 — appt wins)
  - [x] 8.4 Test equal dates: DOB 1970-01-01, appointment 1995-01-01 → both yield 2030-01-01 — verify deterministic result
  - [x] 8.5 Test leap year: DOB 1964-02-29 → retirement 2024-02-29 (or date-fns behavior for adding 60 years to Feb 29)
  - [x] 8.6 Test validation: future DOB → throws, appointment before DOB → throws
  - [x] 8.7 Test `computeRemainingServiceMonths`: retirement in 36 months → returns 36; retirement in the past → returns 0; retirement today → returns 0

- [x] Task 9: Integration tests — temporal profile CRUD (AC: 1, 2, 3, 4, 5)
  - [x] 9.1 Create `apps/server/src/services/temporalProfileService.integration.test.ts`
  - [x] 9.2 Seed: 1 MDA, 1 super_admin, 1 dept_admin, 1 mda_officer, 1 loan without temporal data
  - [x] 9.3 Test: GET loan detail → `temporalProfile.profileStatus` is `'incomplete'`, `computedRetirementDate` is null
  - [x] 9.4 Test: PATCH temporal-profile with both dates → loan now has `computedRetirementDate`, `profileStatus` is `'complete'`, `computationMethod` is correct
  - [x] 9.5 Test: PATCH temporal-profile updating DOB only → retirement date recomputed, correction record created with old/new values and old/new retirement dates
  - [x] 9.6 Test: GET temporal-corrections → returns chronological list with correctedByName
  - [x] 9.7 Test: MDA scoping — officer can GET loan detail with temporal profile for their MDA loan → 200; for other MDA → 403
  - [x] 9.8 Test: MDA officer cannot PATCH temporal-profile (only SUPER_ADMIN / DEPT_ADMIN) → 403
  - [x] 9.9 Test: PATCH with neither date field → 400 (Zod refine validation)
  - [x] 9.10 Test: PATCH with future DOB → 422 business logic rejection
  - [x] 9.11 Test: PATCH with appointment date before DOB → 422 business logic rejection
  - [x] 9.12 Test: Immutability — attempt UPDATE/DELETE on `temporal_corrections` → rejected by DB trigger
  - [x] 9.13 Test: Create loan with both temporal dates → `computed_retirement_date` is set on creation
  - [x] 9.14 Test: Create loan without temporal dates → `computed_retirement_date` is null, profile incomplete
  - [x] 9.15 Test: Atomicity — if correction INSERT fails, loan dates should NOT be updated (transaction rollback)

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Add temporal date validation in `createLoan` — future DOB and appt-before-DOB threw 500 instead of 422 [`apps/server/src/services/loanService.ts`]
- [x] [AI-Review][MEDIUM] M1: Update `CreateLoanRequest` interface with optional temporal date fields [`packages/shared/src/types/loan.ts`]
- [x] [AI-Review][MEDIUM] M2: Extract duplicate `toDateString()` helper to `apps/server/src/lib/dateUtils.ts` — removed copies from loanService and temporalProfileService [`apps/server/src/lib/dateUtils.ts`]
- [x] [AI-Review][MEDIUM] M3: Add integration tests for invalid temporal dates on loan creation — POST with future DOB → 422, POST with appt before DOB → 422 [`apps/server/src/services/temporalProfileService.integration.test.ts`]
- [x] [AI-Review][LOW] L1: Add `pnpm-lock.yaml` and `dateUtils.ts` to story File List [`10-1-retirement-date-computation-storage.md`]
- [x] [AI-Review][LOW] L2: Add integration test for mda_officer GET temporal-corrections — own MDA → 200, other MDA → 403 [`apps/server/src/services/temporalProfileService.integration.test.ts`]
- [x] [AI-Review][LOW] L3: Skip no-op update when submitted dates match existing values — early return in transaction when corrections.length === 0 [`apps/server/src/services/temporalProfileService.ts`]

## Dev Notes

### Retirement Date Computation — Pure Function

The computation is a pure function added to the existing `computationEngine.ts` alongside `computeRepaymentSchedule()`, `autoSplitDeduction()`, and `computeBalanceFromEntries()`:

```typescript
import { addYears, min, differenceInMonths } from 'date-fns';

export function computeRetirementDate(
  dateOfBirth: Date,
  dateOfFirstAppointment: Date,
): { retirementDate: Date; computationMethod: 'dob_60' | 'appt_35' } {
  if (dateOfBirth > new Date()) {
    throw new Error('Date of birth cannot be in the future');
  }
  if (dateOfFirstAppointment < dateOfBirth) {
    throw new Error('Date of first appointment cannot precede date of birth');
  }

  const dobPlus60 = addYears(dateOfBirth, 60);
  const apptPlus35 = addYears(dateOfFirstAppointment, 35);
  const retirementDate = min([dobPlus60, apptPlus35]);

  return {
    retirementDate,
    computationMethod: retirementDate.getTime() === dobPlus60.getTime() ? 'dob_60' : 'appt_35',
  };
}

export function computeRemainingServiceMonths(
  retirementDate: Date,
  asOfDate: Date = new Date(),
): number {
  const months = differenceInMonths(retirementDate, asOfDate);
  return Math.max(0, months);
}
```

### Temporal Correction — Atomic Transaction Pattern

Same pattern as `loanTransitionService.transitionLoan()` from Story 2.7:

```typescript
const result = await db.transaction(async (tx) => {
  // 1. Read loan with row lock
  const [loan] = await tx.select().from(loans)
    .where(and(...conditions)).for('update');

  if (!loan) throw new AppError(404, 'LOAN_NOT_FOUND', ...);
  // MDA scope check (403 vs 404)

  // 2. Business logic validation
  if (updates.dateOfBirth) {
    const newDob = new Date(updates.dateOfBirth);
    if (newDob > new Date()) throw new AppError(422, 'TEMPORAL_DOB_FUTURE', ...);
  }

  // 3. Record corrections for each changed field
  const corrections = [];
  if (updates.dateOfBirth && updates.dateOfBirth !== toDateString(loan.dateOfBirth)) {
    corrections.push({
      loanId, fieldName: 'date_of_birth',
      oldValue: loan.dateOfBirth, newValue: new Date(updates.dateOfBirth),
      oldRetirementDate: loan.computedRetirementDate,
      correctedBy: userId, reason,
    });
  }
  // ... same for dateOfFirstAppointment

  // 4. Update loan dates
  const updateFields: Partial<typeof loans.$inferInsert> = { updatedAt: new Date() };
  if (updates.dateOfBirth) updateFields.dateOfBirth = new Date(updates.dateOfBirth);
  if (updates.dateOfFirstAppointment) updateFields.dateOfFirstAppointment = new Date(updates.dateOfFirstAppointment);

  // 5. Recompute retirement date
  const effectiveDob = updates.dateOfBirth ? new Date(updates.dateOfBirth) : loan.dateOfBirth;
  const effectiveAppt = updates.dateOfFirstAppointment ? new Date(updates.dateOfFirstAppointment) : loan.dateOfFirstAppointment;
  if (effectiveDob && effectiveAppt) {
    const { retirementDate } = computeRetirementDate(effectiveDob, effectiveAppt);
    updateFields.computedRetirementDate = retirementDate;
  } else {
    updateFields.computedRetirementDate = null;
  }

  await tx.update(loans).set(updateFields).where(eq(loans.id, loanId));

  // 6. Insert correction records (with newRetirementDate now known)
  for (const c of corrections) {
    await tx.insert(temporalCorrections).values({
      ...c, newRetirementDate: updateFields.computedRetirementDate,
    });
  }

  return { ...loan, ...updateFields };
});
```

### Immutability — 3-Layer Pattern (Same as Stories 2.2, 2.7)

`temporal_corrections` is append-only. Apply the same enforcement:

**Layer 1 (DB Trigger):** Reuse `fn_prevent_modification()`:
```sql
CREATE TRIGGER trg_temporal_corrections_immutable
  BEFORE UPDATE OR DELETE ON temporal_corrections
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_modification();
```

**Layer 2 (ORM):** Service only exposes `insert()` and `select()` — no `update()` or `delete()` methods.

**Layer 3 (API):** Routes define only `GET` (read corrections) and `PATCH` (update profile, which creates correction records). No direct `PUT`/`DELETE` for corrections.

### Enhancing Existing Loan Response — Non-Breaking

The `temporalProfile` field is ADDED to the existing `Loan` response. All existing consumers continue to work — new field is additive. The `buildTemporalProfile()` function is called inside `toLoanResponse()` so every loan endpoint automatically includes it.

If DOB/appointment date are null (which they will be for all existing loans until migrated or manually entered), the profile returns:
```json
{
  "temporalProfile": {
    "dateOfBirth": null,
    "dateOfFirstAppointment": null,
    "computedRetirementDate": null,
    "computationMethod": null,
    "profileStatus": "incomplete",
    "remainingServiceMonths": null,
    "profileIncompleteReason": "Profile Incomplete — DOB/appointment date required"
  }
}
```

### Role Permissions

- **PATCH /loans/:loanId/temporal-profile:** `SUPER_ADMIN` and `DEPT_ADMIN` only — date corrections are administrative actions
- **GET /loans/:loanId/temporal-corrections:** All roles — `mda_officer` can read correction history but only for loans in their MDA
- **GET /loans/:loanId** (enhanced): All roles as before — temporal profile included in existing response

### Date Arithmetic — `date-fns` (NOT manual)

The architecture mandates `date-fns` for all date operations. Do NOT use manual month/year arithmetic. Key functions:
- `addYears(date, 60)` — handles leap years correctly
- `min([date1, date2])` — returns earlier date
- `differenceInMonths(laterDate, earlierDate)` — whole months difference

### What NOT To Do (Scope Boundary)

- **Do NOT** create a separate `retirementRoutes.ts` file — temporal endpoints are sub-resources of loans, added to existing `loanRoutes.ts`
- **Do NOT** create a `RetirementProfileCard.tsx` frontend component — that's Story 10.2/10.3 scope
- **Do NOT** implement service extension logic — that's Story 10.2
- **Do NOT** implement gratuity receivable computation — that's Story 10.3
- **Do NOT** implement the Service Status Verification Report — that's Story 10.4
- **Do NOT** add dashboard metrics — that's Story 10.3 (executive dashboard exposure)
- **Do NOT** store retirement date as a mutable field that can be edited directly — it is ALWAYS computed from DOB + appointment date (or overridden by service extension in Story 10.2)
- **Do NOT** create a separate migration for the corrections table — include both schema changes (loans columns + temporal_corrections table) in a single migration

### Existing Infrastructure (Do NOT Recreate)

| Component | Location | Status |
|-----------|----------|--------|
| `loans` table | `apps/server/src/db/schema.ts` | Exists (Story 2.1) |
| `loanStatusEnum` (6 values) | `apps/server/src/db/schema.ts` | Exists |
| `fn_prevent_modification()` | `apps/server/src/db/triggers.ts` | Exists (reusable) |
| `loanRoutes.ts` | `apps/server/src/routes/loanRoutes.ts` | Exists (Story 2.6) |
| `loanService.ts` | `apps/server/src/services/loanService.ts` | Exists (Story 2.1/2.6) |
| `computationEngine.ts` | `apps/server/src/services/computationEngine.ts` | Exists (Story 2.3) |
| `computationEngine.test.ts` | `apps/server/src/services/computationEngine.test.ts` | Exists (Story 2.3) |
| `Loan` interface | `packages/shared/src/types/loan.ts` | Exists |
| `LoanSummary` interface (has `retirementDate` placeholder) | `packages/shared/src/types/loan.ts` | Exists — anticipated |
| `createLoanSchema` | `packages/shared/src/validators/loanSchemas.ts` | Exists (extend) |
| `AppError` class | `apps/server/src/lib/appError.ts` | Exists |
| `scopeToMda` middleware | `apps/server/src/middleware/scopeToMda.ts` | Exists |
| `withMdaScope()` utility | `apps/server/src/lib/mdaScope.ts` | Exists |
| `authenticate` / `authorise` | `apps/server/src/middleware/` | Exists |
| `auditLog` middleware | `apps/server/src/middleware/auditLog.ts` | Exists |
| `validate` middleware | `apps/server/src/middleware/validate.ts` | Exists |
| `toDateString()` helper | `apps/server/src/services/loanService.ts` | Exists |
| `generateUuidv7()` | `apps/server/src/lib/uuidv7.ts` | Exists |
| `date-fns` package | `package.json` | Already installed |

### Dependencies on Prior Stories

- **Story 2.1** (loans table, loanService, MDA scoping) — schema extension point
- **Story 2.2** (immutability pattern: `fn_prevent_modification()` trigger) — trigger reuse for corrections table
- **Story 2.3** (computationEngine.ts) — add retirement computation alongside existing financial functions
- **Story 2.7** (atomic transaction + row lock pattern) — same pattern for temporal correction
- **Story 1.5** (audit log middleware) — auto-captures temporal correction API calls

### What This Story Enables (Downstream)

- **Story 10.2:** Service extension recording overrides `computed_retirement_date`
- **Story 10.3:** Gratuity receivable uses retirement date + remaining service months
- **Story 10.4:** Service Status Verification Report queries `computed_retirement_date < import_date`
- **Epic 3 (Story 3.6):** Observation engine detects post-retirement deductions using `computedRetirementDate`
- **Epic 11 (Story 11.1):** Pre-submission checkpoint flags approaching retirements within 12 months
- **Epic 12:** Early exit processing uses remaining service months for projections

### Git Intelligence (from Epic 2)

Recent commits show consistent patterns:
- Commit prefix: `feat(loans):` for loan-related stories
- Code review fixes included in same commit
- Story 2.7's `SELECT FOR UPDATE` row lock pattern is the latest evolution — use this for temporal corrections
- `toLoanResponse()` in loanService.ts is the single mapping point — extend here for temporal profile
- All shared package changes require `tsc` rebuild of `@vlprs/shared` before server tests pick them up

### Project Structure Notes

New files created by this story:
```
apps/server/src/
└── services/temporalProfileService.ts                         (NEW)
└── services/temporalProfileService.integration.test.ts        (NEW)
```

Modified files:
```
apps/server/src/db/schema.ts                  (add temporal columns to loans + temporalCorrections table)
apps/server/src/db/triggers.ts                (add trg_temporal_corrections_immutable)
apps/server/src/services/computationEngine.ts (add computeRetirementDate + computeRemainingServiceMonths)
apps/server/src/services/computationEngine.test.ts (add retirement date computation tests)
apps/server/src/services/loanService.ts       (enhance toLoanResponse with temporalProfile, enhance createLoan)
apps/server/src/routes/loanRoutes.ts          (add PATCH temporal-profile + GET temporal-corrections)
packages/shared/src/types/loan.ts             (add TemporalProfile, TemporalCorrection, UpdateTemporalProfileRequest)
packages/shared/src/validators/loanSchemas.ts (add updateTemporalProfileSchema, extend createLoanSchema)
packages/shared/src/constants/vocabulary.ts   (add temporal vocabulary constants)
packages/shared/src/index.ts                  (add new exports)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 10, Story 10.1]
- [Source: _bmad-output/planning-artifacts/prd.md — FR65]
- [Source: _bmad-output/planning-artifacts/architecture.md — Temporal Validation, Computation Engine, Audit Trail, RBAC]
- [Source: apps/server/src/db/schema.ts — loans table, loanStatusEnum, loanStateTransitions pattern]
- [Source: apps/server/src/db/triggers.ts — fn_prevent_modification() reusable trigger]
- [Source: apps/server/src/services/computationEngine.ts — pure computation pattern (addYears, min from date-fns)]
- [Source: apps/server/src/services/loanTransitionService.ts — atomic transaction + SELECT FOR UPDATE pattern]
- [Source: apps/server/src/services/balanceService.ts — computed field pattern (never stored as mutable state)]
- [Source: apps/server/src/services/loanService.ts — toLoanResponse() mapping, createLoan(), MDA scoping]
- [Source: apps/server/src/routes/loanRoutes.ts — middleware stacking pattern, sub-resource routes]
- [Source: _bmad-output/implementation-artifacts/epic-2-retro-2026-02-28.md — Epic 10 dependency confirmed, computation patterns validated]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- `date-fns` was listed as "Already installed" in Dev Notes but only existed in the client package. Installed in server package to resolve import error.
- Migration 0004 was applied via `drizzle-kit push` (direct schema sync). Migration tracking record inserted manually to keep `__drizzle_migrations` table in sync with `_journal.json`.

### Completion Notes List

- All 9 tasks completed in a single session with zero HALT conditions
- Pure computation functions (`computeRetirementDate`, `computeRemainingServiceMonths`) added to existing `computationEngine.ts` using `date-fns`
- `temporal_corrections` table follows the 3-layer immutability pattern (DB trigger, ORM-level, API-level) — same as `ledger_entries` and `loan_state_transitions`
- `temporalProfile` added to `Loan` interface (additive, non-breaking) — all existing loan endpoints automatically include it
- `updateTemporalProfile` uses atomic transaction with `SELECT FOR UPDATE` row lock — same pattern as `loanTransitionService.transitionLoan()`
- Temporal routes added as sub-resources to existing `loanRoutes.ts` — no new route file created
- 10 new unit tests (computeRetirementDate + computeRemainingServiceMonths) added to existing test file
- 15 new integration tests covering all ACs, MDA scoping, role enforcement, validation, immutability, and atomicity
- Full test suite: 466 tests pass across 37 files, zero regressions

### Change Log

- 2026-03-01: Story 10.1 implemented — retirement date computation, temporal profile on loan responses, correction audit trail, unit + integration tests (all 466 tests pass)
- 2026-03-01: Code review fixes applied — H1: temporal validation on loan creation path (422 instead of 500), M1: CreateLoanRequest interface extended, M2: toDateString extracted to lib/dateUtils.ts, M3+L2: 4 new integration tests (create-loan validation, officer temporal-corrections access), L3: no-op guard in updateTemporalProfile

### File List

New files:
- apps/server/src/services/temporalProfileService.ts
- apps/server/src/services/temporalProfileService.integration.test.ts
- apps/server/drizzle/0004_concerned_frightful_four.sql
- apps/server/drizzle/meta/0004_snapshot.json
- apps/server/src/lib/dateUtils.ts (code review — M2: extracted toDateString utility)

Modified files:
- apps/server/src/db/schema.ts (added date import, temporal columns to loans, temporalCorrections table)
- apps/server/src/db/triggers.ts (added trg_temporal_corrections_immutable)
- apps/server/src/services/computationEngine.ts (added computeRetirementDate, computeRemainingServiceMonths)
- apps/server/src/services/computationEngine.test.ts (added retirement date computation + remaining months tests)
- apps/server/src/services/loanService.ts (enhanced toLoanResponse with temporalProfile, enhanced createLoan with temporal dates)
- apps/server/src/routes/loanRoutes.ts (added PATCH temporal-profile, GET temporal-corrections routes)
- packages/shared/src/types/loan.ts (added TemporalProfile, TemporalCorrection, UpdateTemporalProfileRequest interfaces, extended Loan/LoanDetail)
- packages/shared/src/validators/loanSchemas.ts (added updateTemporalProfileSchema, extended createLoanSchema with temporal dates)
- packages/shared/src/constants/vocabulary.ts (added temporal vocabulary constants)
- packages/shared/src/index.ts (added new type and validator exports)
- apps/server/package.json (added date-fns dependency)
- apps/server/drizzle/meta/_journal.json (new migration entry)
- pnpm-lock.yaml (auto-generated from package.json change)
