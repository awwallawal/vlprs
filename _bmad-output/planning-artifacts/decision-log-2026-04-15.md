# Decision Log — 2026-04-15 Session

**Session trigger:** Retrospective workflow invoked post E15-prep + Multi-MDA UAT. Evolved into Course Correction producing Sprint Change Proposal for Epic 17.

**Decision scope:** Architectural redirect producing a new 34-story Epic 17, retiring / rescoping multiple planned epics, establishing governance principles, and pausing authoritative go-live pending Epic 17 completion.

**How to read this log:** One decision per entry. Context → Decision → Rationale → Owners → References. Scannable for "what was decided and why."

---

## D-01 — Retrospective pauses; Course Correction invoked instead

- **Context:** Retro workflow began; deep audit of Alatise Bosede Susainah (51 records) exposed architectural gap (identity, lifecycle, variance coupling) that retrospective cannot solve.
- **Decision:** Pause retrospective workflow; invoke `correct-course` workflow to produce Sprint Change Proposal.
- **Rationale:** Retro is for lessons learned on shipped work. An architectural redirect requires MAJOR-scope planning deliverable.
- **Owners:** John (PM), Bob (SM).
- **References:** SCP §1, §3.

---

## D-02 — Authoritative go-live paused

- **Context:** Audit evidence shows today's pipeline would publish confidently-wrong AG figures (Lamidi's `paid=61, remaining=-1`; Alatise's 28-declared-tenure-vs-50-actual-tenure). Publishing would compound financial and political-governance risk.
- **Decision:** Pause production go-live of VLPRS authoritative figures pending Epic 17 + BIR pilot cycle. Non-authoritative operational mode preserved.
- **Rationale:** GovFin context makes plausibly-wrong numbers worse than no numbers. Honest framing preserves AG credibility.
- **Owners:** Awwal (PO); Deputy AG for authorisation.
- **References:** SCP §1 problem statement; PDFs (`alatise-deputy-ag-summary.pdf`).

---

## D-03 — Epic 17 created, consolidated from scattered stories

- **Context:** Initial proposal scattered new stories across Epics 1, 12, 17 by thematic inheritance. Awwal challenged: why not one epic?
- **Decision:** Single Epic 17 "Identity, Continuity & Authoritative Go-Live Readiness" containing all related stories (identity, lifecycle, variance, reconciliation, dashboard, certificate, overdeduction, policy, backfill, pilot). 34 stories total in 11 sub-themes.
- **Rationale:** Single origin event (UAT + audit), single acceptance gate (BIR pilot), single retrospective. Cleaner stakeholder framing.
- **Owners:** John (PM).
- **References:** SCP §4.1.

---

## D-04 — Lint ratchet as Story 17.0 (not separate hygiene backlog)

- **Context:** Originally proposed lint ratchet as Story 1.12 hygiene backlog. Awwal: "resolved as the first story in Epic 17 so it doesn't get buried."
- **Decision:** Lint ratchet is Story 17.0 — first story, CI enforced from day one. Existing 46 `any` warnings become a visible countdown; no new warnings can land during Epic 17.
- **Rationale:** Mechanical enforcement prevents silent drift during the 34-story track itself.
- **Owners:** Dev team.
- **References:** SCP §4.1 sub-theme A.

---

## D-05 — Story 15.2 (fuzzy name matching engine) retires

- **Context:** 15.2 scoped as onboarding-only fuzzy matcher. Post-audit: identity resolution is system-wide, not onboarding-only.
- **Decision:** 15.2 retires. PersonIdentityService (17.4) is the system-wide replacement.
- **Rationale:** Avoid duplicate effort; one authoritative identity service.
- **Owners:** Alice (PO) updates backlog.
- **References:** SCP §4.2, §6 Epic 15 reshape.

---

## D-06 — Stories 15.3–15.6 paused and rescoped

- **Context:** E15 core stories depend on identity/lifecycle/truth-state infrastructure that doesn't exist pre-Epic 17.
- **Decision:** 15.3–15.6 move `ready-for-dev` → `backlog` with `blocked-by: epic-17.X` annotations. Net scope shrinks from 5 stories to 4 post-E17 (all smaller).
- **Rationale:** Epic 17 subsumes much of what they required.
- **Owners:** Alice (PO), Bob (SM).
- **References:** SCP §4.2, §6 Epic 15 reshape.

---

## D-07 — Stories 16.1–16.4 paused and rescoped

- **Context:** E16 cross-month diffing engine requires stable person/loan identity which Epic 17 provides.
- **Decision:** 16.1–16.4 move `ready-for-dev` → `backlog`. 16.1 dramatically shrinks (PRP does most of it). Net scope 4 → 3 stories post-E17.
- **Rationale:** Avoid building on unstable foundation; Epic 17 PRP + snapshots + attribution history deliver ~80% of planned diffing work.
- **Owners:** Alice (PO), Bob (SM).
- **References:** SCP §4.2, §6 Epic 16 reshape.

---

## D-08 — Epic 13 (Staff ID Governance) retires entirely

- **Context:** 13.3 staff ID management + 13.4 duplicate detection fully subsumed by Epic 17's Identity layer (persons/aliases + PersonIdentityService + Review Queue).
- **Decision:** Epic 13 retires. Capability moves to Epic 17, same outcome.
- **Rationale:** Duplicate work otherwise.
- **Owners:** John (PM) communicates to stakeholders.
- **References:** SCP §4.2, §6 Epic 13 retirement.

---

## D-09 — Epic 12 reverts to original 3-story scope

- **Context:** Previously proposed to inflate E12 with Path 3 settlement, bank reconciliation, etc. Awwal challenged consolidation.
- **Decision:** E12 stays at original 12.1–12.3 (early-exit computation, commitment, dashboard). All new cross-cutting work moves INTO Epic 17.
- **Rationale:** E12 stays thematic (early exit), Epic 17 holds the architectural track.
- **Owners:** Alice (PO).
- **References:** SCP §6 Epic 12.

---

## D-10 — Three-retro cadence adopted

- **Context:** Debate between 2-retro (Awwal's initial proposal) and 3-retro (PM refinement).
- **Decision:** 3 retros: (1) Foundation post-Epic 17 covers E15 Prep + Multi-UAT + Epic 17; (2) Enhancement Cycle post-E15 core + E16 core; (3) Go-Live Meta at authoritative go-live covers whole project with governance-level framing.
- **Rationale:** Distinct character of each phase warrants distinct retro focus. Avoids blurring.
- **Owners:** Bob (SM) schedules.
- **References:** SCP §7 retrospective cadence.

---

## D-11 — App is source of truth (Team Agreement 22)

- **Context:** Awwal: "the app alone should be our source of truth." Bank statements and MDA reports corroborate; do not override.
- **Decision:** Team Agreement 22 codifies "App is source of truth." Every authoritative figure, every certificate, every refund defensible from the app alone.
- **Rationale:** Ease-of-doing-business positioning requires the app to be primary. Avoids "bank statement required" barrier for legitimate complaints.
- **Owners:** All roles; Dev enforcement via design.
- **References:** SCP §4.3, §7 governance principles.

---

## D-12 — AG sole authority for overdeduction refund approval

- **Context:** Proposed dual-signature above threshold. Awwal: "Let every threshold go through the AG. Don't allow Dept Admin have any input in approval. Let it be a single source of approval."
- **Decision:** AG (or Deputy AG in absence) sole approval authority. No threshold-based dual-signature. Dept Admin has NO input on approval, only confirms payment post-approval.
- **Rationale:** Governance simplicity; prevents dilution of authority. Avoids political exposure of distributed-approval ambiguity.
- **Owners:** AG office.
- **References:** SCP §7 governance, Story 17.26 workflow.

---

## D-13 — No detection threshold for overdeduction

- **Context:** Proposed tolerance threshold for overdeduction. Awwal: "by introducing thresholds we might deny people with genuine complaints."
- **Decision:** Engine detects every ₦1 overpayment. Thresholds apply only at authorisation layer (AG approval can be structured for efficiency), never at detection.
- **Rationale:** Every staff member must have ability to query their profile and see exact deduction history; threshold-filtering defeats this.
- **Owners:** Dev team.
- **References:** SCP §7 "no detection thresholds", Story 17.25.

---

## D-14 — Certificate-with-comment pattern

- **Context:** Overdeduction blocks certificate (prior proposal) vs issues certificate with comment (Awwal's proposal).
- **Decision:** Certificate issues when scheme total is paid. If overdeduction present → certificate includes Scheme Observations section noting pending refund. On refund confirmation → clean certificate (v2) issued, supersedes v1.
- **Rationale:** Don't block staff from receiving their certificate; transparently note the pending state; reissue clean on resolution. Elegant.
- **Owners:** Dev team + UX.
- **References:** Story 17.27, 17.28.

---

## D-15 — Staff self-service profile view → Phase 2

- **Context:** Initial scope included staff-facing self-service query. Awwal deferred to Phase 2 roadmap.
- **Decision:** Phase 1 Loan Detail Page serves AG/Dept Admin/MDA Officer. Staff access comes in Phase 2. Phase 1 staff can raise concerns via Dept Admin/MDA Officer (who operates the page on their behalf).
- **Rationale:** Phase 1 MVP scope control; underlying data + UX layer builds the foundation for Phase 2 addition.
- **Owners:** Alice (PO).
- **References:** SCP §4.1 story 17.7; Story 17.35 (Raise Concern Intake) deferred to Phase 2.

---

## D-16 — `<VarianceBadge>` component — direction-explicit

- **Context:** Current drawer shows ambiguous "Variance ₦617,000." Can't tell which way.
- **Decision:** Every variance rendered with direction: ↓ Outstanding to scheme / ↑ Refund due to staff / ⚠ Pending classification. Amber/grey palette (non-punitive; no red).
- **Rationale:** Cannot adjudicate cases without direction. Same design principle as dual-truth dashboards.
- **Owners:** UX (Sally) + Dev.
- **References:** Story 17.18.

---

## D-17 — Lamidi Morufu as canonical regression fixture for overdeduction

- **Context:** Lamidi case exposed cumulative-overdeduction class of variance: `paid=61, remaining=-1`, total deducted ₦863,741 vs scheme total ₦849,975 = ₦13,766 overpaid.
- **Decision:** Lamidi 36-record dataset becomes canonical regression fixture alongside Alatise 51-record dataset. Both live in `tests/fixtures/identity-continuity/` with Awwal-verified ground truth.
- **Rationale:** Fixture-first for architectural tracks (Team Agreement 18). Real-world ground truth beats synthetic tests.
- **Owners:** Dev + Awwal for ground-truth verification.
- **References:** SCP §2 test fixtures, Story 17.9.

---

## D-18 — `RESOLVED_OUT_OF_SYSTEM` and `OVERPAYMENT_ADJUDICATION` truth-states

- **Context:** Real-world settlements happen outside the digital trail (walk-up at Car Loan Dept). System must accept this without pretending otherwise.
- **Decision:** New truth-state values added to Story 17.14: `RESOLVED_OUT_OF_SYSTEM` (Dept Admin / AG authorised closure without digital evidence), `OVERPAYMENT_ADJUDICATION` (cumulative overpayment pending refund workflow), plus `PENDING_COMPLETION_EVIDENCE`, `CERTIFICATE_WITH_OBSERVATION_NOTE`, `CERTIFICATE_CLEAN`, `APP_BANK_STATEMENT_VARIANCE`.
- **Rationale:** Operational realism; explicit states are auditable and governable.
- **Owners:** Dev team.
- **References:** SCP §4.1 story 17.14.

---

## D-19 — Dept Admin escape hatch for every engine-gate (Team Agreement 21)

- **Context:** Every engine-enforced gate needs human override pathway for operational edge cases.
- **Decision:** Team Agreement 21 — engine proposes, humans dispose. Dept Admin has authority override on every gate with mandatory audit trail. Override rate per MDA is a governance KPI.
- **Rationale:** Avoid rigid automation that blocks legitimate operational needs; preserve audit trail for governance.
- **Owners:** All roles.
- **References:** SCP §4.3 agreement 21, §7 governance.

---

## D-20 — Scheme Secretariat policy clarifications required

- **Context:** Several open policy questions surfaced: concurrent-loan policy, death-in-service handling, currency/rate history, write-off authority, overdeduction refund pathway details.
- **Decision:** Story 17.31 explicitly gates on Scheme Secretariat clarifications. Policy placeholders used until written clarifications incorporated into engine configuration.
- **Rationale:** Governance decisions require scheme authority, not engineering judgment.
- **Owners:** Awwal liaises with Scheme Secretariat.
- **References:** SCP §4.1 story 17.31.

---

## D-21 — BIR as pilot MDA

- **Context:** Need single-MDA pilot for Epic 17 before portfolio expansion. Multiple MDA candidates.
- **Decision:** BIR chosen as pilot MDA (Story 17.34).
- **Rationale:** BIR has the deepest data (most records, longest coverage), cleanest reporting, engaged officers, and already was the UAT proving ground (#42 Alatise, #49 equivalence finding). Lowest risk pilot target.
- **Owners:** Dept Admin + BIR MDA Officer.
- **References:** SCP §4.1 story 17.34, §3 recommended path.

---

## D-22 — 10 memory files persist this session's decisions

- **Context:** "How do I get these decisions back?"
- **Decision:** SCP + Decision Log + sprint-status.yaml + epics.md + 4–5 memory files (project/feedback/domain types) persist across conversations and onboarding.
- **Rationale:** Multi-channel persistence prevents single-point-of-loss.
- **Owners:** Claude auto-memory.
- **References:** Memory directory (`.claude/projects/C--Users-DELL-Desktop-vlprs/memory/`).

---

---

# Amendments Round 2 — same session, 2026-04-15 (afternoon)

Second review pass by an independent Claude session produced 10 tightening points, 4 additions, and one reconsider. Awwal challenged the "bank API" premise separately. Following decisions result from that critique absorbed into the SCP.

## D-23 — Bank reconciliation (17.24) is upload-based, no external API

- **Context:** Original 17.24 spec called for "periodic pull of bank statements" implying API/feed integration. Awwal challenged: "What do we need a Bank API for? Bank reconciliation is just a printout of the Bank Statement."
- **Decision:** 17.24 revised to upload-based. Dept Admin uploads scheme account statement monthly (PDF/CSV); per-case upload for staff dispute evidence. No vendor procurement, no API client. Parser built on 17.2 side-quest utility port.
- **Rationale:** Bank reconciliation in this context is monthly and dispute-driven, not real-time. Upload model is sufficient, zero external-integration risk, no blocking dependency on Deputy AG procurement action.
- **Owners:** Dev team (17.24 implementation).
- **References:** SCP §4.1 story 17.24 (revised), §8 risks (bank-API-procurement row dropped, PDF format variance row added), §9 within-14-days (bank API procurement item removed).

## D-24 — Payroll integration is already done (7.0h + 7.0i); 17.24 is bank-specific

- **Context:** Review raised question whether payroll-system integration belonged in Epic 17 as Phase 2 enhancement.
- **Decision:** Confirmed 7.0h (payroll extract upload + MDA delineation, done) and 7.0i (three-way reconciliation engine: expected/declared/actual, done) already cover payroll. 17.24 is a distinct third layer (bank-level), complementary not duplicative. Epic 17 references existing payroll reconciliation as input to 17.17 dual-truth dashboard.
- **Rationale:** Three reconciliation layers in the system: per-record three-vector (8.0a), aggregate three-way with payroll (7.0h+7.0i), bank-level (17.24 new). Epic 17 adds the third without re-integrating the first two.
- **Owners:** Dev team (integration notes in 17.17 + 17.24).
- **References:** SCP §4.1 reconciliation-layers table; epics.md Epic 17 section.

## D-25 — Lint ratchet (17.0) splits production code from test code

- **Context:** Original 17.0 applied uniformly. Most of the 46 `any` warnings live in test helpers where `any` is often pragmatic (mock types). Uniform blocking creates CI-thrash without meaningful gain.
- **Decision:** Production code ratchet is commit-blocking; test code countdown is non-blocking, tracked as PR comment only.
- **Rationale:** Pressure on prod code; tolerance on test pragmatism; prevents Epic 17 test authors from fighting CI.
- **Owners:** Dev team, CI infrastructure.
- **References:** SCP §4.1 story 17.0.

## D-26 — DRY_RUN infrastructure as new cross-cutting Story 17.0b

- **Context:** Every writing engine component (PRP, fingerprint, backfill, re-attribution, overdeduction detection, certificate issuance) should support a `DRY_RUN=1` mode that produces the same diff report without committing. Saves operational risk at pilot cutover.
- **Decision:** New Story 17.0b — DRY_RUN infrastructure, cross-cutting, inherited by all downstream writing stories. Precedes any writing story kickoff.
- **Rationale:** Pilot risk management. Idempotency property testing (17.16) also benefits.
- **Owners:** Dev team.
- **References:** SCP §4.1 story 17.0b; sprint-status.yaml.

## D-27 — Shadow dashboard pre-pilot as new Story 17.34a

- **Context:** Pilot cutover is when AG first sees new UI. Without a shadow period, integration issues surface during pilot, not before.
- **Decision:** New Story 17.34a — run dual-truth dashboard in production against real data for 14 days before BIR pilot cutover, AG + PO visible only. Daily divergence report vs legacy dashboard.
- **Rationale:** Lowers pilot risk materially; catches integration issues before BIR officer sees anything new.
- **Owners:** Dev team + AG / PO for daily review.
- **References:** SCP §4.1 story 17.34a.

## D-28 — Per-MDA dashboard_mode enum for graceful post-pilot rollout

- **Context:** After BIR pilot succeeds, bringing additional MDAs onto dual-truth dashboards should be per-MDA, not portfolio cutover.
- **Decision:** Story 17.17 extended with `mdas.dashboard_mode ∈ {legacy, dual_truth_shadow, dual_truth_live}`. Dept Admin flip authority per MDA. Aligns with Agreement 20 (pilot before portfolio) at finer grain.
- **Rationale:** Enables graceful migration post-pilot; avoids all-or-nothing cutover risk.
- **Owners:** Dev team (17.17 scope extension).
- **References:** SCP §4.1 story 17.17 (extended).

## D-29 — PRP (17.12) admin CLI for operational override

- **Context:** Original 17.12 triggered only by app events (upload, correction, handshake). Schema migrations, corruption recovery, manual operational intervention have no trigger path.
- **Decision:** Add `pnpm recompute-person <personKey>` and `pnpm recompute-mda <mdaId>` admin CLI with `--dry-run` and `--commit` modes to 17.12 scope.
- **Rationale:** Prevents synthesising fake events as the only way to force recompute. Operationally essential.
- **Owners:** Dev team.
- **References:** SCP §4.1 story 17.12 (extended).

## D-30 — Overdeduction FSM (17.26) gains SLA semantics

- **Context:** Original 6-state FSM had no timeout handling. Cases could stick in PENDING_AG_APPROVAL indefinitely.
- **Decision:** Each state transition has an SLA; expiry generates attention item routed to escalation path (Deputy AG on AG absence; AG on Dept Admin absence). SLA values TBD per 17.31 policy clarifications. Starting values: PENDING_AG_APPROVAL ≤ 14 days, AWAITING_PAYMENT_CONFIRMATION ≤ 30 days, CERTIFICATE_REISSUED ≤ 7 days after confirmation.
- **Rationale:** Prevents governance bottleneck cases from becoming invisible.
- **Owners:** Dev team + Scheme Secretariat (policy).
- **References:** SCP §4.1 story 17.26 (extended).

## D-31 — BIR pilot (17.34) — cycle defined + CRITICAL precisely defined

- **Context:** Original 17.34 described "one reconciliation cycle" without operational definition. "Zero CRITICAL findings" created binary gate with implicit downgrade pressure.
- **Decision:** (a) Reconciliation cycle = one monthly BIR upload → PRP runs → dual-truth dashboard renders → AG reviews → written sign-off OR findings log; time-boxed per 17.31 policy (suggested 21 days). (b) CRITICAL is precisely: (i) app publishes figure AG cannot defend in writing, (ii) break in append-only audit invariant, (iii) overdeduction refund without AG approval. Anything else = HIGH/MEDIUM, doesn't gate.
- **Rationale:** Testable, unambiguous, resistant to pressure to downgrade severity for shipping.
- **Owners:** Dev team + AG for pilot review.
- **References:** SCP §4.1 story 17.34, §7 governance principles (CRITICAL row added), §8 risks.

## D-32 — Agreement 21 reframed as system-health KPI (not discipline KPI)

- **Context:** "Override rate per MDA is a governance KPI" created perverse incentive for Dept Admins to resist overriding even when correct.
- **Decision:** Reframed: "Override rate is a system-health KPI — high override rate signals engine mis-calibration; low override rate signals engine trust."
- **Rationale:** Preserves escape-hatch honesty; shifts metric from discipline to diagnostic.
- **Owners:** All roles; PO communicates reframing.
- **References:** SCP §4.3 agreement 21 (reframed), §7 governance.

## D-33 — Agreement 22 gains AG-authorised out-of-band correction exception

- **Context:** "App is source of truth" as absolute principle collides with legitimate scenarios — court orders, external-audit findings — where correction originates outside the app.
- **Decision:** Appended exception: "Under AG-authorised out-of-band correction, the correction flows through the app via a formal event record with AG authorisation, so the app remains the system of record for what was done and why."
- **Rationale:** Preserves source-of-truth principle while accommodating real-world edge cases. External correction still logged in-app, so auditable and defensible.
- **Owners:** All roles.
- **References:** SCP §4.3 agreement 22 (appended).

## D-34 — Agreements 17 and 18 linked explicitly

- **Context:** Other-agent critique: agreements 17 and 18 perceived as redundant; risk "one will quietly die."
- **Decision:** Explicit linking text — Agreement 18 is the development-time expression of Agreement 17; Agreement 17 is the publication-time expression of Agreement 18. Both stand.
- **Rationale:** Preserves distinct lifecycle moments (dev-time fixture gate vs publication-time audit gate) while clarifying they reinforce rather than duplicate.
- **Owners:** All roles.
- **References:** SCP §4.3 agreements 17, 18 (annotated).

## D-35 — Story 17.1 spike deliverable binds to PO sign-off

- **Context:** Risk that discovery spike produces findings but team moves on without re-sizing affected stories.
- **Decision:** Spike deliverable is `_bmad-output/implementation-artifacts/17.1-spike-output.md`. Alice (PO) signs off as precondition for kickoff of Stories 17.4 / 17.8 / 17.12 / 17.25.
- **Rationale:** Prevents spike-output orphaning. High leverage, low cost.
- **Owners:** Alice (PO).
- **References:** SCP §4.1 story 17.1 (extended), §9 within-14-days item 15.

## D-36 — E14 Public Website reclassified NO IMPACT → EXTEND (minor)

- **Context:** E14 row in §5 said "NO IMPACT" but Story 17.28 extends the public verification page with certificate supersede chain rendering.
- **Decision:** Row updated to EXTEND (minor) with specific note about supersede-chain rendering on verification endpoint + UI.
- **Rationale:** Consistency between §4.1 and §5.
- **Owners:** Dev team (17.28 includes E14 verification page update).
- **References:** SCP §5 E14 row.

## Epic 17 total after amendments

**34 → 36 stories** (17.0b DRY_RUN + 17.34a shadow dashboard added).

---

---

# Amendments Round 3 — same session, 2026-04-15 (evening)

Domain refinement conversation around ADELEKE namesake handling (UAT #30) and CDU autonomous-agency handling (UAT #46). Awwal provided Google-search-suggest analogy for SEARCH operation and signed off fixtures for both cases.

## D-37 — PersonIdentityService splits into SEARCH + MATCH APIs

- **Context:** Awwal's Google-search-suggest analogy — typing "Adeleke O" should return all Adeleke-O-prefix candidates (for human selection) without any implication they are the same person. This is a distinct operation from ingestion-time match resolution.
- **Decision:** Story 17.4 exposes two APIs: `searchPersons(query) → Person[]` (broad, inclusive, for Review Queue UI + Loan Detail Page search); `resolvePerson(record) → {person_key, confidence, action}` (strict, for ingestion decision). Same comparator, different action thresholds.
- **Rationale:** Distinct user tasks (looking up a person vs ingesting a record) warrant distinct APIs. Prevents engineers from blurring SEARCH into MATCH and creating false auto-links.
- **Owners:** Dev team.
- **References:** SCP §4.1 Story 17.4 (revised); `tests/fixtures/identity-continuity/adeleke-namesake/expected.json` test case `search-adeleke-o-prefix`.

## D-38 — Fuzzy-Jaccard comparator with per-token Levenshtein bands

- **Context:** Awwal challenged that `Adeleke Olufemi` vs `Adeleke Oluwafemi` should classify firmly as HIGH or MEDIUM, not as perpetual ambiguity. Original layered comparator (strict Jaccard + per-token Levenshtein + Jaro-Winkler) would have dropped this at the primary gate because strict Jaccard = 0.33.
- **Decision:** Fuzzy Jaccard — tokens considered "same" if their Levenshtein is below threshold (≤2 edits). Now `Adeleke Olufemi` vs `Adeleke Oluwafemi` → fuzzy Jaccard = 1.0, max token Levenshtein = 2 → MEDIUM band (review queue). Firm classification, no limbo.
- **Bands:** Jaccard < 0.5 → NOT_MATCH. Jaccard ≥ 0.5 with max token Levenshtein 0 → HIGH (auto-link). Levenshtein 1 → HIGH_WITH_TYPO_FLAG (auto-link with audit note). Levenshtein 2–4 → MEDIUM (review). Levenshtein ≥ 5 → NOT_MATCH. Namesake frequency guard downgrades HIGH to MEDIUM when normalised name frequency exceeds threshold.
- **Rationale:** Every realistic case lands in exactly one of HIGH / HIGH-TYPO / MEDIUM / NOT_MATCH. Awwal's specific concern resolved.
- **Owners:** Dev team.
- **References:** SCP §4.1 Story 17.4 (revised); ADELEKE fixture.

## D-39 — ADELEKE fixture signed off

- **Context:** Awwal confirmed ground truth during this session.
- **Decision:** Fixture policy captured at `tests/fixtures/identity-continuity/adeleke-namesake/expected.json`. Five test cases covering NOT_MATCH, MEDIUM, HIGH, HIGH_WITH_TYPO_FLAG, and SEARCH operations. Awwal-signed-off 2026-04-15. Records-pending: actual record IDs from UAT-era data populated at Story 17.4 kickoff.
- **Owners:** Dana (QA) captures; Dev team populates records at story kickoff.
- **References:** Fixture file.

## D-40 — CDU is a standalone MDA at identity layer; parent/child is reporting metadata only

- **Context:** Awwal: "CDU is an Autonomous Agency but for ease we should treat it as a standalone MDA since it is Autonomous." Original Story 17.21 had parent-aware identity queries; over-engineered for this scheme's operational model.
- **Decision:** Identity resolution uses `mda_id` directly; CDU has its own `mda_id` distinct from Agriculture. Parent/child relationship (`mdas.reporting_parent_mda`) is metadata consumed only by opt-in reporting rollups, never by identity queries. Side-quest `utils/mda-resolve.ts` logic preserved in production via Story 17.2 port.
- **Rationale:** Operational simplicity. Autonomous agencies operate distinctly; treating them as child-of-parent at the identity layer creates more confusion than it resolves. Reporting rollups are an explicit opt-in use case, not the default.
- **Owners:** Dev team (17.2 port preserves logic; 17.21 adds metadata columns only).
- **References:** SCP §4.1 Story 17.21 (simplified); CDU fixture.

## D-41 — CDU fixture signed off

- **Context:** Awwal confirmed CDU-as-standalone treatment during this session.
- **Decision:** Fixture policy captured at `tests/fixtures/identity-continuity/cdu-agriculture-parent-child/expected.json`. Three rules + three test cases. Awwal-signed-off 2026-04-15. Records-pending: actual record IDs populated at Story 17.21 kickoff.
- **Owners:** Dana (QA) captures; Dev team populates records at story kickoff.
- **References:** Fixture file.

## D-42 — Review Queue UI (17.6) gains search-then-confirm pattern

- **Context:** Elena's concern — if SEARCH and MATCH are different APIs with different thresholds, a manual SEARCH-then-pick could bypass MATCH's safeguards. Needs a safety check.
- **Decision:** When a user picks a candidate from `searchPersons` results for a correction action, the system renders match score + evidence as a confirmation step before committing. Not a hard block — a visible "confirm?" with engine analysis attached. Keeps human judgment primary.
- **Rationale:** Preserves SEARCH's broad usefulness while preventing accidental wrong-person attribution. Small UX, material safety.
- **Owners:** Dev team + UX.
- **References:** SCP §4.1 Story 17.6 (revised).

---

---

# Amendments Round 4 — same session, 2026-04-15 (evening)

Awwal decision to build Epic 17 silently before Deputy AG engagement, enabled by editable-placeholders architectural principle.

## D-43 — Silent build strategy adopted

- **Context:** Awwal: "I have to finish Epic 17 before reaching out." Team read is Interpretation B — build to demonstration-readiness, then engage Deputy AG with a working system.
- **Decision:** Epic 17 Stories 17.0 through 17.33 + 17.34a build in silence on internal authority. Story 17.34 (BIR pilot) becomes the trigger for Deputy AG engagement, not a prerequisite. No external stakeholder engagement until demonstration-ready.
- **Rationale:** Politically stronger to engage with a live system than with a request for permission. Engine correctness provable via committed regression fixtures (Alatise, Lamidi, ADELEKE, CDU signed off; 2-3 more from discovery spike).
- **Owners:** Awwal (external engagement timing), Dev team (build execution).
- **References:** SCP §11 (new).

## D-44 — Team Agreement 23: editable placeholders over external blockers

- **Context:** Awwal: "Anything that may require external input we make it editable via the ui and put reasonable values pending official values or leave blank and editable like the Fund Amount in the AG Dashboard."
- **Decision:** New Team Agreement 23 codifies the pattern. Every externally-dependent value (Scheme policy, bank details, thresholds, SLAs, authority limits) is implemented as an AG-editable configuration with reasonable default placeholder. Follows existing Fund Amount pattern.
- **Rationale:** Unblocks silent build. No story waits for external input. External values arrive through the UI when available.
- **Owners:** All roles; Dev team enforces via implementation pattern.
- **References:** SCP §4.3 Agreement 23, §11 placeholder table.

## D-45 — Story 17.31 re-scoped from prerequisite to UI-for-receiving-values

- **Context:** Original 17.31 blocked stories on Scheme Secretariat policy clarifications. Under silent-build + Agreement 23, this blocker dissolves.
- **Decision:** Story 17.31 transforms from "wait for Secretariat values" to "UI + data model for receiving values when available." Placeholders ship with engine; UI exists for Awwal to populate real values when Scheme Secretariat provides them.
- **Rationale:** Aligns 17.31 with Agreement 23. Removes blocker from all downstream stories.
- **Owners:** Dev team.
- **References:** SCP §11 Story 17.31 re-scope.

## D-46 — Admin Settings screen added to Epic 17 scope

- **Context:** Agreement 23 requires a UI surface where AG/Deputy AG can edit placeholder values.
- **Decision:** New screen, role-gated to AG/Deputy AG only, exposes every editable placeholder value with current/default values + Save action. Changes audit-logged with before/after + actor. Added as extension of Story 17.17 (or split into 17.17b during implementation if cleaner).
- **Rationale:** Single-surface management prevents scattered configuration. Auditable by design.
- **Owners:** Dev team, UX.
- **References:** SCP §11 Admin Settings section.

## D-47 — HTML audit reports produced alongside PDFs

- **Context:** Awwal asked for HTML versions of the Deputy AG reports (for browser print-to-PDF).
- **Decision:** Two HTML files written to `docs/Car_Loan/analysis/reports/`:
  - `alatise-deputy-ag-summary.html` (one-page A4 brief)
  - `alatise-detailed-audit-report.html` (6-page A4 detailed audit)
- Both self-contained, print-optimized with `@page A4` CSS, browser-printable to PDF, observation-style language + non-punitive palette per project standards.
- **Rationale:** Awwal control over final PDF generation (browser print vs @react-pdf renderer). Both formats now available.
- **Owners:** John (PM) generated.
- **References:** SCP §10 Supporting Evidence.

## D-48 — Demonstration-ready as new milestone preceding go-live-ready

- **Context:** Silent build needs a named internal milestone distinct from authoritative go-live.
- **Decision:** Epic 17 reaches **demonstration-ready** when Stories 17.0 through 17.33 + 17.34a are complete (35 of 36 stories). Story 17.34 (BIR pilot) is the only remaining gate to authoritative go-live. Demonstration-ready is the internal signal to begin external engagement.
- **Rationale:** Clear trigger for Deputy AG conversation; clear definition of "Epic 17 complete" in the silent-build phase.
- **Owners:** All roles; trigger recognition by Awwal.
- **References:** SCP §11 go-live readiness definition.

---

---

# Amendments Round 5 — same session, 2026-04-15 (late evening)

Discovery during VLPRS-Upload-Staging run: the BIR CSV (previously flagged as "staff roster, not car loan") is actually a full MDA monthly payroll snapshot with 249 staff × 134 non-zero CAR LOAN deductions × ₦1,672,630 total Feb 2026 recovery. Same class as OYSIPA Apr 2021 xls. This changes Story 17.3 scope and adds Story 17.3b.

## D-49 — MDA Payroll Snapshot as a new evidence layer

- **Context:** BIR CSV contains Staff ID + Full Name + Job Title + Grade + Department + Bank + CAR LOAN deduction amount per staff for Feb 2026. Not just an HR roster; also actual payroll deduction data + rich employment context.
- **Decision:** New Story 17.3b — MDA Payroll Snapshot Ingestion. Separate from the existing AG-level consolidated payroll flow (Stories 7.0h + 7.0i, done). Each MDA can upload its own monthly payroll snapshot; system ingests into three tables simultaneously: `person_aliases` (HR_ROSTER type), `payroll_snapshots`, and enriched person records. Cross-reference with MDA-declared submission emits `PAYROLL_VS_MDA_VARIANCE` observation on divergence.
- **Rationale:** Four distinct reconciliation layers now in the system architecture: per-record three-vector (8.0a, done) + AG-level consolidated payroll three-way (7.0h+7.0i, done) + **per-MDA payroll snapshot (17.3b, NEW)** + bank statement (17.24, new). Each catches a different class of error; together they provide defence in depth.
- **Owners:** Dev team (17.3b implementation). Side-quest staging already routes these files to `VLPRS-Upload-Staging/_PAYROLL-ROSTERS/` for ingest batch.
- **References:** SCP §4.1 Story 17.3b, §4.1 reconciliation-layers table updated, Story 17.14 truth-state extended with five new observation types.

## D-50 — HR_ROSTER alias type takes precedence over OFFICIAL

- **Context:** Prior SCP had four alias types: OFFICIAL, PROVISIONAL, FUZZY_LINKED, HISTORICAL. Payroll-snapshot ingestion needs strongest-confidence anchor.
- **Decision:** Extend `person_aliases.alias_type` with `HR_ROSTER` — highest-confidence. Rationale: loan files submitted by finance/payroll may mis-type; HR roster is the identity register for that MDA's employees (OFFICIAL represents staff_id as declared in a loan file, which is less authoritative than the HR-owned roster).
- **Owners:** Dev team (17.3 schema update).
- **References:** SCP §4.1 Story 17.3 extended.

## D-51 — resolvePerson upgraded to staff_id-first

- **Context:** Current 17.4 design uses fuzzy-Jaccard as primary match. With HR_ROSTER aliases seeded from payroll-snapshot ingestion, exact staff_id match becomes available for many records.
- **Decision:** `PersonIdentityService.resolvePerson(record)` gains a new first step — if incoming record has staff_id matching any HR_ROSTER or OFFICIAL alias for same MDA → HIGH auto-link, no fuzzy name needed. Falls through to fuzzy-Jaccard only when staff_id blank or unmatched. Many current MEDIUM-band review-queue cases become HIGH auto-links.
- **Rationale:** Converts the "no reliable staff_id to anchor on" problem (surfaced by Alatise audit — blank employee_no across all her records) into "strong anchor when HR roster exists for that MDA." Namesake/fuzzy concerns concentrate on MDAs without rosters only.
- **Owners:** Dev team (17.4 update).
- **References:** SCP §4.1 Story 17.4 matching precedence.

## D-52 — `BIR FEB, 2026. FINAL.csv` reclassified; staging script extended

- **Context:** Originally routed to `_NON-CAR-LOAN/` based on WAKEUP.md note. File contents prove otherwise.
- **Decision:** Staging script gains new classification `payroll-roster` + new special folder `_PAYROLL-ROSTERS/`. `PAYROLL_ROSTER_MARKERS` regex list identifies BIR CSV + OYSIPA xls pattern. On next run, both files move from `_NON-CAR-LOAN/` to `_PAYROLL-ROSTERS/` with MDA + period prefix.
- **Rationale:** Correct routing for Story 17.3b ingest when Epic 17 kicks off. These files are the first batch for payroll-snapshot ingestion.
- **Owners:** Staging script (side-quest, uncommitted per convention).
- **References:** `scripts/legacy-report/stage-archive-by-mda.ts` (local, not committed).

## D-53 — "Please upload your payroll snapshot" becomes MDA onboarding ask

- **Context:** BIR volunteered a roster. Other MDAs may not have, simply because they haven't been asked.
- **Decision:** Part of MDA onboarding in Epic 17 — MDA Officer dashboard surfaces a soft "Please provide your HR staff roster and/or monthly payroll snapshot if available" action item. Not a hard gate (Agreement 23 editable-placeholders pattern applies — MDAs without rosters still work via fallback name-matching); strong encouragement.
- **Rationale:** MDAs with payroll snapshots get materially stronger identity matching + an additional evidence layer. Worth asking. Ask is easier to make post-demonstration-ready when VLPRS has a working system to show in exchange.
- **Owners:** UX (dashboard copy) + Dept Admin (outreach workflow).
- **References:** SCP §4.1 Story 17.30 (MDA source data remediation) gains this soft-ask pattern.

---

**End of decision log through Amendment Round 5. Epic 17 at 37 stories.**

---

## Addendum 1 Decisions (2026-04-18 — post-Reconciliation-Inventory v1+v2)

## D-54 — Content-level MDA verification becomes ingest-time hard gate + folder-aware fallback

- **Context:** v1 found 14 silent MDA attribution disagreements (~1,432 corrupted records). v2 surfaced a different silent-bug class: WCOS fuzzy-resolving to BCOS (36 Water Corporation files silently attributed to Broadcasting Corporation) before alias fix shipped.
- **Decision:** Story 17.2 scope amended: (a) content-level MDA verification at ingest as hard gate (first 5 title rows, 3-layer resolver, disagreement → Review Queue); (b) folder-aware 4th resolver layer (when filename+title+column all fail, check parent folder name); (c) emit `RESOLVER_ALIAS_MISSING` observation whenever fuzzy wins over absent-alias (Lev ≤ 2 to wrong MDA, no alias to correct one).
- **Rationale:** Three-gate ingest catches both attribution-disagreement and alias-missing classes. Removes silent-corruption failure mode entirely.
- **Owners:** Dev team (17.2).
- **References:** Addendum 1 §3 17.2; LESSONS_LEARNED items 8, 18.

## D-55 — Five cross-MDA verdicts enumerated + bidirectional signature test

- **Context:** v1 invented `OVERLAPPING_MDA_PRESENCE` mid-build (53 of 358 cases). v2 scale-tested to 558 cases. Original 17.4 binary (transfer/namesake) misses the class entirely.
- **Decision:** Story 17.4 scope amended to enumerate 5 verdicts explicitly (LOAN_CONTINUATION_CONSISTENT / VARIANT / FRESH_PRINCIPAL / OVERLAPPING_MDA_PRESENCE / AMBIGUOUS) + bidirectional A→B, B→A signature test + namesake-frequency calibration starter bound N≥3 from catalog+register union.
- **Owners:** Dev team (17.4).
- **References:** Addendum 1 §3 17.4; LESSONS_LEARNED item 2.

## D-56 — Overlap-MDA workflow distinct from Transfer Handshake

- **Context:** Overlap cases would be mishandled as transfer candidates if routed through 17.5's existing Pending Handshake flow. Overlap means "same person in two MDAs at the same time" — never a transfer.
- **Decision:** Story 17.5 scope amended: OVERLAPPING_MDA_PRESENCE cases route to (1) namesake frequency check, (2) MDA hierarchy check (shared `reporting_parent_mda`), (3) Dept Admin manual disposition.
- **Owners:** Dev team (17.5).
- **References:** Addendum 1 §3 17.5.

## D-57 — Review Queue capacity planning as explicit story + CRITICAL SLA widened 7→14 days

- **Context:** v2 backfill sizing: ~53,518 items (48,518 catalog variances + 5,000 register exceptions). CRITICAL bucket: ~5,550 items. 7-day SLA would require ~793 AG adjudications/day — infeasible.
- **Decision:** NEW Story 17.6a. Queue partitioning by 9 verdict classes + SLA matrix (CRITICAL 14d widened from 7d, HIGH 14d, MEDIUM 30d) + staffing model + escalation paths + per-MDA throughput KPI.
- **Owners:** Bob (SM) + Dept Admin.
- **References:** Addendum 1 §3 17.6a; LESSONS_LEARNED item 7.

## D-58 — Scheme config tolerance externalization

- **Context:** v1 engine hard-coded 8 tolerance values as constants. Scheme policy clarifications (17.31) will legitimately change these; code-change-plus-redeploy per shift is unacceptable friction.
- **Decision:** Story 17.8 scope amended: externalize 8 tolerance keys to `scheme_config` table. Engine reads via config at boot.
- **Owners:** Dev team (17.8) + Winston (architecture).
- **References:** Addendum 1 §3 17.8.

## D-59 — Three new variance classes + BALANCE_DECREASE severity demoted

- **Context:** v1 found 2,112 BALANCE_INCREASE instances + 717 MISSING_PRINCIPAL instances. v2 LESSONS_LEARNED §12 showed BALANCE_DECREASE_BEYOND_MONTHLY signal-to-noise is low (Path 3 settlement dominates, not fraud).
- **Decision:** Story 17.9 adds BALANCE_INCREASE (MEDIUM default, HIGH if delta > ₦50K), BALANCE_DECREASE_BEYOND_MONTHLY (**MEDIUM** — demoted from HIGH), MISSING_PRINCIPAL (MEDIUM).
- **Owners:** Dev team (17.9).
- **References:** Addendum 1 §3 17.9; LESSONS_LEARNED item 12.

## D-60 — Most Likely Explanation broadened to 14 narrative patterns

- **Context:** Original 17.10 scope was tenure-mis-recording only. Dept Admin + AG workflow benefits from explicit narratives across all CRITICAL + HIGH classes including register-driven classes.
- **Decision:** Story 17.10 covers 14 narratives spanning TENURE, CUMULATIVE_OVERDEDUCTION, ARITHMETIC_IMPOSSIBILITY, BALANCE_INCREASE, BALANCE_DECREASE_BEYOND_MONTHLY, OVERLAPPING_MDA_PRESENCE, MDA_ATTRIBUTION_DISAGREEMENT, RESOLVER_ALIAS_MISSING, APPROVED_BUT_NO_RECORD (3 sub-class narratives), RECORD_WITHOUT_APPROVAL, RETIRED_BUT_STILL_DEDUCTED, DECEASED_BUT_STILL_DEDUCTED.
- **Owners:** Dev team (17.10) + UX (copy review).
- **References:** Addendum 1 §3 17.10.

## D-61 — Explicit PRP DRY_RUN mode + cross-reference with 17.0b

- **Context:** Policy tuning + pre-commit preview + Scheme Secretariat policy-impact preview all require explicit dry-run.
- **Decision:** Story 17.12 gains explicit `DRY_RUN=true` mode. Architect to reconcile with 17.0b (engine-wide DRY_RUN infrastructure) at implementation — if 17.0b covers, 17.12 conforms to that contract.
- **Owners:** Dev team (17.12) + Winston (architecture).
- **References:** Addendum 1 §3 17.12.

## D-62 — 17.17 absorbs 17.19/17.20/17.21 UI surface + 6-tile Scheme Participation block

- **Context:** 17.19 (pre-ingest preview), 17.20 (re-attribution UX), 17.21 UI (MDA parent/child surface) all extend the same dashboard data model. v2 added a 2-register-dimension Venn worth 6 tiles.
- **Decision:** RETIRE 17.19, 17.20, 17.21. Story 17.17 absorbs as panels. Add 6-tile Scheme Participation block (catalog-participation / register-approved / overlap-confirmed / catalog-only / register-only-with-subclass-colour / post-event-active) + ₦-weighted severity + `<RegisterExceptionPanel>` with sub-class colour.
- **Note:** 17.21 data-model portion (`mdas.is_autonomous` + `mdas.reporting_parent_mda`) was already landed in Round 3 and remains shipped. This retirement covers the UI surface only.
- **Owners:** Dev team (17.17) + Sally (UX) + Winston (architecture).
- **References:** Addendum 1 §3 17.17.

## D-63 — Retroactive backfill carries catalog + script + register hashes

- **Context:** External auditor (17.32) must independently verify any system figure by rerunning against same inputs. Opacity = unverifiable.
- **Decision:** Story 17.33 amended: every output row (`loan_attribution_history`, `audit_log`, dashboard snapshots) carries catalog SHA-256, script SHA-256, and all register SHA-256s. Reruns diff-able by hash.
- **Owners:** Dev team (17.33) + Winston (architecture).
- **References:** Addendum 1 §3 17.33.

## D-64 — Quarterly Reconciliation Inventory regeneration as governance heartbeat

- **Context:** v1 → v2 delta (40,062 → 48,518 variances; 1,700 new register exceptions surfaced) demonstrates the improvement-tracking artefact value.
- **Decision:** NEW Story 17.33a. Scheduled cron (quarterly) regenerates full inventory. Diff-to-previous published to AG as scheme health heartbeat. Per-MDA CRITICAL trend. Versioned output with engine SHA-256. On-demand ad-hoc regeneration allowed with AG approval.
- **Owners:** Dev team (17.33a).
- **References:** Addendum 1 §3 17.33a.

## D-65 — Scheme Beneficiary Register ingest as new evidence layer (NEW story 17.3c)

- **Context:** v2 Stage 2 ingested 2,502 approved beneficiaries across COLLATION 2024 + 2025 + INTERVENTION 2024. Pass 0.5a cross-check produced 1,700 APPROVED_BUT_NO_RECORD + 3,290 RECORD_WITHOUT_APPROVAL observations. No Epic 17 story currently covers beneficiary-register evidence.
- **Decision:** NEW Story 17.3c. `scheme_beneficiary_register` table + upload-based ingest with SHA-256 provenance + Pass 0.5a cross-check emitting two new variance classes.
- **Owners:** Dev team (17.3c) + Winston (schema).
- **References:** Addendum 1 §3 17.3c; LESSONS_LEARNED item 13.

## D-66 — Employment Event Register ingest (NEW story 17.3d)

- **Context:** v2 Stage 2 ingested 202 events (188 retired + 14 deceased). Pass 0.5b surfaces RETIRED_BUT_STILL_DEDUCTED (10 cases — adjudicable today) + DECEASED_BUT_STILL_DEDUCTED (0 cases — positive governance signal).
- **Decision:** NEW Story 17.3d. `employment_event_register` table + Pass 0.5b cross-check. Zero-DECEASED count explicitly captured as governance reassurance signal in the Deputy AG brief.
- **Owners:** Dev team (17.3d).
- **References:** Addendum 1 §3 17.3d; LESSONS_LEARNED items 15, 16.

## D-67 — APPROVED_BUT_NO_RECORD sub-class tiering (NEW story 17.3e)

- **Context:** v2 surfaced 1,700 APPROVED_BUT_NO_RECORD. Sub-classification shows: 17.4% FUZZY_MATCH_WITHIN_MDA (PIS auto-merge target), 0% NAMESAKE_CROSS_MDA, **66.6% MDA_COVERAGE_GAP (MDA compliance flag — not beneficiary issue)**, 0% POSSIBLE_AWAITING_DISBURSEMENT, **15.9% NO_TRACE (true AG red flag)**. Flat 1,700 count misrepresents governance concern as 6.3× the real red flag count.
- **Decision:** NEW Story 17.3e. Sub-classifier runs post-17.3c. Drives Review Queue partitioning, SLA (NO_TRACE = CRITICAL AG 14d; MDA_COVERAGE_GAP = MEDIUM MDA Officer 30d; FUZZY_MATCH_WITHIN_MDA = PIS auto-handle), and dashboard sub-class colour. Required — flat count is governance risk.
- **Rationale:** Sub-classification protects political framing + accurate MDA relationships + accurate AG escalation priority.
- **Owners:** Dev team (17.3e) + Sally (UX — dashboard sub-class colour).
- **References:** Addendum 1 §3 17.3e; LESSONS_LEARNED item 14; `register-exceptions-approved-no-record-subclasses.md`.

## D-68 — Deputy AG briefing update (pre-Epic-17 package expansion)

- **Context:** Existing Deputy AG package (Alatishe detailed audit + one-pager) was v1-sized. v2 surfaces two new adjudication-ready case sets independent of Epic 17 shipping.
- **Decision:** Addendum 1 §4.1 — append to Deputy AG package: (a) 10 RETIRED_BUT_STILL_DEDUCTED cases, (b) 271 NO_TRACE APPROVED_BUT_NO_RECORD cases (post-sub-classification), (c) explicit 0 DECEASED_BUT_STILL_DEDUCTED as positive governance signal.
- **Owners:** Awwal (assembly) + Dev team (PDF generator extension in Task 12).
- **References:** Addendum 1 §4.1; LESSONS_LEARNED item 15.

---

**End of decision log through Addendum 1 (2026-04-18). Epic 17 now at 39 stories.** All decisions persisted in SCP + Addendum 1 + sprint-status.yaml + epics.md + memory files + Inventory v1/v2 folders.
