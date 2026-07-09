# Prompt for Bob (SM) — the A5 fold (2026-07-09), the last fold of the cycle

> Copy everything below the line into a fresh CLI session. Author≠verifier: you (Bob) fold and self-check; Fable does the final fold-verify (§J.3); John commits. That split is the discipline that caught 17.33a — kept even for this last, mechanical fold.

---

Load the BMAD SM agent (Bob). Execute the **A5 FOLD** — the last fold of the SCP 2026-04-15 governance cycle. A5 passed its Fable second-read (ledger §J), the PO ratified R-1…R-4 (§J.1), and John's corrections passed the diff-re-read (§J.2: PASS, "clear to fold"). **You fold the five §J-confirmed rows and self-verify, then HAND TO FABLE for the final fold-verify (§J.3).** Do NOT commit, do NOT flip A5 to PUBLISHED, do NOT land the chain-closed marker — those follow the verify. Bounded to the five fold rows (TA-28); touch no other story file.

Note on working-tree state: John's A5 §5/§3.1 + ledger §H corrections and Fable's §J/§J.1/§J.2 are **uncommitted on `dev`** (the whole close-out lands as one clean commit at the end). Your fold adds to that uncommitted set; do not commit it.

## READ FIRST
- ledger **§J.2** (the confirmed zero-drift fold-row list) + **§A.5** (FOLDED-record format) + `fold-manifest-2026-07-06.md` §3 (story-file + provenance-footer spec).
- `scp-addendum-5-2026-07-09-DRAFT.md` **§3.1–§3.5 + §6** (the exact amendment text; note §3.1 already carries the corrected schema fact).
- the five target files in `implementation-artifacts/`.

## FOLD — append each row to its consolidated file's chain
(APPEND, do not rewrite existing verified content; every added AC/scope item cite-tagged `[P#]`; update the provenance footer with an A5 source row + refresh the Pending-amendments line.)

1. **`17-5-person-link-candidates-transfer-handshake-wiring.md`** [A5 §3.1, P4/P5] — *the delicate one (the only file with an intended content change + a removal):*
   - **REPLACE placeholder AC #6** with the real **blocking AC** (A5 §3.1 verbatim intent): the receiving MDA MUST carry forward the sending MDA's true installments-paid; a backward restatement (receiving paid-count < sending, balance jumps ~Δ×monthly) is a **BLOCKING reconciliation event** — halts the handshake for adjudication, never silently overwrites. Arithmetic guard Δ×monthly (rejects new-loan-same-principal); ties W2 `loan_mda_reassignments`/`person_loans`; evidence Oke (38→35, +₦33,999 = 3×11,333).
   - **ADD collector/parent-MDA registry seed:** CDU/AANFE as collectors on the **existing carrier `mdas.parentMdaId` (schema.ts:44)** — NOT `is_autonomous`/`reporting_parent_mda` (those are not in the schema; 17.21-fragment names = build-time confirmation, §J.1); reporting-layer ≠ transfer; completeness cross-checked vs the 21 detector-surfaced reporting-layer cases.
   - **RECORD the build principle (do not implement):** collector knowledge is a hard-coded 2-name list today (`transfer-restatement.ts:32`); the app reads it as **seed data, never hard-codes a person-facing blocking gate**.
   - **LIFT the ⛔ SPRINT-BLOCKED banner** and the status-line block — 17.5 is sprint-eligible now (the A5 guard has landed).
   - Origin line → "Amended ×3 … → A5 §3.1"; footer Pending line → "none — A5 §H#3 continuity guard FOLDED 2026-07-09; additions queue to A6."
2. **`17-4-person-identity-service.md`** [A5 §3.2, P4] — identity-side **CONSUMER-TIE**: confident-identity resolution + principal-segmentation for the guard; reuses PIS + `person_loans`; **NO new matching logic** (state this explicitly).
3. **`17-3b-mda-payroll-snapshot-ingestion.md`** [A5 §3.3, P7] — **master-resolver role** (closes A-confirm/B/C; consumes FR118 structured payroll asks).
4. **`17f-2-staleness-disclosure-chip.md`** [A5 §3.4, P1] — evidence-graded findings **CONCEPT-LINEAGE only**: proven/projected/rewound + resolver (FR117) extends the shipped provenance primitive; the BUILD lands in the worklist stories, NOT here. **Status stays "done"** — a lineage row, not a reopen of the chip.
5. **`17-16-idempotency-property-test-framework.md`** [A5 §3.5, P9] — Kolade (B) + Oke (C) join the golden set (Agreement 15/24 parity).

## LEDGER
Append the 5 A5 fold rows to **§A** (their §A.1/§A.3 chains) + mark them in **§A.5**; update **§C** registry — FR117 (evidence-graded findings) + FR118 (structured payroll worklists) **ALLOCATED, next-free FR119**. (FR *content* is John's PRD-delta work — you only update the registry allocation.)

## SELF-VERIFY (§I.1 checklist on the 5 files — record the result)
- **Appends-not-rewrites:** `git diff` each — additions only, **except the one intended content change in 17.5** (placeholder AC #6 → real blocking AC; banner lifted). **17.5 is the ONLY file whose diff may show deletions — if any other file shows a deletion, that is a fold error.** (Fable will re-check this as the single highest-signal check.)
- **Footer-vs-ledger checksum:** each footer's new A5 row matches its §A fold row.
- **Verbatim/gate:** 17.5 blocking AC matches A5 §3.1; SPRINT-BLOCKED fully lifted (banner + status + footer Pending line all updated).
- **Conservation:** `git status` shows exactly the 5 story files + ledger changed — no other story file touched.
- **17f.2 status still "done"** (lineage row, not a build reopen).

## END
Hand to Fable for the final fold-verify (**§J.3**) with your self-verify result + the 5-file diff list. Do **NOT** commit / publish / land the chain-closed marker.

---

## The tail after Bob (two short, gateless steps — no PO decision)

1. **Fable — §J.3 final fold-verify:** the 5-file mechanical check (appends-not-rewrites, footer checksum, 17.5 sprint-block lifted, conservation; the 17.5 diff is the one place deletions are legitimate — deletions anywhere else = fold error). On PASS, land the **chain-closed marker** in ledger §F: *"SCP 2026-04-15 amendment chain A1–A5 fully consolidated; story files are the single truth; new work opens at A6."*
2. **John — one clean commit:** flip A5 DRAFT → PUBLISHED and commit **corrections + fold + chain-close** as one verify-then-commit; snapshot the resulting SHA as the **A1–A5 fully-consolidated paper-trail pin** (the counterpart to `7ef91fd` for the signed pack); and add a 4-line **builder's entry note** at the top of the fold directory — "A1–A5 consolidated as of `<SHA>`; build from the story files here, not the addenda; Sprint 1 = 17-2 + 17-4b + 17-3b against the W2-AMENDED schema; `overdeduction-regression-2026-07.ts` gates detection work."
