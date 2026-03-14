# Story 5.3: Submission Confirmation & Reference

Status: done

**Prerequisite:** Stories 5.1 (CSV Upload) and 5.2 (Manual Entry) must be completed first. This story builds on the submission infrastructure, API responses, and SubmissionsPage Tabs layout they establish.

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **MDA Reporting Officer**,
I want immediate confirmation after a successful submission with a reference number,
So that I have proof of submission and know exactly what was received.

## Acceptance Criteria

1. **Given** a successful submission (CSV or manual)
   **When** processing completes
   **Then** a `SubmissionConfirmation` component displays: green success indicator, reference number (format: "BIR-2026-02-0001"), timestamp, record count, "Upload Complete" header (FR23)
   **And** the confirmation appears BEFORE any comparison data (Confirm, Then Compare principle)

2. **Given** the confirmation screen
   **When** the officer views the reference number
   **Then** they can copy it to clipboard with one click
   **And** visual feedback confirms the copy action (icon changes to checkmark for 2 seconds — story-level enrichment beyond epic AC for better UX)

## Tasks / Subtasks

- [x] Task 1: Shared Types & Vocabulary Constants (AC: #1)
  - [x] 1.1 In `packages/shared/src/types/submission.ts`, check if `SubmissionUploadResponse` exists (Story 5.1 Task 2.1 creates it). If it does NOT exist yet, create it:
    ```typescript
    export interface SubmissionUploadResponse {
      referenceNumber: string;
      recordCount: number;
      submissionDate: string;
      status: SubmissionRecordStatus;
    }
    ```
    The API does NOT return `source` — the `source` field is only in the DB `mda_submissions` table. For the confirmation component, define a separate local type in SubmissionsPage (see Task 4.1)
  - [x] 1.2 In `packages/shared/src/constants/vocabulary.ts`, add confirmation-specific constants inside the `UI_COPY` object (NOT the `VOCABULARY` object):
    - `SUBMISSION_REFERENCE_COPIED: 'Reference number copied to clipboard'` (toast message)
    - `SUBMISSION_CONFIRMATION_RECORDS: '{count} records submitted'` (record count display — interpolate via `.replace('{count}', String(recordCount))`)
    - `SUBMISSION_CONFIRMATION_SOURCE_CSV: 'Submitted via CSV upload'`
    - `SUBMISSION_CONFIRMATION_SOURCE_MANUAL: 'Submitted via manual entry'`
    - `SUBMISSION_SUBMIT_ANOTHER: 'Submit Another'` (reset button label)
  - [x] 1.3 Export any new types from `packages/shared/src/index.ts`

- [x] Task 2: `useCopyToClipboard` Reusable Hook (AC: #2)
  - [x] 2.1 Create `apps/client/src/hooks/useCopyToClipboard.ts` — generalize the clipboard pattern from `apps/client/src/pages/dashboard/components/IndividualTraceReport.tsx` (lines 223-257). That existing code copies `window.location.href` using `LinkIcon` / `Check` icon swap with a 2-second reset. The new hook abstracts this into a reusable utility accepting any text string
  - [x] 2.2 Hook signature: `useCopyToClipboard(resetDuration = 2000)` returns `{ copied: boolean, copyToClipboard: (text: string) => void }`. The `resetDuration` parameter is configurable for reuse in other contexts
  - [x] 2.3 Implementation:
    ```typescript
    const copyToClipboard = useCallback((text: string) => {
      navigator.clipboard.writeText(text)
        .then(() => {
          setCopied(true);
          toast.success(UI_COPY.SUBMISSION_REFERENCE_COPIED);
          setTimeout(() => setCopied(false), resetDuration);
        })
        .catch(() => {
          // Fallback: select-and-copy via temporary textarea
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          setCopied(true);
          toast.success(UI_COPY.SUBMISSION_REFERENCE_COPIED);
          setTimeout(() => setCopied(false), resetDuration);
        });
    }, [resetDuration]);
    ```
  - [x] 2.4 (Non-blocking, optional) Refactor `IndividualTraceReport.tsx` to use the new hook instead of its inline clipboard logic. This prevents code duplication but is tangential to the story's AC — defer if time-constrained

- [x] Task 3: `SubmissionConfirmation` Component (AC: #1, #2)
  - [x] 3.1 Story 5.1 Task 7.1 creates a basic `SubmissionConfirmation` component at `apps/client/src/pages/dashboard/components/SubmissionConfirmation.tsx`. Enhance this component to meet full FR23 requirements. If it doesn't exist yet, create it at that path. Note: Story 5.2 Task 7.7 also references showing this component on manual submission success — both stories converge here
  - [x] 3.2 Component props interface:
    ```typescript
    interface SubmissionConfirmationProps {
      referenceNumber: string;   // "BIR-2026-02-0001"
      recordCount: number;
      submissionDate: string;    // ISO timestamp
      source: 'csv' | 'manual'; // Provided by caller, NOT from API
      onSubmitAnother: () => void;
    }
    ```
  - [x] 3.3 Layout structure (top to bottom):
    - **Success icon:** `CheckCircle2` from `lucide-react` — `h-12 w-12 text-success` (green, `#16a34a`) — centered at top. Use `CheckCircle2` (NOT `CircleCheck`) to match the project-wide convention used in `FileUploadZone.tsx`, `AttentionItemCard.tsx`, `DashboardPage.tsx`, `MigrationUploadResult.tsx`, `ValidationSummaryCard.tsx`
    - **Header:** "Upload Complete" — import as `UI_COPY.UPLOAD_SUCCESS_HEADER` from `packages/shared/src/constants/vocabulary.ts` (lives inside the `UI_COPY` object, not `VOCABULARY`). Use `text-xl font-semibold` centered
    - **Reference number block:** prominent display with `font-mono text-lg` styling, background `bg-gray-50 rounded-lg p-3` container. Reference number left-aligned, copy button right-aligned in same row
    - **Copy button:** `Button variant="ghost" size="sm"` — shows `Copy` icon (from `lucide-react`) when idle, `Check` icon (green, `text-success`) when copied. Use `useCopyToClipboard` hook. Accessible: `aria-label="Copy reference number"`
    - **Details grid:** two-column grid (`grid grid-cols-2 gap-y-2 text-sm`) below reference block:
      - "Records submitted" → `{recordCount}` — use `UI_COPY.SUBMISSION_CONFIRMATION_RECORDS.replace('{count}', String(recordCount))`
      - "Submitted at" → formatted timestamp via `formatDateTime(submissionDate)` from `apps/client/src/lib/formatters.ts` (existing project utility, produces "11-Mar-2026, 02:30 PM" format with 12h AM/PM — consistent with timestamps shown elsewhere in the app)
      - "Source" → `UI_COPY.SUBMISSION_CONFIRMATION_SOURCE_CSV` or `UI_COPY.SUBMISSION_CONFIRMATION_SOURCE_MANUAL` based on `source` prop
    - **Divider:** `Separator` component from `apps/client/src/components/ui/separator.tsx`
    - **Action:** `Button variant="outline"` — text from `UI_COPY.SUBMISSION_SUBMIT_ANOTHER` → calls `onSubmitAnother`
  - [x] 3.4 Wrap entire component in `Card` (from `apps/client/src/components/ui/card.tsx`) with `max-w-md mx-auto` for centered presentation. Use `CardContent` with `pt-6` padding
  - [x] 3.5 Entrance animation: use simple CSS transition. The project uses Tailwind CSS v4 with CSS-only config in `apps/client/src/styles/globals.css` (no `tailwind.config.ts`). Do NOT rely on `tailwindcss-animate` plugin classes (`animate-in`, `fade-in-0`). Instead use standard Tailwind transitions: `transition-opacity duration-300` or a simple CSS `@keyframes fadeIn` in globals.css if animation is desired. Alternatively, skip entrance animation entirely — it's cosmetic

- [x] Task 4: Wire CSV Upload Success → Confirmation (AC: #1)
  - [x] 4.1 In `apps/client/src/pages/dashboard/SubmissionsPage.tsx`, add state to hold the confirmation data with a local wrapper type that includes `source`:
    ```typescript
    type ConfirmationData = SubmissionUploadResponse & { source: 'csv' | 'manual' };
    const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);
    ```
    The API response (`SubmissionUploadResponse`) does NOT include `source`. The `source` is determined by WHICH mutation succeeded and is attached at the call site
  - [x] 4.2 The `useSubmissionUpload` hook (from Story 5.1) defines its own `onSuccess` inside the hook (invalidates queries). To also trigger the page-level confirmation, pass an additional `onSuccess` at the **call site** in SubmissionsPage:
    ```typescript
    const uploadMutation = useSubmissionUpload();
    // When FileUploadZone triggers upload:
    uploadMutation.mutate(file, {
      onSuccess: (data) => setConfirmationData({ ...data, source: 'csv' }),
    });
    ```
    TanStack Query v5 calls BOTH the hook-level `onSuccess` (query invalidation) AND the call-site `onSuccess` (confirmation state). They are additive, not overriding
  - [x] 4.3 When `confirmationData !== null`, render `SubmissionConfirmation` instead of the upload/entry section
  - [x] 4.4 `onSubmitAnother` handler resets all submission-related state:
    ```typescript
    const handleSubmitAnother = () => {
      setConfirmationData(null);
      setCheckpointConfirmed(false);
      setActiveTab?.('csv'); // Reset tab to default (Story 5.2 adds tab state)
    };
    ```

- [x] Task 5: Wire Manual Entry Success → Confirmation (AC: #1)
  - [x] 5.1 Same call-site `onSuccess` pattern for `useManualSubmission` (from Story 5.2):
    ```typescript
    const manualMutation = useManualSubmission();
    // When manual form submits:
    manualMutation.mutate(rows, {
      onSuccess: (data) => setConfirmationData({ ...data, source: 'manual' }),
    });
    ```
  - [x] 5.2 The `confirmationData` state is defined in `SubmissionsPage` ABOVE the Tabs component, so both CSV and manual flows can set it. Whichever succeeds first triggers the confirmation view
  - [x] 5.3 Note: `confirmationData` is component-level state — it is lost on page navigation. This is expected behavior. When the officer returns to the page, they see the upload view. Their submission is visible in the history table

- [x] Task 6: Confirm-Then-Compare Layout Ordering (AC: #1)
  - [x] 6.1 Restructure `SubmissionsPage` render logic with two view states:
    - **Upload view** (`confirmationData === null`): show Pre-Submission Checkpoint → Tabs (CSV Upload | Manual Entry) — this is the default/current state from Stories 5.1/5.2
    - **Confirmation view** (`confirmationData !== null`): show `SubmissionConfirmation` component — replaces the upload section entirely. Checkpoint is hidden. The "Submit Another" button returns to upload view
    - **Future (Story 5.4):** Comparison will render BELOW the confirmation. This story only needs to ensure the confirmation section is positioned at the top of the content area
  - [x] 6.2 Submission History table remains visible in ALL view states (always at bottom). Call `queryClient.invalidateQueries({ queryKey: ['submissions'] })` when entering confirmation view so the new submission appears in history immediately. Note: after Story 5.1, `useSubmissionHistory` returns a paginated response `{ data: SubmissionRecord[], total, page, pageSize }` — the history table rendering should already handle this shape from Story 5.1
  - [x] 6.3 The `onSubmitAnother` handler resets: `confirmationData` → null, `checkpointConfirmed` → false, active tab → default ('csv-upload')

- [x] Task 7: Tests (AC: #1, #2)
  - [x] 7.1 Create `apps/client/src/pages/dashboard/components/SubmissionConfirmation.test.tsx`:
    - Renders reference number, record count, formatted timestamp, source label
    - Renders "Upload Complete" header (from `UI_COPY.UPLOAD_SUCCESS_HEADER`)
    - Copy button calls `navigator.clipboard.writeText` with reference number
    - Copy button shows `Check` icon after click, reverts to `Copy` icon after 2s (use `vi.useFakeTimers()` + `vi.advanceTimersByTime(2000)`)
    - "Submit Another" button calls `onSubmitAnother` callback
    - Source displays "Submitted via CSV upload" for `source="csv"` and "Submitted via manual entry" for `source="manual"`
  - [x] 7.2 Create `apps/client/src/hooks/useCopyToClipboard.test.ts`:
    - `copyToClipboard` calls `navigator.clipboard.writeText` with given text
    - `copied` becomes `true` after call, resets to `false` after timeout
    - Handles clipboard API failure gracefully (falls back to execCommand)
    - Mock: `Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })`
  - [x] 7.3 Integration verification in SubmissionsPage:
    - After successful CSV upload mutation, SubmissionConfirmation renders with `source="csv"` and correct data
    - After successful manual entry mutation, SubmissionConfirmation renders with `source="manual"` and correct data
    - "Submit Another" resets to upload view (checkpoint unchecked, tabs visible)
    - History table refreshes on confirmation display

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Task 7.3 integration tests missing — created SubmissionsPage.integration.test.tsx with 4 scenarios (CSV→confirmation, manual→confirmation, submit-another reset, history visibility) [apps/client/src/pages/dashboard/SubmissionsPage.integration.test.tsx]
- [x] [AI-Review][MEDIUM] M1: Redundant "Records submitted" label in details grid — changed label to "Records" since value already shows "{count} records submitted" [SubmissionConfirmation.tsx:63]
- [x] [AI-Review][MEDIUM] M2: useCopyToClipboard hardcoded toast — added optional `toastMessage` parameter for reusability, defaults to existing message [useCopyToClipboard.ts]
- [x] [AI-Review][MEDIUM] M3: Heading hierarchy h1→h3 skip (WCAG 1.3.1) — changed h3 to h2 in SubmissionConfirmation [SubmissionConfirmation.tsx:40]
- [x] [AI-Review][MEDIUM] M4: No setTimeout cleanup on unmount — added useRef + useEffect cleanup to prevent stale setCopied calls [useCopyToClipboard.ts]
- [x] [AI-Review][LOW] L1: Tests relied on lucide-react CSS class names — replaced with dynamic aria-label assertions (also improves accessibility) [SubmissionConfirmation.tsx, SubmissionConfirmation.test.tsx]
- [x] [AI-Review][LOW] L2: Toast message content not asserted — added toHaveBeenCalledWith assertion [useCopyToClipboard.test.ts:49]
- [x] [AI-Review][LOW] L3: Story doc tab value wrong — fixed 'csv-upload' → 'csv' to match actual tab values [story file Task 4.4]

## Dev Notes

### Architecture & Constraints

- **This is a frontend-only story.** No new backend endpoints or database changes needed. The API responses from Story 5.1 (`POST /api/submissions/upload`) and Story 5.2 (`POST /api/submissions/manual`) already return all confirmation data: `{ referenceNumber, recordCount, submissionDate, status }`
- **Non-punitive vocabulary:** All text MUST use approved terms from `packages/shared/src/constants/vocabulary.ts`. Import from the `UI_COPY` object (e.g., `UI_COPY.UPLOAD_SUCCESS_HEADER`) — NOT the `VOCABULARY` object. These are two separate exports in the same file
- **Confirm, Then Compare principle:** The confirmation MUST appear BEFORE any comparison data. Story 5.4 adds comparison; this story ensures the layout accommodates that ordering
- **Component location:** `apps/client/src/pages/dashboard/components/SubmissionConfirmation.tsx` — co-located with other dashboard page components (BaselineConfirmationDialog, IndividualTraceReport, etc.)
- **`source` is NOT in the API response.** The `source` column exists in the DB table `mda_submissions` (added by Story 5.2), but the `SubmissionUploadResponse` type returned by the API does not include it. The caller determines `source` based on which mutation was invoked (CSV vs manual) and attaches it locally via the `ConfirmationData` wrapper type
- **`confirmationData` is ephemeral.** It exists as component-level state in SubmissionsPage. It is lost on page navigation — this is expected. The officer's submission persists in the history table

### Mutation `onSuccess` Wiring Pattern

The `useSubmissionUpload` and `useManualSubmission` hooks (from Stories 5.1/5.2) define `onSuccess` callbacks inside the hooks themselves (for query invalidation). To trigger page-level state changes, pass an ADDITIONAL `onSuccess` at the **mutation call site** in SubmissionsPage:

```typescript
// TanStack Query v5: call-site onSuccess is additive, not overriding
uploadMutation.mutate(file, {
  onSuccess: (data) => setConfirmationData({ ...data, source: 'csv' }),
});

manualMutation.mutate(rows, {
  onSuccess: (data) => setConfirmationData({ ...data, source: 'manual' }),
});
```

Both the hook-level callback (query invalidation) AND the call-site callback (confirmation state) will execute. Do NOT modify the hooks' internal `onSuccess` — they are shared and should remain generic.

### Existing Patterns to Reuse

| Pattern | Source File | What to Reuse |
|---------|------------|---------------|
| Clipboard copy | `IndividualTraceReport.tsx:223-257` | Pattern: `navigator.clipboard.writeText(url)` + `copied` state + 2s reset + icon swap (`LinkIcon` → `Check`). Generalize: accept any text, use `Copy` icon instead of `LinkIcon` |
| Toast notification | `apps/client/src/components/ui/sonner.tsx` | `toast.success()` — configured with `CircleCheck` success icon |
| Success icon | `apps/client/src/components/shared/FileUploadZone.tsx` | `CheckCircle2` from `lucide-react` in `text-success` color — project-wide convention |
| Card layout | `apps/client/src/components/ui/card.tsx` | `Card` + `CardContent` for confirmation container |
| Date formatting | `apps/client/src/lib/formatters.ts` | `formatDateTime(isoString)` — produces "11-Mar-2026, 02:30 PM" (12h AM/PM, consistent with other timestamps in app) |
| Button variants | `apps/client/src/components/ui/button.tsx` | `variant="ghost"` for copy, `variant="outline"` for Submit Another |
| Separator | `apps/client/src/components/ui/separator.tsx` | Horizontal divider between sections |
| Template interpolation | vocabulary.ts pattern | Use `.replace('{count}', String(value))` for template constants like `'{count} records submitted'` |

### Components Already Available (DO NOT recreate)

| Component | File | Used For |
|-----------|------|----------|
| `Card`, `CardContent` | `apps/client/src/components/ui/card.tsx` | Confirmation container |
| `Button` | `apps/client/src/components/ui/button.tsx` | Copy button, Submit Another |
| `Separator` | `apps/client/src/components/ui/separator.tsx` | Section divider |
| `Tabs`, `TabsContent` | `apps/client/src/components/ui/tabs.tsx` | CSV/Manual tabs (from Story 5.2) |
| `FileUploadZone` | `apps/client/src/components/shared/FileUploadZone.tsx` | CSV upload (from Story 5.1) |
| `Toaster` / `toast` | `sonner` + `apps/client/src/components/ui/sonner.tsx` | Toast notifications |

### Components to Create or Enhance

| Component | File | Purpose |
|-----------|------|---------|
| `SubmissionConfirmation` | `apps/client/src/pages/dashboard/components/SubmissionConfirmation.tsx` | Full confirmation display — may exist as basic version from Story 5.1 Task 7.1; enhance to meet all AC. Story 5.2 Task 7.7 also references showing this on manual success — both stories converge here |
| `useCopyToClipboard` | `apps/client/src/hooks/useCopyToClipboard.ts` | Reusable clipboard hook with fallback — generalized from IndividualTraceReport pattern |

### Icons Used (all from `lucide-react`, already installed)

| Icon | Import | Usage |
|------|--------|-------|
| `CheckCircle2` | `lucide-react` | Large success indicator at top of confirmation (project-wide convention) |
| `Copy` | `lucide-react` | Copy button default state |
| `Check` | `lucide-react` | Copy button after successful copy (green) |

### SubmissionsPage State Machine After Stories 5.1 + 5.2 + 5.3

```
                          ┌─────────────────────┐
                          │   UPLOAD VIEW        │
                          │ (confirmationData    │
                          │  === null)           │
                          │                      │
                          │ ┌──────────────────┐ │
                          │ │ Checkpoint       │ │
                          │ │ ☐ I have reviewed│ │
                          │ └──────────────────┘ │
                          │ ┌──────────────────┐ │
                          │ │ Tabs             │ │
                          │ │ [CSV] [Manual]   │ │
                          │ └──────────────────┘ │
                          └──────────┬───────────┘
                                     │ mutation.mutate(data, {
                                     │   onSuccess: setConfirmationData
                                     │ })
                                     ▼
                          ┌─────────────────────┐
                          │ CONFIRMATION VIEW    │
                          │ (confirmationData    │
                          │  !== null)           │
                          │                      │
                          │  ✓ Upload Complete   │
                          │  BIR-2026-02-0001 📋│
                          │  42 records          │
                          │  11-Mar-2026, 2:30PM │
                          │                      │
                          │ [Submit Another]     │
                          └──────────┬───────────┘
                                     │ onSubmitAnother()
                                     │ → setConfirmationData(null)
                                     │ → setCheckpointConfirmed(false)
                                     │ → setActiveTab('csv-upload')
                                     ▼
                          ┌─────────────────────┐
                          │   UPLOAD VIEW        │
                          │ (reset: checkpoint   │
                          │  unchecked, tab =    │
                          │  CSV Upload)         │
                          └─────────────────────┘

  ┌─────────────────────────────────────────────────┐
  │ SUBMISSION HISTORY TABLE                        │
  │ (always visible, refreshes on confirmation)     │
  │ Note: paginated response from Story 5.1         │
  └─────────────────────────────────────────────────┘
```

### API Response Shape (from Stories 5.1/5.2 — do not modify backend)

**Success response from `POST /api/submissions/upload` and `POST /api/submissions/manual`:**
```json
{
  "success": true,
  "data": {
    "referenceNumber": "BIR-2026-03-0001",
    "recordCount": 42,
    "submissionDate": "2026-03-11T14:30:00.000Z",
    "status": "confirmed"
  }
}
```

Note: response does NOT include `source`. The `source` is determined client-side from which mutation path was used (CSV upload vs manual entry).

### Testing Notes

- **Mock `navigator.clipboard`** in test setup: `Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })`
- **Mock clipboard failure:** `vi.fn().mockRejectedValue(new Error('denied'))` — verify fallback execCommand path
- **Mock `toast`** from sonner: `vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))`
- Use `@testing-library/react` + `vitest` (project standard)
- Co-locate test files alongside source: `SubmissionConfirmation.test.tsx` next to `SubmissionConfirmation.tsx`
- Use `vi.useFakeTimers()` + `vi.advanceTimersByTime(2000)` to test the 2-second copy reset

### Project Structure Notes

- Component at `apps/client/src/pages/dashboard/components/` — follows existing pattern (BaselineConfirmationDialog, IndividualTraceReport, MdaDrillDown are all in this directory)
- Hook at `apps/client/src/hooks/` — follows existing pattern (useSubmissionData, useMigration, useCopyToClipboard)
- Test files co-located with source files
- Shared types in `packages/shared/src/types/submission.ts`
- Vocabulary constants in `packages/shared/src/constants/vocabulary.ts` under the `UI_COPY` export object

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 5, Story 5.3 (Submission Confirmation & Reference)]
- [Source: _bmad-output/planning-artifacts/epics.md — FR23 (confirmation with reference number, timestamp, row count)]
- [Source: _bmad-output/implementation-artifacts/5-1-csv-upload-atomic-validation.md — SubmissionConfirmation component (Task 7.1), SubmissionUploadResponse type, API response shape, useSubmissionUpload mutation]
- [Source: _bmad-output/implementation-artifacts/5-2-manual-entry-form.md — useManualSubmission mutation, Tabs layout, source column, Task 7.7 confirmation display]
- [Source: apps/client/src/pages/dashboard/components/IndividualTraceReport.tsx:223-257 — clipboard copy pattern: copies URL with LinkIcon → Check icon swap, 2s reset]
- [Source: apps/client/src/components/ui/sonner.tsx — toast.success() with CircleCheck icon]
- [Source: apps/client/src/pages/dashboard/SubmissionsPage.tsx — current page layout, state management, FileUploadZone wiring]
- [Source: apps/client/src/lib/formatters.ts — formatDateTime() utility for consistent timestamp formatting]
- [Source: apps/client/src/components/ui/card.tsx — Card/CardContent for confirmation container]
- [Source: packages/shared/src/constants/vocabulary.ts — UI_COPY.UPLOAD_SUCCESS_HEADER ('Upload Complete')]
- [Source: packages/shared/src/types/submission.ts — SubmissionRecord interface; SubmissionUploadResponse may or may not exist yet]
- [Source: apps/client/src/styles/globals.css — Tailwind CSS v4 theme config (no tailwind.config.ts)]

### Previous Story Intelligence

**From Story 5.1 (CSV Upload):**
- Creates basic `SubmissionConfirmation.tsx` in Task 7.1 — "display reference number, timestamp, record count with green success indicator". Story 5.3 enhances this with copy-to-clipboard, proper layout, source indicator
- `useSubmissionUpload` mutation uses raw `fetch()` — mutation's `onSuccess` (hook-level) invalidates queries. Call-site `onSuccess` is additive
- FileUploadZone wired to mutation in Task 7.2-7.3
- Reference number format: `BIR-YYYY-MM-NNNN` (e.g., "BIR-2026-03-0001")
- `SubmissionRecordStatus`: `'processing' | 'confirmed' | 'rejected'`
- `useSubmissionHistory` changed to return paginated `{ data: SubmissionRecord[], total, page, pageSize }`

**From Story 5.2 (Manual Entry):**
- Adds Tabs component to SubmissionsPage: "CSV Upload" | "Manual Entry"
- `useManualSubmission` mutation returns same `SubmissionUploadResponse` shape
- `forceMount` on Manual Entry `TabsContent` preserves form state across tab switches
- `source` column added to `mda_submissions` table: `'csv'` | `'manual'`
- Task 7.7 references showing SubmissionConfirmation on success — Story 5.3 provides the full implementation

**From Story 4.3 (most recent completed):**
- Co-located test files pattern
- Component composition with props interfaces
- TanStack Query `invalidateQueries` on mutations

### Git Intelligence

Recent commits follow `feat: Story X.Y — Title with code review fixes` format. All stories are single commits after code review. Current branch: `dev`.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Shared package rebuild required after adding new UI_COPY constants (tsc compilation)
- Timestamp test initially failed due to timezone difference (UTC+1 on dev machine) — fixed by using `formatDateTime()` output directly instead of hardcoded string
- `document.execCommand` not available in JSDOM — fixed by direct assignment mock instead of `vi.spyOn`

### Completion Notes List

- Task 1: `SubmissionUploadResponse` already existed from Story 5.1. Added 5 new UI_COPY constants for confirmation vocabulary. No new type exports needed.
- Task 2: Created `useCopyToClipboard` hook with configurable reset duration, clipboard API with textarea fallback, and toast notification. Task 2.4 (IndividualTraceReport refactor) deferred as marked non-blocking.
- Task 3: Enhanced existing basic `SubmissionConfirmation` component from Story 5.1 into full FR23-compliant component with Card layout, copy-to-clipboard, source indicator, formatted timestamp, record count with template interpolation, and "Submit Another" action. Skipped entrance animation (cosmetic, Task 3.5).
- Task 4: Added `ConfirmationData` wrapper type with `source` field. Wired CSV upload `onSuccess` at call site (additive pattern). Added `handleSubmitAnother` to reset all state. Added controlled `activeTab` state.
- Task 5: Lifted manual entry confirmation state from `ManualEntryForm` to parent `SubmissionsPage`. Added `onSuccess` prop to `ManualEntryForm`. Removed internal `confirmationData` state and `SubmissionConfirmation` rendering from the form.
- Task 6: Restructured SubmissionsPage with two-state render: confirmation view (when `confirmationData !== null`) replaces upload section; history table always visible at bottom. Query invalidation handled by hooks' internal `onSuccess`.
- Task 7: 17 tests across 3 test files — all passing. 9 SubmissionConfirmation component tests + 4 useCopyToClipboard hook tests + 4 SubmissionsPage integration tests. Full regression suite: 448 client tests + 1,041 server tests — all green.

### Change Log

- 2026-03-11: Story created by SM agent (comprehensive context engine analysis)
- 2026-03-11: Quality validation applied — 7 critical fixes (UI_COPY import path, mutation onSuccess call-site pattern, source wrapper type, SubmissionUploadResponse create-if-missing, Tailwind v4 CSS-only config, formatDateTime utility, CheckCircle2 icon convention), 8 enhancements (clipboard .catch fallback, Story 5.2 overlap clarification, .replace interpolation guidance, ephemeral state documented, clipboard source accuracy, paginated history shape, tab state reset, Badge removed from components table), 5 optimizations (configurable hook timeout, IndividualTraceReport refactor marked non-blocking, optional icons removed, AC enrichment noted, components table cleaned)
- 2026-03-14: Implementation complete — all 7 tasks done, 13 new tests, 0 regressions (448 client + 1,041 server tests passing)
- 2026-03-14: Code review — 8 findings (1H, 4M, 3L). All fixed: integration tests added (H1), redundant label (M1), reusable toast param (M2), heading hierarchy WCAG fix (M3), setTimeout cleanup (M4), aria-label test assertions (L1), toast assertion (L2), story doc tab value (L3). Test count: 17 across 3 files.

### File List

- packages/shared/src/constants/vocabulary.ts (modified — added 5 UI_COPY confirmation constants)
- apps/client/src/hooks/useCopyToClipboard.ts (new — reusable clipboard hook with fallback)
- apps/client/src/hooks/useCopyToClipboard.test.ts (new — 4 tests)
- apps/client/src/pages/dashboard/components/SubmissionConfirmation.tsx (modified — enhanced from basic to full FR23 component)
- apps/client/src/pages/dashboard/components/SubmissionConfirmation.test.tsx (new — 9 tests)
- apps/client/src/pages/dashboard/SubmissionsPage.tsx (modified — two-state view, confirmation wiring, controlled tabs)
- apps/client/src/pages/dashboard/components/ManualEntryForm.tsx (modified — lifted confirmation state to parent via onSuccess prop)
- apps/client/src/pages/dashboard/SubmissionsPage.integration.test.tsx (new — 4 integration tests for Story 5.3 confirmation wiring)
