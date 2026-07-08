# Story 17.33: Retroactive Backfill (Catalog → PRP)

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As the **AG and every future auditor of migrated positions**,
I want the full catalog run through the Person Reconciliation Pass with hash-chained provenance, per-loan attestation seals, and a materiality policy,
So that every migrated opening balance is attested against evidence, reruns are diff-able by hash, and "backfill done" means attested — not merely executed.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×2: Addendum 1 §3 (2026-04-18) → Addendum 3 §4.2 (published 2026-07-06) [H15]. Ledger row: clean.

**Priority:** core Epic 17, Backfill & Pilot sub-theme. Sign-off gate before cutover.

## Scope (folded)

**Base (SCP §4.1):** run all catalog records through PRP (74,138 at SCP time; 89,502 post-Stage-1 qa_qa ingest per v2 Inventory; current catalog 104,396 at pin `667ebdd8` — the story runs whatever the current pin holds). Route medium-confidence to Dept Admin review. Sign-off gate before cutover. Dry-run + preview + rollback capability.

**+ A1 §3 — hash provenance:**
1. Carry catalog SHA-256, script SHA-256, **and all register SHA-256s** on every output row. Every `loan_attribution_history` entry, `audit_log` entry, and dashboard snapshot references the engine version + catalog + registers that produced it. Reruns are diff-able by hash. (External auditor 17.32 must be able to independently rerun against the same inputs.)

**+ A3 §4.2 — attestation + termination [H15]:**
2. **Per-loan attested opening-balance seal:** each backfilled loan's opening position carries attestor, evidence basis, and timestamp — the seal FR107 specifies.
3. **Materiality policy as a story input:** which variance magnitudes block the seal vs ride as recorded observations (policy value AG-editable per 17.31's pattern).
4. **Termination metric: % of loans attested.** The story is done when the attested share crosses the policy threshold — not when the script finishes running.

## Acceptance Criteria

1. **Given** the current catalog pin, **When** the backfill runs, **Then** every record passes through PRP with medium-confidence routed to Dept Admin review, under dry-run/preview/rollback discipline (17.0b contract). [Base]
2. **Given** any output row, **When** written, **Then** it carries catalog SHA-256 + script SHA-256 + all register SHA-256s; a rerun against identical inputs is hash-identical, and any diff is attributable. [A1]
3. **Given** a backfilled loan, **When** its opening balance is sealed, **Then** the seal records attestor, evidence basis, and timestamp (FR107). [A3, H15]
4. **Given** a variance at seal time, **When** evaluated against the materiality policy, **Then** it either blocks the seal or rides as a recorded observation — the policy value is AG-editable. [A3, H15]
5. **Given** the termination metric, **When** reported, **Then** "% of loans attested" is the completion measure and the cutover sign-off gate reads it. [A3, H15]

## Sequencing

- **Upstream:** 17.12 (PRP), 17.0b (DRY_RUN), 17.31 (policy pattern).
- **Downstream:** 17.34 (pilot reads attested positions); 17.32 (auditor reruns by hash); FR107.

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.33; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Catalog through PRP; review routing; sign-off gate; dry-run/preview/rollback |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | SHA-256 provenance (catalog + script + registers) on every output row; hash-diffable reruns |
| 3 | A3 §4.2 (`scp-addendum-3-2026-07-04.md`) | Attestation seal; materiality policy input; %-attested termination metric [H15] |

Evidence keys carried: H15 (+ FR107 anchor)
Collision resolution: none
Engine status (per ledger §A): —
Pending amendments: none — additions queue to A5+
