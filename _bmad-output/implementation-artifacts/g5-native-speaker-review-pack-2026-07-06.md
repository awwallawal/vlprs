# G5 Review Pack — Native-Speaker Review of the Yoruba/Nigerian Name Canonicalizer

**Prepared by:** SM Bob, 2026-07-06 · **Gate:** G5 (17a Go gate; Addendum 2 §2.5.1 AC #4 — "gate, not nicety") · **Scope per ledger X-2:** ONE review covering all three rule sets (transliteration rules + token-sort + diminutive map)
**Subject under review:** `scripts/legacy-report/utils/yoruba-name-normalize.ts` (ports to `packages/shared` in Story 17.4b) + the 33-pair diminutive map (`audit-name-merges.ts`, externalising to ops-editable JSON) — **rule-set version 1**
**Session budget:** ~90 minutes per reviewer. **This pack is the whole review** — no preparation required beyond reading it.

---

## §0 — Why you are being asked (for the reviewers)

VLPRS must recognise that `ALATISE` and `ALATISHE`, or `TOPE` and `TEMITOPE`, on two different payroll sheets can be the **same person** — while never confusing two **different people** whose names look alike. The rules below were built by engineers from the loan data itself. They work on the data we tested (35 verified pairs; 189 confirmed matches on the 248-name BIR roster). What no one has yet confirmed is that they are **sound in the language** — that is your authority, not ours.

The stakes: a wrong merge can point a loan certificate or a refund at the wrong person. A missed merge only creates manual review work. **When unsure, err against merging.**

**Your verdict options for every numbered item:**
- **APPROVE** — linguistically sound as stated.
- **AMEND** — sound with a correction (write it in; your correction becomes a permanent test case).
- **REJECT** — unsafe; explain with an example pair it would wrongly merge (or wrongly split).
- **TEST** — you're unsure; name the example and we resolve it against the real payroll roster before the gate closes.

**Protocol:** two reviewers complete this pack **independently**, then reconcile. Where you disagree, the tie-breaker is evidence — the disputed example is run against the BIR roster and catalog, and the data decides (Team Agreement 28 discipline). Every AMEND/REJECT becomes a regression fixture, so your judgment is enforced by CI forever, not filed in a drawer.

---

## Part A — Transliteration rules (as actually implemented)

> The code applies these in order and compares the final strings exactly. Each rule states what it does, real examples, and — where the engineers already knew a risk — the risk is disclosed. Please answer the **reviewer question** on each.

| # | Rule | What it does | Examples (all currently merge) | Known risk / reviewer question | Verdict |
|---|---|---|---|---|---|
| A1 | Titles & suffixes stripped | MR/MRS/DR/CHIEF/ALHAJI/ALHAJA/HRH/ENGR/PROF/REV/PASTOR/BARR/HON/JP/SAN; JR/SNR/II/III | `MR. ADEBOLA JOHN` = `ADEBOLA JOHN` | Any title in Oyo payroll usage missing? Any stripped token that is actually part of a real name? | ☐ | Approved 
| A2 | Punctuation, dashes, diacritics, case normalised | `JUMOKE,  ADEBAYO ` = `JUMOKE ADEBAYO`; ṣ→s | Diacritics carry meaning in written Yoruba (ṣ vs s). Since payroll sheets type without them anyway, we strip them. Safe for THIS corpus? | ☐ | Approved (it is just a comma not diacritics in this case. Diacritics occur on top of the Alphabet and since the alphabet used in writing is the English alphabet not the stylised Yoruba alphabet we don't have the issue of diacritics here)
| A3 | Prefix contractions: OLUWA→OLU, ADEWA→ADE, OLAWA→OLA, **OMOWU→OMO** | `OLUWASEGUN`=`OLUSEGUN`, `ADEWASEYI`=`ADESEYI`, `OLAWANIYI`=`OLANIYI` | ⚠ **OMOWU→OMO was implemented but never listed in the planning documents — it has had NO review of any kind. Please scrutinise it hardest.** Also: are there OTHER common contractions we lack (e.g. BABA-, OMOLA-)? Is BAMIDELE/BABAMIDELE (deliberately omitted) rightly omitted? | ☐ |There nothing like Adewaseyi = Adeseyi and Olawaniyi = Olaniyi. Ade and Ola are Crown and Wealth in English respectively and are not expandable or retractable unlike Oluwasegun/Olusegun. 
| A4 | Silent H after S/P before any vowel: SH+vowel→S, PH+vowel→P | `ALATISHE`=`ALATISE`, `FOLASHADE`=`FOLASADE`, `ADESHINA`=`ADESINA`, `OSHINBAJO`=`OSINBAJO`, `MUSHIDAT`=`MUSIDAT` | Originally only before E/I; widened to ALL vowels from field data. Is the widening safe — any pair of DIFFERENT names distinguished only by SH-vs-S? | ☐ | The silent H is a fixture in many cases including the way Yorubas write Fatima/Fatimah so this is acceptable
| A5 | Silent H between vowels | `SALAHUDEEN`=`SALAUDEN`, `ROFIHAT`=`ROFIAT`, `MOHAMMED`=`MOAMED` | Code admits a false-merge risk on rare non-Yoruba names (`JAHAN`→`JAN`). Acceptable for a Yoruba + Arabic-loanword civil-service corpus? | ☐ | The silent H is a fixture in many cases including the way Yorubas write Fatima/Fatimah so this is acceptable
| A6 | Vowel-cluster collapse: EE/IE/EI→E, II→I, OO→O, UU→U, AA→A | `ABDULRASHEED`=`ABDULRASHIED`, `OGUNDEELE`=`OGUNDELE` | AI is deliberately NOT collapsed (`ZAINAB` keeps its form). Are there Yoruba names where a double vowel distinguishes two different names? | ☐ | Similar to the silent H this is also acceptable with the Fateemah/Fatima as a case study alongside the ones highlighted.
| A7 | Double-consonant collapse | `OLABISSI`=`OLABISI`, `MUHAMMAD`=`MUHAMAD` | Applies to ALL doubled consonants with no exception list (ABDULLAH-family flagged in code comments but currently NOT excepted). Any real name pair distinguished only by a doubled consonant? | ☐ | Olabissi would be a misspelling as the right word is Olabisi (typo) same as Muhammad and Muhamad the right one is mm
| A8 | NM→M nasal collapse | `ADEWUNMI`=`ADEWUMI`, `OGUNMODEDE`=`OGUMODEDE` | The N as inconsistently-written nasalisation. Always safe? (Note interplay: this makes ADEWUNMI/ADEWUMI/ADEWUMMI all one.) | ☐ | This is also accepted/approved with the nasal collapse (example include Oyetumbi/Oyetunmbi)
| A9 | Terminal -U after consonant dropped | `KABIRU`=`KABIR`, `HABIBU`=`HABIB`, `IBRAHIMU`=`IBRAHIM` | Deliberately preserves the distinction `KABIR` ≠ `KABIRI` (terminal -I untouched). Correct boundary? | ☐ | Yes this is also an acceptable and approved Yoruba speeking/Muslim quirk. Kabiri might be a typo or a new name as found in the North Central part of Nigeria

**A-general:** Is there a spelling-variance pattern you see constantly in Oyo payroll names that NO rule above covers? List them — "missing rule" answers are as valuable as verdicts.

---

## Part B — The 35 validated pairs (confirm the ground truth itself)

> These pairs are our test harness — the rules are judged against them. If any row is WRONG in your judgment, that is a critical finding: it means our ground truth mis-trains every rule above.

**B1 — Must merge (same person, 26 pairs):** ALATISE=ALATISHE · OLUWASEGUN=OLUSEGUN · ABDULRASHEED=ABDULRASHIED · OGUNDEELE=OGUNDELE · OLABISSI=OLABISI · OLUWASEUN=OLUSEUN · OLAWANIYI=OLANIYI · ADEWASEYI=ADESEYI · MUSHIDAT=MUSIDAT · OLUWAPELUMI=OLUPELUMI · MUHAMMAD=MUHAMAD · MR. ADEBOLA JOHN=ADEBOLA JOHN · CHIEF OJO ADESANYA=OJO ADESANYA · JUMOKE, ADEBAYO=JUMOKE ADEBAYO · FOLASHADE=FOLASADE · ADESHINA=ADESINA · OSHINBAJO=OSINBAJO · ADEWUNMI=ADEWUMI · OGUNMODEDE=OGUMODEDE · KABIRU=KABIR · HABIBU=HABIB · IBRAHIMU=IBRAHIM · AJALA KABIRU OLAIDE=AJALA KABIR OLAIDE · SALAHUDEEN=SALAUDEN · ROFIHAT=ROFIAT · MOHAMMED=MOAMED
**Any row you dispute:** OLAWANIYI=OLANIYI · ADEWASEYI=ADESEYI · Oluwaniyi is not Olaniyi they are distinct names (however it could be a typographical error or clerical mistake), Others are accepted. 

**B2 — Must stay distinct (different people, 9 pairs):** ADEBOLA≠ADETOLA · OLUYEMI≠OLADIPO · ABDULRASHEED≠ABDULKAREEM · ADENIYI≠ADEWALE · OLUWASEYI≠OLUWASEUN · OGUNDELE≠OGUNDEYI · OLUYEMI≠OLUFEMI · KABIR≠KABIRI · OLUWOLE LYDIA OLUYEMI≠OLUWOLE LYDIA OLUFEMI
**Any row you dispute:** No dispute in this 
---

## Part C — Token-sort (name-order swaps)

**Rule (L13):** `AWODELE ADEOLA EUNICE` and `AWODELE EUNICE ADEOLA` are treated as the same name — token order is ignored for matching.

**Reviewer question:** is there any Yoruba or Nigerian civil-service naming convention where **word order alone** distinguishes two different people (e.g., family patterns where a father and child share the same three names in different order)? If yes, give the example — it becomes the canary fixture. If no, APPROVE. APPROVED 

**Verdict:** ☐ APPROVE ☐ AMEND ☐ REJECT ☐ TEST — Notes: APPROVED. 

---

## Part D — The diminutive map (33 pairs) — **the part that most needs you**

**What it does today:** when a sheet carries a short form, the engine expands it to ONE full form before matching, e.g. `TOPE → TEMITOPE`.

**The known weakness we need your judgment on:** many diminutives have SEVERAL common full forms — TOPE could be TEMITOPE *or* OLUWATOPE *or* ADETOPE. Forcing one expansion can match the wrong full name. For every row, please do all four:
1. **Verdict** the pair (is this a common, correct diminutive?);
2. **List alternate full forms** the short form commonly stands for (this column is the review's most valuable output — any short form with 2+ common expansions will be demoted from "hard expansion" to "candidate link only");
3. Strike rows that don't belong;
4. Add rows we're missing (aim: the short forms you actually see on payroll sheets).

| Short | Expands to (current) | Verdict | Alternate full forms you know |
|---|---|---|---|
| TOPE | TEMITOPE | ☐ | Approved |
| TAYO | TEMITAYO | ☐ | Approved  (Another variant of Tayo is Adetayo and Omotayo)|
| TEMI | TEMILOLA | ☐ | Approved (Temilola can be Temi or Lola, Another variant of Lola is Omolola)|
| KUNLE | ADEKUNLE | ☐ | Approved (Another variant is Olakunle = Kunle) |
| KUNMI | ADEKUNMI | ☐ | Approved |
| LARA | OMOLARA | ☐ | Approved |
| LARRY | OMOLARA | ☐ | This is not a Yoruba name Larry is most likely a typographical error of Lara/Lanre|
| YINKA | ADEYINKA | ☐ | Approved |
| YEMI | OLUWAYEMI | ☐ | Approved (Another variant is Olayemi = Yemi too)|
| YEMISI | OLUWAYEMISI | ☐ | Approved |
| BIYI | ADEBIYI | ☐ | Approved (Another variant is Olabiyi = Bisi)|
| BISI | ADEBISI | ☐ | Approved |
| TUNDE | BABATUNDE | ☐ | Approved |
| TUNJI | OLATUNJI | ☐ | Approved (Another variant is Adetunji = Tunji)|
| WALE | ADEWALE | ☐ | Approved (Another variant is Omowale/Olawale = Wale )|
| WUMI | OLUWUMI | ☐ | Approved (Another variant is  Omowumi/Omowunmi/Adewumi/Adewunmi = Wumi/Wunmi)|
| LANRE | OLANREWAJU | ☐ | Approved |
| SEGUN | OLUWASEGUN | ☐ | Approved (Another variant is Adesegun = Segun)|
| SEUN | OLUWASEUN | ☐ | Approved (Another variant is Adeseun/Seun)|
| KEMI | OLUWAKEMI | ☐ | |Approved (Another variant is Adekemi/Kemi)|
| TUMI | OLUWATUMININU | ☐ | Approved |
| DARA | ADEDARA | ☐ | Approved (Another variant is Omodara/Oludara = Dara)|
| DAYO | ADEDAYO | ☐ | Approved (Another variant is Oladayo/Dayo)|
| BUNMI | ADEBUNMI | ☐ | Approved |
| BOLA | ADEBOLA | ☐ | Approved (Another variant is Omobola/Bolanle = Bola)|
| BODE | ADEBODE | ☐ | Approved (Another variant is Olabode/Bode)|
| DELE | BAMIDELE | ☐ | Approved |
| DAMI | OLUWADAMILOLA | ☐ | Approved |
| FUNMI | OLUFUNMILAYO | ☐ | Approved |
| FUNKE | OLUFUNKE | ☐ | Approved |
| TOLA | ADETOLA | ☐ | Approved (Another variant is Omotola/Tola)|
| TOLU | OLUWATOLULOPE | ☐ | Approved but it is rare (Tolulope/Tolu is the standard)|
| SADE | FOLASHADE | ☐ | Approved |
| SOLA | OLUWASOLA | ☐ | Approved (Adesola/Adeshola is a variant)|
| SHOLA | OLUWASHOLA | ☐ | Approved (Adesola/Adeshola is a variant)|
| NIKE | ADENIKE | ☐ | Approved (Olanike is a variant) |
| RONKE | ADERONKE | ☐ | Approved (Another variant is Olaronke )|
| **Add missing:** | | | |

*(One row above is a deliberate integrity canary — a pair the engineers themselves doubt. Finding and striking it is part of the review.)*

**Safety context so you can calibrate:** the map never merges people on its own. Every proposed merge still passes: the namesake frequency guard (common names never auto-link), the loan-principal agreement check (different loan amounts split a merge), and human review for medium-confidence cases. Your job is to stop bad *candidates* entering that funnel — the funnel itself has three more valves.

---

## Part E — Sign-off & outcome routing

**Reviewer A:** name Lawal Awwal · qualification (native speaker; payroll-name familiarity) Native Speaker · date 6th July · signature Lawal Awwal
**Reviewer B:** name Sodiya Kabir · qualification Native Speaker/Payroll Officer · date 6th July 2026 · signature Sodiya Kabir
**Reconciliation record** (disagreements + the roster-data evidence that resolved each): Reconciled
**PO ratification (Awwal):** Awwal date 07/07/2026

**Outcomes (pre-agreed, no further decision needed):**
1. **Parts A+B+C+D all clear** → G5 CLEARED, full scope. Pilot activates with rules + token-sort + map (multi-expansion short forms demoted to candidate-link per Part D output).
2. **Parts A+B+C clear; Part D has open items** → **built-in staging activates as an outcome, not a delay**: pilot Go proceeds on rules + token-sort; the diminutive map runs shadow-only until its open rows resolve. Nothing waits.
3. **Any Part-A rule REJECTED** → rule disabled, its harness pairs re-verdicted, rule-set version bumped; pilot Go proceeds on the surviving set.
4. Every AMEND/REJECT/TEST result becomes a regression fixture in the 17.16 suite (your judgment becomes CI).

**Standing policy adopted with this pack (closes the post-review governance gap):** the diminutive map is ops-editable after G5; any pair added later enters `REVIEW_PENDING`, participates in **shadow mode only**, and batches into the next G5 mini-review. The review's seal covers rule-set version 1; every identity decision records the rule/map version that produced it (W2 version-stamping), so the seal's boundary is always provable.
