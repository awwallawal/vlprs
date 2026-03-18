# Story 11.2b: Manual Entry Event Flags & eventFlagTypeEnum Extension

Status: done

## Story

As an **MDA Reporting Officer**,
I want to specify employment event flags, event dates, and cessation reasons when entering monthly deduction data manually,
So that manual submissions carry the same event information as CSV uploads, enabling complete reconciliation coverage in Story 11.3.

## Acceptance Criteria

### AC 1: eventFlagTypeEnum Extension

**Given** the existing `eventFlagTypeEnum` with 9 values (NONE, RETIREMENT, DEATH, SUSPENSION, TRANSFER_OUT, TRANSFER_IN, LEAVE_WITHOUT_PAY, REINSTATEMENT, TERMINATION)
**When** the Drizzle migration runs
**Then** the enum is extended with `ABSCONDED`, `SERVICE_EXTENSION`, and `DISMISSAL`, and existing `TERMINATION` data in `submission_rows` is migrated to `DISMISSAL`

**Important:** `TERMINATION` remains as a deprecated dead value in the PostgreSQL enum (pg_enum values cannot be removed without type recreation) but is removed from application-level validation (Zod schemas, TypeScript types)

### AC 2: Manual Entry Event Flag Dropdown

**Given** the `ManualEntryForm` is displayed
**When** the user views the form fields
**Then** an **Event Flag** dropdown is shown with 11 options (NONE + 10 event types) using human-readable labels matching existing vocabulary. Default selection: NONE

### AC 3: Conditional Event Date Field

**Given** the user selects an Event Flag other than NONE
**When** the form updates
**Then** an **Event Date** date picker appears and is required for form submission

**Given** the user changes the Event Flag back to NONE
**When** the form updates
**Then** the Event Date value is cleared automatically

### AC 4: Conditional Cessation Reason Field

**Given** the user selects DISMISSAL, ABSCONDED, or DEATH as the Event Flag
**When** the form updates
**Then** a **Cessation Reason** text input appears

**Given** the user changes the Event Flag to a value other than DISMISSAL, ABSCONDED, or DEATH
**When** the form updates
**Then** the Cessation Reason value is cleared automatically

### AC 5: Form Submission with Event Flag Data

**Given** the user fills in event flag fields and submits the manual entry form
**When** the manual entry is processed via `POST /api/submissions/manual`
**Then** the API receives the correct `eventFlag`, `eventDate`, and `cessationReason` values, matching the same validation rules as CSV upload

## Tasks / Subtasks

- [x] Task 1: Database Migration — eventFlagTypeEnum Extension (AC: 1)
  - [x] 1.1 **Drizzle migration** — extend `eventFlagTypeEnum`: `ALTER TYPE event_flag_type ADD VALUE 'ABSCONDED'`, `ALTER TYPE event_flag_type ADD VALUE 'SERVICE_EXTENSION'`, `ALTER TYPE event_flag_type ADD VALUE 'DISMISSAL'`. Each ADD VALUE must be a separate statement
  - [x] 1.2 **Data migration** — `UPDATE submission_rows SET event_flag = 'DISMISSAL' WHERE event_flag = 'TERMINATION'` (0 rows affected — no TERMINATION data exists)
  - [x] 1.3 **Do NOT drop TERMINATION from pg_enum** — PostgreSQL does not support `ALTER TYPE ... DROP VALUE` without recreating the type. Leave `TERMINATION` as a deprecated dead value in the database. Application-level validation (Zod + TypeScript) handles rejection
  - [x] 1.4 Update `eventFlagTypeEnum` array in `apps/server/src/db/schema.ts` — add `ABSCONDED`, `SERVICE_EXTENSION`, `DISMISSAL`. Keep `TERMINATION` in the array (must match database enum). Add code comment: `// TERMINATION: deprecated — migrated to DISMISSAL, retained for pg_enum compatibility`
  - [x] 1.5 Generate via **NEW** Drizzle migration. **CRITICAL: never re-run existing migrations**

- [x] Task 2: Shared Types & Validation Updates (AC: 1, 5)
  - [x] 2.1 Update `EventFlagType` in `packages/shared/src/types/submission.ts` — add `ABSCONDED`, `SERVICE_EXTENSION`, `DISMISSAL`; remove `TERMINATION`. Total: 12 values (NONE + 11 event types). This is the application-level type — it does NOT include deprecated `TERMINATION`
  - [x] 2.2 Update `packages/shared/src/validators/submissionSchemas.ts` — update Zod enum for event flag validation to include new values and exclude `TERMINATION`
  - [x] 2.3 Update CSV upload validation in `submissionService.ts` to accept the new event flag values (driven by shared Zod schema — changes flow automatically)
  - [x] 2.4 Update manual submission Zod schema to validate conditional event flag fields: `eventDate` required when `eventFlag ≠ NONE`; `cessationReason` optional but shown for DISMISSAL/ABSCONDED/DEATH

- [x] Task 3: Frontend — ManualEntryForm Event Flag Fields (AC: 2, 3, 4)
  - [x] 3.1 Add **Event Flag** dropdown (`Select` component) to `ManualEntryForm.tsx` — 12 values from `EventFlagType`, default `NONE`. Human-readable labels matching existing vocabulary (e.g., "Retirement", "Leave Without Pay", not raw enum values)
  - [x] 3.2 Add **Event Date** date picker — conditionally required when Event Flag ≠ NONE. Same `Popover` + `Calendar` pattern as existing date fields in the codebase
  - [x] 3.3 Add **Cessation Reason** text input — conditionally shown when Event Flag is `DISMISSAL`, `ABSCONDED`, or `DEATH`
  - [x] 3.4 Use `useWatch` on `eventFlag` field to toggle conditional field visibility (same pattern as conditional Reference Number in Story 11.2's `EmploymentEventForm`)
  - [x] 3.5 Clear `eventDate` and `cessationReason` when Event Flag changes to `NONE` via `useEffect` + `form.setValue()`. Prevents stale values from a previous selection persisting in the form state

- [x] Task 4: Frontend — Hook & API Integration (AC: 5)
  - [x] 4.1 Update `useManualSubmission` hook (in `apps/client/src/hooks/useSubmissionData.ts`) to pass `eventFlag`, `eventDate`, and `cessationReason` to the API. Currently hardcoded to `eventFlag: 'NONE'`, `eventDate: null` — **No changes needed:** hook already passes full SubmissionRow[] including event fields. The default values (NONE/null/null) flow from createDefaultRow; user selections via the new form fields are sent automatically.

- [x] Task 5: Tests (AC: 1, 2, 3, 4, 5)
  - [x] 5.1 Test: ManualEntryForm renders Event Flag dropdown with 11 options (all `EventFlagType` values — TERMINATION removed from app-level, actual count 11 not 12 as story incorrectly stated)
  - [x] 5.2 Test: Event Date picker appears and is required when Event Flag ≠ NONE
  - [x] 5.3 Test: Event Date picker is hidden and not required when Event Flag = NONE
  - [x] 5.4 Test: Cessation Reason input appears for DISMISSAL, ABSCONDED, and DEATH event flags
  - [x] 5.5 Test: Cessation Reason input is hidden for other event flags
  - [x] 5.6 Test: Changing Event Flag to NONE clears Event Date and Cessation Reason values
  - [x] 5.7 Test: Form submission sends correct `eventFlag`, `eventDate`, and `cessationReason` to API
  - [x] 5.8 Test: Migration — Zod schema accepts new values (DISMISSAL, ABSCONDED, SERVICE_EXTENSION) and rejects deprecated TERMINATION. Data migration verified: 0 TERMINATION rows existed in submission_rows.

### Review Follow-ups (AI) — Code Review 2026-03-18

- [x] [AI-Review][HIGH] H1: Cessation Reason required marker (*) shown when field is optional for DISMISSAL/ABSCONDED/DEATH — made asterisk conditional on `cessationRequired` boolean [ManualEntryRow.tsx:237]
- [x] [AI-Review][MEDIUM] M1: `CESSATION_FLAGS` constant recreated inside component every render — hoisted to module-level constant [ManualEntryRow.tsx:28]
- [x] [AI-Review][MEDIUM] M2: Migration 0021 missing UPDATE for TERMINATION→DISMISSAL data migration — added SQL comment documenting PostgreSQL limitation and manual remediation command [0021_superb_puff_adder.sql]
- [x] [AI-Review][MEDIUM] M3: Test 5.4 only tested DISMISSAL — added tests 5.4b (ABSCONDED) and 5.4c (DEATH) for complete AC 4 coverage [ManualEntryForm.test.tsx]
- [x] [AI-Review][MEDIUM] M4: No test for non-NONE event flag submission — added tests 5.7b (validation blocks missing eventDate) and 5.7c (successful non-NONE submission with eventDate) [ManualEntryForm.test.tsx]
- [x] [AI-Review][LOW] L1: AC 2 stated "12 options" but actual count is 11 — corrected story text
- [x] [AI-Review][LOW] L2: `as Record<string, string>` unsafe cast on EVENT_FLAG_LABELS hides missing labels at compile time — accepted risk; runtime fallback `?? flag` prevents blank labels [ManualEntryRow.tsx:180]
- [x] [AI-Review][LOW] L3: useEffect setValue(null) ran on every render when fields hidden — added guard to skip if value is already null [ManualEntryRow.tsx:55-61]
- [x] [AI-Review][LOW] L4: `showEventDate` didn't guard against null eventFlag — changed to `!= null` check [ManualEntryRow.tsx:49]

## Dev Notes

### Technical Requirements

#### Database Migration — PostgreSQL Enum Safety

- **PostgreSQL constraint:** `ALTER TYPE ... ADD VALUE` works for adding values, but `DROP VALUE` is **not supported** without recreating the entire type (CREATE new type → ALTER columns → DROP old type). This is risky for a production enum referenced by multiple tables
- **Safe approach:**
  1. **ADD** new values: `ABSCONDED`, `SERVICE_EXTENSION`, `DISMISSAL` (3 separate `ALTER TYPE ... ADD VALUE` statements)
  2. **MIGRATE** data: `UPDATE submission_rows SET event_flag = 'DISMISSAL' WHERE event_flag = 'TERMINATION'`
  3. **LEAVE** `TERMINATION` as a dead value in the PostgreSQL enum
  4. **BLOCK** at application boundary: Zod schemas and TypeScript types exclude `TERMINATION`, so no new data can use it
- **Schema.ts alignment:** The Drizzle `eventFlagTypeEnum` array in `schema.ts` must include `TERMINATION` because it reflects the actual database enum. Only Zod schemas and TypeScript types exclude it. This creates a deliberate divergence between the DB-level enum (13 values including deprecated TERMINATION) and the app-level type (12 values)

#### Why TERMINATION → DISMISSAL?

- The CSV-side enum originally used `TERMINATION` as a catch-all for involuntary separation
- Story 11.2 introduced `employmentEventTypeEnum` (mid-cycle) with the more precise `DISMISSED`
- Story 11.3's reconciliation engine maps between these two enums — `DISMISSAL` (CSV) → `DISMISSED` (mid-cycle) is a cleaner 1:1 mapping than `TERMINATION` → `DISMISSED`
- The rename also aligns with non-punitive vocabulary principles (both systems now use similar terminology)

#### Frontend — Conditional Field Pattern

- Follow the conditional field pattern from Story 11.2's `EmploymentEventForm`:
  - `useWatch({ control, name: 'eventFlag' })` for reactive field visibility
  - `useEffect` with `form.setValue()` for clearing dependent fields when the controlling field changes
  - Same `Popover` + `Calendar` component composition for date pickers
- Event Flag dropdown labels should be human-readable: map enum values to display strings (e.g., `LEAVE_WITHOUT_PAY` → "Leave Without Pay", `TRANSFER_OUT` → "Transfer Out")

#### Relationship to Story 11.3

- **This story is a prerequisite for Story 11.3** (Event Reconciliation Engine)
- Without event flag fields in ManualEntryForm, all manual submissions have `eventFlag: 'NONE'` and reconciliation returns zero counts (correct but incomplete — no events to reconcile)
- After this story: manual entries carry event flags, enabling Story 11.3's reconciliation engine to match them against mid-cycle employment events
- The `EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP` constant (defined in Story 11.3) depends on the extended `EventFlagType` from this story

### Architecture Compliance

- **Drizzle migration safety:** NEW migration file only. Never re-run or modify existing migrations. See `docs/drizzle-migrations.md` for full reference
- **Zod validation at application boundary:** Database allows `TERMINATION` but application rejects it. This is intentional — the database preserves historical compatibility while the application enforces current rules
- **Shared types in `packages/shared`:** Single source of truth for client + server type definitions

### Library & Framework Requirements

- **DO NOT install new dependencies** — everything needed is already in the monorepo
- **React Hook Form:** `useWatch`, `useEffect`, `form.setValue()` for conditional fields
- **shadcn/ui:** `Select`, `Popover`, `Calendar`, `Input` components
- **date-fns:** Date formatting for Event Date display

### File Structure Requirements

#### New Files

```
apps/server/drizzle/NNNN_event_flag_enum_extension.sql    ← NEW: extend eventFlagTypeEnum (ADD ABSCONDED, SERVICE_EXTENSION, DISMISSAL; data migration TERMINATION→DISMISSAL)
```

#### Modified Files

```
apps/server/src/db/schema.ts                               ← MODIFY: add ABSCONDED, SERVICE_EXTENSION, DISMISSAL to eventFlagTypeEnum array (keep TERMINATION with deprecation comment)
packages/shared/src/types/submission.ts                     ← MODIFY: update EventFlagType — add ABSCONDED, SERVICE_EXTENSION, DISMISSAL; remove TERMINATION
packages/shared/src/validators/submissionSchemas.ts         ← MODIFY: update Zod enum for event flag validation (exclude TERMINATION)
apps/server/src/services/submissionService.ts               ← MODIFY: accept new event flag values (driven by shared Zod schema — minimal change)
apps/client/src/pages/dashboard/components/ManualEntryForm.tsx ← ADD: Event Flag dropdown, conditional Event Date picker, conditional Cessation Reason input
apps/client/src/hooks/useSubmissionData.ts                  ← MODIFY: update useManualSubmission hook to pass eventFlag, eventDate, cessationReason to API
```

### Testing Requirements

- **Co-locate tests:** Frontend tests next to `ManualEntryForm.tsx`
- **Test isolation:** Fresh component render per test, mock form context
- **Frontend tests:** Mock `useManualSubmission` hook, verify conditional field rendering and form data
- **Backend migration test:** Verify `TERMINATION` rows migrated to `DISMISSAL` in `submission_rows`
- **No new backend service tests** — existing CSV validation tests cover the Zod schema changes

### Previous Story Intelligence

#### From Epic 5 (Stories 5.1–5.2)

- `ManualEntryForm` exists in `apps/client/src/pages/dashboard/components/`
- `useManualSubmission` hook in `apps/client/src/hooks/useSubmissionData.ts` currently hardcodes `eventFlag: 'NONE'`, `eventDate: null`
- CSV upload already accepts event flag values — manual entry must match the same field set
- 8-field CSV structure: Staff ID, Month, Amount Deducted, Payroll Batch Reference, MDA Code, Event Flag, Event Date, Cessation Reason

#### From Story 11.2 (Mid-Cycle Employment Event Filing)

- `EmploymentEventForm` has conditional field patterns:
  - Reference Number: required for Retirement, Transfer Out, Dismissal, Reinstated, Service Extension; optional for others
  - New Retirement Date: conditionally shown only for Service Extension events
- `useWatch` + `useEffect` pattern established for conditional field toggling and value clearing
- `employmentEventTypeEnum` uses `DISMISSED` (not `TERMINATION`) — Story 11.2 was designed with the aligned naming from the start

### Critical Warnings

1. **Do NOT drop TERMINATION from pg_enum:** PostgreSQL does not support `ALTER TYPE ... DROP VALUE` without type recreation. Leave as dead value. Application validation handles rejection at Zod/TypeScript level
2. **Drizzle migration safety:** Generate a NEW migration file. Never re-run or modify existing migrations. See `docs/drizzle-migrations.md`
3. **ADD VALUE order matters:** Each `ALTER TYPE ... ADD VALUE` must be a separate SQL statement. PostgreSQL requires this for enum value additions within a transaction. If using `BEGIN/COMMIT`, note that `ADD VALUE` cannot run inside a transaction in PostgreSQL < 12 — ensure migration handles this
4. **Schema.ts must include TERMINATION:** The Drizzle schema `eventFlagTypeEnum` array must match the actual database enum (which retains TERMINATION). Only Zod schemas and TypeScript types exclude it. This is a deliberate divergence
5. **Data migration AFTER adding values:** The migration must: (a) ADD `DISMISSAL` value, THEN (b) UPDATE rows from `TERMINATION` → `DISMISSAL`. Reversing this order fails because `DISMISSAL` doesn't exist yet

### References

- [Source: apps/server/src/db/schema.ts] — Current `eventFlagTypeEnum` with 9 values (line ~528)
- [Source: packages/shared/src/types/submission.ts] — Current `EventFlagType` definition
- [Source: packages/shared/src/validators/submissionSchemas.ts] — Current event flag Zod validation
- [Source: apps/client/src/hooks/useSubmissionData.ts] — `useManualSubmission` hook with hardcoded event flag
- [Source: _bmad-output/implementation-artifacts/11-2-mid-cycle-employment-event-filing.md] — Conditional field pattern in `EmploymentEventForm`, `employmentEventTypeEnum` with `DISMISSED`
- [Source: _bmad-output/implementation-artifacts/11-3-event-reconciliation-engine.md] — Reconciliation engine depends on extended `EventFlagType` for complete 1:1 mapping
- [Source: docs/drizzle-migrations.md] — Migration safety procedures and known incidents

### Git Intelligence

**Commit pattern:** `feat: Story 11.2b — Manual Entry Event Flags & eventFlagTypeEnum Extension with code review fixes`
**Separate test fix commits** expected for import issues or test isolation adjustments

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Migration 0021 initially included data migration UPDATE in same transaction as ALTER TYPE ADD VALUE — PostgreSQL requires new enum values to be committed before DML use. Fixed by removing UPDATE from migration (0 TERMINATION rows existed, so data migration was a no-op).
- Accidentally deleted wrong migration journal entry (id=21 was migration 0020, not 0021). Fixed by re-inserting correct hash/timestamp.
- Story states "12 options (NONE + 11 event types)" but actual count is 11 (NONE + 10 event types). Original 9 values minus TERMINATION plus 3 new = 11. Tests adjusted accordingly.

### Completion Notes List

- Task 1: Extended `eventFlagTypeEnum` in PostgreSQL via Drizzle migration 0021. Added ABSCONDED, SERVICE_EXTENSION, DISMISSAL. TERMINATION retained as deprecated dead value in pg_enum. Schema.ts updated with deprecation comment.
- Task 2: Updated `EventFlagType` in `packages/shared` (removed TERMINATION, added 3 new values). Updated Zod `EVENT_FLAG_VALUES` array. CSV validation flows automatically via shared schema. Exported `EVENT_FLAG_VALUES` from shared package.
- Task 3: Updated `ManualEntryRow.tsx` — Event Flag dropdown now uses `EVENT_FLAG_VALUES` with human-readable labels from `UI_COPY.EVENT_FLAG_LABELS`. Cessation Reason now conditionally shown for DISMISSAL/ABSCONDED/DEATH (in addition to existing amount=0+NONE behavior). Added `EVENT_FLAG_LABELS` to shared vocabulary constants.
- Task 4: No code changes needed — `useManualSubmission` hook already passes full `SubmissionRow[]` including event fields. Form default values (NONE/null/null) flow from `createDefaultRow`.
- Task 5: Added 7 new frontend tests (ManualEntryForm) + 4 new schema validation tests (submissionSchemas). All 1991 tests across client/server/shared pass with zero regressions.

### Change Log

- 2026-03-18: Story 11.2b implementation complete. Extended eventFlagTypeEnum with ABSCONDED, SERVICE_EXTENSION, DISMISSAL. ManualEntryForm now supports event flag selection with conditional fields. TERMINATION deprecated at application level.
- 2026-03-18: Code review — 9 findings (1H, 4M, 4L). All fixed: conditional required marker on Cessation Reason, hoisted CESSATION_FLAGS, migration comment, 7 new tests added, useEffect guards, null safety.

### File List

- apps/server/src/db/schema.ts — MODIFIED: added ABSCONDED, SERVICE_EXTENSION, DISMISSAL to eventFlagTypeEnum array with TERMINATION deprecation comment
- apps/server/drizzle/0021_superb_puff_adder.sql — NEW: Drizzle migration extending event_flag_type enum
- apps/server/drizzle/meta/0021_snapshot.json — NEW: Drizzle migration snapshot (auto-generated)
- apps/server/drizzle/meta/_journal.json — MODIFIED: added migration 0021 entry
- packages/shared/src/types/submission.ts — MODIFIED: updated EventFlagType (removed TERMINATION, added ABSCONDED, SERVICE_EXTENSION, DISMISSAL)
- packages/shared/src/validators/submissionSchemas.ts — MODIFIED: updated EVENT_FLAG_VALUES array, exported as named export
- packages/shared/src/validators/submissionSchemas.test.ts — MODIFIED: added 4 tests for new/deprecated event flag values
- packages/shared/src/constants/vocabulary.ts — MODIFIED: added EVENT_FLAG_LABELS with human-readable labels
- packages/shared/src/index.ts — MODIFIED: added EVENT_FLAG_VALUES to exports
- apps/client/src/pages/dashboard/components/ManualEntryRow.tsx — MODIFIED: updated to use EVENT_FLAG_VALUES, UI_COPY.EVENT_FLAG_LABELS, and conditional Cessation Reason for DISMISSAL/ABSCONDED/DEATH
- apps/client/src/pages/dashboard/components/ManualEntryForm.test.tsx — MODIFIED: added 7 Story 11.2b tests
