---
title: SM Bob — Epic 17a Sprint Plan (17a pilot scope only)
author: SM Bob (acting) — invoked by PM John after Winston + Sally
date: 2026-04-20
scope: 17a pilot sprint planning ONLY — story sequencing, sprint allocation, dependency graph, Go/No-Go gates, Deputy AG demo plan
out_of_scope: 17b / 17c / Epic 18 planning; portfolio roll-out scheduling; retrofit sizing
parent_scp: scp-addendum-2-2026-04-20-DRAFT.md §2.3
inputs:
  - architect-winston-17a-schema-2026-04-20.md (schema decisions)
  - architect-sally-17a-ux-2026-04-20.md (UX surfaces)
  - DEPUTY_AG_BRIEF_2026-04-20.md (pilot success criteria)
---

# SM Bob — Epic 17a Sprint Plan

**Persona:** SM Bob (acting)
**Scope constraint (strict):** 17a pilot only.
**Sprint horizon claim from Deputy AG brief §4:** "2-3 sprints to production pilot activation, assuming team capacity and schema-impact review completes". This plan confirms or revises that estimate based on Winston's schema + Sally's UX.

---

## 1. 17a story inventory (final, from SCP §2)

| Story | Type | Effort (sized) | Source |
|---|---|---|---|
| **17.2** amendment | Re-sequence + mid-sheet recurring scan + 21-file counter | **M** (5 pts) | SCP §2.4 |
| **17.4b** | Yoruba/Nigerian Name Canonicalizer (utility) | **S–M** (3 pts) | SCP §2.5.1 |
| **17.3b** amendment | Retitle → Identity Anchor Ingest + BIR roster seed + OYSIPA mis-route fix | **L** (8 pts) | SCP §2.4 |
| **17.4** amendment | PIS with hard canonicalizer dep + golden fixtures + BIR pilot scope | **XL** (13 pts) | SCP §2.4 |
| **17.4d** | Namesake Disambiguation Modal (component only; no Epic 8 wire-in) | **M** (5 pts) | SCP §2.5.2 |
| **17.obs** | PIS Observability Dashboard (minimal pilot subset) | **S** (3 pts) | SCP §2.5.3 |

**Total pilot-scope effort:** 37 story points.

**Not in 17a (confirmed out):**
- 17.4c (17c), 17.4e (17c), 17.x (17c), 17.y (17c), 17.11b (17c), 17.11 amendment (17c), 17.3c amendment (17c), 17.3d amendment (17c).
- Epic 2/5/7/8/14 retrofits (17b).
- Epic 18 candidates.

---

## 2. Dependency graph

```
                            [17.2 parser port]
                                    |
                                    |  hard blocker (§2.6)
                                    v
  [17.4b canonicalizer]      [17.3b Identity Anchor Ingest]
           |                          |
           |  hard dep                |  seeds `person`
           v                          v
                [17.4 PersonIdentityService]
                 |                      |
                 v                      v
       [17.4d Namesake Modal]    [17.obs Dashboard]
```

### 2.1 Dependency table

| Story | Depends on | Blocks | Parallelisable with |
|---|---|---|---|
| 17.2 | none | 17.3b | 17.4b |
| 17.4b | none | 17.4 | 17.2 |
| 17.3b | 17.2 (hard), Winston schema (person table) | 17.4 | 17.4b (partial — 17.4b can complete while 17.3b runs) |
| 17.4 | 17.4b (hard), 17.3b (seed data), Winston schema | 17.4d, 17.obs | — |
| 17.4d | 17.4 (verdict API), Sally wireframe | — | 17.obs |
| 17.obs | 17.4 (event emission), Sally dashboard spec | — | 17.4d |

### 2.2 Critical path

**17.2 → 17.3b → 17.4 → (17.4d ‖ 17.obs)**

Critical path effort: 5 + 8 + 13 + 5 = **31 points** (using 17.4d as the later of the two post-17.4 stories by effort; 17.obs is 3 so 17.4d is the tail).

### 2.3 Parallelisation opportunity

**17.4b runs in parallel with 17.2 and 17.3b.**

This saves roughly 3 points off the serial timeline:
- Sprint 1 starts 17.2 + 17.4b in parallel.
- 17.4b can fully complete before 17.3b starts 17.4-prerequisite work.
- Canonicalizer is pure-function utility; zero schema dependency; one developer owns.

**17.4d and 17.obs run in parallel in the final sprint** — different surfaces, different files, same 17.4 API dependency. Two developers.

---

## 3. Sprint allocation (2-sprint plan, with Sprint 3 as contingency)

### Sprint 1 — Foundation + parallel canonicalizer (2 weeks)

| Story | Effort | Owner | Status at sprint end |
|---|---|---|---|
| 17.2 amendment | 5 pts | Dev A | **DONE** — parser ported, 21 `_MULTI-MDA/` files upload cleanly, recurring scan wired |
| 17.4b | 3 pts | Dev B | **DONE** — canonicalizer package published, 35/35 tests pass in CI, caching hook exposed, `NATIVE_SPEAKER_REVIEW_PENDING` annotation live |
| 17.3b amendment | 8 pts | Dev A (after 17.2) + Dev C (Winston schema tables) | **IN PROGRESS → DONE** — migrations 1–4 applied, BIR roster seeded into `person`, `inference_sidecar` populated from backfill JSON |

**Sprint 1 capacity:** 16 pts across 3 devs (fits standard 2-week sprint).

**Sprint 1 K-gate (internal):**
- 21-file counter = 0.
- Canonicalizer CI green on golden fixtures.
- 1,536 `person` rows live in DB.
- 4,560 `inference_sidecar` rows live in DB.
- No migrations fail; rollback procedure tested in staging.

### Sprint 2 — PIS core + UX surfaces (2 weeks)

| Story | Effort | Owner | Status at sprint end |
|---|---|---|---|
| 17.4 amendment (PIS) | 13 pts | Dev A + Dev C | **DONE** — resolve API live, 5 verdicts, namesake-frequency guard, golden fixtures as CI gate, performance observability wired |
| 17.4d (namesake modal) | 5 pts | Dev B (frontend) | **DONE** — modal component, upload flow wired, audit log emission, Sally visual spec conformance |
| 17.obs (dashboard) | 3 pts | Dev D (half-sprint) | **DONE** — 5 tiles + trend, Prometheus metrics wired, false-merge-rate alert configured |

**Sprint 2 capacity:** 21 pts across 3–4 devs (tight but achievable; PIS at 13 is the long pole).

**Sprint 2 K-gate (pilot activation gate):** see §4.

### Sprint 3 — Contingency + pilot activation walkthrough (1 week)

Reserved for:
- Native-Yoruba-speaker review completion (if not done by end of Sprint 2).
- Bug fix + polish from Sprint 2 shadow-mode run.
- Deputy AG demo rehearsal + walkthrough (§5).
- Pilot activation in production.

If Sprint 2 K-gates pass clean: Sprint 3 collapses to a 2-3 day activation window.

**Worst-case total horizon:** 5 weeks from Deputy AG authorisation to production pilot activation.
**Best-case total horizon:** 4 weeks (2 sprints + 2 days activation).

---

## 4. Pilot Activation Go/No-Go Gates

Per Deputy AG brief §4 success criteria + Winston §5.3 rollback readiness.

### 4.1 Hard Go gates (ALL must pass)

| Gate | Pass criterion | Owner |
|---|---|---|
| G1 — BIR coverage | ≥85% (already achieved: 86%) | PIS metrics |
| G2 — Zero false-merge in audit queue | 0 `identity_decision.type = 'rejected'` rows from pre-activation shadow run | Dept Admin review |
| G3 — Golden fixtures pass | Alatise, Lamidi, ADELEKE, CDU all green in CI | SM Bob |
| G4 — 21 `_MULTI-MDA/` files counter | = 0 | Dev A |
| G5 — Native-Yoruba-speaker review | Rule set annotation moved from `NATIVE_SPEAKER_REVIEW_PENDING` to `NATIVE_SPEAKER_REVIEW_COMPLETE` | PO Awwal |
| G6 — Rollback procedure tested | Dry run in staging succeeds (drop tables + restore) | Dev C + Winston sign-off |
| G7 — Drill-down audit | Pick any record from `by-staff-id/`; follow drill-down to source file → sheet → row; auditor confirms | Deputy AG + State Auditor-General |
| G8 — Dept-Admin override path exists | Engineer-executed sidecar revert runbook tested end-to-end (full UX is 17c) | Dev C |
| G9 — Deputy AG authorisation signed | Signature on `DEPUTY_AG_BRIEF_2026-04-20.md` | PO Awwal |

### 4.2 Soft gates (should pass; block only if red)

| Gate | Pass criterion |
|---|---|
| S1 — Canonicalizer latency p99 < 10ms | Prometheus dashboard |
| S2 — Observability dashboard populating | All 5 tiles show data |
| S3 — False-merge-rate alert wired | Test alert fires via synthetic rejection event |
| S4 — Namesake modal rendered correctly on real data | Manual walkthrough via shadow-mode upload |

### 4.3 No-Go triggers

Any of:
- Golden fixtures fail on any rule change (Agreement 24 block).
- Native-speaker review flags semantically-incorrect merges that the canonicalizer cannot reject via adjustment.
- Rollback dry-run fails in staging.
- Deputy AG authorisation not received.

**On No-Go:** re-enter Sprint 3 with targeted fix scope; re-run gates.

---

## 5. Deputy AG Demo Plan

Per Deputy AG brief §10 walkthrough offer — 30-minute session.

### 5.1 Demo structure (30 min)

| Minute | Segment | Artefact shown |
|---|---|---|
| 0–3 | Framing — pilot scope, what is and isn't in 17a | Deputy AG brief §3 sub-epic table |
| 3–8 | Concrete identity case — ALATISE BOSEDE SUSAINAH | `by-staff-id/OYSG-4812.html` — drill from registry → per-staff page → source spreadsheet cell |
| 8–15 | Canonicalizer — how 9 rules recovered her across 2 spellings | `yoruba-name-normalizer-test-2026-04-20.html` — open trace view; walk ADEWUMI/ADEWUNMI |
| 15–20 | Live upload + namesake modal (on staging) | Pilot app, trigger ADEWUMI SAMUEL ambiguous upload; Dept Admin disambiguates |
| 20–24 | Observability dashboard | 17.obs tiles + trend |
| 24–28 | Coverage reality + 14% unanchored honest framing | `staff-id-registry-2026-04-20.html` per-MDA breakdown; acknowledge 12 of 51 MDA limit |
| 28–30 | Roster-collection protocol ask + deferred-work framing | Deputy AG brief §5 risk 1 + §6 deferrals |

### 5.2 Demo-readiness checklist

- [ ] Staging environment has Sprint 2 Go-gates all green.
- [ ] OYSG-4812 drill-down rendered and clickable.
- [ ] Canonicalizer test report accessible from deputy AG's browser.
- [ ] Pilot-app upload flow can trigger namesake modal on demand (seed an ambiguous record if needed).
- [ ] 17.obs dashboard is live and populating.
- [ ] Printed copy of Deputy AG brief for follow-up.

---

## 6. Risk-adjusted sprint planning

### 6.1 Sprint-level risks (from SCP §8.1)

| Risk | Mitigation applied in this plan |
|---|---|
| R1 — 17.2 delay cascades | Sprint 1 starts 17.2 as highest-priority; Dev A dedicated; no parallel story until 17.2 reaches mid-sprint checkpoint |
| R2 — BIR roster sole anchor | Accepted as pilot scope; no sprint contingency needed (the pilot is defined by this scope) |
| R3 — Canonicalizer scale untested | BIR-only scope enforced via Winston's `pilot_scope_tag`; no Agriculture/OYRTMA load during 17a |
| R4 — Native-speaker review pending | G5 is a hard gate; SM Bob + PO Awwal schedule the review during Sprint 1 to avoid Sprint 3 contingency use |
| R5 — Authorisation extends | Out of sprint control; Sprint 1 cannot start until G9 signed. Sprint planning holds at "T+0 from authorisation" rather than calendar date |
| R6 — Certificate issued to wrong person | 17a pilot does NOT wire namesake modal into cert issuance — Sally §1.5 explicitly defers to 17b. Sprint plan honours this |
| R9 — Fixture divergence | CI gate from day one; Sprint 1 K-gate requires passing |

### 6.2 Capacity assumptions

- 3-4 devs available full-time for 17a.
- No parallel non-17a work competing for same devs.
- Dept Admin + PO + AG ops time for G2/G5/G7 gates scheduled in advance of Sprint 2 end.

If capacity drops (e.g. 2 devs), Sprint 2 stretches: 21 pts for 2 devs over 2 weeks is tight. Plan allows Sprint 3 to absorb overflow.

---

## 7. Post-pilot handoff (what 17a produces for 17b)

Bob flags these as inputs Winston's 17b planning will need:

1. **PIS `resolve()` API is stable** — 17b Epic 2/5/7/8/14 retrofits consume this contract.
2. **Sidecar pattern is proven by convention** — 17c codification story has a live reference implementation to generalise from.
3. **Observability baseline exists** — 17c extended dashboard extends the 17.obs base; no green-field design needed.
4. **Golden fixtures are in CI** — 17b/17c inherit the regression gate automatically.
5. **Pilot coverage + false-merge rate actuals** — data to inform 17b scale planning (especially Agriculture scale estimate).

---

## 8. Open questions Bob defers back to PM John

1. **Sprint cadence** — does Sprint 1 start on Deputy AG sign-off date, or is there a buffer (e.g. kickoff meeting, team ramp-up)? Plan assumes T+0 from sign-off.
2. **Dev capacity for Sprint 1** — 3 parallel stories (17.2 + 17.4b + 17.3b-partial) requires 3 dedicated devs. Is this guaranteed? If only 2 devs available, 17.4b slips to overlap 17.3b more, adding critical-path risk.
3. **Native-speaker reviewer scheduling** — who confirms the appointment in Sprint 1? PO or PM? Plan assumes PO via §6.1 R4.
4. **Staging environment readiness for G6/G7 gates** — does the staging env currently have sufficient production-mirror data for a rollback dry-run + drill-down audit? Ops confirm needed.

---

## 9. Summary: the 2-3 sprint claim, confirmed

Deputy AG brief §4 claims "2-3 sprints to production pilot activation". This plan **confirms** that claim:

- **Best case:** 2 sprints (4 weeks) if all gates green on first pass + native-speaker review scheduled in Sprint 1.
- **Expected case:** 2.5 sprints (~5 weeks) if Sprint 3 contingency absorbs 1-2 days of polish + activation.
- **Worst case within plan:** 3 sprints (6 weeks) if native-speaker review delays or staging-environment gates need rework.

**Beyond 3 sprints = replan trigger.** Bob will escalate to PM John with a revised Sprint 4+ plan if any Sprint 2 hard-Go-gate fails without fix-forward path.

---

*End of Bob deliverable. Handoff: PM John integrates into SCP §2.3; final SCP Addendum 2 synthesis follows.*
