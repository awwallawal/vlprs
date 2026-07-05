# Prompt for Winston (Architect) — W2-amended 17a schema design session (2026-07-04)

> Copy everything below the line into a fresh CLI session.

---

Load the BMAD Architect agent (Winston) from the `_bmad/` framework. This session produces the **W2-amended 17a schema design** — the single blocking artifact for the Deputy AG signature pack (its Appendix W slot is open and waiting for you). You are the programme's critical path: the two-line pack is assembled, the PO has confirmed its shape, the consolidation ledger is second-read-verified, and everything now waits on this design plus PO approval of it.

## Context (one paragraph)

Between 2026-07-02 and 2026-07-04, a dual-agent adversarial audit produced a frozen 26-finding register (H1–H26). Its only ticking-clock finding is **H3**: `ledger_entries` carries denormalised `staffId`/`mdaId` inside an immutable table, while three existing mechanisms mutate identity/ownership on `loans` without touching the ledger — so every identity repair leaves history keyed to superseded knowledge, uncorrectable by design. Epic 17a (authorised pilot scope) is about to ship a persons table and multiply exactly those re-attribution events. A W2 architect brief was drafted for you; PM John's SCP Addendum 3 §4.5 amended the 17a schema story to incorporate it and wrote this gate into the story text verbatim: **"No persons-table implementation until the W2-amended schema design is approved."** Your deliverable satisfies that gate.

## Read in this order before designing anything

1. `_bmad-output/implementation-artifacts/winston-w2-brief-2026-07-04.md` — your primary input. The design rule (§2): *an immutable event may carry only facts true at event time that can never be re-judged; identity is mutable knowledge and resolves at read time through the join chain.* Applied: `staffId` DEPRECATE (+ lint/CI guard, drop at next safe migration); `mdaId` KEEP but re-defined as "collecting MDA" (historical fact); `person_loans`-style linkage; single-mutator rule for `loans.mdaId`; reader migration list; one transfer fixture added to the regression anchors.
2. `_bmad-output/implementation-artifacts/architect-winston-17a-schema-2026-04-20.md` — your own prior design being amended (person / inference_sidecar / identity_decision / name_frequency; additive-only; pilot_scope_tag).
3. `_bmad-output/implementation-artifacts/harmonised-findings-2026-07-04.md` — **§1–§9 are FROZEN** (do not edit or re-litigate): §2 rows **H3, H6, H11, H12, H17** are yours. **§10 is the binding two-track execution contract.**
4. `_bmad-output/planning-artifacts/scp-addendum-3-2026-07-04-DRAFT.md` — §4.5 (your amendment + the verbatim gate), §11 (your handoff block), §3 (the 17f repair stories you will architect later — context only, NOT this session's scope).
5. `_bmad-output/planning-artifacts/scp-consolidation-ledger.md` — §A.1 rows "17a schema", "17.4", "17.4b" (your fold chains, verified current by the second-read); **§E Line-1 note** (you are the critical path; the G5 staging option is recorded there); §G/§G.1 (the second-read trail).
6. `_bmad-output/planning-artifacts/scp-addendum-4-2026-07-04-DRAFT.md` — §3.2 only: the field-lesson amendments touching your tables (Yoruba diminutive map as **ops-editable JSON**, known-variants table, token-sort; namesake guard; the sequential-loans policy converging with H21's LOAN_CYCLE — one segmentation design, and a `sequential-vs-concurrent loans` schema question in the 17.8 context).
7. `_bmad-output/planning-artifacts/deputy-ag-signature-pack-2026-07-04-DRAFT.md` — the pack your deliverable closes (Appendix W).
8. `packages/shared/src/constants/vocabulary.ts` — non-punitive vocabulary is mandatory in everything you write.

**If any referenced file is missing or contradicts this prompt, STOP and report the discrepancy — do not improvise around it.**

## Your first act (mandatory, before designing)

**Independently re-run the H3 falsification test** (W2 brief §5 / Fable critique §6.2). Verify from source, not from the brief's prose:
- `grep`/read: does any operational read path consume `ledger_entries.staffId`?
- Confirm the three mutators (`updateStaffId` at `loanService.ts:585`, dedup reassign at `deduplicationService.ts:420`, transfer completion at `employmentEventService.ts:468`) touch `loans` but never `ledger_entries`.
- Confirm `computeBalance` joins by `loanId` alone (why balances survive today).
- Confirm no planned 17a story writes person attributions into the ledger.

Result of your test outranks the brief. If you refute any part, the refutation goes to Awwal — not into silent absorption.

## Deliverable

**`_bmad-output/implementation-artifacts/architect-winston-17a-schema-2026-07-04-W2-AMENDED.md`** — the amended 17a schema design:

1. **Apply the W2 rule to your four tables + ledger keying:** the `person_loans` (or equivalent) linkage; re-pointing evented via your existing `identity_decision` (the brief's view: a ledger-side event type is then unnecessary — confirm or refute); `ledger_entries.staffId` deprecation path (no-new-readers guard + drop migration plan); `mdaId` collecting-MDA semantic named in the schema comment; the single-mutator rule for `loans.mdaId` (service-level or DB-policy — your call, with `loan_state_transitions`-grade auditing).
2. **Reader migration list:** `selectByMdaAndLoan` + any MDA-scoped ledger view declares which semantic it wants (current owner vs historical collector).
3. **Regression anchors:** the canonical fixtures (Alatise, Lamidi, ADELEKE, CDU) **plus the transfer fixture** — entries under MDA-A, person transfers to MDA-B; assert (a) balance identical before/after re-pointing, (b) MDA-A keeps historical collector attribution, (c) person attribution resolves to the same human at both MDAs.
4. **Account for the A4 schema-relevant items** (read #6): where the diminutive-map JSON and known-variants live relative to `person_aliases`/`name_frequency`; whether the sequential-loans question needs anything in 17a's tables now or rides 17.8 — decide and state it.
5. **W1 write-through statement:** one section confirming the keys W1 (posting pipeline, 17f.1) will eventually write through are sound under this design — design compatibility only, no W1 implementation (explicit non-goal, W2 brief §4).
6. **Envelope discipline:** everything stays inside the authorised 17a envelope. Anything you judge to exceed it goes into a flagged "Line-2 request" section at the end — flag it, never absorb it. No data backfill; existing stale ledger `staffId` values stay as-is until the deprecation migration.
7. **G5 note:** state whether anything in your design depends on the diminutive map clearing native-speaker review, given the staging option (9 rules for pilot activation; map as fast-follow) recorded in ledger §E.

Length discipline: ≤400 lines, tables per decision point — same format as your 2026-04-20 deliverable.

## Hard constraints

1. **Do not edit** the frozen harmonised register, the session log, the consolidation ledger (John maintains it), or anything under `scripts/legacy-report/`.
2. No code, no migrations run — this is a design artifact; migrations are written under the story after authorisation.
3. Non-punitive vocabulary throughout.
4. The verbatim gate stands until the PO approves your deliverable: **"No persons-table implementation until the W2-amended schema design is approved."**

## End your session with

1. The deliverable file written.
2. A **PASS/REFUTE verdict on the H3 falsification test** with file:line evidence.
3. A one-line **Appendix-W readiness statement** for PM John ("design complete, envelope-clean / with N flagged Line-2 items") so the signature pack can close on PO approval.
4. Any open questions for Awwal, each with your recommendation in one sentence.
