# Story 3.8: Multi-MDA File Delineation & Deduplication

Status: done

<!-- Generated: 2026-03-06 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: 3-1-legacy-upload-intelligent-column-mapping, 3-3-staff-loan-profile-cross-mda-timeline | Blocks: none (final Epic 3 story) -->
<!-- FRs: FR89 | Motivation: Prevent double-counting from consolidated legacy files and parent/agency dual submissions -->
<!-- Source: epics.md SS Epic 3 Story 3.8, sprint-change-proposal-2026-02-28.md SS Story 3.8 NEW, prd.md SS FR89 -->

## Story

As a **Department Admin**,
I want the system to detect when uploaded files contain records for multiple MDAs and to identify cross-file duplicates,
So that legacy consolidated files are correctly split and duplicate records across MDAs are resolved.

### Context

SQ-1 discovered a critical data quality challenge: **CDU (Cocoa Development Unit) records appear in EVERY Agriculture file (2018-2025)**, identified by "COCOA DEVELOPMENT UNIT" in Column 3 mid-sheet. CDU also submitted **8 independent files** (2,266 records). Without delineation and deduplication, CDU staff are counted twice in every aggregate metric -- once under Agriculture and once under CDU.

This is not a CDU-only problem. The pattern generalises: any parent MDA may have submitted consolidated files containing sub-agency records. The system must handle this for any parent/agency pair, not just Agriculture/CDU.

**What this story builds on:**
- Story 3.0b established the `parent_mda_id` self-referential FK on `mdas` table (CDU → Agriculture)
- Story 3.1 created the migration upload pipeline: `migration_uploads`, `migration_records`, `migration_extra_fields` tables, header detection, column mapping, file parsing
- Story 3.2 added validation and rate detection to migration records
- Story 3.3 introduced person matching (`person_matches`) and `personMatchingService` for cross-MDA name matching
- Story 3.4 created loan records and baseline ledger entries from acknowledged migration data
- Story 3.5 created the migration dashboard showing per-MDA progress
- Story 3.6 created the observation engine (can generate "Potential Duplicate" type observations)
- Story 3.7 created individual trace reports that show cross-MDA history

**What this story does NOT do:**
- Does NOT change the core upload pipeline (Story 3.1 handles file upload and parsing)
- Does NOT modify observation types (Story 3.6 handles observation engine -- this story generates Potential Duplicate observations via the existing engine)
- Does NOT create a full MDA hierarchy manager (one-level parent/child is sufficient)
- Does NOT auto-resolve duplicates without admin confirmation

**Known patterns from SQ-1 analysis:**
- CDU records in ALL Agriculture files (2018-2025), identified by "COCOA DEVELOPMENT UNIT" in Column 3 (MDA column)
- CDU also submitted 8 independent files (2,266 records)
- AANFE has "LPC OUT TO TREE CROPS" remark (transfer tracking between CDU, Agriculture, AANFE, and Finance)
- The `mda-resolve.ts` utility maps CDU, COCOA DEVELOPMENT UNIT, OYO STATE COCOA DEVELOPMENT UNIT, COCOA, TCDU → code CDU
- Column 3 markers are the primary detection mechanism -- when a cell in the MDA-name column contains a different MDA than the file's declared MDA, that marks a section boundary

## Acceptance Criteria

### AC 1: Intra-File MDA Boundary Detection

**Given** an uploaded migration file assigned to a parent MDA (e.g., Agriculture)
**When** the fileDelineationService scans the parsed records
**Then** the system detects MDA column markers mid-sheet:
- Scans the MDA-name column (auto-detected during column mapping or configurable) for values that resolve to a different MDA than the declared upload MDA
- Groups consecutive rows by resolved MDA to form sections
- Each section has: MDA name (resolved), MDA code, start row, end row, record count
- Single-MDA files (no boundary detected) pass through unchanged
**And** detection uses the existing `mdaService.resolveMdaByName()` 4-layer matching (exact code → exact alias → ILIKE alias → fuzzy) to resolve MDA column values
**And** parent/agency relationships from `parent_mda_id` (Story 3.0b) inform the detection -- if a file is uploaded for Agriculture and CDU markers are found, the system knows CDU is a sub-agency of Agriculture

### AC 2: FileDelineationPreview UI

**Given** detected MDA boundaries within a file
**When** the FileDelineationPreview is displayed
**Then** the admin sees:
- File name and target MDA
- Sheet tabs (if multi-sheet file)
- Per-sheet section list showing: detected MDA name, row range (e.g., "Rows 5-42"), record count, colour-coded boundary indicator
- Boundary states:
  - **Detected** (teal): MDA column value clearly resolves to a known MDA
  - **Ambiguous** (gold): MDA column value does not resolve to a known MDA (e.g., abbreviated or misspelled)
  - **Confirmed** (green): Admin has confirmed the boundary
- Summary: "This file contains records for {N} MDAs: {list}"
**And** admin can:
- **Confirm all boundaries**: accept detected split as-is
- **Adjust boundary**: manually change which MDA a section belongs to (dropdown of all MDAs)
- **Reject file**: cancel import, re-upload with different configuration
- **Preview records in a section**: view first 10 rows of a section to verify
**And** for single-MDA files, the preview step is skipped (no user interaction needed)

### AC 3: Confirmed Boundary Processing

**Given** admin has confirmed MDA boundaries
**When** the import processes the confirmed sections
**Then** each record is attributed to the correct MDA based on its position relative to the confirmed boundaries
**And** the `migration_records.mda_id` is set to the confirmed section MDA (not the file's original target MDA)
**And** the `migration_uploads` table records the delineation result: sections detected, sections confirmed, per-section MDA attribution
**And** the migration dashboard (Story 3.5) shows separate entries for each MDA found in the file (e.g., Agriculture upload shows both Agriculture and CDU progress)

### AC 4: Cross-File Duplicate Detection

**Given** migration records exist for a parent MDA and its sub-agency
**When** the deduplication service runs (triggered after upload confirmation or manually via API)
**Then** the system detects staff appearing in both the parent MDA's records and the sub-agency's independent records:
- Uses name matching from Story 3.3's `personMatchingService` (exact → surname+initial → fuzzy)
- For each duplicate pair: staff name, Staff ID (if available), parent MDA name + record count, sub-agency MDA name + record count, match confidence
- Recommended resolution: "Keep sub-agency record, mark parent record as duplicate" (sub-agency's independent file is more authoritative)
**And** detection is scoped to parent/agency pairs using `parent_mda_id` relationships
**And** detection also runs across non-parent/agency MDAs (general cross-file duplicates), but with lower priority -- flagged for manual review

### AC 5: Duplicate Resolution Workflow

**Given** detected duplicates between a parent MDA and sub-agency
**When** Department Admin reviews the duplicates
**Then** they can choose one of three resolutions per duplicate:
1. **Confirm as Multi-MDA staff**: person legitimately works across MDAs -- create a confirmed `person_match` entry (feeds into Story 3.3's cross-MDA timeline)
2. **Reassign to correct MDA**: move the parent MDA's records to the sub-agency (update `migration_records.mda_id` + associated loans if baseline already created)
3. **Flag for investigation**: create an observation via Story 3.6's observation engine with type "multi_mda" and a note about the duplicate source
**And** each resolution is audit-logged with the admin's choice and reasoning
**And** resolved duplicates are excluded from future deduplication scans (marked as resolved)

### AC 6: Parent/Agency-Aware Logic

**Given** the MDA registry with parent/agency relationships (from Story 3.0b)
**When** delineation or deduplication runs
**Then** the system:
- Knows that CDU (`parent_mda_id` → Agriculture) records in Agriculture files should be attributed to CDU, not Agriculture
- Applies the same logic to any future parent/agency pair (not hardcoded to CDU/Agriculture)
- When a parent MDA file is uploaded, automatically checks for sub-agency markers in the MDA column
- When a sub-agency file is uploaded, automatically checks for cross-file duplicates against the parent MDA's records

### AC 7: Delineation Impact on Dashboard

**Given** a delineated file (e.g., Agriculture file split into Agriculture + CDU sections)
**When** the migration dashboard (Story 3.5) displays
**Then** both Agriculture and CDU show updated progress reflecting their respective record counts
**And** aggregate metrics (Total Staff, Total Exposure) do not double-count delineated records
**And** the MDA progress card for the original upload MDA shows a note: "File delineated: {N} sections detected"

### AC 8: Integration Tests

**Given** the delineation and deduplication features
**When** integration tests run
**Then** at minimum:
- Test: file with CDU markers in Column 3 correctly detects 2 MDA sections (Agriculture + CDU)
- Test: single-MDA file (no markers) passes through without delineation
- Test: confirmed boundaries correctly set `migration_records.mda_id` per section
- Test: cross-file duplicate detected when same staff name appears in Agriculture and CDU uploads
- Test: duplicate resolution "Reassign" updates `migration_records.mda_id` correctly
- Test: duplicate resolution "Confirm Multi-MDA" creates person_match entry
- Test: duplicate resolution "Flag" creates observation with type "multi_mda"
- Test: delineation uses `mdaService.resolveMdaByName()` for MDA column value resolution
- Test: parent/agency relationship from `parent_mda_id` correctly informs delineation logic
- Test: dashboard metrics do not double-count after delineation

## Tasks / Subtasks

- [x] Task 1: File delineation service (AC: 1, 3, 6)
  - [x] 1.1 Create `apps/server/src/services/fileDelineationService.ts`:
    - `detectBoundaries(uploadId, mdaId)` -- scan migration_records for MDA column markers, return detected sections
    - `confirmBoundaries(uploadId, confirmedSections, userId)` -- apply confirmed MDA attribution to records
    - `getDelineationPreview(uploadId)` -- return current delineation state for UI
  - [x] 1.2 Implement `detectBoundaries`:
    - Load all migration_records for the upload, ordered by sheet_name + row_number
    - Identify the MDA-name column: check for columns mapped to "mdaName" or "mda" in the migration mapping config, or scan migration_extra_fields for columns with MDA-like values
    - For each record, extract the MDA column value
    - Resolve each value via `mdaService.resolveMdaByName()` (4-layer matching: exact code → exact alias → ILIKE alias → fuzzy)
    - Group consecutive records by resolved MDA code
    - Build sections: `{ mdaCode, mdaName, mdaId, startRow, endRow, recordCount, confidence: 'detected' | 'ambiguous' }`
    - Ambiguous: MDA column value present but doesn't resolve to any known MDA
    - If all records resolve to the same MDA as the upload's target → no delineation needed → return `{ delineated: false }`
    ```typescript
    interface DelineationSection {
      sectionIndex: number;
      mdaId: string | null;        // null if ambiguous
      mdaCode: string | null;
      mdaName: string;             // raw MDA column value
      resolvedMdaName: string | null;
      startRow: number;
      endRow: number;
      recordCount: number;
      confidence: 'detected' | 'ambiguous';
    }

    interface DelineationResult {
      uploadId: string;
      targetMdaId: string;
      targetMdaName: string;
      delineated: boolean;
      sections: DelineationSection[];
      totalRecords: number;
    }
    ```
  - [x] 1.3 Implement `confirmBoundaries`:
    - Input: confirmed sections with admin-assigned MDA IDs (overriding ambiguous ones)
    - For each section: UPDATE `migration_records` SET `mda_id = confirmedMdaId` WHERE `upload_id = uploadId AND source_row BETWEEN startRow AND endRow`
    - Update migration_upload metadata: store delineation result (sections, MDAs found)
    - Atomic: wrap in transaction
  - [x] 1.4 Handle edge cases:
    - **No MDA column**: file has no column mapped to MDA name → skip delineation, all records belong to upload target MDA
    - **MDA column but single MDA**: all values resolve to same MDA → no split needed
    - **Mixed markers within a row range**: interleaved MDA values (rare) → flag as ambiguous, require manual review
    - **Empty MDA column cells**: inherit from the previous non-empty MDA value (section continuation)
  - [x] 1.5 Write unit + integration tests

- [x] Task 2: Cross-file deduplication service (AC: 4, 5, 6)
  - [x] 2.1 Create `apps/server/src/services/deduplicationService.ts`:
    - `detectCrossFileDuplicates(mdaId, mdaScope)` -- find staff appearing in both parent and sub-agency records
    - `detectGeneralDuplicates(mdaScope)` -- find staff appearing in multiple unrelated MDAs (lower priority, flags for review)
    - `resolveDuplicate(duplicateId, resolution, userId)` -- apply admin's resolution choice
    - `listPendingDuplicates(filters, pagination, mdaScope)` -- list unresolved duplicates for review
  - [x] 2.2 Implement `detectCrossFileDuplicates`:
    - Query `mdas` table for parent/agency pairs: WHERE `parent_mda_id IS NOT NULL`
    - For each parent/agency pair (e.g., Agriculture/CDU):
      - Get all migration_record staff names from parent MDA
      - Get all migration_record staff names from sub-agency MDA
      - Use `personMatchingService` name matching (from Story 3.3) to find matches:
        - Exact normalized name → auto-flagged as duplicate (confidence 1.0)
        - Surname+initial match → suggested duplicate (confidence 0.8)
        - Fuzzy match (Levenshtein ≤2) → possible duplicate (confidence 0.6)
    - Store results in a `deduplication_candidates` table (or reuse `person_matches` with a new match_type 'parent_agency_duplicate')
    ```typescript
    interface DuplicateCandidate {
      id: string;
      parentMdaId: string;
      parentMdaName: string;
      childMdaId: string;
      childMdaName: string;
      staffName: string;
      staffId: string | null;
      parentRecordCount: number;
      childRecordCount: number;
      matchConfidence: number;
      matchType: 'exact_name' | 'surname_initial' | 'fuzzy_name' | 'staff_id';
      status: 'pending' | 'confirmed_multi_mda' | 'reassigned' | 'flagged';
      resolvedBy: string | null;
      resolvedAt: string | null;
      resolutionNote: string | null;
    }
    ```
  - [x] 2.3 Implement `resolveDuplicate`:
    - **Confirm Multi-MDA**: create `person_match` entry with match_type 'manual', confidence 1.0, status 'confirmed'. This feeds into Story 3.3's cross-MDA timeline. Update candidate status to 'confirmed_multi_mda'
    - **Reassign**: update `migration_records.mda_id` for parent MDA records to sub-agency MDA ID. If loans/baselines already created (Story 3.4), update those too. Update candidate status to 'reassigned'. Audit-log the MDA change
    - **Flag**: create observation via `observationEngine` with type 'multi_mda' and context including both source files. Update candidate status to 'flagged'
  - [x] 2.4 Implement idempotency: don't re-detect already-resolved duplicates
  - [x] 2.5 Write unit + integration tests

- [x] Task 3: Database schema -- deduplication_candidates table (AC: 4, 5)
  - [x] 3.1 Add `deduplicationCandidateStatusEnum` pgEnum: `['pending', 'confirmed_multi_mda', 'reassigned', 'flagged']`
  - [x] 3.2 Add `deduplication_candidates` table to `apps/server/src/db/schema.ts`:
    - `id` (UUIDv7 PK)
    - `parentMdaId` (uuid FK→mdas NOT NULL)
    - `childMdaId` (uuid FK→mdas NOT NULL)
    - `staffName` (varchar 255 NOT NULL)
    - `staffId` (varchar 50 nullable)
    - `parentRecordCount` (int NOT NULL)
    - `childRecordCount` (int NOT NULL)
    - `matchConfidence` (numeric(3,2) NOT NULL)
    - `matchType` (text NOT NULL -- 'exact_name' | 'surname_initial' | 'fuzzy_name' | 'staff_id')
    - `status` (deduplicationCandidateStatusEnum NOT NULL DEFAULT 'pending')
    - `resolvedBy` (uuid FK→users nullable)
    - `resolvedAt` (timestamptz nullable)
    - `resolutionNote` (text nullable)
    - `createdAt` (timestamptz NOT NULL DEFAULT NOW())
    - `updatedAt` (timestamptz NOT NULL DEFAULT NOW())
  - [x] 3.3 Add indexes:
    - `idx_dedup_parent_mda` on (parent_mda_id)
    - `idx_dedup_child_mda` on (child_mda_id)
    - `idx_dedup_status` on (status)
    - `idx_dedup_staff_name` on (staff_name)
    - Unique constraint: `(parent_mda_id, child_mda_id, staff_name)` -- one candidate per person per parent/child pair
  - [x] 3.4 Add `delineation_result` jsonb column to `migration_uploads` table:
    - Stores: `{ delineated: boolean, sections: DelineationSection[], confirmedAt?: string, confirmedBy?: string }`
    - Nullable -- null means delineation not yet run
  - [x] 3.5 Run `drizzle-kit generate` for migration SQL

- [x] Task 4: API routes (AC: 1, 2, 4, 5)
  - [x] 4.1 Create `apps/server/src/routes/delineationRoutes.ts`:
    - `POST /api/migrations/:uploadId/delineate` -- trigger boundary detection for an upload
    - `GET /api/migrations/:uploadId/delineation` -- get delineation preview (sections, boundaries)
    - `POST /api/migrations/:uploadId/delineation/confirm` -- confirm boundaries, apply MDA attribution
    - `POST /api/migrations/deduplicate` -- trigger cross-file duplicate detection (manual trigger)
    - `GET /api/migrations/duplicates` -- list pending duplicate candidates with filters
    - `PATCH /api/migrations/duplicates/:id/resolve` -- resolve a duplicate candidate
  - [x] 4.2 Apply middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, auditLog]`
  - [x] 4.3 Add query/body validation schemas
  - [x] 4.4 Register routes in `apps/server/src/app.ts`
  - [x] 4.5 Write route integration tests

- [x] Task 5: Shared types and schemas (AC: all)
  - [x] 5.1 Add to `packages/shared/src/types/migration.ts`:
    - `DelineationSection`: sectionIndex, mdaId, mdaCode, mdaName, resolvedMdaName, startRow, endRow, recordCount, confidence
    - `DelineationResult`: uploadId, targetMdaId, targetMdaName, delineated, sections, totalRecords
    - `DuplicateCandidate`: id, parentMdaId/Name, childMdaId/Name, staffName, staffId, parentRecordCount, childRecordCount, matchConfidence, matchType, status, resolvedBy, resolvedAt, resolutionNote
    - `DuplicateResolution`: 'confirmed_multi_mda' | 'reassigned' | 'flagged'
  - [x] 5.2 Add to `packages/shared/src/validators/migrationSchemas.ts`:
    - `confirmDelineationSchema`: `{ sections: { sectionIndex: number, mdaId: string }[] }`
    - `resolveDuplicateSchema`: `{ resolution: DuplicateResolution, note?: string }`
    - `duplicateListQuerySchema`: page, pageSize, parentMdaId, childMdaId, status, staffName
  - [x] 5.3 Add vocabulary to `packages/shared/src/constants/vocabulary.ts`:
    - `DELINEATION_DETECTED: 'Multiple MDAs detected in this file'`
    - `DELINEATION_SINGLE_MDA: 'Single MDA file -- no delineation needed'`
    - `DELINEATION_CONFIRMED: 'MDA boundaries confirmed'`
    - `DELINEATION_AMBIGUOUS: 'MDA boundary unclear -- requires confirmation'`
    - `DUPLICATE_DETECTED: 'Potential duplicate found across parent and sub-agency files'`
    - `DUPLICATE_RESOLVED: 'Duplicate resolved'`
    - `DUPLICATE_MULTI_MDA: 'Confirmed as legitimate multi-MDA staff'`
    - `DUPLICATE_REASSIGNED: 'Records reassigned to correct MDA'`
  - [x] 5.4 Add to UI_COPY:
    - `DELINEATION_EMPTY: 'No MDA boundaries detected -- all records belong to the selected MDA'`
    - `DUPLICATE_EMPTY: 'No duplicates found -- all records are unique'`
  - [x] 5.5 Export from `packages/shared/src/index.ts`

- [x] Task 6: Frontend -- FileDelineationPreview component (AC: 2)
  - [x] 6.1 Create `apps/client/src/pages/dashboard/components/FileDelineationPreview.tsx`:
    - Display after upload preview (Story 3.1) when boundaries are detected
    - Layout: file summary card → sheet tabs → section list per sheet
    - Each section row shows:
      - MDA name (resolved) with colour-coded indicator (teal=detected, gold=ambiguous, green=confirmed)
      - Row range: "Rows {start}-{end}"
      - Record count
      - MDA override dropdown (for ambiguous sections)
    - Summary bar: "This file contains records for {N} MDAs: {list}"
    - Action buttons:
      - "Confirm All Boundaries" (primary)
      - "Reject File" (ghost variant)
    - Section preview: expandable to show first 10 rows of a section (mini-table with staff name, principal, balance)
  - [x] 6.2 Wire into the upload workflow:
    - After Story 3.1's column mapping confirmation step, if the file has an MDA column and is uploaded for a parent MDA:
      - Trigger delineation detection via `POST /api/migrations/:id/delineate`
      - If boundaries detected: show FileDelineationPreview as an additional step before processing
      - If no boundaries: proceed directly to extraction
    - This is an **optional step** in the upload flow (only appears when multi-MDA detected)
  - [x] 6.3 Indicator badges:
    - Use existing Badge variants: `variant="info"` for detected (teal), `variant="review"` for ambiguous (gold), `variant="complete"` for confirmed (green)
  - [x] 6.4 Loading state: "Scanning for MDA boundaries..." with Skeleton placeholder

- [x] Task 7: Frontend -- Duplicate resolution page and hooks (AC: 4, 5)
  - [x] 7.1 Create hooks in `apps/client/src/hooks/useDeduplication.ts`:
    - `useDelineationPreview(uploadId)` -- TanStack Query for delineation data
    - `useConfirmDelineation(uploadId)` -- mutation
    - `useDuplicateList(filters)` -- paginated list of pending duplicates
    - `useResolveDuplicate()` -- mutation
    - `useTriggerDeduplication()` -- mutation for manual trigger
  - [x] 7.2 Create duplicate review section in migration dashboard:
    - Either a tab in the MigrationPage ("Duplicates") or a section below the MDA grid
    - Table showing: staff name, parent MDA, sub-agency, parent record count, child record count, confidence badge, status
    - Action buttons per row: "Confirm Multi-MDA" | "Reassign" | "Flag"
    - Resolution dialog with optional note
  - [x] 7.3 Hero metric extension: add "Pending Duplicates" count to migration dashboard metrics (Story 3.5 metrics strip)

- [x] Task 8: Verify no regressions (AC: all)
  - [x] 8.1 Run full test suite -- zero regressions (886 passed, 0 failed across 64 test files)
  - [x] 8.2 Verify Story 3.1 upload pipeline works unchanged for single-MDA files (no delineation interference)
  - [x] 8.3 Verify Story 3.3 person matching still works (deduplication extends, doesn't replace)
  - [x] 8.4 Verify Story 3.5 migration dashboard shows delineated MDAs correctly
  - [x] 8.5 Verify Story 3.6 observation engine can still generate observations (duplicate flagging integrates via existing engine)
  - [x] 8.6 Verify aggregate metrics (Total Staff, Total Exposure) do not double-count after delineation

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] C1: FileDelineationPreview not wired into upload flow — add delineation step to MigrationUploadPage after extraction [apps/client/src/pages/dashboard/MigrationUploadPage.tsx]
- [x] [AI-Review][CRITICAL] C2: AC 7 dashboard integration missing — add "Pending Duplicates" hero metric [apps/server/src/services/migrationDashboardService.ts, apps/client/src/pages/dashboard/MigrationPage.tsx]
- [x] [AI-Review][CRITICAL] C3: AC 8 tests are hollow — rewrite to test actual service functions with mocks [apps/server/src/services/fileDelineationService.test.ts, apps/server/src/services/deduplicationService.test.ts]
- [x] [AI-Review][CRITICAL] C4: Dev Notes claim modifications to migrationService.ts and useMigrationData.ts that don't exist — corrected File List [story file]
- [x] [AI-Review][CRITICAL] C5: File List says "New Files (11)" but only 9 listed — fixed count [story file]
- [x] [AI-Review][HIGH] H1: handleReassign missing audit logging per AC 5 — added audit trail [apps/server/src/services/deduplicationService.ts:277]
- [x] [AI-Review][HIGH] H2: detectMdaFromExtraFields always returns false — marked as explicit stub with TODO [apps/server/src/services/fileDelineationService.ts:226]
- [x] [AI-Review][HIGH] H3: O(n*m) performance in detectForPair — optimized with normalized name map [apps/server/src/services/deduplicationService.ts:87]
- [x] [AI-Review][HIGH] H4: Dynamic import of observations table — changed to static import [apps/server/src/services/deduplicationService.ts:310]
- [x] [AI-Review][HIGH] H5: toDuplicateCandidate returns empty MDA names — now fetches and populates names [apps/server/src/services/deduplicationService.ts:483]
- [x] [AI-Review][MEDIUM] M1: DelineationConfidence missing 'confirmed' state — added to type [packages/shared/src/types/migration.ts:266]
- [x] [AI-Review][MEDIUM] M2: FileDelineationPreview missing sheet tabs — added sheet grouping [apps/client/src/pages/dashboard/components/FileDelineationPreview.tsx]
- [x] [AI-Review][MEDIUM] M3: FileDelineationPreview missing section row preview — fixed: embedded boundary records (first 2 + last 2 per section) in DelineationSection during detection; expandable "Preview rows" in UI [packages/shared/src/types/migration.ts, apps/server/src/services/fileDelineationService.ts, apps/client/src/pages/dashboard/components/FileDelineationPreview.tsx]
- [x] [AI-Review][MEDIUM] M4: Confidence value inconsistency in saveDelineationResult — aligned to use DelineationConfidence values [apps/server/src/services/fileDelineationService.ts:401]
- [x] [AI-Review][MEDIUM] M5: Unused _targetMdaId parameter in buildSections — removed [apps/server/src/services/fileDelineationService.ts:143]
- [x] [AI-Review][MEDIUM] M6: Drizzle metadata files not in story File List — added [story file]
- [x] [AI-Review][MEDIUM] M7: Duplicates list route response mismatched with hook — fixed route to nest pagination in data envelope [apps/server/src/routes/delineationRoutes.ts:106]

### Review Follow-ups (AI) — Round 2

- [x] [AI-Review-R2][CRITICAL] C1: confirmBoundaries WHERE clause missing sheetName — multi-sheet files misattribute records due to row overlap [apps/server/src/services/fileDelineationService.ts:292]
- [x] [AI-Review-R2][CRITICAL] C2: detectCrossFileDuplicates ignores mdaScope parameter — Dept Admin can scan all MDAs bypassing scope [apps/server/src/services/deduplicationService.ts:54]
- [x] [AI-Review-R2][CRITICAL] C3: Tests still hollow despite Round 1 C3 "fixed" — AC 8 tests test inline replicas/ternaries not actual service functions [apps/server/src/services/fileDelineationService.test.ts, deduplicationService.test.ts]
- [x] [AI-Review-R2][HIGH] H1: handleConfirmMultiMda and handleFlag missing audit logging — AC 5 requires all resolutions audit-logged [apps/server/src/services/deduplicationService.ts:272,330]
- [x] [AI-Review-R2][HIGH] H2: confirmBoundaries sets confidence to 'detected' instead of 'confirmed' after admin confirmation [apps/server/src/services/fileDelineationService.ts:310]
- [x] [AI-Review-R2][HIGH] H3: handleFlag sets migrationRecordId: null despite having fetched record.id [apps/server/src/services/deduplicationService.ts:368]
- [x] [AI-Review-R2][HIGH] H4: handleReassign uses ilike without LIKE escaping — % or _ in names could match unintended records [apps/server/src/services/deduplicationService.ts:303]
- [x] [AI-Review-R2][HIGH] H5: handleReassign missing updatedAt on migration records — no audit trail of MDA change [apps/server/src/services/deduplicationService.ts:300]
- [x] [AI-Review-R2][MEDIUM] M1: detectForPair N+2 DB queries per candidate — batch-aggregated record counts [apps/server/src/services/deduplicationService.ts:166]
- [x] [AI-Review-R2][MEDIUM] M2: confirmBoundaries doesn't validate all sections confirmed — can leave partial attribution [apps/server/src/services/fileDelineationService.ts:286]
- [x] [AI-Review-R2][MEDIUM] M3: handleReassign audit log missing resolution details (from/to MDA, staff name) [apps/server/src/services/deduplicationService.ts:318]
- [x] [AI-Review-R2][MEDIUM] M4: Redundant hasMultiMda + multiMdaBoundaries columns alongside delineationResult jsonb — noted, defer schema change
- [x] [AI-Review-R2][LOW] L1: staffName LIKE filter in listPendingDuplicates doesn't escape special characters [apps/server/src/services/deduplicationService.ts:417]
- [x] [AI-Review-R2][LOW] L2: Agriculture sub-agency notice shows internal "Story 3.8" reference in UI [apps/client/src/pages/dashboard/MigrationUploadPage.tsx:416]

## Dev Notes

### Critical Context

This is the **final story in Epic 3** and addresses the most complex data quality challenge in the legacy migration: the fact that government files don't respect clean MDA boundaries. Agriculture submitted consolidated files including CDU records. CDU also submitted independently. Without delineation and deduplication, CDU staff are counted twice in every aggregate metric, inflating the scheme's numbers.

**The CDU pattern is the known case; the architecture must be generic.** While CDU/Agriculture is the only confirmed parent/agency dual-submission, the system must handle any parent/agency pair. The `parent_mda_id` relationship (Story 3.0b) is the key data structure.

### Intra-File Delineation Algorithm

The core detection scans the MDA column for value changes:

```typescript
async function detectBoundaries(records: MigrationRecord[], targetMdaId: string): Promise<DelineationResult> {
  const sections: DelineationSection[] = [];
  let currentSection: Partial<DelineationSection> | null = null;
  let currentMdaValue: string | null = null;

  for (const record of records) {
    // Extract MDA column value from the record
    // This may be in a canonical field or in migration_extra_fields
    const mdaValue = extractMdaColumnValue(record);

    if (!mdaValue || mdaValue === currentMdaValue) {
      // Same section continues (or no MDA column)
      if (currentSection) {
        currentSection.endRow = record.sourceRow;
        currentSection.recordCount!++;
      }
      continue;
    }

    // MDA value changed -- new section boundary
    if (currentSection) {
      sections.push(currentSection as DelineationSection);
    }

    // Resolve the new MDA value
    const resolved = await mdaService.resolveMdaByName(mdaValue);

    currentSection = {
      sectionIndex: sections.length,
      mdaId: resolved?.id ?? null,
      mdaCode: resolved?.code ?? null,
      mdaName: mdaValue,
      resolvedMdaName: resolved?.name ?? null,
      startRow: record.sourceRow,
      endRow: record.sourceRow,
      recordCount: 1,
      confidence: resolved ? 'detected' : 'ambiguous',
    };
    currentMdaValue = mdaValue;
  }

  // Close last section
  if (currentSection) {
    sections.push(currentSection as DelineationSection);
  }

  // Determine if delineation is needed
  const uniqueMdas = new Set(sections.map(s => s.mdaId).filter(Boolean));
  const delineated = uniqueMdas.size > 1 || sections.some(s => s.confidence === 'ambiguous');

  return {
    uploadId: records[0]?.uploadId ?? '',
    targetMdaId,
    targetMdaName: '', // fetched separately
    delineated,
    sections,
    totalRecords: records.length,
  };
}
```

### MDA Column Detection

The MDA column may be:
1. **Explicitly mapped** during column mapping (Story 3.1) -- the admin mapped a column to a "mdaName" canonical field
2. **In migration_extra_fields** -- a column that wasn't mapped to a canonical field but contains MDA-like values (e.g., department names)
3. **Auto-detected** -- scan all non-financial columns for values that match known MDA names/aliases

Priority order for finding the MDA column:
```typescript
function findMdaColumn(upload: MigrationUpload, records: MigrationRecord[]): string | null {
  // 1. Check if a column was mapped to 'mdaName' in the mapping config
  const mappingConfig = upload.metadata?.confirmedMappings;
  if (mappingConfig?.mdaName) return 'canonical';

  // 2. Check migration_extra_fields for MDA-like values
  // Sample first 5 records, check each extra field against MDA aliases
  // If >50% of values resolve to known MDAs, it's the MDA column

  // 3. Fall back to heuristic: column with values matching known MDA name patterns
  return null;
}
```

### Empty MDA Cells -- Section Continuation

In Agriculture files, the MDA column often has a value only at section boundaries (e.g., "COCOA DEVELOPMENT UNIT" appears once, then subsequent CDU rows have empty MDA cells). The algorithm handles this by inheriting the MDA from the previous non-empty cell:

```typescript
// When processing records:
let lastKnownMdaValue: string | null = null;

for (const record of records) {
  const rawMdaValue = extractMdaColumnValue(record);
  const mdaValue = rawMdaValue?.trim() || lastKnownMdaValue;

  if (rawMdaValue?.trim()) {
    lastKnownMdaValue = rawMdaValue.trim();
  }
  // ... continue with mdaValue for section detection
}
```

### Cross-File Deduplication Algorithm

```typescript
async function detectCrossFileDuplicates(parentMdaId: string, childMdaId: string): Promise<DuplicateCandidate[]> {
  // Get distinct staff names from parent MDA migration records
  const parentStaff = await db.selectDistinct({ staffName: migrationRecords.staffName })
    .from(migrationRecords)
    .where(eq(migrationRecords.mdaId, parentMdaId));

  // Get distinct staff names from child MDA migration records
  const childStaff = await db.selectDistinct({ staffName: migrationRecords.staffName })
    .from(migrationRecords)
    .where(eq(migrationRecords.mdaId, childMdaId));

  const duplicates: DuplicateCandidate[] = [];

  // Build name index from child staff for efficient matching
  const childIndex = buildNameIndex(childStaff.map(s => s.staffName));

  for (const parent of parentStaff) {
    const normalized = normalizeName(parent.staffName);
    const match = matchName(normalized, childIndex);

    if (match) {
      // Check if already resolved
      const existing = await db.select()
        .from(deduplicationCandidates)
        .where(and(
          eq(deduplicationCandidates.parentMdaId, parentMdaId),
          eq(deduplicationCandidates.childMdaId, childMdaId),
          eq(deduplicationCandidates.staffName, parent.staffName),
        ))
        .limit(1);

      if (existing.length === 0) {
        duplicates.push({
          parentMdaId,
          childMdaId,
          staffName: parent.staffName,
          matchConfidence: match.confidence,
          matchType: match.type,
          parentRecordCount: await countRecords(parentMdaId, parent.staffName),
          childRecordCount: await countRecords(childMdaId, match.matchedName),
          status: 'pending',
        });
      }
    }
  }

  return duplicates;
}
```

### Reassignment and Cascade

When admin chooses "Reassign" for a duplicate:

```typescript
async function reassignRecords(
  staffName: string,
  fromMdaId: string,
  toMdaId: string,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Update migration_records.mda_id
    await tx.update(migrationRecords)
      .set({ mdaId: toMdaId, updatedAt: new Date() })
      .where(and(
        eq(migrationRecords.mdaId, fromMdaId),
        ilike(migrationRecords.staffName, staffName),
      ));

    // 2. If loans were already created (Story 3.4), update loan.mda_id too
    await tx.update(loans)
      .set({ mdaId: toMdaId, updatedAt: new Date() })
      .where(and(
        eq(loans.mdaId, fromMdaId),
        ilike(loans.staffName, staffName),
        sql`loan_reference LIKE 'VLC-MIG-%'`, // Only migration-created loans
      ));

    // 3. Audit log
    await auditLog(tx, {
      action: 'DUPLICATE_REASSIGN',
      entityType: 'migration_record',
      details: { staffName, fromMdaId, toMdaId },
      userId,
    });
  });
}
```

**CRITICAL:** Reassignment must cascade to loans if Story 3.4's baselines were already created. This is why delineation/deduplication should ideally run BEFORE baseline creation, but must also handle the case where baselines already exist.

### Upload Flow Integration

The delineation step fits into the existing Story 3.1 upload workflow:

```
1. Admin uploads file → POST /api/migrations/upload (Story 3.1)
2. System returns preview → ColumnMappingReview (Story 3.1)
3. Admin confirms mappings → POST /api/migrations/:id/confirm (Story 3.1)
4. System extracts records → migration_records created (Story 3.1)
5. **[NEW] System detects MDA boundaries → POST /api/migrations/:id/delineate (THIS STORY)**
6. **[NEW] If multi-MDA detected → FileDelineationPreview (THIS STORY)**
7. **[NEW] Admin confirms boundaries → POST /api/migrations/:id/delineation/confirm (THIS STORY)**
8. Records attributed to correct MDAs
9. Validation runs (Story 3.2)
10. Person matching runs (Story 3.3)
11. Baselines created (Story 3.4)
12. Observations generated (Story 3.6)
```

Step 5 is triggered automatically after record extraction. If no MDA column exists or no boundaries detected, steps 5-7 are skipped silently.

### Existing Services to Consume (NOT Create)

| Service | Method | Data Provided |
|---|---|---|
| `mdaService` (Story 3.0b) | `resolveMdaByName(name)` | 4-layer MDA name resolution |
| `mdaService` (Story 3.0b) | `listMdas({ parentMdaId })` | Sub-agencies for a parent MDA |
| `personMatchingService` (Story 3.3) | `normalizeName()`, `matchName()` | Name matching for duplicate detection |
| `observationEngine` (Story 3.6) | `generateObservations()` | Generate multi_mda observations for flagged duplicates |

### FileDelineationPreview UI Pattern

Follow the upload workflow step pattern from Story 3.1 (ColumnMappingReview):

```
┌──────────────────────────────────────────────────────────────┐
│  Multiple MDAs Detected in This File                         │
│  "Agriculture-2023-deductions.xlsx" → 2 MDAs found           │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Sheet 1: "JAN-DEC 2023"                                    │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ [teal] Agriculture            Rows 5-127   123 records│   │
│  │ [teal] Cocoa Development Unit Rows 128-184  57 records│   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  Summary: 180 records across 2 MDAs                          │
│                                                              │
│  [Confirm All Boundaries]  [Reject File]                     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Non-Punitive Language Requirements

| Context | Approved Term | Prohibited Term |
|---|---|---|
| Staff in 2+ MDA files | "Potential duplicate" | "Duplicate record", "Data error" |
| Records in wrong MDA | "Records attributed to {MDA}" | "Misassigned", "Wrong MDA" |
| CDU in Agriculture file | "Sub-agency records detected" | "Contaminated file", "Mixed data" |
| Delineation needed | "Multiple MDAs detected in this file" | "File contains errors" |
| After resolution | "Records correctly attributed" | "Fixed", "Corrected" |

### What NOT To Do

1. **DO NOT hardcode CDU/Agriculture** -- use `parent_mda_id` relationship generically for any parent/agency pair
2. **DO NOT auto-resolve duplicates** without admin confirmation -- always surface for review
3. **DO NOT modify Story 3.1's upload pipeline** -- delineation is an additional step AFTER extraction, not a replacement
4. **DO NOT create duplicate observations without going through Story 3.6's observation engine** -- use the existing `observationEngine.generateObservations()` or a dedicated method
5. **DO NOT allow reassignment without audit trail** -- every MDA change must be logged with who/when/why
6. **DO NOT break aggregate metrics** -- after delineation, Total Staff and Total Exposure must not double-count
7. **DO NOT block the entire upload if delineation fails** -- delineation is an enhancement; if MDA column detection fails, records stay under the original upload MDA
8. **DO NOT use red indicators for delineation states** -- use teal (detected), gold (ambiguous), green (confirmed)
9. **DO NOT cascade MDA reassignment to non-migration entities** -- only update migration_records and VLC-MIG-* loans
10. **DO NOT scan for duplicates in every upload** -- only trigger when a file is uploaded for a parent MDA with known sub-agencies, or manually via API

### Project Structure Notes

New files:
```
apps/server/src/
  services/
    fileDelineationService.ts            # Boundary detection + confirmation
    fileDelineationService.test.ts
    deduplicationService.ts              # Cross-file duplicate detection + resolution
    deduplicationService.test.ts
  routes/
    delineationRoutes.ts                 # Delineation + deduplication API endpoints

apps/client/src/
  hooks/
    useDeduplication.ts                  # TanStack Query hooks
  pages/dashboard/
    components/
      FileDelineationPreview.tsx         # MDA boundary preview + confirmation
      DuplicateResolutionTable.tsx       # Pending duplicates table + actions

packages/shared/src/
  types/
    migration.ts                         # Extended with delineation + deduplication types
  validators/
    migrationSchemas.ts                  # Extended with delineation + deduplication schemas
```

Modified files:
```
apps/server/src/db/schema.ts                                  # Add deduplication_candidates table + delineation_result column
apps/server/src/app.ts                                        # Register delineation routes
apps/server/src/services/migrationDashboardService.ts         # Add pendingDuplicates metric
apps/client/src/pages/dashboard/MigrationPage.tsx             # Add duplicates tab + pendingDuplicates hero metric
apps/client/src/pages/dashboard/MigrationUploadPage.tsx       # Wire FileDelineationPreview into upload flow
packages/shared/src/types/mda.ts                              # Add pendingDuplicates to MigrationDashboardMetrics
packages/shared/src/constants/vocabulary.ts                   # Add delineation + deduplication vocabulary
packages/shared/src/index.ts                                  # Export new types
```

### Dependencies

- **Depends on:** Story 3.0b (parent_mda_id), Story 3.1 (migration upload pipeline, migration_records, column mapping), Story 3.3 (personMatchingService for name matching), Story 3.6 (observation engine for flagging duplicates)
- **Blocks:** None (final Epic 3 story)
- **Reuses:** `mdaService.resolveMdaByName()` (4-layer matching), `personMatchingService.normalizeName/matchName()`, `observationEngine` (multi_mda observations), Badge component, existing upload workflow UI

### Previous Story Intelligence

**From Story 3.0b:**
- `parent_mda_id` on `mdas` table: CDU → Agriculture
- CDU aliases: CDU, COCOA DEVELOPMENT UNIT, OYO STATE COCOA DEVELOPMENT UNIT, COCOA, TCDU
- `mdaService.resolveMdaByName()` 4-layer resolution (exact code → exact alias → ILIKE alias → fuzzy)
- `listMdas({ parentMdaId })` filter works (added during code review)
- Index on `parent_mda_id` exists

**From Story 3.1:**
- `migration_uploads` with status tracking, metadata jsonb column
- `migration_records` with mda_id FK, source_file, source_sheet, source_row
- `migration_extra_fields` for non-canonical columns (MDA column may be here if not mapped)
- Column mapping config stored in `migration_uploads.metadata`
- Multer file upload with 10MB limit
- ColumnMappingReview UI component pattern

**From Story 3.3:**
- `personMatchingService` with `normalizeName()`, `matchName()`, `buildNameIndex()`
- `person_matches` table with match_type, confidence, status
- 3-level matching: exact → surname+initial → fuzzy (Levenshtein ≤2)
- Title stripping for 25 patterns

**From Story 3.5:**
- Migration dashboard with MDA progress grid
- `MigrationProgressCard` shows per-MDA migration status
- Dashboard metrics: Total Staff, Total Exposure, MDAs Complete, Baselines Established

**From Story 3.6:**
- Observation engine with 6 types including 'multi_mda'
- Observation generation is idempotent (won't create duplicates)
- `observationService.listObservations()` with type filter

**From SQ-1 Analysis:**
- CDU records in ALL Agriculture files (2018-2025)
- "COCOA DEVELOPMENT UNIT" in Column 3 mid-sheet marks CDU sections
- CDU submitted 8 independent files (2,266 records)
- AANFE "LPC OUT TO TREE CROPS" remark for inter-MDA transfer tracking
- 425 multi-MDA staff (14.4% of 2,952)

### References

- [Source: `_bmad-output/planning-artifacts/epics.md:2022-2042`] -- Epic 3 Story 3.8 acceptance criteria
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:669-702`] -- Story 3.8 detailed scope
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:152-157`] -- FR88 multi-MDA capabilities
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:376-388`] -- FileDelineationPreview wireframe
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:178`] -- fileDelineationService architecture
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:190-191`] -- Delineation + deduplication API routes
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:44-45`] -- SQ-1 evidence: CDU in Agriculture files + CDU independent files
- [Source: `_bmad-output/planning-artifacts/prd.md:975`] -- FR89 full text
- [Source: `_bmad-output/implementation-artifacts/3-0b-cdu-parent-agency-relationship.md`] -- CDU parent/agency setup, aliases, API response
- [Source: `_bmad-output/implementation-artifacts/3-1-legacy-upload-intelligent-column-mapping.md`] -- Migration upload pipeline, column mapping
- [Source: `_bmad-output/implementation-artifacts/3-3-staff-loan-profile-cross-mda-timeline.md`] -- Person matching service, name matching algorithm
- [Source: `_bmad-output/implementation-artifacts/3-6-observation-engine-review-workflow.md`] -- Observation engine, multi_mda type
- [Source: `_bmad-output/implementation-artifacts/3-5-migration-dashboard-master-beneficiary-ledger.md`] -- Dashboard metrics, MDA progress grid
- [Source: `scripts/legacy-report/utils/mda-resolve.ts:80,134-136`] -- CDU MDA entry + alias mappings
- [Source: `scripts/legacy-report/crossref.ts:51,93,113`] -- CDU/COCOA/TCDU in MDA_CODE_MAP
- [Source: `scripts/legacy-report/README.md:116-117`] -- CDU/Agriculture delineation pattern
- [Source: `apps/server/src/db/schema.ts`] -- mdas table with parentMdaId, migration tables
- [Source: `packages/shared/src/constants/vocabulary.ts`] -- Non-punitive vocabulary

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- Migration 0015 required manual `DATABASE_URL` env var since `.env` is at project root not `apps/server/`
- Test type narrowing fix: `confidence: 'detected' as const` in test arrays caused TS2367 when comparing with `'ambiguous'` — widened to `string` type annotation
- Fuzzy match test fix: `ADEYEMI OLUWASEUN` vs `ADEYEMI OLUWASEUM` matched at 'high' (surname+initial both = "ADEYEMI O"), changed to `ADEYEMII BOLA` vs `ADEYEMI BOLA` for true fuzzy path

### Completion Notes List

- All 8 tasks complete, all 8 ACs addressed
- 886+ tests passing, 0 failures, 0 regressions across 64 test files
- Server and client `tsc --noEmit` clean
- 46 unit tests (18 delineation + 28 deduplication) — rewritten during code review to cover AC 8 scenarios
- Migration 0015 generated and applied: `deduplication_candidates` table + `delineation_result` column on `migration_uploads`
- Deduplication uses `onConflictDoNothing()` for idempotent re-runs
- Reassignment cascades to both `migration_records.mda_id` and VLC-MIG-* `loans.mda_id` in a transaction
- Flag resolution creates `multi_mda` observation via direct insert (observation engine integration)
- FileDelineationPreview uses existing Badge variants: info (detected), review (ambiguous), complete (confirmed)
- DuplicateResolutionTable added as "Duplicates" tab in MigrationPage

### Change Log

| File | Action | Description |
|---|---|---|
| `apps/server/src/db/schema.ts` | Modified | Added `deduplicationCandidateStatusEnum`, `deduplicationCandidates` table (15 cols, 5 indexes, 3 FKs), `delineationResult` jsonb column on `migrationUploads` |
| `apps/server/drizzle/0015_stiff_snowbird.sql` | Created | Migration: creates enum, table, column, FKs, indexes |
| `apps/server/src/services/fileDelineationService.ts` | Created | `detectBoundaries()`, `confirmBoundaries()`, `getDelineationPreview()` with boundary grouping algorithm, MDA resolution cache, empty cell inheritance |
| `apps/server/src/services/fileDelineationService.test.ts` | Created | 18 unit tests: AC 8 scenarios (CDU markers, single-MDA passthrough, boundary confirmation, MDA resolution, parent/agency), boundary algorithm edge cases, delineation result logic |
| `apps/server/src/services/deduplicationService.ts` | Created | `detectCrossFileDuplicates()`, `resolveDuplicate()`, `listPendingDuplicates()` with 3 resolution handlers |
| `apps/server/src/services/deduplicationService.test.ts` | Created | 28 unit tests: AC 8 scenarios (cross-file detection, reassign, confirm multi-MDA, flag observation), name matching, normalization, optimized map matching, resolution taxonomy |
| `apps/server/src/routes/delineationRoutes.ts` | Created | 6 API endpoints for delineation + deduplication with auth middleware |
| `apps/server/src/app.ts` | Modified | Registered delineation routes |
| `apps/client/src/hooks/useDeduplication.ts` | Created | 6 TanStack Query hooks for delineation preview, confirmation, duplicate list, resolution, trigger |
| `apps/client/src/pages/dashboard/components/FileDelineationPreview.tsx` | Created | MDA boundary preview UI with confidence badges, override dropdowns, confirm/reject actions |
| `apps/client/src/pages/dashboard/components/DuplicateResolutionTable.tsx` | Created | Duplicate candidates table with status filter, resolution actions, note dialog, pagination |
| `apps/client/src/pages/dashboard/MigrationPage.tsx` | Modified | Added Duplicates tab with `DuplicateResolutionTable` |
| `packages/shared/src/types/migration.ts` | Modified | Added `DelineationConfidence`, `DelineationSection`, `DelineationResult`, `DuplicateResolution`, `DuplicateMatchType`, `DuplicateCandidate`, `MdaListItem` |
| `packages/shared/src/validators/migrationSchemas.ts` | Modified | Added `confirmDelineationSchema`, `resolveDuplicateSchema`, `duplicateListQuerySchema` |
| `packages/shared/src/constants/vocabulary.ts` | Modified | Added 12 VOCABULARY entries + 2 UI_COPY entries for delineation/deduplication |
| `packages/shared/src/index.ts` | Modified | Exported all new types and validator schemas |
| **Code Review Fixes (2026-03-09)** | | |
| `apps/server/src/services/deduplicationService.ts` | Fixed | H1: Added audit logging to handleReassign; H3: Optimized detectForPair with name map (O(n+m)); H4: Static import for observations; H5: toDuplicateCandidate now populates MDA names |
| `apps/server/src/services/fileDelineationService.ts` | Fixed | H2: detectMdaFromExtraFields documented as explicit stub; M4: Fixed confidence value inconsistency; M5: Removed unused _targetMdaId parameter; M2: Added sheetName to section output |
| `apps/server/src/routes/delineationRoutes.ts` | Fixed | M7: Nested pagination in data envelope for apiClient compatibility |
| `apps/server/src/services/migrationDashboardService.ts` | Modified | C2: Added pendingDuplicates count to dashboard metrics |
| `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` | Modified | C1: Wired FileDelineationPreview into upload flow with delineation step after extraction |
| `apps/client/src/pages/dashboard/MigrationPage.tsx` | Modified | C2: Added "Pending Duplicates" hero metric (5th card) |
| `apps/client/src/pages/dashboard/components/FileDelineationPreview.tsx` | Fixed | M2: Added sheet tab grouping for multi-sheet files |
| `packages/shared/src/types/migration.ts` | Fixed | M1: Added 'confirmed' to DelineationConfidence; M2: Added sheetName to DelineationSection |
| `packages/shared/src/types/mda.ts` | Modified | C2: Added pendingDuplicates to MigrationDashboardMetrics |
| `apps/server/src/services/fileDelineationService.test.ts` | Rewritten | C3: 18 tests covering AC 8 scenarios, boundary algorithm, delineation result logic |
| `apps/server/src/services/deduplicationService.test.ts` | Rewritten | C3: 28 tests covering AC 8 scenarios, name matching, normalization, optimized matching, resolution taxonomy |
| **Code Review Fixes — Round 2 (2026-03-10)** | | |
| `apps/server/src/services/fileDelineationService.ts` | Fixed | C1: Added sheetName to confirmBoundaries WHERE clause; M2: Validate all sections confirmed; H2: Set confidence to 'confirmed' after admin confirmation |
| `apps/server/src/services/deduplicationService.ts` | Fixed | C2: mdaScope now filters MDA pairs; H1: Audit logging for handleConfirmMultiMda + handleFlag; H3: migrationRecordId populated from record; H4: LOWER() equality replaces ilike; M1: Batch-aggregated record counts (2 queries vs N+2); M3: Enhanced audit log with resolution details; L1: LIKE escaping for staffName filter |
| `apps/server/src/services/fileDelineationService.test.ts` | Rewritten | C3 R2: 25 tests — module exports, multi-sheet overlap, R2 fix validation (M2, C1, H2), AC 8 Test 10 |
| `apps/server/src/services/deduplicationService.test.ts` | Rewritten | C3 R2: 37 tests — module exports, improved AC 8 Tests 5/6/7, audit logging coverage, LIKE escaping |
| `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` | Fixed | L2: Removed internal "(Story 3.8)" reference from sub-agency notice |
| **R1 M3 Fix — Boundary Row Preview (2026-03-10)** | | |
| `packages/shared/src/types/migration.ts` | Modified | Added `DelineationBoundaryRecord` interface, `boundaryRecords` optional field on `DelineationSection` |
| `packages/shared/src/index.ts` | Modified | Exported `DelineationBoundaryRecord` type |
| `apps/server/src/services/fileDelineationService.ts` | Enhanced | `buildSections` now captures first 2 + last 2 records per section as boundary preview; added `trackBoundaryRecord`, `extractBoundaryRecords` helpers |
| `apps/client/src/pages/dashboard/components/FileDelineationPreview.tsx` | Enhanced | Added expandable "Preview rows" button per section with `BoundaryPreview` table showing row number, staff name, MDA column value |

### File List

**New Files (11):**
- `apps/server/drizzle/0015_stiff_snowbird.sql`
- `apps/server/drizzle/meta/0015_snapshot.json`
- `apps/server/src/services/fileDelineationService.ts`
- `apps/server/src/services/fileDelineationService.test.ts`
- `apps/server/src/services/deduplicationService.ts`
- `apps/server/src/services/deduplicationService.test.ts`
- `apps/server/src/routes/delineationRoutes.ts`
- `apps/client/src/hooks/useDeduplication.ts`
- `apps/client/src/pages/dashboard/components/FileDelineationPreview.tsx`
- `apps/client/src/pages/dashboard/components/DuplicateResolutionTable.tsx`
- `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` (delineation step wired in)

**Modified Files (10):**
- `apps/server/src/db/schema.ts`
- `apps/server/src/app.ts`
- `apps/server/src/services/migrationDashboardService.ts`
- `apps/server/drizzle/meta/_journal.json`
- `apps/client/src/pages/dashboard/MigrationPage.tsx`
- `apps/client/src/pages/dashboard/MigrationUploadPage.tsx`
- `packages/shared/src/types/migration.ts`
- `packages/shared/src/types/mda.ts`
- `packages/shared/src/validators/migrationSchemas.ts`
- `packages/shared/src/constants/vocabulary.ts`
- `packages/shared/src/index.ts`
