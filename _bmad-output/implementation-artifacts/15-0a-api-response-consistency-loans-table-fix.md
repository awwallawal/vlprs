# Story 15.0a: API Response Consistency & Loans Table Fix

Status: done

## Story

As the **AG/Department Admin/MDA Officer**,
I want the MDA Detail page to display the loans table and submission history correctly,
So that I can drill down from any metric card to see the actual loan records behind the number.

**Origin:** UAT Finding #5 (Critical) + #32 from E8 retro. `apiClient.ts:198` returns unwrapped `body.data` but `useMdaLoans` and `MdaDetailPage` expect wrapped `{ data, pagination }` format. All 171 loans fetched from backend but silently discarded at the type-mismatch boundary.

**Priority:** CRITICAL — first prep story, blocks entire E15 prep sprint.

## Acceptance Criteria

1. **Given** an MDA Detail page is loaded for an MDA with 171 loans, **When** the page renders, **Then** the Loans table provides paginated access to all 171 loans with correct columns (Staff Name, Staff ID, Loan Ref, Outstanding Balance, Classification, Last Deduction, Retirement Date) and pagination controls when results exceed one page.

2. **Given** the Filtered Loan List page is navigated to from a dashboard metric card, **When** the page loads, **Then** the loans table populates with the correct records matching the filter (not empty).

3. **Given** any hook that calls a paginated `/loans` endpoint via `apiClient`, **When** the response is received, **Then** both the `data` array AND `pagination` metadata are preserved and accessible to consumers.

4. **Given** all hooks across the client codebase, **When** audited for response unwrapping consistency, **Then** no hook silently discards data by mismatching the `apiClient` return shape with the declared TypeScript generic type.

5. **Given** the Dept Admin role, **When** viewing the MDA Detail page for any MDA, **Then** the same loans table renders correctly (Finding #32 cascade fix).

6. **Given** the `useExceptionQueue()` backwards-compatibility alias, **When** it accesses `query.data?.data`, **Then** it correctly returns the exception list items array (verify existing behaviour is preserved, not regressed).

7. **Given** all existing tests for components consuming loan data, **When** the fix is applied, **Then** all tests continue to pass with no regressions.

## Root Cause Analysis

### The Core Problem

`apiClient.ts:198` always returns `body.data as T`:

```typescript
// apps/client/src/lib/apiClient.ts:192-199
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await authenticatedFetch(endpoint, options);
  const body = await parseJsonResponse(res);
  return body.data as T;  // <-- ONLY returns body.data, discards body.pagination
}
```

### The Server Response Inconsistency

The `/api/loans` endpoint sends **FLAT** format — pagination at top level alongside `data`:

```typescript
// apps/server/src/routes/loanRoutes.ts:59
res.json({ success: true, data: result.data, pagination: result.pagination });
// Server shape: { success: true, data: LoanSearchResult[], pagination: {...} }
```

So `apiClient()` returns `body.data` = `LoanSearchResult[]` — the pagination object is discarded.

Other endpoints (exceptions, observations, beneficiaries) send **WRAPPED** format — the entire result object inside `data`:

```typescript
// e.g. apps/server/src/routes/exceptionRoutes.ts:75
res.json({ success: true, data });
// Server shape: { success: true, data: { data: ExceptionListItem[], total, page } }
```

So `apiClient()` returns `body.data` = `{ data: [...], total, page }` — the wrapper is preserved.

### The Consumer Mismatch (Broken)

```typescript
// apps/client/src/hooks/useMdaData.ts:54-56
return useQuery<MdaLoansResponse>({
  queryFn: () => apiClient<MdaLoansResponse>(`/loans?${params}`)
  // MdaLoansResponse = { data: LoanSearchResult[], pagination: {...} }
  // But apiClient ACTUALLY returns: LoanSearchResult[] (unwrapped array)
});

// apps/client/src/pages/dashboard/MdaDetailPage.tsx:35
const mdaLoans = mdaLoansQuery.data?.data ?? [];
// mdaLoansQuery.data is LoanSearchResult[] (array), not MdaLoansResponse
// .data on an array is undefined -> mdaLoans = [] -> EMPTY TABLE
```

### Blast Radius (Confirmed)

| File | Line | Pattern | Status |
|------|------|---------|--------|
| `hooks/useMdaData.ts` | 54-56 | `apiClient<MdaLoansResponse>()` where server sends flat | **BROKEN** |
| `hooks/useFilteredLoans.ts` | 40 | `apiClient<FilteredLoansResponse>()` same `/loans` endpoint | **BROKEN** |
| `pages/dashboard/MdaDetailPage.tsx` | 35 | `mdaLoansQuery.data?.data ?? []` | **BROKEN** (Finding #5, #32) |
| `pages/dashboard/FilteredLoanListPage.tsx` | 107 | `result?.data ?? []` | **BROKEN** |
| `hooks/useExceptionData.ts` | 47 | `query.data?.data` | WORKS (server sends wrapped) |
| `hooks/useStaffProfile.ts` | 5-31 | `authenticatedFetch` + manual wrap | WORKS (correct pattern) |
| `hooks/useMigration.ts` | 54-68 | `authenticatedFetch` + manual wrap | WORKS (correct pattern) |
| `pages/dashboard/MigrationPage.tsx` | 33 | `uploads.data?.data?.[0]` | WORKS (hook properly wraps) |
| `pages/dashboard/components/MdaReviewSection.tsx` | 13 | `uploads.data?.data?.[0]` | WORKS (hook properly wraps) |
| `pages/dashboard/components/MigrationUploadList.tsx` | 65 | `data?.data ?? []` | WORKS (hook properly wraps) |

## Tasks / Subtasks

- [x] Task 1: Fix `useMdaLoans` hook (AC: 1, 3, 5)
  - [x] 1.1: In `apps/client/src/hooks/useMdaData.ts`, change `useMdaLoans` from using `apiClient` to using `authenticatedFetch + parseJsonResponse` with manual response construction — matching the pattern already used in `usePersonList` (`hooks/useStaffProfile.ts:5-31`) and `useListMigrations` (`hooks/useMigration.ts:54-68`):
    ```typescript
    export function useMdaLoans(mdaId: string, classification?: string, page = 1) {
      const params = new URLSearchParams();
      params.set('mdaId', mdaId);
      if (classification) params.set('classification', classification);
      params.set('page', String(page));
      params.set('pageSize', '25');

      return useQuery<MdaLoansResponse>({
        queryKey: ['mda', mdaId, 'loans', classification, page],
        queryFn: async () => {
          const res = await authenticatedFetch(`/loans?${params.toString()}`);
          const body = await parseJsonResponse(res);
          return {
            data: body.data as LoanSearchResult[],
            pagination: body.pagination as MdaLoansResponse['pagination'],
          };
        },
        enabled: !!mdaId,
        staleTime: 30_000,
      });
    }
    ```
  - [x] 1.2: Add `authenticatedFetch, parseJsonResponse` to the import from `@/lib/apiClient` (both are already exported from that file)

- [x] Task 2: Fix `useFilteredLoans` hook (AC: 2, 3)
  - [x] 2.1: In `apps/client/src/hooks/useFilteredLoans.ts`, change from `apiClient` to `authenticatedFetch + parseJsonResponse` with same manual construction pattern:
    ```typescript
    import { authenticatedFetch, parseJsonResponse } from '@/lib/apiClient';
    import type { LoanSearchResult } from '@vlprs/shared';

    // ... (interface FilteredLoansResponse stays the same)

    export function useFilteredLoans(/* params same */) {
      // ... (param building stays the same)
      return useQuery<FilteredLoansResponse>({
        queryKey: ['loans', 'filtered', filter, mdaId, classification, sortBy, sortOrder, page],
        queryFn: async () => {
          const res = await authenticatedFetch(`/loans?${queryString}`);
          const body = await parseJsonResponse(res);
          return {
            data: body.data as LoanSearchResult[],
            pagination: body.pagination as FilteredLoansResponse['pagination'],
          };
        },
        staleTime: 30_000,
        enabled: !!(filter || classification),
      });
    }
    ```

- [x] Task 3: Verify consumer pages work correctly (AC: 1, 2, 5)
  - [x] 3.1: Confirm `MdaDetailPage.tsx:35` pattern `mdaLoansQuery.data?.data ?? []` now works because `useMdaLoans` returns `{ data: [...], pagination: {...} }` correctly — NO CHANGE needed to the page component
  - [x] 3.2: Confirm `FilteredLoanListPage.tsx:107` pattern `result?.data ?? []` now works — NO CHANGE needed
  - [x] 3.3: Confirm `MdaDetailPage.tsx:187` pattern `submissions.data?.items?.map(...)` still works — verify `useSubmissionHistory` is NOT affected (server sends wrapped format for `/submissions`)

- [x] Task 4: Full hook audit — verify no other hooks have same unwrap mismatch (AC: 4, 6)
  - [x] 4.1: Audit every `apiClient<SomeWrappedType>()` call in `apps/client/src/hooks/`:
    - `useBeneficiaryData.ts` → `apiClient<PaginatedBeneficiaries>` — SAFE (server sends wrapped: `res.json({ success: true, data })` where `data` is `{ data: [], pagination: {}, metrics: {} }`)
    - `useObservationData.ts` → `apiClient<PaginatedObservations>` — SAFE (server sends wrapped)
    - `useExceptionData.ts` → `apiClient<ExceptionListResponse>` — SAFE (server sends wrapped: `{ data: [], total, page }`)
    - `useDeduplication.ts:98` → `apiClient<DuplicateListResponse>` — **VERIFIED SAFE** (server sends wrapped via `delineationRoutes.ts:106`)
    - `useMigration.ts:253` → `apiClient<{ records: [], total, page, limit }>` — **VERIFIED SAFE** (server sends wrapped via `migrationRoutes.ts:326`)
    - `useMigration.ts:107` → `apiClient<ValidationResult & { pagination }>` — **VERIFIED SAFE** (server sends wrapped via `migrationRoutes.ts:191`)
  - [x] 4.2: Verify `useExceptionQueue()` at `useExceptionData.ts:42-49` still works — `query.data?.data` accesses `{ data: ExceptionListItem[], total, page }.data` = `ExceptionListItem[]` — **CONFIRMED** correct, exceptions server route sends wrapped format
  - [x] 4.3: Document any other hooks found with the same pattern that need future attention (add to Dev Notes) — **No additional broken hooks found.** The `/loans` endpoint was the ONLY flat-format endpoint confirmed. All other paginated endpoints use wrapped format.

- [x] Task 5: Update/add tests (AC: 7, plus pagination tests from tangent)
  - [x] 5.1: `MdaDetailPage.test.tsx` exists — mocks at hook level with correct shape `{ data: mockLoans, isPending: false }` where `mockLoans = { data: [...], pagination: {...} }`. No change needed — verified compatible with fixed hook.
  - [x] 5.2: `FilteredLoanListPage.test.tsx` mock at line 33 uses correct response shape `{ data: { data: mockLoans, pagination: {...} }, isPending: false }`. No change needed.
  - [x] 5.3: `useMdaData.test.tsx` updated — `useMdaLoans` tests now mock `authenticatedFetch + parseJsonResponse` (FLAT server format) instead of `apiClient`. Assertions unchanged.
  - [x] 5.4: Run full test suite: `pnpm test` in both `apps/client` and `apps/server` — zero regressions confirmed

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Add `beforeEach` reset for `mockUseMdaLoans` in `MdaDetailPage.test.tsx` — pagination tests override mock permanently via `mockReturnValue`, causing test bleed to any subsequently added tests [MdaDetailPage.test.tsx:66-78] — **FIXED**
- [x] [AI-Review][MEDIUM] M1: Update AC1 to reflect paginated display ("provides paginated access to all 171 loans") instead of "displays all 171 loans" — scope creep from tangent #7 conflicted with original AC wording [story file AC1] — **FIXED**
- [x] [AI-Review][MEDIUM] M2: Add `useEffect` to reset `loanPage` to 1 when `mdaId` changes — prevents stale page number on same-component navigation between MDA detail pages [MdaDetailPage.tsx:33] — **FIXED**
- [ ] [AI-Review][LOW] L1: Extract shared `PaginationMeta` type to `@vlprs/shared` — identical `pagination` shape duplicated in `useMdaData.ts:34-39` and `useFilteredLoans.ts:6-12` (pre-existing, deferred to future story)
- [ ] [AI-Review][LOW] L2: Replace `as` type assertions with runtime validation in `useMdaLoans`/`useFilteredLoans` queryFn — `body.data as T` casts bypass runtime checks (follows existing codebase pattern, deferred)
- [x] [AI-Review][LOW] L3: Wrap pagination click assertion in `waitFor` for robust async state verification [MdaDetailPage.test.tsx:186-190] — **FIXED**

## Dev Notes

### Fix Strategy: Hook-Level, Not apiClient-Level

**Do NOT modify `apiClient.ts`** — it has ~70+ call sites and changing its return shape would cascade everywhere. Instead, fix the two broken hooks to use the same `authenticatedFetch + parseJsonResponse` pattern already established by working hooks.

### Existing Correct Patterns to Follow

Two hooks already handle flat-format server responses correctly:

**`hooks/useStaffProfile.ts:5-31` (usePersonList):**
```typescript
queryFn: async () => {
  const res = await authenticatedFetch(`/migrations/persons?${params}`);
  const body = await parseJsonResponse(res);
  return { data: body.data as PersonListItem[], pagination: body.pagination as ... };
},
```

**`hooks/useMigration.ts:54-68` (useListMigrations):**
```typescript
queryFn: async () => {
  const res = await authenticatedFetch(`/migrations?${params}`);
  const body = await parseJsonResponse(res);
  return { data: body.data as MigrationUploadSummary[], pagination: body.pagination as ... };
},
```

Both are in `apps/client/src/hooks/`. Follow this exact pattern.

### Server Response Format Reference

The two response formats in use across the codebase:

| Format | Example | `apiClient()` returns |
|--------|---------|----------------------|
| **FLAT** (pagination at top level) | `loanRoutes.ts:59` — `res.json({ success, data: [...], pagination: {...} })` | Just `[...]` — pagination LOST |
| **WRAPPED** (result object inside data) | `exceptionRoutes.ts:75` — `res.json({ success, data: { data: [...], total, page } })` | `{ data: [...], total, page }` — pagination PRESERVED |

The `/loans` endpoint is the ONLY confirmed endpoint using FLAT format. Do NOT change the server format — fix consumption only.

### Files to Touch

| File | Action |
|------|--------|
| `apps/client/src/hooks/useMdaData.ts` | Fix `useMdaLoans` queryFn + add imports |
| `apps/client/src/hooks/useFilteredLoans.ts` | Fix `useFilteredLoans` queryFn + change imports |
| `apps/client/src/pages/dashboard/FilteredLoanListPage.test.tsx` | Verify mock shape matches (line 13-14) |

**No changes needed to:**
- `apiClient.ts` — leave as-is
- `MdaDetailPage.tsx` — consumer pattern `data?.data` will work once hook is fixed
- `FilteredLoanListPage.tsx` — consumer pattern `result?.data` will work once hook is fixed
- Any server-side files

### Architecture Compliance

- **Response envelope:** `{ success: boolean, data?: T, error?: { code, message, details? } }` — maintained
- **Pagination at top level** alongside `data` is the loans endpoint convention — hooks must handle this explicitly
- **HTTP client:** Native `fetch` with typed wrapper — `authenticatedFetch` + `parseJsonResponse` are the approved primitives (both exported from `apiClient.ts`)
- **Non-punitive vocabulary:** N/A for this story (infrastructure fix)

### Testing Standards

- **Framework:** Vitest + React Testing Library
- **Mocking:** Hooks are mocked via `vi.mock()` in component tests (see `FilteredLoanListPage.test.tsx:13`)
- **Existing mocks must match new response shape** — verify `mockUseFilteredLoans` returns `{ data: { data: [...], pagination: {...} } }` (React Query wraps the hook result in `.data`)

### Project Structure Notes

- All client hooks: `apps/client/src/hooks/`
- All client pages: `apps/client/src/pages/dashboard/`
- Shared types: `packages/shared/src/types/`
- apiClient infrastructure: `apps/client/src/lib/apiClient.ts` — exports `apiClient`, `authenticatedFetch`, `parseJsonResponse`

### Team Agreement Compliance

- **Agreement #11: Every number is a doorway** — this fix restores the 171 loans behind the MDA loan count metric
- **Agreement #12: Role-specific UAT** — verify fix works for AG (Super Admin), Dept Admin, AND MDA Officer roles
- **Agreement #5: File list verification** — dev must include exact file list in completion notes

### References

- [Source: `_bmad-output/implementation-artifacts/epic-8-uat-findings-2026-04-06.md` — Finding #5, #32]
- [Source: `_bmad-output/implementation-artifacts/epic-8-retro-2026-04-06.md` — Prep-1 assignment]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Story 15.0a specification, line ~3440]
- [Source: `apps/client/src/lib/apiClient.ts:192-199` — apiClient unwrap logic]
- [Source: `apps/server/src/routes/loanRoutes.ts:59` — server flat response format]
- [Source: `apps/client/src/hooks/useStaffProfile.ts:5-31` — correct pattern (usePersonList)]
- [Source: `apps/client/src/hooks/useMigration.ts:54-68` — correct pattern (useListMigrations)]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

N/A — no debug issues encountered

### Completion Notes List

1. **Task 1 (useMdaLoans):** Switched from `apiClient<MdaLoansResponse>` to `authenticatedFetch + parseJsonResponse` with manual `{ data, pagination }` construction. Follows established pattern from `usePersonList` and `useListMigrations`.
2. **Task 2 (useFilteredLoans):** Same fix applied. Removed `apiClient` import entirely (no longer used in file), replaced with `authenticatedFetch, parseJsonResponse`.
3. **Task 3 (consumer pages):** Verified `MdaDetailPage.tsx:35` (`data?.data ?? []`) and `FilteredLoanListPage.tsx:107` (`result?.data ?? []`) will resolve correctly with fixed hooks. No changes needed to page components.
4. **Task 4 (full audit):** All 6 audited hooks confirmed SAFE — `useDeduplication.ts:98`, `useMigration.ts:107`, `useMigration.ts:253`, `useExceptionData.ts:37`, `useObservationData.ts`, `useBeneficiaryData.ts`. Server endpoints all use WRAPPED format. `/loans` was the ONLY flat-format endpoint.
5. **Task 5 (tests):** Updated `useMdaData.test.tsx` to mock `authenticatedFetch + parseJsonResponse` for `useMdaLoans` tests. Consumer page tests (`MdaDetailPage.test.tsx`, `FilteredLoanListPage.test.tsx`) mock at hook level — no changes needed. Full suite passes.
6. **useExceptionQueue backwards compat (AC 6):** Confirmed `useExceptionData.ts:42-49` — `query.data?.data` correctly chains because exceptions server sends wrapped `{ data: ExceptionListItem[], total, page }`.
7. **Tangent — MdaDetailPage pagination UI (PM validation finding):** During PM validation, it was observed that `MdaDetailPage` rendered page 1 only with no pagination controls despite the hook supporting pagination. Added `loanPage` state, wired `useMdaLoans(mdaId!, undefined, loanPage)`, and rendered Previous/Next buttons with "Showing X–Y of Z loans" summary. Follows established pagination pattern from `ExceptionsPage` and `ObservationsList`. Pagination controls only render when `totalPages > 1`. Three new test cases added to `MdaDetailPage.test.tsx`.
8. **Code review fixes (2026-04-06):** [H1] Added `beforeEach` in `MdaDetailPage.test.tsx` to reset `mockUseMdaLoans` between tests — prevents mock bleed from pagination override. [M1] Updated AC1 to reflect paginated access. [M2] Added `useEffect` reset of `loanPage` when `mdaId` changes — prevents stale page on navigation. [L3] Wrapped pagination click test assertion in `waitFor` for async safety. All 18 tests pass.

### File List

| File | Action |
|------|--------|
| `apps/client/src/hooks/useMdaData.ts` | Modified — added `authenticatedFetch, parseJsonResponse` imports, rewrote `useMdaLoans` queryFn |
| `apps/client/src/hooks/useFilteredLoans.ts` | Modified — changed imports from `apiClient` to `authenticatedFetch, parseJsonResponse`, rewrote `useFilteredLoans` queryFn |
| `apps/client/src/hooks/useMdaData.test.tsx` | Modified — added `mockAuthenticatedFetch, mockParseJsonResponse` mocks, updated `useMdaLoans` test cases |
| `apps/client/src/pages/dashboard/MdaDetailPage.tsx` | Modified — added `useState` import, `loanPage` state, pagination controls with Previous/Next buttons and "Showing X–Y of Z" summary |
| `apps/client/src/pages/dashboard/MdaDetailPage.test.tsx` | Modified — converted `useMdaLoans` mock to `vi.hoisted`, added 3 pagination tests (hidden when 1 page, renders controls, Next advances page) |
| `_bmad-output/implementation-artifacts/15-0a-api-response-consistency-loans-table-fix.md` | Modified — updated task checkboxes, status, Dev Agent Record |
