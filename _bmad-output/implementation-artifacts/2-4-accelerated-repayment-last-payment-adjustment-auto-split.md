# Story 2.4: Accelerated Repayment, Last-Payment Adjustment & Auto-Split

Status: ready-for-dev

<!-- Generated: 2026-02-24 | Epic: 2 | Sprint: 3 -->
<!-- Blocked By: 2-3 (base computation engine) | Blocks: 2-5, 2-7, 3-2, Epic 5, Epic 8, Epic 12 -->
<!-- FRs: FR3, FR4, FR5 | Motivation: All computation edge cases resolved, every loan closes at exactly ₦0.00 -->
<!-- Source: epics.md → Epic 2, Story 2.4 | architecture.md → Computation Engine | prd.md → FR3-FR5 -->

## Story

As a **Department Admin**,
I want the system to handle accelerated repayment, absorb rounding in the final payment, and auto-split deductions,
So that all computation edge cases are covered and every loan balances to exactly zero.

### Context

Story 2.3 builds the base computation engine with uniform monthly payments and a known rounding residual (< ₦1.00). This story closes the residual by adding last-payment adjustment, extends the engine to handle accelerated (shortened-tenure) schedules, and adds auto-split to decompose any externally-provided deduction into principal and interest. After this story, the computation engine is complete — all downstream features (balance reconstruction, migration validation, submission comparison, early exit payoff) depend on exact ₦0.00 closure.

## Acceptance Criteria

### AC 1: Accelerated Repayment Schedule

**Given** a loan with original 60-month tenure shortened to 45 months
**When** the accelerated schedule is computed
**Then** monthly deductions are recalculated for the shorter tenure with correct principal/interest split (FR3)
**And** total interest remains unchanged (flat-rate: `principal × rate / 100`)
**And** the schedule closes at exactly ₦0.00 via last-payment adjustment

### AC 2: Last-Payment Adjustment

**Given** accumulated rounding differences across monthly installments
**When** the final installment is computed
**Then** the last-payment adjustment method absorbs all rounding — the final payment equals the exact remaining balance so the loan closes at exactly ₦0.00 (FR4)
**And** the final row's `principalComponent` and `interestComponent` absorb their respective residuals independently

### AC 3: Auto-Split Deduction

**Given** a monthly deduction amount
**When** the system processes a deduction
**Then** it auto-splits the amount into principal and interest components based on the flat-rate schedule ratio (FR5)
**And** `principalComponent + interestComponent` equals the input deduction exactly (no rounding mismatch)

### AC 4: Hand-Verified Test Suite

**Given** a test suite of hand-verified calculations for all 4 tiers
**When** the computation engine is run against the test suite
**Then** every output matches the hand-verified result to the kobo (₦0.01 precision)
**And** the suite includes accelerated tenure scenarios from the Sports Council CSV (30, 40, 48, 50-month tenures)

## Tasks / Subtasks

- [ ] Task 1: Enhance `computeRepaymentSchedule()` with last-payment adjustment (AC: 2)
  - [ ] 1.1 Modify the schedule loop in `apps/server/src/services/computationEngine.ts`
  - [ ] 1.2 On the final active month, replace uniform deduction with exact remaining balance
  - [ ] 1.3 Split final principal residual and interest residual independently
  - [ ] 1.4 Assert `runningBalance` of final row is `'0.00'`
- [ ] Task 2: Add `autoSplitDeduction()` function (AC: 3)
  - [ ] 2.1 Add function to `computationEngine.ts`
  - [ ] 2.2 Compute flat-rate ratio: `principalRatio = monthlyPrincipal / monthlyDeduction`
  - [ ] 2.3 Apply ratio to any deduction amount, ensure principal + interest = deduction exactly
- [ ] Task 3: Add shared types for auto-split (AC: 3)
  - [ ] 3.1 Add `AutoSplitResult` interface to `packages/shared/src/types/computation.ts`
  - [ ] 3.2 Export from `packages/shared/src/index.ts`
- [ ] Task 4: Unit tests — last-payment adjustment (AC: 2, 4)
  - [ ] 4.1 Test: all 4 tier standard schedules (250K/450K/600K/750K, 60 months) close at exactly ₦0.00
  - [ ] 4.2 Test: final row's `principalComponent + interestComponent = totalDeduction`
  - [ ] 4.3 Test: all non-final rows unchanged from Story 2.3 uniform values
  - [ ] 4.4 Test: rounding residual verification — `|finalDeduction - uniformDeduction| < ₦1.00`
- [ ] Task 5: Unit tests — accelerated repayment (AC: 1, 4)
  - [ ] 5.1 Test: 60→45 month acceleration produces correct higher monthly payments
  - [ ] 5.2 Test: total interest unchanged between 60-month and 45-month schedules (same principal × rate)
  - [ ] 5.3 Test: accelerated schedule closes at exactly ₦0.00
  - [ ] 5.4 Test: CSV fixture accelerated loans — records #8 (450K/50mo), #15 (750K/50mo), #17 (750K/48mo), #20 (600K/30mo), #21 (450K/40mo)
- [ ] Task 6: Unit tests — auto-split (AC: 3, 4)
  - [ ] 6.1 Test: standard deduction → split matches schedule's monthlyPrincipal + monthlyInterest
  - [ ] 6.2 Test: non-standard deduction (₦0.01 more) → principal + interest = deduction exactly
  - [ ] 6.3 Test: non-standard deduction (₦0.01 less) → principal + interest = deduction exactly
  - [ ] 6.4 Test: all 4 tiers × standard + non-standard amounts
- [ ] Task 7: Update schedule API to support what-if tenure (AC: 1)
  - [ ] 7.1 Add optional `?tenureMonths=N` query parameter to `GET /api/loans/:loanId/schedule`
  - [ ] 7.2 If provided, compute schedule with overridden tenure (what-if preview, does not modify loan)
  - [ ] 7.3 Response includes both original and what-if params for comparison

## Dev Notes

### Critical Context — Three Enhancements to One Engine

Story 2.4 modifies/extends the computation engine created in Story 2.3. All three features live in `apps/server/src/services/computationEngine.ts`:

1. **Last-payment adjustment** — modifies `computeRepaymentSchedule()` to adjust the final month
2. **Accelerated repayment** — no new function needed; `computeRepaymentSchedule()` already handles any tenure. Tests validate shortened-tenure scenarios specifically.
3. **Auto-split** — new `autoSplitDeduction()` function

### What Already Exists (from Story 2.3)

**`computeRepaymentSchedule(params)` — Story 2.3 implementation:**
```typescript
import Decimal from 'decimal.js';
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function computeRepaymentSchedule(params: ComputationParams): RepaymentSchedule {
  const principal = new Decimal(params.principalAmount);
  const rate = new Decimal(params.interestRate);
  const tenure = params.tenureMonths;
  const moratorium = params.moratoriumMonths;

  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  const monthlyPrincipal = principal.div(tenure).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyInterest = totalInterest.div(tenure).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyDeduction = monthlyPrincipal.plus(monthlyInterest);

  const totalMonths = moratorium + tenure;
  const schedule: ScheduleRow[] = [];
  let balance = totalLoan;

  for (let month = 1; month <= totalMonths; month++) {
    const isMoratorium = month <= moratorium;
    if (isMoratorium) {
      schedule.push({ monthNumber: month, principalComponent: '0.00', interestComponent: '0.00',
        totalDeduction: '0.00', runningBalance: balance.toFixed(2), isMoratorium: true });
    } else {
      balance = balance.minus(monthlyDeduction);
      schedule.push({ monthNumber: month, principalComponent: monthlyPrincipal.toFixed(2),
        interestComponent: monthlyInterest.toFixed(2), totalDeduction: monthlyDeduction.toFixed(2),
        runningBalance: balance.toFixed(2), isMoratorium: false });
    }
  }

  return { params, totalInterest: totalInterest.toFixed(2), totalLoan: totalLoan.toFixed(2),
    monthlyPrincipal: monthlyPrincipal.toFixed(2), monthlyInterest: monthlyInterest.toFixed(2),
    monthlyDeduction: monthlyDeduction.toFixed(2), totalMonths, schedule };
}
```

**Problem:** After 60 uniform payments of ₦4,722.08, the balance is ₦0.20 (not ₦0.00). Story 2.4 fixes this.

**Shared types (from Story 2.3):**
- `ComputationParams` — input (principalAmount, interestRate, tenureMonths, moratoriumMonths)
- `ScheduleRow` — per-month output (monthNumber, principalComponent, interestComponent, totalDeduction, runningBalance, isMoratorium)
- `RepaymentSchedule` — full output with summary fields + schedule array

**Tier config (from Story 2.3):**
- `LOAN_TIERS` array with 4 entries, `getTierForGradeLevel()` helper

**Sports Council CSV fixture** — `fixtures/sports-council-april-2025.csv` (21 records, 6 with non-60-month tenures)

### Last-Payment Adjustment Implementation

Modify the schedule loop to detect the final active month and adjust:

```typescript
export function computeRepaymentSchedule(params: ComputationParams): RepaymentSchedule {
  // ... (same setup as Story 2.3)

  // Track cumulative principal and interest paid (for final adjustment)
  let cumulativePrincipal = new Decimal('0');
  let cumulativeInterest = new Decimal('0');

  for (let month = 1; month <= totalMonths; month++) {
    const isMoratorium = month <= moratorium;
    const isLastActiveMonth = month === totalMonths;

    if (isMoratorium) {
      schedule.push({
        monthNumber: month, principalComponent: '0.00', interestComponent: '0.00',
        totalDeduction: '0.00', runningBalance: balance.toFixed(2), isMoratorium: true,
      });
    } else if (isLastActiveMonth) {
      // LAST-PAYMENT ADJUSTMENT: absorb all accumulated rounding
      const lastPrincipal = principal.minus(cumulativePrincipal);
      const lastInterest = totalInterest.minus(cumulativeInterest);
      const lastDeduction = lastPrincipal.plus(lastInterest);

      schedule.push({
        monthNumber: month,
        principalComponent: lastPrincipal.toFixed(2),
        interestComponent: lastInterest.toFixed(2),
        totalDeduction: lastDeduction.toFixed(2),
        runningBalance: '0.00',
        isMoratorium: false,
      });
      balance = new Decimal('0');
    } else {
      cumulativePrincipal = cumulativePrincipal.plus(monthlyPrincipal);
      cumulativeInterest = cumulativeInterest.plus(monthlyInterest);
      balance = balance.minus(monthlyDeduction);

      schedule.push({
        monthNumber: month, principalComponent: monthlyPrincipal.toFixed(2),
        interestComponent: monthlyInterest.toFixed(2), totalDeduction: monthlyDeduction.toFixed(2),
        runningBalance: balance.toFixed(2), isMoratorium: false,
      });
    }
  }

  // ... (return statement unchanged)
}
```

**Key design decisions:**
- Track `cumulativePrincipal` and `cumulativeInterest` separately through the loop
- Final month: `lastPrincipal = principal - cumulativePrincipal`, `lastInterest = totalInterest - cumulativeInterest`
- This ensures `sum(allPrincipalComponents) = principal EXACTLY` and `sum(allInterestComponents) = totalInterest EXACTLY`
- `runningBalance` of final row is always `'0.00'` — no residual

**Rounding residual examples:**

| Loan | Uniform Deduction | 59 × Uniform | Residual | Final Deduction |
|------|-------------------|--------------|----------|-----------------|
| 250K/13.33%/60mo | ₦4,722.08 | ₦278,602.72 | ₦0.20 | ₦4,722.28 |
| 750K/13.33%/60mo | ₦14,166.25 | ₦835,808.75 | ₦0.00 | ₦14,166.25 |
| 600K/13.33%/60mo | ₦11,333.00 | ₦668,247.00 | ₦0.00 | ₦11,333.00 |
| 450K/13.33%/60mo | ₦8,499.75 | ₦501,485.25 | ₦0.00 | ₦8,499.75 |

Note: Some combinations have zero residual (clean division). The adjustment handles both cases — for zero residual, final payment equals the uniform payment.

### Auto-Split Implementation

```typescript
export interface AutoSplitResult {
  principalComponent: string;
  interestComponent: string;
}

/**
 * Auto-split a deduction amount into principal and interest components
 * using the flat-rate ratio from the loan's schedule parameters.
 *
 * Guarantees: principalComponent + interestComponent = deductionAmount exactly.
 */
export function autoSplitDeduction(
  deductionAmount: string,
  params: ComputationParams,
): AutoSplitResult {
  const deduction = new Decimal(deductionAmount);
  const principal = new Decimal(params.principalAmount);
  const rate = new Decimal(params.interestRate);
  const tenure = params.tenureMonths;

  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  // Flat-rate ratio: interest share of each payment
  // interestComponent = deduction × (totalInterest / totalLoan), rounded
  // principalComponent = deduction - interestComponent (remainder to principal)
  const interestComponent = deduction
    .mul(totalInterest)
    .div(totalLoan)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const principalComponent = deduction.minus(interestComponent);

  return {
    principalComponent: principalComponent.toFixed(2),
    interestComponent: interestComponent.toFixed(2),
  };
}
```

**Key design decisions:**
- Calculate interest first (rounded), then principal = deduction - interest
- This guarantees `principal + interest = deduction` exactly (no rounding gap)
- Uses the flat-rate ratio `totalInterest / totalLoan` which is constant for the loan's lifetime
- Works for any deduction amount — standard, over-payment, under-payment

### Accelerated Repayment — No New Function Needed

`computeRepaymentSchedule()` already handles any tenure. Accelerated repayment is simply calling the same function with a shorter tenure:

```typescript
// Standard schedule
const standard = computeRepaymentSchedule({
  principalAmount: '750000.00', interestRate: '13.330',
  tenureMonths: 60, moratoriumMonths: 2,
});

// Accelerated schedule (45 months instead of 60)
const accelerated = computeRepaymentSchedule({
  principalAmount: '750000.00', interestRate: '13.330',
  tenureMonths: 45, moratoriumMonths: 2,
});

// Total interest is THE SAME (flat-rate: principal × rate / 100)
expect(standard.totalInterest).toBe(accelerated.totalInterest); // "99975.00"

// Monthly deduction is HIGHER for shorter tenure
// standard:    849975 / 60 = 14166.25
// accelerated: 849975 / 45 = 18888.33
```

**For the API endpoint:** Add optional `?tenureMonths=N` query parameter to `GET /api/loans/:loanId/schedule`. If provided, the schedule is computed with the overridden tenure (what-if preview — does NOT modify the loan record). The response should clearly label this as a what-if computation.

### CSV Fixture: Accelerated Tenure Test Data

The Sports Council CSV contains 6 loans with non-standard tenures:

| Record | Principal | Rate | Tenure | Monthly Deduction | Monthly Principal | Monthly Interest |
|--------|-----------|------|--------|-------------------|-------------------|------------------|
| #8 | 450,000 | 11.108% | **50** | 9,999.75 | 9,000.00 | 999.75 |
| #15 | 750,000 | 11.108% | **50** | 16,666.25 | 15,000.00 | 1,666.25 |
| #17 | 750,000 | 6.664% | **48** | 16,666.25 | 15,625.00 | 1,041.25 |
| #20 | 600,000 | 6.665% | **30** | 21,333.00 | 20,000.00 | 1,333.00 |
| #21 | 450,000 | 8.887% | **40** | 12,249.75 | 11,250.00 | 999.75 |

**Skip:** Record #14 (450K/50mo) — data anomaly (negative principal, empty deduction).

**Deriving interest rates from CSV:**
```
Rate = Total Interest / Principal × 100
Record #8:  49,987.50 / 450,000 × 100 = 11.108%
Record #15: 83,312.50 / 750,000 × 100 = 11.108%
Record #17: 49,980.00 / 750,000 × 100 = 6.664%
Record #20: 39,990.00 / 600,000 × 100 = 6.665%
Record #21: 39,990.00 / 450,000 × 100 = 8.887%
```

### What NOT To Do

1. **DO NOT create a separate function for accelerated schedules** — `computeRepaymentSchedule()` already handles any tenure; just pass a shorter `tenureMonths`
2. **DO NOT change the total interest for accelerated loans** — flat-rate interest = `principal × rate / 100` regardless of tenure; only the monthly payment changes
3. **DO NOT use reducing balance / amortisation for auto-split** — the Oyo State scheme uses flat-rate, so the split ratio is constant (not balance-dependent)
4. **DO NOT store the rounding residual in a separate column** — the last-payment adjustment absorbs it inline in the schedule
5. **DO NOT modify the `loans` table schema** — tenure changes are a lifecycle event (Story 2.7), not a computation engine concern
6. **DO NOT implement the tenure change workflow** — that is Story 2.7; this story only ensures the engine can compute correct schedules for any tenure
7. **DO NOT compute money on the client** — all computation stays in `computationEngine.ts`, frontend displays pre-computed strings
8. **DO NOT use `Number`, `parseFloat()`, or JS arithmetic operators for money** — only `decimal.js`

### Project Structure Notes

| File | Location | Change Type |
|------|----------|-------------|
| `computationEngine.ts` | `apps/server/src/services/computationEngine.ts` | **Modify** — add last-payment adjustment to loop, add `autoSplitDeduction()` |
| `computationEngine.test.ts` | `apps/server/src/services/computationEngine.test.ts` | **Modify** — add test suites for all 3 features |
| `computation.ts` types | `packages/shared/src/types/computation.ts` | **Modify** — add `AutoSplitResult` interface |
| `scheduleRoutes.ts` | `apps/server/src/routes/scheduleRoutes.ts` | **Modify** — add optional `?tenureMonths` query param |

**No new files created in this story** — all changes are modifications to files created in Story 2.3.

### Dependencies

- **Depends on:** Story 2.3 (base computation engine — `computeRepaymentSchedule()`, `ComputationParams`, `ScheduleRow`, `RepaymentSchedule`, tier constants, Sports Council CSV fixture)
- **Does NOT depend on:** Story 2.1 or 2.2 directly (computation engine is a pure function; API endpoint depends on 2.1 indirectly through Story 2.3's route)
- **Blocks:** Story 2.5 (balance computation — depends on exact ₦0.00 closure), Story 2.7 (lifecycle states — tenure change validation), Story 3.2 (migration validation), Epic 5 (submission comparison), Epic 8 (auto-stop — depends on exact zero detection), Epic 12 (early exit payoff)
- **UAT checkpoint:** After this story per Story 2.0 AC 4 — computation engine verification (can Awwal verify numbers match known real-world data?)

### Technical Stack for This Story

| Tool | Version | Purpose |
|------|---------|---------|
| `decimal.js` | ^10.5.0 | Arbitrary-precision financial arithmetic (already installed) |
| Vitest | Latest | Unit tests for computation engine |

### References

- [Source: `_bmad-output/implementation-artifacts/2-3-loan-repayment-schedule-computation.md`] — Base computation engine, flat-rate model, rounding strategy, Sports Council CSV analysis
- [Source: `_bmad-output/planning-artifacts/epics.md` → Story 2.4] — BDD acceptance criteria, 60→45 tenure example
- [Source: `_bmad-output/planning-artifacts/architecture.md` → Computation Engine] — `computationEngine` owns financial math, calls only `decimal.js`, never DB
- [Source: `_bmad-output/planning-artifacts/prd.md` → FR3, FR4, FR5] — Accelerated repayment, last-payment adjustment, auto-split requirements
- [Source: `_bmad-output/planning-artifacts/prd.md` → Journey 10 (Auditor)] — Tenure change traceability (old tenure: 60, new tenure: 45), independent verification to kobo
- [Source: `fixtures/sports-council-april-2025.csv`] — Records #8, #15, #17, #20, #21 for accelerated tenure test data
- [Source: `_bmad-output/implementation-artifacts/2-2-immutable-repayment-ledger.md`] — `ADJUSTMENT` entry type for ledger entries (future use in submission workflow)
- [Source: `_bmad-output/implementation-artifacts/2-0-sprint-infrastructure-quality-gates.md`] — UAT checkpoint after Story 2.4

## PM Validation Findings

**Validated:** 2026-02-24 | **Verdict:** Pass — no fixes needed | **Blocking issues:** None

1. **[LOW — Scope Note] Task 7 adds what-if tenure query parameter not in any AC.** The `?tenureMonths=N` param on `GET /api/loans/:loanId/schedule` isn't explicitly required by any AC or epics listing. However, it's a small addition, supports PRD Journey 10 (Auditor tenure change traceability), and fits naturally with accelerated repayment. Reasonable scope extension — dev should implement but be aware it's beyond explicit ACs.

2. **[LOW — Positive] Story correctly fixes epics terminology error.** Epics AC 3 says "based on the amortisation schedule" — the story correctly uses "flat-rate schedule ratio" instead. The Oyo State scheme uses flat-rate interest, not reducing-balance amortisation. Important correction.

3. **[LOW — Positive] Auto-split math is provably exact.** Interest-first rounding with principal-as-remainder guarantees `principal + interest = deduction` exactly. No rounding mismatch possible.

4. **[LOW — Positive] "No new function for accelerated" is a great design insight.** `computeRepaymentSchedule()` already handles any tenure parameterically — accelerated repayment is a test scenario, not a code change. Prevents over-engineering.

## Dev Agent Record

### Agent Model Used

(To be filled by dev agent)

### Debug Log References

### Completion Notes List

### Commit Summary

<!-- Convention: Fill this section when story reaches 'done' status -->
<!-- Format: Total commits | Files touched (new/modified) | Revert count | One-sentence narrative -->

### File List
