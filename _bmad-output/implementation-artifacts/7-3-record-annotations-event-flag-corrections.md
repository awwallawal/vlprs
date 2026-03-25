# Story 7.3: Record Annotations & Event Flag Corrections

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Department Admin**,
I want to add annotations to loan records and correct event flags through a tracked workflow,
So that institutional knowledge is preserved and data corrections have a complete audit trail.

## Acceptance Criteria

### AC 1: Add Annotation to Loan Record (FR58)

**Given** any loan record
**When** Department Admin adds an annotation
**Then** the annotation (free-text note) is saved with: `loanId`, `content`, `createdBy` (user FK), `createdAt`
**And** annotations are displayed chronologically on the loan detail view (newest first)
**And** annotations are immutable — they can be added but not edited or deleted

### AC 2: Annotation Display on Loan Detail

**Given** a loan record with annotations
**When** a user views the loan detail page
**Then** the "Annotations" section (replacing the current placeholder) shows all annotations in reverse chronological order, each with: author name, timestamp, content
**And** SUPER_ADMIN and DEPT_ADMIN see an "Add Annotation" button; MDA_OFFICER sees annotations read-only

### AC 3: Event Flag Correction Workflow (FR59)

**Given** a loan record with an incorrect event flag (from a submission row)
**When** Department Admin initiates a correction
**Then** a correction dialog captures: the original event flag value (read-only), the new event flag value (dropdown), and a correction reason (required, min 10 chars)
**And** the correction is saved as an immutable record: `loanId`, `staffId`, `originalEventFlag`, `newEventFlag`, `correctionReason`, `correctedBy`, `createdAt`

### AC 4: Original Value Preservation

**Given** an event flag correction
**When** the correction is saved
**Then** the original `submission_rows.eventFlag` value is NOT modified — the correction record shows both old and new values side by side
**And** the correction record is immutable (append-only, no update or delete)

### AC 5: Correction Audit Trail

**Given** an event flag correction
**When** viewed on the loan detail page
**Then** a "Corrections" section shows all corrections for the loan in reverse chronological order, each with: original flag, new flag, reason, corrected by (user name), corrected at (timestamp)
**And** the audit log records the correction action via middleware

### AC 6: Employment Event Sync (Optional Enhancement)

**Given** an event flag correction where the new flag maps to an employment event type
**When** the correction is saved
**Then** if no matching employment event exists for the loan, the system offers to create one (confirmation dialog)
**And** if a mismatched employment event exists, the correction note references it for manual review

### AC 7: MDA Scoping

**Given** a DEPT_ADMIN
**When** they add annotations or correct event flags
**Then** they can only annotate/correct loans belonging to their assigned MDA (enforced by `scopeToMda`)
**And** SUPER_ADMIN can annotate/correct any loan

## Dependencies

- **Depends on:** Story 7.1 (Exception Flagging & Queue) — exception resolution may trigger annotations; Story 7.2 (Inactive Detection) — detected inactivity may warrant annotations
- **Completes:** Epic 7 (Exception Management & Record Annotations)
- **Sequence:** 7.0a → ... → 7.0i → 7.1 → 7.2 → **7.3** → Epic 7 retrospective

## Tasks / Subtasks

- [x] Task 1: Schema — loan_annotations Table (AC: 1, 4)
  - [x] 1.1 Create `loan_annotations` table in `schema.ts`
  - [x] 1.2 Add index: `idx_loan_annotations_loan_id` on `loanId`
  - [x] 1.3 Add index: `idx_loan_annotations_created_at` on `createdAt`
  - [x] 1.4 Table is append-only: no `updatedAt`, no `deletedAt` columns. Immutability enforced at API level (no PUT/PATCH/DELETE endpoints)

- [x] Task 2: Schema — loan_event_flag_corrections Table (AC: 3, 4)
  - [x] 2.1 Create `loan_event_flag_corrections` table in `schema.ts`
  - [x] 2.2 Add index: `idx_loan_event_flag_corrections_loan_id` on `loanId`
  - [x] 2.3 Add index: `idx_loan_event_flag_corrections_created_at` on `createdAt`
  - [x] 2.4 Table follows `loan_state_transitions` and `temporal_corrections` append-only model

- [x] Task 3: Drizzle Migration (AC: 1, 3)
  - [x] 3.1 Generate NEW Drizzle migration creating both tables + indexes → `0030_same_selene.sql`
  - [x] 3.2 **CRITICAL: Generate NEW migration, never re-run existing**

- [x] Task 4: Annotation Service (AC: 1, 2, 7)
  - [x] 4.1 Create `apps/server/src/services/annotationService.ts`
  - [x] 4.2 Implement `addAnnotation(loanId, content, userId, mdaScope)`
  - [x] 4.3 Implement `getAnnotations(loanId, mdaScope)`
  - [x] 4.4 NO update or delete methods — immutability enforced at service level

- [x] Task 5: Event Flag Correction Service (AC: 3, 4, 5, 6, 7)
  - [x] 5.1 Create `apps/server/src/services/eventFlagCorrectionService.ts`
  - [x] 5.2 Implement `correctEventFlag(loanId, input, userId, mdaScope)`
  - [x] 5.3 Implement `getCorrections(loanId, mdaScope)`
  - [x] 5.4 Implement optional employment event check (AC 6)

- [x] Task 6: Shared Types & Schemas (AC: 1, 3)
  - [x] 6.1 Create `packages/shared/src/types/annotation.ts`
  - [x] 6.2 Create `packages/shared/src/validators/annotationSchemas.ts`
  - [x] 6.3 Add vocabulary entries to `VOCABULARY` and `UI_COPY`
  - [x] 6.4 Export from `packages/shared/src/index.ts`

- [x] Task 7: API Routes (AC: 1, 2, 3, 5, 7)
  - [x] 7.1 Create `apps/server/src/routes/annotationRoutes.ts` with 4 endpoints
  - [x] 7.2 Annotation write endpoints: authenticate → requirePasswordChange → authorise(SUPER_ADMIN, DEPT_ADMIN) → scopeToMda → writeLimiter → validate → auditLog
  - [x] 7.3 Read-only access for MDA_OFFICER on GET endpoints
  - [x] 7.4 Audit actions logged via auditLog middleware
  - [x] 7.5 Register routes in `app.ts`

- [x] Task 8: Frontend — Annotation Section on Loan Detail (AC: 1, 2)
  - [x] 8.1 Create `LoanAnnotations.tsx` — chronological list, inline add form, role-based visibility
  - [x] 8.2 Loading skeleton + error state

- [x] Task 9: Frontend — Event Flag Correction Section (AC: 3, 5)
  - [x] 9.1 Create `EventFlagCorrections.tsx` — correction list with flag badges + arrow transition
  - [x] 9.2 Create `CorrectEventFlagDialog.tsx` — original flag read-only, dropdown for new flag, reason textarea
  - [x] 9.3 Non-punitive badges using `EVENT_FLAG_LABELS` from vocabulary

- [x] Task 10: Frontend — TanStack Query Hooks (AC: 1, 2, 3)
  - [x] 10.1 Create `useAnnotations.ts` with `useAnnotations`, `useAddAnnotation`, `useEventFlagCorrections`, `useCorrectEventFlag`

- [x] Task 11: Loan Detail Page Integration (AC: 2, 5)
  - [x] 11.1 Replaced PlaceholderSection "Annotations" with `<LoanAnnotations loanId={loanId} />`
  - [x] 11.2 Added `<EventFlagCorrections loanId={loanId} />` below annotations
  - [x] 11.3 Both sections are self-contained (self-fetch via hooks)

- [x] Task 12: Backend Tests (AC: all)
  - [x] 12.1 Create `annotationService.test.ts` — 5 tests: create, list, MDA scoping, 404, SUPER_ADMIN bypass
  - [x] 12.2 Create `eventFlagCorrectionService.test.ts` — 8 tests: save with values, self-correction rejected, reason min 10, MDA scoping, suggestCreateEvent yes/no/none-flag, 404, list order

- [x] Task 13: Frontend Tests (AC: 1, 2, 3)
  - [x] 13.1 Create `LoanAnnotations.test.tsx` — 5 tests: empty state, list, add button, loading, error
  - [x] 13.2 Create `CorrectEventFlagDialog.test.tsx` — 5 tests: original flag, dropdown, reason textarea, submit disabled, char count

- [x] Task 14: Full Test Suite Verification (AC: all)
  - [x] 14.1 `pnpm typecheck` — zero type errors (4/4 packages clean)
  - [x] 14.2 `pnpm lint` — zero lint errors (15 pre-existing warnings only)
  - [x] 14.3 Server tests — 96 files, 1359 tests passing (+13 new)
  - [x] 14.4 Client tests — 83 files, 632 tests passing (+10 new), zero regressions

### Review Follow-ups (AI)
- [x] [AI-Review][HIGH] H1: `currentEventFlag` never passed to `EventFlagCorrections` — correction button unreachable [LoanDetailPage.tsx:187, EventFlagCorrections.tsx:42]
- [x] [AI-Review][HIGH] H2: File List missing 2 Drizzle meta files (`_journal.json`, `0030_snapshot.json`) — reconciliation FAIL
- [x] [AI-Review][MEDIUM] M1: `CorrectEventFlagDialog` uses custom modal overlay instead of shadcn Dialog — lacks focus trap, Escape, ARIA [CorrectEventFlagDialog.tsx:55]
- [x] [AI-Review][MEDIUM] M2: Hardcoded `EVENT_FLAG_OPTIONS` instead of importing `EVENT_FLAG_VALUES` from shared [CorrectEventFlagDialog.tsx:8-12]
- [x] [AI-Review][MEDIUM] M3: Duplicated `validateLoanAccess` across both services [annotationService.ts:8-24, eventFlagCorrectionService.ts:8-24]
- [x] [AI-Review][MEDIUM] M4: Duplicated `timeAgo` utility in LoanAnnotations + EventFlagCorrections [LoanAnnotations.tsx:11-19, EventFlagCorrections.tsx:11-19]
- [x] [AI-Review][MEDIUM] M5: Native `<select>` instead of shadcn Select component [CorrectEventFlagDialog.tsx:80-89]
- [x] [AI-Review][LOW] L1: Test queries native `<select>` by fragile `role="combobox"` [CorrectEventFlagDialog.test.tsx:43]
- [x] [AI-Review][LOW] L2: `UI_COPY.EVENT_FLAG_LABELS` cast widens type with `as Record<string, string>` [EventFlagCorrections.tsx:33]
- [x] [AI-Review][LOW] L3: `auditLog` middleware on GET endpoints generates unnecessary audit volume [annotationRoutes.ts:54,98]
- [x] [AI-Review][DEPLOY] F1: MDA reference data not seeded in production — extracted to `seedReferenceMdas.ts`, runs on all-env startup
- [x] [AI-Review][DEPLOY] F2: Docker Compose `--force-recreate` added to deploy step in ci.yml
- [x] [AI-Review][DEPLOY] F3: `BUILD_SHA` env in Dockerfile + health endpoint version + CI deploy verification
- [x] [AI-Review][DEPLOY] F4: MDA drill-down page already renders `mdaDetail.data.name` — root cause was F1 (no MDAs in prod DB)

## Dev Notes

### Technical Requirements

#### Annotation Design — Append-Only Pattern

Follows the established immutable pattern used by `loan_state_transitions` (Story 2.7) and `temporal_corrections` (Story 10.1):

- **No `updatedAt` column** — records are never modified
- **No `deletedAt` column** — records are never deleted
- **No PUT/PATCH/DELETE API endpoints** — only POST (create) and GET (read)
- **No service methods for update/delete** — immutability enforced at every layer

**Why not use the `baseline_annotations` table from 7.0g?** Different entity scope. `baseline_annotations` annotates ledger entries (migration baselines). `loan_annotations` annotates loans directly. Different FK targets, different use cases. Both tables are lightweight and purpose-specific.

#### Event Flag Correction — Original Value Preservation

**Critical design decision:** `submission_rows.eventFlag` is NEVER modified.

The submission row represents a historical fact: "In this CSV, the MDA declared event flag X for staff Y." A correction records a new fact: "On [date], Admin Z determined the correct flag should be Y, because [reason]."

Both records coexist. The system knows:
1. What the MDA originally declared (submission_rows.eventFlag)
2. What the correct value should be (loan_event_flag_corrections.newEventFlag)
3. Why the correction was made (correctionReason)
4. Who made the correction (correctedBy)

**Downstream impact:** Services that consume event flags (reconciliation engine, employment event service) should check for corrections:
```typescript
// Pattern for correction-aware flag reading:
const correction = await getLatestCorrection(loanId, submissionRowId);
const effectiveFlag = correction ? correction.newEventFlag : submissionRow.eventFlag;
```

This is a **future enhancement** — Story 7.3 creates the correction records. Future stories can integrate correction-aware reading into the pipeline.

#### Employment Event Sync (AC 6)

When a correction changes a flag from NONE to RETIREMENT (for example), the system should suggest creating a corresponding employment event. This is advisory, not automatic:

1. Correction saved → check `EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP[newEventFlag]`
2. If mapped type exists → query `employment_events` for this loan + type
3. If no matching event → response includes `{ suggestCreateEvent: true, suggestedEventType: 'RETIRED' }`
4. Frontend shows secondary prompt: "Would you like to file a RETIRED employment event?"
5. User confirms → navigate to employment event filing page (existing from Story 11.2)

**Not automatic** because: employment events trigger loan state transitions (ACTIVE → RETIRED). The admin should consciously decide to trigger that state change.

### Architecture Compliance

- **Append-only pattern:** Both tables follow `loan_state_transitions` model — no update, no delete, reason required
- **API envelope:** `{ success: true, data: LoanAnnotation[] | EventFlagCorrection }`
- **scopeToMda enforcement:** DEPT_ADMIN restricted to their MDA's loans
- **Non-punitive vocabulary:** "Correction" not "Fix". "Original value" not "Error". All text from vocabulary.ts constants
- **Audit trail:** Middleware logs `ANNOTATION_ADDED` and `EVENT_FLAG_CORRECTED` actions
- **No submission data modification:** submission_rows.eventFlag remains untouched — correction is metadata alongside, not replacement

### Library & Framework Requirements

- **No new dependencies**
- **shadcn/ui:** Textarea (from 7.0e), Dialog, Select, Badge
- **Lucide React:** MessageSquare (annotations), Edit3 (corrections), ArrowRight (flag transition arrow)

### File Structure Requirements

#### New Files

```
apps/server/src/
├── services/annotationService.ts                      ← NEW: add + list annotations
├── services/annotationService.test.ts                 ← NEW: 4 test cases
├── services/eventFlagCorrectionService.ts             ← NEW: correct + list + event suggestion
├── services/eventFlagCorrectionService.test.ts        ← NEW: 7 test cases
└── routes/annotationRoutes.ts                         ← NEW: 4 API endpoints

apps/server/drizzle/
└── 0030_*.sql                                         ← NEW: loan_annotations + loan_event_flag_corrections tables. Migration sequence: 0024 (7.0b) → 0025 (7.0d) → 0026 (7.0g) → 0027 (7.0i) → 0028 (7.1) → 0029 (7.2) → **0030** (this story, FINAL in Epic 7)

packages/shared/src/
├── types/annotation.ts                                ← NEW: LoanAnnotation, EventFlagCorrection, request/response types
└── validators/annotationSchemas.ts                    ← NEW: add annotation + correct flag schemas

apps/client/src/
├── pages/dashboard/components/LoanAnnotations.tsx     ← NEW: annotation list + add form
├── pages/dashboard/components/LoanAnnotations.test.tsx ← NEW: component tests
├── pages/dashboard/components/EventFlagCorrections.tsx ← NEW: correction list + display
├── pages/dashboard/components/CorrectEventFlagDialog.tsx ← NEW: correction form dialog
├── pages/dashboard/components/CorrectEventFlagDialog.test.tsx ← NEW: dialog tests
└── hooks/useAnnotations.ts                            ← NEW: TanStack Query hooks
```

#### Modified Files

```
apps/server/src/
├── db/schema.ts                                       ← MODIFY: add loan_annotations + loan_event_flag_corrections tables
├── app.ts                                             ← MODIFY: register annotation routes

packages/shared/src/
├── constants/vocabulary.ts                            ← MODIFY: add annotation/correction vocabulary entries
├── index.ts                                           ← MODIFY: export new types/schemas

apps/client/src/
├── pages/dashboard/LoanDetailPage.tsx                 ← MODIFY: replace PlaceholderSection with LoanAnnotations + EventFlagCorrections
└── router.tsx                                         ← MODIFY: (if separate route needed — otherwise inline on loan detail)
```

### Testing Requirements

- **annotationService.test.ts:** Immutability, chronological ordering, MDA scoping, content validation
- **eventFlagCorrectionService.test.ts:** Original preservation, self-correction rejection, reason validation, event suggestion
- **LoanAnnotations.test.tsx:** List display, add form, empty state
- **CorrectEventFlagDialog.test.tsx:** Flag dropdown, reason validation, submit
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.1 (Exception Flagging & Queue)

- **Status:** ready-for-dev (as of 2026-03-20)
- **flagNotes field:** Story 7.1 adds `flagNotes` to exceptions. Annotations are a superset — any user can annotate any loan, while exception flagNotes are specific to the flagging context. Both coexist
- **Exception resolution may prompt annotations:** When resolving an exception, an admin may want to annotate the loan with the resolution context. The annotation form is available on the same page

#### From Story 7.2 (Inactive Loan Detection)

- **Status:** ready-for-dev (as of 2026-03-20)
- **Inactive exceptions may warrant annotations:** After resolving an inactive-loan exception, the admin may annotate the loan explaining why the gap occurred ("Staff on unofficial leave — MDA confirmed by phone")

#### From Story 11.2b (Manual Entry Event Flags)

- **Event flag enum complete:** All 11 active flag values defined in `EVENT_FLAG_VALUES` (excluding deprecated TERMINATION). The correction dropdown uses this same set

#### From Story 7.0b (Type Safety)

- **EVENT_FLAG_LABELS with satisfies constraint:** Labels for all event flags are type-safe. Use them in the correction dialog for display

#### From Mega-Retro Team Agreements

1. **Role-based UAT walkthrough** — test annotations + corrections as SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER (view-only)
2. **File list verification** — code review checklist item
3. **UAT checkpoint:** After 7.3, Awwal conducts full role-based walkthrough — exception queue + annotation + event correction

### Git Intelligence

**Expected commit:** `feat: Story 7.3 — Record Annotations & Event Flag Corrections with code review fixes`

### Critical Warnings

1. **NEVER modify submission_rows.eventFlag:** The CSV submission data is a historical fact. Corrections are metadata alongside, not replacements. Any service that needs the "effective" flag should check corrections — but that's a future enhancement, not this story
2. **Annotations are truly immutable:** No edit, no delete, no soft-delete. Once written, an annotation exists forever. This is intentional — institutional knowledge must persist even if the annotating user leaves
3. **Event flag correction is NOT an employment event:** A correction records "this flag was wrong, the right one is X." It does NOT trigger a loan state transition. The optional AC 6 suggests creating an employment event separately — with explicit user confirmation
4. **MDA scoping on GET endpoints:** MDA_OFFICER can VIEW annotations and corrections (read-only) for their MDA's loans. Only SUPER_ADMIN and DEPT_ADMIN can CREATE them
5. **Annotation content limit:** 2000 chars max to prevent abuse. Frontend Textarea should show character count
6. **Two new tables, one migration:** Create both `loan_annotations` and `loan_event_flag_corrections` in a single Drizzle migration for atomic schema change
7. **LoanDetailPage line numbers may shift:** Stories 7.0a (formatNaira removal) and 7.1 (Flag as Exception button) modify LoanDetailPage.tsx. The PlaceholderSection at line 177 may have shifted. Search for `"Annotations"` text to locate, not by line number
8. **This is the FINAL story in Epic 7.** After completion, run the Epic 7 retrospective

### Project Structure Notes

- This story completes the Epic 7 triangle: **Detection** (observation engine, 3.6) → **Escalation** (exception queue, 7.1) → **Resolution** (annotations + corrections, 7.3)
- Both new tables follow the established append-only pattern (no update/delete) used by 5 other tables in the system
- The annotation system is intentionally simple: free-text + author + timestamp. No categories, no threading, no reactions. This matches the PRD requirement (FR58) exactly
- The event flag correction system preserves the "CSV truth" while recording the "administrative truth" — both are valuable for audit purposes

### References

- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.3] — BDD acceptance criteria (FR58, FR59)
- [Source: _bmad-output/planning-artifacts/prd.md § FR58] — "Department Admin can add annotations (free-text notes) to any loan record"
- [Source: _bmad-output/planning-artifacts/prd.md § FR59] — "Department Admin can correct a previously submitted event flag through a correction workflow"
- [Source: apps/server/src/db/schema.ts § loan_state_transitions (lines 175-190)] — Append-only model with reason field (pattern for corrections)
- [Source: apps/server/src/db/schema.ts § temporal_corrections (lines 195-213)] — Old/new value preservation pattern
- [Source: apps/server/src/db/schema.ts § submission_rows (lines 587-609)] — Event flag storage (immutable CSV data)
- [Source: apps/server/src/db/schema.ts § employment_events (lines 627-651)] — Employment event table for AC 6 cross-reference
- [Source: packages/shared/src/constants/eventTypeMapping.ts] — EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP for AC 6
- [Source: apps/client/src/pages/dashboard/LoanDetailPage.tsx:177] — PlaceholderSection "Annotations" to replace
- [Source: packages/shared/src/constants/vocabulary.ts § EVENT_FLAG_LABELS] — Type-safe flag labels for correction display

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Implementation Plan

- Append-only tables for both annotations and corrections — follows `loan_state_transitions` pattern (no updatedAt, no deletedAt, no PUT/PATCH/DELETE)
- `submission_rows.eventFlag` is NEVER modified — corrections are metadata alongside, not replacements
- `validateLoanAccess()` shared helper in both services: loan exists + MDA scope check
- Employment event suggestion (AC 6): checks `EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP` after correction, returns `suggestCreateEvent` in response for frontend prompt
- All hooks use `apiClient` (not raw fetch) — applies the ESLint guardrail from the pre-session 401 fix
- Both frontend sections are self-contained components (self-fetch via TanStack Query hooks)

### Completion Notes

- Schema: 2 new append-only tables (`loan_annotations`, `loan_event_flag_corrections`) with proper FK constraints and indexes
- Migration: `0030_same_selene.sql` — atomic creation of both tables
- Backend: `annotationService.ts` (addAnnotation, getAnnotations), `eventFlagCorrectionService.ts` (correctEventFlag, getCorrections + AC 6 event suggestion)
- API: 4 endpoints under `/api/loans/:loanId/` — POST+GET for annotations, POST+GET for corrections. Write restricted to SUPER_ADMIN/DEPT_ADMIN, read includes MDA_OFFICER
- Frontend: `LoanAnnotations.tsx` (inline add form, reverse-chronological list), `EventFlagCorrections.tsx` (flag badge transition display), `CorrectEventFlagDialog.tsx` (modal with dropdown + reason)
- LoanDetailPage: Annotations placeholder replaced, Event Flag Corrections section added below
- Vocabulary: 12 new entries across VOCABULARY (6) and UI_COPY (12) — all non-punitive ("Correction" not "Fix", "Original" not "Error")
- All tests green: shared 416 + server 1359 + client 632 = **2407 tests** (was 2384, +23 new)

## File List

### New Files
- `apps/server/drizzle/0030_same_selene.sql` — Migration: loan_annotations + loan_event_flag_corrections tables
- `apps/server/drizzle/meta/0030_snapshot.json` — Drizzle migration snapshot (auto-generated)
- `apps/server/src/services/loanAccessHelper.ts` — Shared validateLoanAccess helper for annotation + correction services
- `apps/server/src/services/annotationService.ts` — Add + list annotations with MDA scoping
- `apps/server/src/services/annotationService.test.ts` — 5 unit tests
- `apps/server/src/services/eventFlagCorrectionService.ts` — Correct + list + event suggestion
- `apps/server/src/services/eventFlagCorrectionService.test.ts` — 8 unit tests
- `apps/server/src/routes/annotationRoutes.ts` — 4 API endpoints
- `packages/shared/src/types/annotation.ts` — LoanAnnotation, EventFlagCorrection, request/response types
- `packages/shared/src/validators/annotationSchemas.ts` — addAnnotationSchema, correctEventFlagSchema
- `apps/client/src/hooks/useAnnotations.ts` — 4 TanStack Query hooks
- `apps/client/src/pages/dashboard/components/LoanAnnotations.tsx` — Annotation list + add form
- `apps/client/src/pages/dashboard/components/LoanAnnotations.test.tsx` — 5 component tests
- `apps/client/src/pages/dashboard/components/EventFlagCorrections.tsx` — Correction list + display
- `apps/client/src/pages/dashboard/components/CorrectEventFlagDialog.tsx` — Correction form dialog
- `apps/client/src/pages/dashboard/components/CorrectEventFlagDialog.test.tsx` — 5 component tests

### Modified Files
- `apps/server/drizzle/meta/_journal.json` — Drizzle migration journal updated with 0030 entry
- `apps/server/src/db/schema.ts` — Added loan_annotations + loan_event_flag_corrections tables
- `apps/server/src/app.ts` — Registered annotationRoutes
- `packages/shared/src/constants/vocabulary.ts` — Added 12 VOCABULARY + 12 UI_COPY entries
- `packages/shared/src/index.ts` — Export new types and validators
- `apps/client/src/pages/dashboard/LoanDetailPage.tsx` — Replaced Annotations placeholder, added EventFlagCorrections section

## Change Log

- 2026-03-25: Story 7.3 implemented — Record Annotations & Event Flag Corrections. 2 append-only tables, 4 API endpoints, annotation + correction UI on loan detail page, employment event suggestion (AC 6). 14 new files, 5 modified. 23 new tests (13 server + 10 client). Total: 2407 tests passing.
- 2026-03-25: Code review — 10 findings (2H 5M 3L) all resolved. H1: currentEventFlag not passed (correction unreachable). H2: File List missing Drizzle meta files. M1-M5: shadcn Dialog/Select, shared validateLoanAccess helper, timeAgo extraction, EVENT_FLAG_VALUES import. L1-L3: test resilience, type safety, removed auditLog from GET endpoints. New file: loanAccessHelper.ts. Full suite: 96+83 files, 1359+632=1991 tests passing, zero regressions.
- 2026-03-25: Production deployment findings added — 4 issues discovered during live deployment (see below).
- 2026-03-25: All 4 deployment findings implemented. F1: `seedReferenceMdas.ts` extracted from seed-demo, called on startup in all envs. F2: `--force-recreate` added to CI deploy. F3: `BUILD_SHA` baked into server/client Docker images, health endpoint exposes version, CI verifies deployed commit. F4: MdaDetailPage already correct (root cause was F1). +2 tests. Server: 97 files, 1361 tests.

## Production Deployment Findings (2026-03-25)

Three issues discovered during Story 7.3 deployment to `oyocarloan.com.ng`. All require implementation — the code review agent should treat these as mandatory action items alongside code quality findings.

### Immediate Fixes Already Applied (manual, pre-code-review)

The following manual interventions were performed on the production droplet to unblock the live site. These are **temporary fixes** — the code changes below make them permanent and automated.

1. **ghcr.io re-authentication** — Docker registry token had expired on the droplet. Re-authenticated with a new GitHub PAT (`read:packages` scope). The PAT used during this session was exposed in a terminal log and must be revoked and regenerated.

2. **Force-recreated all containers** — `docker compose -f compose.prod.yaml pull && docker compose -f compose.prod.yaml up -d --force-recreate --remove-orphans` to ensure latest images are running.

3. **Manual MDA seed** — Executed `scripts/seed-mdas-prod.sql` (63 MDAs) directly against the production database via `psql`. This is a one-time fix; Finding 1 below makes it permanent via startup seed.

4. **Token refresh fix (committed, PR #77 + #78)** — 23 raw `fetch()` calls across 7 hook files were migrated to use `authenticatedFetch`/`apiClient` for 401→refresh→retry. ESLint rule added to prevent recurrence. These changes are already merged to `main` and deployed.

### Finding 1: MDA Reference Data Not Seeded in Production (ROOT CAUSE)

**Symptom:** MDA list empty on live site — API returns `{"success":true,"data":[]}`.
**Root cause:** `seed-production.ts` only creates users. `devAutoSeed` seeds 63 MDAs but only runs in development. Production DB had zero MDAs.
**Impact:** Any page that depends on MDAs (migration upload, dashboard, compliance) shows empty data in production.

**Implementation instructions for code review agent:**

1. Create `apps/server/src/db/seedReferenceMdas.ts`:
   - Import `MDA_LIST` and `MDA_ALIASES` from `@vlprs/shared`
   - Import `mdas`, `mdaAliases` from schema
   - Use `ON CONFLICT (code) DO NOTHING` for idempotent inserts (safe on every startup)
   - After MDA inserts, set `parent_mda_id` for CDU → Agriculture relationship (existing logic from `seed-demo.ts`)
   - Export `async function seedReferenceMdas(): Promise<void>`
   - Log count of newly inserted MDAs (skip count if all already exist)

2. Call `seedReferenceMdas()` in `apps/server/src/index.ts`:
   - Run AFTER migrations, BEFORE `devAutoSeed`
   - Run in ALL environments (dev, test, production) — MDAs are reference data, not demo data
   - Wrap in try/catch so a seed failure doesn't crash the server

3. Update `apps/server/src/db/seed-demo.ts`:
   - Remove the MDA insert logic (it now lives in `seedReferenceMdas`)
   - `runDemoSeed()` should call `seedReferenceMdas()` first, then seed users only
   - This prevents duplicate MDA insertion attempts

4. Add test: `seedReferenceMdas.test.ts` — verify 63 MDAs inserted, idempotent on second call

**Design principle:** MDAs are reference data (same in all environments), not demo data. They belong in a startup seed that runs everywhere, not in a dev-only seed.

### Finding 2: Docker Compose Doesn't Force-Recreate Containers on Deploy

**Symptom:** After CI/CD deploy, droplet containers continued running stale images. `docker compose up -d` didn't detect the new image and skipped recreation.
**Root cause:** `docker compose up -d --remove-orphans` only recreates if it detects image/config changes. With mutable `latest` tags and Docker layer caching, compose can miss the change.
**Impact:** Code merged and images pushed, but live site served old code until manual `--force-recreate`.

**Implementation instructions for code review agent:**

1. In `.github/workflows/ci.yml`, update the deploy step (line ~132):
   ```yaml
   # Before:
   docker compose -f compose.prod.yaml up -d --remove-orphans
   # After:
   docker compose -f compose.prod.yaml up -d --force-recreate --remove-orphans
   ```

2. Add `--pull always` as a safety net (Docker Compose v2.20+):
   ```yaml
   docker compose -f compose.prod.yaml pull
   docker compose -f compose.prod.yaml up -d --force-recreate --remove-orphans
   ```
   The `pull` is already there — just ensure `--force-recreate` is added to `up`.

### Finding 3: No Build Version Verification After Deploy

**Symptom:** CI/CD health check passed (`/api/health` returned 200) but the running code was stale. Health check only verified the server was alive, not that it was running the correct version.
**Root cause:** Health endpoint returns `{"status":"ok"}` with no version identifier. The CD pipeline has no way to verify the deployed commit matches the expected one.
**Impact:** Silent deployment failures — the pipeline reports success even when the old code is still running.

**Implementation instructions for code review agent:**

1. Add `BUILD_SHA` to the server build:
   - In `Dockerfile.server`, add `ARG BUILD_SHA` and `ENV BUILD_SHA=$BUILD_SHA`
   - In `.github/workflows/ci.yml`, pass `BUILD_SHA=${{ github.sha }}` as a build arg for the server image

2. Expose version in health endpoint (`apps/server/src/routes/healthRoutes.ts`):
   ```typescript
   const BUILD_SHA = process.env.BUILD_SHA || 'dev';
   // In the health route handler:
   res.json({ status: 'ok', version: BUILD_SHA, timestamp: new Date().toISOString() });
   ```

3. Update the CD health check in `.github/workflows/ci.yml` to verify the deployed version:
   ```yaml
   - name: Verify deployment
     run: |
       for i in $(seq 1 12); do
         DEPLOYED=$(curl -sf https://oyocarloan.com.ng/api/health | jq -r '.version')
         if [ "$DEPLOYED" = "${{ github.sha }}" ]; then
           echo "Deployment verified: $DEPLOYED"
           exit 0
         fi
         echo "Expected ${{ github.sha }}, got $DEPLOYED — retrying in 15s..."
         sleep 15
       done
       echo "DEPLOYMENT VERIFICATION FAILED"
       exit 1
   ```

4. Optionally expose `VITE_BUILD_SHA` on the client too (for debugging via browser console):
   - Add `ARG BUILD_SHA` and `VITE_BUILD_SHA=$BUILD_SHA` to `Dockerfile.client` build stage
   - Pass `VITE_BUILD_SHA=${{ github.sha }}` as build arg in CI

### Finding 4: MDA Drill-Down Page Shows UUID Instead of MDA Name (UAT)

**Symptom:** Clicking an MDA card navigates to `/dashboard/mda/:mdaId`. The page heading shows "MDA f1de33a7" (the raw UUID) instead of the MDA name (e.g. "Ministry of Finance").
**Root cause:** The MDA detail/portfolio page extracts `mdaId` from the URL params and renders it directly in the heading/breadcrumb, instead of using the MDA name from the fetched data.
**Impact:** Poor UX — users see cryptic identifiers instead of recognizable MDA names. Affects all roles navigating the drill-down.

**Implementation instructions for code review agent:**

1. Locate the MDA detail page component (likely `apps/client/src/pages/dashboard/MdaPortfolioPage.tsx` or similar — the component rendered at route `/dashboard/mda/:mdaId`)
2. The page heading or breadcrumb currently renders the `mdaId` URL param directly (e.g. `MDA {mdaId}`)
3. The page likely already fetches MDA data (or loan data that includes `mdaName`) — use that resolved name in the heading instead of the UUID
4. If the MDA name is not yet available (loading state), show a skeleton or "Loading..." — never the raw UUID
5. Update the breadcrumb trail too if it shows the UUID (e.g. `Dashboard / MDA f1de33a7` → `Dashboard / Ministry of Finance`)
6. Check other drill-down pages that use entity IDs in headings — apply the same fix if found

### Retro Discussion Points

- **Reference data vs demo data:** The distinction was never codified. `MDA_LIST` is authoritative reference data but was only seeded by a dev-only function. Future reference data (tiers, roles, scheme config) should follow the same startup-seed pattern.
- **Deploy verification is non-negotiable:** A health check that doesn't verify the build version is a false positive. Every production deployment pipeline should confirm the running code matches the expected commit.
- **Docker compose stale container trap:** `up -d` with mutable tags is unreliable. Either use `--force-recreate` or pin images by digest. This affects any Docker-based deployment, not just VLPRS.
- **UAT on live before marking done:** The MDA UUID-in-heading issue would have been caught by a 30-second click-through on the live site. Add "verify live deployment" as a post-deploy checklist item.
