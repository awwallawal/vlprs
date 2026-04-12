# Story 15.0n: Upload Supersede Data Comparison & Correction Reason Enforcement

Status: done

## Story

As the **AG/Department Admin**,
I want to see a record-level comparison when superseding an upload (unchanged/modified/new/removed records with field-level diffs), and I want correction reasons to be mandatory for ALL record corrections (not just flagged records),
So that I can make informed decisions about data replacement and every correction has an audit trail.

**Origin:** UAT Findings #40 (High), #42 (Medium) from E8 retro. Current supersede shows only filenames + counts. `RecordDetailDrawer.tsx:482` only shows reason field when `isFlagged`. E16 cross-month diffing pattern reusable for comparison engine.

**Priority:** HIGH (#40) + MEDIUM (#42) — two distinct fixes bundled because both enforce data change accountability.

## Acceptance Criteria

### Supersede Comparison (#40)

1. **Given** an admin is about to supersede an upload, **When** the SupersedeDialog opens, **Then** it shows a record-level diff summary: count of Unchanged, Modified, New, and Removed records between old and new uploads.

2. **Given** the diff summary shows modified records, **When** the admin clicks "View Details" or expands the Modified section, **Then** they see a table of modified records with field-level diffs highlighted (old value → new value in amber for each changed field).

3. **Given** the diff summary, **When** calculated, **Then** records are matched between old and new uploads by normalized staff name (primary) and employee number (secondary). Unmatched records in old = "Removed". Unmatched records in new = "New".

4. **Given** the comparison endpoint, **When** called, **Then** it returns the diff without modifying any data (read-only preview before committing supersede).

### Correction Reason (#42)

5. **Given** an admin corrects ANY migration record (flagged OR non-flagged), **When** the correction is submitted, **Then** a correction reason of at least 10 characters is required. The save button is disabled until the reason meets the minimum length.

6. **Given** the RecordDetailDrawer, **When** opened for a non-flagged record, **Then** the correction reason textarea is visible (not hidden behind `isFlagged` check).

7. **Given** the backend correction endpoint, **When** a correction is submitted without a `correctionReason`, **Then** the server rejects it with a validation error.

### Both

8. **Given** all existing tests, **When** these changes are applied, **Then** all tests pass with zero regressions.

## Root Cause Analysis

### Finding #40: Supersede Shows Only Filenames + Counts

**Current SupersedeDialog:** `apps/client/src/pages/dashboard/components/SupersedeDialog.tsx` (lines 1-97)

Shows: "Upload X (N records) will be superseded by Upload Y (M records) for period — MDA"

**No comparison data:** No endpoint exists to compute record-level diff between two uploads. The dialog shows aggregate counts only. Admin clicks "Supersede" blindly — no visibility into what actually changes.

**Current supersede service:** `apps/server/src/services/supersedeService.ts` (lines 34-217)
- Marks old upload as superseded, cascades to records
- Re-runs observations for replacement upload
- Returns `SupersedeResponse` with counts only: `{ recordsSuperseded, baselinesAnnotated, observationsRegenerated }`

### Finding #42: Correction Reason Hidden for Non-Flagged Records

**RecordDetailDrawer:** `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx`

```typescript
// Line 482: Reason textarea ONLY renders for flagged records
{isFlagged && (
  <div>
    <label>Additional context <span>(required, min 10 characters)</span></label>
    <textarea ... />
  </div>
)}

// Line 507: Save button disabled check ONLY for flagged
disabled={... || (isFlagged && correctionReason.length < 10)}
```

**Backend schema:** `packages/shared/src/validators/migrationSchemas.ts` (lines 97-107)
```typescript
// correctMigrationRecordSchema — NO correctionReason field at all
export const correctMigrationRecordSchema = z.object({
  outstandingBalance: z.string().regex(...).optional(),
  totalLoan: z.string().regex(...).optional(),
  // ... other financial fields
  // NO correctionReason — completely absent
});
```

**Contrast with flagged record review schema (same file, lines 142-154):**
```typescript
// submitReviewSchema — correctionReason IS required
correctionReason: z.string().min(10, 'Correction reason must be at least 10 characters'),
```

**DB column:** `schema.ts:388` — `correctionReason: text('correction_reason')` — nullable, no NOT NULL constraint.

## Tasks / Subtasks

### Part A: Supersede Comparison (#40)

- [x] Task 1: Create supersede comparison service (AC: 1, 3, 4)
  - [x] 1.1: Create `apps/server/src/services/supersedeComparisonService.ts`:
    ```typescript
    export interface SupersedeComparisonResult {
      unchanged: number;
      modified: number;
      newRecords: number;
      removed: number;
      modifiedDetails: ModifiedRecordDiff[];
    }

    export interface ModifiedRecordDiff {
      staffName: string;
      staffId: string | null;
      changes: FieldChange[];
    }

    export interface FieldChange {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }

    export async function compareUploads(
      oldUploadId: string,
      newUploadId: string,
      mdaScope: string | null,
    ): Promise<SupersedeComparisonResult> {
    ```
  - [x] 1.2: Implementation strategy:
    - Load all `migration_records` for old upload (not superseded/deleted)
    - Load all `migration_records` for new upload
    - Match by `LOWER(TRIM(staffName))` as primary key, `employeeNo` as tiebreaker
    - For matched pairs: compare financial fields (principal, totalLoan, monthlyDeduction, outstandingBalance, installmentCount, installmentsPaid, installmentsOutstanding)
    - Unchanged: all compared fields equal
    - Modified: at least one field differs → record the diffs
    - New: in new upload but not in old
    - Removed: in old upload but not in new
  - [x] 1.3: Apply `withMdaScope` to both queries for MDA-scoped access
  - [x] 1.4: This is read-only — no data modification

- [x] Task 2: Create comparison API endpoint (AC: 4)
  - [x] 2.1: In `apps/server/src/routes/migrationRoutes.ts`, add:
    ```typescript
    // GET /api/migrations/:uploadId/supersede/compare/:replacementUploadId
    router.get(
      '/migrations/:uploadId/supersede/compare/:replacementUploadId',
      ...adminAuth,
      async (req: Request, res: Response) => {
        const oldUploadId = param(req.params.uploadId);
        const newUploadId = param(req.params.replacementUploadId);
        const result = await compareUploads(oldUploadId, newUploadId, req.mdaScope);
        res.json({ success: true, data: result });
      },
    );
    ```

- [x] Task 3: Add shared types for comparison (AC: 1, 2)
  - [x] 3.1: In `packages/shared/src/types/migration.ts`, add:
    ```typescript
    export interface SupersedeComparisonResult {
      unchanged: number;
      modified: number;
      newRecords: number;
      removed: number;
      modifiedDetails: ModifiedRecordDiff[];
    }

    export interface ModifiedRecordDiff {
      staffName: string;
      staffId: string | null;
      changes: FieldChange[];
    }

    export interface FieldChange {
      field: string;
      oldValue: string | null;
      newValue: string | null;
    }
    ```
  - [x] 3.2: Export from `packages/shared/src/index.ts`

- [x] Task 4: Add comparison hook (AC: 1)
  - [x] 4.1: In `apps/client/src/hooks/useMigrationData.ts`, add:
    ```typescript
    export function useSupersedeComparison(
      oldUploadId: string | null,
      newUploadId: string | null,
    ) {
      return useQuery<SupersedeComparisonResult>({
        queryKey: ['supersede', 'compare', oldUploadId, newUploadId],
        queryFn: () => apiClient<SupersedeComparisonResult>(
          `/migrations/${oldUploadId}/supersede/compare/${newUploadId}`
        ),
        enabled: !!oldUploadId && !!newUploadId,
        staleTime: 60_000,
      });
    }
    ```

- [x] Task 5: Update SupersedeDialog with comparison preview (AC: 1, 2)
  - [x] 5.1: In `apps/client/src/pages/dashboard/components/SupersedeDialog.tsx`:
    - **Note:** The dialog does NOT receive upload IDs as direct props. It receives `observation: ObservationListItem | null` and extracts IDs from `observation.context.dataPoints` (lines 26-27). Call the hook using these extracted values:
      ```typescript
      const olderUploadId = observation?.context?.dataPoints?.olderUploadId as string | undefined;
      const newerUploadId = observation?.context?.dataPoints?.newerUploadId as string | undefined;
      const comparison = useSupersedeComparison(olderUploadId ?? null, newerUploadId ?? null);
      ```
    - Show loading spinner while comparison fetches
    - Display diff summary:
      ```
      Record Comparison:
        Unchanged:  142 records
        Modified:    12 records  [View Details]
        New:          8 records
        Removed:      9 records
      ```
    - "View Details" expands to show `modifiedDetails` table with field-level diffs
  - [x] 5.2: For each modified record, show old → new values with amber highlight:
    ```
    ADEBAYO OLUSEGUN (OY/BIR/023)
      Monthly Deduction: ₦15,278 → ₦12,500
      Outstanding Balance: ₦234,000 → ₦287,000
    ```
  - [x] 5.3: Keep the existing "Supersede" confirmation button — comparison is informational, not blocking

### Part B: Mandatory Correction Reason (#42)

- [x] Task 6: Make correction reason mandatory in backend schema (AC: 5, 7)
  - [x] 6.1: In `packages/shared/src/validators/migrationSchemas.ts`, update `correctMigrationRecordSchema` (lines 97-107):
    ```typescript
    export const correctMigrationRecordSchema = z.object({
      outstandingBalance: z.string().regex(/^\d+(\.\d{1,2})?$/, '...').optional(),
      totalLoan: z.string().regex(/^\d+(\.\d{1,2})?$/, '...').optional(),
      monthlyDeduction: z.string().regex(/^\d+(\.\d{1,2})?$/, '...').optional(),
      installmentCount: z.number().int().min(1).max(120).optional(),
      installmentsPaid: z.number().int().min(0).max(120).optional(),
      installmentsOutstanding: z.number().int().min(0).max(120).optional(),
      correctionReason: z.string().min(10, 'Correction reason must be at least 10 characters'),  // NEW — REQUIRED
    }).refine(
      (data) => Object.values(data).filter(v => v !== undefined).length > 1,
      // Why > 1: correctionReason is always defined (required), so Object.values always has at least 1.
      // This check ensures at least one FINANCIAL field is also provided alongside the reason.
      { message: 'At least one field must be provided for correction' },
    );
    ```
  - [x] 6.2: **Do NOT add NOT NULL constraint to DB column** — existing records with NULL correctionReason should remain valid. The constraint is enforced at the API validation layer going forward.

- [x] Task 7: Show correction reason for ALL records in UI (AC: 5, 6)
  - [x] 7.1: In `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx`:
    - **Line 482:** Remove the `isFlagged &&` condition — show textarea for ALL corrections:
      ```typescript
      // BEFORE: {isFlagged && (
      // AFTER:
      {(
        <div>
          <label className="text-xs text-text-secondary block mb-1">
            Correction reason <span className="text-amber-600">(required, min 10 characters)</span>
          </label>
          <textarea
            value={correctionReason}
            onChange={(e) => setCorrectionReason(e.target.value)}
            placeholder="Explain why these values are being corrected..."
            rows={2}
            className="w-full px-2 py-1.5 text-sm border border-border rounded focus:outline-none focus:ring-1 focus:ring-teal resize-none"
          />
          {correctionReason.length > 0 && correctionReason.length < 10 && (
            <p className="text-[11px] text-amber-600 mt-0.5">
              {10 - correctionReason.length} more character{10 - correctionReason.length !== 1 ? 's' : ''} needed
            </p>
          )}
        </div>
      )}
      ```
    - **Line 507:** Remove the `isFlagged &&` condition on the save button:
      ```typescript
      // BEFORE: disabled={... || (isFlagged && correctionReason.length < 10)}
      // AFTER:
      disabled={correctMutation.isPending || reviewMutation.isPending || correctionReason.length < 10}
      ```
  - [x] 7.2: **Critical:** The non-flagged correction mutation at **line 371-374** currently passes `{ recordId, corrections }` — no `correctionReason`. After this fix, it must include `correctionReason`:
    ```typescript
    // BEFORE (line 371-374):
    correctMutation.mutate({ recordId, corrections });

    // AFTER:
    correctMutation.mutate({ recordId, corrections: { ...corrections, correctionReason } });
    ```
    Also verify that the `useCorrectMigrationRecord` hook in `useMigration.ts` passes all fields from `corrections` to the API body (it likely spreads the object into `JSON.stringify(corrections)`, so adding `correctionReason` to the object should work without hook changes).

### Part C: Tests

- [x] Task 8: Tests (AC: 8)
  - [x] 8.1: Add integration test for `GET /migrations/:id/supersede/compare/:id`:
    - Two uploads with overlapping staff → verify unchanged/modified/new/removed counts
    - Verify field-level diffs in `modifiedDetails`
  - [x] 8.2: Unit test for `compareUploads()` covered via integration test (full service path exercised with real DB)
  - [x] 8.3: Update correction endpoint test: verify 400 when `correctionReason` is missing or < 10 chars
  - [x] 8.4: Run full test suite: `pnpm test` in both `apps/server` and `apps/client`

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] M1: Fix misleading test description "returns 404" → "returns 400" [supersedeComparison.integration.test.ts:350]
- [x] [AI-Review][MEDIUM] M2: Add dept_admin success path test for comparison endpoint [supersedeComparison.integration.test.ts]
- [x] [AI-Review][MEDIUM] M3: Narrow SELECT to only needed columns in `compareUploads()` — reduces query payload ~65% [supersedeComparisonService.ts:115-134]
- [x] [AI-Review][LOW] L1: Make New/Removed counts expandable with staff name drill-down ("every number is a doorway") [SupersedeDialog.tsx, supersedeComparisonService.ts, migration.ts]
- [x] [AI-Review][LOW] L2: Add normalization edge case test (mixed case, extra whitespace) [supersedeComparison.integration.test.ts]
- [x] [AI-Review][LOW] L3: Add MetricHelp tooltips on supersede comparison categories [SupersedeDialog.tsx, metricGlossary.ts]

## Dev Notes

### Two Distinct Fixes — Can Be Implemented Independently

**Part A (Supersede comparison)** and **Part B (Correction reason)** have zero code overlap. If needed, they can be split into separate PRs or implemented by different developers.

### Supersede Comparison — Read-Only Preview

The comparison endpoint is **read-only** — it computes a diff without modifying data. The actual supersede operation is unchanged (still triggered by the existing `POST /migrations/:id/supersede` endpoint). The comparison is informational context shown in the dialog before the user confirms.

### Staff Matching Strategy for Comparison

```
Primary: LOWER(TRIM(staffName)) — same normalization as cross-MDA dedup
Secondary: employeeNo (exact match) — tiebreaker for common names
```

If primary match is ambiguous (multiple records with same name in same upload), use employeeNo. If still ambiguous, treat as separate records.

### Financial Fields to Compare

| Field | Column | Why Compare |
|-------|--------|-------------|
| Principal | `principal` | Loan amount |
| Total Loan | `totalLoan` | Total with interest |
| Monthly Deduction | `monthlyDeduction` | Repayment amount |
| Outstanding Balance | `outstandingBalance` | Current balance |
| Installments Paid | `installmentsPaid` | Payment progress |
| Installments Outstanding | `installmentsOutstanding` | Remaining payments |
| Grade Level | `gradeLevel` | Staff classification |

### E16 Cross-Month Diffing Pattern (Reusable)

Story 16.1's diffing engine (`16-1-cross-month-diffing-engine.md`) uses a similar pattern:
- Load two sets of records
- Match by staff ID
- Compute field-level changes
- Categorize as: new, disappeared, modified, unchanged

The supersede comparison can follow the same architecture but matches within the same MDA (not cross-month).

### Files to Touch

| File | Action |
|------|--------|
| `apps/server/src/services/supersedeComparisonService.ts` | **NEW** — diff computation |
| `apps/server/src/routes/migrationRoutes.ts` | Add GET compare endpoint |
| `packages/shared/src/types/migration.ts` | Add comparison types |
| `packages/shared/src/index.ts` | Export new types |
| `apps/client/src/hooks/useMigrationData.ts` | Add `useSupersedeComparison()` hook |
| `apps/client/src/pages/dashboard/components/SupersedeDialog.tsx` | Add comparison preview UI |
| `packages/shared/src/validators/migrationSchemas.ts` | Add `correctionReason` to correction schema |
| `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx` | Remove `isFlagged` conditions (lines 482, 507) |

### Architecture Compliance

- **Non-punitive vocabulary:** "Modified" not "Changed". "Removed" not "Deleted". "New" not "Added".
- **Every number is a doorway (Agreement #11):** Unchanged/Modified/New/Removed counts are clickable to see details
- **Audit trail:** Every correction now has a mandatory reason — no silent changes

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Findings #40, #42]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0n specification, line ~3546]
- [Source: `apps/server/src/services/supersedeService.ts:34-217` — current supersede flow]
- [Source: `apps/client/src/pages/dashboard/components/SupersedeDialog.tsx:1-97` — current dialog]
- [Source: `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx:482, 507` — isFlagged conditions]
- [Source: `packages/shared/src/validators/migrationSchemas.ts:97-107` — correction schema (missing reason)]
- [Source: `_bmad-output/implementation-artifacts/16-1-cross-month-diffing-engine.md` — reusable diffing pattern]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

None — no debug issues encountered.

### Completion Notes List

**Part A: Supersede Comparison (UAT #40)**
- Created `supersedeComparisonService.ts` — read-only diff engine using `normalizeName()` (same as cross-MDA dedup) + employeeNo as composite match key. Compares 8 fields: principal, totalLoan, monthlyDeduction, outstandingBalance, installmentCount, installmentsPaid, installmentsOutstanding, gradeLevel.
- Added `GET /migrations/:uploadId/supersede/compare/:replacementUploadId` endpoint behind adminAuth. MDA-scoped via withMdaScope on both upload queries.
- Updated SupersedeDialog with record comparison preview: Unchanged/Modified/New/Removed counts in a 2x2 grid, expandable "View details" section showing field-level diffs with old → new values (money fields formatted as Naira).
- Shared types (SupersedeComparisonResult, ModifiedRecordDiff, FieldChange) added to @vlprs/shared.
- `useSupersedeComparison()` hook added with 60s staleTime, enabled only when both upload IDs are present and dialog is open.

**Part B: Mandatory Correction Reason (UAT #42)**
- `correctMigrationRecordSchema` now requires `correctionReason: z.string().min(10)` for ALL corrections. Refine logic updated to check at least one financial field is also provided alongside the reason.
- `CorrectionInput` interface in migrationValidationService updated to `correctionReason: string` (required).
- `correctionWorksheetService.applyCorrectionWorksheet` updated for type compatibility — reason is always set from `record.reason` (guarded by existing `if` check).
- RecordDetailDrawer: removed `isFlagged &&` condition from textarea visibility (line 482) and save button disable check (line 507). Non-flagged corrections now spread `correctionReason` into the mutations payload.
- No DB migration needed — `correction_reason` column stays nullable (existing NULL records remain valid; constraint is enforced at API layer going forward).

**Tests**
- New integration test: `supersedeComparison.integration.test.ts` (6 tests) — verifies counts, field-level diffs, read-only guarantee, self-compare 400, missing upload 404, role gates 401/403.
- Updated existing: `migrationValidation.integration.test.ts` — all existing correction tests now include `correctionReason`. Added 3 new tests: missing reason (400), short reason (400), reason-only without financial field (400).
- Full suite: 80 server unit files (1065 tests), 45 integration files (646 tests), 93 client files (753 tests) — all pass with zero regressions.

### File List

**New files:**
- `apps/server/src/services/supersedeComparisonService.ts`
- `apps/server/src/routes/supersedeComparison.integration.test.ts`

**Modified files:**
- `packages/shared/src/types/migration.ts` — added SupersedeComparisonResult, ModifiedRecordDiff, FieldChange interfaces
- `packages/shared/src/index.ts` — exported new types
- `packages/shared/src/validators/migrationSchemas.ts` — added correctionReason to correctMigrationRecordSchema
- `apps/server/src/routes/migrationRoutes.ts` — added GET compare endpoint + import
- `apps/server/src/services/migrationValidationService.ts` — CorrectionInput.correctionReason now required
- `apps/server/src/services/correctionWorksheetService.ts` — type alignment for required correctionReason
- `apps/client/src/hooks/useMigrationData.ts` — added useSupersedeComparison hook
- `apps/client/src/pages/dashboard/components/SupersedeDialog.tsx` — comparison preview UI
- `apps/client/src/pages/dashboard/components/RecordDetailDrawer.tsx` — removed isFlagged conditions, mandatory reason for all
- `apps/server/src/routes/migrationValidation.integration.test.ts` — updated correction tests, added 3 new validation tests
- `packages/shared/src/constants/metricGlossary.ts` — added supersede comparison MetricHelp entries (review fix L3)

### Change Log

- 2026-04-12: Story 15.0n implemented — supersede comparison preview (UAT #40) + mandatory correction reason (UAT #42). 8 tasks, 9 new tests, all ACs satisfied.
- 2026-04-12: Code review — 3 MEDIUM + 3 LOW findings. All 6 fixed: narrowed SELECT, added newDetails/removedDetails drill-down, dept_admin test, normalization edge-case test, MetricHelp tooltips, test description typo. Integration tests: 6 → 8. Full suite: 2466 tests pass.
