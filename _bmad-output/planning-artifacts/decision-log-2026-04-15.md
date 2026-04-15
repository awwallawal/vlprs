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

## Outstanding for next sessions

- Deputy AG briefing (Awwal)
- Scheme Secretariat policy clarifications (Awwal)
- PRD / Architecture / UX spec updates (John / Winston / Sally)
- Story 17.0 lint ratchet kickoff (Dev)
- Story 17.1 discovery spike kickoff (Dev)
- Retro 1 scheduling (Bob, post-Epic 17 K-gate)

---

**End of decision log.**
