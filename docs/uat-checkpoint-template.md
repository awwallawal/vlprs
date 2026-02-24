# UAT Checkpoint: [Epic X — After Story X.Y]

**Date:** YYYY-MM-DD
**Environment:** https://oyocarloan.com.ng
**Tester:** Awwal

---

## Demo Credentials

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Super Admin | _(from seed)_ | _(from seed)_ | Full system access |
| Dept Admin | _(from seed)_ | _(from seed)_ | Department-level access |
| MDA Officer | _(from seed)_ | _(from seed)_ | MDA-scoped access |

> Refer to `apps/server/src/db/seed-demo.ts` for current demo accounts.

---

## What Changed Since Last Checkpoint

- [ ] _List stories completed since the previous UAT checkpoint_
- [ ] _Summarize key features, fixes, or behaviour changes_

---

## What to Test

### Story X.Y: [Story Title]

- [ ] _Test scenario 1: Description of what to verify_
- [ ] _Test scenario 2: Description of expected behaviour_
- [ ] _Test scenario 3: Edge case or error handling to confirm_

### Story X.Z: [Story Title]

- [ ] _Test scenario 1_
- [ ] _Test scenario 2_

---

## What's Still Mock Data

- [ ] _List any features that use placeholder/demo data rather than real data_
- [ ] _Note any API endpoints that return hardcoded responses_

---

## Known Issues

| # | Description | Severity | Workaround |
|---|-------------|----------|------------|
| 1 | _Known issue description_ | Low/Med/High | _Workaround if any_ |

---

## Test Results

| Scenario | Pass/Fail | Notes |
|----------|-----------|-------|
| _Scenario 1_ | | |
| _Scenario 2_ | | |

**Overall Verdict:** _Pass / Partial / Fail_

**Tester Comments:**

---

# Epic 2 Checkpoint Boundaries

> **Reuse note:** When creating checkpoints for future epics, copy lines 1-69 of this file into a new `docs/uat-checkpoints/epic-N.md` file and replace the placeholder sections. The Epic 2 content below serves as a worked example.

## Checkpoint 1: After Story 2.2 (Immutable Repayment Ledger)

**Focus:** Ledger immutability verification

- [ ] Create a loan record and verify repayment entries appear in the ledger
- [ ] Confirm that ledger entries cannot be modified or deleted through the UI
- [ ] Verify that attempting to edit a ledger entry produces an appropriate error message
- [ ] Check that the loan balance updates correctly after each repayment entry
- [ ] Verify the audit trail captures who created each ledger entry and when

## Checkpoint 2: After Story 2.4 (Accelerated Repayment & Auto-Split)

**Focus:** Computation engine verification — do numbers match known real-world data?

- [ ] Enter a standard loan with known parameters and verify the computed repayment schedule
- [ ] Test accelerated repayment and verify the adjusted schedule is mathematically correct
- [ ] Verify last-payment adjustment handles rounding correctly (no overpayment/underpayment)
- [ ] Cross-reference computed values with the Excel template's expected outputs
- [ ] Test edge cases: very small final payment, exact-amount final payment

## Checkpoint 3: After Story 2.7 (Loan Lifecycle States & Transitions)

**Focus:** Full Epic 2 UAT — complete loan lifecycle walkthrough

- [ ] Create a new loan from scratch through MDA officer interface
- [ ] Walk through entire lifecycle: active → repaying → completed
- [ ] Verify search and retrieval of loan records by various criteria
- [ ] Test state transitions — confirm invalid transitions are rejected
- [ ] Verify outstanding balance computation at various points in the lifecycle
- [ ] Review historical reconstruction — can you see the loan's full history?
- [ ] Final data integrity check: all numbers, dates, and statuses are consistent
