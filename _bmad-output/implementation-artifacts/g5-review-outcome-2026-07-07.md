# G5 Review Outcome — Native-Speaker Review CONCLUDED

**Recorded by:** SM Bob, 2026-07-07 · **Review record (signed, not edited):** `g5-native-speaker-review-pack-2026-07-06.md`
**Reviewers:** Lawal Awwal (native speaker; also PO) + Sodiya Kabir (native speaker; payroll officer) — independent passes, reconciled 2026-07-06 · **PO ratification:** Awwal, 2026-07-07
**Verdict: ✅ G5 CLEARED at rule-set version 2** (outcome #3 + #1 of the pack's pre-agreed routing: rejected rules disabled, surviving set proceeds; map cleared with amendments). **No staging required — the full-scope review concluded in one session. The Line-1 latency risk (ledger §E) is RETIRED.**

**Governance note for the record:** Reviewer A and the ratifying PO are the same person. Accepted — independence is preserved by Reviewer B (payroll-name familiarity, the pack's ideal qualification), passes were independent, and reconciliation is recorded. Noted, not a defect.

**Review efficacy, for the record:** the gate caught 2 fabricated rules, 2 wrong rows in the engineer-"verified" ground truth, and the deliberate canary. The 35-pair harness — previously treated as validated — mis-trained two rules. This is the empirical case for native review as a standing gate (and for the canary pattern in future review packs).

---

## Rule-set version 2 — the engineering change-list

### R1 — Contractions (from A3 REJECT + B1 disputes)
| Change | Detail |
|---|---|
| **DISABLE `contract-ADEWA`** (ADEWA→ADE) | Not a real contraction. ADEWASEYI ≠ ADESEYI as names; pairs of this shape may be typos → route as candidate-for-human-review, never auto-merge. |
| **DISABLE `contract-OLAWA`** (OLAWA→OLA) | Same finding. OLAWANIYI ≠ OLANIYI. |
| **KEEP `contract-OLUWA`** (OLUWA→OLU) | Explicitly confirmed ("unlike Oluwasegun/Olusegun"). |
| **REJECT `contract-OMOWU`** (OMOWU→OMO) — **T-1 CLOSED 2026-07-07** | Initially disabled pending test (no verdict in the pack). **Resolved by Reviewer A follow-up verdict (Awwal, 2026-07-07): REJECTED with linguistic rationale** — OMO means "child"; OMOWUMI/OMOWUNMI is the compound OMO + WUMI ("children please me / I love children"). The morpheme boundary is OMO+WUMI, not OMOWU+—, so the rule would corrupt OMOWUMI → "OMOMI" (not a name). Rule REMOVED in v2, not merely disabled. The legitimate merge in this family (OMOWUNMI = OMOWUMI) is already correctly handled by the approved NM→M rule (A8). **New fixture: OMOWUMI must NOT canonicalize to OMOMI; OMOWUNMI = OMOWUMI via A8.** Verdict is in the safe direction (removes a collapse), so dual confirmation not required by protocol. |

### R2 — Harness re-verdicts (per outcome #3)
- `OLAWANIYI / OLANIYI`: expectedSame **true → false** (annotation: possible-typo class — surface as review candidate, never auto-link).
- `ADEWASEYI / ADESEYI`: expectedSame **true → false** (same annotation).
- **New fixtures from reviewer-supplied examples** (protocol: every correction becomes CI): FATIMA=FATIMAH (A4), FATEEMAH=FATIMA (A6), OYETUNMBI=OYETUMBI (A8), LARRY↛OMOLARA (map strike), plus the two re-verdicted pairs above.
- **Match-count re-baseline:** 17.4b AC #2 pins "189 canonical-exact matches on 248 BIR names" — computed under v1. Re-run the harness under v2 and consciously re-baseline the count (same discipline as the golden-harness re-lock). The count is expected to move slightly; the movement must be inspected, not assumed.

### R3 — Diminutive map version 2
- **STRIKE:** `LARRY → OMOLARA` (canary; caught by both).
- **AMEND:** `TOLU → TOLULOPE` (standard form; OLUWATOLULOPE rare variant → cluster member).
- **DEMOTE to candidate-link-only** (2+ reviewed expansions; per the pack's pre-agreed rule): TAYO {TEMITAYO, ADETAYO, OMOTAYO} · KUNLE {ADEKUNLE, OLAKUNLE} · YEMI {OLUWAYEMI, OLAYEMI} · BIYI {ADEBIYI, OLABIYI} · TUNJI {OLATUNJI, ADETUNJI} · WALE {ADEWALE, OMOWALE, OLAWALE} · WUMI/WUNMI {OLUWUMI, OMOWUMI, OMOWUNMI, ADEWUMI, ADEWUNMI} · SEGUN {OLUWASEGUN, ADESEGUN} · SEUN {OLUWASEUN, ADESEUN} · KEMI {OLUWAKEMI, ADEKEMI} · DARA {ADEDARA, OMODARA, OLUDARA} · DAYO {ADEDAYO, OLADAYO} · BOLA {ADEBOLA, OMOBOLA, BOLANLE} · BODE {ADEBODE, OLABODE} · TOLA {ADETOLA, OMOTOLA} · TOLU {TOLULOPE, OLUWATOLULOPE} · SOLA/SHOLA {OLUWASOLA, OLUWASHOLA, ADESOLA, ADESHOLA} · NIKE {ADENIKE, OLANIKE} · RONKE {ADERONKE, OLARONKE}.
- **ADD (reviewer-discovered, reviewed-at-birth):** LOLA {TEMILOLA, OMOLOLA} — candidate-link (multi).
- **KEEP as hard expansion** (single form confirmed): TOPE→TEMITOPE · TEMI→TEMILOLA · KUNMI→ADEKUNMI · LARA→OMOLARA · YINKA→ADEYINKA · YEMISI→OLUWAYEMISI · BISI→ADEBISI · TUNDE→BABATUNDE · LANRE→OLANREWAJU · TUMI→OLUWATUMININU · BUNMI→ADEBUNMI · DELE→BAMIDELE · DAMI→OLUWADAMILOLA · FUNMI→OLUFUNMILAYO · FUNKE→OLUFUNKE · SADE→FOLASHADE.
- **Semantics of candidate-link:** the short form proposes ALL cluster members as match candidates; no hard rewrite to a single full form; namesake guard + principal check + review funnel unchanged. (This is the Part-D weakness fixed by the review's own data.)
- Map v2 ships with a `ruleset_version: 2` stamp (W2 §7.2 pattern); every identity decision records it.

### R4 — Where the changes land (two consumers, one change-list)
1. **Story 17.4b (app build, Sprint 1):** implement v2 as specified here. The consolidated story file's G5 AC is SATISFIED by this outcome (review concluded; `NATIVE_SPEAKER_REVIEW_PENDING` lifts on v2). AC-text touch-ups (v2 numbers, candidate-link semantics) ride the next addendum fold row per Agreement 30 — the change-list here is the buildable truth in the interim.
2. **SQ-1 engine (`yoruba-name-normalize.ts` + `audit-name-merges.ts` map):** same change-list; cross-track per the harness treaty — apply, re-run the name-merge audit, and **consciously re-baseline** any merge-count deltas (expected: a small number of previously-merged ADEWA/OLAWA pairs un-merge and surface as review candidates). Owner: SQ-1 session, not this track.

---

## Standing items confirmed by this outcome
- Post-review map-edit policy in force (pack §E): future ops-added pairs = `REVIEW_PENDING` + shadow-only + batch mini-review.
- **T-1 CLOSED (2026-07-07):** OMOWU→OMO REJECTED on Reviewer-A linguistic verdict (see R1) — **zero open threads; G5 is fully concluded with no residuals.** Rule-set v2 final composition: A1/A2/A4/A5/A6/A7/A8/A9 + `contract-OLUWA` only; all three fabricated/invalid contractions (ADEWA, OLAWA, OMOWU) removed.
- Sprint-1 activation checklist item 2: ✅ CLOSED (this document). Remaining before sprint start: §I.1 fold sign-off (Fable) + John's commit call.
