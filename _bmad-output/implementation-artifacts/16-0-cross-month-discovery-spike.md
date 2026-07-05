# Story 16.0: Cross-Month Discovery Spike & Story Breakdown

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **Product Owner**,
I want a structured discovery analysis of the cross-month data integrity domain — walking through the codebase, validating anomaly types against real UAT evidence, designing the schema, and producing fully specified implementation stories,
so that Epic 16 is grounded in verified technical reality and the AG's governance needs, not assumptions.

**Origin:** Epic 16 added per PM triage of 8.0b UAT escalation #4 (2026-04-01). Awwal: "If we get data for September 2024, we should be able to make comparison about the data and point out inconsistencies across months."

**Context:** A preliminary analysis was completed during epic activation (2026-04-02). Draft story files exist for 16.1–16.4. This story validates, refines, and formalizes those drafts through the standard pipeline. The PO walkthrough replaces the AG walkthrough since the AG is not available for a direct session.

## Acceptance Criteria

### AC1: Anomaly Taxonomy Validated Against UAT Evidence

**Given** the 5 preliminary finding types (disappearing_beneficiary, reappearing_beneficiary, deduction_change, phantom_completion, new_midstream_appearance),
**When** each type is walked through against real UAT evidence (Alatishe case, Moshood pattern, BIR file uploads),
**Then** each type is confirmed as valid, refined, or rejected. Any additional patterns discovered from the real data are documented. Final taxonomy is recorded with detection logic, severity rules, and auto-explanation sources.

### AC2: Codebase Reuse Surface Verified

**Given** the 6 preliminary reuse targets (comparisonEngine, reconciliationEngine, attentionItemService, observationEngine, submission_rows indexes, employment_events),
**When** each component is read and its current implementation is verified,
**Then** the reuse plan is confirmed with exact file paths, line numbers, function signatures, and specific integration points. Any reuse assumptions that don't hold are corrected.

### AC3: Schema Design Finalized

**Given** the preliminary `cross_month_findings` table design,
**When** the schema is validated against the anomaly taxonomy, the existing data model, and the resolution workflow requirements,
**Then** the final schema is documented with: table definition, enum values, indexes, FK relationships, additional columns on `mda_submissions`, and migration strategy (migration number, Drizzle approach).

### AC4: Trigger Pattern Confirmed

**Given** the preliminary fire-and-forget hook after comparison engine in `processSubmissionRows()`,
**When** the submission confirmation flow is traced end-to-end,
**Then** the exact hook point is confirmed, edge cases are documented (historical uploads, payroll uploads, reprocessing), and the non-blocking pattern is validated.

### AC5: Story Breakdown Produced with BDD Acceptance Criteria

**Given** the validated taxonomy, schema, reuse plan, and trigger pattern,
**When** the implementation is decomposed into stories,
**Then** 3–5 implementation stories are produced, each with: user story statement, BDD acceptance criteria, task breakdown (≤15 tasks each), dev notes with architecture patterns and references. Stories are sequenced with dependencies documented.

### AC6: Draft Stories Validated and Refined

**Given** the existing draft story files (16-1 through 16-4),
**When** each draft is reviewed against the validated discovery findings,
**Then** each story is either confirmed as-is, refined with corrections, or restructured. Any gaps, missing ACs, or incorrect assumptions are fixed. Final stories are saved as ready-for-dev.

### AC7: Non-Punitive Vocabulary Audit

**Given** all story files, AC text, finding type labels, and UI copy,
**When** reviewed against the non-punitive vocabulary standard (`vocabulary.ts`),
**Then** all language uses approved terms: "Variance observed" not "Inconsistency detected", "Review suggested" not "Error found", "Changes observed" not "Data drift". Any violations are corrected.

### AC8: PO Sign-Off on Governance Model

**Given** the complete discovery output (taxonomy, schema, stories, vocabulary),
**When** the PO reviews the progressive disclosure model (portfolio → MDA → staff → finding detail),
**Then** the PO confirms the model matches how the AG would use the system. Any adjustments to the drill-down hierarchy, severity thresholds, or metric definitions are incorporated.

## Tasks / Subtasks

- [ ] **Task 1 — Load Preliminary Analysis** (AC: all)
  - [ ] 1.1 Read existing draft story files: `16-1-cross-month-diffing-engine.md`, `16-2-anomaly-resolution-event-context.md`, `16-3-cross-month-dashboard-drilldown.md`, `16-4-portfolio-stability-metrics.md`
  - [ ] 1.2 Read Epic 16 section in `epics.md` for the preliminary taxonomy, schema, and reuse plan
  - [ ] 1.3 Summarize what the preliminary analysis concluded and what needs validation

- [ ] **Task 2 — Validate Anomaly Taxonomy** (AC: 1)
  - [ ] 2.1 Walk through each finding type against the Alatishe UAT case (8.0b escalation #2): staff with wrong installments outstanding → what would cross-month diff show?
  - [ ] 2.2 Walk through the Moshood pattern (8.0b escalation #4): staff disappears with remaining balance → confirm phantom_completion detection logic
  - [ ] 2.3 Consider edge cases: what about staff who legitimately complete their loan? How do we distinguish completion from phantom disappearance?
  - [ ] 2.4 Consider: are there anomaly types we're missing? (e.g., duplicate staffId across MDAs, same staff with different amounts in same month from different upload sources)
  - [ ] 2.5 Validate severity thresholds with PO: is ₦500/₦5,000 the right boundary for deduction changes? Does severity mapping match AG's attention priority?
  - [ ] 2.6 Document final taxonomy with PO-validated detection logic and severity rules

- [ ] **Task 3 — Verify Codebase Reuse Surface** (AC: 2)
  - [ ] 3.1 Read `comparisonEngine.ts` — confirm variance threshold pattern, Decimal.js usage, categorisation function signatures
  - [ ] 3.2 Read `reconciliationEngine.ts` — confirm event matching pattern, date tolerance approach
  - [ ] 3.3 Read `attentionItemService.ts` — confirm `buildPerMdaItems()` helper, detector registration in `Promise.all()`, `AttentionItem` interface
  - [ ] 3.4 Read `observationEngine.ts` — confirm idempotent generation pattern (delete + recreate)
  - [ ] 3.5 Verify `submission_rows` indexes: confirm `(staff_id, month)` composite exists and is sufficient
  - [ ] 3.6 Read `employment_events` schema — confirm event types available for auto-linking
  - [ ] 3.7 Trace `processSubmissionRows()` end-to-end — confirm hook point after comparison engine
  - [ ] 3.8 Document confirmed reuse plan with exact file paths, line numbers, integration points

- [ ] **Task 4 — Finalize Schema Design** (AC: 3)
  - [ ] 4.1 Review preliminary `cross_month_findings` table against validated taxonomy — are all columns needed? Any missing?
  - [ ] 4.2 Validate enum values against final taxonomy
  - [ ] 4.3 Confirm index strategy for query patterns (findings by submission, by MDA, by staff, by type+status)
  - [ ] 4.4 Confirm `mda_submissions` summary columns (`cross_month_findings_count`, `cross_month_findings_summary`) are the right approach for O(1) access
  - [ ] 4.5 Document final schema with migration strategy

- [ ] **Task 5 — Confirm Trigger Pattern** (AC: 4)
  - [ ] 5.1 Trace submission confirmation for CSV uploads — confirm hook point
  - [ ] 5.2 Trace submission confirmation for manual entry — confirm same hook point
  - [ ] 5.3 Confirm historical uploads (`source: 'historical'`) are skipped
  - [ ] 5.4 Confirm payroll uploads (`source: 'payroll'`) behaviour — should cross-month diff run?
  - [ ] 5.5 Document edge cases: reprocessing, superseded submissions, concurrent uploads

- [ ] **Task 6 — Validate and Refine Draft Stories** (AC: 5,6)
  - [ ] 6.1 Review 16.1 draft: confirm ACs match validated taxonomy, tasks match confirmed reuse plan, dev notes reference correct file paths
  - [ ] 6.2 Review 16.2 draft: confirm resolution workflow matches PO expectations, auto-resolution hook point is correct
  - [ ] 6.3 Review 16.3 draft: confirm attention item detector pattern matches current `attentionItemService.ts`, progressive disclosure model matches AG usage
  - [ ] 6.4 Review 16.4 draft: confirm stability metric formulas are correct, report integration points exist
  - [ ] 6.5 Verify 8.0d (Multi-Sheet Period Handling) is complete or scheduled before 16.1 — this is a hard prerequisite per Epic 16 spec
  - [ ] 6.6 Fix any gaps, incorrect assumptions, or missing ACs in each draft
  - [ ] 6.7 Save refined stories as ready-for-dev (update sprint-status.yaml)

- [ ] **Task 7 — Non-Punitive Vocabulary Audit** (AC: 7)
  - [ ] 7.0 **Scope note:** This discovery story (16.0) uses analytical terms like "anomaly taxonomy" internally — that is acceptable for non-user-facing documents. The audit targets user-facing language in stories 16.1–16.4 (UI copy, badge text, tab labels, finding descriptions).
  - [ ] 7.1 Audit all story files for vocabulary compliance
  - [ ] 7.2 Audit finding type labels, severity labels, status labels
  - [ ] 7.3 Audit planned UI copy (tab headings, button labels, badge text)
  - [ ] 7.4 Fix any violations

- [ ] **Task 8 — PO Walkthrough & Sign-Off** (AC: 8)
  - [ ] 8.1 Present the progressive disclosure model: portfolio → MDA → staff → finding detail. **Reference:** 16.3 AC6 (drill-down routing) and 16.4 AC1–AC3 (metrics hierarchy) already encode this model — verify alignment.
  - [ ] 8.2 Walk through a concrete scenario: "Education MDA submits October data — 3 staff disappeared, 2 deductions changed, 1 new appearance. What does the AG see?"
  - [ ] 8.3 Validate metric definitions: churn rate, deduction stability, submission consistency — do these match what the AG cares about? **Reference:** 16.4 Dev Notes contain exact formulas — verify with PO.
  - [ ] 8.4 Confirm severity thresholds match AG's attention priority. **Reference:** 16.1 AC4 (deduction thresholds) and 16.3 AC8 (vocabulary) already define these — verify no conflicts.
  - [ ] 8.5 Confirm vocabulary compliance across drafts — 16.1–16.4 already contain vocabulary sections; verify they are consistent with each other and `vocabulary.ts`.
  - [ ] 8.6 Record any PO-requested adjustments and apply them to stories

- [ ] **Task 9 — Update Artifacts** (AC: all)
  - [ ] 9.1 Update `epics.md` Epic 16 section with any refinements from validation
  - [ ] 9.2 Update sprint-status.yaml: 16.1–16.4 → ready-for-dev (after validation passes)
  - [ ] 9.3 Ensure all story files have consistent references and cross-links

## Dev Notes

### Sprint Placement

- **16.0 (this story):** Sprint 11, parallel with E8 + E15
- **16.1–16.4:** Sprint 12, parallel with Epic 12 (Early Exit Processing)

### Story Dependency Chain

```
16.0 (Discovery — done)
  ↓
16.1 (Diffing Engine) ← hard prerequisite: 8.0d (Period Handling) must be complete
  ↓
16.2 (Resolution)     ← depends on 16.1
  ↓
16.3 (Dashboard)      ← depends on 16.1; can run parallel with 16.4
16.4 (Metrics)        ← depends on 16.1; can run parallel with 16.3
```

### This Is an Analytical Story, Not a Code Story

Story 16.0 produces **documents**, not code. The "implementation" is:
1. Reading and verifying codebase assumptions
2. Validating design decisions with the PO
3. Refining draft story files
4. Updating planning artifacts

The dev agent should treat this as a structured analysis session, not a coding task.

### Preliminary Analysis Exists — Validate, Don't Recreate

Draft story files already exist at:
- `_bmad-output/implementation-artifacts/16-1-cross-month-diffing-engine.md`
- `_bmad-output/implementation-artifacts/16-2-anomaly-resolution-event-context.md`
- `_bmad-output/implementation-artifacts/16-3-cross-month-dashboard-drilldown.md`
- `_bmad-output/implementation-artifacts/16-4-portfolio-stability-metrics.md`

The preliminary analysis in `epics.md` Epic 16 section contains the taxonomy, schema, and reuse plan.

**Do not start from scratch.** Read the existing analysis, verify each claim against the codebase, walk through with the PO, and refine.

### Key Verification Questions

1. **Is the `(staff_id, month)` composite index on `submission_rows` actually sufficient for cross-month queries, or do we need an additional index?**
2. **Does the comparison engine's fire-and-forget pattern (try/catch outside transaction) actually work cleanly, or are there edge cases?**
3. **Does payroll source (`source: 'payroll'` from Story 7.0h) go through `processSubmissionRows()`? Should cross-month diff run on payroll uploads?**
4. **Are there MDA submissions with status other than 'confirmed' that could affect the "find previous confirmed submission" query?**
5. **What happens when an MDA has multiple uploads for the same month (e.g., correction uploads)? Which one is the "current" for diffing?**

### PO Walkthrough Scenario

Walk the PO through this concrete example:

> Education MDA submits October 2024 data (100 staff). The system compares against September 2024 data (98 staff).
>
> Findings:
> - 5 staff in September absent in October: 3 have RETIREMENT events (auto-explained, Medium), 2 have no events (High — review suggested)
> - 7 staff in October not in September: 5 are genuinely new (Medium), 2 were in August but not September (reappearing, Medium)
> - 3 deduction amounts changed: 1 by ₦200 (Low), 1 by ₦2,000 (Medium), 1 by ₦8,000 (High)
> - 1 phantom completion: staff absent, loan balance ₦180,000 remaining (High)
>
> AG sees on dashboard: "Education: 4 findings needing review" (the 2 unexplained disappearances + 1 high deduction change + 1 phantom completion)

### Project Structure Notes

No code changes — this story produces validated documents (refined story files, updated epics, updated sprint-status). All outputs land in `_bmad-output/`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 16] — Preliminary taxonomy, schema, reuse plan
- [Source: apps/server/src/services/submissionService.ts:480-487] — Comparison engine fire-and-forget hook point
- [Source: apps/server/src/services/comparisonEngine.ts] — Variance thresholds
- [Source: apps/server/src/services/reconciliationEngine.ts] — Event matching pattern
- [Source: apps/server/src/services/attentionItemService.ts:21-34] — Detector orchestrator (`Promise.all()` registration)
- [Source: apps/server/src/db/schema.ts:648-670] — submission_rows table + indexes
- [Source: apps/server/src/db/schema.ts:688-712] — employment_events table
- [Source: Story 8.0b UAT escalations] — Alatishe case, Moshood pattern
- [Source: packages/shared/src/constants/vocabulary.ts] — Non-punitive vocabulary standard

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
