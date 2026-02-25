# Story 2.6: Loan Search & Record Retrieval

Status: ready-for-dev

<!-- Generated: 2026-02-24 | Epic: 2 | Sprint: 3 -->
<!-- Blocked By: 2-1 (loans/mdas tables), 2-2 (ledger table), 2-3 (computation engine), 2-5 (balance computation) | Blocks: 2-7 -->
<!-- FRs: FR13, FR35 (partial — lastDeductionDate and retirementDate deferred) | Motivation: Instant loan lookup for walk-in enquiries -->
<!-- Source: epics.md → Epic 2, Story 2.6 | prd.md → FR13, FR35, NFR-PERF-5 -->

## Story

As a **Department Admin**,
I want to search for any loan by staff ID, name, MDA, or loan reference and see the complete record instantly,
so that walk-in enquiries are answered in seconds instead of days.

## Acceptance Criteria

### AC 1: Multi-Field Search with Pagination (FR13, NFR-PERF-5)

**Given** the loan database with indexed columns
**When** a user calls `GET /api/loans` with query parameters:
- `?search=3301` (staff ID partial match), or
- `?search=Mustapha` (borrower name), or
- `?search=BIR` (MDA code/name), or
- `?search=VLC-2024-0847` (loan reference)

**Then** matching results are returned with offset-based pagination
**And** each result includes: `staffName`, `staffId`, `mdaName`, `loanReference`, `status`, `outstandingBalance` (computed), `installmentsPaid`, `installmentsRemaining`
**And** results are returned in <2 seconds (NFR-PERF-5)
**And** optional filters apply: `status` (enum), `mdaId` (UUID)
**And** optional sort applies: `sortBy` (createdAt | staffName | loanReference | status), `sortOrder` (asc | desc)

### AC 2: Loan Detail Endpoint (FR35)

**Given** a loan record exists with ID `:loanId`
**When** `GET /api/loans/:loanId` is called
**Then** the response contains:
- Full loan master data (all loans table columns + `mdaName`, `mdaCode`)
- Computed outstanding balance, total principal paid, total interest paid (from Story 2.5 balance service)
- Installments completed / remaining
- Repayment schedule (from Story 2.3 computation engine)
- Ledger entry count
- Loan status

**And** a non-existent `:loanId` returns `404` with `VOCABULARY.LOAN_NOT_FOUND`

### AC 3: RBAC & MDA Scoping

**Given** RBAC scoping is active via `scopeToMda` middleware
**When** an `mda_officer` searches or retrieves loans
**Then** only loans within their assigned MDA are returned
**And** a detail request for a loan outside their MDA returns `403`
**And** `super_admin` / `dept_admin` see loans across all MDAs

## Tasks / Subtasks

- [ ] Task 1: Search query validators (AC: 1)
  - [ ] 1.1 Add `searchLoansQuerySchema` to existing `packages/shared/src/validators/loanSchemas.ts` (created in Story 2.1 with `createLoanSchema`) — validates `search` (optional, min 2 chars), `page` (int >=1, default 1), `pageSize` (int 1-100, default 25), `status` (optional, UPPERCASE loan status enum), `mdaId` (optional UUID), `sortBy` (optional enum: createdAt, staffName, loanReference, status), `sortOrder` (optional: asc | desc, default desc)
  - [ ] 1.2 Export from `packages/shared/src/index.ts` barrel

- [ ] Task 2: Shared types & vocabulary (AC: 1, 2)
  - [ ] 2.1 In `packages/shared/src/types/loan.ts`: update `LoanStatus` to UPPERCASE values matching DB enum (`'APPLIED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'TRANSFERRED' | 'WRITTEN_OFF'`); update `LoanSearchResult` to include `status`, `installmentsPaid`, `installmentsRemaining`, `principalAmount`, `tenureMonths`; add `LoanDetail` interface extending loan master data with `mdaName`, `mdaCode`, `balance` (BalanceResult from Story 2.5), `schedule` (RepaymentSchedule from Story 2.3), `ledgerEntryCount`
  - [ ] 2.2 Add to `packages/shared/src/constants/vocabulary.ts`: `LOAN_NOT_FOUND: 'The referenced loan record could not be found.'`, `SEARCH_TOO_SHORT: 'Search term must be at least 2 characters.'`
  - [ ] 2.3 Export new types from barrel

- [ ] Task 3: Loan search service (AC: 1, 3)
  - [ ] 3.1 Add `searchLoans(actingUser, filters)` function to existing `apps/server/src/services/loanService.ts` (created in Story 2.1 with `createLoan`, `getLoanById`)
  - [ ] 3.2 JOIN `loans` with `mdas` to include `mdaName` and `mdaCode` in results
  - [ ] 3.3 Apply `withMdaScope(loans.mdaId, mdaScope)` for MDA isolation
  - [ ] 3.4 Multi-field search: `or(ilike(loans.staffId, term), ilike(loans.staffName, term), ilike(loans.loanReference, term), ilike(mdas.code, term), ilike(mdas.name, term))`
  - [ ] 3.5 Offset pagination: two queries — `count()` for total, `select().limit().offset()` for page — matching `userAdminService.listUsers()` pattern exactly
  - [ ] 3.6 Batch balance computation: after fetching page of loans, run single aggregation query on `ledger_entries` grouped by `loanId` (`SUM(amount)` for totalPaid, `COUNT(*)` where entryType='PAYROLL' for installmentsPaid); compute `outstandingBalance = (principal + totalInterest) - totalPaid` using `decimal.js`; compute `installmentsRemaining = tenureMonths - installmentsPaid`

- [ ] Task 4: Loan detail service (AC: 2)
  - [ ] 4.1 Add `getLoanDetail(loanId, mdaScope)` to `loanService.ts`
  - [ ] 4.2 Fetch loan + MDA JOIN; throw `AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND)` if not found; throw `AppError(403)` if MDA scope violation
  - [ ] 4.3 Call Story 2.5's `computeBalanceFromEntries()` (pure function) with loan's ledger entries to get full `BalanceResult` (balance, principal paid, interest paid, installments, derivation chain)
  - [ ] 4.4 Call Story 2.3's `computeRepaymentSchedule()` to include the repayment schedule in detail response
  - [ ] 4.5 Query ledger entry count: `SELECT COUNT(*) FROM ledger_entries WHERE loan_id = :loanId`

- [ ] Task 5: Loan routes & app registration (AC: 1, 2, 3)
  - [ ] 5.1 Add search and enriched detail routes to existing `apps/server/src/routes/loanRoutes.ts` (created in Story 2.1 with `POST /loans`, basic `GET /loans/:id`)
  - [ ] 5.2 `GET /loans` — middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN, MDA_OFFICER), scopeToMda, auditLog]` → parse `req.query` with `searchLoansQuerySchema` → call `searchLoans()` → respond `{ success: true, data, pagination }`
  - [ ] 5.3 `GET /loans/:loanId` — same middleware stack → extract `loanId` via Express 5 param helper → call `getLoanDetail()` → respond `{ success: true, data }`
  - [ ] 5.4 Register in `apps/server/src/app.ts`: `import loanRoutes` → `app.use('/api', loanRoutes)` before 404 handler

- [ ] Task 6: Integration tests (AC: 1, 2, 3)
  - [ ] 6.1 Create `apps/server/src/routes/loanRoutes.integration.test.ts`
  - [ ] 6.2 Seed test data: 1 MDA, 1 user (super_admin), 1 user (mda_officer scoped to MDA), 3+ loans with ledger entries; use `beforeAll` truncate + seed pattern from existing tests
  - [ ] 6.3 Test search by staffId, staffName, loanReference, mdaCode — verify matches returned, non-matches excluded
  - [ ] 6.4 Test pagination: seed enough loans to span 2 pages, verify page 1 and page 2 return correct subsets, `totalItems` and `totalPages` correct
  - [ ] 6.5 Test status filter: `?status=ACTIVE` returns only ACTIVE loans
  - [ ] 6.6 Test MDA scoping: mda_officer token → only sees loans in their MDA; super_admin token → sees all
  - [ ] 6.7 Test detail endpoint: verify loan master data, computed balance matches expected, schedule included, ledger count correct
  - [ ] 6.8 Test 404: non-existent loanId → 404 response
  - [ ] 6.9 Test 403: mda_officer requesting loan outside their MDA → 403 response
  - [ ] 6.10 Test empty search result: `?search=ZZZZNOTFOUND` → `{ data: [], pagination: { totalItems: 0 } }`

- [ ] Task 7: Unit tests for batch balance logic (AC: 1)
  - [ ] 7.1 Create `apps/server/src/services/loanService.test.ts`
  - [ ] 7.2 Test `computeListBalances()` helper (if extracted): given loan params + aggregated ledger sums, verify correct outstanding balance string with 2 decimal places
  - [ ] 7.3 Test edge case: loan with zero ledger entries → balance equals total loan amount
  - [ ] 7.4 Test edge case: loan fully paid → balance equals `"0.00"`

## Dev Notes

### Critical Architecture Constraints

1. **No stored balances** — `outstandingBalance` is always computed from ledger entries at query time (Story 2.5 principle). There is no `balance` column in the `loans` table.

2. **Money as strings end-to-end** — DB `NUMERIC(15,2)` → Drizzle returns `string` → `decimal.js` arithmetic → API JSON `string` → Frontend `NairaDisplay`. NEVER use JavaScript `Number` or `parseFloat()` on money values.

3. **Batch balance for search results** — Do NOT call Story 2.5's balance service N times (one per loan). Instead, run a single aggregation query on `ledger_entries` grouped by `loan_id` for all loans in the current page, then compute balance in-memory with `decimal.js`:
   ```typescript
   // Single query for all loans in page
   const sums = await db
     .select({
       loanId: ledgerEntries.loanId,
       totalPaid: sql<string>`COALESCE(SUM(${ledgerEntries.amount}), '0.00')`,
       installments: sql<number>`COUNT(*) FILTER (WHERE ${ledgerEntries.entryType} = 'PAYROLL')`,
     })
     .from(ledgerEntries)
     .where(inArray(ledgerEntries.loanId, loanIds))
     .groupBy(ledgerEntries.loanId);
   ```

4. **Detail endpoint uses full Story 2.5 balance** — Unlike the list view (which uses batch aggregation), the detail endpoint calls `computeBalanceFromEntries()` to get the complete `BalanceResult` including derivation chain, principal/interest breakdown.

5. **Detail endpoint includes repayment schedule** — Call `computeRepaymentSchedule()` from Story 2.3 with the loan's params to return the full schedule in the detail response.

### Existing Patterns to Follow

**Pagination** — Follow `userAdminService.listUsers()` exactly:
- Default page=1, pageSize=25
- Offset = (page - 1) * pageSize
- Two queries: `count()` + `select().limit().offset()`
- Response: `{ data, pagination: { page, pageSize, totalItems, totalPages } }`
- `totalPages = Math.ceil(totalItems / pageSize)`

**Search** — Follow `listUsers()` search pattern:
- `const term = \`%${filters.search}%\`;`
- `or(ilike(col1, term), ilike(col2, term), ...)`
- Case-insensitive via `ilike()`

**MDA Scoping** — Use `withMdaScope()` from `apps/server/src/lib/mdaScope.ts`:
```typescript
import { withMdaScope } from '../lib/mdaScope';
// In WHERE clause:
const conditions = [];
const mdaFilter = withMdaScope(loans.mdaId, mdaScope);
if (mdaFilter) conditions.push(mdaFilter);
```

**Middleware Stack** — Standard pattern from `userRoutes.ts`:
```typescript
const loanAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
];
```

**Express 5 Param Helper** — Extract params safely:
```typescript
const loanId = Array.isArray(req.params.loanId) ? req.params.loanId[0] : req.params.loanId;
```

**Query validation** — Parse query params with Zod in the route handler (not via body validate middleware, since these are query params):
```typescript
const parsed = searchLoansQuerySchema.safeParse(req.query);
if (!parsed.success) throw new AppError(400, 'VALIDATION_FAILED', VOCABULARY.VALIDATION_FAILED);
```

**Response envelope** — Always `{ success: true, data }` or `{ success: true, data, pagination }`.

### LoanStatus Type Alignment

The shared type `LoanStatus` in `packages/shared/src/types/loan.ts` currently has **lowercase** values (`'active'`, `'completed'`, etc.) but the DB enum `loanStatusEnum` in `schema.ts` uses **UPPERCASE** (`'ACTIVE'`, `'COMPLETED'`, etc.). Story 2.6 MUST update the shared type to match DB:

```typescript
export type LoanStatus = 'APPLIED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'TRANSFERRED' | 'WRITTEN_OFF';
```

Also update the existing mock data in `apps/client/src/mocks/loanDetail.ts` and `loanSearch.ts` to use UPPERCASE status values.

### Existing Infrastructure (Do NOT Recreate)

| Component | Location | Status |
|-----------|----------|--------|
| Loans table + indexes | `apps/server/src/db/schema.ts` | Exists (Story 2.1) |
| `scopeToMda` middleware | `apps/server/src/middleware/scopeToMda.ts` | Exists |
| `withMdaScope()` utility | `apps/server/src/lib/mdaScope.ts` | Exists |
| `authenticate` / `authorise` | `apps/server/src/middleware/` | Exists |
| `PaginatedResponse<T>` type | `packages/shared/src/types/auth.ts` | Exists |
| `ApiResponse<T>` type | `packages/shared/src/types/api.ts` | Exists |
| `PERMISSION_MATRIX['loans:read']` | `packages/shared/src/constants/permissions.ts` | Exists (all roles) |
| `AppError` class | `apps/server/src/lib/appError.ts` | Exists |
| `generateUuidv7()` | `apps/server/src/lib/uuidv7.ts` | Exists |
| `decimal.js ^10.5.0` | `apps/server/package.json` | Installed |
| `ledger_entries` table | `apps/server/src/db/schema.ts` | Story 2.2 creates |
| `computeRepaymentSchedule()` | `apps/server/src/services/computationEngine.ts` | Story 2.3 creates |
| `computeBalanceFromEntries()` | `apps/server/src/services/computationEngine.ts` | Story 2.5 creates |
| `balanceService` / `selectByLoan()` | `apps/server/src/services/balanceService.ts` | Story 2.5 creates |

### Dependencies on Prior Stories

- **Story 2.1** (loans + mdas tables, loan reference generation) — MUST be implemented first
- **Story 2.2** (ledger_entries table, `entryTypeEnum`) — needed for balance aggregation queries
- **Story 2.3** (`computeRepaymentSchedule()`, `ComputationParams`, `RepaymentSchedule` types) — needed for detail response
- **Story 2.5** (`computeBalanceFromEntries()`, `BalanceResult` type, `selectByLoanAsOf()`) — needed for detail balance; list balance uses batch aggregation instead

### Project Structure Notes

New files created by this story:
```
apps/server/src/
├── routes/loanRoutes.integration.test.ts   (NEW)
└── services/loanService.test.ts            (NEW)
```

Modified files (created in Story 2.1, expanded here):
```
apps/server/src/
├── routes/loanRoutes.ts                    (MODIFY — add GET /loans search route, upgrade GET /loans/:loanId to enriched detail)
├── services/loanService.ts                 (MODIFY — add searchLoans, getLoanDetail functions)
├── app.ts                                  (MODIFY — no change needed if 2.1 already registered loanRoutes)

packages/shared/src/
├── validators/loanSchemas.ts               (MODIFY — add searchLoansQuerySchema alongside existing createLoanSchema)
├── types/loan.ts                           (MODIFY — fix LoanStatus to UPPERCASE, add LoanDetail, expand LoanSearchResult)
├── constants/vocabulary.ts                 (MODIFY — add loan search entries)
└── index.ts                                (MODIFY — add exports)
```

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 2, Story 2.6]
- [Source: _bmad-output/planning-artifacts/prd.md — FR13, FR35 (partial), NFR-PERF-5]
- [Source: _bmad-output/planning-artifacts/architecture.md — API Patterns, Pagination, Response Envelope]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md — Loan Lookup Interaction, Search Bar, Table Patterns]
- [Source: apps/server/src/services/userAdminService.ts — listUsers() pagination pattern]
- [Source: apps/server/src/middleware/scopeToMda.ts — MDA scoping pattern]
- [Source: apps/server/src/lib/mdaScope.ts — withMdaScope() utility]
- [Source: apps/server/src/routes/userRoutes.ts — route middleware stack pattern]
- [Source: apps/server/src/db/schema.ts — loans table, loanStatusEnum, indexes]

## PM Validation Findings

**Validated:** 2026-02-24 | **Verdict:** Pass with 3 medium findings (all resolved inline) | **Blocking issues:** None remaining

1. **[MEDIUM — Resolved] Missing metadata header comments.** Story lacked the standard `<!-- Generated / Blocked By / FRs / Source -->` comments present in all other Epic 2 stories. **Fix applied:** Header added with dependency graph, FR tagging (FR13, FR35 partial), and source references.

2. **[MEDIUM — Resolved] File creation conflicts with Story 2.1.** Tasks 1.1, 3.1, and 5.1 said "Create" for `loanSchemas.ts`, `loanService.ts`, and `loanRoutes.ts` — all three already exist from Story 2.1. Project Structure listed them as "(NEW)". **Fix applied:** Tasks updated to "Add to existing" with Story 2.1 context. Project Structure corrected to "(MODIFY)".

3. **[MEDIUM — Resolved] `GET /loans/:loanId` endpoint overlap with Story 2.1.** Story 2.1 creates a basic `GET /loans/:id` returning raw loan data. Story 2.6 AC 2 significantly expands this to include computed balance, schedule, and ledger count. **Fix applied:** Task 5.1 now explicitly states this is an upgrade of the existing endpoint, not a new creation. Dev should replace the Story 2.1 handler with the enriched version.

4. **[LOW — Correctly Omitted] Epics AC 2 mentions "state transition history" in detail response.** Story correctly omits this because `loan_state_transitions` table is created in Story 2.7. Including it would create a circular dependency. Story 2.7 should add transition history to the detail endpoint after the table exists.

5. **[LOW — Partial FR35] `lastDeductionDate` and `computedRetirementDate` not in responses.** PRD FR35 includes these fields. `lastDeductionDate` could be derived from the most recent PAYROLL ledger entry — minor enhancement for a future pass. `computedRetirementDate` requires temporal profile fields (DOB, appointment date) deferred to later epics. Both omissions are reasonable for current scope.

6. **[LOW — Structural] Missing standard sections.** Story lacks "What NOT To Do" section, "Technical Stack" table, and Commit Summary template (present in all Stories 2.0-2.5). Key anti-patterns for dev: don't add a balance column, don't call balanceService N times for search results (use batch aggregation), don't implement state transitions (Story 2.7).

7. **[LOW — Resolved] FR14 in references section belongs to Story 2.7.** FR14 is "track loan lifecycle states" — not this story's scope. **Fix applied:** Removed from references.

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

### Completion Notes List

### Commit Summary

<!-- Convention: Fill this section when story reaches 'done' status -->
<!-- Format: Total commits | Files touched (new/modified) | Revert count | One-sentence narrative -->

### File List
