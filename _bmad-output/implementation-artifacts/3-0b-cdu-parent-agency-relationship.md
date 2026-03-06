# Story 3.0b: CDU Parent/Agency Relationship in MDA Registry

Status: done

<!-- Generated: 2026-03-05 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: None | Blocks: 3-1-legacy-upload-intelligent-column-mapping, 3-8-multi-mda-file-delineation-deduplication -->
<!-- FRs: N/A (infrastructure) | Motivation: Epic 10 retrospective action item — Critical Prep #2 -->
<!-- Source: epic-10-retro-2026-03-05.md → Epic 3 Preparation → Critical Path #2 -->

## Story

As a **development team**,
I want the MDA registry to support parent/agency relationships so that CDU can be configured as an independent MDA with a parent relationship to Agriculture,
So that the migration engine (Stories 3.1, 3.2, 3.8) can correctly delineate CDU records embedded in Agriculture files and avoid double-counting.

### Context

SQ-1 discovered that CDU (Cocoa Development Unit) has a dual identity in the legacy data:

1. **8 independent CDU files** — submitted directly by CDU (2,266 records)
2. **CDU records embedded in ALL Agriculture files** — identified by "COCOA DEVELOPMENT UNIT" marker in Column 3 mid-sheet

This means Agriculture files contain two MDAs in one file. Story 3.8 (Multi-MDA File Delineation & Deduplication) must split these records correctly, which requires knowing that CDU is a sub-agency of Agriculture. The current `mdas` table has no mechanism to express this relationship.

**Why a separate story:** This is a schema change + migration + seed update that touches the database layer. It must land before Story 3.1 starts, so the migration engine can use the relationship from day one. Bundling it into 3.1 would overload that story and violate the sizing guardrail.

## Acceptance Criteria

### AC 1: Parent MDA Column

**Given** the `mdas` table in `apps/server/src/db/schema.ts`
**When** the schema is updated
**Then** a `parent_mda_id` column exists:
- Type: `uuid`, nullable
- References: `mdas.id` (self-referential foreign key)
- Semantics: if populated, this MDA is a sub-agency of the parent MDA
- Default: `null` (most MDAs have no parent)

### AC 2: CDU Configured as Sub-Agency of Agriculture

**Given** the MDA seed data
**When** the seed runs
**Then**:
- CDU exists as an independent MDA with `code: 'CDU'`, `name: 'Cocoa Development Unit'`
- Agriculture exists with `code: 'AGRICULTURE'`, `name: 'Ministry of Agriculture and Rural Development'`
- CDU's `parent_mda_id` points to Agriculture's `id`
- Both CDU and Agriculture are `is_active: true`

### AC 3: MDA Aliases Include CDU Variants

**Given** the `mda_aliases` table
**When** the seed runs
**Then** CDU has aliases covering all legacy naming variants observed by SQ-1:
- `CDU`
- `COCOA DEVELOPMENT UNIT`
- `OYO STATE COCOA DEVELOPMENT UNIT`
- `COCOA` (shorthand found in crossref.ts)
- `TCDU` (variant found in crossref.ts)

### AC 4: API Response Includes Parent Relationship

**Given** the MDA list API (`GET /api/mdas`)
**When** a client requests MDAs
**Then** each MDA in the response includes:
- `parentMdaId: string | null`
- `parentMdaCode: string | null` (denormalized for convenience — avoids client-side join)

### AC 5: Database Migration

**Given** the schema change
**When** `drizzle-kit` generates a migration
**Then**:
- The migration adds `parent_mda_id` column to `mdas` table
- The migration is reversible (column can be dropped)
- All existing MDA rows have `parent_mda_id = null` (no data loss)
- The foreign key constraint references `mdas.id`

### AC 6: Integration Tests

**Given** the parent/agency feature
**When** integration tests run
**Then** at minimum:
- Test: CDU record has `parent_mda_id` pointing to Agriculture's `id`
- Test: Agriculture record has `parent_mda_id = null`
- Test: API response includes `parentMdaId` and `parentMdaCode` fields
- Test: Querying MDAs by parent returns CDU under Agriculture

## Tasks / Subtasks

- [x] Task 1: Add `parent_mda_id` to schema (AC: 1, 5)
  - [x] 1.1 Add `parentMdaId` column to `mdas` table in `apps/server/src/db/schema.ts`
  - [x] 1.2 Type: `uuid('parent_mda_id').references(() => mdas.id)` — self-referential, nullable
  - [x] 1.3 Run `drizzle-kit generate` to create migration file
  - [x] 1.4 Verify migration SQL: `ALTER TABLE mdas ADD COLUMN parent_mda_id uuid REFERENCES mdas(id)`

- [x] Task 2: Update seed data (AC: 2, 3)
  - [x] 2.1 Open `apps/server/src/db/seed-demo.ts` (MDA seed data is in the `ALL_MDAS` array at line 10; aliases are seeded via `mdaAliases` table)
  - [x] 2.2 Ensure CDU entry exists with `code: 'CDU'`, `name: 'Cocoa Development Unit'`
  - [x] 2.3 After all MDAs are seeded, update CDU's `parent_mda_id` to Agriculture's `id`
  - [x] 2.4 Add CDU alias entries: `CDU`, `COCOA DEVELOPMENT UNIT`, `OYO STATE COCOA DEVELOPMENT UNIT`, `COCOA`, `TCDU`
  - [x] 2.5 Verify: seed is idempotent (re-running doesn't duplicate or error)

- [x] Task 3: Update MDA API response (AC: 4)
  - [x] 3.1 Locate the MDA list route (likely in `apps/server/src/routes/`)
  - [x] 3.2 Add `parentMdaId` to the response shape
  - [x] 3.3 Add `parentMdaCode` as a joined/denormalized field (LEFT JOIN mdas as parent or subquery)
  - [x] 3.4 Update Zod response schema if one exists

- [x] Task 4: Write integration tests (AC: 6)
  - [x] 4.1 Test: CDU has `parent_mda_id` pointing to Agriculture after seed
  - [x] 4.2 Test: Agriculture has `parent_mda_id = null`
  - [x] 4.3 Test: GET /api/mdas response includes `parentMdaId` and `parentMdaCode`
  - [x] 4.4 Test: CDU's `parentMdaCode` is `'AGRICULTURE'`
  - [x] 4.5 Test: query helper (if created) returns CDU when filtering by parent = Agriculture

- [x] Task 5: Verify no regressions (AC: all)
  - [x] 5.1 Run full test suite — zero regressions (all existing MDA tests pass with new nullable column)
  - [x] 5.2 Verify: MDA list UI (if rendered) doesn't break with the new fields
  - [x] 5.3 Verify: loan creation API still works (MDA lookup unaffected by new column)

### Review Follow-ups (AI) — 2026-03-06

- [x] [AI-Review][MEDIUM] M1: `Mda` base interface missing `parentMdaId` — type out of sync with schema [`packages/shared/src/types/mda.ts:6`] — **FIXED**: added `parentMdaId: string | null`
- [x] [AI-Review][MEDIUM] M2: MDA select shape duplicated 5× in mdaService.ts — DRY violation, drift risk [`apps/server/src/services/mdaService.ts`] — **FIXED**: extracted `mdaSelectFields` constant
- [x] [AI-Review][MEDIUM] M4: No filter-by-parent capability in `listMdas` — AC 6 bullet 4 not satisfied [`apps/server/src/services/mdaService.ts:23`] — **FIXED**: added `parentMdaId` filter + test
- [x] [AI-Review][LOW] L1: No index on `parent_mda_id` column — future queries (Story 3.8) benefit from index [`apps/server/src/db/schema.ts:41`] — **FIXED**: added `idx_mdas_parent_mda_id`, migration regenerated
- [ ] [AI-Review][LOW] M3: AC 2 specifies Agriculture name as `'Ministry of Agriculture and Rural Development'` but authoritative source (`docs/mdas_list.txt:60`) says `'Ministry of Agriculture'` — AC text inaccuracy, no code fix needed, update AC if desired
- [ ] [AI-Review][LOW] L2: Alias `'CDU'` in `mda_aliases` is unreachable (Layer 1 code match precedes Layer 3 alias lookup) — by-spec per AC 3, no fix needed

## Dev Notes

### Critical Context

This is a **schema + seed + API story** — adds one column, configures one relationship, extends one API response. Small blast radius but structurally important for Epic 3.

**Why CDU specifically:** CDU is the only known MDA with a parent/agency relationship in the legacy data. However, the schema is generic (`parent_mda_id` on `mdas` table) so if other sub-agencies are discovered during migration, the pattern is already in place.

**`parentMdaCode` denormalization is safe:** MDA codes are effectively immutable constants (government ministry identifiers). The denormalized `parentMdaCode` field in the API response (AC 4) avoids a client-side join with no consistency risk.

### Current Schema (mdas table)

From `apps/server/src/db/schema.ts:35-44`:

```typescript
export const mdas = pgTable('mdas', {
  id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
  name: varchar('name', { length: 255 }).notNull(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  abbreviation: varchar('abbreviation', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
```

Add after `abbreviation`:

```typescript
parentMdaId: uuid('parent_mda_id').references(() => mdas.id),
```

### CDU Legacy Data Profile (from SQ-1)

- **Independent files:** 8 CDU files, 2,266 records total
- **Embedded records:** Every Agriculture file (2018-2025) has "COCOA DEVELOPMENT UNIT" marker in Column 3 mid-sheet
- **Double-counting risk:** Without delineation, CDU staff appear in both CDU totals AND Agriculture totals
- **SQ-1 resolution:** `mda-resolve.ts` maps `CDU`, `COCOA DEVELOPMENT UNIT`, `OYO STATE COCOA DEVELOPMENT UNIT`, `COCOA`, `TCDU` → code `CDU`

### What NOT To Do

1. **DO NOT create a separate `mda_relationships` junction table** — a simple self-referential `parent_mda_id` is sufficient. CDU is a sub-agency, not a many-to-many relationship
2. **DO NOT add `parent_mda_id` as NOT NULL** — must be nullable since most MDAs have no parent
3. **DO NOT modify the SQ-1 pipeline** — this story is about the VLPRS database, not the analysis engine
4. **DO NOT add cascading deletes** — if Agriculture is soft-deleted, CDU should remain independently queryable
5. **DO NOT over-engineer hierarchy depth** — we're not building an org chart. One level (parent → child) is sufficient
6. **DO NOT add CDU aliases that aren't observed in the data** — only the 5 variants confirmed by SQ-1's `crossref.ts` and `mda-resolve.ts`

### Dependencies

- **Depends on:** Epic 1 complete (mdas table, seed infrastructure, API routes)
- **Blocks:** Story 3.1 (migration engine needs parent relationship for MDA resolution), Story 3.8 (multi-MDA delineation needs parent to split Agriculture/CDU)
- **Can parallel with:** Story 3.0a (Regression Fixture Suite)

### References

- [Source: `apps/server/src/db/schema.ts:35-44`] — Current mdas table schema
- [Source: `scripts/legacy-report/utils/mda-resolve.ts:80`] — CDU in authoritative MDA list
- [Source: `scripts/legacy-report/utils/mda-resolve.ts:134-136`] — CDU alias mappings
- [Source: `scripts/legacy-report/crossref.ts:51,93,113`] — CDU/COCOA/TCDU in crossref normalisation
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md`] — Findings #4 and #5 (CDU dual identity)
- [Source: `_bmad-output/implementation-artifacts/epic-10-retro-2026-03-05.md`] — Retrospective requiring this prep
- [Source: `_bmad-output/planning-artifacts/epics.md`] — Epic 3 Story 3.8 (Multi-MDA File Delineation)

## Dev Agent Record

### Implementation Notes

- Used `AnyPgColumn` type import from `drizzle-orm/pg-core` to resolve TypeScript circular reference in self-referential FK
- Used `aliasedTable(mdas, 'parent_mda')` for LEFT JOIN in all MDA service queries (listMdas, getMdaById, resolveMdaByName)
- CDU aliases seeded as separate step after OLD_CODE_ALIASES loop (step 3b in seed)
- CDU parent relationship set via `update()` after all MDAs inserted (step 3c in seed), ensuring Agriculture ID is available
- No Zod response schema existed for MDA list response (route returns service data directly), so Task 3.4 was N/A
- Migration 0006 generated: `ALTER TABLE "mdas" ADD COLUMN "parent_mda_id" uuid` + FK constraint `mdas_parent_mda_id_mdas_id_fk`

### Completion Notes

- All 6 ACs satisfied
- 7 new tests added to `mdaService.test.ts` covering parent relationship (CDU→Agriculture, null parents, denormalized code, alias resolution with parent fields, filter-by-parent)
- All 567 tests pass (41 test files), zero regressions
- Lint clean (0 errors, 2 pre-existing warnings unrelated to this story)
- Code review fixes applied: `Mda` type sync, select shape DRY extraction, `parentMdaId` filter, `parent_mda_id` index

## File List

- `apps/server/src/db/schema.ts` — Added `parentMdaId` column + `AnyPgColumn` import
- `apps/server/src/db/seed-demo.ts` — Added CDU aliases (5 variants), CDU→Agriculture parent relationship + `eq` import
- `apps/server/src/services/mdaService.ts` — Added `aliasedTable` parent join to listMdas, getMdaById, resolveMdaByName; added `parentMdaId` + `parentMdaCode` to all select shapes
- `apps/server/src/services/mdaService.test.ts` — Added CDU/Agriculture test data + 6 parent relationship tests; updated active MDA counts (2→4)
- `apps/server/drizzle/0006_lonely_mystique.sql` — Migration: ADD COLUMN parent_mda_id + FK constraint + index (new, regenerated during review)
- `apps/server/drizzle/meta/_journal.json` — Migration journal entry for 0006 (auto-generated)
- `apps/server/drizzle/meta/0006_snapshot.json` — Migration snapshot (auto-generated)
- `packages/shared/src/types/mda.ts` — Added `parentMdaId` and `parentMdaCode` to `MdaListItem` interface

## Change Log

- 2026-03-06: Story 3.0b implemented — Added `parent_mda_id` self-referential FK to `mdas` table, configured CDU as sub-agency of Agriculture with 5 legacy aliases, extended MDA API response with `parentMdaId`/`parentMdaCode` denormalized fields, 6 integration tests added
- 2026-03-06: Code review fixes — `Mda` base type synced with schema, extracted `mdaSelectFields` (DRY), added `parentMdaId` filter to `listMdas` + test, added `idx_mdas_parent_mda_id` index, migration regenerated (0006_lonely_mystique.sql); 567 tests pass, zero regressions
