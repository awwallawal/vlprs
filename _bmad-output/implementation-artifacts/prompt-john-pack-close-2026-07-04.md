# Prompt for John (PM) — Signature-pack close after Appendix W approval (2026-07-04)

> Copy everything below the line into a fresh CLI session (or hand to the running John session).

---

Load the BMAD PM agent (John) from the `_bmad/` framework. **Appendix W is approved.** The PO (Awwal) approved Winston's W2-amended 17a schema design on 2026-07-04, after the W2-brief-author's source-verified endorsement. The verbatim 17a design gate ("No persons-table implementation until the W2-amended schema design is approved") is satisfied and released — recorded in the deliverable's status banner. The sole blocker on the signature pack is cleared. Your session closes the pack.

## State you inherit

- **Approved design:** `_bmad-output/implementation-artifacts/architect-winston-17a-schema-2026-07-04-W2-AMENDED.md` — STATUS banner carries the PO approval; **rider (i)** (CI grep-guard asserts the single-mutator rule for `loans.mdaId`) is already folded into its §2.2 P1 guard and §4; **rider (ii)** is cross-referenced in its §1 boundary check and routed to YOU (below). H3 falsification: PASS on all four legs, file:line evidence in its §1.
- **Endorsement record:** the W2 brief author endorsed with two riders; the consolidation ledger §F was updated by that session with the endorsement, both riders, and state.
- **Pack:** `_bmad-output/planning-artifacts/deputy-ag-signature-pack-2026-07-04-DRAFT.md` — Appendix W row currently reads OPEN.

## Your acts (in order)

1. **Rider (ii) — add one AC line to A3 §3 story 17f.1** (`scp-addendum-3-2026-07-04-DRAFT.md`), pre-signature. Substance: the upload-supersede purge (`migrationService.ts:903–934`; `tx.delete(ledgerEntries)` at :920) currently deletes whole loan threads under a sanctioned trigger-disable; once 17f.1 posts real PAYROLL events, a supersede would silently destroy posted deduction history with no replay. The AC must require 17f.1 to make posted PAYROLL events supersede-safe (block, archive-and-replay, or equivalent — Winston/Amelia decide the mechanism at story time; the AC pins the property). Verified from source independently by both agents 2026-07-04. Cite [H1-adjacent, W2 rider (ii)] in the story header per the anti-drift rule.
2. **Seat Appendix W:** update the pack's Appendix table row W → Ready (approved 2026-07-04), and remove/resolve the "one appendix slot open" line in the pack header.
3. **Ledger §F step 4:** mark the Step-4 blocker cleared — pack CLOSED pending only the D-a cover-note sentence decision and delivery to the Deputy AG. (The ledger is yours to maintain.)
4. **D-a bracketed sentence:** the cover note still carries the bracketed disclosure sentence pending the PO's D-a decision (staleness chip). Confirm with Awwal: ship-and-tell (keep the sentence) or hold (delete the bracket). Do not decide for him.
5. **Hand the closed pack to Awwal** for presentation to the Deputy AG.

## After signature (do not start now — sequence for the record)

Line 1 → Sprint 1 starts; Winston's approved schema design governs 17.3/17.4 migrations. Line 2 → Bob Step-5 fold (consolidated story files + sprint-status wiring), Sally UX spec (Role–Job–Screen matrix), PRD Delta Addendum, Agreement 30 adoption.

## Hard constraints

- Do not edit the frozen harmonised register, the session log, Winston's approved deliverable, or anything under `scripts/legacy-report/`.
- Non-punitive vocabulary throughout (`packages/shared/src/constants/vocabulary.ts`).
- Nothing in this session authorises anything — the pack REQUESTS; the Deputy AG signs.
