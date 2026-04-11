# Story 15.0m: Within-File Deduplication Check

Status: done

## Story

As the **AG/Department Admin/MDA Officer**,
I want the system to detect when the same person appears twice in the same upload file for the same period,
So that duplicate records are flagged before baseline creation rather than silently creating two loans.

**Origin:** UAT Finding #36 (Medium) from E8 retro. Cross-MDA deduplication (Story 3.8) works. Within-file same-person-same-period detection does not exist. Pre-baseline check: "ADEBAYO appears twice in this upload for August 2024 — merge or flag?"

**Priority:** MEDIUM — data integrity. Silently creating two loans for the same person is worse than flagging and asking.

## Acceptance Criteria

1. **Given** an upload containing the same staff name twice for the same period (e.g., "ADEBAYO OLUSEGUN" appears in rows 15 and 42 for August 2024), **When** observations are generated, **Then** a `within_file_duplicate` observation is created identifying the staff name, period, duplicate count, and row numbers.

2. **Given** within-file duplicates are detected for an upload, **When** a user attempts batch baseline creation (`createBatchBaseline`), **Then** the baseline is blocked with error: "Baseline creation blocked: N staff member(s) appear multiple times in the same period. Resolve duplicates first."

3. **Given** the Observations tab, **When** `within_file_duplicate` observations exist, **Then** they are displayed with non-punitive language: "ADEBAYO OLUSEGUN appears 2 times in this upload for 2024-08. Review entries to determine if records should be merged or removed."

4. **Given** an upload where all within-file duplicates have been resolved (records deleted or merged), **When** baseline creation is re-attempted, **Then** the baseline proceeds normally.

5. **Given** the observation engine is re-run for the same upload, **When** duplicates were already detected, **Then** no duplicate observations are created (idempotency preserved via existing `batchInsertObservations` guard).

6. **Given** all existing tests, **When** the within-file dedup changes are applied, **Then** all tests pass with zero regressions.

## Root Cause Analysis

### The Gap

**Cross-MDA dedup (Story 3.8):** `deduplicationService.detectCrossFileDuplicates()` detects staff in BOTH parent and child MDA files. Works.

**Within-file dedup:** Nothing detects the same person appearing twice in the SAME upload for the SAME period. No observation type, no detector, no baseline guard, no DB constraint.

### How Duplicates Silently Create Two Loans

```
Upload Excel → confirmMapping() → inserts 2 records for "ADEBAYO" in Aug 2024
                                   (no uniqueness check)
→ validateUpload() → validates both records individually
                     (no within-file duplicate check)
→ createBatchBaseline() → creates 2 loans for same person
                          (no guard against duplicate staff/period)
```

### Current DB Schema — No Unique Constraint

`migration_records` table (`schema.ts:328-414`) has indexes on `(mdaId, periodYear, periodMonth)` but **no unique constraint** on `(uploadId, staffName, periodYear, periodMonth)`.

## Tasks / Subtasks

- [x] Task 1: Add `within_file_duplicate` observation type (AC: 1, 3)
  - [x] 1.1: In `packages/shared/src/types/observation.ts`, add to `ObservationType` union:
    ```typescript
    | 'within_file_duplicate'
    ```
  - [x] 1.2: In `apps/server/src/db/schema.ts`, add to the `observationTypeEnum` pgEnum array (find the enum definition — likely around line 460):
    ```typescript
    'within_file_duplicate'
    ```
  - [x] 1.3: Run `drizzle-kit generate` to create a NEW migration for the enum change.
  - [x] 1.4: Add glossary entry in `packages/shared/src/constants/metricGlossary.ts` (in `OBSERVATION_HELP` or equivalent):
    ```typescript
    within_file_duplicate: {
      label: 'Within-File Duplicate',
      description: 'Same staff member appears multiple times in the same upload for the same period.',
      guidance: 'Review entries to determine if records should be merged, one removed, or if they represent distinct individuals with similar names.',
    },
    ```

- [x] Task 2: Create `detectWithinFileDuplicates()` detector (AC: 1, 5)
  - [x] 2.1: In `apps/server/src/services/observationEngine.ts`, add a new detector function:
    ```typescript
    function detectWithinFileDuplicates(
      records: MigrationRecordRow[],
      mdaMap: Map<string, { id: string; name: string; code: string }>,
      uploadId: string,
    ): ObservationInsert[] {
      // Group by (normalized staffName, periodYear, periodMonth)
      const groups = new Map<string, MigrationRecordRow[]>();
      for (const record of records) {
        if (!record.periodYear || !record.periodMonth) continue;
        const key = `${record.staffName.toLowerCase().trim()}::${record.periodYear}-${String(record.periodMonth).padStart(2, '0')}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(record);
      }

      const observations: ObservationInsert[] = [];
      for (const [key, group] of groups) {
        if (group.length < 2) continue;
        const first = group[0];
        const period = `${first.periodYear}-${String(first.periodMonth).padStart(2, '0')}`;
        const mdaName = mdaMap.get(first.mdaId)?.name ?? 'Unknown MDA';

        observations.push({
          type: 'within_file_duplicate',
          staffName: first.staffName,
          staffId: first.employeeNo ?? null,
          loanId: null,
          mdaId: first.mdaId,
          migrationRecordId: first.id,
          uploadId,
          description: `${first.staffName} appears ${group.length} times in this upload for ${period}. Review to determine if entries should be merged or removed before baseline creation.`,
          context: {
            possibleExplanations: [
              'Data entry error — same person entered twice',
              'Duplicate row in source spreadsheet',
              'Same person with multiple loans in same period (requires manual review)',
              'Distinct individuals with similar names after normalization',
            ],
            suggestedAction: `Review all ${group.length} entries for ${first.staffName} in period ${period} at ${mdaName}. Remove duplicates or flag as distinct before baseline creation.`,
            dataCompleteness: 100,
            dataPoints: {
              staffName: first.staffName,
              period,
              duplicateCount: group.length,
              recordIds: group.map(r => r.id),
              mdaName,
            },
          },
          sourceReference: {
            file: first.sourceFile ?? '',
            sheet: first.sourceSheet ?? '',
            row: first.sourceRow ?? 0,
          },
        });
      }
      return observations;
    }
    ```
  - [x] 2.2: Call the detector inside `generateObservations()` alongside existing detectors (after `detectGradeTierMismatch` or `detectPeriodOverlap`):
    ```typescript
    const withinFileDupObs = detectWithinFileDuplicates(records, mdaMap, uploadId);
    allObservations.push(...withinFileDupObs);
    ```
  - [x] 2.3: Idempotency is guaranteed by the existing `batchInsertObservations()` composite guard (record + type + upload).

- [x] Task 3: Add baseline guard in `createBatchBaseline()` (AC: 2, 4)
  - [x] 3.1: In `apps/server/src/services/baselineService.ts`, inside `createBatchBaseline()` (after loading unbaselined records, around line 489), add a within-file duplicate check:
    ```typescript
    // Check for within-file duplicates before creating baselines
    const staffPeriodMap = new Map<string, string[]>();
    for (const record of records) {
      if (!record.periodYear || !record.periodMonth) continue;
      const key = `${record.staffName.toLowerCase().trim()}::${record.periodYear}-${String(record.periodMonth).padStart(2, '0')}`;
      if (!staffPeriodMap.has(key)) staffPeriodMap.set(key, []);
      staffPeriodMap.get(key)!.push(record.id);
    }
    const duplicates = [...staffPeriodMap.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([key, ids]) => {
        const [staffName, period] = key.split('::');
        return { staffName, period, count: ids.length };
      });

    if (duplicates.length > 0) {
      throw new AppError(
        422,
        'WITHIN_FILE_DUPLICATES_DETECTED',
        `Baseline creation blocked: ${duplicates.length} staff member(s) appear multiple times in the same period. ` +
        `Example: ${duplicates[0].staffName} appears ${duplicates[0].count} times in ${duplicates[0].period}. ` +
        `Review observations and resolve duplicates before retrying.`,
      );
    }
    ```
  - [x] 3.2: This guard is a hard stop — baselines cannot proceed until duplicates are resolved (records deleted or corrected).
  - [x] 3.3: Once duplicates are resolved (records removed), re-running baseline creation will pass the check (AC: 4).
  - [x] 3.4: **Scope note:** The query at line 486 filters to `flaggedForReviewAt IS NULL` — the guard only checks the auto-baseline partition (clean + minor records). If both duplicates are in the flagged-for-review partition, they won't be caught by this guard. The observation layer (Task 2) catches ALL duplicates regardless of partition. Consider adding the same guard to `baselineReviewedRecords()` in `mdaReviewService.ts:318-360` for completeness, or accept that the observation layer covers this edge case. **Decision:** accepted the edge case as documented in the story — the observation layer catches flagged-partition duplicates. Guard scope matches the story's sample code.

- [x] Task 4: Add non-punitive vocabulary for observation display (AC: 3)
  - [x] 4.1: Observation-type display labels live in `apps/client/src/pages/dashboard/components/ObservationCard.tsx` (frontend `TYPE_LABELS: Record<ObservationType, string>`), not in `vocabulary.ts`. Added `within_file_duplicate: 'Within-File Duplicate'` there; `vocabulary.ts` scope is unchanged.
  - [x] 4.2: The observation description already uses non-punitive language: "appears N times... Review to determine if entries should be merged or removed." No "error" or "violation" language. Covered by `uses non-punitive vocabulary in description and explanations` unit test.

- [x] Task 5: Tests (AC: 5, 6)
  - [x] 5.1: Added 8 unit tests for `detectWithinFileDuplicates()` in `observationEngine.test.ts`: case-insensitive match, multi-period groups, duplicate/non-duplicate cases, null-period skip, 3+ duplicates, non-punitive vocabulary.
  - [x] 5.2: Added integration test in `baseline.integration.test.ts` — batch baseline returns 422 `WITHIN_FILE_DUPLICATES_DETECTED` with `ADEBAYO OLUSEGUN` in the message, no loans created, and after removing one duplicate baseline proceeds and creates 1 loan (AC 4).
  - [x] 5.3: Added integration test in `observationEngine.integration.test.ts` verifying `generateObservations()` is idempotent — running twice produces one `within_file_duplicate` observation, not two.
  - [x] 5.4: Full regression: shared (449) ✓, server unit (1061) ✓, server integration (636) ✓, client (753) ✓. Server + client typecheck clean.

### Review Follow-ups (AI)

Adversarial code review (2026-04-11, Opus 4.6 — 9 findings: 2H, 4M, 3L).

- [x] [AI-Review][HIGH] H1: Review path `baselineReviewedRecords()` has no within-file duplicate guard — flagged-partition duplicates silently produce two loans. `createBaseline()` has no per-record duplicate check either. Add the same grouping guard at the top of `baselineReviewedRecords()` before the `createBaseline()` loop. [`apps/server/src/services/mdaReviewService.ts:321-370`]
- [x] [AI-Review][HIGH] H2: Detector + guard use `.toLowerCase().trim()` but Dev Notes claim parity with cross-MDA dedup — cross-MDA actually uses `normalizeName()` which strips honorifics (MRS, DR, CHIEF, ALHAJI…), parenthetical suffixes `(LATE)`, collapses interior whitespace, and strips trailing punctuation. Swap to `normalizeName()` in both sites; correct the Dev Notes wording. [`apps/server/src/services/observationEngine.ts` `detectWithinFileDuplicates`, `apps/server/src/services/baselineService.ts:512`]
- [x] [AI-Review][MEDIUM] M1: On first failed baseline attempt there's no resolution surface — observations only exist after baseline succeeds. Fire within-file duplicate detection post-validation (alongside the existing `detectCrossFileDuplicates()` auto-trigger at `migrationValidationService.ts:433`) so observations are visible before the first baseline click.
- [x] [AI-Review][MEDIUM] M2: Baseline guard error exposes only one example staff name. Include all duplicate groups (capped) in the message and pass the full list in `AppError` `details` so the frontend can render a resolution table. [`apps/server/src/services/baselineService.ts:529-538`]
- [x] [AI-Review][MEDIUM] M3: Detector + guard over-match distinct individuals who share a name — no escape hatch. Skip groups where all records have distinct non-null `employeeNo` (definitely distinct people). Apply in both the detector and the guard.
- [x] [AI-Review][MEDIUM] M4: Baseline guard runs `records.find(r => r.id === ids[0])` inside the duplicate loop — O(N·D). Store the first record reference in the map in the initial pass. [`apps/server/src/services/baselineService.ts:509-528`]
- [x] [AI-Review][LOW] L1: Error message in the guard uses three-line string concatenation. Consolidate via a single template literal or a `buildDuplicateMessage()` helper (naturally folds into M2). [`apps/server/src/services/baselineService.ts:534-537`]
- [x] [AI-Review][LOW] L2: `dataPoints.mdaName` is emitted by the detector but never asserted in any test. Add one assertion in `observationEngine.test.ts`. [`apps/server/src/services/observationEngine.test.ts` within-file block]
- [ ] [AI-Review][LOW] L3: Drizzle auto-generated migration name `0044_confused_nuke` is misleading for a one-line enum add. **DEFERRED.** Renaming an already-applied migration risks hash drift against `__drizzle_migrations` (see `docs/drizzle-migrations.md` and the Story 3.0b incident recorded in project memory). Cosmetic-only — leave as-is.

## Dev Notes

### Three-Layer Defense (after review fixes)

1. **Pre-baseline observation surface (fires at validation time — review finding M1):** `migrationValidationService.validateUpload()` fires `generateWithinFileDuplicateObservations(uploadId)` fire-and-forget alongside the existing `detectCrossFileDuplicates()` auto-trigger. The Observations tab now shows `within_file_duplicate` rows **before** the user clicks Baseline, so they have somewhere to drill in if the guard later blocks.
2. **Baseline guard, auto-baseline path (hard):** `createBatchBaseline()` calls `assertNoWithinFileDuplicates(records)` over the clean + minor partition. If any duplicates exist, throws `422 WITHIN_FILE_DUPLICATES_DETECTED` with the full list in `error.details`.
3. **Baseline guard, review path (hard — review finding H1):** `baselineReviewedRecords()` calls the same `assertNoWithinFileDuplicates()` over the flagged-for-review partition before looping into `createBaseline()`. This closes the gap where two duplicates that both happened to land in `significant_variance+` would have silently produced two loans under Stage 3.

Both guards share `findWithinFileDuplicateGroups()` from `observationEngine.ts`, which applies the same `normalizeName()` call + distinct-employeeNo escape hatch as the detector. There is no way for a duplicate to be caught by one layer but missed by the other.

**Error shape:** the 422 returns structured `details: [{ staffName, period, count, recordIds }, …]` so the frontend can render a resolution table (review finding M2). The message previews up to 20 affected staff names inline.

### Name Normalization

Matching delegates to `normalizeName()` in `apps/server/src/migration/nameMatch.ts` — the **same helper** used by the cross-MDA dedup engine. This collapses:

- case (`ADEBAYO OLUSEGUN` == `Adebayo Olusegun`)
- honorific prefixes (`MRS.`, `DR.`, `CHIEF`, `ALHAJI`, `PRINCE`, `ENGR.`, `PROF.`, `BARR.`, `HON.`, `REV.`, `PASTOR`, `OTUNBA`, `BAALE`)
- parenthetical suffixes (`(LATE)`, `(Mrs)`)
- interior whitespace (`ADEBAYO  OLUSEGUN` → `ADEBAYO OLUSEGUN`)
- trailing punctuation (`.`, `,`)

Review finding H2 caught that the initial implementation used `.toLowerCase().trim()`, which misses every honorific/parenthetical/double-space case and diverged from the cross-MDA engine despite the Dev Notes claiming parity. Both the detector (`detectWithinFileDuplicates`) and the baseline guard (`assertNoWithinFileDuplicates`) now share `findWithinFileDuplicateGroups()`, so they agree byte-for-byte on what counts as a duplicate.

Fuzzy matching (`ADEBAYO O.` vs `ADEBAYO OLUSEGUN`) is still out of scope for within-file — those remain the cross-MDA engine's job.

### Distinct-Staff Escape Hatch (Review Finding M3)

Because Nigerian public-service rosters contain common names, `findWithinFileDuplicateGroups()` skips any group where **every** record has a non-null `employeeNo` AND those IDs are all distinct. Two records for "MUHAMMED ALIYU" with `STAFF-1001` and `STAFF-2042` are almost certainly two different people and do not block baseline. Mixed groups (same name, one null ID + one non-null ID) and same-ID groups both remain flagged — those are the real duplicates.

### No DB Unique Constraint (Intentional)

Adding a `UNIQUE INDEX` on `(uploadId, LOWER(staffName), periodYear, periodMonth)` would prevent duplicates at the DB level but would BREAK the extraction flow — `confirmMapping()` would fail with a constraint violation instead of allowing the records through for review. The observation + baseline guard approach is more user-friendly: extract all records, flag duplicates, let users resolve before baseline.

### Files to Touch

| File | Action |
|------|--------|
| `packages/shared/src/types/observation.ts` | Add `'within_file_duplicate'` to union type |
| `apps/server/src/db/schema.ts` | Add to `observationTypeEnum` pgEnum |
| `apps/server/src/services/observationEngine.ts` | Add `detectWithinFileDuplicates()` detector + call it |
| `apps/server/src/services/baselineService.ts` | Add duplicate check guard in `createBatchBaseline()` |
| `packages/shared/src/constants/metricGlossary.ts` | Add glossary entry |
| New migration file | DB migration for enum change |

**No frontend changes needed** — observations display via existing `ObservationsList` component. The new type will render with its description automatically.

### Architecture Compliance

- **Non-punitive vocabulary:** "appears N times... Review to determine" — no "error", "violation", or "invalid"
- **Idempotency:** `batchInsertObservations()` guard prevents duplicate observations
- **Fire-and-forget pattern:** Observation generation runs as side effect (per Story 15.0b)
- **Extend, don't fork (Agreement):** New detector follows exact same pattern as 11 existing detectors

### Drizzle Migration Warning

Adding a value to a PostgreSQL enum requires an `ALTER TYPE ... ADD VALUE` migration. `drizzle-kit generate` handles this. Generate a NEW migration — never re-generate existing ones.

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Finding #36]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0m specification, line ~3538]
- [Source: `apps/server/src/services/deduplicationService.ts:54-94` — cross-MDA dedup (works, different scope)]
- [Source: `apps/server/src/services/observationEngine.ts:63-172` — existing detector framework]
- [Source: `apps/server/src/services/baselineService.ts:476-652` — createBatchBaseline (insertion point)]
- [Source: `apps/server/src/services/migrationService.ts:217-544` — confirmMapping (no within-file check)]
- [Source: `apps/server/src/db/schema.ts:328-414` — migration_records table (no unique constraint)]
- [Source: `packages/shared/src/types/observation.ts:1-13` — current 12 observation types]

## Dev Agent Record

### Agent Model Used

claude-opus-4-6 (1M context) via bmad-bmm dev-story workflow (2026-04-11).

### Debug Log References

- First server typecheck flagged the shared package ObservationType union wasn't rebuilt; ran `pnpm --filter @vlprs/shared build` then reran typecheck — clean.
- Follow-up typecheck flagged `Record<ObservationType, number>` sites missing `within_file_duplicate`: `observationService.getObservationCounts()` and `executiveSummaryReportService.test.ts` mock; added the key to both.
- Shared package's glossary enforcement test (`metricGlossary.test.ts`) hard-codes the list of known observation types — added `within_file_duplicate` to that list to keep orphan-entry and count assertions in sync.

### Implementation Plan

**Two-layer defense** as specified in the Dev Notes:
1. **Baseline guard (hard stop)** in `createBatchBaseline()` — groups the already-loaded auto-baseline partition by normalised staff name + period and throws `AppError(422, 'WITHIN_FILE_DUPLICATES_DETECTED', ...)` when any group size ≥ 2. Guard is scoped to the loaded records (clean + minor) per the story's sample; the story explicitly allows accepting the flagged-partition edge case since the observation layer catches it.
2. **Observation layer** via new `detectWithinFileDuplicates()` in `observationEngine.ts`, wired into `generateObservations()` after `detectGradeTierMismatch()`. Records without a resolvable period are excluded. Observations are record-level (migrationRecordId = first.id), which means the existing `(type, migration_record_id)` unique index in the observations table provides DB-level idempotency on re-run (AC 5).

**Observation shape:** description uses non-punitive vocabulary ("appears N times… Review to determine if entries should be merged or removed"), `context.dataPoints` exposes `period`, `duplicateCount`, `recordIds`, and `rowNumbers`, and `completenessNote` explains the detection scope.

**Schema change:** new Drizzle migration `0044_confused_nuke.sql` adds `'within_file_duplicate'` to `observation_type` enum (auto-generated via `drizzle-kit generate`, never re-generated). Migration applied cleanly via `pnpm db:migrate`.

**Front-end touch:** added a `TYPE_LABELS` entry in `ObservationCard.tsx` (the only `Record<ObservationType, string>` in the frontend) so the new observation type renders a human label without breaking TypeScript's exhaustive-record check.

### Completion Notes List

- All 6 acceptance criteria satisfied:
  - AC 1: `detectWithinFileDuplicates()` generates a `within_file_duplicate` observation per (staff + period) group with ≥ 2 records, recording staff name, period, duplicate count, and row numbers.
  - AC 2: `createBatchBaseline()` throws 422 `WITHIN_FILE_DUPLICATES_DETECTED` when duplicates are present in the auto-baseline partition; message lists the offending staff and period.
  - AC 3: Observation description uses non-punitive language; display label added to `OBSERVATION_HELP` and `ObservationCard`'s `TYPE_LABELS`.
  - AC 4: After removing one duplicate, the retry integration test confirms baseline proceeds normally and creates a loan.
  - AC 5: Idempotency integration test calls `generateObservations()` twice and asserts exactly one row in `observations` for the duplicate group.
  - AC 6: Full regression — shared 449, server unit 1061, server integration 636, client 753 — all passing. Server + client typecheck clean.
- **Tests added:** 8 unit tests in `observationEngine.test.ts`, 3 integration tests in `observationEngine.integration.test.ts`, 1 integration test in `baseline.integration.test.ts` (12 new tests total).
- **Schema migration:** `0044_confused_nuke.sql` applied — `ALTER TYPE "public"."observation_type" ADD VALUE 'within_file_duplicate'`.

### File List

**Modified:**
- `packages/shared/src/types/observation.ts` — added `'within_file_duplicate'` to `ObservationType` union
- `packages/shared/src/constants/metricGlossary.ts` — added `within_file_duplicate` entry to `OBSERVATION_HELP`
- `packages/shared/src/constants/metricGlossary.test.ts` — added `within_file_duplicate` to `OBSERVATION_TYPES` canonical list
- `apps/server/src/db/schema.ts` — added `'within_file_duplicate'` to `observationTypeEnum` pgEnum array
- `apps/server/src/services/observationEngine.ts` — new `detectWithinFileDuplicates()` detector, exported `findWithinFileDuplicateGroups()` helper (normalizeName-based, with M3 distinct-employeeNo escape hatch), exported `generateWithinFileDuplicateObservations()` for pre-baseline surface (review M1), wired into `generateObservations()`
- `apps/server/src/services/baselineService.ts` — shared `assertNoWithinFileDuplicates()` guard (review H2 + M2 + M4); `createBatchBaseline()` calls it over the auto-baseline partition; structured `details` returned in the 422 response
- `apps/server/src/services/mdaReviewService.ts` — `baselineReviewedRecords()` now calls `assertNoWithinFileDuplicates()` over the flagged-for-review partition before the `createBaseline()` loop (review H1)
- `apps/server/src/services/migrationValidationService.ts` — fires `generateWithinFileDuplicateObservations()` fire-and-forget after `validateUpload()`, alongside the existing `detectCrossFileDuplicates()` auto-trigger (review M1)
- `apps/server/src/services/observationService.ts` — `getObservationCounts()` now aggregates `within_file_duplicate`
- `apps/server/src/services/observationEngine.test.ts` — 8 original unit tests + 4 review-follow-up unit tests (honorifics/parentheticals/double-space collapse, distinct-employeeNo escape hatch, same-employeeNo still flagged, mixed-null-employeeNo still flagged, mdaName assertion)
- `apps/server/src/services/observationEngine.integration.test.ts` — 3 integration tests covering generation, no-op, and idempotency
- `apps/server/src/routes/baseline.integration.test.ts` — integration test for the 422 guard and post-resolution retry; now asserts structured `error.details` (review M2)
- `apps/server/src/services/mdaReviewService.integration.test.ts` — new integration test asserting `baselineReviewedRecords()` throws 422 when two flagged records collapse to the same person + period (review H1)
- `apps/server/src/services/executiveSummaryReportService.test.ts` — added `within_file_duplicate: 0` to `byType` mock
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — added `'Within-File Duplicate'` label to `TYPE_LABELS`

**Added:**
- `apps/server/drizzle/0044_confused_nuke.sql` — enum migration (filename kept as-is; see deferred review item L3)
- `apps/server/drizzle/meta/0044_snapshot.json` — drizzle snapshot (auto-generated)
- `apps/server/drizzle/meta/_journal.json` — journal update (auto-modified)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-04-11 | Story drafted from E8 retro Finding #36 | SM (Bob) |
| 2026-04-11 | Implementation — within-file duplicate detector + baseline guard + 12 new tests; drizzle migration 0044 applied; all regression suites green | Dev (Amelia) |
| 2026-04-11 | Adversarial code review (Opus 4.6) — 9 findings: 2H, 4M, 3L. Fixed 8 (H1, H2, M1, M2, M3, M4, L1, L2); L3 deferred (cosmetic, renaming applied migration carries hash-drift risk — see docs/drizzle-migrations.md) | Reviewer (AI) |
| 2026-04-11 | Review fixes — shared `findWithinFileDuplicateGroups()` + `assertNoWithinFileDuplicates()` helpers using `normalizeName()`; review path `baselineReviewedRecords()` now guarded; pre-baseline observation surface fires post-validation; structured `error.details` returned by the guard; new tests: H1 review-path integration test, M3 distinct-employeeNo escape hatch unit tests, H2 honorific/parenthetical collapse test, L1 mdaName assertion | Reviewer (AI) |
