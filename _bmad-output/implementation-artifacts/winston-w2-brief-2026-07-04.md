# Architect Brief — W2: History-Safe Re-Keying, into the 17a Schema (2026-07-04)

**To:** Winston (Architect) — as design input to the 17a Identity Foundation schema (`architect-winston-17a-schema-2026-04-20.md`)
**From:** Cross-agent harmonisation (`harmonised-findings-2026-07-04.md`, finding **H3**; contract §10.3)
**Urgency:** This is the only item in the entire harmonised register with a ticking clock. 17a is authorised and the `person` table is imminent. **The constraint below is cheapest to honour before that table ships and effectively unfixable after** (the immutability trigger forbids retroactive correction). Design input within the authorised 17a envelope — not scope expansion; no new pilot stories requested.

---

## 1. The defect this must prevent (H3, grep-confirmed 2026-07-04)

`ledger_entries` carries denormalised `staffId` and `mdaId` columns inside an **immutable** table (`fn_prevent_modification` rejects UPDATE). Three existing mechanisms mutate identity/ownership on `loans` while never touching the ledger (they cannot — it's immutable):

- `updateStaffId` — `loanService.ts:585–617` (swaps synthetic `MIG-…` IDs for real ones)
- dedup reassign — `deduplicationService.ts:420–437` (rewrites `loans.mdaId`)
- transfer completion — `employmentEventService.ts:468–477` (re-points `loans.mdaId`)

Result: after any identity repair, the ledger permanently disagrees with the loan about whose money it records — **uncorrectable by design**. Balance still computes correctly today only because `computeBalance` joins by `loanId` alone; any MDA- or staff-scoped ledger read attributes history wrongly.

**Why now:** 17a's whole purpose is identity repair at scale — namesake splits, merges, canonicalisation, OYSG-ID anchoring. Every one of those operations is a re-attribution. Shipping the person table on top of the current ledger keying multiplies H3 events from occasional to routine.

## 2. The design rule (the one sentence to build into the schema)

> **An immutable event may carry only facts that were true at event time and can never be re-judged. Identity is mutable knowledge, not an event fact — it must be resolved at read time through the join chain, never copied into the event.**

Applied to `ledger_entries`:

| Column | Verdict | Reason |
|---|---|---|
| `amount`, `periodMonth/Year`, `entryType`, components | KEEP | Event facts — true at event time forever |
| `mdaId` | **KEEP — but re-defined as "collecting MDA"** | *Which payroll collected this month* is a genuine historical fact (and exactly what transfer reconciliation needs). It must stop being read as "owner MDA". Current-owner questions resolve via `loans.mdaId`; historical-collector questions use `ledger_entries.mdaId`. Name the semantic in the schema comment. |
| `staffId` | **DEPRECATE** | Pure identity denormalisation — becomes false the moment identity knowledge improves. Person attribution flows `entry.loanId → loans → person_loans → persons`. No reader may consume `ledger_entries.staffId`; add a lint/CI guard and drop the column at the next safe migration. |

## 3. What the 17a schema needs to include (requests, not prescriptions)

1. **`person_loans` linkage** (or equivalent) so attribution is `loanId → person`, re-pointable by identity decisions without touching the ledger. Re-pointing must itself be evented — your existing `identity_decision` table looks like the right audit home; a ledger-side event type is then unnecessary.
2. **Semantic split of MDA ownership:** current owner = `loans.mdaId` (mutable, evented via `transfers`); historical collector = `ledger_entries.mdaId` (immutable fact). Dedup-reassign and transfer-completion then stop being corruption sources by definition — they only ever move the mutable pointer.
3. **Single mutator rule:** today two uncoordinated services rewrite `loans.mdaId` (transfer completion + dedup reassign). One owner (service or DB-level policy), with `loan_state_transitions`-grade auditing, whichever pattern you prefer.
4. **Reader migration list** (small): `selectByMdaAndLoan` and any MDA-scoped ledger view must declare which semantic they want; the 60-day inactivity query (`loanService.ts:241`) joins via loanId already and is unaffected by re-keying (it is affected by H1 starvation — different workstream, W1).
5. **Regression anchors:** the canonical fixtures already planned for 17a (Alatise, Lamidi, ADELEKE namesake, CDU parent/child) **plus one transfer fixture**: person with entries under MDA-A, transferred to MDA-B — assert (a) balance identical before/after re-pointing, (b) MDA-A keeps historical collector attribution, (c) person attribution resolves to the same human at both MDAs.

## 4. Explicit non-goals (scope discipline)

- **No W1 here.** Posting submissions into the ledger is a separate, authorisation-gated workstream (SCP Addendum 3). This brief only ensures the keys W1 will eventually write through are sound.
- **No data backfill request.** Existing stale `staffId` values in the ledger stay as-is until the deprecation migration; the fix is prospective keying, not retroactive editing (which the trigger rightly forbids).
- **No change to pilot scope, gates, or the Deputy AG envelope.** If you judge any part of this to exceed the 17a envelope, that part goes into the Addendum 3 request instead — flag it rather than absorb it.

## 5. Evidence trail

H3 in `harmonised-findings-2026-07-04.md` (§2, grep-cited); Fable critique F2 (falsification test §6.2 — run it yourself: no operational read path may consume `ledger_entries.staffId`, and no 17a story may write person attributions into the ledger); session-log §8.3#6 (transfer-orphan, independently found). Both review agents converged on this finding; it survived the adversarial round untouched.
