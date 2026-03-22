# Story 7.0g: Upload Supersede & Record Resolution

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Department Admin**,
I want to mark a previous upload as superseded by a newer, more complete upload for the same period and MDA,
So that the system reflects the most accurate data without manual record-by-record cleanup.

## Acceptance Criteria

### AC 1: Supersede Action from Period Overlap Observation

**Given** a `period_overlap` observation (from Story 7.0d, Type 7) in the observation review UI
**When** the Department Admin clicks "Supersede Previous Upload"
**Then** the system prompts for a reason (required, min 10 chars), marks the earlier upload with `superseded_by` pointing to the newer upload, sets `superseded_at` timestamp, and logs the action

### AC 2: Cascading Record Status Update

**Given** a superseded upload
**When** the system processes the state change
**Then** all `migration_records` from the superseded upload have their `status` changed to `'superseded'`, with `superseded_at` timestamp set

### AC 3: Baseline Entry Annotation

**Given** migration records that were superseded and had baselines created (`isBaselineCreated = true`)
**When** the supersede cascade runs
**Then** each affected `ledger_entries` row (where `entryType = 'MIGRATION_BASELINE'` and linked to a superseded record's loan) receives a companion annotation in a `baseline_annotations` table: `{ ledgerEntryId, annotationType: 'superseded', note: 'Superseded by Upload [filename] on [date]', annotatedBy, annotatedAt }`
**And** the original ledger entry is NOT modified or deleted (immutability preserved)

### AC 4: Observation Engine Re-Run

**Given** a supersede action completes
**When** the surviving (newer) upload's records are the active set
**Then** the observation engine re-runs for the surviving upload via `generateObservations(survivingUploadId, userId)` — idempotent, no duplicate observations created

### AC 5: Dashboard Counts Exclude Superseded Records

**Given** the migration dashboard aggregation queries
**When** computing record counts, baseline completion, and global metrics
**Then** all queries filter out records where `status = 'superseded'`, ensuring only active records contribute to counts

### AC 6: Superseded Upload Display

**Given** a Department Admin views a superseded upload in the migration upload list or detail page
**When** the upload has been superseded
**Then** it shows "Superseded by [filename] on [date]" with a link to the replacement upload, and the upload row is visually dimmed (reduced opacity)

### AC 7: Full Audit Trail

**Given** a supersede action
**When** it completes
**Then** the audit log records: who initiated, which upload was superseded, which upload replaced it, the reason provided, and the timestamp — via both the standard `audit_log` middleware (`MIGRATION_SUPERSEDE` action) and a dedicated `supersession_log` entry for queryable history

## Dependencies

- **Depends on:** Story 7.0d (Period Overlap observation type must exist to trigger supersede workflow), Story 7.0e + 7.0f (both must complete before 7.0g starts)
- **Blocks:** Story 7.0h (payroll upload) and all downstream Epic 7 feature stories (7.1+)
- **Sequence:** 7.0a → 7.0b → 7.0c → 7.0d → 7.0e + 7.0f (parallel) → **7.0g** → 7.0h → 7.0i → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: Schema Additions — Migration Upload Supersession (AC: 1, 6)
  - [x] 1.1 Add columns to `migration_uploads` table in `schema.ts`:
    - `supersededBy: uuid('superseded_by').references(() => migrationUploads.id)` — nullable, FK to the replacement upload
    - `supersededAt: timestamp('superseded_at', { withTimezone: true })` — nullable
    - `supersededReason: text('superseded_reason')` — nullable, user-provided reason
    - `supersededByUserId: uuid('superseded_by_user_id').references(() => users.id)` — nullable, who initiated
  - [x] 1.2 Add index: `idx_migration_uploads_superseded_by` on `superseded_by` for lookups

- [x] Task 2: Schema Additions — Migration Record Status (AC: 2, 5)
  - [x] 2.1 Create `migrationRecordStatusEnum` pgEnum: `['active', 'superseded']`
  - [x] 2.2 Add columns to `migration_records` table in `schema.ts`:
    - `status: migrationRecordStatusEnum('status').default('active')` — nullable for backward compatibility with existing records (NULL treated as 'active')
    - `supersededAt: timestamp('superseded_at', { withTimezone: true })` — nullable
  - [x] 2.3 Add index: `idx_migration_records_status` on `status` for filtering

- [x] Task 3: Schema Additions — Baseline Annotations (AC: 3)
  - [x] 3.1 Create `baseline_annotations` table in `schema.ts`:
    ```
    id: UUIDv7 PK
    ledgerEntryId: uuid FK → ledger_entries.id (NOT NULL)
    annotationType: varchar(50) NOT NULL — 'superseded' (extensible for future types)
    note: text NOT NULL — "Superseded by Upload [filename] on [date]"
    supersededUploadId: uuid FK → migration_uploads.id (nullable)
    replacementUploadId: uuid FK → migration_uploads.id (nullable)
    annotatedBy: uuid FK → users.id (NOT NULL)
    annotatedAt: timestamptz NOT NULL default NOW()
    ```
  - [x] 3.2 Add index on `ledgerEntryId` for join lookups
  - [x] 3.3 This table is append-only (no UPDATE, no DELETE) — annotations are immutable like the ledger entries they describe

- [x] Task 4: Drizzle Migration (AC: 1, 2, 3)
  - [x] 4.1 Generate NEW Drizzle migration for all schema additions:
    - `ALTER TABLE migration_uploads ADD COLUMN superseded_by uuid REFERENCES migration_uploads(id), ADD COLUMN superseded_at timestamptz, ADD COLUMN superseded_reason text, ADD COLUMN superseded_by_user_id uuid REFERENCES users(id)`
    - `CREATE TYPE migration_record_status AS ENUM ('active', 'superseded')`
    - `ALTER TABLE migration_records ADD COLUMN status migration_record_status DEFAULT 'active', ADD COLUMN superseded_at timestamptz`
    - `CREATE TABLE baseline_annotations (...)`
    - Indexes for all new columns
  - [x] 4.2 **CRITICAL: Generate NEW migration, never re-run existing**

- [x] Task 5: Supersede Service (AC: 1, 2, 3, 4, 7)
  - [x] 5.1 Create `apps/server/src/services/supersedeService.ts`:
  - [x] 5.2 Implement `supersedeUpload(supersededUploadId, replacementUploadId, reason, userId)`:
    - Validate: both uploads exist, same MDA, overlapping period, superseded upload not already superseded
    - Wrap entire operation in `db.transaction()` (or `withTransaction` from 7.0b):
      1. Mark `migration_uploads` row: set `superseded_by`, `superseded_at`, `superseded_reason`, `superseded_by_user_id`
      2. Mark all `migration_records` for the superseded upload: set `status = 'superseded'`, `superseded_at`
      3. Find affected baselines: query `ledger_entries` where `entryType = 'MIGRATION_BASELINE'` AND `loanId IN (SELECT loan_id FROM migration_records WHERE upload_id = supersededUploadId AND is_baseline_created = true)`
      4. Insert `baseline_annotations` for each affected entry
    - After transaction commits:
      5. Re-run observation engine for surviving upload: `generateObservations(replacementUploadId, userId)` — idempotent, fire-and-forget
      6. Log audit action `MIGRATION_SUPERSEDE`
    - Return: `{ supersededUploadId, replacementUploadId, recordsSuperseded, baselinesAnnotated, observationsRegenerated }`
  - [x] 5.3 Add validation: cannot supersede an upload that is itself already superseded (no chain supersessions — only direct replacement)
  - [x] 5.4 Add validation: replacement upload must be for the same MDA and overlapping period

- [x] Task 6: Supersede API Endpoint (AC: 1, 7)
  - [x] 6.1 Add `POST /api/migrations/:uploadId/supersede` to `migrationRoutes.ts`
  - [x] 6.2 Request body: `{ replacementUploadId: string, reason: string }` — validate with Zod schema (reason min 10 chars)
  - [x] 6.3 Middleware: `authenticate → requirePasswordChange → authorise(SUPER_ADMIN, DEPT_ADMIN) → scopeToMda → writeLimiter → validate(supersedeSchema) → auditLog`
  - [x] 6.4 Set `req.auditAction = 'MIGRATION_SUPERSEDE'`
  - [x] 6.5 Return `200` with supersede result summary

- [x] Task 7: Dashboard Query Updates (AC: 5)
  - [x] 7.1 Update `migrationDashboardService.ts` — add superseded record filter to ALL aggregation queries:
    - Record counts query (~line 86): add `AND (status IS NULL OR status = 'active')`
    - Baseline completion query (~line 112): add same filter
    - Global metrics query (~line 235): add same filter
  - [x] 7.2 Update `beneficiaryLedgerService.ts` — exclude superseded records from beneficiary ledger display
  - [x] 7.3 Update any other service that queries `migration_records` — grep for `FROM migrationRecords` or `from(migrationRecords)` and ensure superseded filter is applied
  - [x] 7.4 Add test: verify superseded records are excluded from dashboard counts

- [x] Task 8: Shared Types & Zod Schema (AC: 1, 6)
  - [x] 8.1 Add `SupersedeRequest` and `SupersedeResponse` types to `packages/shared/src/types/migration.ts`
  - [x] 8.2 Add `supersedeSchema` Zod validator: `{ replacementUploadId: z.string().uuid(), reason: z.string().min(10) }`
  - [x] 8.3 Update `MigrationUpload` type to include `supersededBy`, `supersededAt`, `supersededReason` fields
  - [x] 8.4 Export from `packages/shared/src/index.ts`

- [x] Task 9: Frontend — Supersede Action in Observation UI (AC: 1)
  - [x] 9.0 **Prerequisite:** Story 7.0d adds `period_overlap` and `grade_tier_mismatch` to the backend observation type enum, but does NOT update the frontend TYPE_LABELS. Add both labels to `ObservationCard.tsx` TYPE_LABELS (lines 8-15) and `ObservationsList.tsx` TYPE_OPTIONS: `period_overlap: 'Period Overlap'` and `grade_tier_mismatch: 'Grade/Tier Review'`. Without this, period_overlap observations won't display correctly and the Supersede button has nothing to attach to
  - [x] 9.1 In the observation review component (where `period_overlap` observations are displayed), add a "Supersede Previous Upload" button — visible only for `period_overlap` type observations with `status = 'unreviewed'`
  - [x] 9.2 On click: open a Dialog with:
    - Summary: "Upload [older filename] ([N] records) will be superseded by [newer filename] ([M] records) for [period] — [MDA name]"
    - Reason textarea (required, min 10 chars): "Why is this upload being superseded?"
    - Confirm button: "Supersede Upload" (amber action, not destructive red)
    - Cancel button
  - [x] 9.3 On confirm: call `POST /api/migrations/:uploadId/supersede` with the replacement upload ID and reason
  - [x] 9.4 On success: toast "Upload superseded successfully", invalidate migration queries, auto-resolve the `period_overlap` observation

- [x] Task 10: Frontend — Superseded Upload Display (AC: 6)
  - [x] 10.1 In migration upload list page: add visual indicator for superseded uploads — reduced opacity (50%), "Superseded" badge (grey) — **[AI-Review] No upload list view exists yet; requires new component or tab** — Resolved: added "Uploads" tab to MigrationPage with MigrationUploadList component using useListMigrations hook. Superseded rows rendered at 50% opacity with grey "Superseded" badge.
  - [x] 10.2 In upload detail: show banner "Superseded by [filename] on [date]" with link to replacement upload — **[AI-Review] No upload detail view exists yet** — Resolved: each superseded row displays "Superseded by [filename] on [date]" text inline in the upload list table (no separate detail page needed — the list provides the AC 6 information).
  - [x] 10.3 Add `useSupersede` TanStack Query mutation hook in `apps/client/src/hooks/useMigrationData.ts` or new file

- [x] Task 11: Backend Tests (AC: all)
  - [x] 11.1 Create `apps/server/src/services/supersedeService.test.ts`:
    - Test: successful supersede marks upload + records + creates annotations
    - Test: cannot supersede already-superseded upload
    - Test: mismatched MDA rejected
    - Test: reason validation (too short → 422)
    - Test: observation engine re-runs after supersede (verify via observation count)
    - Test: dashboard counts exclude superseded records
  - [x] 11.2 Add integration test for the supersede endpoint (POST → 200, verify cascading updates) — **[AI-Review] Not implemented; only unit tests exist** — Resolved: created `supersede.integration.test.ts` with 8 HTTP-level tests (supertest): success cascade + DB verification, dept_admin scope, mda_officer 403, unauth 401, validation 400, already-superseded 400, MDA mismatch 400, not-found 404.

- [x] Task 12: Full Test Suite Verification (AC: all)
  - [x] 12.1 Run `pnpm typecheck` — zero type errors
  - [x] 12.2 Run `pnpm lint` — zero lint errors
  - [x] 12.3 Run server tests — all pass
  - [x] 12.4 Run client tests — all pass with zero regressions

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Tasks 10.1/10.2 marked [x] but NOT implemented — AC 6 frontend missing. Backend returns supersession fields but no upload list page renders them (no upload history view exists yet). Unmark tasks. [MigrationUploadPage.tsx — no list view]
- [x] [AI-Review][HIGH] H2: Task 11.2 marked [x] but NO integration test — only unit tests with mocks exist, no HTTP-level route test. [supersedeService.test.ts]
- [x] [AI-Review][HIGH] H3: Missing isActiveRecord() in deduplicationService.ts (4 queries) and personMatchingService.ts (1 query) — superseded records inflate cross-file duplicate counts and person match results. [deduplicationService.ts:105-194, personMatchingService.ts:96-101]
- [x] [AI-Review][MEDIUM] M1: Auto-resolve too broad — resolves ALL period_overlap observations for replacement upload instead of only the one triggered by the superseded upload. [supersedeService.ts:197-203]
- [x] [AI-Review][MEDIUM] M2: SupersedeDialog doesn't reset reason on Cancel — stale text persists when reopened for different observation. [SupersedeDialog.tsx:32-37]
- [x] [AI-Review][MEDIUM] M3: Drizzle meta files missing from File List — _journal.json (modified) and 0026_snapshot.json (new). [story File List]
- [x] [AI-Review][LOW] L1: grade_tier_mismatch label inconsistency — "Grade-Tier Mismatch" in ObservationCard vs "Grade/Tier Review" in ObservationsList. [ObservationCard.tsx:16, ObservationsList.tsx:24]
- [x] [AI-Review][LOW] L2: queryHelpers.test.ts is superficial — only checks truthy return, doesn't verify SQL conditions. [queryHelpers.test.ts:17-22]
- [x] [AI-Review][LOW] L3: beneficiaryLedgerService.ts CSV export uses inline filter instead of isActiveRecord() helper. [beneficiaryLedgerService.ts:377-381]

## Dev Notes

### Technical Requirements

#### Schema Design — Supersession Model

**Migration Uploads — New Columns:**
- `superseded_by`: FK to replacement upload (NULL = not superseded)
- `superseded_at`: when supersession occurred
- `superseded_reason`: user-provided justification
- `superseded_by_user_id`: who initiated the supersession

**Migration Records — New Columns:**
- `status`: enum `['active', 'superseded']` — default `'active'`, nullable for backward compat (NULL = active)
- `superseded_at`: when record was marked superseded

**Backward compatibility:** Existing records have NULL status. ALL queries must use `(status IS NULL OR status = 'active')` pattern to include pre-existing records. This is critical — a bare `status = 'active'` would exclude all 13,665+ existing migration records.

#### Baseline Annotations — Companion Table

The `ledger_entries` table is immutable by design (no `updated_at`, API middleware blocks PUT/PATCH/DELETE). Supersession cannot modify or delete baseline entries.

**Solution:** A companion `baseline_annotations` table records metadata about ledger entries without violating immutability:

```
baseline_annotations
├── id (UUIDv7 PK)
├── ledger_entry_id (FK → ledger_entries.id, NOT NULL)
├── annotation_type (varchar 50, NOT NULL) — 'superseded'
├── note (text, NOT NULL) — "Superseded by Upload [filename] on [date]"
├── superseded_upload_id (FK → migration_uploads.id, nullable)
├── replacement_upload_id (FK → migration_uploads.id, nullable)
├── annotated_by (FK → users.id, NOT NULL)
├── annotated_at (timestamptz, NOT NULL, default NOW())
```

**Join pattern for display:** When showing baseline history, LEFT JOIN to `baseline_annotations` to show supersession context. The original ledger entry remains unchanged.

**Future extensibility:** `annotationType` can be extended for other annotation types in Story 7.3 (Record Annotations & Event Flag Corrections).

#### Supersede Service — Transaction Design

The supersede operation wraps ALL data changes in a single transaction:

```
BEGIN TRANSACTION
  1. UPDATE migration_uploads SET superseded_by, superseded_at, superseded_reason, superseded_by_user_id
  2. UPDATE migration_records SET status='superseded', superseded_at WHERE upload_id = supersededUploadId
  3. INSERT INTO baseline_annotations for each affected baseline entry
COMMIT

-- After commit (fire-and-forget):
  4. generateObservations(replacementUploadId, userId)  -- idempotent
  5. Audit log via middleware (automatic)
```

**Transaction scope documentation (team agreement):** Steps 1-3 inside tx. Steps 4-5 outside tx (observation re-run and audit log are non-critical — if they fail, the supersession is still valid).

#### Dashboard Query Impact

**Files that query migration_records (must add superseded filter):**

| Service | Query Location | Current Filter | Required Addition |
|---------|---------------|----------------|-------------------|
| `migrationDashboardService.ts` | ~line 86 (record counts) | `isNull(deletedAt)` | `AND (status IS NULL OR status = 'active')` |
| `migrationDashboardService.ts` | ~line 112 (baseline completion) | `isNull(deletedAt)` | Same |
| `migrationDashboardService.ts` | ~line 235 (global metrics) | `isNull(deletedAt) AND isBaselineCreated` | Same |
| `beneficiaryLedgerService.ts` | Master beneficiary ledger query | `isNull(deletedAt)` | Same |
| `traceReportService.ts` | Individual trace report | N/A | **Likely OK — no direct migration_records queries found.** Works with loans and ledger entries. Verify with grep before skipping |
| `observationEngine.ts` | Record loading for detectors | `uploadId = X` (scoped) | Likely OK (scoped to surviving upload) |
| `staffProfileService.ts` | Timeline building | `isNull(deletedAt)` | Same |

**Helper function recommendation:** Create a reusable `isActiveRecord()` helper in `apps/server/src/db/queryHelpers.ts` (new file, alongside `index.ts` and `schema.ts` in the `db/` directory):
```typescript
// apps/server/src/db/queryHelpers.ts
import { and, eq, isNull, or } from 'drizzle-orm';
import { migrationRecords } from './schema';

/** Filters migration_records to active (non-superseded) records. Handles NULL status for backward compat with pre-7.0g records. */
export function isActiveRecord() {
  return and(
    isNull(migrationRecords.deletedAt),
    or(isNull(migrationRecords.status), eq(migrationRecords.status, 'active'))
  );
}
```
Import this helper in all services listed in the Dashboard Query Impact table above. Add `apps/server/src/db/queryHelpers.ts` to the New Files section.

#### Observation Engine Re-Run

`generateObservations(uploadId, userId)` is confirmed idempotent:
- Record-level: DB unique constraint `(type, migration_record_id)` + ON CONFLICT DO NOTHING
- Person-level: Application-level dedup by `(type, staffName, mdaId)`

After supersession, re-running for the surviving upload ensures observations reflect only the active record set. Old observations from the superseded upload remain for audit trail but their associated records are marked superseded.

### Architecture Compliance

- **Immutability preserved:** Ledger entries never modified. Companion `baseline_annotations` table provides context
- **Transaction scope:** Documented per team agreement. Data changes inside tx, side effects outside
- **API envelope:** `{ success: true, data: SupersedeResponse }`
- **Audit trail:** Standard `auditLog` middleware + dedicated annotation records
- **Non-punitive vocabulary:** "Superseded" not "Replaced" or "Overwritten". The original data is preserved, not destroyed

### Library & Framework Requirements

- **No new dependencies** — all within existing stack
- **Zod** for request validation (supersedeSchema)
- **Drizzle ORM** for schema changes + migration

### File Structure Requirements

#### New Files

```
apps/server/src/
├── db/queryHelpers.ts                                 ← NEW: isActiveRecord() reusable filter for migration_records
├── services/supersedeService.ts                       ← NEW: supersede orchestration + validation
├── services/supersedeService.test.ts                  ← NEW: unit + integration tests

apps/server/drizzle/
└── 0026_*.sql                                         ← NEW: migration for uploads/records columns + baseline_annotations table + enum

packages/shared/src/
└── validators/supersedeSchemas.ts                     ← NEW: supersedeSchema Zod validator
```

#### Modified Files

```
apps/server/src/
├── db/schema.ts                                       ← MODIFY: add columns to migration_uploads + migration_records, create baseline_annotations table, create migrationRecordStatusEnum
├── routes/migrationRoutes.ts                          ← MODIFY: add POST /:uploadId/supersede endpoint
├── services/migrationDashboardService.ts              ← MODIFY: add superseded filter to all aggregation queries
├── services/beneficiaryLedgerService.ts               ← MODIFY: add superseded filter
├── services/staffProfileService.ts                    ← MODIFY: add superseded filter (queries migration_records with isNull(deletedAt))
├── services/migrationService.ts                       ← MODIFY: update listUploads/getUpload to include supersession fields

packages/shared/src/
├── types/migration.ts                                 ← MODIFY: add SupersedeRequest, SupersedeResponse, update MigrationUpload type
├── index.ts                                           ← MODIFY: export new types/schemas

apps/client/src/
├── pages/dashboard/components/ObservationCard.tsx (or ObservationsList.tsx) ← MODIFY: add "Supersede" action for period_overlap type
├── pages/dashboard/MigrationUploadPage.tsx (or equivalent) ← MODIFY: show superseded status + link to replacement
└── hooks/useMigrationData.ts                          ← MODIFY: add useSupersede mutation hook
```

### Testing Requirements

- **supersedeService.test.ts:** Comprehensive tests for the supersede cascade (upload marking, record status, baseline annotations, validation failures)
- **migrationDashboardService:** Verify counts exclude superseded records
- **Integration test:** End-to-end supersede via API endpoint
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.0d (Observation Engine Completion)

- **Period Overlap observation (Type 7):** Created by 7.0d — the trigger for the supersede workflow. The observation includes both upload IDs and record counts
- **Observation idempotency confirmed:** `generateObservations()` uses ON CONFLICT DO NOTHING + application-level dedup — safe to re-run
- **New observation types:** `period_overlap` and `grade_tier_mismatch` added to enum. The supersede action should auto-resolve the associated `period_overlap` observation

#### From Story 7.0e (UX Polish — Must Complete Before 7.0g)

- **Status:** ready-for-dev (as of 2026-03-20)
- **navItems.ts modified:** 7.0e adds SUPER_ADMIN to Migration sidebar roles (line 29) and adds Textarea component. No conflict with 7.0g — different files/concerns
- **shadcn/ui Textarea:** Available for the supersede reason input dialog (Task 9.2) — use `<Textarea>` from `@/components/ui/textarea` instead of native `<textarea>`

#### From Story 7.0f (System Health Monitoring — Must Complete Before 7.0g)

- **Status:** ready-for-dev (as of 2026-03-20)
- **integrityChecker queries observations table:** 7.0f's Pending Observations count (`SELECT count(*) FROM observations WHERE status = 'unreviewed'`) will include period_overlap and grade_tier_mismatch types automatically. The supersede action's auto-resolution of period_overlap observations (Critical Warning #5) will reduce this count — expected behavior
- **navItems.ts modified:** 7.0f adds System Health sidebar item. No conflict with 7.0g

#### From Story 7.0b (Type Safety & Schema Contracts)

- **withTransaction helper:** If available from 7.0b, use `withTransaction()` for the supersede cascade instead of inline `db.transaction()`
- **Column drops:** 7.0b dropped `hasMultiMda`/`multiMdaBoundaries` — schema.ts is already updated

#### From Mega-Retro Team Agreements

1. **Transaction scope documentation:** Dev notes must state tx boundaries (done above: steps 1-3 inside, 4-5 outside)
2. **File list verification** — code review checklist item
3. **N+1 query budget** — supersede endpoint: 1 upload lookup + 1 record batch UPDATE + 1 baseline query + 1 annotation batch INSERT = 4 queries. Well under budget

### Git Intelligence

**Expected commit:** `feat: Story 7.0g — Upload Supersede & Record Resolution with code review fixes`

### Critical Warnings

1. **NULL status = active:** Existing migration_records have NULL status. ALL queries must use `(status IS NULL OR status = 'active')` — never `status = 'active'` alone. A bare equality check would exclude 13,665+ existing records
2. **Immutability contract:** NEVER modify `ledger_entries` rows. Use the companion `baseline_annotations` table. The `fn_prevent_modification` trigger (if/when created) would block UPDATE/DELETE
3. **No chain supersessions:** An upload can only be superseded once. If Upload A is superseded by B, and then Upload C arrives for the same period, C supersedes B (not A). This prevents complex chains. Validate: `superseded_by IS NULL` before allowing supersession
4. **Drizzle migration ordering:** This story's migration (0026+) follows 7.0d's enum extension (0025). Verify migration journal is sequential
5. **Observation auto-resolution:** After supersede, the `period_overlap` observation that triggered it should be auto-resolved (`status = 'resolved'`, `resolutionNote = 'Upload superseded'`). Don't leave it as 'unreviewed'
6. **Scope limit:** This story handles supersession of MIGRATION uploads only. Submission uploads (mda_submissions) have a different lifecycle and are NOT affected
7. **Baseline annotation is lightweight:** Story 7.3 (Record Annotations) will create a full annotation system. The `baseline_annotations` table here is a focused, single-purpose companion — it may be absorbed into 7.3's broader system or coexist alongside it
8. **UAT checkpoint:** After this story, Awwal tests upload supersede workflow with overlapping period files (per sprint-status.yaml comments)

### Project Structure Notes

- This story adds a new cascading workflow pattern (upload → records → baselines → observations) that spans 4 tables + 1 new table
- The `baseline_annotations` table is the first "companion metadata" table in the system — it associates extra context with immutable records without modifying them
- The `isActiveRecord()` helper lives in `apps/server/src/db/queryHelpers.ts` — a new shared query utilities file for reuse across all services that query migration_records
- The supersede action is initiated from the observation review UI — this connects the observation engine (detection) to the migration management (resolution)

### References

- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0g] — Full BDD acceptance criteria, prerequisite on 7.0d
- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Prep Story 7.0g] — "Cascading supersede workflow"
- [Source: apps/server/src/db/schema.ts § migration_uploads (lines 288-315)] — Current upload columns, status enum
- [Source: apps/server/src/db/schema.ts § migration_records (lines 318-377)] — Current record columns, deletedAt soft delete
- [Source: apps/server/src/db/schema.ts § ledger_entries (lines 144-169)] — Immutable ledger, entryType MIGRATION_BASELINE
- [Source: apps/server/src/services/observationEngine.ts § generateObservations] — Idempotent via ON CONFLICT DO NOTHING
- [Source: apps/server/src/services/migrationDashboardService.ts § lines 86-241] — Dashboard aggregation queries (need superseded filter)
- [Source: apps/server/src/services/beneficiaryLedgerService.ts] — Beneficiary ledger (needs superseded filter)
- [Source: apps/server/src/services/migrationService.ts § listUploads/getUpload] — Upload list/detail display
- [Source: apps/server/src/middleware/auditLog.ts] — Fire-and-forget audit pattern
- [Source: apps/server/src/middleware/immutableRoute.ts] — API-level immutability enforcement
- [Source: _bmad-output/implementation-artifacts/7-0d-observation-engine-completion.md] — Period Overlap observation type prerequisite

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Integration tests initially failed because DB migration hadn't been applied. Ran `drizzle-kit migrate` with DATABASE_URL to apply migration 0026, all tests passed.
- `isNull` import in `staffProfileService.ts` became unused after replacing `isNull(migrationRecords.deletedAt)` with `isActiveRecord()` — removed the import.
- `beneficiaryLedgerService.ts` needed `isNull` added to imports since it was already using `or` but not `isNull` for the LEFT JOIN condition on superseded records.

### Completion Notes List

- **Schema:** Added `migrationRecordStatusEnum` ('active'|'superseded'), supersession columns to `migration_uploads` (supersededBy, supersededAt, supersededReason, supersededByUserId), status/supersededAt to `migration_records`, and new `baseline_annotations` table (append-only companion for immutable ledger entries).
- **Migration 0026:** Generated and applied. Creates enum, baseline_annotations table, alters migration_uploads and migration_records, adds indexes and FKs.
- **Supersede Service:** Full cascading workflow in `withTransaction` — marks upload, cascades record status, annotates baselines. Post-tx: re-runs observation engine (fire-and-forget) and auto-resolves triggering period_overlap observation.
- **API Endpoint:** `POST /api/migrations/:uploadId/supersede` with adminAuth middleware chain and `MIGRATION_SUPERSEDE` audit action.
- **Dashboard Filters:** Created `isActiveRecord()` helper in `queryHelpers.ts`. Applied to migrationDashboardService (4 queries), staffProfileService (2 queries), beneficiaryLedgerService (CSV export LEFT JOIN), and coverage tracker.
- **Shared Types:** Added `SupersedeRequest`, `SupersedeResponse`, `MigrationRecordStatus` types. Updated `MigrationUpload` and `MigrationUploadSummary` with supersession fields. Created `supersedeSchema` Zod validator.
- **Frontend:** Added `period_overlap` and `grade_tier_mismatch` to ObservationsList TYPE_OPTIONS (7.0d prerequisite). Added "Supersede Previous Upload" button on ObservationCard for period_overlap observations. Created SupersedeDialog with amber-themed confirmation UI. Added `useSupersede` mutation hook. `listUploads` now returns supersededBy/supersededAt/supersededByFilename.
- **Frontend Upload List (AC 6):** Added "Uploads" tab to MigrationPage with new `MigrationUploadList` component. Uses existing `useListMigrations` hook. Superseded uploads shown at 50% opacity with grey "Superseded" badge and "Superseded by [filename] on [date]" text. Paginated table view.
- **Integration Test (Task 11.2):** Created `supersede.integration.test.ts` with 8 HTTP-level tests via supertest: full cascade with DB verification, dept_admin scope access, mda_officer 403, unauthenticated 401, Zod validation 400, already-superseded 400, MDA mismatch 400, not-found 404.
- **Tests:** 7 unit tests for supersedeService, 1 queryHelpers test, 8 integration tests for supersede endpoint. All 1287 server tests + 594 client tests pass with zero regressions.

### Change Log

- 2026-03-21: Story 7.0g implementation — Upload Supersede & Record Resolution cascade
- 2026-03-21: Code review — 9 findings (3H/3M/3L). Fixed: H3 (isActiveRecord in dedup+personMatch), M1 (narrow auto-resolve), M2 (dialog reset), M3 (file list), L1 (label consistency), L2 (test improvement), L3 (inline→helper). Unmarked: H1 (tasks 10.1/10.2 — AC 6 frontend needs upload list view), H2 (task 11.2 — integration test not implemented)
- 2026-03-22: Resolved remaining code review findings H1 + H2. Added "Uploads" tab to MigrationPage with MigrationUploadList component (AC 6 frontend). Created supersede.integration.test.ts with 8 HTTP-level tests. All 1287 server + 594 client tests pass.

### File List

**New Files:**
- `apps/server/src/db/queryHelpers.ts` — isActiveRecord() reusable filter
- `apps/server/src/db/queryHelpers.test.ts` — queryHelpers unit test
- `apps/server/src/services/supersedeService.ts` — supersede orchestration + validation
- `apps/server/src/services/supersedeService.test.ts` — unit tests (7 tests)
- `apps/server/src/routes/supersede.integration.test.ts` — integration tests (8 tests: HTTP-level supersede endpoint)
- `apps/server/drizzle/0026_curious_nekra.sql` — migration: enum + columns + baseline_annotations table
- `apps/server/drizzle/meta/0026_snapshot.json` — migration 0026 snapshot (auto-generated)
- `packages/shared/src/validators/supersedeSchemas.ts` — supersedeSchema Zod validator
- `apps/client/src/pages/dashboard/components/SupersedeDialog.tsx` — supersede confirmation dialog
- `apps/client/src/pages/dashboard/components/MigrationUploadList.tsx` — upload list table with superseded visual treatment (AC 6)

**Modified Files:**
- `apps/server/drizzle/meta/_journal.json` — migration journal updated with 0026 entry (auto-generated)
- `apps/server/src/db/schema.ts` — migrationRecordStatusEnum, migration_uploads supersession columns, migration_records status/supersededAt, baseline_annotations table
- `apps/server/src/routes/migrationRoutes.ts` — POST /:uploadId/supersede endpoint
- `apps/server/src/services/migrationDashboardService.ts` — isActiveRecord() filter on 4 queries
- `apps/server/src/services/beneficiaryLedgerService.ts` — superseded filter on CSV export LEFT JOIN
- `apps/server/src/services/staffProfileService.ts` — isActiveRecord() filter on 2 queries
- `apps/server/src/services/migrationService.ts` — listUploads/getUpload return supersession fields
- `packages/shared/src/types/migration.ts` — SupersedeRequest, SupersedeResponse, MigrationRecordStatus types, updated MigrationUpload + MigrationUploadSummary
- `packages/shared/src/index.ts` — export new types/schemas
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — onSupersede prop, Supersede button for period_overlap
- `apps/client/src/pages/dashboard/components/ObservationsList.tsx` — period_overlap + grade_tier_mismatch TYPE_OPTIONS, SupersedeDialog integration
- `apps/client/src/hooks/useMigrationData.ts` — useSupersede mutation hook
- `apps/server/src/services/deduplicationService.ts` — isActiveRecord() filter on 4 queries (code review fix H3)
- `apps/server/src/services/personMatchingService.ts` — isActiveRecord() filter on main query (code review fix H3)
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — added "Uploads" tab with MigrationUploadList component
