# Story 15.0f: Federated Upload — MDA Officers Access Migration Upload

Status: done

## Story

As an **MDA Officer**,
I want to upload my MDA's migration data using the same Excel upload pipeline as the AG (three-vector validation, period detection, column mapping),
So that I can contribute data directly instead of waiting for the AG to upload on my behalf.

**Origin:** UAT Finding #28 (High — Significant Discovery) + #27 from E8 retro. Current AG-centric model doesn't scale to 63 MDAs. Infrastructure 90% built — migration upload engine, three-vector validation, selective baseline all exist. Gap: role gate, verification step, source attribution, Coverage Tracker source display.

**Priority:** HIGH — transforms the data pipeline from centralized (AG uploads for 63 MDAs) to federated (MDA officers upload, admins verify).

**Dependencies:** Story 15.0e (MDA Officer Dashboard & Sidebar) should be complete first — provides sidebar access to Migration page.

## Acceptance Criteria

1. **Given** an MDA Officer navigates to the Migration page, **When** they click "Upload Data", **Then** the upload wizard launches with their MDA pre-selected (no MDA selector shown) and they can upload an Excel file using the same three-vector pipeline as admins.

2. **Given** an MDA Officer completes an upload, **When** the upload finishes processing (column mapping, three-vector validation, period detection all complete — same pipeline as admin), **Then** the upload status is set to `pending_verification` (instead of advancing to the normal `validated` workflow) and `uploadSource` is recorded as `'mda_officer'`. The officer sees a "Pending Admin Approval" badge. The admin can see the full validation results and data quality before deciding to approve.

3. **Given** an admin (SUPER_ADMIN or DEPT_ADMIN) views the Migration dashboard, **When** MDA officer uploads exist with `pending_verification` status, **Then** they are prominently listed with an "Approve" / "Reject" action.

4. **Given** an admin approves a `pending_verification` upload, **When** they click "Approve", **Then** the upload status transitions to `validated` (the next step in the pipeline after processing — the upload has already been parsed, mapped, and validated). The baseline workflow can now proceed. An audit log records the approval.

5. **Given** an admin rejects a `pending_verification` upload, **When** they click "Reject" with a mandatory reason, **Then** the upload status transitions to `rejected` and the MDA officer sees the rejection reason on their Migration page.

6. **Given** the Coverage Tracker, **When** cells have data from MDA officer uploads, **Then** each cell shows a source indicator distinguishing admin uploads from MDA officer uploads.

7. **Given** an MDA Officer attempts to upload for an MDA other than their assigned MDA, **When** the request reaches the server, **Then** it is rejected with 403 (enforced by `scopeToMda` middleware + explicit validation).

8. **Given** all existing migration tests, **When** the federated upload changes are applied, **Then** all tests pass with zero regressions.

## Infrastructure Already Built (90%)

| Component | Status | File |
|-----------|--------|------|
| Excel parsing + column mapping | DONE | `migrationService.ts:66-215` |
| Three-vector validation engine | DONE | `migrationValidationService.ts:103-180` |
| Period detection + era detection | DONE | `migrationService.ts` |
| Selective baseline pipeline | DONE | `baselineService.ts:439-654` |
| MDA scope middleware | DONE | `middleware/scopeToMda.ts` — sets `req.mdaScope` |
| `withMdaScope()` query filter | DONE | `lib/mdaScope.ts` |
| `uploadedBy` column | DONE | `schema.ts` — user attribution on every upload |
| MDA officer review workflow | DONE | `migrationRoutes.ts:308-460` — `reviewAuth` includes MDA_OFFICER |
| Coverage Tracker | DONE | `migrationDashboardService.ts` + frontend |
| Delineation + deduplication | DONE | Multi-MDA file splitting |

## What's Missing (The 10%)

| Gap | Type | Effort |
|-----|------|--------|
| Role gate on upload routes | Backend config | Low |
| `pending_verification` status enum | DB migration | Low |
| `uploadSource` column on uploads table | DB migration | Low |
| Admin approve/reject endpoints | Backend route + service | Medium |
| Auto-fill MDA for officers (skip selector) | Frontend logic | Low |
| Show upload button to MDA officers | Frontend permission | Low |
| Pending verification badge + status labels | Frontend display | Low |
| Coverage Tracker source indicator | Frontend + backend | Medium |

## Tasks / Subtasks

- [x] Task 1: Database migration — add `uploadSource` column and extend status enum (AC: 2, 6)
  - [x] 1.1: Run `drizzle-kit generate` to create a NEW migration that:
    - Adds `upload_source` varchar(20) column to `migration_uploads` table with default `'admin'`
    - Adds `'pending_verification'` and `'rejected'` values to `migration_upload_status` enum
  - [x] 1.2: Update `apps/server/src/db/schema.ts`:
    ```typescript
    // Extend enum
    export const migrationUploadStatusEnum = pgEnum('migration_upload_status', [
      'uploaded', 'mapped', 'processing', 'completed',
      'pending_verification', 'validated', 'reconciled', 'failed', 'rejected',
    ]);

    // Add column to migrationUploads table
    uploadSource: varchar('upload_source', { length: 20 }).notNull().default('admin'),
    ```
  - [x] 1.3: **CRITICAL:** Generate a NEW migration file. Never re-generate an existing migration (see `docs/drizzle-migrations.md`).

- [x] Task 2: Open role gate on upload routes (AC: 1, 7)
  - [x] 2.1: In `apps/server/src/routes/migrationRoutes.ts`, create a new auth array for upload routes that includes MDA_OFFICER:
    ```typescript
    const uploadAuth = [
      authenticate,
      requirePasswordChange,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
      scopeToMda,
    ];
    ```
  - [x] 2.2: Apply `uploadAuth` to the upload and confirm endpoints (lines ~39-96):
    - `POST /migrations/upload` — use `uploadAuth`
    - `POST /migrations/:id/confirm` — use `uploadAuth`
  - [x] 2.3: Keep `adminAuth` (without MDA_OFFICER) for admin-only operations like baseline creation, discard, and the new approve/reject endpoints.
  - [x] 2.4: Add explicit MDA validation in the upload handler for MDA officers:
    ```typescript
    // In POST /migrations/upload handler
    if (req.user!.role === ROLES.MDA_OFFICER) {
      if (mdaId !== req.mdaScope) {
        throw new AppError(403, 'CANNOT_UPLOAD_FOR_OTHER_MDA',
          'You can only upload data for your assigned MDA');
      }
    }
    ```

- [x] Task 3: Update upload service for source attribution + verification status (AC: 2)
  - [x] 3.1: In `apps/server/src/services/migrationService.ts`, update `previewUpload()` to accept and record upload source:
    ```typescript
    export async function previewUpload(
      fileBuffer: Buffer,
      filename: string,
      fileSizeBytes: number,
      mdaId: string,
      userId: string,
      userRole: string,  // NEW parameter
    ): Promise<MigrationUploadPreview> {
    ```
  - [x] 3.2: When creating the upload record, set `uploadSource` based on role:
    ```typescript
    uploadSource: userRole === ROLES.MDA_OFFICER ? 'mda_officer' : 'admin',
    ```
  - [x] 3.3: For MDA officer uploads, after processing completes, set status to `pending_verification` instead of advancing to normal workflow. The upload is "frozen" until admin approves.
  - [x] 3.4: In the `POST /migrations/upload` route handler (`migrationRoutes.ts:47-72`), pass `req.user!.role` as the 6th arg:
    ```typescript
    const result = await migrationService.previewUpload(
      fileBuffer, filename, fileSize, mdaId, req.user!.userId, req.user!.role,
    );
    ```

- [x] Task 4: Create admin approve/reject endpoints (AC: 3, 4, 5)
  - [x] 4.1: In `apps/server/src/routes/migrationRoutes.ts`, add two new endpoints (admin-only):
    ```typescript
    // PATCH /api/migrations/:uploadId/approve
    router.patch(
      '/migrations/:uploadId/approve',
      ...adminAuth,  // SUPER_ADMIN + DEPT_ADMIN only
      auditLog,
      async (req: Request, res: Response) => {
        const uploadId = param(req.params.uploadId);
        const result = await migrationService.approveUpload(uploadId, req.user!.userId);
        res.json({ success: true, data: result });
      },
    );

    // PATCH /api/migrations/:uploadId/reject
    router.patch(
      '/migrations/:uploadId/reject',
      ...adminAuth,
      validate(rejectUploadSchema),
      auditLog,
      async (req: Request, res: Response) => {
        const uploadId = param(req.params.uploadId);
        const { reason } = req.body;
        const result = await migrationService.rejectUpload(uploadId, req.user!.userId, reason);
        res.json({ success: true, data: result });
      },
    );
    ```
  - [x] 4.2: In `migrationService.ts`, implement `approveUpload()`:
    - Verify upload exists with status `pending_verification`
    - Update status to `validated` (the upload has already been parsed, mapped, and processed — approval advances it past the verification hold to the next stage where baseline can proceed)
    - Record approval in audit log
  - [x] 4.3: Implement `rejectUpload()`:
    - Verify upload exists with status `pending_verification`
    - Update status to `rejected`
    - Store rejection reason in the existing `metadata` JSONB column: `metadata: { ...existing, rejectionReason: reason, rejectedAt: new Date().toISOString(), rejectedBy: userId }`. Using `metadata` avoids an extra migration column — rejection reasons are only displayed per-upload, never queried in aggregate.
    - Soft-delete associated records if any were extracted
  - [x] 4.4: Add Zod schema for reject request: `{ reason: z.string().min(10) }`

- [x] Task 5: Update shared types (AC: 2, 6)
  - [x] 5.1: In `packages/shared/src/types/mda.ts`, add `uploadSource` to relevant types:
    ```typescript
    // CoveragePeriodData — add source tracking
    export interface CoveragePeriodData {
      recordCount: number;
      baselinedCount: number;
      uploadSource?: 'admin' | 'mda_officer';  // NEW
    }
    ```
  - [x] 5.2: Update `packages/shared/src/types/migration.ts:3` — add `pending_verification` and `rejected` to the `MigrationUploadStatus` type:
    ```typescript
    export type MigrationUploadStatus = 'uploaded' | 'mapped' | 'processing' | 'completed' | 'validated' | 'reconciled' | 'failed' | 'pending_verification' | 'rejected';
    ```

- [x] Task 6: Frontend — show upload button to MDA officers (AC: 1)
  - [x] 6.1: In `apps/client/src/pages/dashboard/MigrationPage.tsx`, update `canUpload`:
    ```typescript
    const canUpload = user?.role === ROLES.DEPT_ADMIN || 
                      user?.role === ROLES.SUPER_ADMIN ||
                      user?.role === ROLES.MDA_OFFICER;
    ```
  - [x] 6.2: Optionally change button text for MDA officers: "Upload My MDA Data" vs "Upload Legacy Data"

- [x] Task 7: Frontend — auto-fill MDA for officers in upload wizard (AC: 1)
  - [x] 7.1: In `apps/client/src/pages/dashboard/MigrationUploadPage.tsx`:
    - Detect MDA officer role
    - Auto-set `selectedMdaId` to `user.mdaId`
    - Skip the MDA selection step (jump straight to file upload)
    - Hide the MDA selector dropdown for officers
  - [x] 7.2: The MDA name can be obtained from the auth store or by calling `useMdaDetail(user.mdaId)`

- [x] Task 8: Frontend — pending verification status display (AC: 2, 3)
  - [x] 8.1: Update status label maps in upload list components to include:
    - `pending_verification` → "Pending Admin Approval" (amber badge)
    - `rejected` → "Rejected" (review badge with reason tooltip)
  - [x] 8.2: For admins, show "Approve" / "Reject" action buttons on `pending_verification` uploads
  - [x] 8.3: Create approve/reject mutation hooks:
    ```typescript
    export function useApproveUpload() { ... }
    export function useRejectUpload() { ... }
    ```

- [x] Task 9: Frontend — Coverage Tracker source indicator (AC: 6)
  - [x] 9.1: Update coverage tracker cells to show source icon/badge when `uploadSource === 'mda_officer'`
  - [x] 9.2: This is a nice-to-have within this story — can be deferred to a follow-up if it adds significant complexity

- [x] Task 10: Tests (AC: 7, 8)
  - [x] 10.1: Add integration test: MDA officer uploads file → gets `pending_verification` status
  - [x] 10.2: Add integration test: Admin approves upload → status changes to `validated`
  - [x] 10.3: Add integration test: Admin rejects upload → status changes to `rejected`
  - [x] 10.4: Add integration test: MDA officer cannot upload for other MDA → 403
  - [x] 10.5: Verify all existing migration tests pass with zero regressions
  - [x] 10.6: Run full test suite: `pnpm test` in both `apps/server` and `apps/client`

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: `deriveStage` + dashboard SQL CASE don't handle `pending_verification` / `rejected` — MDA with only officer uploads shows as "pending" [migrationDashboardService.ts:12-74]
- [x] [AI-Review][HIGH] H2: `approveUpload` / `rejectUpload` lack transaction wrapping — TOCTOU race condition [migrationService.ts:556-611]
- [x] [AI-Review][HIGH] H3: `listUploads` status filter cast missing new statuses [migrationService.ts:854]
- [x] [AI-Review][MEDIUM] M4: File List missing drizzle meta files + undocumented `package.json` change [story File List]
- [x] [AI-Review][MEDIUM] M5: Task 10.2 says "status changes to `uploaded`" — should be `validated` [story Tasks]
- [x] [AI-Review][MEDIUM] M6: Coverage tracker `innerJoin` doesn't filter `migrationUploads.deletedAt` [migrationDashboardService.ts:322]
- [x] [AI-Review][MEDIUM] M7: Completion note falsely claims step indicator renumbering [story Dev Agent Record]
- [x] [AI-Review][LOW] L8: `bool_or` loses mixed-source info in coverage tracker [migrationDashboardService.ts:319]
- [x] [AI-Review][LOW] L9: Approve/reject routes don't pass `req.mdaScope` — breaks pattern [migrationRoutes.ts:326-344]
- [x] [AI-Review][LOW] L10: `previewUpload` default `userRole = 'super_admin'` hides missing role [migrationService.ts:72]

## Dev Notes

### Fix Strategy: Extend Existing Infrastructure

The migration upload pipeline is fully built. This story opens the role gate, adds a verification checkpoint for MDA uploads, and provides admin approve/reject controls. No new upload engine or validation logic needed.

### Key Architecture Pattern: `scopeToMda` Already Enforces MDA Isolation

```typescript
// middleware/scopeToMda.ts
if (role === ROLES.MDA_OFFICER) {
  req.mdaScope = user.mdaId;  // Auto-scoped to assigned MDA
}
// lib/mdaScope.ts — applied in all queries
withMdaScope(migrationUploads.mdaId, mdaScope)
```

This means MDA officers can ONLY see/modify uploads for their assigned MDA. The scoping is enforced at the query level, not just the route level.

### Upload Flow Difference: Admin vs MDA Officer

| Step | Admin | MDA Officer |
|------|-------|-------------|
| Select MDA | Choose from dropdown | Auto-filled (own MDA) |
| Upload Excel | Same | Same |
| Column mapping | Same | Same |
| Period detection | Same | Same |
| Three-vector validation | Same | Same |
| After processing completes | Status: `completed` → advance to `validated` | Status: `completed` → advance to `pending_verification` (held) |
| Admin approval | N/A | Admin reviews data quality, clicks Approve → `validated` or Reject → `rejected` |
| Baseline creation | Admin initiates | Admin initiates (after approval advances status to `validated`) |

### Auth Middleware Arrays

| Array | Roles | Used For |
|-------|-------|----------|
| `adminAuth` | SUPER_ADMIN, DEPT_ADMIN | Baseline, discard, approve/reject |
| `uploadAuth` (NEW) | SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER | Upload, confirm |
| `reviewAuth` (existing) | SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER | Flagged record review |
| `readAuth` (existing) | All roles | Read-only endpoints |

### Migration Status Flow (Extended)

```
Admin upload:       uploaded → mapped → processing → completed → validated → reconciled
MDA officer upload: uploaded → mapped → processing → completed → pending_verification
                                                                       ↓
                                                           Admin approves → validated → reconciled
                                                           Admin rejects  → rejected
```

**Key:** `pending_verification` is inserted between `completed` and `validated`. The upload goes through the FULL parsing/mapping/validation pipeline first so the admin can see data quality before deciding. Approval advances to `validated` (not back to `uploaded`). Task 3.3 implements this fork — after processing completes, check `uploadSource` to decide next status.

### Files to Touch

| File | Action |
|------|--------|
| `apps/server/src/db/schema.ts` | Add `uploadSource` column, extend status enum |
| `apps/server/src/routes/migrationRoutes.ts` | New `uploadAuth` array, approve/reject endpoints |
| `apps/server/src/services/migrationService.ts` | Accept `userRole`, set source + verification status, approve/reject functions |
| `packages/shared/src/types/mda.ts` | Add `uploadSource` to coverage types |
| `apps/client/src/pages/dashboard/MigrationPage.tsx` | Update `canUpload` check |
| `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` | Auto-fill MDA for officers |
| `apps/client/src/pages/dashboard/components/MigrationUploadList.tsx` | Add status labels + approve/reject buttons |
| `apps/client/src/hooks/useMigration.ts` or `useMigrationData.ts` | Add approve/reject mutation hooks |
| New migration file | DB migration for column + enum changes |

### Drizzle Migration Warning

**CRITICAL:** Generate a NEW migration for the schema changes. Never re-generate an existing migration. See `docs/drizzle-migrations.md` for the full procedure. Run `drizzle-kit generate` after updating `schema.ts`.

### Architecture Compliance

- **MDA scoping:** Enforced by `scopeToMda` middleware + `withMdaScope()` query filter
- **Non-punitive vocabulary:** "Pending Admin Approval" not "Unapproved". "Rejected" with reason, not "Failed".
- **Audit trail:** All approve/reject actions logged via `auditLog` middleware
- **Every number is a doorway (Agreement #11):** Pending verification count on admin dashboard should be clickable
- **Empty states are UX (Agreement #13):** "No uploads pending verification" for admins

### Team Agreement Compliance

- **Agreement #5: File list verification** — dev must include exact file list
- **Agreement #6: Transaction scope documentation** — approve/reject should document tx boundaries
- **Agreement #12: Role-specific UAT** — test as MDA officer uploading, admin approving/rejecting

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Findings #28, #27]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-04-06.md` — Prep-5 assignment]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0f specification, line ~3482]
- [Source: `apps/server/src/routes/migrationRoutes.ts:39-44` — current adminAuth middleware]
- [Source: `apps/server/src/middleware/scopeToMda.ts` — MDA scoping logic]
- [Source: `apps/server/src/services/migrationService.ts:66-215` — previewUpload flow]
- [Source: `apps/server/src/routes/historicalSubmissionRoutes.ts:32-38` — MDA officer upload permission template]
- [Source: `apps/client/src/pages/dashboard/MigrationPage.tsx:30` — canUpload check]
- [Source: `apps/client/src/pages/dashboard/MigrationUploadPage.tsx:72-77` — MDA selector]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Integration test: 1 initial failure (error response path `body.error.code` not `body.code`) — fixed immediately

### Completion Notes List

- **Task 1:** Migration 0043 generated and applied. Added `upload_source` varchar(20) column with default `'admin'` and extended `migration_upload_status` enum with `pending_verification` (before `validated`) and `rejected` values.
- **Task 2:** Created `uploadAuth` middleware array including MDA_OFFICER. Applied to upload, confirm, overlap, list, detail, and validation GET endpoints. Added explicit MDA validation (`CANNOT_UPLOAD_FOR_OTHER_MDA` 403) in upload handler.
- **Task 3:** Added `userRole` parameter to `previewUpload()`. Set `uploadSource` based on role. Fork after processing: MDA officer uploads go to `pending_verification` instead of `completed`. Route handler passes `req.user!.role`.
- **Task 4:** Added `PATCH /migrations/:uploadId/approve` and `PATCH /migrations/:uploadId/reject` routes (admin-only). Service functions verify `pending_verification` status. Rejection reason stored in metadata JSONB. Added `rejectUploadSchema` (min 10 chars).
- **Task 5:** Extended `MigrationUploadStatus` type with `pending_verification` and `rejected`. Added `uploadSource` to `CoveragePeriodData`. Added `uploadSource` and `metadata` to `MigrationUploadSummary`. Updated `migrationUploadQuerySchema` status enum.
- **Task 6:** Updated `canUpload` in `MigrationPage.tsx` to include `MDA_OFFICER`. Button label changes to "Upload My MDA Data" for officers.
- **Task 7:** Added `useEffect` to auto-fill MDA and skip `select-mda` step for officers. Officers start directly on 'upload' step (no MDA selector). Reset keeps officer on their MDA.
- **Task 8:** Added `pending_verification` and `rejected` to status label/variant maps. Created `useApproveUpload()` and `useRejectUpload()` mutation hooks. Added approve (check icon) and reject (X icon) buttons for admins on `pending_verification` rows. Rejection dialog with mandatory reason textarea. MDA officer uploads shown with "Uploaded by MDA Officer" subtitle. Rejection reason displayed inline.
- **Task 9:** Added `uploadSource` to coverage tracker SQL via `bool_or()` join with `migrationUploads`. Frontend shows blue dot indicator on cells with MDA officer data and includes source in tooltip.
- **Task 10:** 10 integration tests (source attribution, MDA scoping, approve, reject, validation, list fields). Full regression: 609 integration + 1045 server unit + 673 client = 2,327 tests, zero failures.

### File List

**New files:**
- `apps/server/drizzle/0043_careful_texas_twister.sql` — DB migration
- `apps/server/drizzle/meta/0043_snapshot.json` — Drizzle migration snapshot (auto-generated)
- `apps/server/src/routes/federatedUpload.integration.test.ts` — 10 integration tests

**Modified files:**
- `apps/server/drizzle/meta/_journal.json` — Drizzle migration journal (auto-generated)
- `apps/server/src/db/schema.ts` — Extended status enum, added `uploadSource` column
- `apps/server/src/routes/migrationRoutes.ts` — `uploadAuth` middleware, approve/reject routes, MDA validation
- `apps/server/src/services/migrationService.ts` — `userRole` param, source attribution, status fork, approve/reject functions
- `apps/server/src/services/migrationDashboardService.ts` — Coverage tracker join for `uploadSource`, stage derivation for new statuses
- `packages/shared/src/types/migration.ts` — Extended `MigrationUploadStatus`, `MigrationUploadSummary`
- `packages/shared/src/types/mda.ts` — `uploadSource` on `CoveragePeriodData`
- `packages/shared/src/validators/migrationSchemas.ts` — `rejectUploadSchema`, extended query enum
- `packages/shared/src/index.ts` — Export `rejectUploadSchema`
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — `canUpload` includes MDA_OFFICER, contextual button label
- `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` — Auto-fill MDA, skip selector for officers
- `apps/client/src/pages/dashboard/components/MigrationUploadList.tsx` — Status labels, approve/reject UI, rejection display
- `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx` — Source indicator dot + tooltip
- `apps/client/src/hooks/useMigration.ts` — `useApproveUpload()`, `useRejectUpload()` hooks

### Change Log

- **2026-04-06:** Story 15.0f implemented — Federated upload pipeline. MDA officers can upload migration data using the same three-vector pipeline as admins. Uploads go through `pending_verification` status requiring admin approval before advancing. Admin approve/reject endpoints with audit trail. Coverage tracker shows MDA officer upload source. 10 integration tests, 2,327 total tests passing.
- **2026-04-06:** Code review — 10 findings (3H, 4M, 3L) all fixed: H1 stage derivation for new statuses, H2 transaction wrapping for approve/reject, H3 stale type cast in listUploads, M4 File List reconciliation, M5 task 10.2 typo, M6 deleted-upload filter on coverage join, M7 completion note correction, L8 mixed-source coverage indicator, L9 mdaScope in approve/reject routes, L10 remove default userRole parameter.
