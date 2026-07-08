# 17a Sprint-1 Plan (post-signature refresh)

**Author:** SM Bob · **Date:** 2026-07-06 · **Status: DRAFT — activates on §I.1 fold sign-off (Fable, §I step 4).** No story enters the sprint on an unverified consolidated text.

**Authority:** Deputy AG signature 2026-07-05, Line 1 (17a ACTIVE; W2-amended schema = approved design). Supersedes nothing — this refreshes `sm-bob-17a-sprint-plan-2026-04-20.md` (which stands for structure: 37 pts across 2 sprints, 9 Go gates, 30-min Deputy AG demo) with the signed scope, the fold outputs, and the approved schema's migration order.

## Sprint 1 composition (unchanged from the standing plan; sources now = consolidated story files)

| Story | File (single truth) | Points | Notes |
|---|---|---|---|
| 17.2 | `17-2-port-side-quest-utilities.md` | 5 (+~2 recurrence scan) | First; hard blocker for 17.3b. Golden harness = acceptance test. 21-file `_MULTI-MDA/` counter is the visible KPI, must hit zero. |
| 17.4b | `17-4b-yoruba-name-canonicalizer.md` | 3 | Parallel with 17.2. G5 gate: staging option live (9 rules reviewed for activation; diminutive map fast-follow in same G5 process) — decision falls to PO if reviewer availability binds. |
| 17.3b | `17-3b-mda-payroll-snapshot-ingestion.md` | 8 | Starts after 17.2 mid-checkpoint; production activation only at 21-file counter = 0. BIR-only config. |

Critical path: 17.2 → 17.3b → (Sprint 2: 17.4 → 17.4d ∥ 17.obs). Sprint 2 sources: `17-4-person-identity-service.md` + A2 §2.5.2/§2.5.3 (17.4d, 17.obs — creation texts, story files at create-story).

## Schema work inside Sprint 1 (Winston's W2-AMENDED design — approved; design gate RELEASED)

- **April migrations 1–7 stand** (four new tables + seeds + MV refresh; additive-only; no ledger writes).
- **Migration 8:** `CREATE TABLE person_loans` (W2 §3.2) — after `person` and `identity_decision` exist (FK order).
- **Migration 9:** `CREATE TABLE loan_mda_reassignments` (W2 §4) + append-only trigger (`fn_prevent_modification` pattern).
- §7.2 column additions fold into the original CREATEs pre-generation (no extra migration). **The P2 staffId drop is NOT Sprint-1 work** — own window, own conditions, post-W1, never bundled with 8–9 (W2 §11).
- Discipline: each migration fresh-generated once, in order; **never re-generate an applied migration** (0006 lesson). Rollback = drop new tables, archive sidecar JSON.
- CI guards land with the schema: zero-`ledger_entries.staffId`-readers + **single-mutator rule on `loans.mdaId`** (endorsement rider (i)).

## Fixtures

**TRANSFER-01 joins the golden set** (Agreement 24 parity, per the W2-amended design): Alatise / Lamidi / ADELEKE / CDU / TRANSFER-01. Harness (`overdeduction-regression-2026-07.ts` @ pin `667ebdd8`) green is a ship condition for anything touching detection (17.16 treaty). Kolade/Oke queue via A5 §H#5 — not Sprint-1 scope.

## Go gates (from the standing plan; deltas only)

- **G5 (native-speaker review)** now covers all three rule sets (X-2). **Review instrument ready: `g5-native-speaker-review-pack-2026-07-06.md`** — self-contained ~90-min dual-reviewer worksheet; staging is a pre-agreed OUTCOME of the session (Part-D open items → map runs shadow-only, pilot Go proceeds), so G5 cannot hold the Go hostage. Remaining external dependency: two named reviewers + a session date.
- All other gates per `sm-bob-17a-sprint-plan-2026-04-20.md` §gates, unchanged.

## Explicit non-entries

- **17.5** — sprint-blocked pending the A5 §H#3 continuity guard (story-file banner; ledger §H note). Do not pull it in under any capacity argument.
- **17f stories** — sequenced after 17a (binding: 17a → 17f → 17b → 17c); 17f.2 already done.
- **A5 drafting** — John's, gated on §I step 4 sign-off (Agreement 30).

## Activation checklist

1. ☐ Fable §I.1 fold sign-off appended to the ledger.
2. ✅ **G5 CLEARED at rule-set v2 (2026-07-07)** — dual review executed (Awwal + Sodiya Kabir), reconciled, PO-ratified; outcome + engineering change-list = `g5-review-outcome-2026-07-07.md` (2 contraction rules disabled, 2 harness pairs re-verdicted, map v2 w/ candidate-link demotions, LARRY struck; open item T-1 = OMOWU data test, non-blocking). 17.4b builds v2; AC #2 match count re-baselines under v2.
3. ☐ Amelia briefed: story sources = the consolidated files above, nothing else; addenda are history.
