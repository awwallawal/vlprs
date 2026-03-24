# Story 7.2a: Metric Help System & Contextual Guidance

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **MDA Officer, Dept Admin, or Super Admin**,
I want every non-obvious number on the dashboard and detail screens to have an accessible explanation of what it measures, what data feeds it, and what action I should consider,
So that I can interpret figures confidently without guessing or needing external training.

## Acceptance Criteria

### AC 1: Shared Metric Glossary

**Given** the shared package (`packages/shared`)
**When** a developer adds a new observation type, attention item type, or dashboard metric
**Then** TypeScript compilation fails unless they also add a corresponding glossary entry
**And** the glossary is structured as exhaustive `Record<UnionType, MetricDefinition>` sections for type-safe enforcement

### AC 2: Contextual Help Component

**Given** any screen displaying a non-obvious metric (see Metric Audit below)
**When** the user sees a number whose meaning isn't self-evident from its label alone
**Then** a small info icon appears beside the label
**And** hovering/clicking the icon shows a popover with: description, data source, and (optional) guidance
**And** the popover is dismissible and does not block interaction

### AC 3: Dynamic Completeness Notes (Observations)

**Given** any observation (all 11 types)
**When** the observation is created by the backend
**Then** the `context.completenessNote` field contains a human-readable sentence describing which data sources were consulted
**And** this note is displayed below the data completeness progress bar in `ObservationCard`

### AC 4: Compile-Time Enforcement

**Given** a developer adds a new value to `ObservationType`, `AttentionItemType`, or the drill-down metric enum
**When** they run `pnpm typecheck`
**Then** the build fails with a clear error pointing to the glossary section missing the new key
**And** no workaround exists short of adding the glossary entry

### AC 5: Test-Time Enforcement

**Given** the enforcement test suite
**When** `pnpm test` runs
**Then** tests verify: (a) every enum value has a glossary entry, (b) no orphaned glossary entries exist, (c) every observation creation path provides a non-empty `completenessNote`
**And** adding a new type without a glossary entry causes a test failure with a descriptive message

### AC 6: Review-Time Enforcement

**Given** the BMAD code review workflow
**When** a story adds user-facing metrics
**Then** the code review checklist includes a blocking item: "If story adds user-facing metrics → glossary entry + `<MetricHelp>` required"
**And** `project-context.md` includes guidance for dev agents

## Dependencies

- **Depends on:** Story 7.2 (done) — `inactive_loan` observation type and `dataCompleteness` pattern established
- **Feeds into:** Story 7.3 (Record Annotations) — new UI elements will use `<MetricHelp>` from day one
- **Feeds into:** Epic 6 (Reports) — report screens will use `<MetricHelp>` for all computed figures
- **Sequence:** 7.0a → ... → 7.2 → **7.2a** → 7.3

## Tasks / Subtasks

- [x] Task 1: Shared Metric Glossary (AC: 1, 4)
  - [x] 1.1 Create `packages/shared/src/constants/metricGlossary.ts`
  - [x] 1.2 Define `MetricDefinition` interface: `{ label, description, derivedFrom, guidance? }`
  - [x] 1.3 Create glossary sections. **Three sections are exhaustive-typed** via `Record<UnionType, MetricDefinition>` — TypeScript enforces completeness (AC 4). **Five sections are plain objects** (`Record<string, MetricDefinition>`) — no enum backing exists, enforced only at review time (AC 6):
    - **Exhaustive-typed (compile-time enforced):**
      - `OBSERVATION_HELP: Record<ObservationType, MetricDefinition>` (11 types)
      - `ATTENTION_HELP: Record<AttentionItemType, MetricDefinition>` (12 types)
      - `DASHBOARD_HELP: Record<DrillDownMetric, MetricDefinition>` (10 metrics — activeLoans, totalExposure, fundAvailable, monthlyRecovery, loansInWindow, outstandingReceivables, collectionPotential, atRisk, completionRate, completionRateLifetime)
    - **Plain objects (review-time enforced — no backing union type exists):**
      - `EXCEPTION_HELP` for priority and category concepts
      - `RECONCILIATION_HELP` for match rate, variance, days difference
      - `MIGRATION_HELP` for coverage, stages, record quality bands
      - `LOAN_HELP` for outstanding balance, grade tier
      - `SYSTEM_HEALTH_HELP` for health metric interpretation
  - [x] 1.4 Export all sections + a unified `METRIC_GLOSSARY` lookup for the frontend component
  - [x] 1.5 Add exports to `packages/shared/src/index.ts`

- [x] Task 2: `completenessNote` on ObservationContext (AC: 3)
  - [x] 2.1 Add `completenessNote: string` (required, not optional) to `ObservationContext` in `packages/shared/src/types/observation.ts`
  - [x] 2.2 Update `observationEngine.ts` — add `completenessNote` to all detector functions (rate_variance, stalled_balance, negative_balance, multi_mda, no_approval_match, consecutive_loan, period_overlap, grade_tier_mismatch). Each note describes the specific data sources consulted for that detection run
  - [x] 2.3 Update `inactiveLoanDetector.ts` — add `completenessNote` based on submission data availability
  - [x] 2.4 Update `exceptionService.ts` — `completenessNote: 'Manually flagged — no automated analysis performed'` for manual exceptions
  - [x] 2.5 Update `threeWayReconciliationService.ts` — `completenessNote` describing payroll + submission + ledger sources
  - [x] 2.6 Update `deduplicationService.ts` — `completenessNote` describing cross-MDA comparison sources
  - [x] 2.7 Sync `observationQuerySchema` in `packages/shared/src/validators/observationSchemas.ts` — the `type` filter enum only lists 6 of 11 observation types (missing: `period_overlap`, `grade_tier_mismatch`, `three_way_variance`, `manual_exception`, `inactive_loan`). Add the 5 missing values so users can filter by all types
  - [x] 2.8 Fix all existing tests that create `ObservationContext` objects to include `completenessNote`

- [x] Task 3: Frontend `<MetricHelp>` Component (AC: 2)
  - [x] 3.1 Create `apps/client/src/components/shared/MetricHelp.tsx`
  - [x] 3.2 Implement as a Tooltip/Popover with info icon (`lucide-react` `Info` or `HelpCircle`)
  - [x] 3.3 Accept `metric` prop (typed key from glossary) OR inline `definition: MetricDefinition` prop for one-off cases
  - [x] 3.4 Render: description, "Based on: {derivedFrom}", optional guidance line
  - [x] 3.5 Style: `text-text-muted`, small icon (h-3.5 w-3.5), non-intrusive, accessible (keyboard focusable, aria-label)
  - [x] 3.6 Write component tests (renders tooltip content, handles missing key gracefully)

- [x] Task 4: Wire MetricHelp into Dashboard & Portfolio (AC: 2)
  - [x] 4.1 `DashboardPage.tsx` — hero metrics: Total Exposure, Fund Available, Collection Potential, At-Risk Amount, Completion Rate (60m), Completion Rate (All-Time)
  - [x] 4.2 `HeroMetricCard.tsx` — optional `helpKey` prop passed through from parent
  - [x] 4.3 `AttentionItemCard.tsx` — each attention item type gets tooltip from `ATTENTION_HELP`
  - [x] 4.4 `ComplianceProgressHeader.tsx` — "X of Y MDAs submitted" + deadline countdown
  - [x] 4.5 Three-way reconciliation summary on dashboard — match rate, variance count

- [x] Task 5: Wire MetricHelp into Observation & Exception Screens (AC: 2, 3)
  - [x] 5.1 `ObservationCard.tsx` — "Data completeness" label gets `<MetricHelp metric="observation.dataCompleteness" />`, display `completenessNote` below progress bar
  - [x] 5.2 `ObservationsList.tsx` — type breakdown badges: tooltip on each type badge from `OBSERVATION_HELP`
  - [x] 5.3 `ExceptionsPage.tsx` — priority count badges (High/Medium/Low) get tooltip explaining expected response cadence

- [x] Task 6: Wire MetricHelp into Remaining Screens (AC: 2)
  - [x] 6.1 `LoanDetailPage.tsx` — Outstanding Balance, Grade Level Tier
  - [x] 6.2 `MigrationPage.tsx` — coverage percentages, stage progress ("Stage N of 6"), record quality bands
  - [x] 6.3 `MigrationCoverageTracker.tsx` — coverage cell meanings
  - [x] 6.4 `ThreeWayReconciliationPage.tsx` — match rate, full variance count, reconciliation health
  - [x] 6.5 `MetricDrillDownPage.tsx` — variance percentage, health band
  - [x] 6.6 `SystemHealthPage.tsx` — general health metric interpretation tooltip
  - [x] 6.7 `ComparisonSummary.tsx` — aligned records, minor variances
  - [x] 6.8 `ReconciliationSummary.tsx` — days difference ("Xd")

- [x] Task 7: Enforcement Tests (AC: 5)
  - [x] 7.1 Create `packages/shared/src/constants/metricGlossary.test.ts`
  - [x] 7.2 Test: every `ObservationType` value has a key in `OBSERVATION_HELP` (and vice versa — no orphans)
  - [x] 7.3 Test: every `AttentionItemType` value has a key in `ATTENTION_HELP` (and vice versa)
  - [x] 7.4 Test: every drill-down metric has a key in `DASHBOARD_HELP` (and vice versa)
  - [x] 7.5 Test: no `MetricDefinition` has empty `description` or `derivedFrom`

- [x] Task 8: Code Review Checklist & Project Context (AC: 6)
  - [x] 8.1 Add to BMAD code review checklist (`_bmad/bmm/workflows/4-implementation/code-review/checklist.md`): `- [ ] **[BLOCKING]** If story adds user-facing metrics → glossary entry in metricGlossary.ts + <MetricHelp> in component`
  - [x] 8.2 Create or update `project-context.md` with metric help guidance: "When adding user-facing numbers: add glossary entry to `packages/shared/src/constants/metricGlossary.ts` and wrap the label with `<MetricHelp>` in the component. For observation creators: provide a non-empty `completenessNote` in the ObservationContext."
  - [x] 8.3 Add `completenessNote` requirement to the observation creation section of architecture docs (if applicable)

- [x] Task 9: Full Test Suite Verification (AC: all)
  - [x] 9.1 Run `pnpm typecheck` — zero type errors (confirms exhaustive Record enforcement works)
  - [x] 9.2 Run `pnpm lint` — zero lint errors
  - [x] 9.3 Run shared tests — enforcement tests pass
  - [x] 9.4 Run server tests — all pass (observation creators updated with completenessNote)
  - [x] 9.5 Run client tests — all pass (MetricHelp component + wiring doesn't break existing tests)

## Dev Notes

### Technical Requirements

#### MetricDefinition Interface

```typescript
export interface MetricDefinition {
  label: string;          // Display name for the metric
  description: string;    // What it measures — plain language, non-punitive
  derivedFrom: string;    // What data sources feed this number
  guidance?: string;      // What action to consider (optional — some metrics are informational)
}
```

#### Exhaustive Type Enforcement Pattern

The key enforcement mechanism: `Record<UnionType, MetricDefinition>` forces TypeScript to require an entry for every value in the union. When a new observation type (e.g., `'payroll_ghost'`) is added to `ObservationType`, the build immediately fails on `OBSERVATION_HELP` with:

```
Property 'payroll_ghost' is missing in type '{ rate_variance: MetricDefinition; ... }'
```

No annotation, no eslint rule, no CI script — pure type system enforcement.

```typescript
// This MUST have an entry for every ObservationType — adding a new type without
// adding it here causes a compile error
export const OBSERVATION_HELP: Record<ObservationType, MetricDefinition> = {
  rate_variance: {
    label: 'Rate Variance',
    description: 'The loan\'s recorded interest rate differs from the standard scheme rate.',
    derivedFrom: 'Comparison of loan terms against the scheme\'s standard 13.33% rate.',
    guidance: 'Verify against original loan approval documentation.',
  },
  stalled_balance: {
    label: 'Stalled Balance',
    description: 'The outstanding balance has not changed for 2+ consecutive months despite the loan being active.',
    derivedFrom: 'Month-over-month comparison of computed outstanding balances from ledger entries.',
    guidance: 'Check whether deductions are being recorded. May indicate a payroll processing gap.',
  },
  inactive_loan: {
    label: 'Inactive Loan',
    description: 'No deduction has been recorded for 60+ consecutive days on an active loan.',
    derivedFrom: 'Gap between today and the most recent ledger entry, filtered for employment events that explain the gap.',
    guidance: 'Review loan status and contact the MDA for clarification on deduction status.',
  },
  // ... all 11 types
};
```

#### Completeness Note Examples

Each observation creator provides a plain-language note describing what data was available:

| Observation Type | Scenario | completenessNote |
|---|---|---|
| `inactive_loan` | With submission data | "Loan record, ledger history, employment events, and MDA submission reviewed" |
| `inactive_loan` | Without submission | "Loan record, ledger history, and employment events reviewed. No MDA submission available for cross-reference" |
| `rate_variance` | Full data | "Loan terms, ledger entries, and scheme rate configuration reviewed" |
| `rate_variance` | Missing approval | "Loan terms and ledger entries reviewed. Original approval records not available" |
| `manual_exception` | Always | "Manually flagged — no automated analysis performed" |
| `three_way_variance` | Always | "Payroll extract, MDA submission, and ledger records compared" |
| `period_overlap` | Always | "Both uploads for the overlapping period fully available for comparison" |

#### MetricHelp Component Design

```tsx
// Usage — glossary-backed (most common)
<p>Total Exposure <MetricHelp metric="dashboard.totalExposure" /></p>

// Usage — inline definition (for one-off or dynamic cases)
<p>Coverage <MetricHelp definition={{ label: 'Coverage', description: '...', derivedFrom: '...' }} /></p>

// Usage — observation completeness (static glossary + dynamic note)
<p>Data completeness <MetricHelp metric="observation.dataCompleteness" />: {pct}%</p>
<p className="text-xs text-text-muted">{observation.context.completenessNote}</p>
```

The component accepts either a `metric` key (looks up in glossary) or a raw `definition` object. This handles both the common case (static glossary) and edge cases (dynamic or one-off explanations).

**UX Placement Rule:** The info icon always appears **inline-end of the label text**, vertically centered with the label baseline — never before the label, never floating right of the value. The icon is part of the label, not the data. Establish this pattern in Task 3 and replicate consistently across all 15+ screens in Tasks 4–6. Example: `<span>Total Exposure <MetricHelp ... /></span>` followed separately by the value.

#### Metric Audit — What Needs Help vs What's Self-Explanatory

**NEEDS HELP (non-obvious — add MetricHelp):**

*Dashboard:*
- Total Exposure — "Is this principal only or principal + interest?"
- Fund Available — "Where does this figure come from? Why might it say 'Awaiting Configuration'?"
- Collection Potential — "How does this differ from Outstanding Receivables?"
- At-Risk Amount — "What makes a loan 'at risk'?"
- Completion Rate (60m) — "What does the 60-month window mean?"
- Each Attention Item type — "What triggers this? What should I do?"

*Observations:*
- Data Completeness — "X% of what?"
- Each observation type badge — "What does 'Rate Variance' mean?"

*Exceptions:*
- Priority levels — "What's the expected response time?"
- Categories — "What's the difference between 'inactive' (manual) and 'inactive_loan' (auto)?"

*Migration:*
- Stage progress ("Stage N of 6") — "What happens at each stage?"
- Record quality bands (Clean/Minor/Significant/Structural) — "What's the threshold?"

*Reconciliation:*
- Match Rate — "Match between what three sources?"
- Full Variance — "What makes a variance 'full' vs 'partial'?"
- Days Difference — "What two dates are being compared?"

*Loan Detail:*
- Outstanding Balance — "Does this include interest? How is it computed?"
- Grade Level Tier — "What determines the tier?"

*System Health:*
- All metrics — "What's healthy? What's concerning?"

**SELF-EXPLANATORY (no MetricHelp needed):**
- Simple counts: "Active Loans: 342", "Records: 1,204"
- Simple currency: "Monthly Deduction: ₦45,000"
- Dates and timestamps
- Status labels and badges
- Pagination ("Page 1 of 5")

### Enforcement Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENFORCEMENT CASCADE                          │
├─────────────────┬───────────────────────────────────────────────┤
│ Layer 1:        │ Record<ObservationType, MetricDefinition>     │
│ COMPILE-TIME    │ Record<AttentionItemType, MetricDefinition>   │
│ (pnpm typecheck)│ completenessNote: string (required)           │
│                 │ → Adding a type without glossary = build fail │
├─────────────────┼───────────────────────────────────────────────┤
│ Layer 2:        │ Enum ↔ glossary bidirectional check           │
│ TEST-TIME       │ No empty descriptions/derivedFrom             │
│ (pnpm test)     │ completenessNote populated in test fixtures   │
│                 │ → Missing entry = descriptive test failure    │
├─────────────────┼───────────────────────────────────────────────┤
│ Layer 3:        │ Code review checklist: BLOCKING item          │
│ REVIEW-TIME     │ project-context.md: dev agent guidance        │
│ (code review)   │ → Reviewer catches frontend <MetricHelp>     │
│                 │   gaps that TypeScript can't enforce          │
└─────────────────┴───────────────────────────────────────────────┘
```

### Architecture Compliance

- **Non-punitive vocabulary:** All glossary descriptions use approved vocabulary from `vocabulary.ts`. "Variance" not "discrepancy", "observation" not "anomaly"
- **Shared package ownership:** Glossary lives in `packages/shared` — single source of truth consumed by both server (for completenessNote validation) and client (for MetricHelp rendering)
- **No new dependencies:** Uses existing Tooltip/Popover from shadcn/ui component library
- **Accessibility:** MetricHelp icon is keyboard-focusable, has `aria-label`, popover is screen-reader accessible

### Library & Framework Requirements

- **No new dependencies**
- Existing: shadcn/ui Tooltip or Popover component, lucide-react icons

### File Structure Requirements

#### New Files

```
packages/shared/src/
├── constants/metricGlossary.ts                 ← NEW: typed glossary sections + MetricDefinition interface
├── constants/metricGlossary.test.ts            ← NEW: enforcement tests (enum ↔ glossary sync)

apps/client/src/
├── components/shared/MetricHelp.tsx             ← NEW: tooltip component
├── components/shared/MetricHelp.test.tsx         ← NEW: component tests
```

#### Modified Files

```
packages/shared/src/
├── types/observation.ts                         ← MODIFY: add completenessNote to ObservationContext
├── validators/observationSchemas.ts             ← MODIFY: sync type filter enum (add 5 missing observation types)
├── index.ts                                     ← MODIFY: export MetricDefinition + glossary sections

apps/server/src/
├── services/observationEngine.ts                ← MODIFY: add completenessNote to all 8 detector functions
├── services/inactiveLoanDetector.ts             ← MODIFY: add completenessNote
├── services/exceptionService.ts                 ← MODIFY: add completenessNote for manual exceptions
├── services/threeWayReconciliationService.ts    ← MODIFY: add completenessNote
├── services/deduplicationService.ts             ← MODIFY: add completenessNote

apps/client/src/
├── pages/dashboard/DashboardPage.tsx            ← MODIFY: add MetricHelp to hero metrics
├── pages/dashboard/ExceptionsPage.tsx           ← MODIFY: add MetricHelp to priority badges
├── pages/dashboard/LoanDetailPage.tsx           ← MODIFY: add MetricHelp to balance, tier
├── pages/dashboard/MigrationPage.tsx            ← MODIFY: add MetricHelp to coverage, stages
├── pages/dashboard/ThreeWayReconciliationPage.tsx ← MODIFY: add MetricHelp to match rate, variance
├── pages/dashboard/MetricDrillDownPage.tsx      ← MODIFY: add MetricHelp to variance, health band
├── pages/dashboard/SystemHealthPage.tsx         ← MODIFY: add MetricHelp to metric cards
├── pages/dashboard/components/ObservationCard.tsx ← MODIFY: MetricHelp + completenessNote display
├── pages/dashboard/components/ObservationsList.tsx ← MODIFY: MetricHelp on type breakdown badges
├── pages/dashboard/components/ComparisonSummary.tsx ← MODIFY: MetricHelp on variance figures
├── pages/dashboard/components/ReconciliationSummary.tsx ← MODIFY: MetricHelp on days difference
├── pages/dashboard/components/MigrationCoverageTracker.tsx ← MODIFY: MetricHelp on coverage cells
├── pages/dashboard/components/MigrationProgressBar.tsx ← MODIFY: MetricHelp on progress label
├── components/shared/HeroMetricCard.tsx         ← MODIFY: optional helpKey prop
├── components/shared/AttentionItemCard.tsx       ← MODIFY: MetricHelp from ATTENTION_HELP by type
├── components/shared/ComplianceProgressHeader.tsx ← MODIFY: MetricHelp on deadline/submitted count
├── components/shared/MigrationProgressCard.tsx   ← MODIFY: MetricHelp on stage + quality bands

_bmad/bmm/workflows/4-implementation/code-review/
├── checklist.md                                 ← MODIFY: add metric help blocking item
```

### Testing Requirements

- **metricGlossary.test.ts:** Enum ↔ glossary sync tests (bidirectional), no-empty-fields tests
- **MetricHelp.test.tsx:** Renders tooltip, handles missing key gracefully, accepts inline definition
- **Server tests:** All observation creation tests updated with `completenessNote`
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.2 (Automatic Inactive Loan Detection — Previous)

- **dataCompleteness bug:** H1 review finding — values were 0.8/0.5 instead of 80/50 (integer convention). Fixed. This story adds `completenessNote` alongside the numeric value to explain what the number means
- **Observation creation pattern:** Creates context with `possibleExplanations`, `suggestedAction`, `dataCompleteness`, `dataPoints`. This story adds `completenessNote` as a required field

#### From Story 7.0d (Observation Engine Completion)

- **8 detector functions** in `observationEngine.ts` each create observations with `dataCompleteness`. All need `completenessNote` added

#### From Story 4.2 (Attention Items & Status Indicators)

- **12 attention item types** displayed as cards. Each type's meaning needs a glossary entry in `ATTENTION_HELP`

### Git Intelligence

**Expected commit:** `feat: Story 7.2a — Metric Help System & Contextual Guidance with code review fixes`

### Critical Warnings

1. **`completenessNote` is REQUIRED, not optional:** Making it required means every observation creator must provide it. This is intentional — optional fields get ignored. If compilation breaks in 7 files, that's the enforcement working
2. **Record<UnionType, ...> is the enforcement mechanism:** Do NOT use `Partial<Record<...>>` or `Record<string, ...>` — the whole point is exhaustiveness. If a future developer weakens the type to make the build pass, the code review checklist catches it
3. **Don't add MetricHelp to self-explanatory metrics:** "Active Loans: 342" doesn't need a tooltip. Over-annotating trains users to ignore all tooltips. Only add to metrics listed in the "NEEDS HELP" section above
4. **Non-punitive vocabulary in glossary:** All descriptions must use approved terms from `vocabulary.ts`. Review all glossary text for compliance before shipping
5. **Test all observation creators after adding completenessNote:** The required field will break ~20+ existing tests that create mock ObservationContext objects. Budget time for fixing them — this is expected and the test failures are the enforcement proving it works

### Session Sizing

This story has 9 tasks / ~48 subtasks. Under the 15-task guardrail but at the upper boundary. Tasks 4–6 (16 subtasks of screen wiring) are mechanical and repetitive — they follow the same pattern established in Task 3. Plan for a **2+ session minimum**: Session 1 covers Tasks 1–3 (glossary + completenessNote + component), Session 2 covers Tasks 4–9 (wiring + enforcement + verification). Tasks 4–6 can be done screen-by-screen without blocking each other.

### Project Structure Notes

- This is a cross-cutting UX story that establishes infrastructure for all future stories
- The glossary lives in `packages/shared` because both server (validation) and client (display) need it
- The `<MetricHelp>` component follows the existing pattern of shared components in `apps/client/src/components/shared/`
- The enforcement tests live in the shared package alongside the glossary
- The code review checklist update ensures human reviewers catch frontend wiring gaps that TypeScript can't enforce (TypeScript enforces the glossary exists; it can't enforce that `<MetricHelp>` is used in the JSX)

### References

- [Source: Story 7.2 code review — H1 finding] — dataCompleteness scale mismatch prompted this story
- [Source: ObservationCard.tsx:105-113] — current dataCompleteness display
- [Source: observationEngine.ts:277] — computed completeness pattern
- [Source: packages/shared/src/types/observation.ts] — ObservationContext interface
- [Source: packages/shared/src/types/dashboard.ts:70-82] — AttentionItemType union
- [Source: packages/shared/src/validators/dashboardSchemas.ts:70-81] — DrillDownMetric enum

## Dev Agent Record

### Implementation Plan

Three-layer enforcement architecture:
1. **Compile-time:** `Record<UnionType, MetricDefinition>` forces exhaustive glossary entries for ObservationType (11), AttentionItemType (12), DrillDownMetric (10)
2. **Test-time:** 111 enforcement tests verify bidirectional enum/glossary sync and no-empty-fields
3. **Review-time:** BLOCKING checklist item + project-context.md guidance

`completenessNote` made a required (not optional) field on `ObservationContext` — 12 observation creation sites updated across 5 service files. Also fixed `dataCompleteness: 1` to `100` in threeWayReconciliationService (was a bug — scale is 0–100).

### Completion Notes

- Glossary: 8 sections (3 exhaustive-typed + 5 review-enforced), unified `METRIC_GLOSSARY` lookup with "section.key" namespace
- `completenessNote`: Required field added to ObservationContext, all 12 creation paths updated with context-specific notes
- `observationQuerySchema`: 5 missing observation types added to filter enum (period_overlap, grade_tier_mismatch, three_way_variance, manual_exception, inactive_loan)
- `<MetricHelp>` component: HelpCircle icon, Tooltip-based, accessible (keyboard focusable, aria-label), accepts `metric` key or inline `definition`
- Wired into 15+ screens: Dashboard hero metrics, attention items, compliance header, observation cards/lists, exception priorities, loan detail, migration progress, reconciliation summary, system health, drill-down, comparison summary
- Fixed 2 pre-existing tests that used generic `getByRole('button')` — now correctly scoped after MetricHelp buttons were added
- All test suites green: 416 shared (159 enforcement) + 1346 server + 622 client = 2384 tests passing

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] `dataCompleteness: 1` in exceptionService.ts — same 0–100 scale-mismatch bug as threeWayReconciliation. Fixed: 1 → 100 [exceptionService.ts:61]
- [x] [AI-Review][HIGH] Enforcement tests only validate field quality for 3 of 8 glossary sections. Fixed: added EXCEPTION_HELP, RECONCILIATION_HELP, MIGRATION_HELP, LOAN_HELP, SYSTEM_HEALTH_HELP to field validation loop [metricGlossary.test.ts:91-111]
- [x] [AI-Review][MEDIUM] MetricHelp on MigrationProgressBar was absolute-positioned from parent, breaking UX placement rule. Fixed: moved MetricHelp inline inside MigrationProgressBar.tsx, removed floating wrapper from MigrationPage.tsx [MigrationProgressBar.tsx, MigrationPage.tsx]
- [x] [AI-Review][MEDIUM] `completenessNote` rendered with optional chaining despite being required. Fixed: removed `?.` guard on context [ObservationCard.tsx:116]
- [x] [AI-Review][MEDIUM] Data Completeness used inline definition instead of glossary entry. Fixed: added `observation.dataCompleteness` to METRIC_GLOSSARY, ObservationCard now uses `metric="observation.dataCompleteness"` [metricGlossary.ts, ObservationCard.tsx:108]
- [x] [AI-Review][MEDIUM] Enforcement test count understated actual section coverage gap — addressed by H2 fix above. Tests now cover all 8 sections (416 total, up from 368)
- [x] [AI-Review][LOW] File Structure Requirements listed MigrationProgressBar.tsx but File List didn't — reconciled by M1 fix (file now modified and added to File List)
- [x] [AI-Review][LOW] Inline definition object re-created each render — addressed by M3 fix (now uses glossary key)
- [x] [AI-Review][LOW] `<button>` inside `<p>` tag in MigrationProgressCard.tsx — invalid HTML. Fixed: changed `<p>` to `<div>` [MigrationProgressCard.tsx:96]
- [x] [AI-Review][LOW] ComparisonSummary.test.tsx button selector fragile after MetricHelp addition. Fixed: `{ name: /view variance detail/i }` [ComparisonSummary.test.tsx:91]

## File List

### New Files
- `packages/shared/src/constants/metricGlossary.ts` — MetricDefinition interface + 8 glossary sections + unified lookup
- `packages/shared/src/constants/metricGlossary.test.ts` — 159 enforcement tests (111 original + 48 added by review for plain sections)
- `apps/client/src/components/shared/MetricHelp.tsx` — Tooltip component
- `apps/client/src/components/shared/MetricHelp.test.tsx` — 6 component tests
- `project-context.md` — Dev agent guidance for metric help + non-punitive vocabulary

### Modified Files
- `packages/shared/src/types/observation.ts` — added `completenessNote: string` to ObservationContext
- `packages/shared/src/validators/observationSchemas.ts` — added 5 missing observation types to query filter enum
- `packages/shared/src/index.ts` — exported MetricDefinition + all glossary sections
- `apps/server/src/services/observationEngine.ts` — added completenessNote to ObservationInsert + all 8 detectors
- `apps/server/src/services/inactiveLoanDetector.ts` — added completenessNote
- `apps/server/src/services/exceptionService.ts` — added completenessNote for manual exceptions
- `apps/server/src/services/threeWayReconciliationService.ts` — added completenessNote + fixed dataCompleteness 1→100
- `apps/server/src/services/deduplicationService.ts` — added completenessNote
- `apps/client/src/components/shared/HeroMetricCard.tsx` — added optional helpKey prop + MetricHelp rendering
- `apps/client/src/components/shared/AttentionItemCard.tsx` — added MetricHelp by attention type
- `apps/client/src/components/shared/ComplianceProgressHeader.tsx` — added MetricHelp on submission progress
- `apps/client/src/components/shared/MigrationProgressCard.tsx` — added MetricHelp on stage progress
- `apps/client/src/pages/dashboard/DashboardPage.tsx` — wired helpKey to all hero metrics + reconciliation labels
- `apps/client/src/pages/dashboard/ExceptionsPage.tsx` — MetricHelp on priority badges
- `apps/client/src/pages/dashboard/LoanDetailPage.tsx` — MetricHelp on balance + tier
- `apps/client/src/pages/dashboard/MigrationPage.tsx` — MetricHelp on coverage + stages
- `apps/client/src/pages/dashboard/ThreeWayReconciliationPage.tsx` — MetricHelp on match rate + variance
- `apps/client/src/pages/dashboard/MetricDrillDownPage.tsx` — MetricHelp on variance + health band
- `apps/client/src/pages/dashboard/SystemHealthPage.tsx` — MetricHelp on health metric
- `apps/client/src/pages/dashboard/components/ObservationCard.tsx` — MetricHelp on data completeness + completenessNote display
- `apps/client/src/pages/dashboard/components/ObservationsList.tsx` — MetricHelp on type breakdown badges
- `apps/client/src/pages/dashboard/components/ComparisonSummary.tsx` — MetricHelp on match rate + variance
- `apps/client/src/pages/dashboard/components/ReconciliationSummary.tsx` — MetricHelp on days difference
- `apps/client/src/pages/dashboard/components/MigrationCoverageTracker.tsx` — MetricHelp on coverage header
- `apps/client/src/pages/dashboard/components/MigrationProgressBar.tsx` — MetricHelp inline on coverage label (review fix)
- `apps/client/src/components/shared/MigrationProgressCard.test.tsx` — fixed button selector after MetricHelp addition
- `apps/client/src/pages/dashboard/components/ComparisonSummary.test.tsx` — fixed button selector after MetricHelp addition
- `_bmad/bmm/workflows/4-implementation/code-review/checklist.md` — added BLOCKING metric help review item

## Change Log

- 2026-03-24: Story 7.2a implemented — Metric Help System & Contextual Guidance. Three-layer enforcement (compile + test + review), completenessNote on all observations, MetricHelp wired into 15+ screens, 111 enforcement tests added.
- 2026-03-24: Code review — 10 issues found (2H, 4M, 4L), all fixed. Key fixes: dataCompleteness scale bug in exceptionService, enforcement tests extended to all 8 glossary sections (111→159 tests), MigrationProgressBar MetricHelp moved inline, ObservationCard uses glossary key, HTML validation fix in MigrationProgressCard, test selector hardened in ComparisonSummary. Total tests: 2384.
