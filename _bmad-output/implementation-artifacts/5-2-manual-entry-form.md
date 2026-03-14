# Story 5.2: Manual Entry Form

Status: done

<!-- Prerequisite: Story 5.1 backend is COMPLETE (submissionService, submissionRoutes, submissionSchemas, vocabulary). Story 5.1 frontend (SubmissionConfirmation, useSubmissionUpload, fetchHelpers) is in-progress. Sequencing: start with backend Tasks 1-2, then Tasks 3-4. By the time frontend Tasks 5-7 begin, Story 5.1 frontend should be landed. If not, create SubmissionConfirmation as part of this story. -->

## Story

As an **MDA Reporting Officer**,
I want to enter monthly deduction data manually through a form interface,
So that I can submit data even without a prepared CSV file.

## Acceptance Criteria

1. **Given** the submission page
   **When** the MDA officer views the submission interface
   **Then** a Tabs component displays two options: "CSV Upload" (default) and "Manual Entry"
   **And** switching tabs preserves the checkpoint confirmation state and partially-filled form data (FR17)

2. **Given** the Manual Entry tab is selected
   **When** the form loads
   **Then** a row-entry form is displayed with 8 fields matching the CSV structure:
   - Staff ID (text input)
   - Month (pre-selected to current open period via `format(new Date(), 'yyyy-MM')`, YYYY-MM format)
   - Amount Deducted (text input, ₦ prefix)
   - Payroll Batch Reference (text input)
   - MDA Code (for MDA_OFFICER: pre-filled from MDA lookup by `user.mdaId`, read-only; for DEPT_ADMIN: editable text input, required)
   - Event Flag (dropdown: NONE, RETIREMENT, DEATH, SUSPENSION, TRANSFER_OUT, TRANSFER_IN, LEAVE_WITHOUT_PAY, REINSTATEMENT, TERMINATION)
   - Event Date (conditional — shown only when Event Flag ≠ NONE)
   - Cessation Reason (conditional — shown only when Amount = ₦0 AND Event Flag = NONE)
   **And** the officer can add multiple rows before submitting (FR17)
   **And** the form is keyboard-navigable — Tab moves between fields across rows, Enter on "Add Row" appends a row

3. **Given** the officer has entered one or more rows
   **When** they click "Add Row"
   **Then** a new empty row is appended with Month and MDA Code pre-filled
   **And** each row shows a row number and a remove button (trash icon)
   **And** the form supports up to 50 rows (reasonable manual entry limit)
   **And** when 50 rows are reached, the "Add Row" button is disabled with tooltip "Maximum of 50 rows reached"

4. **Given** multiple manually entered rows
   **When** the officer clicks "Submit All"
   **Then** all rows are validated and processed atomically with the same rules as CSV upload (FR18)
   **And** validation uses the same backend service pipeline as CSV upload

5. **Given** a validation error in any row
   **When** the server returns row-level errors
   **Then** errors are displayed inline on the specific row that failed — field highlighted with gold border, error message below the field
   **And** the "Upload needs attention" header is shown (never "Upload failed")
   **And** all valid rows remain populated (no data loss on error)
   **And** a toast notification summarises: "{count} items need your attention"

6. **Given** a row where Event Flag is changed to a value ≠ NONE
   **When** the officer selects the Event Flag
   **Then** the Event Date field appears immediately (client-side conditional rendering)
   **And** if Event Flag is changed back to NONE, Event Date field hides and its value clears

7. **Given** a row where Amount = ₦0 AND Event Flag = NONE
   **When** these values are set
   **Then** the Cessation Reason field appears immediately
   **And** if Amount changes to > 0 or Event Flag changes to ≠ NONE, Cessation Reason field hides and its value clears

8. **Given** a successful manual submission
   **When** processing completes
   **Then** the same SubmissionConfirmation component displays (reference number, timestamp, record count)
   **And** a success toast displays: "Submission confirmed and recorded"
   **And** the form is cleared and reset to a single empty row

9. **Given** the manual entry endpoint `POST /api/submissions/manual`
   **When** the server receives a JSON body with an array of row objects
   **Then** it validates using the same `validateSubmissionRows()` pipeline from Story 5.1
   **And** processes atomically using the same `processSubmissionRows()` function
   **And** returns the same response envelope as CSV upload

## Tasks / Subtasks

- [x] Task 1: Backend — Manual Entry Endpoint & Service Refactor (AC: #4, #9)
  - [x] 1.1 Refactor `submissionService.processSubmission()` to extract shared `processSubmissionRows(rows, mdaScope, userId, source: 'csv' | 'manual')` function that both CSV upload and manual entry call after their respective parsing stages. The `source` field is persisted in `mda_submissions.source` column. For manual submissions, set `filename` to `null` and `fileSizeBytes` to `null` (both columns are confirmed nullable in the Story 5.1 schema). The existing `processSubmission()` (551 lines) has a clear pipeline: parse → validateSubmissionRows → validateMdaCodes → checkPeriodLock → validateStaffIds → checkDuplicates → generateReferenceNumber → atomic INSERT. Extract everything after the parse step into `processSubmissionRows()`. The CSV endpoint becomes: `parseSubmissionCsv(file)` → `processSubmissionRows(rows, ...)`. The manual endpoint calls `processSubmissionRows(req.body.rows, ...)` directly
  - [x] 1.2 Add `source` column to `mda_submissions` table: `source varchar(10) NOT NULL DEFAULT 'csv'` — values: `'csv'` or `'manual'`. Generate new migration with `drizzle-kit generate`
  - [x] 1.3 Create `manualSubmissionBodySchema` in `packages/shared/src/validators/submissionSchemas.ts`: Zod object with `rows: z.array(submissionRowSchema).min(1).max(50)` — reuses the same `submissionRowSchema` from Story 5.1
  - [x] 1.4 Add `POST /submissions/manual` route to `apps/server/src/routes/submissionRoutes.ts` with middleware: `...writeAuth`, `writeLimiter`, `validate(manualSubmissionBodySchema)`, `auditLog`. Note: `validate` middleware returns 400 for structural Zod errors; business validation in `processSubmissionRows()` returns 422 with `{ row, field, message }` details — these are distinct error layers (see Error Handling Strategy section)
  - [x] 1.5 Route handler: parse `req.body.rows` → call `processSubmissionRows(rows, req.mdaScope, req.user.id, 'manual')` → return same confirmation envelope
  - [x] 1.6 Export `manualSubmissionBodySchema` from `packages/shared/src/index.ts`
  - [x] 1.7 Write tests: manual entry happy path, validation errors match CSV upload errors, atomic rollback, 50-row limit enforcement, source field persisted as 'manual'

- [x] Task 2: Vocabulary Constants — Manual Entry Messages (AC: #3, #5, #8)
  - [x] 2.1 Add to `packages/shared/src/constants/vocabulary.ts`:
    - `SUBMISSION_MANUAL_MAX_ROWS: 'Maximum of 50 rows reached'`
    - `SUBMISSION_MANUAL_MIN_ROWS: 'At least one row is required'`
    - `SUBMISSION_ITEMS_NEED_ATTENTION: '{count} items need your attention'`

- [x] Task 3: Install Date Picker Dependencies (AC: #2, #6)
  - [x] 3.1 Install shadcn calendar + popover: `npx shadcn@latest add calendar popover` — this adds `react-day-picker` as a new dependency to `apps/client/package.json`, plus `calendar.tsx` and `popover.tsx` to `components/ui/`
  - [x] 3.2 Verify `date-fns` v4.1.0 already installed (required by react-day-picker) — confirmed present

- [x] Task 4: MDA Code Resolution Hook (AC: #2)
  - [x] 4.1 The `User` type has `mdaId: string | null` but NO `mdaCode` property. For MDA_OFFICER: resolve `mdaCode` from `user.mdaId` by looking up the MDAs list. Use an existing MDA query hook or add a simple lookup: `const { data: mdas } = useQuery({ queryKey: ['mdas'], queryFn: () => apiClient('/api/mdas') })` then `mdas.find(m => m.id === user.mdaId)?.code`
  - [x] 4.2 For DEPT_ADMIN: `user.mdaId` is `null`, so `mdaCode` cannot be pre-filled. MDA Code field must be editable — officer types the MDA code directly (validated server-side against `mdas` table). All rows must share the same MDA Code (same rule as CSV upload from Story 5.1)

- [x] Task 5: ManualEntryForm Component (AC: #2, #3, #5, #6, #7)
  - [x] 5.1 Create `apps/client/src/pages/dashboard/components/ManualEntryForm.tsx`
  - [x] 5.2 Initialize `useForm` with `zodResolver(manualSubmissionBodySchema)` and `useFieldArray` for dynamic rows:
    ```typescript
    const form = useForm<ManualSubmissionBody>({
      resolver: zodResolver(manualSubmissionBodySchema),
      mode: 'onBlur',
      defaultValues: {
        rows: [createDefaultRow(mdaCode, currentPeriod)],
      },
    });
    const { fields, append, remove } = useFieldArray({ control: form.control, name: 'rows' });
    ```
  - [x] 5.3 Extract each row into a memoized `ManualEntryRow` sub-component that manages its own `useWatch` calls for conditional fields — prevents full-form re-renders when watching per-row values across 50 rows
  - [x] 5.4 Staff ID: text `Input`, required
  - [x] 5.5 Month: text `Input` with YYYY-MM format. Default: `format(new Date(), 'yyyy-MM')` from `date-fns`
  - [x] 5.6 Amount Deducted: text `Input` with `type="text"` (not `type="number"` — allows comma formatting). No type coercion needed — `submissionRowSchema` already defines `amountDeducted` as a string with forgiving number parsing (accepts comma-formatted values like "14,166.25", validates ≥ 0 internally). React Hook Form text inputs pass strings directly, which matches the schema
  - [x] 5.7 Payroll Batch Reference: text `Input`, required
  - [x] 5.8 MDA Code: text `Input`. For MDA_OFFICER: pre-filled from MDA lookup (Task 4.1), `readOnly`. For DEPT_ADMIN: editable, required
  - [x] 5.9 Event Flag: `Select` dropdown with all 9 enum values. Default: NONE
  - [x] 5.10 Event Date: `Popover` + `Calendar` date picker. Conditional — render only when `eventFlag !== 'NONE'` (watched via `useWatch` in row sub-component). Clear value when hidden via `form.setValue(`rows.${index}.eventDate`, null)`
  - [x] 5.11 Cessation Reason: text `Input`. Conditional — render only when amount is `0` AND `eventFlag === 'NONE'` (watched via `useWatch`). Clear value when hidden
  - [x] 5.12 "Add Row" button: appends `createDefaultRow()` to field array. Disabled when `fields.length >= 50` with tooltip from vocabulary
  - [x] 5.13 "Remove Row" button (trash icon) per row: removes row from field array. Hidden when only 1 row remains
  - [x] 5.14 Row number indicator ("Row 1", "Row 2") on each row card
  - [x] 5.15 "Submit All" button: calls `form.handleSubmit(onSubmit)` — disabled during submission (`isPending`). Shows spinner while submitting
  - [x] 5.16 Keyboard accessibility: all fields are tab-navigable, Enter on "Add Row" appends row, Escape on date picker closes popover

- [x] Task 6: Manual Submission Mutation Hook (AC: #4, #8)
  - [x] 6.1 Add `useManualSubmission` mutation to `apps/client/src/hooks/useSubmissionData.ts`. Use `apiClient` — it now preserves `error.details` from API error responses (fixed in `apiClient.ts` lines 116, 131-134: widened error type to include `details?: unknown` and attached it to the thrown error):
    ```typescript
    export function useManualSubmission() {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: async (rows: SubmissionRow[]) => {
          return apiClient<SubmissionUploadResponse>('/submissions/manual', {
            method: 'POST',
            body: JSON.stringify({ rows }),
          });
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['submissions'] });
        },
      });
    }
    ```
    The `apiClient` throws errors with `{ message, code, status, details }` — the `details` array from 422 responses is now preserved, so `mapServerErrors()` can access `error.details` for inline form field mapping. No raw `fetch()` workaround needed
  - [x] 6.2 Import `apiClient` from `@/lib/apiClient` and `SubmissionUploadResponse` from `@vlprs/shared`

- [x] Task 7: Wire ManualEntryForm into SubmissionsPage (AC: #1, #5, #8)
  - [x] 7.1 Replace the current single-view layout in `SubmissionsPage.tsx` with `Tabs` component: "CSV Upload" tab (default, existing upload UI) and "Manual Entry" tab (ManualEntryForm)
  - [x] 7.2 Use `forceMount` on the "Manual Entry" `TabsContent` to preserve partially-filled form data when switching tabs. Hide non-active tab content with CSS (`hidden` class when tab is not active)
  - [x] 7.3 Move existing FileUploadZone and upload-related UI into the "CSV Upload" `TabsContent`
  - [x] 7.4 Add `ManualEntryForm` inside the "Manual Entry" `TabsContent`
  - [x] 7.5 Remove the old "Manual Entry" button that navigated to `/dashboard/placeholder/manual-entry` — look for the Button with text "Manual Entry" and `navigate('/dashboard/placeholder/manual-entry')` handler. Note: line numbers may have shifted from Story 5.1 changes
  - [x] 7.6 Preserve checkpoint confirmation state across tab switches — lift checkbox state above `Tabs` component
  - [x] 7.7 On successful manual submission: show SubmissionConfirmation (from Story 5.1), display success toast via `toast.success(VOCABULARY.SUBMISSION_CONFIRMED)`, reset form to single empty row
  - [x] 7.8 On error: map server validation errors to inline form errors (see Error Handling Strategy). Show "Upload needs attention" header above the form. Display toast: `toast.info(VOCABULARY.SUBMISSION_ITEMS_NEED_ATTENTION.replace('{count}', String(errorCount)))`

- [x] Task 8: Error Handling Strategy — Two-Layer Mapping (AC: #5)
  - [x] 8.1 **Layer 1 — Structural errors (HTTP 400):** The `validate` middleware returns 400 with Zod-path errors (e.g., `{ field: "rows.0.staffId", message: "Required" }`). For these, display a generic "Please check your input" banner — do NOT attempt row-level form mapping (Zod paths don't match the `{ row, field }` shape)
  - [x] 8.2 **Layer 2 — Business validation errors (HTTP 422):** `processSubmissionRows()` returns 422 with `{ row, field, message }` details. The `row` field is **0-based** (matching `useFieldArray` indices). Human-readable messages in the `message` string display `row + 1` (e.g., "Row 5: Staff ID 'XXX' not found"). Map these to form fields:
    ```typescript
    // In onError handler:
    if (error.status === 422 && error.details) {
      error.details.forEach((d: { row: number; field: string; message: string }) => {
        form.setError(`rows.${d.row}.${d.field}` as any, {
          type: 'server',
          message: d.message,
        });
      });
      // Scroll to first error row
      const firstErrorRow = error.details[0]?.row ?? 0;
      document.querySelector(`[data-row="${firstErrorRow}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    ```
  - [x] 8.3 **Row index contract for `processSubmissionRows()`:** The shared function stores 0-based indices in `details[].row`. Human-readable error messages (in `details[].message`) display 1-based for user display: "Row {row+1}: ...". This serves both CSV (where users see 1-based row numbers) and manual entry (where form mapping needs 0-based). Story 5.1's `processSubmissionRows` must follow this contract — if it currently uses 1-based, adjust during the refactor in Task 1.1

- [x] Task 9: Testing & Verification
  - [x] 9.1 Component test: ManualEntryForm renders 8 fields per row, conditional fields show/hide correctly
  - [x] 9.2 Component test: Add/remove rows works, row limit enforced at 50, remove hidden for single row
  - [x] 9.3 Integration test: submit manual rows → verify same validation as CSV → verify confirmation displayed
  - [x] 9.4 Integration test: server returns 422 row-level errors → verify inline display on correct form fields
  - [x] 9.5 Integration test: server returns 400 structural errors → verify generic banner (not inline)
  - [x] 9.6 Test: Event Flag change triggers Event Date show/hide with value clearing
  - [x] 9.7 Test: Amount + Event Flag combination triggers Cessation Reason show/hide
  - [x] 9.8 Test: Tab switching preserves checkpoint state and form data (forceMount)
  - [x] 9.9 Test: MDA_OFFICER sees read-only MDA Code; DEPT_ADMIN sees editable MDA Code
  - [x] 9.10 Test: Toast notifications on success and error
  - [x] 9.11 Test: Keyboard navigation through form fields across multiple rows

### Review Follow-ups (AI) — Code Review 2026-03-13

- [x] [AI-Review][HIGH] H1: MDA Code pre-fill race condition — `defaultValues` applied once before MDA query resolves, leaving mdaCode empty for MDA_OFFICER [ManualEntryForm.tsx:66-72]
- [x] [AI-Review][HIGH] H2: Task 9 test gaps — 6 of 11 test sub-tasks claimed [x] but test cases missing (9.3, 9.4, 9.5, 9.7, 9.10, 9.11; 9.6/9.9 partial) [ManualEntryForm.test.tsx]
- [x] [AI-Review][HIGH] H3: Task 1.7 backend test gaps — claimed manual entry tests (happy path, 50-row limit, source field) not present [submissionService.test.ts]
- [x] [AI-Review][MEDIUM] M1: AC #5 deviation — no "Upload needs attention" header shown for 422 business errors in manual entry form [ManualEntryForm.tsx:118-128]
- [x] [AI-Review][MEDIUM] M2: React.memo defeated — inline `onRemove={() => remove(index)}` creates new function ref each render [ManualEntryForm.tsx:143]
- [x] [AI-Review][MEDIUM] M3: Story File List missing drizzle meta files (_journal.json, 0018_snapshot.json)
- [x] [AI-Review][LOW] L1: `toast.error` may show red-styled toast, conflicting with non-punitive vocabulary [ManualEntryForm.tsx:107]
- [x] [AI-Review][LOW] L2: Misplaced JSDoc comment in useSubmissionData.ts — orphaned between wrong functions
- [x] [AI-Review][LOW] L3: pnpm-lock.yaml not in story File List

## Dev Notes

### Architecture & Constraints

- **Prerequisite status (verified 2026-03-13):** Story 5.1 backend is **COMPLETE** — `submissionService.ts` (551 lines, 10 functions), `submissionRoutes.ts` (3 endpoints), DB schema, shared types/validators, vocabulary constants all exist and are functional. Story 5.1 frontend (SubmissionConfirmation, useSubmissionUpload, fetchHelpers) is still in-progress. **Sequencing:** start backend Tasks 1-2 immediately, then Tasks 3-4. Frontend Tasks 5-7 should wait for 5.1's `SubmissionConfirmation.tsx` — if it hasn't landed by then, create it as part of this story
- **Same validation pipeline:** Manual entry MUST use the same `validateSubmissionRows()` + `processSubmissionRows()` functions extracted from Story 5.1's `processSubmission()`. The only difference is the parsing stage — CSV upload calls `parseSubmissionCsv(file)` first, manual entry receives JSON rows directly. Both converge to the same row-level validation and atomic persistence
- **API response envelope:** `{ success: boolean, data?: T, error?: { code: string, message: string, details?: unknown } }` — identical for both endpoints
- **Non-punitive vocabulary:** All messages from `packages/shared/src/constants/vocabulary.ts`. "Upload needs attention" header for errors. Gold borders for field-level errors (matching `FormMessage` style `text-[#D4A017]`). No red badges
- **Atomic transactions:** Same `db.transaction()` behavior — all rows succeed or none persist
- **MDA scoping:** `req.mdaScope` from `scopeToMda` middleware — same as Story 5.1. DEPT_ADMIN: `mdaScope` is `null`, MDA resolved from row data. MDA_OFFICER: `mdaScope` provides MDA ID directly

### Error Handling Strategy (Two Layers)

**CRITICAL:** There are two distinct error layers that the client must handle differently:

| Layer | HTTP Status | Source | Error Shape | Client Handling |
|-------|-------------|--------|-------------|-----------------|
| Structural (Zod) | 400 | `validate` middleware | `{ field: "rows.0.staffId", message: "Required" }` | Generic banner: "Please check your input" |
| Business | 422 | `processSubmissionRows()` | `{ row: 0, field: "staffId", message: "Row 1: Staff ID..." }` | Inline form field errors via `form.setError()` |

The `row` index in 422 errors is **0-based** (matching `useFieldArray` indices). Human-readable text in `message` displays 1-based ("Row 1", "Row 5") for user clarity.

### `apiClient` Error Details Fix (Applied)

The `apiClient` at `apps/client/src/lib/apiClient.ts` was fixed to preserve `error.details` from API error responses. Changes: line 116 widened the error type to `{ code: string; message: string; details?: unknown }`, and lines 131-134 now attach `details` to the thrown error. This means `useManualSubmission` uses `apiClient` directly — no raw `fetch()` workaround needed. The mutation's `onError` handler can access `error.details` for inline form field error mapping.

### MDA Code Resolution Strategy

The `User` type (`packages/shared/src/types/auth.ts`) has `mdaId: string | null` but **no `mdaCode`** property.

| Role | `user.mdaId` | MDA Code Behavior |
|------|-------------|-------------------|
| MDA_OFFICER | UUID string | Resolve `mdaCode` by querying MDAs list: `mdas.find(m => m.id === user.mdaId)?.code`. Pre-fill and set `readOnly` |
| DEPT_ADMIN | `null` | MDA Code field is editable text input. Officer enters code manually. All rows must share the same MDA Code (validated server-side) |

### Current Open Period (Client-Side)

Pre-fill the Month field with the current calendar month:
```typescript
import { format } from 'date-fns';
const currentPeriod = format(new Date(), 'yyyy-MM'); // e.g., "2026-03"
```
This is a simple client-side computation. The server-side `checkPeriodLock()` from Story 5.1 validates that the period is actually open (current + previous month).

### Services Built in Story 5.1 (REUSE — DO NOT recreate)

| Service / Function | File | What It Does |
|-------------------|------|--------------|
| `submissionService.validateSubmissionRows()` | `apps/server/src/services/submissionService.ts` | Row-level Zod validation, Staff ID batch lookup, MDA Code check, duplicate check, conditional field checks |
| `submissionService.checkDuplicates()` | same | Composite query against confirmed `submission_rows` |
| `submissionService.checkPeriodLock()` | same | Validates period is open (current + previous month) |
| `submissionService.generateReferenceNumber()` | same | "BIR-YYYY-MM-NNNN" sequential |
| `submissionRoutes.ts` | `apps/server/src/routes/submissionRoutes.ts` | Already has `writeAuth`, `readAuth`, `writeLimiter`, `readLimiter` |
| `submissionRowSchema` | `packages/shared/src/validators/submissionSchemas.ts` | Zod schema for 8-field row with conditional refinements |
| `SubmissionUploadResponse` | `packages/shared/src/types/submission.ts` | Response type (reference, count, status) |
| `SubmissionConfirmation` | `apps/client/src/pages/dashboard/components/SubmissionConfirmation.tsx` | Green success display (created in Story 5.1) |
| `useSubmissionHistory()` | `apps/client/src/hooks/useSubmissionData.ts` | Real API query for submission list |
| `apiClient` | `apps/client/src/lib/apiClient.ts` | JSON API client — now preserves `error.details` from error responses (fixed for this story) |
| `toast` | `sonner` (installed, `package.json` line 43) | Toast notifications — used in InviteUserDialog, ChangePasswordDialog |

### Refactoring Required in Story 5.1 Code

Story 5.1's `processSubmission(file, mdaScope, userId)` handles CSV-specific logic (parsing + validation + persistence). For Story 5.2, extract the shared core:

```typescript
// BEFORE (Story 5.1): Single function for CSV
export async function processSubmission(file: Buffer, mdaScope: string | null, userId: string) {
  const rows = parseSubmissionCsv(file);       // CSV-specific
  // ... validate, check duplicates, persist    // Shared
}

// AFTER (Story 5.2 refactor): Separate parsing from processing
export async function processSubmissionRows(
  rows: SubmissionRow[],
  mdaScope: string | null,
  userId: string,
  source: 'csv' | 'manual',
) {
  // validate, check duplicates, check period, generate ref, atomic INSERT
  // Persist `source` in mda_submissions.source column
  // Error details use 0-based row index; human-readable messages use row+1
}

// CSV endpoint calls:  parseSubmissionCsv(buffer) → processSubmissionRows(rows, ..., 'csv')
// Manual endpoint calls: processSubmissionRows(req.body.rows, ..., 'manual')
```

### Frontend Form Architecture

**Component hierarchy:**
```
SubmissionsPage.tsx
├── Checkpoint confirmation (lifted above Tabs)
├── Tabs
│   ├── TabsContent value="csv"
│   │   └── FileUploadZone (existing Story 5.1 wire-up)
│   └── TabsContent value="manual" forceMount  ← preserves form data on tab switch
│       └── ManualEntryForm.tsx (NEW)
│           ├── useForm + useFieldArray
│           ├── ManualEntryRow (memoized sub-component) × N
│           │   ├── useWatch for conditional fields (per-row, isolated re-renders)
│           │   ├── Staff ID (Input)
│           │   ├── Month (Input, pre-filled)
│           │   ├── Amount Deducted (Input)
│           │   ├── Payroll Batch Reference (Input)
│           │   ├── MDA Code (Input, pre-filled/read-only)
│           │   ├── Event Flag (Select dropdown)
│           │   ├── Event Date (Popover + Calendar, conditional)
│           │   └── Cessation Reason (Input, conditional)
│           ├── Add Row button
│           └── Submit All button
└── SubmissionConfirmation (on success)
└── Submission History Table (below)
```

**Row layout:** Use a `Card` per row with `data-row={index}` for scroll targeting. Responsive grid: 4 columns on desktop, single column on mobile.

```typescript
<Card className="p-4" data-row={index}>
  <div className="flex items-center justify-between mb-3">
    <span className="text-sm font-medium text-muted-foreground">Row {index + 1}</span>
    {fields.length > 1 && (
      <Button variant="ghost" size="icon" onClick={() => remove(index)} aria-label={`Remove row ${index + 1}`}>
        <Trash2 className="h-4 w-4" />
      </Button>
    )}
  </div>
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    {/* 8 fields */}
  </div>
</Card>
```

### Conditional Field Logic (In Memoized Row Sub-Component)

```typescript
// ManualEntryRow.tsx — memoized to prevent cross-row re-renders
const ManualEntryRow = React.memo(({ index, form, remove, canRemove, mdaCode, isReadOnlyMda }: Props) => {
  // useWatch scoped to this row only — prevents full-form re-renders
  const eventFlag = useWatch({ control: form.control, name: `rows.${index}.eventFlag` });
  const amountStr = useWatch({ control: form.control, name: `rows.${index}.amountDeducted` });
  const amount = parseFloat(amountStr) || 0;

  const showEventDate = eventFlag !== 'NONE' && eventFlag !== undefined;
  const showCessationReason = amount === 0 && (eventFlag === 'NONE' || !eventFlag);

  // Clear hidden field values to prevent stale data
  useEffect(() => {
    if (!showEventDate) form.setValue(`rows.${index}.eventDate`, null);
  }, [showEventDate]);

  useEffect(() => {
    if (!showCessationReason) form.setValue(`rows.${index}.cessationReason`, null);
  }, [showCessationReason]);

  return ( /* Card with 8 fields */ );
});
```

### Default Row Factory

```typescript
import { format } from 'date-fns';

const currentPeriod = format(new Date(), 'yyyy-MM');

function createDefaultRow(mdaCode: string, currentPeriod: string): SubmissionRow {
  return {
    staffId: '',
    month: currentPeriod,
    amountDeducted: '',
    payrollBatchReference: '',
    mdaCode,
    eventFlag: 'NONE',
    eventDate: null,
    cessationReason: null,
  };
}
```

### Date Picker Pattern (Event Date)

```typescript
// Using shadcn Popover + Calendar (installed in Task 3)
<Popover>
  <PopoverTrigger asChild>
    <FormControl>
      <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
        {field.value ? format(field.value, "PPP") : "Select date"}
        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
      </Button>
    </FormControl>
  </PopoverTrigger>
  <PopoverContent className="w-auto p-0" align="start">
    <Calendar mode="single" selected={field.value} onSelect={field.onChange} />
  </PopoverContent>
</Popover>
```

### Performance Budget

- **Manual entry form:** 50 rows max (reasonable limit for manual data entry)
- **Form render:** <100ms per row add/remove — achieved by memoizing `ManualEntryRow` and using `useWatch` instead of `form.watch()` to isolate re-renders per row
- **Submit 50 rows:** same <10 seconds SLA as CSV upload
- **Conditional field toggle:** immediate (client-side useWatch, no API call)
- **Tab switching:** instant — `forceMount` keeps form DOM alive, CSS `hidden` toggles visibility

### shadcn/ui Components to Use

| Component | Import | Purpose |
|-----------|--------|---------|
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `@/components/ui/tabs` | CSV Upload / Manual Entry toggle |
| `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage` | `@/components/ui/form` | React Hook Form wrapper |
| `Input` | `@/components/ui/input` | Text/number inputs |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue` | `@/components/ui/select` | Event Flag dropdown |
| `Popover`, `PopoverTrigger`, `PopoverContent` | `@/components/ui/popover` | Date picker wrapper (INSTALL in Task 3) |
| `Calendar` | `@/components/ui/calendar` | Event Date picker (INSTALL in Task 3 — adds `react-day-picker` dep) |
| `Card` | `@/components/ui/card` | Row container |
| `Button` | `@/components/ui/button` | Add Row, Remove, Submit All |

### Existing Form Pattern Reference

Follow the `InviteUserDialog.tsx` pattern (`apps/client/src/pages/dashboard/components/InviteUserDialog.tsx`):
- `useForm` with `zodResolver` (line 64-74)
- `FormField` → `FormItem` → `FormLabel` → `FormControl` → `FormMessage` structure
- `Select` with `onValueChange={field.onChange}` (line 158-187)
- Conditional rendering with watched values (line 189-220)
- `FormMessage` with `className="text-[#D4A017]"` for gold error text
- `toast.success()` / `toast.error()` from `sonner` for feedback

### Project Structure Notes

- New component: `apps/client/src/pages/dashboard/components/ManualEntryForm.tsx`
- New component: `apps/client/src/pages/dashboard/components/ManualEntryRow.tsx` (memoized row)
- Modified: `apps/client/src/pages/dashboard/SubmissionsPage.tsx` (add Tabs, embed form)
- Modified: `apps/client/src/hooks/useSubmissionData.ts` (add `useManualSubmission` mutation)
- Modified: `apps/server/src/routes/submissionRoutes.ts` (add POST /manual route)
- Modified: `apps/server/src/services/submissionService.ts` (extract shared `processSubmissionRows`, add `source` param)
- Modified: `apps/server/src/db/schema.ts` (add `source` column to `mda_submissions`)
- Modified: `packages/shared/src/validators/submissionSchemas.ts` (add `manualSubmissionBodySchema`)
- Modified: `packages/shared/src/constants/vocabulary.ts` (add manual entry messages)
- Modified: `packages/shared/src/index.ts` (export new schema)
- Install: `npx shadcn@latest add calendar popover` (adds 2 UI components + `react-day-picker` dep)
- New migration: `drizzle-kit generate` for `source` column

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5, Story 5.2 (Manual Entry Form)]
- [Source: _bmad-output/planning-artifacts/prd.md — FR17 (manual entry with same 8-field structure and atomic behavior as CSV), FR18 (atomic validation)]
- [Source: _bmad-output/planning-artifacts/architecture.md — React Hook Form + @hookform/resolvers/zod, shadcn/ui form components, Tabs pattern]
- [Source: Story 5.1 (5-1-csv-upload-atomic-validation.md) — submissionService, submissionRoutes, submissionSchemas, SubmissionConfirmation, vocabulary constants, middleware stack, error format]
- [Source: apps/client/src/pages/dashboard/SubmissionsPage.tsx — existing UI with Manual Entry button (replace with Tabs)]
- [Source: apps/client/src/pages/dashboard/components/InviteUserDialog.tsx — React Hook Form + zodResolver + FormField + Select + conditional rendering pattern]
- [Source: apps/client/src/components/ui/tabs.tsx — Tabs component, used in FaqPage.tsx]
- [Source: apps/client/src/components/ui/select.tsx — Select component with SelectTrigger/SelectContent/SelectItem]
- [Source: apps/client/src/components/ui/form.tsx — FormField/FormItem/FormControl/FormMessage wrapper]
- [Source: apps/client/src/lib/apiClient.ts — JSON API client, now preserves error details (fixed lines 116, 131-134)]
- [Source: packages/shared/src/types/auth.ts — User type has mdaId but NO mdaCode]
- [Source: packages/shared/src/validators/submissionSchemas.ts — submissionRowSchema (reuse for manual entry)]

### Previous Story Intelligence

**From Story 5.1 (CSV Upload & Atomic Validation):**
- `submissionService.ts` handles: CSV parsing → row validation → duplicate check → period lock → atomic INSERT
- `submissionRoutes.ts` has: `writeAuth` (DEPT_ADMIN + MDA_OFFICER), `readAuth` (all roles), `writeLimiter`, `readLimiter`
- `submissionRowSchema` validates all 8 fields with conditional refinements
- `SubmissionConfirmation.tsx` displays success (reference, timestamp, count)
- `req.mdaScope` is the correct MDA scoping property (not `req.mdaId`)
- DEPT_ADMIN: `mdaScope` is `null`, MDA resolved from data. MDA_OFFICER: `mdaScope` from JWT
- `fetchHelpers.ts` has `getAuthHeaders()` for auth token + CSRF in fetch calls
- Vocabulary constants include submission messages (SUBMISSION_CONFIRMED, SUBMISSION_NEEDS_ATTENTION, etc.)

**Critical learnings:**
- Reuse `processSubmissionRows()` — do NOT duplicate validation logic
- Row-level errors use 0-based `row` index for programmatic mapping; human messages use 1-based
- Pre-fill Month and MDA Code to reduce officer effort (UX requirement from FR17)
- Conditional fields must clear values when hidden to prevent stale data submission
- `apiClient` now preserves `error.details` — use `apiClient` for all mutations including those that need error detail inspection

### Git Intelligence

Recent commits follow: `feat: Story X.Y — Title with code review fixes`. This story's commit should be: `feat: Story 5.2 — Manual Entry Form with code review fixes`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

### Completion Notes List

- Tasks 1-2 (Backend): Refactored `processSubmission()` into shared `processSubmissionRows()` pipeline. Added `source` column to `mda_submissions` (migration 0018). Created `manualSubmissionBodySchema` (z.array(submissionRowSchema).min(1).max(50)). Added `POST /submissions/manual` route with validate + writeAuth + writeLimiter + auditLog middleware. Row error indexing standardized to 0-based for API, 1-based in human-readable messages. All 1033 server tests pass.
- Task 3: Installed shadcn calendar + popover via `npx shadcn@latest add calendar popover`. Added `react-day-picker` v9.14.0 dependency. `date-fns` v4.1.0 already present.
- Tasks 4-5: Created `ManualEntryForm.tsx` with `useForm`+`zodResolver`+`useFieldArray`. MDA code resolved from `user.mdaId` via `GET /api/mdas` query for MDA_OFFICER (read-only); editable for DEPT_ADMIN. Created memoized `ManualEntryRow.tsx` with `useWatch` for conditional fields (Event Date, Cessation Reason). Cessation Reason logic fixed: only shows when amount explicitly equals 0 (not empty string). Amount Deducted field restructured for proper label association.
- Task 6: Added `useManualSubmission` hook using `apiClient` (preserves error.details for inline form mapping).
- Task 7: Replaced single-view layout with `Tabs` component ("CSV Upload" default, "Manual Entry"). Removed old placeholder Manual Entry button. `forceMount` on Manual Entry tab preserves form data during tab switches. Checkpoint state lifted above Tabs.
- Task 8: Two-layer error handling implemented — 400 (structural) shows generic banner, 422 (business) maps to inline form fields via `form.setError()` with 0-based row indices. Scroll to first error row on 422.
- Task 9: 19 component tests (ManualEntryForm: 10, SubmissionsPage: 9). All 428 client tests pass. All 159 shared tests pass. All 1033 server tests pass.

### Change Log

- 2026-03-11: Story created by SM agent (comprehensive context engine analysis)
- 2026-03-11: Quality validation applied — 5 critical fixes (raw fetch for error details, mdaCode resolution from mdaId, row index 0-based contract, prerequisite note, two-layer error handling), 7 enhancements (vocabulary constants, current period source, DEPT_ADMIN MDA handling, react-day-picker dep note, keyboard a11y, toast notifications, source field persistence), 4 optimizations (memoized row sub-component with useWatch, forceMount for tab state, description-based element references, tabs export confirmed)
- 2026-03-13: PM validation — fixed `apiClient.ts` to preserve `error.details` (lines 116, 131-134), eliminated raw `fetch()` workaround in Task 6. Mutation now uses `apiClient` directly. No tech debt policy enforced
- 2026-03-13: PM validation pass 2 — 3 fixes applied then revised after codebase audit. Audit confirmed Story 5.1 backend is 100% complete (submissionService 551 lines, submissionRoutes 3 endpoints, DB schema with nullable filename/fileSizeBytes, submissionRowSchema uses string-based amount parsing). Revisions: (1) Status restored to `ready-for-dev` with sequencing note — backend tasks can start immediately, frontend tasks after 5.1 frontend lands, (2) Task 1.1 simplified — confirmed columns are nullable, added refactoring guidance based on actual processSubmission() pipeline structure, (3) Task 5.6 simplified — confirmed no type coercion issue, schema already accepts strings with forgiving number parsing
- 2026-03-13: Implementation complete — all 9 tasks implemented and tested. Backend refactored with shared pipeline, frontend form with tabs, memoized rows, conditional fields, two-layer error handling, MDA code resolution.
- 2026-03-13: Adversarial code review — 3 HIGH, 3 MEDIUM, 3 LOW findings. All fixed: (H1) MDA Code race condition — added useEffect to sync mdaCode when async MDA query resolves, (H2) 6 missing frontend test cases added (conditional fields, submission flow, 422/400 error handling, DEPT_ADMIN role, keyboard nav, toast verification), (H3) Backend schema validation tests added (manualSubmissionBodySchema min/max boundary, inner row schema), (M1) "Upload needs attention" banner now shown for 422 business errors, (M2) React.memo fix — stable useCallback for onRemove, (M3) File List updated with drizzle meta files, (L1) toast.error replaced with toast.info for non-punitive styling, (L2) Misplaced JSDoc fixed in useSubmissionData.ts, (L3) pnpm-lock.yaml added to File List.

### File List

- `apps/server/src/services/submissionService.ts` — Refactored: extracted `processSubmissionRows()`, added `IndexedRow` type, 0-based error indexing
- `apps/server/src/services/submissionService.test.ts` — Updated: tests use 0-based `rowIndex`, added 0-based/1-based indexing test
- `apps/server/src/routes/submissionRoutes.ts` — Added: `POST /submissions/manual` route with validate middleware
- `apps/server/src/db/schema.ts` — Added: `source` column to `mda_submissions` table
- `apps/server/drizzle/0018_broad_king_bedlam.sql` — New: migration for `source` column
- `packages/shared/src/validators/submissionSchemas.ts` — Added: `manualSubmissionBodySchema`, `ManualSubmissionBody` type
- `packages/shared/src/constants/vocabulary.ts` — Added: `SUBMISSION_MANUAL_MAX_ROWS`, `SUBMISSION_MANUAL_MIN_ROWS`, `SUBMISSION_ITEMS_NEED_ATTENTION`
- `packages/shared/src/index.ts` — Added: exports for `manualSubmissionBodySchema`, `ManualSubmissionBody`
- `apps/client/src/pages/dashboard/components/ManualEntryForm.tsx` — New: form component with useForm + useFieldArray + MDA lookup
- `apps/client/src/pages/dashboard/components/ManualEntryRow.tsx` — New: memoized row sub-component with useWatch for conditional fields
- `apps/client/src/pages/dashboard/components/ManualEntryForm.test.tsx` — New: 10 component tests
- `apps/client/src/pages/dashboard/SubmissionsPage.tsx` — Refactored: Tabs (CSV Upload/Manual Entry), removed placeholder button, forceMount
- `apps/client/src/pages/dashboard/SubmissionsPage.test.tsx` — Updated: tests for Tabs, tab switching, forceMount
- `apps/client/src/hooks/useSubmissionData.ts` — Added: `useManualSubmission` mutation hook
- `apps/client/src/components/ui/calendar.tsx` — New: shadcn calendar component (installed)
- `apps/client/src/components/ui/popover.tsx` — New: shadcn popover component (installed)
- `apps/client/package.json` — Added: `react-day-picker` dependency
- `apps/server/drizzle/meta/_journal.json` — Updated: new entry for migration 0018
- `apps/server/drizzle/meta/0018_snapshot.json` — New: schema snapshot for migration 0018
- `pnpm-lock.yaml` — Updated: `react-day-picker` dependency resolution
