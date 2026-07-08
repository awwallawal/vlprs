---
title: Sprint Change Proposal — Addendum 2 to SCP 2026-04-15 (PUBLISHED, reorganised by sub-epic)
subtitle: Identity Foundation hardening — BIR backfill, Yoruba canonicalizer, Epic 17 split (Option B approved), 17a pilot activation
date_drafted: 2026-04-20
author: PM John (drafted) — for Awwal Lawal (Product Owner) review and Deputy AG authorisation
parent_scp: sprint-change-proposal-2026-04-15.md (approved 2026-04-15, post Round 5)
parent_addendum: scp-2026-04-15-addendum-1.md (published 2026-04-18)
scope_classification: MAJOR — Epic 17 split (Option B approved by PO); 17a in pilot scope (authorised); 17b / 17c / Epic 18 deferred (pending authorisation)
status: PUBLISHED 2026-07-06 — finalisation gate satisfied per its own terms; the Deputy AG signed the two-line pack 2026-07-05 (Line 1 = the 17a activation this document defined, carrying the April brief unchanged; Line 2 = its residual structure). Formerly implementation-artifacts/scp-addendum-2-2026-04-20-DRAFT.md.
supersedes: none
evidence_chain:
  session_folder: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\
  deputy_ag_brief_md: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\DEPUTY_AG_BRIEF_2026-04-20.md
  deputy_ag_brief_html: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\DEPUTY_AG_BRIEF_2026-04-20.html
  lessons_memo: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\LESSONS_LEARNED_EPIC_17.md
  canonicalizer_source: scripts/legacy-report/utils/yoruba-name-normalize.ts
  canonicalizer_test_report: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\yoruba-name-normalizer-test-2026-04-20.html
  staff_id_backfill_script: scripts/legacy-report/staff-id-backfill-2026-04-20.ts
  staff_id_backfill_report: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\staff-id-backfill-2026-04-20.md
  staff_id_registry: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\staff-id-registry-2026-04-20.html
  per_staff_drilldown: C:\Users\DELL\Desktop\VLPRS-Reconciliation-2026-04-18\by-staff-id\ (1,536 pages + 1 index)
---

# Sprint Change Proposal — Addendum 2 to SCP 2026-04-15 (PUBLISHED)

## Identity Foundation hardening — Epic 17 split (Option B approved), 17a BIR-pilot scope authorised, 17b/17c/Epic 18 deferred

- **Date drafted:** 2026-04-20 · **Published:** 2026-07-06
- **Author:** PM John (drafted) — for Awwal Lawal (PO) review and Deputy AG authorisation
- **Parent SCP:** `sprint-change-proposal-2026-04-15.md` (approved 2026-04-15, Round 5)
- **Parent Addendum:** `scp-2026-04-15-addendum-1.md` (published 2026-04-18)
- **Scope classification:** **MAJOR** — Option B (Epic 17 split); **17a ACTIVATED by Line-1 signature 2026-07-05**; 17b / 17c / Epic 18 remain paused pending their own post-pilot authorisations, exactly as this document specified.
- **Status:** **PUBLISHED — the finalisation gate is satisfied per this document's own terms.** The Deputy AG signed the two-line pack on 2026-07-05: Line 1 is the 17a activation defined here (the April Pause-Exit Brief, carried unchanged into the pack); Line 2 covers the residual structure. The 17a schema design was amended pre-implementation per Addendum 3 §4.5 (W2 gate — satisfied and released 2026-07-04 via `architect-winston-17a-schema-2026-07-04-W2-AMENDED.md`); the G5 native-speaker review is re-scoped per Addendum 4 §3.2, with the staged option recorded in ledger §E.

---

## Executive summary

Between 2026-04-18 and 2026-04-20 a focused engineering session validated identity anchoring end-to-end against BIR (4,560 Staff IDs recovered, 85.6% coverage, 35/35 canonicalizer tests passing, 189 canonical-exact real-data matches, 1,536 staff drill-downs). The findings demand **5 story amendments + 8 new stories + 1 sequencing hard-blocker + 5 candidate Epic 18 stories + 4 new team agreements + 2 SCP numeric corrections**.

**Structural decision (PO-authorised 2026-04-20):** Epic 17 is split into **17a / 17b / 17c + Epic 18**.

- **Epic 17a — Identity Foundation (PILOT SCOPE, AUTHORISED):** canonicalizer utility (17.4b), Identity Anchor Ingest (17.3b retitled), PIS (17.4), namesake modal (17.4d, component-only), minimal observability (17.obs), parser-port sequencing (17.2). 6 stories, 37 story points, 2-3 sprint horizon. Activates BIR pilot under the existing SCP 2026-04-15 envelope.
- **Epic 17b — Cross-Epic Retrofit (DEFERRED):** Epic 2/5/7/8/14 retrofit stories. Pending separate authorisation post-pilot.
- **Epic 17c — Review Workflows + Patterns (DEFERRED):** transfer-candidate review (17.4c), sidecar pattern codification (17.x), shadow-mode gate codification (17.y), self-healing cleanup (17.11b), Dept-Admin override UX (17.4e), 17.3c/d schema fanout, 17.11 amendment. 5 new stories + 3 amendments. Pending separate authorisation post-pilot.
- **Epic 18 — Historical Data Governance (INPUT ONLY):** register versioning, cross-MDA navigation, loan-cycle detection, NOT_REGISTERED queue, federated identity. Post-go-live.

**Integrated 17a activation plan (Winston schema + Sally UX + Bob sprint plan):**

- **Winston schema:** 4 new tables (`person`, `inference_sidecar`, `identity_decision`, `name_frequency` MV), additive-only. `pilot_scope_tag = 'BIR'` hard-enforces 17a boundary at data layer. No retrofit to legacy tables; rollback = drop new tables.
- **Sally UX:** namesake disambiguation modal (upload + PIS search only — cert wire-in is 17b), evidence-class badge system (literal classes, no confidence %), "also known as" variant-name pattern, 5-tile observability dashboard scoped to BIR. Non-punitive language throughout.
- **Bob sprint plan:** 37 points across 2 sprints (best 4 weeks, worst 6 weeks from Deputy AG sign-off). Sprint 1 = 17.2 + 17.4b + 17.3b (parallel). Sprint 2 = 17.4 + 17.4d + 17.obs (17.4d/17.obs parallel). 9 hard Go gates; Deputy AG demo plan at 30 min.

**Immediate activation path:** Deputy AG signs `DEPUTY_AG_BRIEF_2026-04-20.md` → Sprint 1 starts T+0 → 2-3 sprints to pilot live → Retro 1 (Foundation) trigger post-17a K-gate. 17b / 17c / Epic 18 remain paused pending separate authorisations.

---

## Section 1 — Structural decision (Option B approved)

### 1.1 Decision

**Option B (split into 17a / 17b / 17c + Epic 18) — APPROVED** by Awwal (PO) on 2026-04-20 following review of the Lessons Learned memo and this draft.

### 1.2 Rationale (preserved from draft v1)

A concrete BIR backfill session recovered 4,560 OYSG Staff IDs across 85.6% of BIR catalog records using a Yoruba/Nigerian name canonicalizer, exposing patterns that reach into every prior epic. The post-Addendum-2 story count (39 today + 8 new − 2 retired ≈ 45) exceeds a single epic's coherent sprint-planning envelope. Splitting enables:

- **Parallelisation** — 17a (pilot) runs while 17b contract design happens in parallel without blocking.
- **Pilot shipping without full retrofit** — BIR pilot can activate on 17a alone; 17b retrofit lands post-pilot.
- **Retro scope manageable per sub-epic** — separate K-gates.
- **Epic 18 deferrable post-go-live** — register versioning, cross-MDA navigation, loan-cycle detection are genuinely distinct from identity foundation.

### 1.3 Four empirical findings driving the split

1. **Yoruba/Nigerian name canonicalization is a PIS prerequisite, not a feature.** Without canonical-exact-before-Levenshtein matching, PIS would create 89+ false namesakes from pronunciation variants in just the 1,536 anchored staff. (Memo L1, §2 caution 1.)
2. **The payroll roster is the authoritative identity seed, not a fourth reconciliation layer.** (Memo L2, §1.2.)
3. **Evidence class beats confidence score.** Auditors reason about evidence type + tier, not numeric 0–1. (Memo L3, §1.3.)
4. **Non-destructive sidecar pattern beats catalog mutation.** Inference work is never destroyed by catalog rebuild; rollback is ignoring a sidecar row. (Memo L4, §1.4.)

### 1.4 Option A (retained for audit trail, not taken)

- **Scope:** keep Epic 17 as one 45-story epic.
- **Pros:** no stakeholder mental-model change; single K-gate.
- **Cons:** 45 stories exceeds coherent sprint planning; BIR pilot blocked on full retrofit; retro scope balloons.
- **Outcome:** **Not taken.** PO chose Option B.

### 1.5 Open questions (scoped to 17a pilot activation; 17b/17c/Epic 18 questions deferred)

1. **Native-Yoruba-speaker reviewer for 17.4b rule set.** Who? When? PO authority; 17a-blocking.
2. **Roster-collection workstream ownership (BIR only during 17a).** Existing BIR Feb 2026 roster is sufficient for 17a pilot activation. Multi-month BIR roster acquisition deferred to post-pilot (17b) authorisation. No-op for 17a.
3. **Epic 14 retrofit (public website Option A vs B).** Deferred — 17b scope. Deputy AG brief explicitly flags privacy + legal review pending.
4. **Epic 18 creation scope authorisation.** Deputy AG authority. Deferred until post-pilot review.

---

## Section 2 — Epic 17a: Identity Foundation (PILOT SCOPE, AUTHORISED)

> **This is the immediate actionable section.** Everything in §2 activates under the existing SCP 2026-04-15 authorisation envelope, per the Deputy AG Pause-Exit Brief.

### 2.0 Scope boundaries for Epic 17a

**In scope (17a):**
- Parser port with mid-sheet MDA split + 21 `_MULTI-MDA/` file unblock (17.2 amendment).
- Yoruba/Nigerian name canonicalizer utility (17.4b — NEW).
- Identity Anchor Ingest (BIR Feb 2026 roster only) (17.3b amendment — retitle).
- PersonIdentityService (PIS) (17.4 amendment).
- Namesake Disambiguation Modal (17.4d — NEW).
- Minimal PIS Observability Dashboard (17.obs — NEW, minimum pilot-monitoring subset only; full observability deferred to 17c).

**Out of scope for 17a, deferred:**
- All Epic 2/5/7/8/14 retrofits → **17b**.
- Transfer-candidate review workflow (17.4c) → **17c**.
- Dept-Admin override UX (17.4e) → **17c**.
- Sidecar pattern codification as first-class convention (17.x) → **17c** *(but 17a will implement the pattern by convention for the BIR backfill sidecar; codification-as-story lives in 17c).*
- Shadow-mode validation gate codification (17.y) → **17c** *(but 17a will use shadow mode for canonicalizer and PIS activation by process agreement; codification-as-story lives in 17c).*
- Self-healing cleanup (17.11b) → **17c**.
- Schema fanout amendments to 17.3c / 17.3d → **17c** *(17a needs `evidenceClass`/`nameVariants[]`/`rawIdVariants[]` only on the PIS core tables; register-side retrofit lives in 17c).*
- Full 17.11 amendment (self-healing reconciliation sweep) → **17c**.
- Epic 18 candidates → **Epic 18**.

### 2.1 Architect Winston commentary (schema, 17a only)

> Full deliverable: `architect-winston-17a-schema-2026-04-20.md`. Integrated summary below.

**Five biggest schema decisions (17a only):**

1. **PIS is additive-only in 17a.** No `person_id` FK on legacy tables (`loans`, `submissions`, `exceptions`, `certificates`, `events`, `approvals`). All integration via read-from-PIS. Rollback = drop new tables.
2. **Inference sidecar is a new DB table (`inference_sidecar`), not a JSONB column on a legacy table.** Preserves additive discipline; backed by `staff-id-backfill-2026-04-20.json` as source artefact; DB is queryable projection. Rollback = mark rows `superseded`.
3. **Identity decisions get their own audit table (`identity_decision`)**, not extending legacy `audit_log`. Distinct shape (verdict + evidence_class + source_trail). Unification deferred to 17c (when 17.4e override UX lands).
4. **Pilot scope flag (`pilot_scope_tag = 'BIR'`) is a first-class column** on `person`, `identity_decision`, `inference_sidecar`. Hard-enforces 17a boundary at the data layer. 17b portfolio roll-out removes the column.
5. **Canonicalizer is in-process + LRU-cached** at 10K entries. BIR pilot scale (5,573 total canonicalize calls at activation) is well within regex-chain budget (~0.6s total). Redis / DFA compilation deferred to 17b if portfolio scale warrants.

**Core tables (17a migrations):**
- `person` — canonical identity (1,536 rows at pilot activation)
- `name_frequency` — materialized view (namesake-frequency guard, N≥3)
- `identity_decision` — identity audit log (new, distinct from `audit_log`)
- `inference_sidecar` — queryable projection of backfill JSON + PIS inferences

**Contract-test seam (17a → 17b):** `person_id` format `OYSG/\d+`; PIS `resolve()` idempotency; `inference_sidecar.catalog_ref` shape `{file, sheet, row, recordIdx}`; `pilot_scope_tag` strippable.

**Winston open questions deferred to PM:** Deputy AG sign-off gates migrations 1–7; native-speaker review blocks PIS activation (not migrations); feature-flag infrastructure for `PIS_ENABLED` rollback needs confirmation.

### 2.2 UX Sally commentary (17a UX surfaces only)

> Full deliverable: `architect-sally-17a-ux-2026-04-20.md`. Integrated summary below.

**Five biggest UX decisions (17a only):**

1. **Namesake modal ships as a standalone component in 17a**, wired only into upload flow + PIS-internal search. Epic 8 cert-issuance wire-in is 17b; the component API preserves that entry point. Modal candidates show OYSG ID + primary name + "also known as" variants + evidence-class badge + tier + MDA history count. Escape hatch "Neither — queue for further review" emits `identity_decision.type = 'flag_for_review'`.
2. **Evidence-class badges are literal class names, never confidence percentages.** Three variants: solid-slate `roster-anchored`, outline-slate `catalog`, outline-amber `backfilled TIER-N`. Placement rules defined per surface.
3. **"Also known as" replaces "alias" everywhere.** Variant-match search surfaces helper text stating which variant triggered the match. Primary name = roster name (authoritative per memo L2). No code-level `alias` field name leaks to users.
4. **Observability dashboard is pilot-scoped to BIR** with 5 tiles + 1 trend: BIR ID Coverage %, Unanchored Records, Review Queue Depth, False-Merge Rate, Canonicalizer Latency, plus 14-day coverage trend. Only false-merge-rate has an active alert threshold in 17a (>2.0% → notify Dept Admin + AG). SLA alerting on review queue deferred to 17c (needs 17.4c queue structure).
5. **No red, no exclamation, no "anomaly" language anywhere.** Attention state is amber; PIS-surfaced discrepancies are "observations"; tier is informational, not escalatory. Per project non-punitive vocabulary guardrail.

**Explicitly deferred UX work** (not wireframed in 17a): Epic 14 public-website disambiguation (17b), Transfer Queue UI (17c), Dept-Admin override buttons (17c), cross-MDA person view (Epic 18), parser-confidence indicator (17b), report/export name-stance matrix (17b), variant-collapse controls (17c).

**Sally open questions deferred to PM:** amber as attention colour (no app conflict?); MDA-Officer access to 17.obs (no in 17a — confirm); "also known as" messaging for MDA officers (not "system thinks you're wrong"); pilot-scope banner on PIS-enabled pages (proposed YES).

### 2.3 SM Bob commentary (17a sprint plan only)

> Full deliverable: `sm-bob-17a-sprint-plan-2026-04-20.md`. Integrated summary below.

**Effort sizing (17a total):** 37 story points across 6 stories.

| Story | Sizing | Sprint |
|---|---|---|
| 17.2 amendment | M (5 pts) | Sprint 1 |
| 17.4b canonicalizer | S–M (3 pts) | Sprint 1 (parallel with 17.2) |
| 17.3b amendment (Identity Anchor Ingest) | L (8 pts) | Sprint 1 (after 17.2 mid-checkpoint) |
| 17.4 amendment (PIS) | XL (13 pts) | Sprint 2 |
| 17.4d namesake modal | M (5 pts) | Sprint 2 (parallel with 17.obs) |
| 17.obs dashboard (pilot subset) | S (3 pts) | Sprint 2 (parallel with 17.4d) |

**Critical path:** 17.2 → 17.3b → 17.4 → 17.4d (31 pts). 17.4b parallelises with Sprint 1. 17.obs parallelises with 17.4d in Sprint 2.

**Sprint horizon confirmed:** 2-3 sprints (best 4 weeks, expected 5 weeks, worst 6 weeks from Deputy AG sign-off).

**Nine hard Go gates for pilot activation:**
- G1 ≥85% BIR coverage (already achieved 86%)
- G2 Zero false-merge in audit queue
- G3 Golden fixtures pass in CI
- G4 21 `_MULTI-MDA/` files counter = 0
- G5 Native-Yoruba-speaker review complete
- G6 Rollback procedure tested in staging
- G7 Deputy AG + State Auditor-General drill-down audit passes
- G8 Engineer-executed sidecar-revert runbook tested (full Dept-Admin UX is 17c)
- G9 Deputy AG signature on `DEPUTY_AG_BRIEF_2026-04-20.md`

**Demo plan (30 min):** OYSG-4812 (ALATISE) drill-down → canonicalizer trace → live namesake modal on staging → observability dashboard → coverage reality framing → roster-collection ask.

**Bob open questions deferred to PM:** Sprint 1 start T+0 assumption (buffer?); 3 dedicated devs for parallel Sprint 1 stories (guaranteed?); native-speaker reviewer scheduling owner (PO?); staging environment readiness for G6/G7.

### 2.4 Amendments to existing stories (17a-scoped only)

| Story | Proposed amendment | Rationale & evidence | Impact |
|---|---|---|---|
| **17.2** Port side-quest utilities + ingest-time content-level MDA verification | **Re-sequence ahead of 17.3b as hard blocker** (§2.5 below). Add: mid-sheet-MDA-split audit becomes a recurring pipeline scan (not one-shot). Add: 21 files in `_MULTI-MDA/` are operational-debt counter that must show zero before Identity Anchor Ingest activates in production. | Lessons memo L7 + §1.22. Mid-sheet parser handles CDU-in-Agric and OYSGPP-in-OYSAA; web-app upload parser does not. If 17.3b lands first, `_MULTI-MDA/` files upload with wrong attribution or block workflow. | Sprint sequencing hard constraint. Parser-scan recurrence adds ~2 pts. |
| **17.3b** MDA Payroll Snapshot Ingestion → **"Identity Anchor Ingest"** | **Retitle.** Reframe roster as **PIS seed**, not parallel layer. Add `PAYROLL_ROSTERS` config-driven list (**BIR only for 17a**; Works/AG/Health entries added under 17b). Fix content-vs-filename classification — OYSIPA "Staff Salary" file was mis-routed as payroll roster when content was actually car-loan returns. Explicitly acknowledge **roster-month limitation** (BIR Feb 2026 roster misses retired-before-Feb, joined-after-Feb, on-leave staff = 765 of 5,325 BIR records, 14% unanchored). Document multi-month roster collection as post-17a workstream. | Lessons memo L2, L6, §4 caution 2. Memo §11 and backfill report "BIR coverage" section. | Retitle + scope broadening; story size Medium → Large. Multi-month workstream is governance, deferred. |
| **17.4** PersonIdentityService | **Import `yoruba-name-normalize.ts` as hard dependency (not optional).** Match algorithm must be `canonicalize() → exact-match` FIRST, `canonicalize() → Lev≤2` SECOND. **No raw Levenshtein.** Golden fixtures (Alatise, Lamidi, ADELEKE, CDU) are hard regression gates. Reframe scope **pessimistically**: name-only matching is the 76% case (39 of 51 MDAs without roster); OYSG-anchored matching is the 24% case. Scale-caveat: canonicalizer validated on BIR (248 rows); Agriculture/OYRTMA/Lands scale untested — **for 17a, scope is BIR only**. Build in canonicalizer performance observability + caching hook. | Lessons memo L1, L6, §2 caution 1, §8 risk 3, §11. Canonicalizer source `scripts/legacy-report/utils/yoruba-name-normalize.ts`; test report shows 35/35 hard-coded + 189 real-data matches. | Story size L → XL. Architect Winston to confirm perf budget at pilot scale. |

### 2.5 New stories (17a-scoped)

#### 2.5.1 Story 17.4b — Yoruba/Nigerian Name Canonicalizer (utility) [NEW, Small–Medium]

**As the** PIS service and every downstream identity consumer,
**I want** a pure-function canonicalizer that collapses pronunciation variants of the same name to an identical canonical form,
**So that** PIS match runs `canonicalize → exact` before Levenshtein and avoids the "widen Lev to catch variants, accidentally merge namesakes" trap.

**Acceptance criteria:**
1. **Given** any of the 35 hard-coded merge/distinct pairs in the session's test harness, **When** the canonicalizer runs, **Then** all 35 pass (ALATISE=ALATISHE, OLUWASEGUN=OLUSEGUN, ADEWUMI=ADEWUNMI, SALAHUDEEN=SALAUDEN, FOLASADE=FOLASHADE merge; namesakes stay distinct).
2. **Given** the 9-rule set (title strip, punctuation normalise, diacritic strip, OLUWA→OLU / ADEWA→ADE / OLAWA→OLA prefix contraction, silent-H in SH[AEIOU] / PH[AEIOU], silent-H between vowels, EE/IE/EI→E cluster collapse, NM→M nasal collapse, double-consonant collapse, terminal-U after consonant), **When** applied to the 248 BIR roster names, **Then** 189 canonical-exact matches surface (matches validated test report).
3. **Given** a `canonicalizeWithTrace(name)` API, **When** called, **Then** returns the input, each rule applied with before/after, and the final output — for auditor "why did we merge these?" drill-down.
4. **Given** a native-Yoruba-speaker rule review **has not yet been scheduled**, **When** this story passes, **Then** `NATIVE_SPEAKER_REVIEW_PENDING` annotation is attached to the rule set until the review concludes (gate, not nicety — memo §8 risk 4).
5. **Given** the canonicalizer is invoked in pilot-scale hot paths, **When** observability is configured, **Then** per-call latency + rule-trace cardinality are emitted to metrics; caching hook is available.

**Dependencies:** None (pure-function utility).
**Blocks:** 17.4 (PIS).
**Effort:** Small–Medium (utility exists; port + shared-package wrap + native-speaker-review gate).
**Regression gate:** Alatise / Lamidi / ADELEKE / CDU golden fixtures.

#### 2.5.2 Story 17.4d — Namesake Disambiguation UI (modal) [NEW, Medium, high-stakes]

**As the** Dept Admin / MDA Officer / AG staff,
**I want** a disambiguation modal whenever a name resolves to ≥2 distinct OYSG IDs during pilot flows (upload, search),
**So that** pilot certificate issuance never goes to the wrong person and uploads don't silently attach to the wrong identity.

**Acceptance criteria:**
1. Modal surfaces during pilot flows: upload record attachment (Epic 5), PIS-internal search. **Epic 8 cert-issuance integration is 17b retrofit; 17a delivers the modal component ready for that integration but does not wire it into cert issuance yet.**
2. Modal shows each candidate person's: OYSG ID, primary name, variant names, MDA history (cross-MDA view), evidence class per appearance (catalog / roster / backfilled + tier).
3. User selects candidate OR escalates to "unresolved — queue for TIER-2 review" (queue component is 17c; 17a just emits the escalation event).
4. Selection persists as explicit `identity_decision` audit-log entry.
5. Accessibility: keyboard-navigable, screen-reader labelled.

**Dependencies:** 17.4 (PIS), 17.4b (canonicalizer), Sally wireframe.
**Blocks (within 17a):** none.
**Blocks (outside 17a):** Epic 8 cert retrofit (17b).
**Effort:** Medium.

#### 2.5.3 Story 17.obs — PIS Observability Dashboard (minimal pilot subset) [NEW, Small, critical-for-operating]

**As the** Dept Admin / AG ops,
**I want** a minimal ops dashboard for the BIR pilot showing review queue depth, per-MDA ID coverage % (BIR only during 17a), false-merge rate, unanchored-record count, canonicalizer latency,
**So that** we can tell whether PIS is working in the pilot, not just that it compiled.

**Acceptance criteria (17a minimum subset — full dashboard deferred to 17c):**
1. Dashboard tiles (pilot scope): Review Queue Depth, BIR ID Coverage %, False-Merge Rate, Unanchored-Record Count, Canonicalizer Latency p50/p95.
2. Event emission: every PIS decision fires `pis.auto_merge` / `pis.flag_for_review` / `pis.manual_override` / `pis.rejected`.
3. Per-MDA trajectory view: limited to BIR during 17a pilot; portfolio view deferred to 17c.
4. Alerting: false-merge-rate > threshold → notify Dept Admin + AG. Queue-depth SLA alerting deferred to 17c (requires 17.4c review-queue UI).
5. Data retention: 90 days minimum for KPI trend.

**Dependencies:** 17.4 (PIS).
**Effort:** Small (pilot subset).

### 2.6 Sequencing hard-blocker (17a-internal)

**17.2 must land before 17.3b.** Not advisory.

- **Current state:** 17.2 and 17.3b are both `backlog` without sequencing constraint in `sprint-status.yaml`.
- **Proposed constraint:** 17.2 completes (including 21 `_MULTI-MDA/` files cleanly uploaded end-to-end) before 17.3b activates in production.
- **Rationale:** 21 files route to `_MULTI-MDA/` because side-quest parser splits mid-sheet MDA content; web-app upload parser does not. If 17.3b lands first, those 21 files upload with wrong MDA attribution or block workflow.
- **Evidence:** Lessons memo L7 + §8 risk 1 + §11 table row 17.2.
- **Operational debt counter:** the 21-file count is a visible KPI tracked until 17.2 ships.

### 2.7 Success criteria for 17a pilot activation

*(Echoing the Deputy AG brief §4.)*

- ≥85% BIR coverage (already achieved: 86%).
- Zero false-merge cases in audit queue (currently 3 TIER-1-edge cases flagged for human review — correct behaviour).
- Deputy AG + State Auditor-General can independently verify any assertion via drill-down to source file → sheet → row.
- Dept Admin can override any inference via force-merge / force-split / veto control *(note: full override UX lives in 17.4e = 17c; for 17a pilot, override is via engineer-executed sidecar revert with Dept-Admin authorisation ticket).*
- 21 `_MULTI-MDA/` files uploaded end-to-end without error.
- Golden fixtures (Alatise, Lamidi, ADELEKE, CDU) pass on every rule change.

### 2.8 Risks specific to 17a pilot

*(See §8 for full risk register; the 17a-scoped subset is listed there.)*

---

## Section 3 — Epic 17b: Cross-Epic Retrofit (DEFERRED, pending separate authorisation post-pilot)

> **Status: DEFERRED.** Not in 17a activation path. Stories drafted at cross-epic-amendment level only; full story text produced by Architect Winston after post-pilot authorisation.

### 3.1 Scope summary

Retrofit of 5 done epics to consume PIS:

| Epic | Retrofit scope | Effort (memo) | Cross-epic amendment note |
|---|---|---|---|
| **Epic 2 — Loan Data** | Add nullable `person_id` FK to `loans`; backfill via PIS; staged migration (nullable → populated → non-nullable). | **Large** | Loan records carry `name: string`. Every loan record back-links to PIS via 3-phase migration. Architect Winston owns full migration plan under 17b authorisation. |
| **Epic 5 — MDA Submission** | Post-parse inference-review step; parser-confidence propagation end-to-end. | **Large** | Current upload flow parses + stores directly. Post-retrofit: parse → inference-review → commit. Parser confidence travels end-to-end. Wires 17.4d modal into upload approval path. |
| **Epic 7 — Exception Management** | New exception classes: `IDENTITY_NAMESAKE`, `TRANSFER_CANDIDATE`, `FUZZY_MATCH_REVIEW`. Each needs adjudication UI. | **Medium** | Plugs into existing Exception Queue (unified with Review Queue per Addendum 1 §17.6). Adjudication UI shares pattern with 17.4c (17c) and 17.4d (17a-component). |
| **Epic 8 — Auto-Stop Certificate** | ID-anchored certificate issuance; namesake disambiguation on issuance path. | **Medium–Large, highest legal stakes** | Certificates today issue against `name`. Namesake confusion = cert to wrong person. Highest legal-stakes retrofit in the app (memo §3.1, §8 risk 7). **Do not activate PIS in production outside BIR pilot before Epic 8 retrofit lands together with 17.4d wire-in.** |
| **Epic 14 — Public Website** | Auth-anchored lookup OR disambiguation-aware public lookup. | **Medium, privacy + legal risk** | Citizens look up loans by name today. Option A (auth-gate) vs Option B (disambiguation modal). UX Sally to decide with privacy/legal review under 17b authorisation. **Deputy AG brief explicitly flags deferral pending legal counsel.** |

### 3.2 17b authorisation prerequisites

- BIR pilot ships cleanly (17a K-gate).
- Deputy AG authorises Epic 17b scope expansion beyond SCP 2026-04-15 pilot envelope.
- Architect Winston schema-impact review for all 5 epic retrofits (completes under 17b authorisation; 17a Winston review is 17a-only).
- Legal counsel review of Epic 14 public-website privacy risk.

### 3.3 17b-scoped amendments parked here

- Epic 2/5/7/8/14 retrofit amendments (above).
- **Not Retrofitting at amendment level** (memo §4): Epic 10 (consume evidence-class, Small–Medium); Epic 11 (identity-inference gate at pre-submission, Medium); Epic 15 (consume PIS on future register runs, Small). Included in Winston 17b handover; not elevated to cross-epic amendment level.

---

## Section 4 — Epic 17c: Review Workflows + Patterns (DEFERRED, pending separate authorisation post-pilot)

> **Status: DEFERRED.** Not in 17a activation path. Pattern codification stories; some patterns (sidecar, shadow-mode) are implemented by convention during 17a pilot but story-level codification and general applicability lives in 17c.

### 4.1 Stories parked in 17c

#### 4.1.1 Story 17.4c — Cross-MDA Transfer Candidate Review Workflow [Medium]

**Scope summary:** Queue of TIER-2 transfer candidates (63 BIR-anchored identities appearing in non-BIR catalogs) with accept / reject / annotate actions, joint-signal evidence (TIER-2 ∩ Phase B `LIKELY_DUPLICATE_DEDUCTION`), per-decision audit log. Accept routes to Transfer Handshake (Epic 11). SLA per Addendum 1 §17.6a.

**Why 17c (not 17a):** 63 TIER-2 cases exist today in backfill artefact; these are a portfolio-audit surface, not BIR-pilot-critical. Pilot activation does not require the review queue to be adjudicated — cases stay in sidecar until 17c ships the UI.

**Dependencies:** 17.4b, 17.3b, 17.4 (all in 17a).

#### 4.1.2 Story 17.4e — Dept-Admin Override UX (Agreement 22 escape hatch) [Medium]

**Scope summary:** Four actions on any person / loan record view for Dept Admin — Force-Merge, Force-Split, Create Manual, Veto Pending Auto-Merge. Free-text reason + reviewer identity + timestamp → audit log. Emits `pis.manual_override` events. 72-hour undo window via sidecar-revert. Role-guarded.

**Why 17c:** 17a pilot uses engineer-executed sidecar revert with Dept-Admin authorisation ticket (§2.7) as minimum-viable override. Full UX codification deferred until operational pattern stabilises.

**Dependencies:** 17.4 (17a), 17.x (17c sidecar codification), 17.obs (17a minimal; 17c extended).

#### 4.1.3 Story 17.x — Non-Destructive Inference Sidecar Pattern [Medium]

**Scope summary:** JSON sidecar schema + read-catalog-union-sidecar convention + rollback runbook + sidecar versioning + reference implementation. Applies to PIS merge decisions, register-match overrides, backfill, transfer-candidate review, Dept-Admin overrides.

**Why 17c:** 17a pilot uses the pattern by convention (BIR backfill sidecar is live already at `staff-id-backfill-2026-04-20.json`). Story-level codification — JSON Schema, reference implementation, rollback runbook, cross-pipeline convention enforcement — lives in 17c.

#### 4.1.4 Story 17.y — Shadow-Mode Validation Gate Pattern [Small–Medium]

**Scope summary:** Every inference pipeline ships with a test-report phase running against real data + HTML human review before production activation. Promotes existing 17.34a shadow-dashboard-pre-pilot to general pattern.

**Why 17c:** 17a pilot uses shadow mode by process agreement (canonicalizer test report already exists; PIS shadow run mandatory before pilot activation — this is a new Team Agreement 23, see §6). Story-level codification of the gate as template + infrastructure applicable across all pipelines lives in 17c.

#### 4.1.5 Story 17.11b — Self-Healing Ingest Cleanup [Small–Medium]

**Scope summary:** Scheduled sweep prunes stale artefacts (filesystem + DB); auto-demotes/promotes tier flags as new evidence arrives; archives (not deletes) pruned artefacts with 90-day retention; covers `_UNRESOLVED/`, `_MULTI-MDA/`, backfill sidecar staleness, review-queue stale flags.

**Why 17c:** BIR pilot doesn't accumulate stale artefacts at pilot scale in pilot time window. Self-healing becomes critical at portfolio scale.

**Dependencies:** 17.11 amendment (17c), 17.y (17c), 17.x (17c).

### 4.2 Amendments parked in 17c

#### 4.2.1 Story 17.3c — Scheme Beneficiary Register ingest + schema fanout amendment

**Amendment:** Add `evidenceClass` + `rawIdVariants[]` + `nameVariants[]` fields to person records. Drop "single canonical name" assumption. Staff-ID raw variants flow through schema OR audit trail.

**Why 17c (not 17a):** 17a core PIS tables get these fields in Winston's 17a schema. Register-side fanout — applying the same fields across scheme-register tables and the ingest pipeline — is 17c scope because it couples with 17.3c's register-ingest behaviour, which is not 17a-pilot-critical.

#### 4.2.2 Story 17.3d — Employment Event Register ingest + schema fanout amendment

**Amendment:** Same field additions as 17.3c.

**Why 17c:** Same rationale as 17.3c.

#### 4.2.3 Story 17.11 — Missing-record detection amendment

**Amendment:** Add self-healing cleanup pass. Every ingest pipeline includes reconciliation sweep that prunes stale artefacts + auto-demotes/promotes tier flags as evidence arrives.

**Why 17c:** Couples with 17.11b (new 17c story).

### 4.3 17c authorisation prerequisites

- BIR pilot ships cleanly (17a K-gate).
- Operational learning from 17a pilot informs 17.4e override UX detail, 17.4c queue scaling, 17.obs extended dashboard.
- Deputy AG authorises 17c scope.

---

## Section 5 — Epic 18: Historical Data Governance (INPUT ONLY, post-go-live)

> **Status: INPUT ONLY.** Flagged as candidate stories. Epic 18 creation requires Deputy AG authorisation; PO cannot unilaterally create a new epic beyond current pause-pending boundary.

### 5.1 Candidate stories

| ID | Title | Scope summary | Effort (memo) |
|---|---|---|---|
| **18.1** | Register Versioning | Each approval carries `register_source` + `snapshot_date`; reconciliation queries specify `as_of_date` parameter. Answers "was X an approved beneficiary as of March 2025?". | Large |
| **18.2** | Cross-MDA Person-Centric Navigation (product surface) | Promote the session's `by-staff-id/` drill-down pattern to first-class app navigation axis. 1,537-page static HTML tree is the prototype. | Large |
| **18.3** | Loan-Cycle Detection + Product Surface | Algorithm: group records by `(principal, totalLoan, installmentCount, startDate, mda)` signature; same signature = same cycle. Unlocks active-loans view, top-up detection, completion %, refinance detection, loan lifecycle dashboard. | Large |
| **18.4** | NOT_REGISTERED Audit Queue | Product surface for the 1,312 IDs-with-catalog-deductions-but-no-2024-2025-approval (memo §10 item 18). | Medium |
| **18.5** | Federated Identity Extension Path (design only) | Document how PIS extends from car-loan-scoped to cross-scheme identity (housing loan, pensions, payroll). Design artefact, not implementation. | Small (design only) |

### 5.2 Epic 18 authorisation prerequisites

- Go-live achieved via Epic 17a + 17b + 17c K-gates.
- Deputy AG authorises new epic (beyond pause-pending boundary).
- Product review of which 18.x candidates become backlog vs deferred further.

---

## Section 6 — Cross-cutting: Team Agreements, SCP corrections, process additions

### 6.1 Team Agreements 23–26 (new)

*(Supplement, do not replace, Agreements 17–22. Updated list: Agreements 17–26.)*

| # | Agreement | Rationale (memo reference) | Applies during 17a? |
|---|---|---|---|
| **23** | **Shadow-mode validation gate.** Every inference pipeline in Epic 17 (PIS, register-match, backfill, transfer-review) must ship with a test-report phase running against real data + HTML human review before production activation. | Memo L8 + §2 caution 6. | YES — canonicalizer test report + PIS shadow run pre-pilot. |
| **24** | **Golden fixtures as regression gates.** Alatise (51 records, 8 observations), Lamidi (36 records, overdeduction), ADELEKE (namesake), CDU (parent/child) fixtures must pass on every PIS / canonicalizer / register-match rule change. Failure blocks deployment. | Memo L8 + §8 risk 9; strengthens Agreement 18. | YES — enforced on every 17a rule change. |
| **25** | **Pilot before portfolio — strict sequencing.** Epic 17 pilots with BIR (roster in hand, 248 staff) before rolling to Agriculture (11,425) or other large MDAs. Failure is recoverable at pilot scale; unrecoverable at portfolio scale. | Memo §8 risk 10; strengthens Agreement 20. | YES — 17a is the pilot; 17b portfolio roll-out is authorised separately. |
| **26** | **Single-source-of-truth folder pattern.** Every Epic 17 deliverable folder (reports, inference sidecars, audit exports, session outputs) ships with a Section 0 topology table at the top of the README — one canonical entry point per artefact bundle. | Memo L10. | YES — already in use in `VLPRS-Reconciliation-2026-04-18/`. |

### 6.2 SCP numeric corrections

Two factual corrections to Addendum 1 and the underlying SCP.

**6.2.1 MDA OYSG ID coverage: 12 of 51, not 20.**

- **Prior framing:** "20 of 52 MDAs have OYSG ID presence" (from an earlier catalogue survey).
- **Current reality (verified from `staff-id-registry-2026-04-20.html`):** **12 of 51 MDAs** — EDUCATION (641), WORKS AND TRANSPORT (251), BIR (248), FIRE (144), ESTABLISHMENT (91), HOS (67), OYSROMA (51), ACCOS (45), PENSIONS BOARD (29), CSC (18), INFORMATION (8), OYSADA (6).
- **Remaining 39 MDAs** rely on name-only matching until rosters arrive. Large name-only MDAs: Agriculture (11,425), OYRTMA (4,390), Lands (4,352), Health (2,362), Justice (2,030), Water Corporation (2,217).
- **Action:** Update `epics.md` and SCP 2026-04-15 narrative where "20 of 52" appears; update Story 17.4 scoping narrative.

**6.2.2 PIS scope re-framing: name-only is the 76% case.**

- **Prior framing (implicit):** OYSG-anchored matching is the expected common case.
- **Corrected framing:** **Name-only matching is the 76% case (39 of 51 MDAs); OYSG-anchored matching is the 24% case (12 of 51).** Story 17.4 sizing/architecture must be pessimistic.
- **Action:** Reflect in Story 17.4 amendment (§2.4) and Architect Winston 17a schema design.

### 6.3 Process additions (beyond the four Team Agreements)

- **Epic-split-aware sprint-status.yaml:** post-authorisation, `sprint-status.yaml` must carry sub-epic tags (17a / 17b / 17c / 18) so sprint planning can filter by activation status.
- **Sub-epic K-gates codified:** each sub-epic has its own K-gate. Retro 1 (Foundation) per project memory triggers post-17a K-gate, not post-full-Epic-17 K-gate.
- **Contract-test surface between 17a and 17b:** Winston to define integration-seam contract tests so 17b retrofits don't require re-architecting 17a tables.

---

## Section 7 — Handover scoping for named agents

> **Strict scope discipline.** Winston / Sally / Bob each work 17a-pilot scope only. 17b / 17c / Epic 18 commentary is not produced in this handover round.

### 7.1 Architect Winston — 17a schema only

**Deliverable:** `architect-winston-17a-schema-2026-04-20.md`

**Scope constraint:** 17a stories ONLY. No retrofit to Epic 2/5/7/8 (that's 17b). No 17c pattern codification. No Epic 18.

**Questions to answer:**
1. PersonIdentityService (PIS) service architecture for 17a scope.
2. Inference sidecar schema (DB table vs JSONB column) — minimal schema supporting 17a pilot; full codification deferred to 17c.
3. Audit log schema for identity inferences — no retrofit to Epic 2/5/7/8 yet.
4. Canonicalizer performance envelope at pilot scale (BIR: 248 roster + 5,325 catalog).
5. Migration strategy for adding `person_id` to new PIS tables only — no back-migration to Epic 2 loans yet.

**Length cap:** 400 lines max. Focused, not exhaustive.

**Output format:** structured markdown with tables per decision point.

### 7.2 UX Sally — 17a UX surfaces only

**Deliverable:** `architect-sally-17a-ux-2026-04-20.md`

**Scope constraint:** 17a UX surfaces ONLY: namesake disambiguation modal (17.4d), minimal observability dashboard (17.obs). **DO NOT** wireframe Epic 14 public website retrofit (17b), transfer-candidate review queue (17.4c = 17c), Dept-Admin override UX (17.4e = 17c), cross-MDA person view (Epic 18).

**Deliverables to produce:**
- Namesake disambiguation modal wireframe + interaction flow.
- Evidence-class badge visual system (catalog / roster / backfilled).
- Variant-name display pattern (primary + "also known as").
- Minimal PIS observability dashboard (review queue depth, coverage %, unanchored trend).

**Output format:** ASCII wireframes or markdown-described wireframes; no image assets. Focus on interaction logic + decision points.

### 7.3 SM Bob — 17a sprint planning only

**Deliverable:** `sm-bob-17a-sprint-plan-2026-04-20.md`

**Scope constraint:** 17a pilot planning ONLY.

**Deliverables to produce:**
- Story sequencing for 17a (17.2 → 17.4b → 17.3b → 17.4 → 17.4d → 17.obs).
- Sprint allocation (2-3 sprint horizon per brief).
- Parallelisation opportunities within 17a.
- Dependency graph with critical path.
- Pilot activation Go/No-Go gates.
- Demo plan for Deputy AG walkthrough.

**Output format:** structured markdown with dependency tables + sprint boundaries.

---

## Section 8 — Risk register (scoped to 17a pilot; 17b/17c/Epic 18 risks noted but not in-scope)

### 8.1 17a pilot risks (IN SCOPE)

| # | Risk | Likelihood | Impact | Owner | Mitigation (17a-scoped) |
|---|---|---|---|---|---|
| 1 | 17.2 delay blocks 17.3b, cascading into PIS + pilot | Medium | High | SM Bob | Sequence 17.2 first per §2.6; track 21-file counter as visible KPI until zero. |
| 2 | BIR roster is sole current anchor for 17a; multi-month roster acquisition deferred | Medium (pilot window) | Medium | PO Awwal | Pilot-scope-limit: 17a ships on BIR Feb 2026 roster only. Multi-month acquisition is post-pilot (17b authorisation). Accept 765 unanchored records (14%) as known limit for pilot. |
| 3 | Name-only matching at scale untested (canonicalizer validated on BIR 248 rows only) | High (outside BIR) / Low (within BIR pilot) | High (outside) / Low (pilot) | Architect Winston | 17.4b observability hook; Agriculture shadow-mode run before 17b production. For 17a, BIR scale is within validated envelope. |
| 4 | Native-Yoruba-speaker review of canonicalizer rules still pending | Medium | Medium | PO Awwal | Schedule review as gating event on 17.4b. `NATIVE_SPEAKER_REVIEW_PENDING` annotation on rule set until review concludes. Pilot-blocking per Agreement 23. |
| 5 | Pause-pending-authorisation extends; memory of session staleness | Medium | Medium | PO Awwal | Deputy AG Pause-Exit Brief + per-staff drill-down (1,536 pages) + backfill sidecar IS the brief. Brief-ready today. |
| 6 | Certificate issued to wrong person via namesake confusion during pilot | Low (pilot explicitly does not wire 17.4d into cert issuance) | Critical (if it happens) | Dept Admin | **17a pilot does NOT activate cert issuance on PIS-inferred identities.** Namesake modal ships as component; Epic 8 wire-in is 17b. Pilot cert issuance follows current name-based flow with Dept Admin review. |
| 9 | Golden identity fixtures diverge from production over time | Low (pilot window short) | Medium | SM Bob | Agreement 24 codified. Fixtures versioned alongside canonicalizer; fail-closed on divergence. |
| 10 | Portfolio rollout without BIR pilot verification creates unrecoverable data corruption | Low (Agreement 20 + 25 in place) | Critical | PO Awwal | Agreements 25 + 20 explicitly prevent; 17b authorisation gate enforces. |

### 8.2 Noted-but-not-in-scope risks (17b / 17c / Epic 18)

| # | Risk | Parked for |
|---|---|---|
| 7 | Certificate retrofit (Epic 8) — highest legal-stakes surface | 17b. Ship 17.4d wire-in + Epic 8 retrofit together; do not release PIS-keyed certs before both land. |
| 8 | Federated upload + post-PIS inference gap — MDA officer self-submits, no explicit agreement step | 17b (Epic 5 retrofit). |
| 11 | Review queue SLA growth outpaces Dept-Admin capacity | 17c (17.4c + 17.6a capacity planning). |
| 12 | Canonicalizer missed-variant (name-order, Arabic extensions) | 17c / 17b v2. Phonetic fallback candidate for future. |
| 13 | Epic 14 public-website privacy risk | 17b, pending legal counsel review per Deputy AG brief. |
| 14 | Scale behaviour on Agriculture (11,425), OYRTMA (4,390) | 17b portfolio roll-out. |

---

## Appendix A — Evidence cross-reference

| Memo claim | Validated against | Status |
|---|---|---|
| 35/35 hard-coded canonicalizer tests passing | `yoruba-name-normalizer-test-2026-04-20.html` section 1 header | Verified |
| 189 canonical-exact matches against real BIR data | Same report, stat tile + section 2a header | Verified |
| 4,560 Staff IDs recovered (TIER-1 + TIER-3) | `staff-id-backfill-2026-04-20.md` summary table | Verified (4,525 + 35 = 4,560) |
| 85.6% BIR coverage (4,560 of 5,325) | Same report "BIR coverage" section | Verified |
| 63 TIER-2 cross-MDA transfer candidates | Same report TIER row + per-MDA breakdown | Verified |
| 1,536 distinct staff anchored | `staff-id-registry-2026-04-20.html` index meta | Verified (1,537 pages = 1,536 drill-downs + 1 index) |
| 12 of 51 MDAs with OYSG ID presence | `staff-id-registry-2026-04-20.html` per-MDA staff count | Verified (Education, Works and Transport, BIR, Fire, Establishment, HOS, OYSROMA, ACCOS, Pensions Board, CSC, Information, OYSADA) |
| 765 unanchored BIR records (14%) | `staff-id-backfill-2026-04-20.md` | Verified |
| 89 dup-ID Names | `staff-id-registry-2026-04-20.html` stat tile | Verified |
| 21 files in `_MULTI-MDA/` | Memo L7 / §1.22 — not directly counted in viewed artefacts | Cannot independently verify from artefacts; flagged for Awwal confirmation |
| 494 Phase B `LIKELY_DUPLICATE_DEDUCTION` candidates, 11 HIGH-conf | Memory `project_phase_b_transfer_hypothesis` (2026-04-16) | Cross-referenced from project memory; not new claim |
| "20 of 52 MDAs" prior memory → "12 of 51" correction | Registry shows 12 | Registry is source of truth |

---

## Appendix B — Story-to-sub-epic mapping (final)

| Story / Amendment | Sub-epic | Type | Section |
|---|---|---|---|
| 17.2 amendment (parser port + mid-sheet split + 21-file counter) | **17a** | Amendment | §2.4 |
| 17.3b amendment (retitle "Identity Anchor Ingest" + PIS seed framing + BIR-only roster config) | **17a** | Amendment | §2.4 |
| 17.4 amendment (canonicalizer hard dep + Lev-free match + golden fixtures + pessimistic framing + BIR-only pilot scope) | **17a** | Amendment | §2.4 |
| 17.4b — Yoruba Name Canonicalizer (utility) | **17a** | NEW | §2.5.1 |
| 17.4d — Namesake Disambiguation Modal (component-only for 17a; Epic 8 wire-in is 17b) | **17a** | NEW | §2.5.2 |
| 17.obs — PIS Observability Dashboard (minimal pilot subset) | **17a** | NEW | §2.5.3 |
| Sequencing 17.2 before 17.3b (hard-blocker) | **17a** | Constraint | §2.6 |
| Epic 2 retrofit (person_id FK staged migration) | **17b** | Retrofit | §3.1 |
| Epic 5 retrofit (post-parse inference review + confidence propagation) | **17b** | Retrofit | §3.1 |
| Epic 7 retrofit (IDENTITY_NAMESAKE / TRANSFER_CANDIDATE / FUZZY_MATCH_REVIEW classes) | **17b** | Retrofit | §3.1 |
| Epic 8 retrofit (ID-anchored cert issuance + namesake modal wire-in) | **17b** | Retrofit | §3.1 |
| Epic 14 retrofit (auth-anchored or disambiguation-aware public lookup) | **17b** | Retrofit | §3.1 |
| 17.4c — Cross-MDA Transfer Candidate Review Workflow | **17c** | NEW | §4.1.1 |
| 17.4e — Dept-Admin Override UX | **17c** | NEW | §4.1.2 |
| 17.x — Non-Destructive Inference Sidecar Pattern (codification) | **17c** | NEW | §4.1.3 |
| 17.y — Shadow-Mode Validation Gate Pattern (codification) | **17c** | NEW | §4.1.4 |
| 17.11b — Self-Healing Ingest Cleanup | **17c** | NEW | §4.1.5 |
| 17.3c amendment (schema fanout: evidenceClass + nameVariants[] + rawIdVariants[] on register tables) | **17c** | Amendment | §4.2.1 |
| 17.3d amendment (same schema fanout for employment-event register) | **17c** | Amendment | §4.2.2 |
| 17.11 amendment (self-healing reconciliation sweep) | **17c** | Amendment | §4.2.3 |
| 18.1 — Register Versioning | **Epic 18** | NEW candidate | §5.1 |
| 18.2 — Cross-MDA Person-Centric Navigation | **Epic 18** | NEW candidate | §5.1 |
| 18.3 — Loan-Cycle Detection + Product Surface | **Epic 18** | NEW candidate | §5.1 |
| 18.4 — NOT_REGISTERED Audit Queue | **Epic 18** | NEW candidate | §5.1 |
| 18.5 — Federated Identity Extension Path (design only) | **Epic 18** | NEW candidate | §5.1 |

**Authorisation status by sub-epic:**
- **17a — AUTHORISED** under existing SCP 2026-04-15 envelope (Pause-Exit Brief subject to Deputy AG sign-off).
- **17b — PAUSED** pending separate post-pilot authorisation.
- **17c — PAUSED** pending separate post-pilot authorisation.
- **Epic 18 — INPUT ONLY** pending Deputy AG authorisation of new epic creation.

---

*End of DRAFT. Reorganised by sub-epic on 2026-04-20 following PO approval of Option B (Epic 17 split). Winston / Sally / Bob sections (§2.1 / §2.2 / §2.3) to be integrated inline as sub-agents return their 17a-scoped deliverables. Await Deputy AG sign-off on `DEPUTY_AG_BRIEF_2026-04-20.md` before publishing as `scp-2026-04-15-addendum-2.md`.*
