# Story 8.0c: Migration Dashboard Hygiene

Status: ready-for-dev

## Story

As a **Super Admin**,
I want to discard incomplete/abandoned uploads from the Migration Dashboard, see clear variance labelling with MetricHelp tooltips, and have the test infrastructure updated,
So that the dashboard only shows meaningful data and the variance figures are self-explanatory without needing to ask the development team.

**Origin:** UAT Findings #3, #8 + Retro Debt Items #1, #3 from E7+E6 retro (2026-03-29).

**Dependencies:** None — this story is independent of 8.0a and 8.0b. Can be implemented in parallel.

## Acceptance Criteria

1. **Given** a migration upload in `uploaded`, `mapped`, or `failed` status, **When** the Super Admin clicks a "Discard" action on the upload row, **Then** a confirmation dialog appears explaining that discarding is permanent and the upload will no longer appear in the active list.

2. **Given** the discard confirmation is accepted, **When** the system processes the discard, **Then** the upload's `deleted_at` column is set (soft delete using existing schema column), its associated `migration_records` are soft-deleted, and the upload disappears from the default upload list view.

3. **Given** an upload in `processing`, `completed`, `validated`, or `reconciled` status, **When** viewing the upload row, **Then** no discard action is available — only uploads that never progressed beyond mapping or that failed can be discarded.

4. **Given** the validation results table on `MigrationUploadPage`, **When** viewing the column headers, **Then** the "Variance" column reads "Largest Variance" and has a MetricHelp tooltip explaining: "The single largest monetary difference between any declared value and the scheme expected value for this record. Indicates where the biggest data gap exists."

5. **Given** the validation results table, **When** viewing the "Category" column, **Then** it reads "Variance Category" and has a MetricHelp tooltip explaining: "Classification of the record's overall data quality based on the magnitude and nature of differences between declared and expected values."

6. **Given** the observations table in the database, **When** querying by `created_at`, `reviewed_at`, or `resolved_at`, **Then** database indexes exist on these columns for efficient date-range filtering.

7. **Given** the `resetDb.ts` test utility, **When** called to truncate all tables, **Then** all 25+ application tables are explicitly listed (no reliance on CASCADE for 7 newer tables), ensuring test isolation even if FK relationships change.

## Tasks / Subtasks

- [ ] Task 1: Add discard endpoint for migration uploads (AC: 1, 2, 3)
  - [ ] 1.1: Add `PATCH /api/migrations/:uploadId/discard` endpoint in `apps/server/src/routes/migrationRoutes.ts`
  - [ ] 1.2: Add `discardUpload(uploadId: string, userId: string)` function in `apps/server/src/services/migrationService.ts`:
    - Verify upload exists and `deleted_at` is null
    - Verify status is one of `uploaded`, `mapped`, `failed` — throw `AppError(409, 'UPLOAD_CANNOT_BE_DISCARDED', VOCABULARY.UPLOAD_CANNOT_BE_DISCARDED)` if not. Add `UPLOAD_CANNOT_BE_DISCARDED: 'This upload has progressed beyond the mapping stage and cannot be discarded.'` to `packages/shared/src/constants/vocabulary.ts`
    - In a transaction (use Drizzle's `db.transaction()` pattern, consistent with `createBaseline()` in baselineService.ts): set `deleted_at = NOW()` on the upload, set `deleted_at = NOW()` on all its `migration_records`
    - Return `{ discarded: true, recordsAffected: number }`
  - [ ] 1.3: Verify `listUploads()` already filters by `isNull(migrationUploads.deletedAt)` — it does (confirmed in codebase). No change needed for listing
  - [ ] 1.4: Integration test in `apps/server/src/routes/migration.integration.test.ts` (**new file** — `baseline.integration.test.ts` in the same directory is the closest precedent for structure and setup): discard sets `deleted_at`, discarded upload excluded from list
  - [ ] 1.5: Integration test in same file: discard rejected for `validated` status upload (409)
  - [ ] 1.6: Integration test in same file: discard rejected for already-discarded upload (404 or 409)

- [ ] Task 2: Add discard UI to MigrationUploadList (AC: 1, 2, 3)
  - [ ] 2.1: Add `useDiscardMigration(uploadId)` mutation hook in `apps/client/src/hooks/useMigration.ts` — calls `PATCH /api/migrations/:uploadId/discard`, invalidates `['migrations']` query key on success
  - [ ] 2.2: Add discard button to `UploadRow` in `apps/client/src/pages/dashboard/components/MigrationUploadList.tsx`:
    - Show a `Trash2` icon button (from lucide-react) only when `upload.status` is `uploaded`, `mapped`, or `failed`
    - Do NOT show for `processing`, `completed`, `validated`, `reconciled`, or superseded uploads
    - Add a new "Actions" column header to the table (after "Date")
  - [ ] 2.3: Add `DiscardConfirmationDialog` inline in `MigrationUploadList.tsx` (or as a small separate component if >50 lines):
    - shadcn `AlertDialog` component (destructive pattern)
    - Title: "Discard Upload"
    - Body: "This will permanently remove **{filename}** ({totalRecords} records) from the migration dashboard. This action cannot be undone."
    - Buttons: "Cancel" + "Discard Upload" (destructive variant)
  - [ ] 2.4: Wire dialog: click trash icon → open dialog with selected upload → confirm → call mutation → close dialog → toast "Upload discarded"

- [ ] Task 3: Rename variance column headers and add MetricHelp (AC: 4, 5)
  - [ ] 3.1: In `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` at line 688, change:
    - `"Category"` → `"Variance Category"` + `<MetricHelp metric="migration.varianceCategory" />`
    - Line 689: `"Variance"` → `"Largest Variance"` + `<MetricHelp metric="migration.largestVariance" />`
  - [ ] 3.2: Add two new entries to `MIGRATION_HELP` in `packages/shared/src/constants/metricGlossary.ts`:
    ```typescript
    varianceCategory: {
      label: 'Variance Category',
      description: 'Classification of the record\'s overall data quality based on the magnitude and nature of differences between declared and expected values.',
      derivedFrom: 'Largest absolute difference between the scheme expected and MDA declared values for total loan, monthly deduction, and total interest.',
      guidance: 'Clean records can be baselined immediately. Records with variance should be reviewed before baseline acceptance.',
    },
    largestVariance: {
      label: 'Largest Variance',
      description: 'The single largest monetary difference between any declared value and the scheme expected value for this record.',
      derivedFrom: 'MAX of absolute differences: |scheme expected total loan − declared total loan|, |scheme expected monthly deduction − declared monthly deduction|, |scheme expected total interest − declared total interest|.',
      guidance: 'Start investigation with the highest variance records. A large variance in total loan propagates into every downstream metric.',
    },
    ```
  - [ ] 3.3: Import `MetricHelp` at top of `MigrationUploadPage.tsx`: `import { MetricHelp } from '@/components/shared/MetricHelp';`
  - [ ] 3.4: Verify the MetricHelp renders correctly alongside the `<th>` text — use inline flex layout: `<th className="..."><span className="inline-flex items-center gap-1">Largest Variance <MetricHelp metric="migration.largestVariance" /></span></th>`

- [ ] Task 4: Add missing DB indexes on observation date columns (AC: 6)
  - [ ] 4.1: In `apps/server/src/db/schema.ts`, add three indexes to the `observations` table definition (inside the existing index array at lines 488-495):
    ```typescript
    index('idx_observations_created_at').on(table.createdAt),
    index('idx_observations_reviewed_at').on(table.reviewedAt),
    index('idx_observations_resolved_at').on(table.resolvedAt),
    ```
  - [ ] 4.2: Run `drizzle-kit generate` to create a NEW migration for the indexes (never re-generate existing)
  - [ ] 4.3: Verify migration applies cleanly: `pnpm drizzle-kit migrate`

- [ ] Task 5: Make resetDb.ts explicit for all tables (AC: 7)
  - [ ] 5.1: Update `apps/server/src/test/resetDb.ts` — add the 7 tables currently relying on CASCADE explicitly:
    ```sql
    TRUNCATE
      loan_annotations,
      loan_event_flag_corrections,
      baseline_annotations,
      submission_rows,
      mda_submissions,
      employment_events,
      transfers,
      exceptions,
      observations,
      deduplication_candidates,
      person_matches,
      migration_extra_fields,
      migration_records,
      migration_uploads,
      temporal_corrections,
      service_extensions,
      loan_state_transitions,
      ledger_entries,
      loans,
      scheme_config,
      refresh_tokens,
      audit_log,
      users,
      mda_aliases,
      mdas
    CASCADE
    ```
  - [ ] 5.2: Remove the comment block (lines 11-15) that says "7 newer tables are not explicitly listed" — the comment is now stale
  - [ ] 5.3: Add a comment: `-- All application tables listed explicitly. Keep this in sync with schema.ts when adding new tables.`
  - [ ] 5.4: Run full test suite to verify no regressions from the TRUNCATE order change

- [ ] Task 6: Full regression and verification (AC: all)
  - [ ] 6.1: Run `pnpm typecheck` across monorepo — zero errors
  - [ ] 6.2: Run `pnpm test` — zero regressions
  - [ ] 6.3: Run `pnpm lint` — zero new warnings
  - [ ] 6.4: Manual check: load MigrationPage → Uploads tab → verify discard button shows for `uploaded`/`mapped`/`failed` uploads only → discard one → verify it disappears
  - [ ] 6.5: Manual check: load MigrationUploadPage → validation results table → verify "Largest Variance" and "Variance Category" headers with MetricHelp tooltips

## Dev Notes

### What This Story Addresses

Four items from the E7+E6 retro (2026-03-29):

| Source | Finding | What We Fix |
|---|---|---|
| UAT #3 | "Variance" column not self-explanatory | Rename to "Largest Variance" + "Variance Category" with MetricHelp tooltips |
| UAT #8 | Incomplete uploads clutter dashboard, no discard | Discard action for `uploaded`/`mapped`/`failed` uploads via soft delete |
| Debt #1 | Missing indexes on observation date columns | Add `idx_observations_created_at/reviewed_at/resolved_at` |
| Debt #3 | resetDb.ts relies on CASCADE for 7 tables | List all 25 tables explicitly |

### Discard: Soft Delete Pattern (Not Hard Delete)

The `migration_uploads` table already has a `deleted_at` column (schema.ts line 311). The `listUploads()` query already filters `WHERE deleted_at IS NULL`. The discard endpoint simply sets `deleted_at = NOW()`.

**Why not hard delete?** Audit trail. The upload metadata persists for compliance. Discarded uploads are invisible to the UI but queryable via direct DB access if needed.

**Which statuses allow discard:**
- `uploaded` — file uploaded, column mapping not confirmed
- `mapped` — columns mapped but records not yet extracted
- `failed` — processing failed, no usable records

**Which statuses block discard:**
- `processing` — extraction in progress, wait for completion or failure
- `completed` — records extracted, may be referenced by validation results
- `validated` — variance computed, may inform decisions
- `reconciled` — baselines created, ledger entries exist

**Superseded uploads** — supersession (Story 7.0g) is tracked at the **record level** (`migrationRecordStatusEnum` + `supersededAt` on `migration_records`), NOT on the upload status enum. Uploads with superseded records will be in `validated` or `reconciled` status, so they're already excluded from discard by the status check. No special handling needed for supersession here.

### Discard: Migration Records Cleanup

When discarding an upload, also soft-delete its `migration_records` (column confirmed at schema.ts line 385):

```typescript
await tx.update(migrationRecords)
  .set({ deletedAt: new Date() })
  .where(eq(migrationRecords.uploadId, uploadId));
```

### Variance Column Headers: Current vs Target

**Current** (`MigrationUploadPage.tsx` lines 686-694):
```
| Staff Name | Category | Variance | Declared Total | Computed Total | ... |
```

**Target:**
```
| Staff Name | Variance Category [?] | Largest Variance [?] | Declared Total | Computed Total | ... |
```

Where `[?]` is the MetricHelp tooltip icon (HelpCircle).

### MetricHelp Pattern (Existing)

Component: `apps/client/src/components/shared/MetricHelp.tsx`
- Props: `{ metric: string }` — key into `METRIC_GLOSSARY` (prefixed, e.g., `"migration.largestVariance"`)
- Renders: small HelpCircle icon → tooltip with label, description, derivedFrom, guidance
- Glossary: `packages/shared/src/constants/metricGlossary.ts` — prefixed sections: `observation.*`, `dashboard.*`, `migration.*`, etc.

Usage in `<th>`:
```tsx
<th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">
  <span className="inline-flex items-center gap-1">
    Largest Variance
    <MetricHelp metric="migration.largestVariance" />
  </span>
</th>
```

### Observation Date Indexes

The `observations` table (schema.ts lines 462-497) has indexes on `type`, `mda_id`, `status`, `staff_name`, `upload_id` (lines 488-495) — but NOT on the three date columns used for dashboard filtering:

| Column | Type | Used For |
|---|---|---|
| `created_at` | timestamptz | "Recent observations" queries, date-range filtering on observations list |
| `reviewed_at` | timestamptz (nullable) | Filtering reviewed observations, reviewer activity reports |
| `resolved_at` | timestamptz (nullable) | Filtering resolved observations, resolution timeline reports |

These are standard B-tree indexes on nullable timestamptz columns. Drizzle generates the correct `CREATE INDEX` DDL.

### resetDb.ts: Explicit Table Listing

**Current state:** 18 tables listed explicitly, 7 rely on CASCADE (comment on lines 11-15).

**Problem:** If FK relationships change in a future migration, CASCADE may stop covering the implicit tables, causing test pollution.

**Fix:** List all 25 tables explicitly in the TRUNCATE statement. Order doesn't matter with CASCADE, but list child tables before parents for readability.

**Tables to add:**
1. `loan_annotations` — FK → loans
2. `loan_event_flag_corrections` — FK → loans
3. `baseline_annotations` — FK → migration_records
4. `submission_rows` — FK → mda_submissions
5. `mda_submissions` — FK → mdas
6. `employment_events` — FK → loans
7. `transfers` — FK → loans

### migration_records Soft Delete

The `migration_records` table HAS a `deleted_at` column (schema.ts line 385). Task 1.2 should soft-delete BOTH the upload AND its records in the same transaction — setting `deleted_at = NOW()` on each. This ensures records are excluded from any direct queries (e.g., `getValidationResults` filters by `isNull(migrationRecords.deletedAt)`).

### API Route Structure

| Method | Path | Purpose |
|---|---|---|
| PATCH | `/api/migrations/:uploadId/discard` | Discard upload (new) |

Following architecture convention: `PATCH` for state changes on existing resources (like setting `deleted_at`).

### TanStack Query Keys

```typescript
queryKey: ['migrations']  // upload list — invalidate after discard
```

### Non-Punitive Vocabulary

- Discard button label: "Discard" (not "Delete")
- Confirmation dialog: "permanently remove" (not "delete forever")
- Error on invalid discard: `UPLOAD_CANNOT_BE_DISCARDED` — "This upload has progressed beyond the mapping stage and cannot be discarded."
- Variance labels: "Largest Variance" (neutral), "Variance Category" (classification)

### File Locations

| What | Path |
|---|---|
| Migration routes | `apps/server/src/routes/migrationRoutes.ts` |
| Migration service | `apps/server/src/services/migrationService.ts` |
| DB schema | `apps/server/src/db/schema.ts` |
| Upload list component | `apps/client/src/pages/dashboard/components/MigrationUploadList.tsx` |
| Upload page (validation table) | `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` |
| MetricHelp component | `apps/client/src/components/shared/MetricHelp.tsx` |
| Metric glossary | `packages/shared/src/constants/metricGlossary.ts` |
| resetDb | `apps/server/src/test/resetDb.ts` |
| Migration hooks | `apps/client/src/hooks/useMigration.ts` |
| Vocabulary constants | `packages/shared/src/constants/vocabulary.ts` |

### What This Story Does NOT Change

- **Validation logic** — variance computation unchanged
- **Supersession flow** — Story 7.0g's supersede remains separate from discard
- **RecordComparisonRow** — individual row component unchanged (Story 8.0b handles row click)
- **Baseline flow** — untouched (Story 8.0b handles guards/corrections)
- **Dashboard hero metrics** — unchanged (discarded uploads already excluded by `deleted_at` filter)
- **Observation engine** — unchanged (only adding indexes, not modifying queries)

### Previous Story Context (8.0b)

Story 8.0b (ready-for-dev) adds:
- Row click → RecordDetailDrawer on the same validation results table
- "Establish Baseline" guard logic
- `RecordComparisonRow` gets `onRowClick` handler

Story 8.0c edits the same `MigrationUploadPage.tsx` file (column headers) but different sections (table `<thead>` only). No conflict expected if 8.0b merges first — the `<th>` tags are independent of the row click wiring.

### Drizzle Migration Rules

- **Generate a NEW migration** for the observation date indexes
- **Never re-generate** an existing migration (see `docs/drizzle-migrations.md`)
- Run `pnpm drizzle-kit generate` → verify new file in `apps/server/drizzle/`
- Run `pnpm drizzle-kit migrate` to apply

### Testing Standards

- Co-located tests: `migrationService.test.ts` next to `migrationService.ts`
- Integration tests: `migration.integration.test.ts` in routes directory
- Vitest framework
- Use `resetDb()` in `beforeAll` / `afterAll` — which this story improves

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#UAT Finding #3 — Variance label]
- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#UAT Finding #8 — Incomplete uploads]
- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#Debt Item #1 — Observation indexes]
- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#Debt Item #3 — resetDb tables]
- [Source: apps/server/src/db/schema.ts:311 — deletedAt column on migration_uploads]
- [Source: apps/server/src/db/schema.ts:462-497 — observations table + existing indexes at 488-495]
- [Source: apps/server/src/test/resetDb.ts — current 18-table TRUNCATE]
- [Source: apps/client/src/pages/dashboard/MigrationUploadPage.tsx:686-694 — validation results table headers]
- [Source: apps/client/src/pages/dashboard/components/MigrationUploadList.tsx — upload list display]
- [Source: apps/client/src/components/shared/MetricHelp.tsx — tooltip component pattern]
- [Source: packages/shared/src/constants/metricGlossary.ts:281-315 — MIGRATION_HELP section]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
