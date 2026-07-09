# A5 Fold — Bob's Self-Verify (§I.1 checklist) + Fable §J.3 Handoff

**Folder:** SM Bob, 2026-07-09 · **Scope:** the five §J.2-confirmed A5 fold rows (TA-28 bounded) · **Result: ✅ SELF-VERIFY PASS — ready for Fable §J.3.**
**Uncommitted** on `dev` (adds to John's pre-existing A5 §3.1/§5 + ledger §H edits + Fable §J/§J.1/§J.2 — the whole close-out lands as one clean commit at the end). I did NOT commit, publish A5, or land the chain-closed marker — those follow the §J.3 verify.

## The five fold rows applied
| File | A5 row | What landed |
|---|---|---|
| `17-5-…` | §3.1 [P4/P5] | placeholder AC #6 → **real blocking continuity AC #6** + collector-registry **AC #7**; scope subsection; **SPRINT-BLOCKED lifted** (status line, banner, priority, sequencing, footer) |
| `17-4-…` | §3.2 [P4] | scope subsection + **AC #11** identity-side consumer-tie (no new matching logic; X-8 precedent) |
| `17-3b-…` | §3.3 [P7] | scope subsection + **AC #8** master-resolver role (consumes FR118 asks) |
| `17f-2-…` | §3.4 [P1] | concept-lineage: "Extends forward" refreshed + footer row; **Status stays `done`** (no AC, build in worklist stories) |
| `17-16-…` | §3.5 [P9] | scope paragraph + **AC #7** Kolade (B) + Oke (C) golden anchors |

## §I.1 checklist — result

1. **Appends-not-rewrites — PASS.** `git diff --numstat`: 17.5 = +17/−10 (the one intended content change); the other four = +7/+8/+8/+4 with 3 deletions each. **Every deletion in the four non-17.5 files was verified line-by-line to be an *instructed metadata refresh only*** — Origin "Amended ×N" count bump, evidence-keys line extension, collision-note extension, and the Pending-amendments line refresh (all mandated by the fold spec: "update the footer with an A5 source row + refresh the Pending-amendments line"). **No AC, scope item, or verified sentence was removed from any of the four.** → *Reading note for Fable: the numstat shows deletions on all five, but "deletions" for the four non-17.5 files are footer/Origin line-modifications, not content removal. The rule "17.5 is the only file that may delete content" holds — 17.5 is the only file that removed a substantive line (placeholder AC #6).*
2. **17.5 deletions are exactly the intended set — PASS.** The 7 removed lines: SPRINT-BLOCKED status suffix, ⛔ SEQUENCING GUARD banner, Origin "×2/queued" line, "sprint entry blocked" priority, placeholder AC #6, "Blocked by: A5 §H#3 sprint-entry gate", and the old footer block. Nothing else.
3. **Verbatim/gate — PASS.** 17.5 AC #6 carries A5 §3.1 verbatim-in-intent: carry-forward true installments-paid; backward restatement (receiving < sending, balance jump ~Δ×monthly) = BLOCKING reconciliation event, halts for adjudication, never silently overwrites; Δ×monthly arithmetic guard rejects new-loan-same-principal; ties W2 `loan_mda_reassignments`/`person_loans`; Oke fixture (38→35, +₦33,999 = 3×₦11,333). **SPRINT-BLOCKED lifted in all four locations** (status line, banner, priority, sequencing "Blocked by", footer Pending line). Collector seed AC #7 carries the corrected `mdas.parentMdaId` carrier + promote-to-data build principle (§J.1 correction honoured — no `is_autonomous`/`reporting_parent_mda` asserted as fact).
4. **Footer-vs-ledger checksum — PASS.** Each file's new A5 footer row matches its §A fold-chain row and its §A.5 mark (P4/P5→17.5, P4→17.4, P7→17.3b, P1→17f.2, P9→17.16). §A.5 count note updated; §A.3 17f row gains the 17f.2 concept-lineage note; §C already carries FR117/FR118 allocated, next-free FR119.
5. **Conservation — PASS.** `git status`: exactly the 5 story files + the ledger changed by this fold. (The A5 DRAFT shows modified from John's pre-existing §J.1/§J.2 edits, not this fold — I never edited it.) No other story file touched.
6. **17f.2 status still `done` — PASS.** Line 3 untouched; A5 row is concept-lineage, not a build reopen.

## Handoff → Fable (§J.3 final fold-verify)
Mechanical re-check on the 5 files: appends-not-rewrites (the numstat reading note above is the one gotcha — confirm the four non-17.5 deletions are footer/Origin refreshes, not content loss); footer-vs-ledger checksum; 17.5 SPRINT-BLOCKED fully lifted + blocking AC = A5 §3.1; conservation (only 5 files + ledger from this fold); 17f.2 still `done`. **The 17.5 diff is the single highest-signal check — it is the only file where content deletion is legitimate.**
On PASS: land the **chain-closed marker** in ledger §F — *"SCP 2026-04-15 amendment chain A1–A5 fully consolidated; story files are the single truth; new work opens at A6."* Then John: flip A5 DRAFT→PUBLISHED and commit corrections + fold + chain-close as ONE verify-then-commit; snapshot the SHA as the A1–A5 fully-consolidated paper-trail pin.
