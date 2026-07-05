---
title: UX Sally — Epic 17a UX Surfaces (17a pilot scope only)
author: UX Sally (acting) — invoked by PM John after Winston
date: 2026-04-20
scope: 17a UX surfaces ONLY — namesake disambiguation modal (17.4d), evidence-class badge system, variant-name display pattern, minimal PIS observability dashboard (17.obs)
out_of_scope: Epic 14 public-website retrofit (17b), transfer-candidate review queue (17.4c = 17c), Dept-Admin override UX (17.4e = 17c), cross-MDA person view (Epic 18)
parent_scp: scp-addendum-2-2026-04-20-DRAFT.md §2.2
winston_input: architect-winston-17a-schema-2026-04-20.md
---

# UX Sally — Epic 17a UX Surfaces

**Persona:** UX Sally (acting)
**Scope constraint (strict):** 17a surfaces only. Anything deferred to 17b / 17c / Epic 18 is explicitly not wireframed here.
**Non-punitive vocabulary guardrail:** "Observation" not "Anomaly", "Variance" not "Discrepancy", no red badges (project memory). Applied throughout.

---

## 0. Surfaces in scope

| Surface | Story | Pilot criticality |
|---|---|---|
| Namesake disambiguation modal | 17.4d | HIGH — prevents wrong-person attachment during pilot upload |
| Evidence-class badge system | cross-cutting 17a UI component | MEDIUM — surfaces pilot trust signal on every PIS-keyed record |
| Variant-name display ("also known as") | cross-cutting 17a UI component | MEDIUM — Alatise/Alatishe legitimacy surfaces here |
| Minimal PIS Observability Dashboard | 17.obs | HIGH — pilot monitoring gate |

**Out of scope for 17a:**
- Epic 8 cert-issuance modal wire-in (17a ships component; 17b wires it into cert flow).
- Epic 14 public-website disambiguation (17b, legal review pending).
- Transfer-candidate review queue (17c).
- Dept-Admin override UX — force-merge/split/veto buttons (17c; 17a uses engineer-executed sidecar revert as minimum viable).

---

## 1. Namesake Disambiguation Modal (Story 17.4d)

### 1.1 When it fires (17a pilot)

Only two 17a trigger points:
1. **Upload record attachment** — MDA Officer or Dept Admin uploads a file; parser resolves names; PIS returns `NAMESAKE_AMBIGUOUS` verdict (name → ≥2 distinct `person_id`).
2. **PIS-internal search** — operator searches a name in the PIS explorer; ambiguous result surfaces disambiguation.

**Not in 17a:** certificate issuance (17b Epic 8), public-website lookup (17b Epic 14).

### 1.2 Interaction flow

```
  [upload complete, N records attached, M ambiguous]
                     |
                     v
  +-------------------------------------------------------+
  | Upload complete — 2 observations need your attention  |
  |                                                        |
  |  148 records attached to OYSG IDs confidently          |
  |  2 names match more than one person — please confirm  |
  |                                                        |
  |  [  Review Observations (2)  ]  [  Continue Later  ]  |
  +-------------------------------------------------------+
                     |
                     v
  +-------------------------------------------------------+
  |  Observation 1 of 2 — which person is this record?    |
  |                                                        |
  |  Source: feb-2026-deductions.xlsx · Sheet: BIR · Row 47|
  |  Name as written: ADEWUMI SAMUEL                       |
  |  MDA context: BIR                                      |
  |                                                        |
  |  Canonical form: ADEWUMI SAMUEL                        |
  |  (also matches spelling variant: ADEWUNMI SAMUEL)      |
  |                                                        |
  |  Two candidates share this canonical form:             |
  |  --------------------------------------------------    |
  |  (o)  OYSG/2141                                        |
  |       ADEWUMI SAMUEL OLUWATOSIN                        |
  |       also known as: ADEWUNMI SAMUEL                   |
  |       [roster-anchored] [TIER-1] BIR · since 2019      |
  |       Last seen: Feb 2026 roster                       |
  |       38 prior catalog appearances                     |
  |       [ View history ]                                 |
  |  --------------------------------------------------    |
  |  ( )  OYSG/4903                                        |
  |       ADEWUMI SAMUEL ADEKUNLE                          |
  |       [roster-anchored] [TIER-1] BIR · since 2021      |
  |       Last seen: Feb 2026 roster                       |
  |       14 prior catalog appearances                     |
  |       [ View history ]                                 |
  |  --------------------------------------------------    |
  |  ( )  Neither — queue for further review               |
  |                                                        |
  |  Reason for selection (optional):                      |
  |  [..................................................] |
  |                                                        |
  |  [ Back ]  [ Skip for now ]  [ Confirm and continue ]  |
  +-------------------------------------------------------+
```

### 1.3 Interaction rules

| Rule | Applied |
|---|---|
| Non-punitive language | "Observation" (not "Anomaly", "Conflict"), "needs your attention" (not "Error") |
| Default selection | None preselected — force explicit choice |
| Evidence class visible | Every candidate shows `[roster-anchored]` / `[catalog-backfilled]` / `[catalog-monthly-return]` tag + tier |
| Variant names surfaced | "also known as" line shows canonicalizer-merged spellings |
| Escape hatch | "Neither — queue for further review" emits `identity_decision.type = 'flag_for_review'`. Ticket lands in (17c) review queue when that ships; during 17a, it lands in a simple list view without adjudication UI |
| Deferral | "Skip for now" leaves record un-attached; does not block upload of other records |
| Audit capture | Selection persists as `identity_decision` row — reviewer, verdict, decided_at, source_trail |
| Keyboard nav | Tab through candidates; Enter confirms; Esc = Skip for now |
| Screen reader | Candidate cards role="radio"; grouped under aria-labelledby pointing to modal heading |

### 1.4 Visual treatment — non-punitive

- **No red.** Attention state uses amber accent (`#F59E0B` ~ Tailwind amber-500) on the banner strip, not crimson.
- **No warning icons with exclamation points.** Use a neutral "observation" glyph (magnifying glass).
- **Candidate cards are equal weight.** Neither is styled as "wrong"; user makes the call.
- **"Confidence" language avoided.** Evidence class badge is the signal, not a percentage.

### 1.5 Deferred (17b Epic 8 wire-in)

The modal component is designed to accept one more trigger point from Epic 8 cert issuance in 17b — same component, different entry event. The cert-issuance flow will add **one additional legal-stakes visual treatment** (not in 17a): explicit "This certificate will be issued to OYSG/XXXX" confirmation step after candidate selection. **17a does not ship this step** — flagged here so 17b retrofit preserves the component API.

---

## 2. Evidence-Class Badge System (cross-cutting 17a UI)

### 2.1 Badge taxonomy

| Evidence class | Badge text | Visual | When it applies |
|---|---|---|---|
| `payroll-roster` | `roster-anchored` | Solid slate pill, white text | Person row sourced from an authoritative payroll roster (17a = BIR Feb 2026) |
| `catalog-monthly-return` | `catalog` | Outline slate pill, slate text | Record sourced directly from MDA monthly return |
| `catalog-backfilled` | `backfilled TIER-1` / `TIER-2` / `TIER-3` / `TIER-4` | Outline amber pill, tier suffix | Person linked via backfill inference; tier surfaces in the badge |

### 2.2 Visual spec

```
  roster-anchored       catalog       backfilled TIER-1
  [solid slate pill]   [outline pill] [outline amber + tier]

  Font: 11px uppercase tracking-wide
  Padding: 2px 8px
  Border-radius: 9999px (pill)
  Height: 18px (inline with body text)
```

**Non-punitive note:** TIER-3/4 (lower-confidence inference) uses the same amber outline as TIER-1 — tier is a fact, not a blame signal. Auditors see the tier; no colour escalation.

### 2.3 Placement rules

| Context | Badge shown? | Placement |
|---|---|---|
| Person detail page (PIS explorer) | YES | Right of primary name |
| Record row in catalog list (17a PIS-internal views) | YES | Right of row (small) |
| Namesake modal candidate card | YES | Below name line (17a §1.2) |
| Observability dashboard tiles | NO | Badge is per-record, not per-aggregate |
| Upload confirmation summary | YES | Count per class ("148 roster-anchored, 2 backfilled TIER-1") |

### 2.4 Rule: evidence class never collapses to "confidence %"

Memo L3 mandate. Badge text is the literal class; never "95%". Auditors reason about class, not score.

---

## 3. Variant-Name Display Pattern ("also known as")

### 3.1 Use cases (17a)

- Namesake modal candidate cards (§1.2) — shows variant spelling when canonicalizer merged them.
- Person detail page — primary name + variants listed.
- Search result row — match on variant surfaces with variant-match indicator.

### 3.2 Display rules

**Person detail header:**
```
  ALATISE BOSEDE SUSAINAH                  [roster-anchored]
  OYSG/4812
  also known as: ALATISHE BOSEDE SUSAINAH
```

**Search result row (variant match):**
```
  ALATISE BOSEDE SUSAINAH                  [roster-anchored]
  Matched via spelling variant "ALATISHE"
  OYSG/4812 · BIR · 38 catalog appearances
```

**Namesake modal candidate (as in §1.2):**
```
  ADEWUMI SAMUEL OLUWATOSIN
  also known as: ADEWUNMI SAMUEL
  [roster-anchored] [TIER-1] BIR · since 2019
```

### 3.3 Interaction rules

- Primary name = the name from payroll roster (authoritative per memo L2).
- Variants = every distinct spelling encountered in catalog, ordered by first-seen date.
- Search matching variants surfaces "Matched via spelling variant X" helper text — auditor sees which variant triggered the match.
- Clicking variant text does NOT navigate — it is informational. Person detail is the canonical surface.

### 3.4 Rule: no "alias" language

The word "alias" has fraud connotations. Use "also known as" throughout UI. Code-level field name `name_variants` is internal only; never surfaced to users.

---

## 4. Minimal PIS Observability Dashboard (Story 17.obs — pilot subset)

### 4.1 Layout (single page, 5 tiles + 1 trend)

```
  +============================================================+
  | PIS Pilot Monitoring — BIR                    [Last 24h ▾] |
  +============================================================+
  |                                                            |
  |  +---------------------+   +---------------------------+   |
  |  | BIR ID Coverage     |   | Unanchored Records        |   |
  |  |                     |   |                           |   |
  |  |       86.0 %        |   |         765               |   |
  |  |   ^ +0.2% vs last   |   |     v -8 vs last          |   |
  |  +---------------------+   +---------------------------+   |
  |                                                            |
  |  +---------------------+   +---------------------------+   |
  |  | Review Queue Depth  |   | False-Merge Rate          |   |
  |  |                     |   |                           |   |
  |  |          3          |   |        0.0 %              |   |
  |  |  awaiting review    |   |  (0 rejections of 4,560)  |   |
  |  +---------------------+   +---------------------------+   |
  |                                                            |
  |  +--------------------------------------------------+      |
  |  | Canonicalizer Latency (last 1h)                  |      |
  |  |   p50: 0.08 ms   p95: 0.21 ms                    |      |
  |  +--------------------------------------------------+      |
  |                                                            |
  |  +--------------------------------------------------+      |
  |  | BIR ID Coverage Trend — last 14 days             |      |
  |  |                                                  |      |
  |  |   85 |                                     __..-  |      |
  |  |   80 |                        __.-'''''''        |      |
  |  |   75 |  _.-'''                                   |      |
  |  |      +--+---+---+---+---+---+---+---+---+---+    |      |
  |  |      Apr7  9  11  13  15  17  19  21  23  25     |      |
  |  +--------------------------------------------------+      |
  |                                                            |
  |  Alerts (pilot-critical only):                             |
  |  - False-merge rate > 2.0% → notify Dept Admin + AG        |
  |  [ No active alerts ]                                      |
  |                                                            |
  +============================================================+
```

### 4.2 Tile-level rules

| Tile | Source metric | Alert threshold (17a) | Deferred to 17c |
|---|---|---|---|
| BIR ID Coverage % | `(anchored_persons / total_bir_records) * 100` | None in 17a (trend-only) | Per-MDA breakdown beyond BIR |
| Unanchored Records | Count of catalog rows without `person_id` | None (trend-only) | Auto-ticket when count spikes |
| Review Queue Depth | `count(identity_decision WHERE type='flag_for_review' AND resolved=false)` | None (17a has no SLA; 17c adds it) | SLA alerting (17c with 17.4c queue UI) |
| False-Merge Rate | `(pis.rejected / pis.auto_merge over window) * 100` | > 2.0% → notify Dept Admin + AG | Per-reviewer drill-down |
| Canonicalizer Latency | Prometheus histogram `pis.canonicalize.latency_ms` | p99 > 50ms → ops alert | Per-rule breakdown |
| BIR Coverage Trend | Daily snapshot of coverage % | None (visual only) | Per-MDA multi-line |

### 4.3 Non-punitive treatment

- Alerts panel lists thresholds factually, no exclamation language.
- Trend shows absolute numbers; no "red" for declining coverage (decline is expected when new catalog records arrive ahead of roster updates).
- No "health score". Each tile is a literal measurement.

### 4.4 Access control

- **Dept Admin** — read access to all tiles.
- **AG ops role** — read access to all tiles.
- **MDA Officer** — NO access in 17a (this is operator-scoped; MDA-officer dashboard is Epic 5/8 retro work, separate from 17.obs).

### 4.5 Deferred to 17c

- Review Queue Depth breakdown by partition (needs 17.4c queue structure).
- Per-MDA trajectory for all 51 MDAs (needs 17b portfolio scope).
- Drill-down from tile → record-level detail (needs audit-log unification from 17.4e + 17.x).
- Alert configuration UI (17a uses code-defined thresholds).

---

## 5. Explicitly deferred UX work (not in 17a)

> Listed here so Awwal and Winston can see what's pending but don't expect it in 17a delivery.

| Surface | Sub-epic | Why deferred |
|---|---|---|
| Epic 14 public-website disambiguation-aware lookup (Option A vs B) | 17b | Legal counsel review pending per Deputy AG brief |
| Transfer Candidate Review Queue (17.4c) | 17c | 63 TIER-2 cases exist in sidecar; queue UI ships in 17c |
| Dept-Admin Override UX (force-merge/split/veto) | 17c | 17a uses engineer-executed sidecar revert with ticket; UX codification in 17c |
| Cross-MDA person view | Epic 18 | 1,537-page static HTML drill-down exists as prototype; app navigation axis is Epic 18 |
| Parser confidence indicator (Epic 5 retrofit) | 17b | Confidence propagation is 17b Epic 5 scope |
| Report / export name-stance stakeholder matrix | 17b | Pilot reports use primary name only; matrix post-pilot |
| Audit-trail drill-down from record → source cell | 17b | Exists as static HTML; dynamic surface post-PIS activation |
| Search UX for variant matches (beyond simple "matched via" helper) | 17c | Variant collapse / expand controls; 17a ships basic helper text only |

---

## 6. Open questions Sally defers back to PM John

1. **Amber as the pilot attention colour** — project vocabulary guardrail says "no red badges". Amber is the proposed alternative. PM to confirm this doesn't conflict with existing app accent usage.
2. **MDA Officer exclusion from 17.obs** — 17a scopes observability to Dept Admin + AG ops only. Is this correct, or should MDA officers have a read-only BIR-coverage view during pilot? PM/PO to decide.
3. **"Also known as" naming collision risk** — if a user enters a genuinely different name that happens to be a canonical variant of an existing person, the modal will surface it. Behaviour is correct; messaging may need PM review to ensure MDA officers don't interpret it as "the system thinks I'm wrong".
4. **Pilot-scope tag visibility** — Winston's `pilot_scope_tag = 'BIR'` column is a data-layer marker. Do we surface this to users (e.g. "BIR Pilot" header strip on PIS-enabled pages) to make the scoping explicit? Proposed: YES, a small pilot-scope banner on PIS-origin pages during 17a. PM to confirm.

---

## 7. Summary: 5 biggest UX decisions

1. **Namesake modal ships as a standalone component in 17a**, wired only into upload + PIS search. Epic 8 cert-issuance wire-in is 17b — component API preserves the entry point.
2. **Evidence-class badges are literal class names, never confidence percentages.** Three visual variants: solid-slate roster, outline-slate catalog, outline-amber backfilled-with-tier.
3. **"Also known as" replaces "alias"** everywhere. Variant-match search surfaces helper text stating which variant triggered the match. Primary name = roster name (authoritative per memo L2).
4. **Observability dashboard is pilot-scoped to BIR** with 5 tiles + 1 trend. Only false-merge rate has an active alert threshold in 17a. SLA alerting on review queue is deferred to 17c (needs 17.4c queue structure).
5. **No red, no exclamation, no "anomaly" language** anywhere. Attention state is amber; all PIS-surfaced discrepancies are "observations"; tier is informational, not escalatory.

---

*End of Sally deliverable. Handoff: PM John integrates into SCP §2.2; SM Bob invoked next with Winston's schema + Sally's UX as combined input.*
