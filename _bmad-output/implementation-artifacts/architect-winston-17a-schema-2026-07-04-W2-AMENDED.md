---
title: Architect Winston — Epic 17a Schema Design, W2-AMENDED (history-safe re-keying)
author: Architect Winston (acting) — session bootstrapped per prompt-winston-w2-schema-2026-07-04.md
date: 2026-07-04
amends: architect-winston-17a-schema-2026-04-20.md (the April design remains valid except where amended here)
primary_input: winston-w2-brief-2026-07-04.md (H3, harmonised-findings-2026-07-04.md §2)
parent_amendment: scp-addendum-3-2026-07-04-DRAFT.md §4.5 (gate verbatim in §0 below)
also_accounts_for: scp-addendum-4-2026-07-04-DRAFT.md §3.2 (L10, L13, L14, L18)
destination: deputy-ag-signature-pack-2026-07-04-DRAFT.md Appendix W
h_keys: H3 (primary), H11 (person linkage), H21/L18 (segmentation shape constraint), H6/H12/H17 (context only — 17f/17.8, not this design)
length_budget: 400 lines max
---

# Epic 17a Schema Design — W2-AMENDED

> **STATUS: APPROVED — PO (Awwal Lawal), 2026-07-04.** Approval given after the W2-brief-author's source-verified endorsement; rider (i) folded into §2.2/§4 before approval; rider (ii) routed to 17f.1 (PM John, A3 pre-signature). **The verbatim gate below is hereby satisfied and released.** Persons-table implementation remains sequenced behind Deputy AG Line-1 signature (this approval clears the design gate, not the authorisation gate).

**Gate (verbatim, from the amended story text):** *"No persons-table implementation until the W2-amended schema design is approved."* This document is the design that satisfies that gate — approved as above.

**Scope discipline:** everything below stays inside the authorised 17a envelope (additive-only data layer, BIR pilot, rollback = drop the new tables). Two small implementation touches land on shipped surfaces; they are named in §10 for explicit PO confirmation, not absorbed silently. No data backfill; no migrations run from this document.

---

## 1. H3 falsification test — independently re-run from source (2026-07-04)

Per the brief's own rule, the result of this test outranks the brief's prose. All four legs were verified fresh; **verdict: PASS — H3 is confirmed, nothing refuted.**

| # | Claim tested | Method | Evidence | Result |
|---|---|---|---|---|
| 1 | No operational read path consumes `ledger_entries.staffId` | grep `ledgerEntries.staffId` across `apps/server/src`; then audited both raw-SQL ledger reads | Zero matches. Raw-SQL sites join by `loan_id` only and read `staff_id` from `loans`, not the ledger: `attentionItemService.ts:56–60` (lateral join on `le.loan_id = l.id`), `inactiveLoanDetector.ts:71–81` (`l.staff_id` selected; join on `l.id = le.loan_id`). The only sources of the column's values are the write paths: `ledgerService.ts:17` (copies `loan.staffId` at insert) and `baselineService.ts:502,783` (baseline entry data) | **CONFIRMED** — column is written, never read |
| 2 | The three mutators touch `loans` but never `ledger_entries` | Read each mutator in full; grep `ledgerEntries` per file | `updateStaffId` (`loanService.ts:585–620`): updates `loans.staffId` + `migrationRecords.employeeNo`, no ledger reference. Dedup reassign (`deduplicationService.ts:413–449`): updates `migrationRecords.mdaId` + `loans.mdaId`, no ledger reference. Transfer completion (`employmentEventService.ts:466–494`, `completeTransfer`): updates `loans.mdaId` + `transfers.status`, no ledger reference. Neither `deduplicationService.ts` nor `employmentEventService.ts` appears in the repo-wide `ledgerEntries` file list (33 files, both absent) | **CONFIRMED** |
| 3 | `computeBalance` joins by `loanId` alone (why balances survive today) | Read the balance path end-to-end | `balanceService.ts:29–31` → `ledgerDb.selectByLoan` / `selectByLoanAsOf` (`immutable.ts:16–22, 34–45`) — where-clause is `loanId` only; MDA scoping is applied on `loans.mdaId` (`balanceService.ts:12`), never on the ledger | **CONFIRMED** |
| 4 | No planned 17a story writes person attributions into the ledger | April design §5.1 migration list (1–7: four new tables + seeds + MV refresh — no ledger writes); grep "ledger" in `sm-bob-17a-sprint-plan-2026-04-20.md` | Zero matches in the sprint plan; the April design is additive-only with all integration read-from-PIS | **CONFIRMED** |

**Boundary check (beyond the brief):** the one sanctioned mutation avenue on the ledger — the trigger-disable block in `migrationService.ts:903–934` — is whole-thread deletion on upload supersede (un-shared loans only, triggers re-enabled in `finally`). It deletes entire loan histories in a purge; it never edits keys row-level. It does not refute "uncorrectable by design" for identity repair, and it needs no change under this design. Useful side-fact: the eventual `staff_id` **column drop is DDL**, which the row-level immutability trigger does not block — the deprecation migration needs no trigger gymnastics. *W1 consequence (rider (ii), endorsed 2026-07-04, verified from source by both agents): once 17f.1 posts PAYROLL entries, this same purge path would silently delete posted deduction events on supersede with no replay — routed to 17f.1 as an AC line (PM John, A3 pre-signature); a posting-pipeline concern, not a schema change here.*

**Two refinements the test adds to the brief** (both make the fix cheaper, neither weakens the finding):

1. **Reader census.** The brief says "any MDA- or staff-scoped ledger read attributes history wrongly." The full census of `ledgerEntries.mdaId` readers (six sites) shows five of them are period-recovery aggregates that ask *"how much did this MDA's payroll collect?"* — which is exactly the **collecting-MDA** semantic this design formalises. They become correct **by redefinition**, no code change. Exactly one reader wants the current-owner semantic and needs migration (§5).
2. **Write seam.** Operational posting already flows through a single seam (`ledgerService.createEntry` → `ledgerDb.insert`), with `baselineService`'s two direct `tx.insert(ledgerEntries)` calls the only bypass. Consolidating the deprecation guard is therefore cheap (§2.3).

---

## 2. The W2 rule applied to ledger keying

> **The rule (W2 brief §2, adopted verbatim as a schema-level invariant):** an immutable event may carry only facts that were true at event time and can never be re-judged. Identity is mutable knowledge, not an event fact — it resolves at read time through the join chain, never copied into the event.

### 2.1 Column verdicts (brief §2 table, confirmed against source and adopted)

| Column (`ledger_entries`) | Verdict | Design consequence |
|---|---|---|
| `amount`, `principalComponent`, `interestComponent`, `periodMonth/Year`, `entryType`, `payrollBatchReference`, `source`, `postedBy`, `createdAt` | KEEP | Event facts — true at event time forever |
| `mdaId` | **KEEP, re-defined as "collecting MDA"** | The MDA whose payroll collected this entry's money in this period — a genuine historical fact, known at posting time, never re-judged. Current-owner questions resolve via `loans.mdaId`. Semantic named in a schema comment on the column (schema.ts, `ledgerEntries` block) so no future reader guesses |
| `staffId` | **DEPRECATE** (path in §2.2) | Pure identity denormalisation — becomes superseded knowledge the moment identity understanding improves. Person attribution flows `entry.loanId → loans → person_loans → person` (§3). Today it has **zero readers** (§1 leg 1), so deprecation costs nothing operationally |

**One fact the deprecation does not lose:** the staff ID *as declared by the MDA on the source row* is a genuine event fact — but its home is provenance, not the ledger key. The W1 posting pipeline (17f.1) links each entry to its source submission row, and `submission_rows.staffId` already preserves the declared value verbatim (`schema.ts:663`). Nothing is discarded; the declared ID simply stops masquerading as resolved identity.

### 2.2 `staffId` deprecation path (three phases, no retroactive edits)

| Phase | When | Action | Mechanism |
|---|---|---|---|
| P0 — Declare | This design, on approval | Schema comment marks the column DEPRECATED: *"Write-only as-declared-at-posting; no reader may consume; person attribution resolves via loanId → person_loans. Drop scheduled per W2-amended design §2.2."* | Comment in `schema.ts` `ledgerEntries` block |
| P1 — Guard | 17a schema story implementation | **No-new-readers CI guard:** a repo test asserting (a) zero occurrences of `ledgerEntries.staffId` outside the write seam and the schema definition, (b) zero raw-SQL selection of `le.staff_id` / `ledger_entries.staff_id` (regex over `apps/server/src`, test files exempt), and (c) — **rider (i), W2-brief-author endorsement 2026-07-04** — no `loans.mdaId` write outside `loanOwnershipService` (the §4 single-mutator rule, grep-asserted; closes most of the gap the deferred DB trigger would have covered, at near-zero cost). Fails the build on any violation. Existing writers keep populating `staffId` unchanged — the value is inert once unreadable, and keeping the write avoids relaxing NOT NULL (a behaviour change) before authorisation | New test file beside `immutable.test.ts`; runs in the standard CI suite |
| P2 — Drop | Next safe migration window: after W1 (17f.1) is live for one full posting cycle **and** the P1 guard has been green throughout | New Drizzle migration: drop `idx_ledger_entries_staff_id`, then `ALTER TABLE ledger_entries DROP COLUMN staff_id`. DDL — not blocked by the immutability trigger (§1 boundary check). Existing stale values are never edited; they leave with the column | New migration file, generated fresh (never re-generate an applied migration — standing project rule) |

### 2.3 Write-seam consolidation (small, makes the guard airtight)

`baselineService.ts:502` and `:783` insert ledger entries directly via `tx.insert(ledgerEntries)`, bypassing `ledgerDb`. Add a transaction-aware variant to the constrained accessor (`ledgerDb.insertTx(tx, values)`) and route both call sites through it. After this, `immutable.ts` is the **only** file that touches `ledgerEntries` for writes, and the P1 guard's exemption list is one file long. Behaviour-preserving; shipped-surface touch — listed in §10.

---

## 3. Person linkage: `person_loans` (the mutable pointer that replaces identity-in-the-event)

### 3.1 Why a junction table and not a `loans.person_id` column

The April design deliberately deferred any `person_id` FK column on `loans` to 17b (additive-only rule — no column changes to pre-Addendum-2 tables). A junction table achieves re-pointable attribution **without touching `loans`**: it is a new table referencing two existing primary keys. 17b may later collapse it into a `loans.person_id` column if the retrofit warrants; nothing in this design forecloses that.

### 3.2 Schema

```sql
CREATE TABLE person_loans (
  id                    BIGSERIAL PRIMARY KEY,
  person_id             TEXT NOT NULL REFERENCES person(person_id),
  loan_id               UUID NOT NULL REFERENCES loans(id),
  status                TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'superseded'
  link_source           TEXT NOT NULL,                    -- 'pis_resolve' | 'roster_seed' | 'manual'
  created_by_decision   BIGINT NOT NULL REFERENCES identity_decision(id),
  superseded_by_decision BIGINT REFERENCES identity_decision(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at         TIMESTAMPTZ,
  pilot_scope_tag       TEXT NOT NULL DEFAULT 'BIR'       -- 17a lock; 17b removes
);
CREATE UNIQUE INDEX person_loans_one_active_per_loan
  ON person_loans (loan_id) WHERE status = 'active';
CREATE INDEX person_loans_person_idx ON person_loans (person_id);
CREATE INDEX person_loans_loan_idx ON person_loans (loan_id);
```

Design decisions, each with the reason:

| Decision | Choice | Reason |
|---|---|---|
| Mutable row vs append-only | **Append-only rows with `status` + supersession pointers** (mirror of `inference_sidecar`'s rollback pattern) | Attribution *history* stays readable as plain rows — who the system believed this loan belonged to, when, and which decision changed it — without replaying an event log. The "mutable pointer" is the single `active` row; re-pointing = supersede old row + insert new row, one transaction |
| Cardinality | Many loans per person allowed by construction; **exactly one active person per loan** (partial unique index) | A person legitimately holds sequential loans (H21/L18 — see §7.3); a single ledger thread attributed to two people simultaneously is exactly the corruption class this design exists to prevent |
| Attribution chain | `entry.loanId → loans.id → person_loans (active) → person` | Identity resolves at read time through the join chain — the W2 rule, made structural. The ledger is never touched by any identity operation |
| Every link is evented | `created_by_decision` NOT NULL | No attribution exists without an auditable decision behind it — `identity_decision` is the single audit home (§3.3) |

### 3.3 Re-pointing is evented via `identity_decision` — brief's view CONFIRMED, no ledger-side event type

The brief asked me to confirm or refute: *"re-pointing evented via your existing `identity_decision`; a ledger-side event type is then unnecessary."* **Confirmed**, with the boundary stated precisely:

- **Identity re-pointing is a knowledge event, not a money event.** It changes which person the join chain resolves to; it changes no amount, no period, no balance (§1 leg 3). Its audit home is `identity_decision`: the enum gains two values — `'link'` (first attribution of a loan to a person) and `'attribution_repoint'` (supersede + relink). Both reference the affected `person_loans` rows via the supersession pointers.
- **Money events stay ledger-side.** REFUND / REVERSAL (H7, Story 17.26 as amended by A3 §4.1) are money events and belong in the ledger enum. The line: *if it moves value, it posts; if it moves knowledge, it decides.* No hybrid type is needed, and adding an identity event type to the ledger would re-introduce exactly the category error H3 documents.

`identity_decision` gains one further column while the table is still unbuilt (free now, additive anyway): `rule_set_version TEXT` — records which canonicaliser/variant-map versions were in force when the decision was made (§7.2 explains why this became necessary).

---

## 4. Single-mutator rule for `loans.mdaId`

Today two uncoordinated services rewrite `loans.mdaId`: transfer completion (`employmentEventService.ts:474–477`) and dedup reassign (`deduplicationService.ts:430–437`). Under the collecting-MDA semantic these stop being corruption sources *by definition* (they move only the mutable owner pointer) — but two unaudited writers of an ownership pointer is still one too many.

| Option | Mechanism | Assessment |
|---|---|---|
| A — DB-level policy | Trigger permitting `UPDATE loans SET mda_id` only when a session variable is set by the sanctioned service | Strongest guarantee, but trigger-and-session-variable choreography is opaque to Drizzle, complicates tests, and is heavier than the pilot needs |
| **B — Service-level single owner + append-only audit table** ✅ | One function, `reassignLoanMda(tx, loanId, newMdaId, reason, actor, source)`, in a new `loanOwnershipService`; both existing call sites delegate to it; every call appends to a new `loan_mda_reassignments` table | `loan_state_transitions`-grade auditing (the brief's stated bar) with the same append-only pattern already proven there; additive table; two-line changes at the call sites. **Selected for 17a** |
| C — Both | B now, A later | A remains available as 17b hardening if the portfolio roll-out multiplies writers. Recorded as a 17b flag, not built now. Interim backstop per rider (i): the P1 CI guard (§2.2) also greps-asserts that no `loans.mdaId` write exists outside `loanOwnershipService` |

```sql
CREATE TABLE loan_mda_reassignments (         -- append-only; same trigger pattern as loan_state_transitions
  id            BIGSERIAL PRIMARY KEY,
  loan_id       UUID NOT NULL REFERENCES loans(id),
  from_mda_id   UUID NOT NULL REFERENCES mdas(id),
  to_mda_id     UUID NOT NULL REFERENCES mdas(id),
  source        TEXT NOT NULL,                -- 'transfer_completion' | 'dedup_reassign'
  reason        TEXT NOT NULL,
  actor_user_id UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX loan_mda_reassignments_loan_idx ON loan_mda_reassignments (loan_id);
```

Note: the dedup-reassign path also matches by name today (`LOWER(staffName)` at `deduplicationService.ts:425,435`); once PIS attribution exists for pilot loans, that match should prefer the `person_loans` chain. That refinement rides the dedup surface's own story, not this design — noted so it is not lost.

The two call-site edits touch shipped services — §10 flags them for confirmation.

---

## 5. Reader migration list (complete census, from §1's grep — not a sample)

| Reader | Site | Semantic it needs | Action |
|---|---|---|---|
| `getEntriesByLoan(loanId, mdaId)` → `selectByMdaAndLoan` | `ledgerService.ts:31–36` → `immutable.ts:24–32` | **Current owner** — an MDA-scoped user viewing a loan's ledger. Under collecting-MDA semantics this filter breaks post-transfer: the receiving MDA's officer would see none of the pre-transfer entries, and the sending MDA's officer would still see a loan no longer theirs | **Migrate (the one code change among the readers):** authorise via `loans.mdaId` (owner check), then return `selectByLoan(loanId)` — full history to the current owner. Retain `selectByMdaAndLoan` renamed `selectByCollectingMda` for transfer-reconciliation reads, with the semantic in its doc comment |
| Actual monthly recovery per MDA | `mdaRoutes.ts:133–149` | **Collecting** — "what did this MDA's payroll collect last period" | Correct by redefinition. Declare in a code comment; no logic change |
| Recovery per MDA (batch) | `mdaAggregationService.ts:145–160` | Collecting | Same — declare only |
| `getActualMonthlyRecovery` | `revenueProjectionService.ts:123–147` | Collecting | Same — declare only |
| `getPreviousPeriodRecovery` | `executiveSummaryReportService.ts:567–588` | Collecting | Same — declare only |
| 60-day zero-deduction filter | `loanService.ts:237–245` | None — `loanId`-only subquery, no `mdaId`/`staffId` | Unaffected by re-keying (it is affected by H1 starvation — W1's workstream, not this one) |
| Inactivity + attention raw SQL | `inactiveLoanDetector.ts:70–82`, `attentionItemService.ts:52–66` | None — join by `loan_id` alone | Unaffected |

**A divergence that becomes signal, not defect:** `mdaRoutes.ts:125–152` compares *expected* deduction (summed over `loans.mdaId` — owner) against *actual* recovery (summed over `ledgerEntries.mdaId` — collector). In a transfer month these legitimately diverge: the owner expected, the previous collector collected. That divergence is precisely the transfer-reconciliation signal the brief says the collecting semantic exists to serve. The dual-truth surfaces (17.17) should present it as such — an observation with an explanation, never an error.

---

## 6. Regression anchors — canonical four plus the transfer fixture

The four canonical fixtures stand as gated in the April design (Alatise 51-record/8-observation · Lamidi overdeduction · ADELEKE namesake · CDU parent/child — Agreement 24, CI-blocking). This design adds the **transfer fixture** the brief specifies:

**Fixture TRANSFER-01 (goes into the same golden-fixture CI gate):**
- **Given** person P (BIR-anchored, OYSG ID) with loan L at MDA-A; N PAYROLL entries posted while A collected; `person_loans` active row P→L.
- **When** transfer completes to MDA-B via the single mutator (§4): `loans.mdaId` A→B; `loan_mda_reassignments` row appended; ledger untouched; `person_loans` untouched (same person — ownership moved, identity did not).
- **Then assert:**
  - (a) **Balance identical** before/after re-pointing — `computeBalanceForLoan` output byte-equal (it joins by `loanId` alone; this locks §1 leg 3 permanently);
  - (b) **MDA-A keeps historical collector attribution** — every pre-transfer entry still carries `mdaId = A`; A's period-recovery aggregates for those months are unchanged;
  - (c) **Person attribution resolves to the same human at both MDAs** — the chain `L → person_loans → P` returns P before and after; a `selectByCollectingMda` read at A and an owner-scoped read at B both trace to P.
- **Plus one namesake cross-guard:** a second person P′ at MDA-B with the same canonical name as P must NOT acquire any attribution to L during the transfer (locks the ADELEKE class against the transfer path specifically).

---

## 7. Addendum-4 schema-relevant items (A4 §3.2 — decided, as the prompt requires)

### 7.1 Where the variant knowledge lives: rule layer vs data layer

| Artifact | Layer | Home | Reason |
|---|---|---|---|
| Yoruba diminutive map (~30 pairs, L14) | **Rule** | Ops-editable versioned JSON file (`config/identity/diminutive-map.json`), consumed by the 17.4b canonicaliser package; content-hash recorded per version | L14's requirement is "no deploy to add a pair" — a config artifact, not a table. It transforms names; it is not knowledge *about a person* |
| Known-variants / typo maps (L10: months, MDA names, name tokens) | **Rule** | Same pattern: versioned JSON per domain, loaded by 17.2 utilities / PIS | Same logic — explicit lookup beats fuzzy for low-cardinality high-stakes domains, and editability is the point |
| Token-sort canonicalisation (L13) | **Rule** | 9-rule canonicaliser package (17.4b), as a rule, version-bumped | Algorithmic, not data |
| Observed per-person name variants | **Data** | `person.name_variants` JSONB — unchanged from April (§2.1) | Facts observed about a specific person, with source and firstSeen — belongs on the person row |
| `name_frequency` MV | Data (derived) | Unchanged from April (§2.2) | Computes over `canonical_name`; see the consequence below |

No new tables for A4 items. There is no `person_aliases` table in this design and none is needed at pilot scale — the rule layer is files, the data layer is the existing JSONB + MV.

### 7.2 The one schema consequence of ops-editable rules: version-stamp what the rules produced

If the diminutive map is editable without deploy, then `person.canonical_name` and `name_frequency` are functions of a **moving rule set**. Two additive columns (both tables still unbuilt — zero migration cost):

- `person.canonicalizer_version TEXT NOT NULL` — the composite rule-set version (9-rule package version + diminutive-map hash + variants-map hash) that produced this row's `canonical_name`. A rule-set bump triggers a re-canonicalisation batch (5,573 names ≈ 0.6s per the April perf envelope — trivial at pilot scale) followed by one MV refresh; rows whose version lags the current rule set are detectably stale instead of silently wrong.
- `identity_decision.rule_set_version TEXT NOT NULL` and the same on `inference_sidecar` — every decision records the rules in force when it was made, so a later map edit never retroactively re-explains a past decision. Same epistemics as the ledger: the decision was true under its rule set; new knowledge produces new decisions, not edited old ones.

### 7.3 Sequential-loans (L18 / H21 / the 17.8 question): what 17a's tables need now

**Decision: nothing beyond a shape constraint, which §3.2 already carries.** `person_loans` permits many loans per person by construction (uniqueness is per-loan, not per-person), so *same person, sequential loans = two loans, two rows, one person* — L18's policy — is representable with zero additional schema. Loan-cycle segmentation metadata (where one thread's zero-reset splits into loan instances) belongs to the shared segmentation utility (A3 §4.4, merge point (a)) and the 17.8 sequential-vs-concurrent schema question — **rides 17.8, not 17a**. The only thing 17a had to do was not preclude it; it does not.

---

## 8. W1 write-through compatibility statement (design compatibility only — no W1 implementation here)

When 17f.1 wires posting, every key it writes through is sound under this design:

| Key at posting time | Value | Sound because |
|---|---|---|
| `loanId` | Resolved at posting from the confirmed submission row | The one join key balance computation uses (§1 leg 3); identity-independent |
| `mdaId` | The MDA whose confirmed submission/payroll file is being posted | Under §2.1 this **is** the collecting MDA — a fact fully known at posting time, never re-judged. The semantic and the pipeline's natural value coincide exactly |
| `staffId` | Written as-declared until P2 drop (§2.2); no reader may consume | Declared ID is preserved as provenance via the entry → submission-row link (`submission_rows.staffId`, §2.1); after P2 the pipeline simply stops writing a column that no longer exists |
| Person attribution | **Never written to the ledger** | Resolves at read time via `person_loans` (§3); the falsification test's fourth leg becomes a permanent property, enforced by the P1 CI guard |
| Provenance + confidence (FR103) | Entry-level attributes on the posting pipeline's own linkage | Orthogonal to identity keying; nothing here constrains FR103's design |

No W1 implementation is included or implied here (explicit non-goal, W2 brief §4).

---

## 9. G5 note (native-speaker review dependence)

**Nothing in this schema design depends on the diminutive map clearing native-speaker review.** The §7 separation is precisely what makes the ledger-§E staging option clean: the schema is variant-agnostic; rule-set changes arrive as versioned config; `canonicalizer_version` (§7.2) makes a later map activation a detectable, re-runnable re-canonicalisation batch plus MV refresh — not a schema event. If G5 stages (9 rules for pilot activation, diminutive map as fast-follow), the pilot activates on the 9-rule version and the map lands as a version bump inside the same review process. No schema work waits on the reviewer.

---

## 10. Envelope discipline — flagged items (surfaced, not absorbed)

Everything in §§2–9 is additive at the data layer (new tables, new columns on unbuilt tables, comments, a CI test, a drop migration scheduled post-W1). In my judgment nothing exceeds the authorised 17a envelope. Three implementation touches land on **shipped** surfaces; A3 §4.5.1 names all three concerns explicitly (single-mutator rule, reader migration list, deprecation guard), so I read them as inside the amended story — but per the brief's rule I flag rather than silently absorb:

| # | Touch | Size | My judgment | If PO disagrees |
|---|---|---|---|---|
| F-1 | Two call-site edits routing `loans.mdaId` writes through the single mutator (§4): `employmentEventService.ts:474`, `deduplicationService.ts:430` | ~2 lines each, behaviour-preserving, plus the new service + audit table | Inside the amended 17a schema story (named in A3 §4.5.1) | Moves to a 17f story on Line 2 |
| F-2 | Reader migration of `getEntriesByLoan` (§5): owner-check via `loans.mdaId`, then full-history read | One function in `ledgerService.ts` + rename in `immutable.ts` | Inside — it is the "reader migration list" item of the same amendment | Same |
| F-3 | Write-seam consolidation (§2.3): `ledgerDb.insertTx` + two `baselineService` call sites | ~10 lines, behaviour-preserving | Inside — it is what makes the P1 no-new-readers guard airtight | Guard ships with a two-file exemption list instead; drop still safe, just less crisp |

**No Line-2 scope requests.** Nothing here asks for new pilot stories, new data, or authority changes. Existing stale ledger `staffId` values stay exactly as they are until the P2 column drop removes them unread (no backfill — W2 brief §4, honoured).

---

## 11. Migration plan additions (extends April §5, same discipline)

April migrations 1–7 stand. Appended, each its own fresh Drizzle migration, generated once, in order:

8. `CREATE TABLE person_loans` (§3.2) — after `person` and `identity_decision` exist (FK order).
9. `CREATE TABLE loan_mda_reassignments` (§4) + its append-only trigger (same `fn_prevent_modification` pattern as `loan_state_transitions`).
10. *(Column additions §7.2 fold into the original CREATEs for `person` / `identity_decision` / `inference_sidecar` — those migrations are not yet generated, so no new migration is needed; the April DDL is amended in place before first generation.)*
11. **Deferred, own window (§2.2 P2):** drop `idx_ledger_entries_staff_id`, drop `ledger_entries.staff_id`. Generated only when the P2 conditions are met; never bundled with 8–9.

Rollback for 17a remains: drop the new tables (now including `person_loans`, `loan_mda_reassignments`), archive the sidecar JSON — no legacy data touched. The P2 drop is the single 17a-family migration that is **not** trivially reversible (a dropped column with stale values is gone); that is by design — it is the deprecation completing — and it sits behind its own conditions, after W1 is live and observed.

---

## 12. Summary — the six decisions this amendment adds to April's five

1. **The W2 rule is a schema invariant:** identity resolves at read time through `loanId → loans → person_loans → person`; no identity fact is ever copied into an immutable event.
2. **`ledger_entries.staffId` deprecated on evidence** (zero readers today — §1): guard now, drop after W1, declared ID preserved as provenance on the source row.
3. **`ledger_entries.mdaId` kept and re-defined as collecting MDA** — five of six readers are correct by redefinition; exactly one reader migrates (owner-scoped loan-ledger view).
4. **`person_loans` junction, append-only with supersession** — re-pointing moves the active row, is evented in `identity_decision` (`link` / `attribution_repoint`), and never touches the ledger; one active person per loan by partial unique index; sequential loans representable by construction (H21/L18 shape constraint satisfied, detail rides 17.8).
5. **Single mutator for `loans.mdaId`** — service-level owner + `loan_mda_reassignments` append-only audit; CI grep-guard asserts the rule interim (rider (i)); DB-level policy noted as 17b hardening option.
6. **Rule/data layer split for A4 variant knowledge** — maps are versioned ops-editable JSON; `canonicalizer_version` / `rule_set_version` columns make rule evolution detectable instead of silent; G5 staging fully supported, no schema dependence on the reviewer.

---

*End of W2-amended deliverable. Handoff: PM John — this document is Appendix W of `deputy-ag-signature-pack-2026-07-04-DRAFT.md`; the pack closes on PO approval of it. The verbatim gate stands until that approval. H3 falsification verdict for the record: PASS on all four legs (§1), with the reader-census and write-seam refinements folded into the design.*
