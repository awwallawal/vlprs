# Story 15.1: Committee List Upload Pipeline

Status: ready-for-dev

## Story

As a **Department Admin**,
I want to upload approved beneficiary lists and retiree/deceased lists from the Committee,
So that the system has a record of who was approved and who has retired/deceased, enabling onboarding tracking and retirement verification.

**Origin:** Epic 15, FR93. Full specification: `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md`. Team review: `_bmad-output/planning-artifacts/epic-15-team-review.md`.

**Dependencies:**
- Track 1 (Approval/Addendum — 3 steps): **No dependencies** — can start immediately
- Track 2 Steps 1-2 (Retiree parse + MDA Alias Review): **No dependencies**
- Track 2 Steps 3-5 (Three-Vector Validation + Match + Process): **Hard dependency on Story 8.0a** (scheme formula computation model)

## Acceptance Criteria

**Dashboard & Batch Management:**

1. **Given** a Department Admin navigates to "Committee Lists" in the admin area, **When** the page loads, **Then** they see a dashboard showing all uploaded batches (label, year, list type, record count, upload date), separated into Approval Lists and Retiree/Deceased Lists sections, with "Upload New List" buttons.

2. **Given** the Department Admin clicks "Upload New List", **When** the batch dialog opens, **Then** they can: "Create New Batch" (label, optional year, notes) or "Add to Existing Batch" (dropdown — addendum appends to existing batch).

**Track 1 — Approval/Addendum (3 Steps):**

3. **Given** an approval Excel file is uploaded (Step 1 — Parse), **When** the system parses it, **Then** it auto-detects the 5-column schema (S/N, Name, MDA, GL, Amount), handles files with or without header rows, displays a preview of first 10 rows, flags data quality issues (null GL, anomalous amounts) as amber indicators (non-blocking).

4. **Given** parsed MDA names (Step 2 — MDA Alias Review), **When** the system resolves them, **Then** each unique MDA string is matched against canonical MDAs using the enhanced `resolveMdaByName()` (Layers 1-3 exact + Layer 2.5 fuzzy candidates). Results shown in three buckets: Auto-matched (green check), Needs Review (amber — admin picks from suggested candidates), Unknown (red — admin selects from full MDA dropdown). Confirmed mappings are saved to `mda_aliases` table permanently. All unknown MDAs must be resolved before proceeding.

5. **Given** the Department Admin confirms all data (Step 3 — Confirm), **Then** records are created in `approved_beneficiaries` table with: name, mda_raw, mda_canonical_id, grade_level, approved_amount, batch_id, list_type (APPROVAL or ADDENDUM), upload_date, uploaded_by, match_status (UNMATCHED), onboarding_status (NOT_YET_OPERATIONAL). Confirmation screen: "X beneficiaries registered for {batch label}" with per-MDA counts.

**Track 2 — Retiree/Deceased (5 Steps):**

6. **Given** a retiree/deceased Excel file is uploaded (Step 1 — Parse), **When** the system parses it, **Then** it detects the 17-column schema by column count and header matching, identifies multi-sheet structure, auto-skips "PAYMENT" sheets, detects "LATE" prefix names as DECEASED.

7. **Given** parsed MDA names (Step 2 — MDA Alias Review), **Then** identical MDA Alias Review component as Track 1 — same saved mappings, same alias table.

8. **Given** 17-column financial data (Step 3 — Three-Vector Validation), **Then** for each record: compute Scheme Expected (P×13.33%÷60), Reverse Engineered (from file data), Committee Declared (raw values). Summary card: Clean / Variance / Requires Verification. Department Admin reviews and selects resolution per record. *(Depends on 8.0a)*

9. **Given** validated records (Step 4 — Match & Classify), **Then** system runs fuzzy matching (Story 15.2 engine). Shows: matched + active loan, matched + already retired/deceased, no match + full data (offer loan creation), no match + no data. *(Depends on 15.2 for matching engine — use stub for this story)*

10. **Given** the Department Admin confirms (Step 5 — Process), **Then** actions processed in individual transactions with provenance tagging: `source: 'RETIREE_LIST_BATCH_IMPORT'`, `uploadReference: <upload_id>`, `batchDate: <import_date>`.

**Global MDA Enhancement:**

11. **Given** any pipeline that calls `resolveMdaByName()` (migration upload, committee list, future payroll), **When** aliases have been confirmed through MDA Alias Review, **Then** those aliases resolve automatically in all future calls — the system learns from every manual mapping.

12. **Given** a Department Admin confirms an ambiguous MDA section during migration upload (`confirmBoundaries()`), **When** the raw `mdaText` was manually mapped to a canonical MDA, **Then** the mapping is saved as a new alias so future uploads with the same string auto-resolve.

## Tasks / Subtasks

### Task Group A: Global MDA Alias Enhancement (AC: 4, 11, 12)

- [ ] Task A1: Enhance `resolveMdaByName()` with fuzzy candidate layer
  - [ ] A1.1: In `apps/server/src/services/mdaService.ts`, add Layer 2.5 between Layer 2 (normalized name) and Layer 3 (alias lookup). New internal function `findFuzzyCandidates(normalizedInput)`:
    - Normalize input: strip punctuation (`'`, `.`, `` ` ``), collapse whitespace, uppercase
    - For each MDA in system: normalize code, name, abbreviation
    - Check: is normalized input a prefix of code/name/abbreviation, or vice versa?
    - Calculate Levenshtein distance for inputs < 15 chars and MDA codes/abbreviations < 15 chars (skip full names — too expensive)
    - Score: prefix match = 92, Levenshtein ≤ 1 = 88, Levenshtein ≤ 2 = 80
    - Return `Array<{ mda: MdaListItem, score: number, reason: 'prefix' | 'levenshtein' | 'normalized' }>`
  - [ ] A1.2: Layer 2.5 does NOT change `resolveMdaByName()` return value — it still returns `MdaListItem | null`. Instead, create a new function:
    ```typescript
    export async function resolveMdaWithCandidates(input: string): Promise<{
      resolved: MdaListItem | null;
      candidates: Array<{ mda: MdaListItem; score: number; reason: string }>;
    }>
    ```
    Calls existing `resolveMdaByName()` first. If resolved → return with empty candidates. If null → call `findFuzzyCandidates()` → return with candidates.
  - [ ] A1.3: Unit test in `apps/server/src/services/mdaService.test.ts` (extend existing): `"AGRIC"` → resolved null, candidates include Agriculture (prefix, score 92)
  - [ ] A1.4: Unit test in same file: `"HIGHCOURT"` → resolved null, candidates include High Court (normalized, space-collapsed)
  - [ ] A1.5: Unit test in same file: `"HEALTH"` → resolved directly (Layer 1), candidates empty
  - [ ] A1.6: Unit test in same file: `"HLT"` → resolved via alias (Layer 3), candidates empty

- [ ] Task A2: Create alias CRUD endpoint
  - [ ] A2.1: Add to `apps/server/src/routes/mdaRoutes.ts`:
    - `POST /api/mdas/aliases` — create alias (SUPER_ADMIN, DEPT_ADMIN). Body: `{ alias: string, mdaId: string }`. Validates alias doesn't already exist (case-insensitive). Returns created alias record
    - `GET /api/mdas/aliases` — list all aliases with MDA names joined
    - `DELETE /api/mdas/aliases/:id` — remove alias (SUPER_ADMIN only)
  - [ ] A2.2: Add Zod validation schemas for request bodies
  - [ ] A2.3: On alias creation: normalize and validate — strip leading/trailing whitespace, reject empty strings, reject if alias equals an existing MDA code (would create ambiguity). NOTE: the `mda_aliases` table already has a case-insensitive unique index (`idx_mda_aliases_alias_lower` on `LOWER(alias)`, schema line 66) — the DB enforces uniqueness, so Task A2.4 handles the constraint violation with a friendly error message
  - [ ] A2.4: Handle unique constraint violation gracefully: if `LOWER(alias)` already exists, return 409 with "This alias is already mapped to {mdaName}"
  - [ ] A2.5: Integration test in `apps/server/src/routes/mda.integration.test.ts` (**new file**): create alias → resolves in subsequent `resolveMdaByName()` calls
  - [ ] A2.6: Integration test in same file: duplicate alias (case-insensitive) → 409

- [ ] Task A3: Create batch resolution endpoint
  - [ ] A3.1: Add `POST /api/mdas/resolve` to `apps/server/src/routes/mdaRoutes.ts`:
    ```typescript
    Body: { strings: string[] }
    Response: {
      results: Array<{
        input: string;
        status: 'auto_matched' | 'needs_review' | 'unknown';
        resolved: MdaListItem | null;
        candidates: Array<{ mda: MdaListItem; score: number; reason: string }>;
      }>
    }
    ```
  - [ ] A3.2: Deduplicate input strings (case-insensitive) before processing
  - [ ] A3.3: Call `resolveMdaWithCandidates()` for each unique string
  - [ ] A3.4: Status assignment: `resolved !== null` → `auto_matched`. `candidates.length > 0` → `needs_review`. Both null/empty → `unknown`
  - [ ] A3.5: Integration test in same file: mix of auto-matched, needs_review, and unknown strings

- [ ] Task A4: Retroactive migration pipeline alias saving (AC: 12)
  - [ ] A4.1: In `apps/server/src/services/fileDelineationService.ts`, modify `confirmBoundaries()` (lines 395-450):
    - After confirming sections, read `confidence` from the upload's stored `delineationResult` JSONB (loaded at line 419) — NOT from the `confirmedSections` parameter which only carries MDA IDs
    - For each section where the stored confidence is `'ambiguous'`:
    - Extract the raw `mdaText` for that section from the `delineationResult`
    - If `mdaText` is not null and `resolveMdaByName(mdaText)` returns null (confirming it was manually mapped):
    - Create alias: insert `{ alias: mdaText, mdaId: confirmedMdaId }` into `mda_aliases`
    - Wrap in try/catch — if alias already exists (concurrent creation), silently succeed
  - [ ] A4.2: Log alias creation: `logger.info({ alias: mdaText, mdaName }, 'MDA alias learned from migration confirmation')`
  - [ ] A4.3: Integration test in same file: confirm ambiguous section → alias created → future `resolveMdaByName()` resolves automatically

### Task Group B: Reusable Frontend Component (AC: 4, 7)

- [ ] Task B1: Create `MdaAliasReviewPanel` component
  - [ ] B1.1: Create `apps/client/src/components/shared/MdaAliasReviewPanel.tsx`:
    ```typescript
    interface MdaAliasReviewPanelProps {
      rawMdaStrings: string[];
      onConfirm: (mappings: Map<string, string>) => void;  // raw string → mdaId
      onCancel: () => void;
    }
    ```
  - [ ] B1.2: On mount: call `POST /api/mdas/resolve` with `rawMdaStrings`
  - [ ] B1.3: Three-section display:
    - **Auto-Matched** (green check): resolved automatically, shown as read-only confirmation
    - **Needs Review** (amber): candidate MDA pre-selected in dropdown, admin confirms or changes. Show match reason + score
    - **Unknown** (red circle): empty dropdown, admin must select from full MDA list
  - [ ] B1.4: "Confirm All Mappings" button: disabled until all Needs Review + Unknown items have selections
  - [ ] B1.5: On confirm: call `POST /api/mdas/aliases` for each newly confirmed mapping (Needs Review + Unknown items). Auto-Matched items already have aliases or exact matches — no alias needed
  - [ ] B1.6: Info notice at bottom: "Confirmed mappings are saved permanently. Future uploads with the same MDA names will resolve automatically."
  - [ ] B1.7: Loading state while resolving, error state if resolution fails

- [ ] Task B2: Create TanStack Query hooks
  - [ ] B2.1: Add `useMdaResolve(strings)` mutation in `apps/client/src/hooks/useMda.ts`:
    ```typescript
    queryKey: ['mdas', 'resolve']
    mutationFn: (strings) => apiClient('/mdas/resolve', { method: 'POST', body: JSON.stringify({ strings }) })
    ```
  - [ ] B2.2: Add `useCreateMdaAlias()` mutation:
    ```typescript
    mutationFn: ({ alias, mdaId }) => apiClient('/mdas/aliases', { method: 'POST', body: JSON.stringify({ alias, mdaId }) })
    onSuccess: () => queryClient.invalidateQueries(['mdas'])
    ```

### Task Group C: Database Schema (AC: 1, 2, 5, 6, 10)

- [ ] Task C1: Create `approval_batches` table
  - [ ] C1.1: Add to `apps/server/src/db/schema.ts`:
    ```typescript
    export const approvalBatches = pgTable('approval_batches', {
      id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
      label: varchar('label', { length: 255 }).notNull(),
      year: integer('year'),  // nullable for ad-hoc batches
      listType: varchar('list_type', { length: 50 }).notNull(),  // 'APPROVAL' | 'RETIREE'
      notes: text('notes'),
      uploadedBy: uuid('uploaded_by').notNull().references(() => users.id),
      uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => [
      index('idx_approval_batches_year').on(table.year),
      index('idx_approval_batches_list_type').on(table.listType),
    ]);
    ```

- [ ] Task C2: Create `approved_beneficiaries` table
  - [ ] C2.1: Add to `apps/server/src/db/schema.ts`:
    ```typescript
    export const approvedBeneficiaries = pgTable('approved_beneficiaries', {
      id: uuid('id').primaryKey().$defaultFn(generateUuidv7),
      batchId: uuid('batch_id').notNull().references(() => approvalBatches.id),
      name: varchar('name', { length: 255 }).notNull(),
      mdaRaw: varchar('mda_raw', { length: 255 }),             // original string from file
      mdaCanonicalId: uuid('mda_canonical_id').references(() => mdas.id),
      gradeLevel: varchar('grade_level', { length: 10 }),
      approvedAmount: numeric('approved_amount', { precision: 15, scale: 2 }),
      listType: varchar('list_type', { length: 50 }).notNull(), // APPROVAL | ADDENDUM | RETIREE | DECEASED

      // Financial data (17-column retiree records only — null for 5-column approval records)
      principal: numeric('principal', { precision: 15, scale: 2 }),
      interest: numeric('interest', { precision: 15, scale: 2 }),
      totalLoan: numeric('total_loan', { precision: 15, scale: 2 }),
      monthlyDeduction: numeric('monthly_deduction', { precision: 15, scale: 2 }),
      installmentsPaid: integer('installments_paid'),
      totalPrincipalPaid: numeric('total_principal_paid', { precision: 15, scale: 2 }),
      totalInterestPaid: numeric('total_interest_paid', { precision: 15, scale: 2 }),
      totalLoanPaid: numeric('total_loan_paid', { precision: 15, scale: 2 }),
      outstandingPrincipal: numeric('outstanding_principal', { precision: 15, scale: 2 }),
      outstandingInterest: numeric('outstanding_interest', { precision: 15, scale: 2 }),
      outstandingBalance: numeric('outstanding_balance', { precision: 15, scale: 2 }),
      installmentsOutstanding: integer('installments_outstanding'),
      collectionDate: text('collection_date'),       // raw text — dates in files are inconsistent
      commencementDate: text('commencement_date'),   // raw text

      // Matching & onboarding status (populated by Stories 15.2-15.4)
      matchStatus: varchar('match_status', { length: 50 }).notNull().default('UNMATCHED'),
      matchedLoanId: uuid('matched_loan_id').references(() => loans.id),
      matchConfidence: integer('match_confidence'),   // 0-100
      firstDeductionMonth: varchar('first_deduction_month', { length: 7 }),  // YYYY-MM
      onboardingStatus: varchar('onboarding_status', { length: 50 }).notNull().default('NOT_YET_OPERATIONAL'),

      // Provenance
      uploadReference: uuid('upload_reference'),      // FK to track source upload
      sourceRow: integer('source_row'),
      sourceSheet: text('source_sheet'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    }, (table) => [
      index('idx_approved_beneficiaries_batch_id').on(table.batchId),
      index('idx_approved_beneficiaries_mda_canonical_id').on(table.mdaCanonicalId),
      index('idx_approved_beneficiaries_match_status').on(table.matchStatus),
      index('idx_approved_beneficiaries_onboarding_status').on(table.onboardingStatus),
      index('idx_approved_beneficiaries_name').on(table.name),
    ]);
    ```

- [ ] Task C3: Generate migration and update resetDb
  - [ ] C3.1: Run `drizzle-kit generate` to create a NEW migration
  - [ ] C3.2: Verify migration applies cleanly
  - [ ] C3.3: Add `approved_beneficiaries` and `approval_batches` to `resetDb.ts` explicit table list

### Task Group D: Committee List Service — Track 1 (AC: 3, 5)

- [ ] Task D1: Create committee list parsing service
  - [ ] D1.1: Create `apps/server/src/services/committeeListService.ts` with:
    ```typescript
    export async function parseCommitteeFile(
      buffer: Buffer, filename: string
    ): Promise<CommitteeFilePreview>
    ```
  - [ ] D1.2: Dual schema detection: count columns in first data row after headers
    - 5 columns (±1 for S/N) → Approval schema
    - 17 columns (±1 for S/N) → Retiree schema
    - Other → error: "Unrecognized file format"
  - [ ] D1.3: Header detection: try row 1 as header. If row 1 is a title row (e.g., "INTERVENTION LIST 2024"), try row 2 or row 3. Pattern: first row where ≥3 cells match known header names
  - [ ] D1.4: 5-column parsing: extract S/N (skip), Name, MDA, GL, Amount. Handle GL as string (may be "07" or "7")
  - [ ] D1.5: Multi-sheet handling: for retiree files, process all sheets except those matching "PAYMENT" (skip pattern)
  - [ ] D1.6: "LATE" prefix detection: if name starts with "LATE " (case-insensitive), flag as DECEASED and strip prefix for clean name
  - [ ] D1.7: Return `CommitteeFilePreview`: `{ schemaType: 'approval' | 'retiree', sheets: SheetPreview[], records: ParsedRecord[], dataQualityFlags: DataQualityFlag[] }`
  - [ ] D1.8: Data quality flags (non-blocking, amber): null GL, zero or negative amount, duplicate names within file
  - [ ] D1.9: Use SheetJS (`xlsx`) for parsing — same library as migration pipeline
  - [ ] D1.10: Unit test in `apps/server/src/services/committeeListService.test.ts` (**new file**): parse 5-column approval file → correct schema detection + records
  - [ ] D1.11: Unit test in same file: parse 17-column retiree file → correct schema detection + financial fields populated
  - [ ] D1.12: Unit test in same file: "LATE ADEWALE BOSEDE" → DECEASED flag + name "ADEWALE BOSEDE"
  - [ ] D1.13: Unit test in same file: file with title row (no header row) → parsed correctly

- [ ] Task D2: Create upload and confirmation endpoints
  - [ ] D2.1: Create `apps/server/src/routes/committeeListRoutes.ts`:
    - `POST /api/committee-lists/upload` — multer + parse → returns `CommitteeFilePreview`
    - `POST /api/committee-lists/confirm` — confirms parsed data + MDA mappings → creates records
    - `GET /api/committee-lists/batches` — list batches with summary counts
    - `POST /api/committee-lists/batches` — create new batch
    - `GET /api/committee-lists/batches/:batchId` — batch detail with beneficiary list
  - [ ] D2.2: Confirmation endpoint receives: `{ uploadPreview: CommitteeFilePreview, mdaMappings: Record<string, string>, batchId: string }`
  - [ ] D2.3: In confirmation handler: create `approved_beneficiaries` records using resolved MDA IDs, tag with provenance (sourceRow, sourceSheet, uploadReference)
  - [ ] D2.4: Integration test in `apps/server/src/routes/committeeList.integration.test.ts` (**new file**): upload → parse → confirm → records in DB with correct MDA IDs

### Task Group E: Committee Lists Dashboard Page (AC: 1, 2)

- [ ] Task E1: Create CommitteeListsPage
  - [ ] E1.1: Create `apps/client/src/pages/dashboard/CommitteeListsPage.tsx`:
    - Route: `/dashboard/committee-lists`
    - Two sections: "Approval Lists" and "Retiree/Deceased Lists"
    - Each section shows batches as cards: label, year, list type, record count, upload date
    - "Upload New List" button per section
  - [ ] E1.2: Add route in `apps/client/src/router.tsx` (lazy-loaded)
  - [ ] E1.3: Add "Committee Lists" to sidebar navigation in `navItems.ts` (SUPER_ADMIN, DEPT_ADMIN) — icon: `ClipboardList` from lucide-react

- [ ] Task E2: Create Upload Wizard
  - [ ] E2.1: Create `apps/client/src/pages/dashboard/components/CommitteeUploadWizard.tsx`:
    - Step indicator: "1. Upload & Parse → 2. MDA Review → 3. Confirm"
    - Step 1: File upload (drag-and-drop, same pattern as migration upload) + parse preview (first 10 rows table)
    - Step 2: `<MdaAliasReviewPanel>` (Task Group B) with unique MDA strings from parsed data
    - Step 3: Confirmation summary — per-MDA record counts, data quality flags, "Register Beneficiaries" button
  - [ ] E2.2: Batch selection dialog: "Create New Batch" or "Add to Existing Batch" — shown before Step 1
  - [ ] E2.3: Success screen after confirmation: "X beneficiaries registered for {batch label}" with per-MDA breakdown table

- [ ] Task E3: Create TanStack Query hooks
  - [ ] E3.1: Add hooks in `apps/client/src/hooks/useCommitteeList.ts`:
    ```typescript
    useCommitteeListBatches()         // GET /api/committee-lists/batches
    useUploadCommitteeFile()          // POST /api/committee-lists/upload (mutation)
    useConfirmCommitteeUpload()       // POST /api/committee-lists/confirm (mutation)
    useCreateBatch()                  // POST /api/committee-lists/batches (mutation)
    useBatchDetail(batchId)           // GET /api/committee-lists/batches/:batchId
    ```

### Task Group F: Track 2 Retiree-Specific Steps (AC: 6, 8, 9, 10) — *Depends on 8.0a*

- [ ] Task F1: 17-column parser extension
  - [ ] F1.1: Extend `parseCommitteeFile()` to extract all 17 columns for retiree schema
  - [ ] F1.2: Map columns: Principal, Interest, Total Loan, Monthly Deduction, Installments Paid, Total Principal Paid, Total Interest Paid, Total Loan Paid, Outstanding Principal/Interest/Balance, Installments Outstanding, Collection Date, Commencement Date
  - [ ] F1.3: Financial values as strings (Decimal.js pattern, never floats)
  - [ ] F1.4: Unit test in `apps/server/src/services/committeeListService.test.ts`: 17-column retiree file → all financial fields populated correctly

- [ ] Task F2: Three-Vector Validation step (Step 3)
  - [ ] F2.1: Reuse `computeSchemeExpected()` from Story 8.0a for Scheme Expected vector
  - [ ] F2.2: Compute Reverse Engineered from file's own data (same logic as migration validation)
  - [ ] F2.3: Committee Declared = raw values from file
  - [ ] F2.4: Categorize: Clean (scheme matches declared within ₦50), Variance, Requires Verification (impossible values)
  - [ ] F2.5: Frontend: validation summary card (reuse migration pattern) + per-record resolution selector
  - [ ] F2.6: Add Step 3 to wizard for Track 2 uploads only

- [ ] Task F3: Match & Classify step stub (Step 4)
  - [ ] F3.1: For this story, implement a **stub** that displays match status categories without the actual fuzzy matching engine (Story 15.2 builds the engine):
    - Show: "Matching engine will classify records in Story 15.2"
    - Pre-classify what's possible now: exact name + MDA match against `loans` table (simple SQL WHERE)
    - Any exact match → show as "Matched". Others → "Pending (matching engine not yet active)"
  - [ ] F3.2: The stub lets the rest of the wizard work end-to-end without blocking on Story 15.2

- [ ] Task F4: Process step (Step 5)
  - [ ] F4.1: For matched records: show proposed actions (retirement event filing, deceased event filing, loan creation)
  - [ ] F4.2: Process in individual transactions per record (not one giant batch — Team Decision 3)
  - [ ] F4.3: Provenance tagging: `source: 'RETIREE_LIST_BATCH_IMPORT'`, `uploadReference`, `batchDate`
  - [ ] F4.4: Integration test in `apps/server/src/routes/committeeList.integration.test.ts`: retiree record matched to active loan → retirement event filed with provenance

### Task Group G: Regression (AC: all)

- [ ] Task G1: Full regression
  - [ ] G1.1: Run `pnpm typecheck` — zero errors
  - [ ] G1.2: Run `pnpm test` — zero regressions (especially migration tests — verify `resolveMdaByName()` changes don't break existing flows)
  - [ ] G1.3: Run `pnpm lint` — zero new warnings
  - [ ] G1.4: Manual test: upload 2024 approval file → MDA Alias Review maps "AGRIC" → Agriculture → confirm → records created → future upload auto-resolves "AGRIC"
  - [ ] G1.5: Manual test: migration upload with "AGRIC" in MDA column → verify alias from 15.1 resolves automatically in delineation

## Dev Notes

### Design Decision Record: Global MDA Alias Enhancement

#### Analysis (How We Got Here)

During story creation for 15.1, we analyzed the existing MDA matching engine in the migration pipeline to understand whether to build a parallel system or extend the existing one. Here's what we found:

**Existing engine (`resolveMdaByName()` in `mdaService.ts`):**

| Layer | Method | Example | Works? |
|---|---|---|---|
| 1 | Exact code match (`mdas.code`) | `"HEALTH"` → ✅ | ✅ |
| 2 | Normalized name (strip "Ministry of"/"Oyo State") | `"Ministry of Health"` → ✅ | ✅ |
| 3 | Alias table lookup (`mda_aliases.alias`) | `"HLT"` → ✅ (seeded alias) | ✅ |
| 4 | Return null | `"AGRIC"` → ❌ | ❌ |

**The gap:** Layer 3 works perfectly but the alias table is **write-once at seed time** — 39 legacy codes + CDU variants, all hardcoded in `packages/shared/src/constants/mdas.ts`. No UI or endpoint exists to add aliases at runtime.

**The waste:** Every time an admin manually confirms an ambiguous MDA section in migration upload (`confirmBoundaries()`), the mapping is applied to the records but **not saved as an alias**. Next upload with the same string → same manual work.

**Real data from committee files** (`docs/Car_Loan/beneficiaries_retirees/`):
- 71-74 unique MDA strings across files mapping to ~47 canonical MDAs
- Common variants: `AGRIC` (truncation), `HIGHCOURT` (space-collapse), `GOV'S OFFICE` (abbreviation), `ESTAB` (truncation)

#### Decision: Extend, Don't Fork

Rather than building a parallel MDA matching system for Epic 15, we extend the existing engine with three additions:

1. **Layer 2.5 (fuzzy candidates)** in `resolveMdaByName()` — prefix matching + normalized comparison. Returns **candidates** (not auto-matches) for the review UI
2. **Alias CRUD endpoint** — makes the alias table writable at runtime. Once `AGRIC → Agriculture` is confirmed, every future call to `resolveMdaByName("AGRIC")` resolves via Layer 3 automatically
3. **Retroactive migration improvement** — `confirmBoundaries()` saves aliases for ambiguous sections. The migration pipeline now teaches the system

**Why this is better than a parallel system:**
- One matching engine, one alias table, one source of truth
- Every pipeline (migration, committee, future payroll) benefits from aliases created in any other pipeline
- The alias table becomes collective memory — "Needs Review" bucket shrinks toward zero over time
- No duplicate maintenance of matching logic

#### Architecture

```
POST /api/mdas/resolve (batch)
  ↓
resolveMdaWithCandidates(input) per string
  ├─ Layer 1: Exact code → resolved
  ├─ Layer 2: Normalized name → resolved
  ├─ Layer 2.5 NEW: Fuzzy candidates → candidates[] (prefix, levenshtein, normalized)
  ├─ Layer 3: Alias lookup → resolved
  └─ Layer 4: null → unknown
  ↓
MdaAliasReviewPanel (frontend)
  ├─ Auto-Matched (Layers 1-3 resolved)
  ├─ Needs Review (Layer 2.5 candidates)
  └─ Unknown (no candidates)
  ↓ On confirm:
POST /api/mdas/aliases (for each new mapping)
  ↓
Layer 3 handles it forever → all pipelines benefit
```

### Data File Reference

**Location:** `docs/Car_Loan/beneficiaries_retirees/`

| File | Schema | Rows | List Type |
|---|---|---|---|
| `VEHICLE LOAN COLLATION 2024(2).xlsx` | 5-column | 779 | APPROVAL |
| `2024 INTERVENTION LIST(1).xlsx` | 5-column | 352 | ADDENDUM |
| `VEHICLE LOAN COLLATION 2025 (Recovered)(2).xlsx` | 5-column | 1,409 | APPROVAL |
| `RETIRING , DECEASED RECORD AND 2025 PAYMENT LIST(1).xlsx` | 17-column (Sheets 1-2), 10-column (Sheet 3 — SKIP) | 123 + 81 | RETIREE/DECEASED |

### Dual Schema Detection

```typescript
const columnCount = firstDataRow.length;
if (columnCount >= 15) return 'retiree';    // 17 columns (±S/N column variations)
if (columnCount <= 7) return 'approval';     // 5 columns (±S/N)
throw new AppError(422, 'UNKNOWN_SCHEMA', 'File does not match expected approval (5-col) or retiree (17-col) format');
```

### "LATE" Prefix Detection for Deceased

```typescript
const isDeceased = name.toUpperCase().startsWith('LATE ');
const cleanName = isDeceased ? name.replace(/^LATE\s+/i, '') : name;
const listType = isDeceased ? 'DECEASED' : 'RETIREE';
```

From the real data: 6 deceased in 2024 sheet, 8 in 2025 sheet. Names like "LATE ADISA MOSUNMOLA" → name: "ADISA MOSUNMOLA", listType: DECEASED.

### Batch Model (Team Decision 4)

```
approval_batches:
  id:        UUID PK
  label:     "2024 Main Approval" | "2024 Addendum" | "Emergency Q3 2025"
  year:      2024 | 2025 | null (ad-hoc)
  listType:  'APPROVAL' | 'RETIREE'
  notes:     Free text
```

Supports annual rhythm (year=2024) AND ad-hoc batches (year=null, label distinguishes). Addendums reference the same batch via "Add to Existing Batch" flow.

### Track 2 Step 4: Matching Stub vs Full Engine

Story 15.2 builds the fuzzy name matching engine. Story 15.1 implements a stub for Step 4 that does **exact name + MDA matching only**. This lets the wizard work end-to-end without blocking on 15.2. When 15.2 lands, the stub is replaced with the real engine.

### Provenance Tagging (Team Decision 3)

Every imported record carries:
```typescript
source: 'RETIREE_LIST_BATCH_IMPORT'
uploadReference: uploadId
batchDate: importDate
```

This distinguishes batch imports from manual filings in the audit trail. Each retirement is processed in its own transaction (not one giant batch) to prevent deadlocks and allow partial success.

### What This Story Does NOT Build

- **Fuzzy name matching engine** — Story 15.2
- **Monthly onboarding scan** — Story 15.3
- **Onboarding dashboard / curves** — Story 15.4
- **Retirement verification full workflow** — Story 15.5
- **Payment/disbursement list** — parked as potential Story 15.7
- **MDA alias management page** — the alias CRUD endpoint exists, but a dedicated management UI is future scope. Aliases are created through the review flow, not a standalone admin page

### File Locations

| What | Path | Key Lines |
|---|---|---|
| MDA service (resolution) | `apps/server/src/services/mdaService.ts` | 88-135 (resolveMdaByName 4-layer) |
| MDA aliases table | `apps/server/src/db/schema.ts` | 56-68 |
| MDA seed data | `packages/shared/src/constants/mdas.ts` | MDA_LIST, MDA_ALIASES |
| Seed function | `apps/server/src/db/seedReferenceMdas.ts` | 14-75 |
| Delineation (confirmBoundaries) | `apps/server/src/services/fileDelineationService.ts` | 395-450 |
| MDA routes | `apps/server/src/routes/mdaRoutes.ts` | Add alias CRUD + resolve |
| SheetJS (xlsx) | `apps/server/src/services/migrationService.ts` | line 1 (import) |
| Committee list files | `docs/Car_Loan/beneficiaries_retirees/` | 4 files |
| Epic 15 full spec | `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md` | Complete |
| Team review | `_bmad-output/planning-artifacts/epic-15-team-review.md` | Decisions + corrections |

### Non-Punitive Vocabulary

- "Needs Review" not "Failed to match"
- "Unknown MDA" not "Invalid MDA"
- Data quality flags are amber (non-blocking), not red
- "Register beneficiaries" not "Import records"

### Testing Standards

- Co-located tests
- Vitest framework
- Financial values as string comparisons
- Test both schema types (5-column + 17-column)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 15.1]
- [Source: _bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md — Full spec]
- [Source: _bmad-output/planning-artifacts/epic-15-team-review.md — Team decisions]
- [Source: apps/server/src/services/mdaService.ts:88-135 — resolveMdaByName 4-layer]
- [Source: apps/server/src/db/schema.ts:56-68 — mda_aliases table]
- [Source: apps/server/src/services/fileDelineationService.ts:395-450 — confirmBoundaries (alias save hook)]
- [Source: packages/shared/src/constants/mdas.ts — MDA_LIST (63 MDAs), MDA_ALIASES (39 oldCode→newCode mappings + CDU variants seeded separately)]
- [Source: apps/server/src/db/seedReferenceMdas.ts:14-75 — seedReferenceMdas (alias seeding)]
- [Source: docs/Car_Loan/beneficiaries_retirees/ — Committee list source files]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
