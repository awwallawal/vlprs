# Story 17.11: Missing-Record Detection + MDA Prompt

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **reconciliation layer and the MDAs it prompts**,
I want expected-but-missing months detected per active loan with SLA-tracked MDA notification — suppressed with a recorded reason where the person is expected to be gone,
So that silence in the data is either chased or explained, never ambient.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×2: Addendum 2 §4.2.3 (parked in 17c; published 2026-07-06) → Addendum 4 §3.7 (published 2026-07-06) [L1]. Chain restored per ledger §G C2.

**Priority:** core Epic 17, Loan & Lifecycle sub-theme.

## Scope (folded)

**Base (SCP §4.1):** detect expected-but-missing months per active loan; notify MDA with SLA; escalate on expiry.

**+ A2 §4.2.3 — self-healing reconciliation sweep [PARKED IN 17c]:** every ingest pipeline includes a reconciliation sweep that prunes stale artefacts + auto-demotes/promotes tier flags as evidence arrives. **This amendment is 17c scope** (couples with 17.11b, a 17c story, pending post-pilot authorisation) — recorded in the chain so the fold cannot drop it; it does NOT enter this story's near-term ACs.

**+ A4 §3.7 — LPC-Out grace suppression [L1]:** after a native LPC Out + 2 grace months, the detector does **not** fire for that MDA (the person is expected to be gone) — suppression reason recorded, so silence is explained rather than mysterious.

## Acceptance Criteria

1. **Given** an active loan with an expected month absent, **When** detection runs, **Then** the missing month is flagged and the MDA notified with an SLA timer; expiry escalates. [Base]
2. **Given** a native LPC Out for a person, **When** 2 grace months have passed, **Then** the detector suppresses for that MDA and records the suppression reason (LPC_OUT_GRACE), visible on the loan's timeline. [A4, L1]
3. **Given** the suppression, **When** the person reappears in the source MDA's returns, **Then** suppression lifts and normal detection resumes. [A4, L1 — boundary behaviour]
4. *(17c-parked, not buildable here)* **Given** post-pilot 17c authorisation, **When** 17.11b lands, **Then** the self-healing sweep amendment activates per A2 §4.2.3. [A2 — recorded, parked]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.11; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Missing-month detection + MDA prompt + SLA escalation |
| 2 | A2 §4.2.3 (`scp-2026-04-15-addendum-2.md`) | Self-healing reconciliation sweep — PARKED IN 17c (couples with 17.11b); chain restored per §G C2 |
| 3 | A4 §3.7 (`scp-addendum-4-2026-07-04.md`) | L1 LPC-Out + 2-month grace suppression with recorded reason |

Evidence keys carried: L1
Collision resolution: none
Engine status (per ledger §A): —
Pending amendments: none — additions queue to A5+ (A2 §4.2.3 activates via 17c authorisation, not via addendum)
