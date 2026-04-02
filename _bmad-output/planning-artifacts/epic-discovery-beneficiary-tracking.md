# Epic Discovery Briefing: Beneficiary Tracking Pipeline
## For: John (PM) — Discovery Session Preparation

**Author:** Bob (Scrum Master), on behalf of Awwal (Product Owner)
**Date:** 2026-03-29
**Source:** E7+E6 Retro — Planning Item A
**Priority:** Plan after E8 prep stories complete

---

## What Is This?

A new capability that tracks the lifecycle of car loan beneficiaries from **committee approval** (outside the system) through to **operational status** (MDA monthly returns appearing in VLPRS). Currently, there is no link between "the committee approved this person's loan" and "this person's loan deductions are showing up in MDA submissions."

---

## Why Is It Needed?

### The Current Gap

1. **Approval happens outside VLPRS.** The Car Loan Approval Committee meets and produces approved beneficiary lists (Excel files). These exist as paper/spreadsheet records only.
2. **VLPRS only knows about loans that appear in MDA monthly returns** — either via legacy migration uploads or via monthly CSV submissions from MDA officers.
3. **Nobody can answer:** "Of the 500 loans approved in 2024, how many are actually operational — i.e., the MDA is reporting monthly deductions?"
4. **The AG needs this visibility** to ensure the payroll offices are actually deducting approved loans, not just sitting on approval letters.

### The Business Question

> "We approved X loans. Are they all being deducted? If not, which ones are missing and at which MDAs?"

This is the **Onboarding Pipeline** — already stubbed as a section in the Executive Summary report (Story 6.1) but currently empty because there's no approval data in the system.

---

## What Data Exists?

Awwal has the following files ready for ingestion:

| File | Description | Period |
|------|-------------|--------|
| **2024 Approved Beneficiaries** | Primary approval list from committee | 2024 |
| **2024 Addendum** | Additional approvals added after initial list | 2024 |
| **2025 Approved Beneficiaries** | New year's approval list | 2025 |
| **2025 Retirees List** | Staff who took car loans and have since retired | 2025 |

These files likely contain: staff name, staff ID, MDA, approved principal amount, approval date, and possibly tenure/rate details.

**Location:** Awwal holds these files. They have not been uploaded or committed to the repository yet. Ask Awwal to provide them for schema analysis during discovery.

---

## What Has Been Done So Far?

### Existing Infrastructure That Supports This

1. **Loan records** (`loans` table) — already support `status` field with values including `ACTIVE`, `COMPLETED`, `RETIRED`, etc. A new `APPROVED` status could be added.

2. **Migration upload pipeline** (Epic 3) — handles Excel file upload, column mapping, validation, and record creation. Could be extended or a parallel pipeline built for approval lists.

3. **MDA submission pipeline** (Epic 5) — handles monthly CSV uploads with staff ID + deduction amount. This is where "operational" status would be confirmed — when an approved staff ID appears in a monthly submission.

4. **Three-way reconciliation** (Story 7.0i) — compares Expected (VLPRS loans) vs Declared (MDA submissions) vs Actual (payroll). The approval list would add a fourth dimension: **Approved** vs Expected vs Declared vs Actual.

5. **Executive Summary report** (Story 6.1) — has an **Onboarding Pipeline Summary** section that is currently stubbed/empty. This is where approval-to-operational metrics would surface.

6. **Loan classification service** — classifies loans as ON_TRACK, OVERDUE, STALLED, etc. A new classification for "APPROVED but not yet ACTIVE" would be needed.

7. **Attention items** (Story 4.2) — dashboard cards that surface items needing attention. "X approved loans not yet operational after Y months" would be a natural attention item.

### What Does NOT Exist Yet

- No upload pipeline for approval lists (different schema from migration files)
- No `APPROVED` loan status in the state machine
- No matching logic between approved beneficiaries and operational loans (by staff ID + MDA)
- No "Onboarding Pipeline" dashboard view
- No aging/alerting for approved-but-not-operational loans

---

## Domain Context

### How the Approval Process Works (Outside VLPRS)

1. Staff member applies for car loan through their MDA
2. MDA compiles applications and submits to the **Car Loan Approval Committee**
3. Committee reviews, approves/rejects, produces an **Approved Beneficiaries List**
4. Approved list goes back to MDAs
5. MDAs are supposed to start deducting from payroll
6. MDAs report monthly deductions via CSV to VLPRS

**The gap is between steps 4 and 6.** Some MDAs may delay starting deductions. Some approved loans may never become operational. Currently no visibility into this.

### Loan Computation Model

- Single rate: 13.33%
- Single base: divide by 60 always
- Monthly interest = (P × 0.1333) ÷ 60 regardless of tenure
- Four settlement pathways (normal, accelerated, early exit, retirement)
- Full model documented in: `.claude/projects/.../memory/domain_loan_computation.md`

### Non-Punitive Vocabulary (Critical)

All user-facing language must follow approved vocabulary from `packages/shared/src/constants/vocabulary.ts`:
- "Not yet operational" — not "Missing" or "Failed to start"
- "Awaiting first deduction" — not "Delinquent MDA"
- "Onboarding pipeline" — not "Backlog" or "Pending"

---

## Suggested Approach (For John's Consideration)

### Proposed Loan Lifecycle Extension

```
Current:   ACTIVE → COMPLETED | RETIRED | TRANSFERRED | WRITTEN_OFF
Proposed:  APPROVED → ACTIVE → COMPLETED | RETIRED | TRANSFERRED | WRITTEN_OFF
                ↓
           (if no deduction after X months → attention item)
```

### Proposed Feature Set (High-Level)

1. **Upload approved beneficiary list** — new upload pipeline (simpler than migration — fewer columns)
2. **Create APPROVED loan records** — loans exist in system but are not yet ACTIVE
3. **Auto-match on submission** — when MDA submits monthly CSV containing a staff ID that matches an APPROVED loan, transition to ACTIVE
4. **Onboarding Pipeline dashboard** — "X of Y approved loans operational" with MDA breakdown
5. **Aging/alerting** — "Loan approved 3 months ago, still no deduction reported" → attention item
6. **Retirees handling** — special pathway for staff who retired with outstanding loans (2025 Retirees List)

### Questions for Discovery

- What columns are in the approval list Excel files? (Need schema analysis)
- Is there a unique staff ID that matches between approval lists and MDA monthly returns?
- How should addendums be handled? (Additional approvals to existing lists)
- What's the expected timeline from approval to first deduction? (For aging threshold)
- Should the AG be able to see historical approval-to-operational rates per MDA?
- How does the retirees list interact with the temporal profile (Epic 10)?

---

## Files to Review Before Discovery Session

| File | Path | Why |
|------|------|-----|
| **Domain computation model** | `.claude/projects/.../memory/domain_loan_computation.md` | Understand rate/tenure rules |
| **Loan schema** | `apps/server/src/db/schema.ts` (loans table, ~line 160) | Current loan record structure |
| **Loan status values** | `packages/shared/src/constants/loanConstants.ts` | Current status enum |
| **Executive Summary service** | `apps/server/src/services/executiveSummaryReportService.ts` | Onboarding Pipeline stub |
| **Submission pipeline** | `apps/server/src/services/submissionService.ts` | How monthly returns are processed |
| **Three-way reconciliation** | `apps/server/src/services/threeWayReconciliationService.ts` | Existing matching patterns |
| **Attention items** | `apps/server/src/services/attentionItemService.ts` | How new attention types are added |
| **Migration upload** | `apps/server/src/services/migrationService.ts` | Upload pipeline pattern to reuse/extend |
| **Non-punitive vocabulary** | `packages/shared/src/constants/vocabulary.ts` | Required vocabulary constraints |
| **E7+E6 retro** | `_bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md` | Context for why this was identified |
| **Epics file** | `_bmad-output/planning-artifacts/epics.md` | Where the new epic will be added |

---

## Sizing Estimate (Bob's Initial Take)

This feels like a **5-7 story epic** based on similar scope (Epic 5 was 5 stories for MDA submission pipeline). Likely:
- 1 story: approval list upload + APPROVED loan creation
- 1 story: auto-match on submission (APPROVED → ACTIVE transition)
- 1 story: onboarding pipeline dashboard + MDA breakdown
- 1 story: aging/alerting + attention items
- 1 story: retirees handling
- Optional: historical approval-to-operational analytics

**Dependency:** Should run AFTER E8 prep stories (8.0a-8.0g) so the computation model is trustworthy. Could potentially run in parallel with E8 core stories (8.1-8.3) if the prep stories are done.

**Suggested placement in sprint sequence:** After E8, before or parallel with E12. Discuss with Awwal.
