# Story 8.0d: Multi-Sheet Period Handling

Status: ready-for-dev

## Story

As a **Department Admin**,
I want each sheet in a multi-sheet Excel upload to have its period independently detected, displayed, and checked for overlap,
So that uploading a file with August data in Sheet1 and September data in Sheet2 doesn't bypass safety checks on the second sheet.

**Origin:** UAT Finding #9 from E7+E6 retro (2026-03-29). Currently overlap detection only uses the first sheet's period.

**Scope extension (PM triage 2026-04-02):** Add a period confirmation gate — after period detection, before processing begins, user must confirm detected periods. Prevents wrong-month uploads at the point of highest leverage. See AC 8 and Task 7.

**Dependencies:** None — independent of 8.0a/8.0b/8.0c.

## Acceptance Criteria

1. **Given** a multi-sheet Excel upload where Sheet1 contains August 2024 data and Sheet2 contains September 2024 data, **When** the upload is previewed, **Then** each sheet's detected period is shown independently in the column mapping review (already works — `ColumnMappingReview.tsx` line 110 shows `month/year` per sheet).

2. **Given** a multi-sheet upload with sheets covering different periods, **When** the user confirms column mappings, **Then** the system checks for period overlap against existing uploads for EACH sheet's period independently (not just the first sheet's period).

3. **Given** Sheet1 has no overlap but Sheet2 conflicts with an existing upload for the same MDA and period, **When** overlap is detected, **Then** the overlap warning dialog identifies WHICH sheet(s) have conflicts, showing: sheet name, detected period, and the existing upload that conflicts.

4. **Given** a multi-sheet overlap warning showing conflicts for specific sheets, **When** the user wants to proceed, **Then** the user can confirm the overlap for all conflicting sheets at once (single confirmation action — not per-sheet).

5. **Given** a confirmed multi-sheet upload, **When** records are extracted and stored, **Then** each record's `periodYear` and `periodMonth` columns reflect its own sheet's detected period (already works — `confirmMapping()` line 394-410 sets these per-sheet).

6. **Given** the upload confirmation response, **When** viewing the `recordsPerSheet` summary, **Then** each sheet entry includes its detected `periodYear` and `periodMonth` so the frontend can display which period each sheet was processed as.

7. **Given** a sheet where period detection returns `null` (no period found), **When** overlap check runs for that sheet, **Then** the sheet is skipped for overlap detection (no period = nothing to conflict with) and the user sees a note: "Period not detected for [sheet name] — overlap check skipped."

8. **Given** a multi-sheet upload where periods have been detected for each sheet, **When** the user clicks "Confirm Mapping" (before processing begins), **Then** a period confirmation step is shown listing each sheet's detected period (e.g., "Sheet 'AUG 2024': **August 2024**", "Sheet 'SEP 2024': **September 2024**") with two actions: **[Confirm Periods & Process]** and **[Cancel — periods are wrong]**. If a sheet has no detected period, it is shown as "Sheet 'SUMMARY': period not detected" with an informational note. The user must explicitly confirm before processing proceeds. *(PM triage 2026-04-02 — confirmation gate prevents wrong-month uploads)*

## Tasks / Subtasks

- [ ] Task 1: Extend overlap check to all sheets — SERVER-INTERNAL GUARD in `confirmMapping()` (AC: 2, 3, 7). NOTE: Task 5 changes the EXTERNAL endpoint (`GET→POST /check-overlap`) used by the frontend preview. Both paths must handle multi-period — Task 1 is defense-in-depth
  - [ ] 1.1: Modify `confirmMapping()` in `apps/server/src/services/migrationService.ts` (lines 238-240) — instead of extracting only `periods[0]`, collect ALL unique `{ year, month }` pairs from all sheets (deduplicated)
  - [ ] 1.2: Call `checkPeriodOverlap()` for EACH unique period (not just the first). Collect results into an array: `Array<{ sheetNames: string[], periodYear: number, periodMonth: number, overlap: OverlapResult | null }>`
  - [ ] 1.3: If ANY period has overlap AND `metadata.overlapConfirmed` is not true, throw `AppError(409, 'PERIOD_OVERLAP', JSON.stringify(multiSheetOverlapResponse))` with the full `MultiSheetOverlapResponse` as the error payload (matching existing throw pattern at line 243). The frontend catches 409 and renders the per-sheet overlap dialog
  - [ ] 1.4: Skip overlap check for sheets where period is `null` — include in response as `{ sheetName, periodSkipped: true, reason: 'Period not detected' }`
  - [ ] 1.5: Update the overlap check response type in `packages/shared/src/types/migration.ts` — new type:
    ```typescript
    interface SheetOverlapResult {
      sheetNames: string[];        // sheets sharing this period
      periodYear: number;
      periodMonth: number;
      periodLabel: string;         // e.g., "August 2024"
      overlap: boolean;
      existingUploadId?: string;
      existingFilename?: string;
      existingRecordCount?: number;
    }

    interface MultiSheetOverlapResponse {
      hasOverlap: boolean;                   // true if ANY sheet overlaps
      results: SheetOverlapResult[];         // one per unique period
      skippedSheets: Array<{ sheetName: string; reason: string }>;
    }
    ```
  - [ ] 1.6: Unit test in `apps/server/src/services/migrationService.test.ts` (**new file** — no existing tests for this service; use `migrationValidationService.test.ts` as structural precedent): 3-sheet upload with periods Aug/Sep/Oct, only Sep overlaps → response shows Sep as conflicting, Aug and Oct clean
  - [ ] 1.7: Unit test in same file: 2-sheet upload both same period (Aug/Aug) → deduplicated to single overlap check for Aug
  - [ ] 1.8: Unit test in same file: sheet with null period → skipped in overlap check, listed in `skippedSheets`

- [ ] Task 2: Update frontend overlap check flow (AC: 2, 3, 4)
  - [ ] 2.1: Update `useCheckOverlap()` hook in `apps/client/src/hooks/useMigration.ts` — change from single `periodYear/periodMonth` query params to POST body with all sheet periods (Task 5 creates the POST endpoint):
    ```typescript
    mutationFn: ({ uploadId, sheetPeriods }) =>
      apiClient(`/migrations/${uploadId}/check-overlap`, {
        method: 'POST',
        body: JSON.stringify({ sheetPeriods }),
      }),
    ```
  - [ ] 2.2: Update `handleConfirmMapping()` in `MigrationUploadPage.tsx` (lines 129-142) — extract periods from ALL sheets instead of just `preview.sheets[0]`:
    ```typescript
    const sheetPeriods = preview.sheets
      .filter(s => s.period !== null)
      .map(s => ({ sheetName: s.sheetName, periodYear: s.period!.year, periodMonth: s.period!.month }));
    ```
  - [ ] 2.3: Update the overlap warning dialog (lines 494-528 of `MigrationUploadPage.tsx`) to show per-sheet conflicts:
    - Title: "Period Overlap Detected"
    - Body: List each conflicting sheet with its period and the existing upload name
    - Example: "**Sheet 'SEP 2024'** (September 2024) overlaps with existing upload 'BIR CAR LOAN SEPT 2024.xlsx' (45 records)"
    - Non-conflicting sheets listed below as "No overlap: Sheet 'AUG 2024' (August 2024)"
    - Skipped sheets shown as: "Period not detected: Sheet 'SUMMARY' — overlap check skipped"
  - [ ] 2.4: "Confirm and Proceed" button (existing) confirms ALL overlaps at once — single `confirmOverlap()` call (existing endpoint, no change needed)

- [ ] Task 3: Add period to recordsPerSheet response (AC: 6)
  - [ ] 3.1: In `confirmMapping()` (line 468-472), extend the `recordsPerSheet` array entries to include period:
    ```typescript
    recordsPerSheet.push({
      sheetName: sheetMapping.sheetName,
      count: sheetRecordInserts.length,
      era,
      periodYear: period?.year ?? null,
      periodMonth: period?.month ?? null,
    });
    ```
  - [ ] 3.2: Update the `recordsPerSheet` type in THREE locations to include `periodYear: number | null` and `periodMonth: number | null`:
    - `packages/shared/src/types/migration.ts` line 169: `MigrationUploadDetail.recordsPerSheet` array entry
    - `apps/server/src/services/migrationService.ts` line 215: `confirmMapping()` return type (inline)
    - `apps/client/src/hooks/useMigration.ts` lines 31 and 46: `useConfirmMapping()` response type (inline). NOTE: There is no `ConfirmMappingResult` named type — the type is defined inline in all three locations
  - [ ] 3.3: Display period per sheet in the confirmation success view on `MigrationUploadPage.tsx` — after mapping confirmation, show: "Sheet 'AUG 2024': 45 records (August 2024)"

- [ ] Task 4: Add period+MDA composite index (performance)
  - [ ] 4.1: Add composite index to `migration_records` in `apps/server/src/db/schema.ts`:
    ```typescript
    index('idx_migration_records_mda_period').on(table.mdaId, table.periodYear, table.periodMonth),
    ```
  - [ ] 4.2: Run `drizzle-kit generate` to create a NEW migration (never re-generate existing)
  - [ ] 4.3: Verify migration applies cleanly

- [ ] Task 5: Change overlap endpoint from GET to POST — EXTERNAL ENDPOINT for frontend preview (AC: 2). NOTE: Task 1 handles the corresponding internal guard in `confirmMapping()`. Both paths do multi-period overlap checking
  - [ ] 5.1: In `apps/server/src/routes/migrationRoutes.ts` (lines 109-119), change `router.get('/migrations/:id/check-overlap', ...)` to `router.post('/migrations/:id/check-overlap', ...)`
  - [ ] 5.2: Parse request body instead of query params:
    ```typescript
    const { sheetPeriods } = req.body;
    // sheetPeriods: Array<{ sheetName: string, periodYear: number, periodMonth: number }>
    ```
  - [ ] 5.3: Add Zod validation schema for the request body:
    ```typescript
    const checkOverlapBodySchema = z.object({
      sheetPeriods: z.array(z.object({
        sheetName: z.string(),
        periodYear: z.number().int().min(2000).max(2100),
        periodMonth: z.number().int().min(1).max(12),
      })),
    });
    ```
  - [ ] 5.4: Call `checkPeriodOverlap()` for each unique `{ periodYear, periodMonth }` in the array, deduplicating identical periods from different sheets
  - [ ] 5.5: Return `MultiSheetOverlapResponse` (from Task 1.5)

- [ ] Task 7: Period confirmation gate (AC: 8) — PM triage 2026-04-02
  - [ ] 7.1: Add a period confirmation dialog/step in `MigrationUploadPage.tsx` — triggered when user clicks "Confirm Mapping", shown BEFORE overlap check and processing. Lists each sheet with its detected period. Two buttons: "Confirm Periods & Process" (proceeds to overlap check and processing) and "Cancel — periods are wrong" (returns to mapping review). For sheets with no detected period, show "period not detected" with informational styling
  - [ ] 7.2: Integration into `handleConfirmMapping()` flow — insert the confirmation gate between column mapping confirmation and the overlap check call. If user cancels, return to mapping review without side effects. If user confirms, proceed with existing flow (overlap check → process)

- [ ] Task 6: Full regression and verification (AC: all)
  - [ ] 6.1: Run `pnpm typecheck` — zero errors
  - [ ] 6.2: Run `pnpm test` — zero regressions
  - [ ] 6.3: Run `pnpm lint` — zero new warnings
  - [ ] 6.4: Manual test: upload multi-sheet BIR file (Aug sheet + Sep sheet), verify both periods shown in mapping review, overlap checked for both, confirmation response includes periods per sheet

## Dev Notes

### PM Amendment: Period Confirmation Gate (2026-04-02)

During triage of Story 8.0b UAT escalations, the PM added a period confirmation gate to this story's scope. Awwal asked: "When we are uploading data, how can we have a sticker to show the month(s) we are currently updating?" The dev team recommended a passive period badge. The PM elevated it to a confirmation gate — the user must explicitly confirm detected periods before processing begins. A badge you can scroll past doesn't prevent wrong-month uploads; a gate does.

**UX Pattern:** This is a lightweight confirmation step, NOT a full wizard page. Think: a dialog or inline confirmation panel that appears between "Confirm Mapping" click and actual processing. One click to confirm if periods are correct, one click to cancel if they're wrong. Minimal friction for the happy path.

### The Core Problem

`MigrationUploadPage.tsx` line 129-131 — frontend sends only the first sheet's period for overlap check:

```typescript
const firstSheet = preview.sheets[0];
const period = firstSheet?.period;
// ... calls checkOverlap with only this period
```

`migrationService.ts` line 238-240 — server also only checks first period:

```typescript
const periods = (uploadMeta?.sheets ?? []).map(s => s.period).filter(Boolean);
if (periods.length > 0) {
  const { year, month } = periods[0];  // ONLY FIRST!
```

Everything downstream (per-record `periodYear`/`periodMonth`, per-sheet period display in `ColumnMappingReview`) already works correctly. The fix is isolated to the overlap check trigger and the overlap warning display.

### What Already Works (Do NOT Change)

| Feature | Where | Status |
|---|---|---|
| Per-sheet period detection | `extractPeriod()` called per sheet in `previewUpload()` line 141 | Works |
| Per-sheet period display in mapping review | `ColumnMappingReview.tsx` line 110: `{sheet.period.month}/{sheet.period.year}` | Works |
| Per-record period storage | `migration_records.periodYear/periodMonth` set per-sheet at line 394-410 | Works |
| Per-sheet era detection | Each sheet gets its own `era` value | Works |
| Sheet skip patterns | `shouldSkipSheet()` filters non-loan sheets | Works |
| `confirmOverlap()` endpoint | Sets `metadata.overlapConfirmed = true` globally | Works (keep as-is) |

### What This Story Changes

1. **CHANGE** overlap check trigger — check ALL sheet periods, not just first
2. **CHANGE** overlap endpoint — GET with single period → POST with periods array
3. **CHANGE** overlap warning dialog — show per-sheet conflict details
4. **ADD** period to `recordsPerSheet` confirmation response
5. **ADD** composite index on `(mda_id, period_year, period_month)` for performance

### Period Detection Details

**File:** `apps/server/src/migration/periodExtract.ts`

`extractPeriod(sheetName, titleRows, filename)` returns:
```typescript
interface PeriodResult {
  periods: Period[];           // Can be multiple (e.g., "JAN-DEC 2023" → 12 periods)
  confidence: 'high' | 'medium' | 'low';
  source: 'sheet' | 'title' | 'filename';
  raw: string;
}
```

For this story, use `PeriodResult.periods[0]` per sheet (the primary detected period for THAT sheet — not `sheets[0]`, which is the bug being fixed). Multi-period ranges within a single sheet (e.g., "JAN-DEC") are an edge case for future handling — document but don't solve.

### Overlap Check: Deduplication Logic

Multiple sheets may share the same period (e.g., two departments in the same month). Deduplicate before checking:

```typescript
// Deduplicate periods across sheets
const uniquePeriods = new Map<string, { periodYear: number; periodMonth: number; sheetNames: string[] }>();
for (const sp of sheetPeriods) {
  const key = `${sp.periodYear}-${sp.periodMonth}`;
  const existing = uniquePeriods.get(key);
  if (existing) {
    existing.sheetNames.push(sp.sheetName);
  } else {
    uniquePeriods.set(key, { periodYear: sp.periodYear, periodMonth: sp.periodMonth, sheetNames: [sp.sheetName] });
  }
}
// Check overlap for each unique period
for (const [, entry] of uniquePeriods) {
  const result = await checkPeriodOverlap(uploadId, entry.periodYear, entry.periodMonth);
  // ...
}
```

### Overlap Warning Dialog: Display Pattern

```
┌─────────────────────────────────────────────────────┐
│ Period Overlap Detected                        [×]  │
├─────────────────────────────────────────────────────┤
│                                                     │
│ The following sheets conflict with existing uploads: │
│                                                     │
│ ⚠ Sheet "SEP 2024" — September 2024                │
│   Overlaps with: BIR CAR LOAN SEPT 2024.xlsx        │
│   (45 existing records)                             │
│                                                     │
│ ✓ Sheet "AUG 2024" — August 2024                    │
│   No existing data for this period                  │
│                                                     │
│ ○ Sheet "SUMMARY" — period not detected             │
│   Overlap check skipped                             │
│                                                     │
│ Proceeding will add new records alongside existing  │
│ data for the overlapping periods.                   │
│                                                     │
│           [Cancel]  [Confirm and Proceed]            │
└─────────────────────────────────────────────────────┘
```

Use amber icon for conflicts, teal check for clean, gray circle for skipped. Non-punitive language throughout.

### API Change: GET → POST for Overlap Check

**Current:** `GET /api/migrations/:id/check-overlap?periodYear=2024&periodMonth=8`
**New:** `POST /api/migrations/:id/check-overlap` with body `{ sheetPeriods: [...] }`

Reason: GET query params can't cleanly represent an array of period objects. POST body is cleaner and avoids URL length limits for many sheets.

The existing `confirmOverlap` endpoint (POST) remains unchanged — single confirmation covers all sheets.

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Migration service | `apps/server/src/services/migrationService.ts` | 238-240 (first-period bug), 468-472 (recordsPerSheet), 508-581 (checkPeriodOverlap) |
| Period extraction | `apps/server/src/migration/periodExtract.ts` | 164-189 (extractPeriod) |
| Migration routes | `apps/server/src/routes/migrationRoutes.ts` | 109-119 (GET overlap endpoint) |
| Upload page | `apps/client/src/pages/dashboard/MigrationUploadPage.tsx` | 129-142 (handleConfirmMapping), 494-528 (overlap dialog) |
| Column mapping review | `apps/client/src/pages/dashboard/components/ColumnMappingReview.tsx` | 107-113 (per-sheet period display) |
| Migration hooks | `apps/client/src/hooks/useMigration.ts` | 163-186 (useCheckOverlap, useConfirmOverlap) |
| Shared types | `packages/shared/src/types/migration.ts` | 43-64 (SheetPreview, MigrationUploadPreview) |
| DB schema | `apps/server/src/db/schema.ts` | 294-325 (uploads), 328-396 (records), 387-395 (indexes) |

### Non-Punitive Vocabulary

- "Period overlap detected" (not "conflict" or "error")
- "Overlaps with" (neutral observation)
- "Proceeding will add new records alongside existing data" (informational, not scary)
- "Overlap check skipped" (not "failed" or "error")

### Testing Standards

- Co-located unit tests next to service files
- Integration tests in routes directory
- Vitest framework
- Test multi-sheet scenarios with mock workbooks using SheetJS (`XLSX.utils.book_new()`, `XLSX.utils.aoa_to_sheet()`)

### Team Agreements Applicable

- **Extend, don't fork** — extend existing `checkPeriodOverlap()`, don't create a parallel function
- **N+1 query budget** — overlap check calls `checkPeriodOverlap()` once per unique period. For a 3-period upload that's 3 queries — acceptable. If sheets share the same period, deduplication prevents redundant queries
- **Transaction scope** — overlap check is read-only, no transaction needed

### What This Story Does NOT Change

- **Period detection logic** — `extractPeriod()` in `periodExtract.ts` unchanged
- **Column mapping flow** — per-sheet mapping unchanged
- **Record extraction** — `confirmMapping()` record insertion unchanged (already per-sheet)
- **Sheet skip patterns** — `shouldSkipSheet()` unchanged
- **Supersession flow** — supersede logic unchanged
- **Baseline flow** — unaffected

### Previous Story Context

Story 8.0c (ready-for-dev) edits `MigrationUploadPage.tsx` (column headers only) and `MigrationUploadList.tsx`. Story 8.0d also edits `MigrationUploadPage.tsx` but in different sections (overlap dialog and handleConfirmMapping). Low merge conflict risk if sequenced properly.

### Drizzle Migration Rules

- Generate a NEW migration for the composite index
- Never re-generate existing migrations
- See `docs/drizzle-migrations.md`

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#UAT Finding #9 — Multi-sheet overlap]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0d]
- [Source: apps/server/src/services/migrationService.ts:238-240 — First-period-only overlap check (the bug)]
- [Source: apps/server/src/services/migrationService.ts:508-581 — checkPeriodOverlap function]
- [Source: apps/server/src/services/migrationService.ts:468-472 — recordsPerSheet without period]
- [Source: apps/server/src/migration/periodExtract.ts:164-189 — extractPeriod function]
- [Source: apps/server/src/routes/migrationRoutes.ts:109-119 — GET overlap endpoint]
- [Source: apps/client/src/pages/dashboard/MigrationUploadPage.tsx:129-142 — handleConfirmMapping first-sheet-only]
- [Source: apps/client/src/pages/dashboard/MigrationUploadPage.tsx:494-528 — Overlap warning dialog]
- [Source: apps/client/src/pages/dashboard/components/ColumnMappingReview.tsx:107-113 — Per-sheet period display]
- [Source: apps/client/src/hooks/useMigration.ts:163-186 — useCheckOverlap, useConfirmOverlap]
- [Source: packages/shared/src/types/migration.ts:43-64 — SheetPreview, MigrationUploadPreview]
- [Source: apps/server/src/db/schema.ts:387-395 — migration_records indexes (missing period+MDA)]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
