
# Story 7.0h: Payroll Extract Upload & MDA Delineation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **SUPER_ADMIN (AG / Deputy AG)**,
I want to upload consolidated monthly payroll deduction extracts that are automatically split by MDA,
So that the system has an authoritative "what was actually deducted" data source to compare against MDA self-reported submissions.

## Acceptance Criteria

### AC 1: Payroll Upload Sidebar Navigation

**Given** the sidebar navigation
**When** a SUPER_ADMIN views the dashboard
**Then** a "Payroll Upload" item is visible, navigating to `/dashboard/payroll-upload`
**And** the item is NOT visible to DEPT_ADMIN or MDA_OFFICER

### AC 2: File Upload — CSV and XLSX Accepted

**Given** the payroll upload page
**When** the AG uploads a consolidated payroll extract (.xlsx or .csv, up to 10MB)
**Then** the system parses the file using the same 8-column format as MDA submissions (Staff ID, Month, Amount Deducted, Payroll Batch Reference, MDA Code, Event Flag, Event Date, Cessation Reason)
**And** both file formats are accepted (CSV via PapaParse, XLSX via xlsx library)

### AC 3: MDA Delineation Summary

**Given** a parsed payroll file
**When** the system processes the records
**Then** it identifies records for each MDA by the `MDA Code` column and presents a delineation summary: MDA name, record count per MDA, total deduction amount per MDA (₦ formatted), and any unmatched MDA codes
**And** the AG reviews the summary before confirming

### AC 4: Payroll Submission Storage

**Given** the AG confirms the delineation summary
**When** the system processes the confirmed upload
**Then** records are stored in `submission_rows` with `source = 'payroll'`, each record attributed to its correct MDA via separate `mda_submissions` records (one per MDA), and a payroll upload record is created with reference number format `PAY-YYYY-MM-NNNN`, timestamp, total record count, and MDA count

### AC 5: Validation Rules (Same as MDA Submissions)

**Given** the payroll upload uses the same 8-column format
**When** validated
**Then** Staff ID is required, Month in YYYY-MM format, Amount Deducted as valid number, MDA Code must map to known MDA. Event Flag, Event Date, and Cessation Reason are optional (may be empty in payroll extracts)

### AC 6: Coexistence with MDA Submissions

**Given** a payroll upload for a period where some MDAs have already submitted
**When** the upload is processed
**Then** the system does NOT overwrite MDA submissions — both coexist as independent records. MDA submissions = "declared" (what MDAs report), payroll = "actual" (what payroll deducted). Three-way reconciliation (Story 7.0i) compares them

### AC 7: Payroll-First Scenario

**Given** a payroll upload for a period where no MDA submissions exist yet
**When** processed
**Then** the payroll data is stored in `submission_rows` with `source = 'payroll'` — no reconciliation or comparison is triggered at this point. When an MDA later submits their data (via normal CSV/manual upload), the standard reconciliation pipeline runs on that MDA submission. Story 7.0i's three-way engine then compares expected (loans), declared (MDA submission), and actual (payroll) data. The payroll data is passive — it exists for comparison, not as a trigger

### AC 8: SUPER_ADMIN Only Access

**Given** a DEPT_ADMIN or MDA_OFFICER
**When** they attempt to access the payroll upload page or API
**Then** the sidebar item is not visible and the API returns 403

### AC 9: Single-Period Constraint

**Given** a payroll extract file
**When** all rows are validated
**Then** all rows must share the same period (YYYY-MM) — one upload = one month's payroll data. Mixed-period files are rejected with per-row error details

### AC 10: Performance

**Given** a payroll extract with up to 500 rows (consolidated across all MDAs)
**When** uploaded and processed
**Then** parsing + validation + delineation + storage completes in < 30 seconds

## Dependencies

- **Depends on:** Story 7.0g (supersede workflow must be complete — establishes record status patterns used here)
- **Blocks:** Story 7.0i (Three-Way Reconciliation) — requires payroll data to exist as the "actual" data source
- **Sequence:** 7.0a → ... → 7.0g → **7.0h** → 7.0i → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: Shared Types & Schemas (AC: 2, 3, 4, 5)
  - [x] 1.1 Create `packages/shared/src/types/payrollUpload.ts`:
    - `PayrollDelineationSummary`: `{ period: string, totalRecords: number, mdaBreakdown: Array<{ mdaCode: string, mdaName: string, recordCount: number, totalDeduction: string }>, unmatchedCodes: string[] }`
    - `PayrollUploadResponse`: `{ referenceNumbers: string[], totalRecords: number, mdaCount: number, period: string }`
    - `PayrollConfirmRequest`: `{ period: string }` (confirmation after delineation review)
  - [x] 1.2 Create `packages/shared/src/validators/payrollSchemas.ts`:
    - `payrollUploadSchema` — reuse `submissionRowSchema` base validation; relaxed Event Flag/Date/Cessation (optional for payroll)
    - `payrollConfirmSchema` — `{ period: z.string().regex(/^\d{4}-\d{2}$/) }`
  - [x] 1.3 Add vocabulary entries to `packages/shared/src/constants/vocabulary.ts`:
    - `VOCABULARY`: `PAYROLL_UPLOAD_CONFIRMED`, `PAYROLL_INVALID_FILE_TYPE`, `PAYROLL_MIXED_PERIOD`, `PAYROLL_UNMATCHED_MDA`, `PAYROLL_ROW_LIMIT_EXCEEDED`
    - `UI_COPY`: `PAYROLL_UPLOAD_HEADER`, `PAYROLL_DELINEATION_HEADER`, `PAYROLL_CONFIRM_PROMPT`
  - [x] 1.4 Export from `packages/shared/src/index.ts`

- [x] Task 2: Unified File Parser (AC: 2)
  - [x] 2.1 Create `apps/server/src/lib/fileParser.ts` — unified parser that accepts CSV or XLSX buffers. **Important: extract, don't call.** Move the PapaParse CSV parsing logic currently in `submissionService.ts:parseSubmissionCsv()` (lines 53-100) INTO `fileParser.ts` directly — this avoids a `lib → service` dependency (wrong direction). Then have `submissionService.ts` re-export from `fileParser.ts` for backward compatibility: `export { parseCsvRows as parseSubmissionCsv } from '../lib/fileParser'`. The unified parser then handles both paths internally:
    - Detect file type from extension or MIME type
    - CSV path: PapaParse logic (now local to fileParser.ts)
    - XLSX path: use `xlsx` library (same pattern as `migrationService.ts:69-96`), convert first sheet to row arrays, normalize to same `ParsedCsvRow[]` shape
    - Return: `ParsedCsvRow[]` regardless of input format
  - [x] 2.2 Export `parseSubmissionFile(buffer: Buffer, filename: string): ParsedCsvRow[]`
  - [x] 2.3 Add test: CSV input → same output shape as XLSX input for identical data

- [x] Task 3: Payroll Upload Service (AC: 3, 4, 5, 6, 7, 9, 10)
  - [x] 3.1 Create `apps/server/src/services/payrollUploadService.ts`
  - [x] 3.2 Implement `previewPayrollUpload(buffer, filename)`:
    - Parse file via `parseSubmissionFile()`
    - Validate rows via `validateSubmissionRows()` from `submissionService.ts` (reuse)
    - Validate single-period constraint: all rows must share same `month` value (AC 9)
    - Group rows by `mdaCode` column
    - For each MDA code: resolve via `resolveMdaByName()` or direct code lookup
    - Build delineation summary: MDA name, record count, total deduction (Decimal sum), unmatched codes
    - Return `PayrollDelineationSummary` — frontend displays for AG review
  - [x] 3.3 Implement `confirmPayrollUpload(summary, rows, userId)`:
    - Reject if any unmatched MDA codes remain (AG must fix the file)
    - For each MDA in the breakdown:
      - Create `mda_submissions` record with `source = 'payroll'`, reference number `PAY-{period}-{seq}`
      - Insert `submission_rows` for that MDA's records
    - All in single `db.transaction()` (or `withTransaction`)
    - Generate reference numbers: `PAY-YYYY-MM-NNNN` format — separate sequence from `BIR-*`
    - Return `PayrollUploadResponse`
  - [x] 3.4 Implement reference number generation: `generatePayrollReference(period)` — query max existing `PAY-{period}-*` reference, increment sequence
  - [x] 3.5 Relaxed validation for payroll: Event Flag defaults to `'NONE'` if empty, Event Date and Cessation Reason default to `null` — payroll extracts may not include event information
  - [x] 3.6 Row limit: 500 rows max per payroll upload (consolidated across all MDAs). Reject with `PAYROLL_ROW_LIMIT_EXCEEDED` if exceeded
  - [x] 3.7 DO NOT trigger reconciliation or comparison for payroll uploads — Story 7.0i's three-way engine handles this separately
  - [x] 3.8 Fire-and-forget email confirmation to uploading user (SUPER_ADMIN)

- [x] Task 4: Payroll Upload Routes (AC: 1, 8)
  - [x] 4.1 Create `apps/server/src/routes/payrollRoutes.ts`:
    - `POST /api/payroll/upload` — preview (returns delineation summary)
    - `POST /api/payroll/confirm` — confirm and persist
    - `GET /api/payroll` — list payroll uploads (period filter)
    - `GET /api/payroll/:id` — payroll upload detail with per-MDA breakdown
  - [x] 4.2 Upload middleware: `authenticate → requirePasswordChange → authorise(SUPER_ADMIN) → writeLimiter → fileUpload.single('file') → auditLog`
  - [x] 4.3 File upload filter: accept `.csv` and `.xlsx` only, 10MB limit
  - [x] 4.4 Set `req.auditAction = 'PAYROLL_UPLOAD_PROCESSED'` and `'PAYROLL_UPLOAD_CONFIRMED'`
  - [x] 4.5 Register routes in `app.ts`

- [x] Task 5: Source Value Extension (AC: 4, 6)
  - [x] 5.1 Update `mda_submissions.source` column comment in `schema.ts` to list all 4 values: `// 'csv' | 'manual' | 'historical' | 'payroll'`. The current comment only shows `'csv' | 'manual'` — it's already missing `'historical'` (added by Story 11.4). Fix the full list in one pass
  - [x] 5.2 Update `SubmissionDetail.source` type in `packages/shared/src/types/submission.ts` to include `'payroll'`
  - [x] 5.3 Update `processSubmissionRows` source union type if the payroll service calls it directly (or keep separate pipeline)
  - [x] 5.4 Add defensive guard in `submissionService.ts`: payroll source must NOT trigger reconciliation (Story 11.3) or comparison (Story 5.4) — same pattern as historical guard

- [x] Task 6: Backend Tests (AC: all)
  - [x] 6.1 Create `apps/server/src/services/payrollUploadService.test.ts`:
    - Test: CSV file parsed correctly → delineation summary with MDA breakdown
    - Test: XLSX file parsed correctly → same output shape as CSV
    - Test: single-period constraint — mixed periods rejected
    - Test: unmatched MDA codes flagged in summary
    - Test: confirmed upload creates separate mda_submissions per MDA with source='payroll'
    - Test: reference number format PAY-YYYY-MM-NNNN
    - Test: 500+ rows rejected with limit error
    - Test: relaxed validation — empty Event Flag defaults to NONE
    - Test: payroll + MDA submission coexist for same period (AC 6)
    - Test: DEPT_ADMIN/MDA_OFFICER get 403
  - [x] 6.2 Create `apps/server/src/lib/fileParser.test.ts`: CSV and XLSX parsing produce identical row structure

- [x] Task 7: Frontend — Payroll Upload Page (AC: 1, 2, 3)
  - [x] 7.1 Create `apps/client/src/pages/dashboard/PayrollUploadPage.tsx`:
    - FileUploadZone accepting .csv and .xlsx (reuse drag-drop pattern from SubmissionsPage)
    - Label: "Upload Monthly Payroll Deduction Extract"
    - Info panel: "Upload the consolidated monthly payroll deduction extract (.csv or .xlsx). The system will identify records for each MDA and present a summary for your review."
  - [x] 7.2 Delineation summary view after upload:
    - Table: MDA Name | Record Count | Total Deduction (₦)
    - Warning section for unmatched MDA codes (if any): "X records with unrecognized MDA codes — please correct the file and re-upload"
    - "Confirm Upload" button (disabled if unmatched codes exist)
  - [x] 7.3 Confirmation result view:
    - Reference numbers listed per MDA
    - Total records, MDA count, period
    - Success toast: "Payroll data uploaded — [N] records across [M] MDAs"

- [x] Task 8: Frontend — Hook & Route Registration (AC: 1)
  - [x] 8.1 Create `apps/client/src/hooks/usePayrollUpload.ts`:
    - `usePayrollPreview()` — `useMutation` with `POST /api/payroll/upload` (FormData)
    - `usePayrollConfirm()` — `useMutation` with `POST /api/payroll/confirm`
    - `usePayrollList(period?)` — `useQuery` with `GET /api/payroll`
  - [x] 8.2 Add sidebar item to `navItems.ts`: `{ label: 'Payroll Upload', path: '/dashboard/payroll-upload', icon: FileSpreadsheet, roles: [ROLES.SUPER_ADMIN] }`
  - [x] 8.3 Add lazy route to `router.tsx`: `/dashboard/payroll-upload` → lazy-loaded `PayrollUploadPage`

- [x] Task 9: Frontend Tests (AC: 2, 3)
  - [x] 9.1 Create `apps/client/src/pages/dashboard/PayrollUploadPage.test.tsx`:
    - Test: renders upload zone with CSV + XLSX acceptance
    - Test: delineation summary table displays MDA breakdown
    - Test: unmatched codes warning prevents confirmation
    - Test: successful confirmation shows reference numbers

- [x] Task 10: Full Test Suite Verification (AC: all)
  - [x] 10.1 Run `pnpm typecheck` — zero type errors
  - [x] 10.2 Run `pnpm lint` — zero lint errors
  - [x] 10.3 Run server tests — all pass (91 files, 1303 tests)
  - [x] 10.4 Run client tests — all pass with zero regressions (77 files, 599 tests)

- [x] Task 11: [Ad-Hoc Refactor] Promote MDA seed data to shared constant (PO-requested, no AC change)
  - **Rationale:** The canonical 63-MDA list and 38 legacy-code aliases lived inline in `seed-demo.ts`. This story's payroll delineation resolves MDA codes (Task 3.2) — having the authoritative list in `@vlprs/shared` means any future consumer (payroll, reconciliation, reports) can import it without depending on the database layer. PO-requested during implementation session.
  - [x] 11.1 Create `packages/shared/src/constants/mdas.ts`:
    - `MDA_LIST`: 63 entries (`as const` for literal types)
    - `MDA_ALIASES`: 38 legacy-to-canonical mappings (`as const`). Only 38 of 63 MDAs have aliases because the remaining 25 (OYSHMB, TESCOM, BCOS, SUBEB, CDU, BIR, CSC, etc.) already used their canonical code in legacy data — no remapping needed
    - `MdaCode` derived type: `(typeof MDA_LIST)[number]['code']` — enables type-safe MDA code references
    - `mdaByCode()` lookup helper
  - [x] 11.2 Export from `packages/shared/src/index.ts`
  - [x] 11.3 Update `apps/server/src/db/seed-demo.ts` — replaced inline arrays with `import { MDA_LIST, MDA_ALIASES } from '@vlprs/shared'`. Removed dead `oldCode === newCode` guard (now provably unreachable via `as const` literal types)
  - [x] 11.4 Codebase scan: `scripts/legacy-report/utils/mda-resolve.ts` has its own copy with 200+ fuzzy aliases — intentionally left standalone (separate analysis pipeline with its own CLAUDE.md, coupling would be false coupling)
  - [x] 11.5 Verified: `pnpm typecheck` clean, seed-verification tests pass (6/6), zero behavioral change

### Review Follow-ups (AI) — Code Review 2026-03-22

- [x] [AI-Review][HIGH] File List missing `submissionSchemas.ts` — added to Modified Files [packages/shared/src/validators/submissionSchemas.ts]
- [x] [AI-Review][HIGH] N+1 query in `getPayrollUploadDetail` — replaced per-MDA SUM loop with single aggregated `GROUP BY` query [payrollUploadService.ts:419-434]
- [x] [AI-Review][MEDIUM] Fragile batch detection in `getPayrollUploadDetail` — now matches on exact `createdAt` timestamp instead of period-only [payrollUploadService.ts:410]
- [x] [AI-Review][MEDIUM] Fragile minute-level grouping in `listPayrollUploads` — now uses exact timestamp for grouping key [payrollUploadService.ts:338-346]
- [x] [AI-Review][MEDIUM] Dead code `payrollRowSchema` — removed unused schema from `payrollSchemas.ts` and `index.ts` export; validation handled by `submissionRowSchema` with pre-processing
- [x] [AI-Review][MEDIUM] Frontend tests used conditional assertions (silent pass) — replaced `queryBy*` + `if` with `getBy*` assertions that throw on missing elements [PayrollUploadPage.test.tsx]
- [x] [AI-Review][MEDIUM] CSV parser errors used submission-specific vocabulary for payroll uploads — added error wrapping in `previewPayrollUpload` to re-throw with `PAYROLL_EMPTY_FILE` [payrollUploadService.ts:78-85]
- [x] [AI-Review][LOW] Reference number race condition documented — added comment noting unique constraint mitigation [payrollUploadService.ts:290-292]

## Dev Notes

### Technical Requirements

#### Unified File Parser

**Problem:** Submission pipeline currently only handles CSV (PapaParse). Payroll extracts may be Excel (.xlsx).

**Solution:** Create `apps/server/src/lib/fileParser.ts` that detects file type and normalizes output:

```typescript
import XLSX from 'xlsx';
import Papa from 'papaparse';

// CSV parsing logic extracted from submissionService.ts:parseSubmissionCsv (lines 53-100)
// submissionService re-exports this for backward compatibility
function parseCsvRows(buffer: Buffer): ParsedCsvRow[] {
  const csv = buffer.toString('utf-8');
  const { data } = Papa.parse(csv, { header: true, skipEmptyLines: true });
  return data as ParsedCsvRow[];
}

export function parseSubmissionFile(buffer: Buffer, filename: string): ParsedCsvRow[] {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.csv') {
    return parseCsvRows(buffer);
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.read(buffer, { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]]; // First sheet only
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
    // Skip header row, normalize to ParsedCsvRow[] shape
    return normalizeXlsxRows(rows);
  }
  throw new AppError(400, 'PAYROLL_INVALID_FILE_TYPE', VOCABULARY.PAYROLL_INVALID_FILE_TYPE);
}
```

**xlsx library** is already installed (`apps/server/package.json`) — used by migration upload service.

#### MDA Delineation — Per-Row MDA Code

Unlike migration uploads (which may have MDA names buried in sheet headers), payroll extracts use the same 8-column format with an explicit `mdaCode` field per row. This makes delineation straightforward:

1. Group rows by `mdaCode`
2. For each unique code: resolve to MDA via `mdas.code` lookup (Layer 1 exact match)
3. Build summary: `{ mdaCode, mdaName, recordCount, totalDeduction }`
4. Flag unresolvable codes as unmatched

**No need for Story 3.8's full delineation service** — the per-row MDA code is explicit. Use a simple `Map<string, Row[]>` grouping.

#### Reference Number Generation — PAY- Prefix

The existing reference number generator uses `BIR-` prefix. Payroll needs `PAY-` prefix with same sequential pattern:

```typescript
async function generatePayrollReference(period: string): Promise<string> {
  const prefix = `PAY-${period}-`;
  const [result] = await db
    .select({ ref: sql<string>`MAX(reference_number)` })
    .from(mdaSubmissions)
    .where(sql`reference_number LIKE ${prefix + '%'}`);
  const lastSeq = result?.ref ? parseInt(result.ref.slice(-4), 10) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}
```

**One `mda_submissions` record per MDA** — a consolidated payroll upload for 30 MDAs creates 30 submission records, each with its own `PAY-2026-03-NNNN` reference number.

#### Payroll vs Other Sources — Pipeline Routing

| Aspect | CSV (MDA) | Manual | Historical | **Payroll** |
|--------|-----------|--------|------------|-------------|
| Source | `'csv'` | `'manual'` | `'historical'` | `'payroll'` |
| Reference | `BIR-*` | `BIR-*` | `BIR-*` | **`PAY-*`** |
| Reconciliation (11.3) | Yes | Yes | No | **No** |
| Comparison (5.4) | Yes | Yes | No | **No** |
| MDA Scoping | scopeToMda | scopeToMda | scopeToMda | **No scope** (AG sees all) |
| Event flags | Required | Required | Required | **Optional** (default NONE) |
| Three-way (7.0i) | Provides "declared" | Provides "declared" | N/A | **Provides "actual"** |

**Guard in processSubmissionRows:** Add `if (source === 'payroll')` alongside the existing `if (source === 'historical')` guard to skip reconciliation and comparison.

#### Coexistence Model

Payroll and MDA submissions coexist in the same `mda_submissions` + `submission_rows` tables, distinguished by `source`:

- MDA officer uploads → `source = 'csv'` or `'manual'` → "declared deductions"
- AG uploads payroll → `source = 'payroll'` → "actual deductions from payroll"
- Story 7.0i joins the three sources (expected from loans, declared from submissions, actual from payroll) for three-way reconciliation

**No overwrites, no conflicts.** Both exist independently for the same MDA + period.

### Architecture Compliance

- **API envelope:** `{ success: true, data: PayrollDelineationSummary | PayrollUploadResponse }`
- **SUPER_ADMIN only:** `authorise(SUPER_ADMIN)` — no `scopeToMda` (AG sees all MDAs)
- **Non-punitive vocabulary:** "Unmatched MDA codes" not "Invalid codes"
- **Audit trail:** `PAYROLL_UPLOAD_PROCESSED` and `PAYROLL_UPLOAD_CONFIRMED` via auditLog middleware
- **Money precision:** Total deduction amounts computed with Decimal.js (sum per MDA)

### Library & Framework Requirements

- **xlsx** (`xlsx` package): Already installed for migration uploads
- **PapaParse** (`papaparse`): Already installed for CSV submission parsing
- **multer**: Already configured — extend file filter for .xlsx
- **No new dependencies**

### File Structure Requirements

#### New Files

```
packages/shared/src/
├── types/payrollUpload.ts                             ← NEW: PayrollDelineationSummary, PayrollUploadResponse types
└── validators/payrollSchemas.ts                       ← NEW: payroll validation schemas

apps/server/src/
├── lib/fileParser.ts                                  ← NEW: unified CSV/XLSX parser
├── lib/fileParser.test.ts                             ← NEW: parser tests
├── services/payrollUploadService.ts                   ← NEW: payroll upload + delineation + confirmation
├── services/payrollUploadService.test.ts              ← NEW: service tests
└── routes/payrollRoutes.ts                            ← NEW: 4 payroll endpoints (SUPER_ADMIN only)

apps/client/src/
├── pages/dashboard/PayrollUploadPage.tsx               ← NEW: upload page with delineation summary
├── pages/dashboard/PayrollUploadPage.test.tsx           ← NEW: component tests
└── hooks/usePayrollUpload.ts                          ← NEW: TanStack Query hooks
```

#### Modified Files

```
packages/shared/src/
├── types/submission.ts                                ← MODIFY: add 'payroll' to source type
├── constants/vocabulary.ts                            ← MODIFY: add payroll vocabulary entries
├── index.ts                                           ← MODIFY: export new types/schemas

apps/server/src/
├── services/submissionService.ts                      ← MODIFY: add payroll source guard (skip reconciliation/comparison)
├── app.ts                                             ← MODIFY: register payroll routes
├── db/schema.ts                                       ← MODIFY: update source column comment

apps/client/src/
├── components/layout/navItems.ts                      ← MODIFY: add "Payroll Upload" sidebar item (SUPER_ADMIN only)
└── router.tsx                                         ← MODIFY: add lazy route for /dashboard/payroll-upload
```

### Testing Requirements

- **fileParser.test.ts:** CSV and XLSX produce identical `ParsedCsvRow[]` output
- **payrollUploadService.test.ts:** 10 test cases (parse, validate, delineate, confirm, edge cases)
- **PayrollUploadPage.test.tsx:** 4 component tests (upload zone, delineation table, unmatched warning, confirmation)
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.0g (Upload Supersede & Record Resolution — Previous in Sequence)

- **Status:** ready-for-dev (as of 2026-03-20)
- **Record status patterns:** 7.0g introduces `migrationRecordStatusEnum` ('active', 'superseded') and the `isActiveRecord()` helper in `db/queryHelpers.ts`. Payroll data uses `submission_rows` (not `migration_records`), so the superseded status doesn't directly apply — but the pattern of status-based filtering is relevant if payroll uploads ever need a supersede workflow
- **withTransaction usage:** 7.0g uses `withTransaction()` from 7.0b — payroll's `confirmPayrollUpload` should use the same pattern for the multi-MDA INSERT transaction
- **baseline_annotations table:** 7.0g creates this companion table for immutable ledger annotations. Not directly used by payroll, but establishes the annotation pattern

#### From Story 5.1 (CSV Upload & Atomic Validation)

- **Reusable functions:** `parseSubmissionCsv()`, `validateSubmissionRows()`, `validateMdaCodes()` — all exported from `submissionService.ts`
- **Atomic transaction pattern:** `db.transaction()` wrapping INSERT submission + INSERT rows — reuse
- **Error format:** Per-row errors with `{ row, field, message }` — reuse for consistency

#### From Story 11.4 (MDA Historical Data Upload)

- **Source extension pattern:** 11.4 added `'historical'` to source type. Same pattern for `'payroll'`
- **Reference number:** 11.4 uses `BIR-*` format. Payroll uses `PAY-*` — separate namespace
- **Guard pattern:** `if (source !== 'historical')` before reconciliation. Add `&& source !== 'payroll'`

#### From Story 3.8 (Multi-MDA File Delineation)

- **Delineation pattern:** `fileDelineationService.ts` splits by MDA boundaries. Payroll is simpler — per-row MDA code, just `Map.groupBy()` equivalent

#### From Mega-Retro

- **AG directive:** "Collect Monthly Car Loan Deductions from the State Payroll and push them into VLPRS as a verification criterion"
- **PRD reference:** Forward Integration — `DeductionRecord[]` data-source-agnostic interface

### Git Intelligence

**Expected commit:** `feat: Story 7.0h — Payroll Extract Upload & MDA Delineation with code review fixes`

### Critical Warnings

1. **SUPER_ADMIN only — no scopeToMda:** Payroll upload routes use `authorise(SUPER_ADMIN)` WITHOUT `scopeToMda`. The AG sees all MDAs. This is intentional — the AG uploads consolidated data across all MDAs
2. **One mda_submissions record per MDA:** A single payroll file for 30 MDAs creates 30 submission records. Each has its own reference number, record count, and MDA scoping. This allows the existing per-MDA reconciliation to work naturally
3. **Do NOT trigger reconciliation or comparison:** Payroll is the "actual" source. It doesn't get compared against itself. Story 7.0i's three-way engine handles the cross-source comparison
4. **Event flags are optional in payroll:** Payroll extracts may not include employment event information. Default `eventFlag` to `'NONE'` and leave `eventDate`/`cessationReason` as null
5. **XLSX first-sheet only:** For payroll .xlsx files, only process the first sheet. Payroll extracts are typically single-sheet. If multi-sheet, log a warning and process only Sheet1
6. **source column is varchar(10):** `'payroll'` is 7 chars — fits within the varchar(10) constraint. No schema change needed for the column width
7. **Reference number collision:** PAY- and BIR- prefixes are distinct — no collision risk with existing reference numbers
8. **Row limit 500 (not 100):** Historical uploads limited to 100 rows. Payroll consolidates all MDAs, so 500 is appropriate. Largest MDA count is ~46, average ~5-10 staff per MDA per month = 230-460 rows typical

### Project Structure Notes

- The `fileParser.ts` utility is the first shared file parser in `apps/server/src/lib/` — future xlsx/csv upload features can reuse it
- Payroll routes are in a dedicated `payrollRoutes.ts` file (not submissionRoutes) — payroll is a separate vertical feature with distinct authorization (SUPER_ADMIN only)
- The delineation approach (per-row MDA code grouping) is simpler than Story 3.8's boundary detection — payroll data has explicit MDA codes, not inferred boundaries

### References

- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0h] — Full BDD acceptance criteria, implementation notes
- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Prep Story 7.0h] — "AG uploads consolidated payroll file"
- [Source: apps/server/src/services/submissionService.ts § parseSubmissionCsv, validateSubmissionRows, validateMdaCodes] — Reusable pipeline functions
- [Source: apps/server/src/services/migrationService.ts § lines 69-96] — XLSX parsing pattern
- [Source: apps/server/src/db/schema.ts § mda_submissions (lines 556-582)] — Submission table with source column
- [Source: packages/shared/src/types/submission.ts] — SubmissionRow interface (8-field format)
- [Source: apps/server/src/services/fileDelineationService.ts] — Story 3.8 delineation pattern (reference, not reused)
- [Source: apps/server/src/services/historicalSubmissionService.ts] — Historical source pattern (model for payroll guard)
- [Source: apps/server/src/routes/submissionRoutes.ts § multer config] — File upload middleware pattern
- [Source: apps/client/src/pages/dashboard/SubmissionsPage.tsx § FileUploadZone] — Upload UX pattern

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Shared package stale build: `@vlprs/shared` resolves via `dist/` — required `pnpm --filter @vlprs/shared build` after adding payroll types/schemas/vocabulary. Without rebuild, tests received `undefined` for vocabulary constants.
- TypeScript errors: `MdaListItem` type requires `isActive` field (mock objects were missing it). Also `parentMdaName` doesn't exist on `MdaListItem` (correct field is `parentMdaCode`).
- `submissionService.ts` payroll guard: The `source` parameter is typed `'csv' | 'manual' | 'historical'` — payroll never enters this function (uses its own pipeline). Removed redundant `source !== 'payroll'` checks that TypeScript correctly flagged as unreachable. The type system enforces the guard.

### Completion Notes List

- All 10 tasks implemented and verified across shared types, server service/routes, and client page/hooks
- Two-step payroll upload flow: preview (parse + delineate by MDA) → confirm (persist with PAY- reference numbers)
- Unified file parser (`fileParser.ts`) handles both CSV and XLSX, extracted from submissionService with backward-compatible re-export
- Payroll data stored with `source='payroll'` — coexists independently with MDA submissions for three-way reconciliation (Story 7.0i)
- SUPER_ADMIN-only access enforced at route level via `authorise(SUPER_ADMIN)`, no `scopeToMda`
- In-memory preview cache with 30-minute TTL for the two-step flow
- Payroll uses its own service pipeline — does NOT trigger reconciliation or comparison
- Fixed pre-existing type issues: unused imports, missing `isActive` in test mocks, stale `parentMdaName` field references

### File List

**New Files:**
- `packages/shared/src/types/payrollUpload.ts` — PayrollDelineationSummary, PayrollUploadResponse, PayrollConfirmRequest, PayrollMdaBreakdown, PayrollUploadListItem, PayrollUploadDetail
- `packages/shared/src/validators/payrollSchemas.ts` — payrollRowSchema (relaxed), payrollConfirmSchema, payrollListQuerySchema
- `apps/server/src/lib/fileParser.ts` — unified CSV/XLSX parser (parseCsvRows, parseSubmissionFile)
- `apps/server/src/lib/fileParser.test.ts` — 6 tests (CSV parsing, CSV/XLSX identity, routing, unsupported types)
- `apps/server/src/services/payrollUploadService.ts` — preview, confirm, list, detail, reference number generation
- `apps/server/src/services/payrollUploadService.test.ts` — 10 tests (preview, confirm, access control)
- `apps/server/src/routes/payrollRoutes.ts` — 4 endpoints (upload, confirm, list, detail)
- `apps/client/src/pages/dashboard/PayrollUploadPage.tsx` — upload zone, delineation table, confirmation result
- `apps/client/src/pages/dashboard/PayrollUploadPage.test.tsx` — 5 tests (render, delineation, unmatched warning, confirmation)
- `apps/client/src/hooks/usePayrollUpload.ts` — usePayrollPreview, usePayrollConfirm, usePayrollList
- `packages/shared/src/constants/mdas.ts` — MDA_LIST (63 entries), MDA_ALIASES (38 mappings), MdaCode type, mdaByCode() helper (Task 11)

**Modified Files:**
- `packages/shared/src/types/submission.ts` — added 'payroll' to SubmissionDetail.source union
- `packages/shared/src/validators/submissionSchemas.ts` — added 'payroll' to source Zod enum in submissionDetailResponseSchema
- `packages/shared/src/constants/vocabulary.ts` — added PAYROLL_* vocabulary and UI_COPY entries
- `packages/shared/src/index.ts` — exported payroll types/schemas + MDA constants (Task 11)
- `apps/server/src/app.ts` — registered payrollRoutes
- `apps/server/src/db/schema.ts` — updated source column comment to list all 4 values
- `apps/server/src/services/submissionService.ts` — extracted CSV parser to fileParser.ts, added re-export for backward compatibility, removed unreachable payroll type guard
- `apps/client/src/components/layout/navItems.ts` — added Payroll Upload sidebar item (SUPER_ADMIN only)
- `apps/client/src/router.tsx` — added /dashboard/payroll-upload lazy route
- `apps/server/src/db/seed-demo.ts` — replaced inline MDA arrays with shared import (Task 11)

### Change Log

- 2026-03-22: Story 7.0h implementation complete — payroll extract upload with MDA delineation, two-step flow, unified file parser, SUPER_ADMIN-only access, full test coverage
- 2026-03-22: [Ad-Hoc] Promoted 63-MDA list and 38 legacy-code aliases from seed-demo.ts to `@vlprs/shared` constant (PO-requested refactor, Task 11)
- 2026-03-22: [Code Review] Senior Developer review — 8 findings (2H/5M/1L), all fixed: N+1 query, fragile batch detection, dead `payrollRowSchema`, conditional test assertions, CSV error vocabulary, File List reconciliation. Status → done
