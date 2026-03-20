# Story 7.0a: Financial Precision Hardening

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **development team**,
I want all financial calculations and display functions to use decimal.js exclusively,
So that sub-kobo precision is guaranteed across every number in VLPRS with zero floating-point risk.

## Acceptance Criteria

### AC 1: parseFinancialNumber Uses Decimal.js-First Parsing

**Given** raw financial data from legacy Excel uploads (currency symbols, parenthetical negatives, dash/nil markers)
**When** `parseFinancialNumber()` processes the input
**Then** it constructs a `Decimal` instance internally for validation instead of regex, returns the cleaned string representation, and a new `parseFinancialNumberToDecimal()` variant returns `Decimal | null` directly for callers that need precision arithmetic

**And** all 22 existing `parseUtils.test.ts` tests (12 parseFinancialNumber + 10 isSummaryRowMarker) continue to pass unchanged
**And** the function signature `parseFinancialNumber(raw: unknown): string | null` remains backward-compatible

### AC 2: formatNaira and All Display Functions Use Decimal.js

**Given** a financial amount string (e.g., `"278602.72"`)
**When** any frontend display function formats it for UI rendering
**Then** the central `formatNaira()` in `formatters.ts` uses `new Decimal(amount)` instead of `parseFloat(amount)`, `formatCompactNaira()` uses Decimal for all arithmetic (division for B/M/K suffixes), and all 5 duplicate local `formatNaira`/`formatCurrency` implementations are replaced with imports from `@/lib/formatters`

**And** the server-side `pdfGenerator.tsx` local `formatNaira()` uses `new Decimal()` instead of `Number()`
**And** all 27 existing `formatters.test.ts` tests continue to pass unchanged

### AC 3: Quick-Win Sort Uses Actual Outstanding Balance

**Given** the "Quick-Win Opportunities" attention item card on the dashboard
**When** a user clicks through to the filtered loan list sorted by `outstanding-asc`
**Then** the list is sorted by computed outstanding balance (`MAX(0, totalLoan - totalPaid)`) instead of the `principalAmount` approximation
**And** the computed balance uses `Decimal` arithmetic consistent with `computeBalanceFromEntries()`

### AC 4: limitedComputation Loans Handled Without Crashes

**Given** a loan with `limitedComputation = true` and `principalAmount = "0.00"` (principal derivation failed during migration)
**When** any service calls balance computation, attention item detection, or repayment schedule generation
**Then** the system gracefully handles the zero-principal case instead of throwing `principalAmount must be a positive number`
**And** all balance computation callsites — including `beneficiaryLedgerService.ts` (whose existing formula is correct but should use the unified wrapper for consistency) and `migrationDashboardService.ts` (manual workaround) — route through `computeBalanceForLoan()` so that every balance computation follows one path
**And** the existing integration test (`limitedComputation loan — negative baseline entry`) continues to pass

## Dependencies

- **Depends on:** No story dependency — 7.0a is the first prep story and can start immediately after the mega-retro (2026-03-20)
- **Blocks:** All subsequent prep stories (7.0b → 7.0g) and all Epic 7 feature stories (7.1+). Per zero-debt-forward principle, no E7 feature work begins until all prep stories complete
- **Sequence:** 7.0a → 7.0b → 7.0c → 7.0d → 7.0e + 7.0f (parallel) → 7.0g → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: parseFinancialNumber Decimal.js Migration (AC: 1)
  - [x] 1.1 Add `parseFinancialNumberToDecimal(raw: unknown): Decimal | null` to `apps/server/src/migration/parseUtils.ts` — strips currency symbols, handles parenthetical negatives, dash/nil markers, then constructs `new Decimal(cleanedString)` with try/catch instead of regex validation
  - [x] 1.2 Refactor existing `parseFinancialNumber()` to delegate to `parseFinancialNumberToDecimal()` and return `d.toString()` — backward-compatible, no signature change
  - [x] 1.3 Add new test cases to `parseUtils.test.ts`: precision boundary tests (e.g., `"0.1 + 0.2"` equivalent strings), very large numbers (`"999999999999.99"`), scientific notation rejection (`"1e5"`), whitespace-only strings
  - [x] 1.4 Export `parseFinancialNumberToDecimal` from parseUtils.ts
  - [x] 1.5 Update callers in `migrationService.ts` that need Decimal precision to use `parseFinancialNumberToDecimal()` where beneficial (optional — existing callers work fine with string return)

- [x] Task 2: formatNaira Decimal.js Migration (AC: 2)
  - [x] 2.1 Add `decimal.js` to `apps/client/package.json` if not already present — verify with `pnpm ls decimal.js --filter @vlprs/client`
  - [x] 2.1a Add `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })` at the top of `apps/client/src/lib/formatters.ts` immediately after the `import Decimal from 'decimal.js'` statement — this ensures client-side Decimal config matches the server-side config in `computationEngine.ts` line 6. Must execute before any `new Decimal()` call in the module
  - [x] 2.2 Update `formatNaira()` in `apps/client/src/lib/formatters.ts`: replace `parseFloat(amount)` with `new Decimal(amount)`, use `.isNaN()` for NaN check, use `.abs()` and `.lt(0)` for negative detection, use `.toFixed(2)` then format with locale-style comma insertion
  - [x] 2.3 Update `formatCompactNaira()` in `apps/client/src/lib/formatters.ts`: replace `parseFloat(amount)` with `new Decimal(amount)`, use `.div()` for B/M/K division, use `.toFixed()` for decimal places — eliminate all floating-point arithmetic
  - [x] 2.4 Run existing `formatters.test.ts` (27 tests) — all must pass without modification
  - [x] 2.5 Remove duplicate `formatNaira()` from `IndividualTraceReport.tsx` (line 16-21) — replace with `import { formatNaira } from '@/lib/formatters'`
  - [x] 2.6 Remove duplicate `formatNaira()` from `ComputationTransparencyAccordion.tsx` (line 19-24) — replace with import
  - [x] 2.7 Remove duplicate `formatNaira()` from `StaffProfilePanel.tsx` (line 31-36) — replace with import
  - [x] 2.8 Remove duplicate `formatCurrency()` from `RecordComparisonRow.tsx` (line 19-24) — replace with `import { formatNaira } from '@/lib/formatters'` and rename callsites from `formatCurrency(...)` to `formatNaira(...)`
  - [x] 2.9 Update server-side `pdfGenerator.tsx` (line 284-288): replace `Number(value)` with `new Decimal(value)` in local `formatNaira()` function

- [x] Task 3: Quick-Win Sort — Actual Outstanding Balance (AC: 3)
  - [x] 3.1 In `apps/server/src/services/loanService.ts`, add `outstandingBalance` as a recognized sort option in the `SORT_COLUMNS` map — since this is a computed field (not a direct column), implement as application-level sort after query
  - [x] 3.2 When `sortBy === 'outstandingBalance'`: fetch loans with their ledger aggregation (already done in `searchLoans`), compute outstanding balance per loan using existing Decimal arithmetic (`MAX(0, totalLoan - totalPaid)`), sort the result array by computed balance before pagination slicing
  - [x] 3.3 Update `useFilteredLoans.ts` (line 30-33): change `params.set('sortBy', 'principalAmount')` to `params.set('sortBy', 'outstandingBalance')` for the `outstanding-asc` sort option
  - [x] 3.4 Add test in `loanService.test.ts`: verify that sorting by `outstandingBalance` returns loans ordered by computed balance, not by principal amount — create 3 loans with different principal/payment ratios to demonstrate the difference
  - [x] 3.5 Update `attentionItemService.ts` drill-down URL (line 326): verify it still works with the new sort field — URL already uses `sort=outstanding-asc` which maps to the frontend hook

- [x] Task 4: limitedComputation Guard Implementation (AC: 4)
  - [x] 4.1 Add `computeBalanceForLoan()` wrapper function to `apps/server/src/services/computationEngine.ts` that checks `limitedComputation` flag before calling `computeBalanceFromEntries()`:
    - If `limitedComputation === true`: compute balance using manual Decimal arithmetic (`MAX(0, totalLoan - totalPaid)` where totalLoan = principal + interest, totalPaid = sum of entries). For the `BalanceResult` shape, use these field values since principal/interest split is unknown for zero-principal loans: `computedBalance` = computed outstanding, `totalAmountPaid` = sum of positive entries, `totalPrincipalPaid` = `"0.00"` (unknown split), `totalInterestPaid` = `"0.00"` (unknown split), `principalRemaining` = `"0.00"` (unknown split), `interestRemaining` = computedBalance (attribute entire outstanding to interest as conservative default), `entryCount` = count of entries, `derivation` = `"limited-computation"`
    - If `limitedComputation === false`: delegate to existing `computeBalanceFromEntries()`
    - Return the same `BalanceResult` shape in both paths
  - [x] 4.2 Update `balanceService.ts` to use `computeBalanceForLoan()` wrapper instead of calling `computeBalanceFromEntries()` directly — pass the loan's `limitedComputation` flag
  - [x] 4.3 Update `attentionItemService.ts` (lines 292, 460) to use `computeBalanceForLoan()` wrapper — zero-principal loans get balance computed without throwing
  - [x] 4.4 Replace balance computation in `beneficiaryLedgerService.ts` (line 130-131) with call to `computeBalanceForLoan()` — note: the existing formula here is correct (standard `totalLoan - totalPaid` works due to negative baseline entries), but we replace it for consistency so that all balance computation flows through the unified wrapper. Remove the inline comment explaining why the flag isn't needed — the wrapper now handles that concern
  - [x] 4.5 Replace manual workaround in `migrationDashboardService.ts` (line 179-181, 210-217) with call to `computeBalanceForLoan()` — remove workaround comments
  - [x] 4.6 Add tests to `computationEngine.test.ts`:
    - Test: `computeBalanceForLoan` with `limitedComputation=true, principalAmount="0.00"` returns correct balance from entries
    - Test: `computeBalanceForLoan` with `limitedComputation=false` delegates to `computeBalanceFromEntries` (same result)
    - Test: zero-principal loan with negative MIGRATION_BASELINE entry computes positive outstanding balance
  - [x] 4.7 Verify existing integration test passes: `migrationDashboard.integration.test.ts` line 488 — `limitedComputation loan — negative baseline entry` should still return `totalExposure: "20000.00"`

- [x] Task 5: Verify & Run Full Test Suite (AC: 1, 2, 3, 4)
  - [x] 5.1 Run `pnpm typecheck` — zero type errors
  - [x] 5.2 Run `pnpm lint` — zero lint errors
  - [x] 5.3 Run server tests: `pnpm --filter @vlprs/server test` — all 1,215 tests pass (29 new)
  - [x] 5.4 Run client tests: `pnpm --filter @vlprs/client test` — all 585 tests pass
  - [x] 5.5 Verify zero regressions — no existing test should break from these changes

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] formatNaira null-handling behavioral regression — local duplicates returned '—' for null, central returns '₦0.00'. Fix: add `formatNairaOrDash()` helper in formatters.ts and use it in ComputationTransparencyAccordion, StaffProfilePanel, RecordComparisonRow [formatters.ts, 3 components]
- [x] [AI-Review][MEDIUM] No performance documentation on `outstandingBalance` sort — app-level sort fetches all matching rows. Fix: added performance comment documenting bounded analysis (~200 max per MDA) + safe fallback in else branch for unknown sort keys [loanService.ts:300]
- [x] [AI-Review][MEDIUM] `searchLoans()` inline balance computation bypasses `computeBalanceForLoan()` wrapper — violates single-path mandate (AC 4). Fix: route through wrapper [loanService.ts:402-408]
- [x] [AI-Review][MEDIUM] `apps/server/package.json` modified (decimal.js ^10.5.0→^10.6.0) but not in story File List. Fix: add to File List
- [x] [AI-Review][LOW] AC 2 claims "31 existing formatters.test.ts tests" but only 27 exist. Fix: correct count in AC and Task 2.4
- [x] [AI-Review][LOW] `computeBalanceForLoan` aggregated path returns misleading `totalPrincipalPaid: '0.00'` for non-limited loans. Fix: add clarifying comment [computationEngine.ts:315-318]

## Dev Notes

### Technical Requirements

#### Item #4: parseFinancialNumber — Decimal.js-First Parsing

**Current implementation:** `apps/server/src/migration/parseUtils.ts` (lines 8-41)
- Strips currency symbols (`₦`, `$`, `NGN`, commas)
- Handles parenthetical negatives: `(1,759.56)` → `-1759.56`
- Converts dash/nil markers to `'0'`
- Validates with regex: `/^-?\d+(\.\d+)?$/`
- Returns `string | null`

**Problem:** Regex validation is disconnected from decimal.js — callers must construct `new Decimal(result)` manually, losing the opportunity for early precision validation. The regex also doesn't catch edge cases like scientific notation strings.

**Migration approach:**
1. Add `parseFinancialNumberToDecimal()` that performs the same cleanup but validates via `new Decimal(s)` construction (try/catch) instead of regex
2. Refactor `parseFinancialNumber()` to call the new function and return `.toString()` — zero breaking changes
3. The string-cleanup steps (strip symbols, handle parens, nil markers) remain identical — only the final validation step changes

**Callers (production):**
- `migrationService.ts:13,55,384,390` — migration upload confirmation pipeline
- `migration-regression.test.ts:8,128,131,158` — regression fixture tests
- `parseUtils.test.ts` — 22 direct unit tests (12 parseFinancialNumber + 10 isSummaryRowMarker)

**Callers (legacy-report — separate codebase, DO NOT modify):**
- `scripts/legacy-report/utils/number-parse.ts` — duplicate implementation
- `scripts/legacy-report/car-loan-parse.ts:15,213-220`
- `scripts/legacy-report/analyze.ts:23,270,275`

**DO NOT touch `scripts/legacy-report/`** — that's a standalone analysis pipeline with its own `CLAUDE.md`.

#### Item #6: formatNaira — Decimal.js for Frontend Display

**Current implementation:** `apps/client/src/lib/formatters.ts` (lines 7-25, 31-54)
- `formatNaira()`: uses `parseFloat(amount)` → JavaScript floating-point
- `formatCompactNaira()`: uses `parseFloat(amount)` + floating-point division for B/M/K

**5 duplicate local implementations using `Number()` instead of the central function:**

| File | Lines | Function Name |
|------|-------|---------------|
| `IndividualTraceReport.tsx` | 16-21 | `formatNaira` (local) |
| `ComputationTransparencyAccordion.tsx` | 19-24 | `formatNaira` (local) |
| `StaffProfilePanel.tsx` | 31-36 | `formatNaira` (local) |
| `RecordComparisonRow.tsx` | 19-24 | `formatCurrency` (local) |
| `pdfGenerator.tsx` (server) | 284-288 | `formatNaira` (local) |

**Correct reference pattern:** `comparisonEngine.ts:15-20` — `formatNairaText()` already uses `new Decimal(amount)`.

**Migration approach for `formatNaira()`:**
```typescript
import Decimal from 'decimal.js';

export function formatNaira(amount: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return '₦0.00';

  let d: Decimal;
  try {
    d = new Decimal(amount);
  } catch {
    return '₦0.00';
  }

  const isNegative = d.lt(0);
  const abs = d.abs();
  const [whole, frac = '00'] = abs.toFixed(2).split('.');
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return isNegative ? `-₦${formatted}.${frac}` : `₦${formatted}.${frac}`;
}
```

**Migration approach for `formatCompactNaira()`:**
```typescript
export function formatCompactNaira(amount: string): string {
  if (!amount) return '₦0';

  let d: Decimal;
  try {
    d = new Decimal(amount);
  } catch {
    return '₦0';
  }

  const abs = d.abs();
  const sign = d.lt(0) ? '-' : '';
  const billion = new Decimal('1000000000');
  const million = new Decimal('1000000');
  const thousand = new Decimal('1000');

  if (abs.gte(billion)) {
    const val = abs.div(billion);
    return `${sign}₦${val.mod(1).eq(0) ? val.toFixed(0) : val.toFixed(2).replace(/0+$/, '')}B`;
  }
  if (abs.gte(million)) {
    const val = abs.div(million);
    return `${sign}₦${val.mod(1).eq(0) ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (abs.gte(thousand)) {
    const val = abs.div(thousand);
    return `${sign}₦${val.mod(1).eq(0) ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}K`;
  }

  return `${sign}₦${abs.toFixed(0)}`;
}
```

**Consolidation:** After updating the central functions, remove all 4 client-side duplicates and replace with `import { formatNaira } from '@/lib/formatters'`. For `RecordComparisonRow.tsx`, rename `formatCurrency(...)` calls to `formatNaira(...)`.

**Note on NairaDisplay component:** `apps/client/src/components/shared/NairaDisplay.tsx` calls `formatNaira()` and `formatCompactNaira()` — once the central functions are updated, NairaDisplay benefits automatically with zero changes.

**Note on locale differences:** Some local duplicates use `'en-NG'` locale while the central function uses `'en-US'`. Both produce identical output for number formatting (commas as thousands separators, period as decimal). The Decimal.js migration removes `toLocaleString()` entirely in favor of manual comma insertion (matching `formatNairaText()` pattern), making this moot.

#### Item #12: Quick-Win Sort — Outstanding Balance

**Current approximation:**
- Frontend (`useFilteredLoans.ts:30-33`): maps `outstanding-asc` to `sortBy=principalAmount`
- Backend (`loanService.ts:203-209`): `SORT_COLUMNS` maps `principalAmount` to `loans.principalAmount` column
- `attentionItemService.ts:326`: drill-down URL uses `sort=outstanding-asc`

**Why it's wrong:** `principalAmount` is the original loan amount at origination. Outstanding balance is `MAX(0, (principal + interest) - totalPaid)`. A loan with large principal but many payments has lower outstanding balance than a newer loan with small principal.

**Correct approach:** The `searchLoans()` function (loanService.ts:395-422) already computes outstanding balance per loan using Decimal arithmetic:
```typescript
const totalLoan = principal.plus(totalInterest);
const outstandingBalance = Decimal.max(new Decimal('0'), totalLoan.minus(totalPaid));
```

**Implementation:** Since outstanding balance is computed (not a column), sorting must happen in-application after the balance computation. When `sortBy === 'outstandingBalance'`:
1. Fetch all matching loans (with balance computation as currently done)
2. Sort the result array by computed `outstandingBalance` using `Decimal` comparison
3. Apply pagination slicing after sort

**Performance consideration:** The `searchLoans` query already joins ledger entries and computes balances for all returned loans. Adding an application-level sort is O(n log n) on the result set. For the "quick-win" filter, n is typically small (loans close to payoff). **Upper bound:** The largest MDA has ~200 loans; with "quick-win" filter applied, n is expected to be <50. The `outstandingBalance` sort option should only apply when the quick-win classification filter is active — if no classification filter is set, fall back to the existing column-based sort to avoid full-table application-level sorting.

#### Item #24: limitedComputation — Zero-Principal Loan Handling

**Current state:**
- Flag is defined: `schema.ts:128` — `limitedComputation: boolean('limited_computation')`
- Flag is SET: `baselineService.ts:147` — `limitedComputation = principalAmount === '0.00'`
- Flag is IGNORED by 3 functions that throw on principal ≤ 0:
  - `computeBalanceFromEntries()` — throws `principalAmount must be a positive number`
  - `autoSplitDeduction()` — throws same
  - `computeRepaymentSchedule()` — throws same
- 2 inline balance computations exist outside `computationEngine.ts`:
  - `beneficiaryLedgerService.ts:130-131` — inline Decimal balance computation (note: this formula is actually correct because negative MIGRATION_BASELINE entries make `totalLoan - totalPaid` self-consistent, but it should use the unified wrapper for consistency)
  - `migrationDashboardService.ts:179-181` — same inline approach (true workaround to avoid the `computeBalanceFromEntries` throw)

**Why zero-principal loans exist:** During migration, some legacy Excel records have no discernible principal amount (not in any column, can't derive from total loan or monthly deduction). Baseline service falls back to `"0.00"` and sets `limitedComputation = true`.

**How the negative baseline trick works:**
- `baselineAmount = totalLoan - declaredOutstanding = 0 - 20000 = -20000` (negative entry)
- `balance = totalLoan - SUM(entries) = 0 - (-20000) = 20000` (correct positive balance)

**Solution: `computeBalanceForLoan()` wrapper**
- New function in `computationEngine.ts` that checks `limitedComputation` before calling `computeBalanceFromEntries()`
- If `true`: compute balance manually using the negative-entry Decimal approach
- If `false`: delegate to existing function unchanged
- Returns same `BalanceResult` shape for uniform API
- Replace both inline computations (one correct-but-inconsistent in beneficiaryLedgerService, one true workaround in migrationDashboardService) + protect `balanceService` and `attentionItemService`

### Architecture Compliance

- **Financial arithmetic mandate:** "Put ALL financial arithmetic in `computationEngine.ts` using `decimal.js`" — this story enforces this mandate across the remaining gaps
- **Decimal.js configuration:** `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })` — already set in `computationEngine.ts`, ensure client-side uses same config
- **Money as strings:** All financial values in types are `string` (never `number`). PostgreSQL `NUMERIC(15,2)` → Decimal.js → API returns `"123.45"` (string)
- **API envelope:** No API changes in this story — all changes are internal computation/display
- **Non-punitive vocabulary:** No user-facing text changes in this story (display format stays identical)
- **Audit trail:** No audit-logged actions change — this is internal precision hardening

### Library & Framework Requirements

- **decimal.js** `^10.5.0`: Already in `apps/server/package.json`. Must be added to `apps/client/package.json` for frontend `formatNaira`/`formatCompactNaira` migration
- **Vitest** `^3.2.1`: Test runner — co-located `.test.ts` files
- **No new dependencies** beyond adding decimal.js to client package

### File Structure Requirements

#### Modified Files

```
apps/server/src/
├── migration/parseUtils.ts                    ← MODIFY: add parseFinancialNumberToDecimal(), refactor parseFinancialNumber() to delegate
├── migration/parseUtils.test.ts               ← MODIFY: add precision boundary tests, scientific notation rejection test
├── services/computationEngine.ts              ← MODIFY: add computeBalanceForLoan() wrapper
├── services/computationEngine.test.ts         ← MODIFY: add computeBalanceForLoan tests (limitedComputation=true/false)
├── services/loanService.ts                    ← MODIFY: add outstandingBalance sort option, application-level sort
├── services/loanService.test.ts               ← MODIFY: add outstandingBalance sort test
├── services/balanceService.ts                 ← MODIFY: use computeBalanceForLoan() wrapper
├── services/attentionItemService.ts           ← MODIFY: use computeBalanceForLoan() wrapper
├── services/beneficiaryLedgerService.ts       ← MODIFY: replace manual workaround with computeBalanceForLoan()
├── services/migrationDashboardService.ts      ← MODIFY: replace manual workaround with computeBalanceForLoan()
└── services/pdfGenerator.tsx                  ← MODIFY: replace Number() with new Decimal() in local formatNaira

apps/client/
├── package.json                               ← MODIFY: add decimal.js dependency
├── src/lib/formatters.ts                      ← MODIFY: replace parseFloat with Decimal in formatNaira + formatCompactNaira
├── src/hooks/useFilteredLoans.ts              ← MODIFY: change sortBy from 'principalAmount' to 'outstandingBalance'
└── src/pages/dashboard/components/
    ├── IndividualTraceReport.tsx               ← MODIFY: remove local formatNaira, import from @/lib/formatters
    ├── ComputationTransparencyAccordion.tsx    ← MODIFY: remove local formatNaira, import from @/lib/formatters
    ├── StaffProfilePanel.tsx                   ← MODIFY: remove local formatNaira, import from @/lib/formatters
    └── RecordComparisonRow.tsx                 ← MODIFY: remove local formatCurrency, import formatNaira from @/lib/formatters
```

#### No New Files

This story modifies existing files only — no new files, no new database migrations, no new API endpoints.

### Testing Requirements

- **Co-locate tests:** All test files next to source files
- **parseUtils.test.ts:** Add 4+ new tests for Decimal-specific edge cases (precision boundaries, scientific notation, very large numbers, whitespace-only)
- **formatters.test.ts:** Existing 31 tests must pass — no modifications needed (function signatures unchanged)
- **computationEngine.test.ts:** Add 3+ tests for `computeBalanceForLoan()` (limitedComputation true/false, negative baseline entry)
- **loanService.test.ts:** Add 1+ test for outstanding balance sort ordering
- **Integration tests:** Existing `migrationDashboard.integration.test.ts` limitedComputation test must pass unchanged
- **Full suite:** All 1,186+ server tests + 585+ client tests must pass with zero regressions

### Previous Story Intelligence

#### From Story 11.4 (MDA Historical Data Upload — Last Completed)

- **Decimal precision pattern:** `crossValidateAgainstBaseline()` uses `new Decimal(row.amountDeducted)` for comparison — consistent with target pattern
- **MINOR_VARIANCE_THRESHOLD:** Exported from `comparisonEngine.ts` as `new Decimal('500')` — single source of truth pattern working correctly
- **Test count:** Server: 1,186 tests, Client: 585 tests — baseline for regression check
- **Express 5 param() helper:** Already retrofitted to E11 endpoints (will be done comprehensively in Story 7.0b)

#### From Mega-Retro Team Agreements (Apply to This Story)

1. **File list verification** — code review checklist item. Dev notes must include accurate modified file list
2. **Zero-debt-forward** — this IS the debt resolution story
3. **Red-green review check** — reviewer verifies tests fail when implementation removed
4. **Transaction scope documentation** — N/A (no DB writes in this story)
5. **N+1 query budget** — Task 3 (quick-win sort) must not add N+1 queries

### Git Intelligence

**Recent commit pattern:** `feat: Story 11.4 — MDA Historical Data Upload with code review fixes`
**Expected commit:** `feat: Story 7.0a — Financial Precision Hardening with code review fixes`
**Fix commits:** Separate `fix:` commits for any post-review adjustments

### Critical Warnings

1. **DO NOT modify `scripts/legacy-report/`** — the duplicate `parseFinancialNumber` in `scripts/legacy-report/utils/number-parse.ts` is in a separate standalone pipeline with its own CLAUDE.md. Only modify the production version in `apps/server/src/migration/parseUtils.ts`
2. **decimal.js client dependency:** Must be added to `apps/client/package.json`, not just server. Run `pnpm add decimal.js --filter @vlprs/client` or add manually and run `pnpm install`
3. **Decimal.js configuration on client:** Ensure `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })` is called before any formatting — add to top of `formatters.ts` or create a shared config
4. **formatNaira signature unchanged:** `formatNaira(amount: string | null | undefined): string` — all callers must work without modification. The Decimal migration is internal only
5. **Quick-win sort is application-level:** Cannot use SQL `ORDER BY` for computed outstanding balance. Sort in application code AFTER balance computation, BEFORE pagination slicing. Ensure pagination offset/limit is applied after sort
6. **computeBalanceForLoan wrapper must return BalanceResult:** Same shape as `computeBalanceFromEntries()` to be a drop-in replacement. Include all fields: `computedBalance`, `totalPrincipalPaid`, `totalInterestPaid`, `totalAmountPaid`, `principalRemaining`, `interestRemaining`, `entryCount`, `derivation`
7. **Do not modify computeBalanceFromEntries validation:** Keep the `principal.lte(0)` throw — it correctly guards against invalid data. The wrapper routes around it for known zero-principal loans only
8. **Test determinism:** Decimal.js tests must verify determinism — same inputs always produce identical outputs
9. **No locale dependency:** The Decimal.js migration removes `toLocaleString()` calls. Use manual comma insertion pattern from `comparisonEngine.ts:formatNairaText()` to avoid locale-dependent behavior in CI

### Project Structure Notes

- This story touches 3 layers (shared migration utils → server services → client display) but makes no schema changes, no API changes, and no new endpoints
- The `computeBalanceForLoan()` wrapper follows the existing architectural pattern of wrapping low-level computation functions with business-logic-aware helpers (like `transitionLoan` with optional `existingTx`)
- Consolidating 5 duplicate `formatNaira` implementations into one central function follows the DRY principle and ensures future precision fixes propagate automatically
- The quick-win sort fix requires understanding that `searchLoans()` already computes outstanding balance — the sort just needs to use the already-computed value

### References

- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Tech Debt Inventory] — Items #4, #6, #12, #24 definitions and origins
- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0a] — User story, 4 items, theme statement
- [Source: _bmad-output/planning-artifacts/architecture.md § Constraint #4] — No floating point for money
- [Source: _bmad-output/planning-artifacts/architecture.md § Line 766] — "Put ALL financial arithmetic in computationEngine.ts using decimal.js"
- [Source: _bmad-output/planning-artifacts/architecture.md § Line 259] — Drizzle NUMERIC→string pattern
- [Source: _bmad-output/planning-artifacts/architecture.md § Lines 612-617] — Money format specification
- [Source: apps/server/src/migration/parseUtils.ts § lines 8-41] — Current parseFinancialNumber implementation
- [Source: apps/server/src/migration/parseUtils.test.ts] — 22 existing test cases (12 parseFinancialNumber + 10 isSummaryRowMarker)
- [Source: apps/client/src/lib/formatters.ts § lines 7-54] — formatNaira + formatCompactNaira implementations
- [Source: apps/client/src/lib/formatters.test.ts] — 31 existing test cases
- [Source: apps/client/src/components/shared/NairaDisplay.tsx] — Display component wrapping formatNaira
- [Source: apps/server/src/services/comparisonEngine.ts § lines 15-20] — formatNairaText (correct Decimal.js pattern)
- [Source: apps/server/src/services/loanService.ts § lines 203-209] — SORT_COLUMNS map (principalAmount approximation)
- [Source: apps/server/src/services/loanService.ts § lines 395-422] — searchLoans balance computation
- [Source: apps/client/src/hooks/useFilteredLoans.ts § lines 30-33] — outstanding-asc sort mapping
- [Source: apps/server/src/services/attentionItemService.ts § line 326] — Quick-win drill-down URL
- [Source: apps/server/src/services/computationEngine.ts § lines 1-6] — Decimal.set configuration
- [Source: apps/server/src/services/computationEngine.ts § ~line 750] — computeBalanceFromEntries zero-principal throw
- [Source: apps/server/src/db/schema.ts § line 128] — limitedComputation column definition
- [Source: apps/server/src/services/baselineService.ts § line 147] — limitedComputation flag setting
- [Source: apps/server/src/services/beneficiaryLedgerService.ts § lines 130-131] — Manual workaround for zero-principal
- [Source: apps/server/src/services/migrationDashboardService.ts § lines 179-181] — Manual workaround for zero-principal
- [Source: apps/server/src/services/migrationDashboard.integration.test.ts § lines 488-497] — limitedComputation test

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- parseFinancialNumber: Decimal.toString() strips trailing zeros (e.g., '1500.00' → '1500'). Fixed by using shared internal helper that preserves the cleaned string for backward compatibility while returning Decimal for the new variant.
- loanService.ts: TypeScript couldn't narrow sortBy through a boolean variable — used `as keyof typeof SORT_COLUMNS` cast in the else branch.
- balanceService.ts: Refactored to query loans table directly (instead of via getLoanById) to access limitedComputation flag without changing the Loan API type.

### Completion Notes List

- Task 1: Added `parseFinancialNumberToDecimal()` returning `Decimal | null`. Shared internal `parseFinancialRaw()` helper ensures both functions use identical cleanup logic. Rejects scientific notation via `/[eE]/` guard. 25 tests pass (22 existing + 3 new groups).
- Task 2: Migrated `formatNaira()` and `formatCompactNaira()` to Decimal.js with manual comma insertion (no locale dependency). Removed 4 client-side duplicates, replaced with imports. Updated server pdfGenerator.tsx. All 27 formatter tests pass unchanged.
- Task 3: Added `outstandingBalance` as application-level sort in `searchLoans()`. When active, fetches all matching rows, computes balances, sorts by Decimal comparison, then slices for pagination. Updated Zod schema and frontend hook. Quick-win drill-down URL unchanged.
- Task 4: Created `computeBalanceForLoan()` wrapper with overloaded signatures — entries path (for balanceService/attentionItemService) and aggregated totalPaid path (for beneficiaryLedgerService/migrationDashboardService). All 5 balance computation callsites now route through the unified wrapper. limitedComputation loans with zero principal no longer throw.
- Task 5: typecheck clean, lint clean (0 errors, 15 pre-existing warnings in unrelated file), 1,215 server tests pass, 585 client tests pass, zero regressions.

### File List

**Server (apps/server/)**
- package.json — MODIFIED: bumped decimal.js ^10.5.0 → ^10.6.0
- src/migration/parseUtils.ts — MODIFIED: added parseFinancialNumberToDecimal(), refactored parseFinancialNumber() to delegate via shared parseFinancialRaw()
- migration/parseUtils.test.ts — MODIFIED: added 3 new test groups (scientific notation, precision, Decimal variant)
- services/computationEngine.ts — MODIFIED: added computeBalanceForLoan() wrapper with entries and aggregated overloads
- services/computationEngine.test.ts — MODIFIED: added 3 tests for computeBalanceForLoan
- services/loanService.ts — MODIFIED: added outstandingBalance sort option with application-level sort
- services/loanService.test.ts — MODIFIED: added outstandingBalance sort test
- services/balanceService.ts — MODIFIED: refactored to use computeBalanceForLoan() with limitedComputation flag
- services/attentionItemService.ts — MODIFIED: updated 2 callsites + queries to use computeBalanceForLoan()
- services/beneficiaryLedgerService.ts — MODIFIED: replaced 3 inline balance computations with computeBalanceForLoan()
- services/migrationDashboardService.ts — MODIFIED: replaced inline balance computation with computeBalanceForLoan()
- services/pdfGenerator.tsx — MODIFIED: replaced Number() with Decimal in local formatNaira()

**Client (apps/client/)**
- package.json — MODIFIED: added decimal.js dependency
- src/lib/formatters.ts — MODIFIED: migrated formatNaira() and formatCompactNaira() to Decimal.js; added formatNairaOrDash() for nullable UI contexts
- src/hooks/useFilteredLoans.ts — MODIFIED: changed sortBy from 'principalAmount' to 'outstandingBalance'
- src/pages/dashboard/components/IndividualTraceReport.tsx — MODIFIED: removed local formatNaira, import from @/lib/formatters
- src/pages/dashboard/components/ComputationTransparencyAccordion.tsx — MODIFIED: removed local formatNaira, import formatNairaOrDash from @/lib/formatters for nullable fields
- src/pages/dashboard/components/StaffProfilePanel.tsx — MODIFIED: removed local formatNaira, import formatNairaOrDash from @/lib/formatters for nullable fields
- src/pages/dashboard/components/RecordComparisonRow.tsx — MODIFIED: removed local formatCurrency, import formatNaira + formatNairaOrDash from @/lib/formatters

**Shared (packages/shared/)**
- src/validators/loanSchemas.ts — MODIFIED: added 'outstandingBalance' to searchLoansQuerySchema sortBy enum

### Change Log

- 2026-03-20: Story 7.0a implemented — Financial Precision Hardening. All 4 ACs satisfied: parseFinancialNumber uses Decimal.js validation, formatNaira/formatCompactNaira use Decimal.js arithmetic, quick-win sort uses computed outstanding balance, limitedComputation loans handled via unified computeBalanceForLoan() wrapper. 1,215 server + 585 client tests pass.
- 2026-03-20: Code review (AI) — 6 findings (1 HIGH, 3 MEDIUM, 2 LOW), all fixed. HIGH: formatNaira null→'₦0.00' regression fixed via formatNairaOrDash(). MEDIUM: searchLoans inline balance routed through computeBalanceForLoan() wrapper; outstandingBalance sort documented with bounded performance analysis + safe fallback; server/package.json added to File List. LOW: AC test count corrected (31→27); computeBalanceForLoan aggregated path split fields documented.
