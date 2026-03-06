# Story 3.0a: Regression Fixture Suite for Legacy Migration

Status: done

<!-- Generated: 2026-03-05 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: None | Blocks: 3-1-legacy-upload-intelligent-column-mapping -->
<!-- FRs: N/A (infrastructure) | Motivation: Epic 10 retrospective action item — Critical Prep #1 -->
<!-- Source: epic-10-retro-2026-03-05.md → Epic 3 Preparation → Critical Path #1 -->

## Story

As a **development team**,
I want a curated set of 7 representative legacy Excel files with paired known-good expected outputs,
So that every Epic 3 story can be validated against SQ-1's proven analysis and regressions are caught before they reach UAT.

### Context

SQ-1 processed 122+ legacy Excel files spanning 4 format eras (2016-2025), 32 MDAs, and 77,095 records. The full corpus is too large and noisy for automated testing. This story extracts 7 representative files that collectively cover every parsing edge case the migration engine will encounter:

- 4 format eras (pre-2018 minimal → 2023+ modern)
- Multi-MDA embedding (CDU inside Agriculture)
- Unusual/non-standard column headers
- High sheet count stress testing
- Cross-MDA staff that appear in multiple files

Each fixture file is paired with a `.expected.json` capturing the SQ-1 known-good parse output for that file. Stories 3.1-3.8 will use these fixtures as regression targets — the VLPRS migration engine must produce the same results as SQ-1 for the same input files.

**Why this matters:** Without a regression baseline, the dev agent has no automated way to verify that the migration engine parses legacy data correctly. UAT would be the first time we discover parsing errors — too late and too expensive. The regression suite makes parsing correctness a CI gate.

## Acceptance Criteria

### AC 1: Seven Representative Fixture Files

**Given** the 122+ legacy Excel files in `docs/legacy_cd/`
**When** 7 files are selected to form the regression fixture suite
**Then** they are copied to `tests/fixtures/legacy-migration/` and collectively cover:

| # | Era | Coverage Target | Selection Criteria |
|---|-----|----------------|--------------------|
| 1 | Era 1 (pre-2018) | Minimal column format | 12 columns, no MDA column, no interest breakdown |
| 2 | Era 2 (2018-2020) | Expanded format | 13-16 columns, adds Employee No and TAVS Commencement Date |
| 3 | Era 3 (2020-2023) | CDU standardised template | 17-18 columns, dominant format (most records in corpus) |
| 4 | Era 4 (2023+) | Modern format | 17-19 columns, adds START DATE / END DATE |
| 5 | Multi-MDA | CDU/Agriculture embedding | Agriculture file containing "COCOA DEVELOPMENT UNIT" marker in Column 3 mid-sheet |
| 6 | Edge case | Unusual headers | File where `header-detect.ts` required fallback or fuzzy matching |
| 7 | Stress test | High sheet count | Education file (~148 sheets) or similar high-volume single file |

### AC 2: Paired Expected Output Files

**Given** each fixture file
**When** processed through the SQ-1 `analyze.ts` pipeline
**Then** a corresponding `.expected.json` file exists alongside it containing:
- `filename`, `mda` (with resolution confidence), `sheets[]`
- Each sheet: `sheet` name, `period`, `era`, `headerConfidence`, `columnCount`, `recordCount`
- Each record: `sourceFile`, `sheet`, `rowNumber`, `period`, `mda` (per-record resolution object), and `fields` containing canonical field values (`staffName`, `principal`, `totalLoan`, `outstandingBalance`, `monthlyDeduction`, `installmentsOutstanding`, plus optional fields)
- The JSON structure matches the `catalog.json` output shape from `analyze.ts` (lines 509-522)

### AC 3: Fixture README Documentation

**Given** the fixture suite
**When** a developer opens `tests/fixtures/legacy-migration/README.md`
**Then** it documents:
- What each file tests and why it was selected
- The SQ-1 pipeline command used to generate expected outputs
- How to regenerate `.expected.json` files if the SQ-1 pipeline is updated
- Field mapping between SQ-1 output and VLPRS schema (for Story 3.1+ reference)

### AC 4: Expected Output Schema Validation

**Given** the `.expected.json` files
**When** parsed and validated
**Then** each file parses without error and conforms to the `catalog.json` entry structure documented in Dev Notes (filename, mda, sheets[] with records[]) — no missing required fields, no extra fields not present in the catalog schema

### AC 5: Expected Output Subset Verification

**Given** the `.expected.json` files
**When** compared against the full SQ-1 `catalog.json` output
**Then** the expected outputs are an exact subset — same data, same field values, no manual edits

## Tasks / Subtasks

- [x] Task 1: Identify fixture file candidates (AC: 1)
  - [x] 1.1 Load `docs/legacy_cd/output/manifest.csv` to review all files by era, MDA, column count, and record count
  - [x] 1.2 Select Era 1 representative: a pre-2018 file with 12 columns, no MDA column
  - [x] 1.3 Select Era 2 representative: a 2018-2020 file with 13-16 columns showing expanded fields
  - [x] 1.4 Select Era 3 representative: a 2020-2023 CDU standard template file (dominant format)
  - [x] 1.5 Select Era 4 representative: a 2023+ file with START DATE / END DATE columns
  - [x] 1.6 Select Multi-MDA representative: an Agriculture file containing embedded CDU records (marker: "COCOA DEVELOPMENT UNIT" in Column 3)
  - [x] 1.7 Select Edge case representative: identify files where `header-detect.ts` logs show lower confidence or fallback detection
  - [x] 1.8 Select Stress test representative: Education file with highest sheet count (~148 sheets)
  - [x] 1.9 Validate: all 7 files together cover all 4 eras, at least 2 MDAs, and the CDU embedding pattern

- [x] Task 2: Create fixture directory and copy files (AC: 1)
  - [x] 2.1 Create `tests/fixtures/legacy-migration/` directory
  - [x] 2.2 Copy 7 selected files with original filenames preserved
  - [x] 2.3 Verify each file opens correctly with ExcelJS / xlsx library (same library SQ-1 uses)

- [x] Task 3: Generate expected output files (AC: 2, 4, 5)
  - [x] 3.1 For each fixture file, extract its entries from the full `docs/legacy_cd/output/catalog.json`
  - [x] 3.2 Write each as `<original-filename>.expected.json` (e.g., `MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx.expected.json`)
  - [x] 3.3 Verify: JSON parse succeeds, record count matches manifest.csv, field structure matches catalog.json schema
  - [x] 3.4 Deterministic spot-check: for each fixture file, verify the first record, last record, and one mid-sheet record against the HTML reports for the same MDA to confirm data consistency (3 records × 7 files = 21 verification points)

- [x] Task 4: Write fixture README (AC: 3)
  - [x] 4.1 Create `tests/fixtures/legacy-migration/README.md`
  - [x] 4.2 Document each file: filename, era, MDA, column count, record count, sheet count, what it tests
  - [x] 4.3 Document the SQ-1 pipeline context: how `analyze.ts` works, how expected outputs were extracted
  - [x] 4.4 Document regeneration instructions: script or steps to re-extract from catalog.json if SQ-1 is updated
  - [x] 4.5 Document field mapping notes: which SQ-1 fields map to which VLPRS schema columns (reference for Stories 3.1+)

### Review Follow-ups (AI) — 2026-03-06

- [x] [AI-Review][HIGH] H1: Story Dev Notes schema wrong — shows flat record structure, actual is nested `{sourceFile, sheet, rowNumber, period, mda:{...}, fields:{...}}`. Lists non-existent fields `gradeLevel`, `bank`, `accountNo`. Fixed in Dev Notes.
- [x] [AI-Review][HIGH] H2: `headerConfidence` documented as `number` (0-1 score) but is actually `string` (`"high"|"medium"|"low"`). Fixed in Dev Notes.
- [x] [AI-Review][HIGH] H3: AC 2 references wrong field names (`name` → `staffName`, `installmentsRemaining` → `installmentsOutstanding`). Fixed AC text.
- [x] [AI-Review][MEDIUM] M1: 21MB fixture dir with no LFS tracking. Added `.gitattributes` with LFS rules for `*.xlsx` and `*.expected.json`.
- [x] [AI-Review][MEDIUM] M2: Test misplaced in `apps/server/src/db/`. Moved to `apps/server/src/migration/legacy-fixtures.test.ts`.
- [x] [AI-Review][MEDIUM] M3: Test took 14.7s. Added JSON caching — reduced to 6.5s (56% faster).
- [x] [AI-Review][MEDIUM] M4: Redundant JSON reads (each file parsed up to 4x). Eliminated via shared `loadExpectedJson()` cache.
- [x] [AI-Review][LOW] L1: Completion table used informal "AG Office" abbreviation. Corrected to "Accountant General's Office".
- [x] [AI-Review][LOW] L2: No test for CDU embedding pattern. Added `multi-MDA fixture contains CDU embedding marker in Excel` test.
- [x] [AI-Review][LOW] L3: No automated AC 5 subset verification. Added conditional `expected outputs are exact subsets of catalog.json` test.

## Dev Notes

### Critical Context

This is a **data extraction and documentation story** — no new features, no new API endpoints, no application code changes. The deliverables are: 7 Excel files, 7 JSON files, and 1 README.

**Why 7 files, not 122:** The full corpus contains massive redundancy (many files from the same MDA in the same era). Seven files covering the 4 eras + multi-MDA + edge cases + stress test gives us >95% edge case coverage with <6% of the files.

### SQ-1 Pipeline Reference

The SQ-1 analysis pipeline lives in `scripts/legacy-report/`:

- **Phase 1 (`analyze.ts`):** Reads every `.xlsx` in `docs/legacy_cd/`, detects headers (`utils/header-detect.ts`), maps columns (`utils/column-map.ts`), resolves MDAs (`utils/mda-resolve.ts`), extracts records, writes `catalog.json`
- **Phase 2 (`crossref.ts`):** Cross-references catalog records with approved beneficiary lists, builds person timelines, writes `analysis.json`
- **Phase 3 (`report.ts`):** Generates HTML reports from analysis.json

The `.expected.json` files should match the Phase 1 `catalog.json` shape — **per-file entries** from the catalog, not the cross-reference or report output.

### catalog.json Structure (from analyze.ts:65-78, 509-522)

```typescript
{
  filename: string,
  mda: { code: string, name: string, confidence: 'exact'|'alias'|'fuzzy'|'unresolved', source: string, rawInput: string },
  sheets: [{
    sheet: string,
    period: { month?: number, year?: number, range?: string },
    era: number,
    headerConfidence: string,  // "high" | "medium" | "low" (not numeric)
    columnCount: number,
    unrecognizedColumns: string[],
    recordCount: number,
    records: [{
      sourceFile: string,
      sheet: string,
      rowNumber: number,
      period: { year?: number, month?: number } | null,
      mda: { raw: string, resolved: string, code: string, confidence: string, source: string },
      fields: {
        staffName: string, mda?: string, serialNumber?: number | null,
        principal?: string | null, interestTotal?: string | null,
        totalLoan?: string | null, monthlyDeduction?: string | null,
        monthlyInterest?: string | null, monthlyPrincipal?: string | null,
        totalInterestPaid?: string | null, totalOutstandingInterest?: string | null,
        totalLoanPaid?: string | null, outstandingBalance?: string | null,
        installmentCount?: number | null, installmentsPaid?: number | null,
        installmentsOutstanding?: number | null, remarks?: string | null,
        startDate?: string | null, endDate?: string | null,
        employeeNo?: string | null, refId?: string | null,
        commencementDate?: string | null, station?: string | null
      }
    }]
  }]
}
```

### What NOT To Do

1. **DO NOT modify any SQ-1 pipeline code** — the pipeline is the source of truth, not this story
2. **DO NOT manually construct expected JSON** — extract from catalog.json to ensure exact match
3. **DO NOT include the full catalog.json in fixtures** — it's ~30MB. Only the 7 selected file entries
4. **DO NOT select files with unresolved MDAs** — pick files where MDA resolution is exact or alias (not fuzzy/unresolved) unless testing the edge case fixture specifically
5. **DO NOT pick duplicate files** — some files have `_1` suffixes (e.g., `CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE_1.xlsx`). Pick originals
6. **DO NOT include approved beneficiary lists** (2024_main_list.xlsx, 2025_main_list.xlsx) — those are cross-reference data, not deduction files

### File Selection Hints

From SQ-1 analysis and the `manifest.csv`:

- **Era 1:** Look for pre-2018 files — likely `MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx` or early Secretariat/Pensions files
- **Era 2:** 2018-2020 expanded format — `2019 AANFE OYSG MDAs CAR LOAN DEDUCTION.xlsx` or similar
- **Era 3:** CDU standard template — `2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx` (dominant format)
- **Era 4:** 2023+ modern — `CAR LOAN DEDUCTION DECEMBER, 2023..xlsx` or Secretariat 2024 files
- **Multi-MDA:** Any Agriculture file — `agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx` (contains CDU marker mid-sheet)
- **Edge case:** Check `unresolved-mdas.csv` for files that challenge header detection
- **Stress test:** `EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx` or `2020 EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx` (Education has the most sheets)

### Dependencies

- **Depends on:** SQ-1 pipeline complete (already done — `catalog.json` exists)
- **Blocks:** Story 3.1 (Legacy Upload & Intelligent Column Mapping) — regression targets needed
- **Can parallel with:** Story 3.0b (CDU Parent/Agency Relationship)

### References

- [Source: `scripts/legacy-report/analyze.ts`] — Phase 1 pipeline that produces catalog.json
- [Source: `scripts/legacy-report/utils/header-detect.ts`] — Header detection logic
- [Source: `scripts/legacy-report/utils/column-map.ts`] — Column mapping logic
- [Source: `scripts/legacy-report/utils/mda-resolve.ts`] — MDA name resolution (63 official MDAs + aliases)
- [Source: `scripts/legacy-report/README.md`] — Pipeline documentation
- [Source: `scripts/legacy-report/CLAUDE.md`] — Ad-hoc analysis context
- [Source: `docs/legacy_cd/output/catalog.json`] — Full SQ-1 parse output (~30MB)
- [Source: `docs/legacy_cd/output/manifest.csv`] — File-level summary for selection
- [Source: `_bmad-output/implementation-artifacts/epic-10-retro-2026-03-05.md`] — Retrospective requiring this prep
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md`] — Sprint change proposal with data findings

## Dev Agent Record

### Implementation Plan

Data extraction story — no application code changes. Approach:
1. Analysed `manifest.csv` (122 files, ~800 sheet-level rows) to identify optimal representatives for each fixture slot
2. Extracted 7 files from `docs/legacy_cd/` → `tests/fixtures/legacy-migration/`
3. Extracted per-file entries from `catalog.json` (~113MB) as `.expected.json` files — exact subsets, zero manual edits
4. Wrote comprehensive README with fixture table, schema docs, regeneration instructions, and VLPRS field mapping
5. Created `legacy-fixtures.test.ts` (27 tests) validating fixture integrity, schema conformance, era coverage, and MDA diversity

### Completion Notes

**Selections made:**

| # | File | Purpose | Era | MDA | Sheets | Records |
|---|------|---------|-----|-----|--------|---------|
| 1 | `MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx` | Era 1 minimal 12-col | 1 | Agriculture (alias) | 13 | 2,125 |
| 2 | `APRIL 2021 SEC CAR SOFTCOPY.xlsx` | Era 2 expanded 16-col | 2 | Accountant General's Office (alias) | 1 | 123 |
| 3 | `2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx` | Era 3 CDU standard 18-col | 3 | CDU (exact) | 18 | 354 |
| 4 | `AUDIT SERVICE COMMISSION Car Loan Returns - from March - December.xlsx` | Era 4 modern 19-col | 4 | Audit Service Commission (alias) | 10 | 38 |
| 5 | `agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx` | Multi-MDA CDU embedding | 4 | Agriculture (exact) | 2 | 346 |
| 6 | `APRIL 2020 sec car loan.xlsx` | Edge case — mixed eras, unusual column counts (5-21), low header confidence | 1,3 | Accountant General's Office (alias) | 6 | 846 |
| 7 | `EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx` | Stress test — 55 sheets (highest in corpus) | 1,2,3 | Education (alias) | 55 | 9,833 |

**Coverage:** All 4 eras, 5 MDAs, CDU embedding pattern, 105 sheets, 13,665 records.

**Validation results:**
- All 7 `.expected.json` files are byte-identical extracts from `catalog.json` (AC 5 verified)
- All 7 JSON files pass schema validation — no missing required fields (AC 4 verified)
- Record counts match `manifest.csv` for every sheet in every fixture
- 21/21 spot-checks confirm real data (staff names, financial amounts)
- All 7 Excel files open with `xlsx` library (same as SQ-1)
- 29 fixture integrity tests pass (27 original + 2 from code review: CDU embedding marker, catalog.json subset verification)
- Full regression suite: 686/686 tests pass (558 server + 126 shared + 2 testing), lint clean

**Note on stress test:** Story mentioned ~148 sheets for Education. Actual highest sheet count is 55 sheets (`EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx`). The ~148 figure may have included duplicate `_1` files or been an estimate. 55 sheets is still comfortably the highest in the corpus and serves the stress-test purpose.

**Note on xlsx library:** Story referenced ExcelJS but SQ-1 actually uses the `xlsx` library (SheetJS). Verified files with `xlsx` to match the actual pipeline.

## File List

### New Files
- `tests/fixtures/legacy-migration/MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx`
- `tests/fixtures/legacy-migration/APRIL 2021 SEC CAR SOFTCOPY.xlsx`
- `tests/fixtures/legacy-migration/2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx`
- `tests/fixtures/legacy-migration/AUDIT SERVICE COMMISSION Car Loan Returns - from March - December.xlsx`
- `tests/fixtures/legacy-migration/agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx`
- `tests/fixtures/legacy-migration/APRIL 2020 sec car loan.xlsx`
- `tests/fixtures/legacy-migration/EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx`
- `tests/fixtures/legacy-migration/MANR LOAN DEDUCTION JAN-DEC, 2018  CORRECTED.xlsx.expected.json`
- `tests/fixtures/legacy-migration/APRIL 2021 SEC CAR SOFTCOPY.xlsx.expected.json`
- `tests/fixtures/legacy-migration/2020 CDU OYSG MDAs CAR LOAN DEDUCTION TEMPLATE.xlsx.expected.json`
- `tests/fixtures/legacy-migration/AUDIT SERVICE COMMISSION Car Loan Returns - from March - December.xlsx.expected.json`
- `tests/fixtures/legacy-migration/agric_VEHINCLE LOAN DEDUCTION JANUARY- JULY, 2024.xlsx.expected.json`
- `tests/fixtures/legacy-migration/APRIL 2020 sec car loan.xlsx.expected.json`
- `tests/fixtures/legacy-migration/EDUCATION VEHICLE LOAN RETURNS TO AG.xlsx.expected.json`
- `tests/fixtures/legacy-migration/README.md`
- `apps/server/src/migration/legacy-fixtures.test.ts`
- `.gitattributes`

### Modified Files
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status: ready-for-dev → review)
- `_bmad-output/implementation-artifacts/3-0a-regression-fixture-suite.md` (this file)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-03-06 | Story 3.0a implemented: 7 fixture files + 7 expected JSONs + README + integrity test suite (27 tests) | Dev Agent |
| 2026-03-06 | Code review: Fixed 3 HIGH (wrong schema in Dev Notes, wrong headerConfidence type, wrong AC 2 field names), 4 MEDIUM (added .gitattributes LFS, moved test to migration/, JSON caching 14.7s→6.5s, eliminated redundant reads), 3 LOW (MDA name corrections, CDU embedding test, catalog subset test). Test suite now 29 tests. | Review Agent |
