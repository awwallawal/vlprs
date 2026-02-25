# Story 2.3: Loan Repayment Schedule Computation

Status: done

<!-- Generated: 2026-02-24 | Epic: 2 | Sprint: 3 -->
<!-- Blocked By: 2-1 (loans table schema) | Blocks: 2-4, 2-5, 2-6, 2-7, 3-2, Epic 5, Epic 8, Epic 12 -->
<!-- FRs: FR1, FR2, NFR-PERF-7, NFR-REL-6, NFR-REL-7 | Motivation: Auditor-verifiable financial math -->
<!-- Source: epics.md → Epic 2, Story 2.3 | architecture.md → Computation Engine | prd.md → FR1-FR5 -->

## Story

As a **Department Admin**,
I want the system to compute accurate repayment schedules for all 4 grade-level tiers including moratorium periods,
So that every loan has a mathematically correct schedule that any auditor can verify.

### Context

The computation engine is the mathematical core of VLPRS. Every downstream feature — balance reconstruction (Story 2.5), accelerated repayment (Story 2.4), MDA submission comparison (Epic 5), early exit payoff (Epic 12), and migration validation (Story 3.2) — calls this engine. If the engine produces wrong numbers, the entire system's credibility collapses. The Oyo State Car Loan Scheme uses **flat-rate interest** (not reducing balance/amortisation), so the computation model is straightforward but must be implemented with kobo-level precision using `decimal.js`.

## Acceptance Criteria

### AC 1: Parameterised Tier Computation

**Given** the 4 loan tiers with parameterised values (grade level, interest rate, max tenure, max principal)
**When** a schedule is computed for any tier
**Then** the same computation function handles all tiers — no per-tier code paths, only parameterised values (FR1)
**And** all arithmetic uses `decimal.js` for arbitrary-precision — never JavaScript floating point

### AC 2: Moratorium Period Handling

**Given** a loan with a 2-month moratorium
**When** the repayment schedule is generated
**Then** months 1-2 show zero deduction with no interest accrual, and active repayment begins in month 3 (FR2)

### AC 3: Schedule Output, Performance & Determinism

**Given** the computation engine
**When** a full 60-month schedule is computed
**Then** it completes in <1 second (NFR-PERF-7)
**And** the output includes: month number, principal component, interest component, total deduction, running balance — for every month
**And** the result is deterministic — same inputs always produce identical outputs (NFR-REL-6)

### AC 4: Sports Council CSV Validation

**Given** the Sports Council car loan report (`fixtures/sports-council-april-2025.csv`) with 21 real loan records
**When** the computation engine processes the same loan parameters (principals: 250K-750K, tenures: 30-60 months)
**Then** computed monthly deductions, interest splits, and outstanding balances match the known correct values from the CSV to kobo (₦0.01) precision
**And** the test suite includes at minimum 5 representative loans covering all principal/tenure combinations present in the CSV

## Tasks / Subtasks

- [x] Task 1: Commit Sports Council CSV to fixtures directory (AC: 4)
  - [x] 1.1 Create `fixtures/` directory at project root
  - [x] 1.2 Copy `docs/NEW CAR LOAN TEMPLATE APRIL, 2025_Sheet1.csv` to `fixtures/sports-council-april-2025.csv`
- [x] Task 2: Create shared types for computation (AC: 1, 3)
  - [x] 2.1 Create `packages/shared/src/types/computation.ts` — `ComputationParams`, `ScheduleRow`, `RepaymentSchedule`
  - [x] 2.2 Create `packages/shared/src/constants/tiers.ts` — 4-tier configuration constants
  - [x] 2.3 Export new types and constants from `packages/shared/src/index.ts`
- [x] Task 3: Create computation engine (AC: 1, 2, 3)
  - [x] 3.1 Create `apps/server/src/services/computationEngine.ts`
  - [x] 3.2 Implement `computeRepaymentSchedule(params)` — pure function, `decimal.js` only, no DB access
  - [x] 3.3 Flat-rate interest model: `totalInterest = principal × rate / 100`, even monthly splits
  - [x] 3.4 Moratorium months: insert zero-deduction rows at schedule start
  - [x] 3.5 Single code path for all tiers — parameterised inputs only
- [x] Task 4: Unit tests with hand-verified calculations (AC: 1, 2, 3)
  - [x] 4.1 Create `apps/server/src/services/computationEngine.test.ts`
  - [x] 4.2 Test: Tier 1 (250K, 60 months) produces correct schedule
  - [x] 4.3 Test: Tier 4 (750K, 60 months) produces correct schedule
  - [x] 4.4 Test: moratorium months show zero deduction, no interest accrual
  - [x] 4.5 Test: determinism — call twice with same inputs, compare outputs deeply
  - [x] 4.6 Test: performance — 60-month schedule completes in < 1 second
  - [x] 4.7 Test: all money values are strings with exactly 2 decimal places
- [x] Task 5: Sports Council CSV validation tests (AC: 4)
  - [x] 5.1 Parse `fixtures/sports-council-april-2025.csv` in test setup
  - [x] 5.2 Test: 5+ representative loans covering principal/tenure combos (250K/60, 450K/50, 450K/60, 600K/60, 750K/60)
  - [x] 5.3 Validate monthly deduction, monthly principal, monthly interest match CSV to ₦0.01
  - [x] 5.4 Document any CSV records with known data anomalies (record 14 has negative principal)
- [x] Task 6: Schedule retrieval API endpoint (AC: 3)
  - [x] 6.1 Create `apps/server/src/routes/scheduleRoutes.ts` — `GET /api/loans/:loanId/schedule`
  - [x] 6.2 Route fetches loan from DB, calls `computeRepaymentSchedule()`, returns schedule
  - [x] 6.3 Register in `apps/server/src/app.ts`
  - [x] 6.4 Add vocabulary entries to `packages/shared/src/constants/vocabulary.ts`

## Dev Notes

### Critical Context — Flat-Rate Interest Model

**The Oyo State Car Loan Scheme uses FLAT-RATE interest, NOT reducing balance / amortisation.** This is confirmed by analysing all 21 records in the Sports Council CSV. The model is:

```
Total Interest    = Principal × (Interest Rate / 100)
Total Loan        = Principal + Total Interest
Monthly Principal = Principal / Tenure Months
Monthly Interest  = Total Interest / Tenure Months
Monthly Deduction = Monthly Principal + Monthly Interest
                  = Total Loan / Tenure Months
```

**Verification against Sports Council CSV:**

| Record | Principal | Rate | Tenure | Total Interest | Monthly Deduction | Monthly Principal | Monthly Interest |
|--------|-----------|------|--------|----------------|-------------------|-------------------|------------------|
| #1 | 250,000 | 13.33% | 60 | 33,325.00 | 4,722.08 | 4,166.67 | 555.41 |
| #8 | 450,000 | 11.11% | 50 | 49,987.50 | 9,999.75 | 9,000.00 | 999.75 |
| #9 | 450,000 | 13.33% | 60 | 59,985.00 | 8,499.75 | 7,500.00 | 999.75 |
| #18 | 600,000 | 13.33% | 60 | 79,980.00 | 11,333.00 | 10,000.00 | 1,333.00 |
| #3 | 750,000 | 13.33% | 60 | 99,975.00 | 14,166.25 | 12,500.00 | 1,666.25 |
| #17 | 750,000 | 6.664% | 48 | 49,980.00 | 16,666.25 | 15,625.00 | 1,041.25 |
| #20 | 600,000 | 6.665% | 30 | 39,990.00 | 21,333.00 | 20,000.00 | 1,333.00 |

**Key insight:** Interest rates vary per loan (not fixed per tier). The `interestRate` column in the `loans` table (NUMERIC 5,3) stores the flat rate as a percentage (e.g., `13.330` for 13.33%). The computation engine receives this as a parameter — it does NOT look up rates from a tier table.

### Rounding Strategy

Use `decimal.js` with `ROUND_HALF_UP` (Decimal.ROUND_HALF_UP = 4) and `toFixed(2)` for all money outputs.

**Known rounding residual:** With flat-rate division, uniform payments may not sum to exactly the total loan:
- 283,325.00 / 60 = 4,722.0833... → rounded to 4,722.08
- 60 × 4,722.08 = 283,324.80 → residual of ₦0.20

**Story 2.3 approach:** Compute uniform payments. The schedule's final `runningBalance` may have a small residual (< ₦1.00). **Story 2.4 adds the last-payment adjustment** to absorb this residual so the loan closes at exactly ₦0.00. Story 2.3 unit tests should assert the residual is < ₦1.00, not necessarily zero.

**CSV rounding anomaly:** Records #10 and #11 show Monthly Deduction = 4,722.09 (vs 4,722.08 for records #1, #2 with identical parameters). This appears to be a spreadsheet rounding inconsistency. The computation engine should use consistent `ROUND_HALF_UP` and document the ₦0.01 discrepancy in test expectations.

### What Already Exists

**`decimal.js` — ALREADY INSTALLED in `apps/server/package.json`:**
```json
"decimal.js": "^10.5.0"
```
No installation needed. Import as:
```typescript
import Decimal from 'decimal.js';
```

**Sports Council CSV — EXISTS at `docs/NEW CAR LOAN TEMPLATE APRIL, 2025_Sheet1.csv`:**
21 real loan records. Task 1 copies this to `fixtures/` for test consumption. The CSV has a multi-row header (rows 1-7 are headers/title), data starts at row 8.

**Loans table schema (Story 2.1) — relevant fields:**
```typescript
principalAmount: numeric('principal_amount', { precision: 15, scale: 2 }).notNull(),
interestRate: numeric('interest_rate', { precision: 5, scale: 3 }).notNull(),
tenureMonths: integer('tenure_months').notNull(),
moratoriumMonths: integer('moratorium_months').notNull().default(0),
monthlyDeductionAmount: numeric('monthly_deduction_amount', { precision: 15, scale: 2 }).notNull(),
```
The computation engine should compute `monthlyDeductionAmount` from the other fields. When creating a loan (Story 2.1), the API calls `computeRepaymentSchedule()` to derive this value.

**Architecture mandate — from architecture.md:**
> "Put ALL financial arithmetic in `computationEngine.ts` using `decimal.js` — never compute money elsewhere"
> `computationEngine` calls: `decimal.js` only. Never calls: DB directly.

### Shared Types — `packages/shared/src/types/computation.ts`

```typescript
/** Input parameters for schedule computation */
export interface ComputationParams {
  principalAmount: string;     // NUMERIC(15,2) as string, e.g. "250000.00"
  interestRate: string;        // NUMERIC(5,3) as string, e.g. "13.330" (percentage)
  tenureMonths: number;        // Active repayment months (e.g., 60)
  moratoriumMonths: number;    // Grace period months (e.g., 2), default 0
}

/** One row in the repayment schedule */
export interface ScheduleRow {
  monthNumber: number;           // 1-based (includes moratorium months)
  principalComponent: string;    // NUMERIC(15,2) as string
  interestComponent: string;     // NUMERIC(15,2) as string
  totalDeduction: string;        // NUMERIC(15,2) as string
  runningBalance: string;        // Remaining total loan amount as string
  isMoratorium: boolean;         // true for grace period months
}

/** Complete repayment schedule output */
export interface RepaymentSchedule {
  params: ComputationParams;
  totalInterest: string;         // Principal × rate / 100
  totalLoan: string;             // Principal + totalInterest
  monthlyPrincipal: string;      // Principal / tenureMonths (uniform)
  monthlyInterest: string;       // totalInterest / tenureMonths (uniform)
  monthlyDeduction: string;      // monthlyPrincipal + monthlyInterest
  totalMonths: number;           // moratoriumMonths + tenureMonths
  schedule: ScheduleRow[];       // One row per month
}
```

### Tier Configuration — `packages/shared/src/constants/tiers.ts`

```typescript
export interface LoanTierConfig {
  tier: number;
  gradeLevels: string;        // Human-readable, e.g. "Levels 1-6"
  minGradeLevel: number;
  maxGradeLevel: number;
  maxPrincipal: string;       // NUMERIC as string, e.g. "250000.00"
  standardTenureMonths: number;
  standardMoratoriumMonths: number;
}

export const LOAN_TIERS: LoanTierConfig[] = [
  { tier: 1, gradeLevels: 'Levels 1-6',  minGradeLevel: 1,  maxGradeLevel: 6,  maxPrincipal: '250000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
  { tier: 2, gradeLevels: 'Levels 7-8',  minGradeLevel: 7,  maxGradeLevel: 8,  maxPrincipal: '450000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
  { tier: 3, gradeLevels: 'Levels 9-10', minGradeLevel: 9,  maxGradeLevel: 10, maxPrincipal: '600000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
  { tier: 4, gradeLevels: 'Levels 12+',  minGradeLevel: 12, maxGradeLevel: 99, maxPrincipal: '750000.00', standardTenureMonths: 60, standardMoratoriumMonths: 2 },
];

export function getTierForGradeLevel(gradeLevel: number): LoanTierConfig | undefined {
  return LOAN_TIERS.find(t => gradeLevel >= t.minGradeLevel && gradeLevel <= t.maxGradeLevel);
}
// NOTE: Grade Level 11 intentionally returns undefined — GL 11 is not eligible for the car loan
// scheme per PRD/epics/wireframes which all specify "Levels 12+" for Tier 4.
// Callers (e.g. Story 2.1 loan creation) MUST handle undefined with a clear error message.
```

### Computation Engine — `apps/server/src/services/computationEngine.ts`

```typescript
import Decimal from 'decimal.js';
import type { ComputationParams, ScheduleRow, RepaymentSchedule } from '@vlprs/shared';

// Configure decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function computeRepaymentSchedule(params: ComputationParams): RepaymentSchedule {
  const principal = new Decimal(params.principalAmount);
  const rate = new Decimal(params.interestRate);
  const tenure = params.tenureMonths;
  const moratorium = params.moratoriumMonths;

  // Flat-rate interest calculation
  const totalInterest = principal.mul(rate).div(100);
  const totalLoan = principal.plus(totalInterest);

  // Uniform monthly splits
  const monthlyPrincipal = principal.div(tenure).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyInterest = totalInterest.div(tenure).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const monthlyDeduction = monthlyPrincipal.plus(monthlyInterest);

  // Build schedule
  const totalMonths = moratorium + tenure;
  const schedule: ScheduleRow[] = [];
  let balance = totalLoan;

  for (let month = 1; month <= totalMonths; month++) {
    const isMoratorium = month <= moratorium;

    if (isMoratorium) {
      schedule.push({
        monthNumber: month,
        principalComponent: '0.00',
        interestComponent: '0.00',
        totalDeduction: '0.00',
        runningBalance: balance.toFixed(2),
        isMoratorium: true,
      });
    } else {
      balance = balance.minus(monthlyDeduction);
      schedule.push({
        monthNumber: month,
        principalComponent: monthlyPrincipal.toFixed(2),
        interestComponent: monthlyInterest.toFixed(2),
        totalDeduction: monthlyDeduction.toFixed(2),
        runningBalance: balance.toFixed(2),
        isMoratorium: false,
      });
    }
  }

  return {
    params,
    totalInterest: totalInterest.toFixed(2),
    totalLoan: totalLoan.toFixed(2),
    monthlyPrincipal: monthlyPrincipal.toFixed(2),
    monthlyInterest: monthlyInterest.toFixed(2),
    monthlyDeduction: monthlyDeduction.toFixed(2),
    totalMonths,
    schedule,
  };
}
```

**Key design decisions:**
- `Decimal.set({ precision: 20 })` — sufficient for 15-digit NUMERIC with intermediate calculations
- `ROUND_HALF_UP` — standard financial rounding (0.005 → 0.01)
- `toDecimalPlaces(2)` for per-month amounts, `toFixed(2)` for string output
- Moratorium months have zero deduction and balance remains at `totalLoan`
- Final `runningBalance` may have a small residual from rounding — Story 2.4 handles last-payment adjustment

### CSV Parsing for Tests

The Sports Council CSV has a complex header (rows 1-7). Parse strategy:
```typescript
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface CsvLoanRecord {
  sn: number;
  name: string;
  principal: string;       // "250,000" → "250000"
  totalInterest: string;   // "33,325.00"
  totalLoan: string;       // "283,325.00"
  tenure: number;          // 60
  monthlyInterest: string; // "555.41"
  monthlyDeduction: string;// "4,722.08"
  monthlyPrincipal: string;// "4,166.67"
  installmentsPaid: number;
  installmentsOutstanding: number;
}

function parseCsvFixture(): CsvLoanRecord[] {
  const csvPath = resolve(__dirname, '../../../../fixtures/sports-council-april-2025.csv');
  const raw = readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n');
  // Data rows start at line index 7 (row 8), skip empty/total rows
  return lines.slice(7)
    .filter(line => line.trim() && !line.includes('TOTAL'))
    .map(line => {
      const cols = parseCSVLine(line); // Handle quoted fields with commas
      return {
        sn: parseInt(cols[0]),
        name: cols[2],
        principal: cols[3].replace(/,/g, ''),
        totalInterest: cols[4].replace(/,/g, ''),
        totalLoan: cols[5].replace(/,/g, ''),
        tenure: parseInt(cols[6]),
        monthlyInterest: cols[7].replace(/,/g, ''),
        monthlyDeduction: cols[8].replace(/,/g, ''),
        monthlyPrincipal: cols[9].replace(/,/g, ''),
        installmentsPaid: parseInt(cols[12]),
        installmentsOutstanding: parseInt(cols[13]),
      };
    })
    .filter(r => !isNaN(r.sn));
}
```

**CSV records requiring special handling:**
- **Record #14** (Ajala Oludare Emmanuel): Monthly Deduction column is empty, Monthly Principal is -1,199.70 (negative). Skip this record in validation — likely a fully-paid or data-anomaly record.
- **Records #10, #11**: Monthly Deduction = 4,722.09 (vs 4,722.08 for identical parameters in records #1, #2). Spreadsheet rounding inconsistency — accept ±₦0.01 tolerance for these specific records.

### Schedule API Endpoint — `GET /api/loans/:loanId/schedule`

```typescript
import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { auditLog } from '../middleware/auditLog';
import { ROLES } from '@vlprs/shared';
import { db } from '../db/index';
import { loans } from '../db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import { computeRepaymentSchedule } from '../services/computationEngine';

const router = Router();

router.get(
  '/loans/:loanId/schedule',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = Array.isArray(req.params.loanId) ? req.params.loanId[0] : req.params.loanId;
    const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
    if (!loan) {
      throw new AppError(404, 'LOAN_NOT_FOUND', VOCABULARY.LOAN_NOT_FOUND);
    }
    // MDA scoping for mda_officer
    if (req.user!.role === 'mda_officer' && loan.mdaId !== req.user!.mdaId) {
      throw new AppError(403, 'MDA_ACCESS_DENIED', VOCABULARY.MDA_ACCESS_DENIED);
    }
    const schedule = computeRepaymentSchedule({
      principalAmount: loan.principalAmount,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      moratoriumMonths: loan.moratoriumMonths,
    });
    res.json({ success: true, data: schedule });
  },
);

export default router;
```

Register in `app.ts`:
```typescript
import scheduleRoutes from './routes/scheduleRoutes';
app.use('/api', scheduleRoutes);
```

### What NOT To Do

1. **DO NOT use JavaScript `Number`, `parseFloat()`, or arithmetic operators (`+`, `-`, `*`, `/`) for money** — all financial math MUST use `decimal.js` Decimal instances
2. **DO NOT implement reducing balance / amortisation** — the scheme uses flat-rate interest, confirmed by all 21 CSV records
3. **DO NOT implement last-payment adjustment in this story** — that is Story 2.4; this story produces uniform payments with a small rounding residual
4. **DO NOT implement accelerated repayment (shortened tenure)** — that is Story 2.4
5. **DO NOT implement auto-split of an externally-provided deduction amount** — that is Story 2.4; this story computes the deduction from principal + rate + tenure
6. **DO NOT look up interest rates from a tier table in the computation engine** — the rate is a direct parameter from the loan record; tier config is for validation only
7. **DO NOT access the database from `computationEngine.ts`** — it must be a pure function with no DB dependency (architecture mandate)
8. **DO NOT store computed schedules in the database** — schedules are computed on-demand; only ledger entries (actual payments) are persisted
9. **DO NOT add Playwright E2E tests** — this story is about unit tests and one thin integration test
10. **DO NOT return money values as JavaScript numbers in API responses** — always strings with exactly 2 decimal places

### Project Structure Notes

All new files align with established project structure:

| File | Location | Convention |
|------|----------|------------|
| `computationEngine.ts` | `apps/server/src/services/computationEngine.ts` | Service in `services/` (architecture-mandated path) |
| `computationEngine.test.ts` | `apps/server/src/services/computationEngine.test.ts` | Co-located with source |
| `scheduleRoutes.ts` | `apps/server/src/routes/scheduleRoutes.ts` | Route in `routes/` |
| `computation.ts` types | `packages/shared/src/types/computation.ts` | Shared types in `types/` |
| `tiers.ts` constants | `packages/shared/src/constants/tiers.ts` | Shared constants in `constants/` |
| Sports Council CSV | `fixtures/sports-council-april-2025.csv` | Project root `fixtures/` for test data |

### Dependencies

- **Depends on:** Story 2.1 (`loans` table schema — required for API endpoint DB query and for `interestRate`, `tenureMonths`, `moratoriumMonths` fields)
- **Does NOT depend on:** Story 2.2 (ledger) — the computation engine is a pure function that doesn't read the ledger
- **Blocks:** Story 2.4 (accelerated repayment builds on this engine), Story 2.5 (balance computation calls this engine), Story 2.6 (loan search may display schedule), Story 2.7 (lifecycle states), Story 3.2 (migration validation), Epic 5 (submission comparison), Epic 8 (auto-stop), Epic 12 (early exit)
- **Can parallel with:** Story 2.2 (immutable ledger) — no dependency in either direction; computation engine is a pure function

### Technical Stack for This Story

| Tool | Version | Purpose |
|------|---------|---------|
| `decimal.js` | ^10.5.0 | Arbitrary-precision financial arithmetic (already installed) |
| Vitest | Latest | Unit tests for computation engine |
| Drizzle ORM | ^0.45.0 | DB query for schedule API endpoint |
| supertest | ^7.1.0 | Integration test for API endpoint |
| Node.js `fs` | Built-in | CSV fixture parsing in tests |

### References

- [Source: `docs/NEW CAR LOAN TEMPLATE APRIL, 2025_Sheet1.csv`] — Sports Council CSV fixture (21 real loan records)
- [Source: `apps/server/package.json` line 27] — `decimal.js` ^10.5.0 already installed
- [Source: `_bmad-output/planning-artifacts/epics.md` → Story 2.3] — BDD acceptance criteria, 4-tier specification
- [Source: `_bmad-output/planning-artifacts/architecture.md` → Computation Engine] — Service boundaries, decimal.js mandate, NUMERIC→string handling
- [Source: `_bmad-output/planning-artifacts/prd.md` → FR1, FR2, NFR-PERF-7, NFR-REL-6, NFR-REL-7] — Functional + non-functional requirements
- [Source: `_bmad-output/implementation-artifacts/2-1-mda-registry-loan-master-records.md`] — `loans` table schema (interestRate, tenureMonths, moratoriumMonths columns)
- [Source: `_bmad-output/implementation-artifacts/2-2-immutable-repayment-ledger.md`] — `ledgerEntries` schema (amount, principalComponent, interestComponent columns match schedule output)
- [Source: `_bmad-output/implementation-artifacts/epic-1-14-retro-2026-02-24.md` → Action Item #6] — "Commit Sports Council CSV as computation engine test fixture"
- [Source: `apps/server/src/routes/userRoutes.ts`] — Route + middleware chain pattern
- [Source: `apps/server/src/lib/appError.ts`] — Error handling pattern
- [Source: `packages/shared/src/constants/vocabulary.ts`] — Non-punitive vocabulary pattern

## PM Validation Findings

**Validated:** 2026-02-24 | **Verdict:** Pass with 1 medium finding (resolved inline) | **Blocking issues:** None remaining

1. **[MEDIUM — Resolved] Grade Level 11 is not covered by any tier.** Tiers cover GL 1-6, 7-8, 9-10, and 12+ — `getTierForGradeLevel(11)` returns `undefined`. This matches the PRD, epics, and public website wireframes which all specify "Levels 12+" for Tier 4, confirming GL 11 is intentionally excluded from the car loan scheme. **Fix applied:** Added inline comment to `getTierForGradeLevel()` documenting GL 11 exclusion and requiring callers to handle `undefined` with a clear error message. Story 2.1's loan creation validation must reject GL 11 loans gracefully. **If GL 11 should be eligible, this is a PRD-level policy decision — escalate to Awwal.**

2. **[LOW — Fragility] CSV fixture path uses 4-level relative `__dirname` traversal.** `resolve(__dirname, '../../../../fixtures/...')` is correct for current structure but breaks if files move. Acceptable for a test-only file — dev should be aware.

3. **[LOW — Design Note] Schedule route is a separate file from loan routes.** `scheduleRoutes.ts` serves `/api/loans/:loanId/schedule` but lives outside `loanRoutes.ts` (Story 2.1). Self-contained with full middleware chain — works fine, just a design choice.

4. **[LOW — Positive] Rounding strategy is exceptionally well-documented.** Residual < ₦1.00 from uniform payments, Story 2.4 last-payment adjustment handoff, CSV anomalies pre-identified. Prevents wasted debugging effort.

## Senior Developer Review (AI)

**Reviewed:** 2026-02-25 | **Reviewer:** Code Review Workflow (Adversarial) | **Verdict:** Pass — all issues fixed

**ACs validated:** AC 1 (parameterised), AC 2 (moratorium), AC 3 (output/perf/determinism), AC 4 (CSV validation) — all IMPLEMENTED.
**Tasks audited:** 22/22 subtasks genuinely complete. No false [x] claims.
**Tests:** 302/302 pass (33 test files) after fixes. Story tests: 22 pass (16 original + 6 new edge case tests).

### Review Follow-ups (AI) — All Fixed

- [x] [AI-Review][HIGH] H1: Add input validation to computationEngine.ts — tenureMonths=0 caused division-by-zero producing NaN money values. Added guards for all 4 params. [computationEngine.ts:11-25]
- [x] [AI-Review][MEDIUM] M1: Consolidate orphaned `beforeAll` import at bottom of test file into top-level vitest import. [computationEngine.test.ts:1]
- [x] [AI-Review][MEDIUM] M2: Extract duplicate `param()` helper from 4 route files into shared `lib/params.ts`. [lib/params.ts, loanRoutes.ts, scheduleRoutes.ts, ledgerRoutes.ts, userRoutes.ts]
- [x] [AI-Review][MEDIUM] M3: Add forward-reference comment to unused VOCABULARY.SCHEDULE_COMPUTED entry. [vocabulary.ts:50]
- [x] [AI-Review][MEDIUM] M4: Add 6 edge case tests — tenureMonths=0, negative tenure, invalid string, negative principal, zero interest, negative moratorium. [computationEngine.test.ts]
- [x] [AI-Review][LOW] L1: Replace all `parseFloat().toFixed(2)` in test CSV comparisons with `Decimal` for consistency with "never JavaScript floating-point for money" principle. Also rewrote `withinOneKobo()` helper to use `decimal.js`. [computationEngine.test.ts]
- [x] [AI-Review][LOW] L4: Changed fragile CSV line filter from `!line.includes('TOTAL')` to `/^\d/.test()` — now only processes lines starting with a digit. [computationEngine.test.ts:237]

### Unfixed / Noted (informational only)

- [LOW] L2: Performance test measures single cold call without warmup. Sub-millisecond in practice, unlikely to flake. No fix needed.
- [LOW] L3: Dev Notes code blocks show raw DB query in scheduleRoutes but actual implementation correctly uses `loanService.getLoanById()`. Better pattern, but Dev Notes are now stale.

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Initial CSV validation tests had 3 failures: (1) floating-point precision in ₦0.01 comparison — `Math.abs(4722.09 - 4722.08)` evaluates to `0.010000000000218279` which exceeds `0.01`; fixed with `withinOneKobo()` helper using `Math.round(diff * 100) <= 1`. (2) Record #8 interest rate: Dev Notes approximated rate as 11.11% but CSV totalInterest=49987.50 requires rate=11.10833...%; fixed by deriving effective rate from CSV data for validation. (3) Same floating-point issue in #10/#11 rounding test.

### Completion Notes List

- **Task 1:** Copied Sports Council CSV (21 real loan records) from `docs/` to `fixtures/sports-council-april-2025.csv` for test consumption.
- **Task 2:** Created shared types (`ComputationParams`, `ScheduleRow`, `RepaymentSchedule`) and tier constants (`LOAN_TIERS`, `getTierForGradeLevel`). GL 11 exclusion documented per PRD.
- **Task 3:** Implemented `computeRepaymentSchedule()` as a pure function using `decimal.js` only. Single parameterised code path for all tiers. Flat-rate model with moratorium support. No DB access.
- **Task 4:** 6 unit tests covering Tier 1/4 hand-verified calculations, moratorium handling, determinism, sub-second performance, and 2-decimal-place string formatting. All pass.
- **Task 5:** 9 CSV validation tests. 7 representative loans (Records #1, #3, #8, #9, #17, #18, #20) covering all principal/tenure combinations. Record #14 anomaly documented. Records #10/#11 rounding inconsistency documented.
- **Task 6:** Schedule API endpoint (`GET /api/loans/:loanId/schedule`) with full middleware chain (auth, password change, RBAC, MDA scoping, audit). Leverages existing `loanService.getLoanById` for MDA-scoped loan retrieval. Registered in `app.ts`. Vocabulary entry added.

### Commit Summary

<!-- Convention: Fill this section when story reaches 'done' status -->
<!-- Format: Total commits | Files touched (new/modified) | Revert count | One-sentence narrative -->

### Change Log

- 2026-02-25: Implemented computation engine with flat-rate interest model, 16 unit/CSV-validation tests, and schedule API endpoint.
- 2026-02-25: Code review fixes — input validation guards, 6 edge case tests, deduped param() helper, replaced parseFloat with Decimal in tests, consolidated imports.

### File List

- `fixtures/sports-council-april-2025.csv` (new) — Sports Council CSV test fixture (21 real loan records)
- `packages/shared/src/types/computation.ts` (new) — ComputationParams, ScheduleRow, RepaymentSchedule types
- `packages/shared/src/constants/tiers.ts` (new) — LOAN_TIERS config, getTierForGradeLevel()
- `packages/shared/src/index.ts` (modified) — Export new types and constants
- `packages/shared/src/constants/vocabulary.ts` (modified) — Added SCHEDULE_COMPUTED entry, forward-reference comment
- `apps/server/src/services/computationEngine.ts` (new) — Pure computation engine using decimal.js, input validation guards
- `apps/server/src/services/computationEngine.test.ts` (new) — 22 tests (12 unit + 10 CSV validation)
- `apps/server/src/routes/scheduleRoutes.ts` (new) — GET /api/loans/:loanId/schedule endpoint
- `apps/server/src/routes/loanRoutes.ts` (modified) — Import param() from shared lib
- `apps/server/src/routes/ledgerRoutes.ts` (modified) — Import param() from shared lib
- `apps/server/src/routes/userRoutes.ts` (modified) — Import param() from shared lib
- `apps/server/src/lib/params.ts` (new) — Shared Express 5 param extraction helper
- `apps/server/src/app.ts` (modified) — Register scheduleRoutes
