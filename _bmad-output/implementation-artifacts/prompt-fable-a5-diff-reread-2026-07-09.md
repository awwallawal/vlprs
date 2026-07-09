# Prompt for Fable — A5 bounded diff re-read (2026-07-09)

> Copy everything below the line into a fresh CLI session. This is the §G.1-style bounded re-read of the two fold-time edits John applied after your §J PASS — nothing more.

---

You are the **non-authoring second reader**. You already PASSED SCP Addendum 5 (ledger §J: "ready to fold, no corrections required") and flagged one fold-time source correction (§J.1). The PO ratified R-1…R-4. PM John has now (a) recorded the ratification into A5 §5 and (b) applied the R-3 justification correction you dictated. **Your job is a bounded diff re-read of exactly those edits before the fold** — confirm John applied your own correction faithfully and added no new scope. **TA-28: diff only.** Do NOT re-litigate the §J PASS verdict, the rest of A5, or the §I.1-verified consolidated files. Do NOT fold, edit, or open A6. Verify from source.

## The edits under review (all uncommitted on `dev` — read via `git diff` + the files)

Three touch-points, plus one added build note:

1. **`scp-addendum-5-2026-07-09-DRAFT.md` §3.1** (collector/parent-MDA registry, P5) — the `is_autonomous`/`reporting_parent_mda` column claim replaced with `mdas.parentMdaId` (schema.ts:44) + "those two names are NOT in the schema; 17.21-fragment names = build-time confirmation." **Plus a new build principle:** collector knowledge is currently hard-coded (`transfer-restatement.ts:32`), and the app must read it as **seed data, never hard-code a person-facing blocking gate** ("promote-to-data").
2. **`scp-addendum-5-2026-07-09-DRAFT.md` §5** — the decision list is now **RATIFIED (Awwal, 2026-07-09)**: R-1…R-4 each marked RATIFIED, carrying your §J ENDORSE + the three build-time notes (R-1 priority order · R-2 log+batch-review policy · R-3 completeness cross-check); R-3's justification corrected in-line.
3. **`scp-consolidation-ledger.md` §H item 4** — an append-only correction note (the two column names aren't in the schema; decision unchanged; TA-C applies to the ledger too).

## Verify (each PASS/FLAG, with file:line)

1. **R-3 correction faithful to your §J.1 dictation:** the false column names are gone; the **decision is unchanged** ("seed on existing schema, not net-new"; `parentMdaId` is the carrier); the 17.21-fragment names are framed as build-time confirmation, not asserted fact. Source-check: `schema.ts:37–53` — confirm `mdas` has `parentMdaId` and NOT `is_autonomous`/`reporting_parent_mda`.
2. **Promote-to-data build note matches intent:** recorded as a fold-row build principle (record, do NOT implement here); cites `transfer-restatement.ts:32` as the current hard-coded carrier; frames it as a landmine because it gates a *blocking* event. No overreach into implementation.
3. **Ratification recording faithful — no drift, no embellishment:** R-1…R-4 decisions are exactly as ratified; the three build-time notes match your §J wording; no new decision, scope, or authority was smuggled into §5.
4. **Bounded — nothing else moved:** the edits touch only A5 §3.1, A5 §5, and ledger §H item 4. Confirm **no consolidated story file is modified** (`git status` on the five fold targets = clean) and the **five §6 fold rows are unchanged** (still your confirmed zero-drift list). FR117/FR118/next-free-FR119 unchanged in §C.

## Read list
- `git diff` (the uncommitted changes) + `git status` (confirm no story-file edits).
- `_bmad-output/planning-artifacts/scp-addendum-5-2026-07-09-DRAFT.md` §3.1, §5, §6.
- `_bmad-output/planning-artifacts/scp-consolidation-ledger.md` §H (item 4), §J, §J.1, §C.
- `apps/server/src/db/schema.ts:37–53` (the `mdas` block — the source of truth for R-3).

## Return
1. **Verdict:** ✅ PASS — clear to fold · or a **bounded correction** (justification/wording only; the decision and the five fold rows are fixed).
2. Checklist 1–4 results with evidence.
3. On PASS: one line confirming the fold may proceed — John/Bob appends the five §J-confirmed rows to the five consolidated files, lands the **chain-closed marker** in §F, flips A5 DRAFT → PUBLISHED, and commits all of it (corrections + fold + chain-close) as **one clean commit** (verify-then-commit).

Do NOT fold, do NOT edit any file, do NOT open A6. Route any real disagreement to Awwal.
