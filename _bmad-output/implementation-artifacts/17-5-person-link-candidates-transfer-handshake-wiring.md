# Story 17.5: Person Link Candidates + Transfer Handshake Wiring

Status: backlog — consolidated at Step-5 fold 2026-07-06; A5 continuity guard folded 2026-07-09 (SPRINT-ELIGIBLE)

> **✅ GUARD LANDED (A5 §3.1, folded 2026-07-09):** the Species-C transfer continuity guard that had blocked this story is now the real blocking AC (AC #6 below), and the collector/parent-MDA registry seed is AC #7. **The `SPRINT-BLOCKED` banner is lifted — 17.5 is sprint-eligible.** History: the guard was queued as ledger §H item 3 (standing 2026-07-05) and folded here from Addendum 5 §3.1 on 2026-07-09, closing the dependency the way it was designed to close — explicitly, via a ledger fold row, not by luck.

## Story

As the **identity layer and both MDAs party to a staff transfer**,
I want `person_link_candidates` surfaced proactively as Pending Handshakes wired into the existing Transfer Handshake workflow — with overlap cases routed to their own distinct workflow,
So that cross-MDA continuations resolve through a handshake both MDAs confirm, and same-time-two-MDAs cases are never misfiled as transfers.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×3: Addendum 1 §3 (2026-04-18) → Addendum 4 §3.6 (published 2026-07-06) → Addendum 5 §3.1 (folded 2026-07-09). Ledger row X-9.

**Priority:** post-17a core Epic 17; **sprint-eligible** (A5 continuity guard landed 2026-07-09).

## Scope (folded)

**Base (SCP §4.1):** `person_link_candidates` table + proactive Pending Handshake surfacing to both MDAs + wiring into the existing Transfer Handshake workflow (Agreement: transfers resolve by handshake, not silent re-attribution).

**+ A1 §3 — the overlap valve:**
Overlap cases (`OVERLAPPING_MDA_PRESENCE` verdict from 17.4) do **NOT** file Pending Handshake — they are not transfers (same person present in two MDAs at the same time). They route to a distinct workflow:
1. Namesake frequency check (name appears ≥N times across scheme → require namesake disambiguation UI);
2. MDA hierarchy check (both MDAs share a `reporting_parent_mda` → flag as concurrent reporting, not merge);
3. Manual disposition by Dept Admin (rare residual).

**+ A4 §3.6 — field-confirmed valve + native LPC Out [L1, L9]:**
1. **Native LPC Out consumption** (L1): when an MDA submits LPC Out natively, the engine reads it as the authoritative transfer-out marker rather than inferring from cross-MDA timelines (FR109). **LPC Out + non-zero outstanding = transfer-with-debt = handshake required, not Path 3** (boundary rule feeds 17.22).
2. **PARENT_CHILD_OVERLAP bypass** (L9): AGRICULTURE↔CDU-class same-period appearances resolve to the parent/child verdict — never auto-treated as transfer or duplicate-deduction.

**Collision home (ledger §B) — X-9:** A1 already added the overlap distinct workflow; **L9 is its field confirmation plus the parent/child sub-case. Same valve, ONE implementation** — the A4 amendment extends the A1 workflow's hierarchy check, it does not add a second mechanism.

**+ A5 §3.1 — transfer continuity guard + collector registry [P4, P5]:**
1. **Continuity guard (P4, blocking):** on any cross-MDA reassignment the receiving MDA MUST carry forward the sending MDA's true installments-paid; a backward restatement is a blocking reconciliation event (AC #6). Ties to the W2 schema's `loan_mda_reassignments` + `person_loans` — the reassignment is evented and the continuity check runs at that event. The identity-side half (confident-ID resolution + principal-segmentation so sequential loans are never fused) lives in 17.4 (A5 §3.2, consumer-tie — the X-8 single-design precedent; 17.4 adds no new matching logic).
2. **Collector/parent-MDA registry seed (P5):** seed data on the existing `mdas.parentMdaId` carrier (`schema.ts:44`), NOT net-new schema. Flags CDU / AANFE(ANFE) as collecting units so a central collector is classified reporting-layer, never physical-transfer (AC #7). *(Source correction, ledger §J.1: earlier drafts cited `is_autonomous`/`reporting_parent_mda` as shipped "17.21 fragment" columns — those names are **not** in the current schema; whether the fragment shipped under other names is a build-time confirmation, not an asserted fact. `parentMdaId` is a valid carrier; the decision — "seed, not net-new" — is unchanged.)*
3. **Build principle (record, do NOT implement here):** the collector knowledge currently lives as a hard-coded two-name list in SQ-1 (`transfer-restatement.ts:32` — `CDU || /A*ANFE/`). The app must read it as **seed data on the schema, never hard-code it** — it gates a *blocking* reconciliation event, so a hidden, undeployable, or incomplete list is a landmine. *Promote-to-data; never hard-code a person-facing gate.* Completeness is cross-checked against the 21 detector-surfaced reporting-layer cases (the one guarantee a short hard-coded list cannot self-give).

## Acceptance Criteria

1. **Given** a `LOAN_CONTINUATION_CONSISTENT` verdict (17.4), **When** link candidates surface, **Then** a Pending Handshake is proactively visible to BOTH MDAs and resolves through the existing Transfer Handshake workflow. [Base]
2. **Given** an `OVERLAPPING_MDA_PRESENCE` verdict, **When** routing runs, **Then** NO Pending Handshake is filed; the case enters the overlap workflow: namesake check → MDA hierarchy check → manual disposition. [A1]
3. **Given** two MDAs sharing a `reporting_parent_mda` (e.g., AGRICULTURE↔CDU), **When** the same person appears in both for the same period, **Then** the verdict is parent/child concurrent reporting — never transfer, never duplicate-deduction. [A1 + A4, L9, X-9]
4. **Given** an MDA return carrying a native LPC Out marker, **When** parsed, **Then** the marker is the authoritative transfer-out signal (no timeline inference needed) per FR109. [A4, L1]
5. **Given** LPC Out with non-zero outstanding, **When** classified, **Then** the case is transfer-with-debt requiring handshake — explicitly NOT Path 3 settlement (boundary shared with 17.22). [A4, L1]
6. **Given** a cross-MDA reassignment, **When** the receiving MDA records the transferring person, **Then** it MUST carry forward the sending MDA's true installments-paid; a **backward restatement** (receiving paid-count < sending paid-count, with the balance jumping up by ~Δ×monthly) is a **BLOCKING reconciliation event** — it halts the handshake for adjudication and never silently overwrites the loan's progress. Arithmetic guard: the balance jump must be ~Δ×monthly (rejects new-loan-of-same-principal false positives). Ties to W2 `loan_mda_reassignments` + `person_loans` (reassignment is evented; the continuity check runs at that event). Evidence fixture: Oke Elizabeth (Agriculture paid 38 → Education resumed paid 35, +₦33,999 = 3×₦11,333). [A5 §3.1, P4]
7. **Given** a receiving MDA that is actually a central collector (CDU / AANFE), **When** classification runs, **Then** the collector/parent-MDA seed (`mdas.parentMdaId`) resolves it to a **reporting-layer** classification — never a physical-transfer or duplicate-deduction finding; the seed is reference data on existing schema, read as seed (never hard-coded), with completeness cross-checked against the 21 detector-surfaced reporting-layer cases. [A5 §3.1, P5]

## Sequencing

- **Blocked by:** 17.4 (verdict source + identity-side continuity tie, A5 §3.2). *(The A5 §H#3 continuity guard is no longer a sprint-entry gate — it folded into this story on 2026-07-09.)*
- **Feeds:** 17.22 (Path 3 boundary), Transfer Handshake workflow (existing).

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.5; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | person_link_candidates + proactive Pending Handshake + Transfer Handshake wiring |
| 2 | A1 §3 (`scp-2026-04-15-addendum-1.md`) | OVERLAPPING_MDA_PRESENCE distinct workflow (namesake check, hierarchy check, manual disposition) |
| 3 | A4 §3.6 (`scp-addendum-4-2026-07-04.md`) | L1 native LPC Out as authoritative marker (FR109); L9 parent/child bypass — field confirmation of A1's valve |
| 4 | A5 §3.1 (`scp-addendum-5-2026-07-09-DRAFT.md`), folded 2026-07-09 | P4 transfer continuity guard (blocking; backward-restatement = blocking reconciliation event; Δ×monthly arithmetic guard; ties W2 `loan_mda_reassignments`/`person_loans`; Oke fixture) + P5 collector/parent-MDA registry seed (CDU/AANFE; reporting-layer ≠ transfer; promote-to-data build principle). **Lifts SPRINT-BLOCKED.** |

Evidence keys carried: L1, L9, FR109, P4, P5
Collision resolution: X-9 (one valve; L9 = field confirmation + parent/child sub-case of A1's workflow); A5 identity-side tie follows X-8 precedent (guard build in 17.5, identity consumer-tie in 17.4)
Engine status (per ledger §A): YES — LPC Out extraction + Species-C transfer-restatement detector landed engine-side (`transfer-restatement.ts`, pin 667ebdd8)
Pending amendments: none — A5 §H#3 continuity guard FOLDED 2026-07-09 (AC #6/#7); additions queue to A6
