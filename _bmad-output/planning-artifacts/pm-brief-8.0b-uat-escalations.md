# PM Briefing: Story 8.0b UAT Escalations

**From:** Dev Team (UAT session 2026-04-01)
**To:** John (PM)
**Date:** 2026-04-01
**Status:** ✅ TRIAGED (2026-04-02) — all decisions made, epics.md and sprint-status.yaml updated.
**Context:** During Story 8.0b UAT (Record Detail View & Pre-Baseline Inspection), Awwal identified four product-level concerns that exceed the scope of 8.0b prep work. These need PM triage: assign to Epic 15, create a dedicated Epic, or distribute across existing stories.

**Evidence base:** Real UAT with BIR legacy data. The Alatishe case (account officer confirmed 42→22 months data entry error) and Moshood case (finished paying but overall variance persists) are the anchoring examples.

## PM Triage Decisions (2026-04-02)

| # | Escalation | Decision | PM Refinements |
|---|---|---|---|
| 1 | Period indicator | Extend 8.0d with **confirmation gate** (not passive badge) | Gate stops wrong-month upload before processing begins |
| 2+3 | MDA Review Handoff | New prep story **8.0j** — parallel with 8.0h+8.0i | Mandatory correction reason for ALL roles (not just MDA_ADMIN). **14-day** per-MDA review window (not 7). 3-day countdown at day 11. DEPT_ADMIN extends as needed (no reason required for extension). **Bulk correction import/export** — download .xlsx worksheet, correct in Excel, re-upload with preview before apply. Conflict detection via download timestamp |
| 4 | Cross-month anomaly | New **Epic 16** — sprint 12, parallel with E12 | Discovery spike required before story breakdown. 3-5 stories estimated. Not E15 (different analytical concern) |

**Updated E8 sequence:** `8.0a → 8.0b → 8.0c → 8.0d → (8.0e + 8.0f parallel) → 8.0g → (8.0h + 8.0i + 8.0j parallel) → UAT checkpoint → 8.1`

---

---

## Escalation 1: Period Indicator During Upload

**What Awwal asked:** "When we are uploading data, how can we have a sticker to show the month(s) we are currently updating?"

**Why it matters:** The upload flow currently gives no visual confirmation of which period the data covers. When handling August 2024 vs September 2024 files, the user relies on filename alone. A persistent period badge/indicator prevents wrong-month uploads.

**Overlap with existing work:** Story **8.0d (Multi-Sheet Period Handling)** — already `ready-for-dev` — includes "period display in results." But Awwal's ask is broader: a visible period indicator throughout the upload workflow (not just after processing).

**Recommendation:** Extend 8.0d's scope to include a period badge in the upload header/progress area. Minor UI addition, natural fit. No new story needed unless 8.0d is already at sizing limit.

**Draft AC (for 8.0d extension):**
> Given an upload in progress, When viewing the upload page, Then a period indicator shows the detected month/year (e.g., "August 2024") based on the sheet metadata or filename, visible from the upload step through validation results.

---

## Escalations 2 + 3 (Unified): MDA Review Handoff Workflow

**What Awwal asked:** "The power to reconcile still lies with the MDA Accounting Officers... there should be an explanation for every adjustment."

**Why it matters:** The Alatishe case proves it — the Department Admin (Car Loan head) could not resolve the 42→22 months error without the MDA Accounting Officer's domain knowledge. The current system limits correction to `DEPT_ADMIN` role only. A vast majority of records will need MDA-level knowledge to correct. And when corrections ARE made, the AG needs to know WHY — not just what changed.

**The core insight:** Authority (DEPT_ADMIN) and knowledge (MDA_ADMIN) are separated. The system must bridge them.

### The Problem Without This Workflow

With the smarter batch baseline (Escalation 1b below), the DEPT_ADMIN can auto-baseline Clean + Minor Variance records and skip the rest. But the skipped records become a dead end — the DEPT_ADMIN can't fix them, and the MDA officer can't see them. Records rot in permanent limbo.

### Three-Stage Pipeline Design

```
Stage 1: DEPT_ADMIN uploads → auto-baselines clean records → flags variance records
              ↓
Stage 2: MDA_ADMIN reviews flagged records → corrects with mandatory explanation
              ↓
Stage 3: DEPT_ADMIN verifies corrections → baselines
```

#### Stage 1: Upload & Selective Baseline (DEPT_ADMIN)

The "Establish Baselines" confirmation dialog changes from "all or nothing" to:

- **Auto-baseline:** Clean + Minor Variance records (low risk, data matches or nearly matches)
- **Flag for MDA review:** Significant Variance + Structural Error + Anomalous records
- Dialog shows: "65 records will be baselined immediately. 13 records will be flagged for MDA review."

The batch baseline backend already has skip logic (8.0b guard for outstanding > totalLoan). Extend to also skip by variance category.

#### Stage 2: MDA Review (MDA_ADMIN)

MDA Accounting Officer logs in → sees "Migration Records Requiring Your Review" section on their dashboard → clicks through to their MDA's flagged records → opens the existing RecordDetailDrawer → corrects values with **mandatory explanation** → saves.

**Two correction paths:**
1. **Values are wrong:** Officer corrects values AND provides explanation (e.g., "42 months should be 22 — staff paid 8 of 30")
2. **Values are correct (variance is intentional):** Officer provides explanation only, no value change (e.g., "₦600,000 approved as special case by PS — above GL08 standard entitlement")

Both paths write `correctedBy`, `correctedAt`, `correctionReason`. Path 2 leaves `corrected_*` value columns null — signaling "reviewed, no correction needed."

**State detection (no new status column needed):**

| State | Detection Logic |
|---|---|
| Pending MDA Review | `isBaselineCreated = false` AND significant+ variance AND `correctedBy IS NULL` |
| MDA Reviewed | `isBaselineCreated = false` AND `correctedBy IS NOT NULL` AND `correctionReason IS NOT NULL` |
| Baselined | `isBaselineCreated = true` |

The correction act IS the review. No new enum, no new status column.

#### Stage 3: Verify & Baseline (DEPT_ADMIN)

DEPT_ADMIN returns to the migration page → sees per-MDA review progress:

```
MDA Review Progress
BIR:          10/13 reviewed  ████████░░ 77%
Agriculture:   5/8  reviewed  █████░░░░░ 63%
Education:     0/4  reviewed  ░░░░░░░░░░  0%

[Baseline MDA-Reviewed Records (15)]
```

Clicks individual record → drawer shows correction + reason + who reviewed → baselines individually or batches all reviewed records.

### Separation of Duties

| Action | DEPT_ADMIN | MDA_ADMIN |
|---|---|---|
| Upload migration file | Yes | No |
| View all MDA records | Yes | No (own MDA only) |
| Batch baseline (clean) | Yes | No |
| Open RecordDetailDrawer | Yes | Yes (own MDA only) |
| Submit corrections | Yes (reason optional) | Yes (reason mandatory) |
| Mark reviewed (no correction) | Yes | Yes (reason mandatory) |
| Establish baseline | Yes | No |

### What Needs Building

| Component | Change | Size |
|---|---|---|
| `correction_reason` column | 1 migration, schema update | Small |
| Smarter batch baseline | Extend existing skip logic to include variance category | Small |
| Correction form: reason field | Add textarea, mandatory for MDA_ADMIN, optional for DEPT_ADMIN | Small |
| "Mark Reviewed — No Correction" | Set correctedBy/correctionReason without changing values | Small |
| MDA_ADMIN migration review page | Filtered view of their MDA's pending records + existing drawer | Medium |
| DEPT_ADMIN progress tracker | Per-MDA review counts + "Baseline reviewed" batch action | Medium |
| Role-scoping on correction endpoint | MDA_ADMIN can correct their MDA only, cannot baseline | Small |

### Draft Story Shape

> **Story: MDA Review Handoff Workflow**
>
> As the **AG/Department Admin**, I want the batch baseline to auto-baseline clean records and flag variance records for MDA officer review, and as an **MDA Accounting Officer**, I want to review my MDA's flagged migration records and submit corrections with mandatory explanations, So that records are corrected by the person with actual domain knowledge before baselines are established, with a complete audit trail of who corrected what and why.
>
> Key ACs:
> 1. Batch baseline auto-baselines Clean + Minor Variance, skips Significant Variance + Structural Error + Anomalous
> 2. Confirmation dialog shows breakdown: "X will be baselined, Y flagged for MDA review"
> 3. MDA_ADMIN sees "Migration Records Requiring Review" on their dashboard, filtered to their MDA
> 4. MDA_ADMIN can open RecordDetailDrawer, submit corrections with mandatory `correction_reason` (min 10 chars)
> 5. MDA_ADMIN can mark a record as "reviewed, values correct" with mandatory explanation (no value change)
> 6. MDA_ADMIN cannot establish baselines — authority remains with DEPT_ADMIN
> 7. DEPT_ADMIN sees per-MDA review progress tracker with completion percentages
> 8. DEPT_ADMIN can batch-baseline all MDA-reviewed records or baseline individually from drawer
> 9. Correction history in drawer shows: original values, corrected values (if any), reason, who, when
> 10. All state detection uses existing columns — no new status enum or column beyond `correction_reason`

**Estimated size:** 1 story, ~10-12 tasks. Depends on Story 8.0b (correction infrastructure).

**Recommended placement:** E8 (after 8.0i prep, before 8.1) or parallel track alongside E8 core stories.

### UAT Evidence

- **Alatishe case:** BIR officer confirmed installments outstanding should be 22 (30 tenure - 8 paid), not 42 as entered. Only the MDA officer had this knowledge. DEPT_ADMIN had to phone the officer to learn this.
- **Moshood case:** Staff who finished paying but still shows overall variance. Needs MDA domain knowledge to explain whether the variance is a data entry error or an intentional deviation.

---

## Escalation 4: Cross-Month Anomaly Detection

**What Awwal asked:** "If we get data for September 2024, we should be able to make comparison about the data and point out inconsistencies across months."

**Specific anomalies to detect:**

| Anomaly Type | Description | Example |
|---|---|---|
| **Disappearing beneficiary** | Name present in month N, absent in month N+1, reappears in month N+2+ | Staff stopped paying for 1 month — why? |
| **Principal drift** | Approved loan amount changes between monthly submissions | ₦450,000 in Aug → ₦500,000 in Sep — data entry error or renegotiation? |
| **Deduction drift** | Monthly deduction amount changes without clear reason | ₦16,999 in Aug → ₦15,000 in Sep — partial payment or error? |
| **Phantom completion** | Staff disappears (assumed completed) but balance calculation shows payments remaining | Moshood pattern — vanishes from submissions but loan not fully repaid |
| **New appearance** | Staff appears for first time mid-stream (not in earlier months) | Late addition or different loan? |

**Why it matters:** Each anomaly is currently invisible. The AG has no way to know that a beneficiary's principal changed between months unless someone manually compares spreadsheets. This is the **systemic data quality layer** that turns VLPRS from a migration tool into an ongoing governance instrument.

**Data model readiness:** Monthly submissions already have `period_month`/`period_year`. Submission rows have `staff_name`, `staff_id`, financial fields. The infrastructure exists — the comparison logic and surfacing UI are the new work.

**Scale:** This is a significant feature — likely 3-5 stories. It involves:
1. Cross-month diffing engine (backend comparison logic)
2. Anomaly classification and severity (similar to observation engine)
3. Per-record drill-down (reuse RecordDetailDrawer pattern)
4. Dashboard surfacing (attention items or dedicated anomaly report)
5. MDA-scoped views (each MDA sees their anomalies)

**Recommendation:** This is too large for a single story or a bolt-on. Two options:

| Option | Description |
|---|---|
| **Add to Epic 15** | Stories 15.3 (Monthly Onboarding Scan) and 15.6 (Attention Items) already touch cross-month analysis. Extend Epic 15's scope to include anomaly detection for existing beneficiaries, not just new onboardees |
| **New Epic (E16?)** | "Cross-Month Data Integrity & Anomaly Detection" — dedicated epic with its own story arc. Cleaner separation of concerns, avoids overloading E15 |

**Dev team leans toward:** New Epic. Epic 15 is specifically about beneficiary *onboarding* pipeline. Cross-month anomaly detection applies to *all* beneficiaries (existing + new) and is a fundamentally different analytical concern. Mixing them would blur E15's focus.

---

## Decision Matrix for John

| # | Escalation | Recommended Placement | Size Estimate | Dependencies |
|---|---|---|---|---|
| 1 | Period indicator during upload | Extend Story 8.0d | Small (1-2 subtasks) | None |
| 2+3 | MDA Review Handoff Workflow (unified: smarter batch + MDA officer access + mandatory explanations) | New story in E8 (after 8.0i, before 8.1) | Medium-Large (1 story, ~10-12 tasks) | Story 8.0b (correction infra) |
| 4 | Cross-month anomaly detection | New Epic (E16?) or extend E15 | Large (3-5 stories) | Epic 5 (submissions), Story 8.0d (periods) |

**Key decision for John:** Escalation 2+3 is one cohesive three-stage pipeline (selective baseline → MDA review → DEPT_ADMIN approval). It should NOT be split into separate stories — the stages depend on each other.

**Awwal's preference:** Break clean from 8.0b, let John decide placement, then proceed with 8.0c and the rest of E8 prep.

---

## References

- Story 8.0b file: `_bmad-output/implementation-artifacts/8-0b-record-detail-view-pre-baseline-inspection.md`
- UAT evidence: Alatishe case (42→22 months), Moshood case (completed but variance persists)
- E7+E6 retro: `_bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md`
- Epic 15 spec: `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md`
- Sprint status: `_bmad-output/implementation-artifacts/sprint-status.yaml`
