# Sprint Change Proposal — Epic 3: Data Migration & Legacy Import

**Workflow:** Correct Course (Change Navigation)
**Date:** 2026-02-28
**Facilitator:** John (PM Agent)
**Participants:** Awwal (Product Owner), Claude Opus 4.6 (Dev Agent), John (PM Agent)
**Status:** PENDING APPROVAL

---

## 1. Issue Summary

### 1.1 Triggering Event

**Trigger:** SQ-1 Legacy CD Analysis Pipeline (side quest during Epic 2)

SQ-1 was not a story in the sprint backlog — it was an exploratory side quest that built a 3-phase analysis pipeline to process 122+ legacy Excel files from the Oyo State Car Loan CD containing monthly deduction records for civil servants (2017–2025). The findings from this analysis have fundamentally changed our understanding of what Epic 3 must accomplish.

**The SQ-1 pipeline:**
- **Phase 1** (analyze.ts) — Parses all Excel files, detects headers across 4 format eras, resolves MDA names, outputs catalog.json
- **Phase 2** (crossref.ts) — Cross-references approved beneficiary lists against deduction records, builds timelines, detects anomalies
- **Phase 3** (report.ts) — Generates AG report HTML

### 1.2 Issue Classification

- **Type:** New requirements emerged from real data analysis + Misunderstanding of original data complexity
- **Severity:** Moderate — Epic 3 is still in backlog (zero rework cost), but scope increase is significant
- **Urgency:** Low — Epic 3 is Sprint 5 in the sequence. We have time to reshape properly

### 1.3 Core Problem Statement

Epic 3 as currently scoped treats legacy data migration as a **column-mapping and spreadsheet upload exercise** (5 stories, all data plumbing). SQ-1 analysis of the actual legacy data revealed that the real challenge is **cross-MDA person linking, interest rate variance detection, intra-file MDA delineation, observation surfacing, and extra-field capture** — none of which exist in the current 5 stories.

The current Epic 3 answers: *"How do we get spreadsheet data into the system?"*
The reshaped Epic 3 answers: *"How do we get spreadsheet data into the system AND surface the intelligence hidden within it?"*

### 1.4 Supporting Evidence

| # | Evidence | Source | Quantification | Impact on Epic 3 |
|---|----------|--------|----------------|-------------------|
| 1 | 298 unique column headers across 4 format eras | SQ-1 Phase 1 catalog scan | 298 headers, 4 eras (pre-2019, 2019-2020, 2021-2023, 2024-2025) | Column mapping must be intelligent and auto-detecting, not template-based. Story 3.1 must handle this variation |
| 2 | 425 staff with records across multiple MDAs | SQ-1 Phase 2 crossref | 425 of 2,952 staff (14.4%) | Cross-MDA person matching is a core requirement, not an edge case. Requires new Story 3.3 |
| 3 | 577 interest rate variances (6+ distinct rates) | SQ-1 interest rate analysis of 3,449 loans | 13.33% (2,745 loans, 79.6%), 11.11% (171), 8.0% (93), 8.89% (92), 10.66% (75), 6.67% (45) | Rate validation logic needed at import time. Story 3.2 must detect and surface these |
| 4 | CDU records embedded in ALL Agriculture files (2018–2025) | SQ-1 CDU/Agriculture verification scan | Every Agriculture file has "COCOA DEVELOPMENT UNIT" marker in Column 3 mid-sheet | Intra-file MDA delineation required. Requires new Story 3.8 |
| 5 | CDU submitted 8 independent files + appears in Agriculture | SQ-1 CDU verification | 8 CDU files (2,266 records) + embedded in Agriculture = double-counting risk | Cross-file deduplication required. Requires new Story 3.8 |
| 6 | 1,509 of 2,952 staff (51%) have auto-detectable observations | SQ-1 master beneficiary ledger analysis | 577 rate variance, 203 stalled, 142 negative, 425 multi-MDA, 368 approval mismatches | Observation engine must exist at migration time. Requires new Story 3.6 |
| 7 | OLANIYAN case study: 3 loan cycles, 2 MDAs, 8% rate | SQ-1 individual trace analysis | 25 months of data across Justice → Information, 3 distinct loan cycles | Individual trace reports are a proven value-add. Requires new Story 3.7 |
| 8 | Extra fields from 6+ MDAs: employee no, appointment dates, bank details, grade level | SQ-1 data richness scan across 125 files | Education (148 sheets with EMPLOYEE NO), Health (STAFF ID, GRADE LEVEL, BANK, ACCOUNT NO), Information (STAFF ID, REF ID), Arts & Culture (STAFF ID, COMMENCEMENT DATE), OYSADA (STAFF ID), OYSPHB (STAFF ID), Agriculture/Audit (START DATE, END DATE), Pensions/CSC (COMMENCEMENT DATE, REF ID, STATION) | "Can't throw anything away" — all fields must be captured. Story 3.1 must handle extra field extraction |
| 9 | 203 stalled balances | SQ-1 master ledger | Balance unchanged for 3+ consecutive months | Auto-detection pattern needed. OLANIYAN's balance stalled Oct–Dec 2025 at ₦364,491 |
| 10 | 142 negative balances | SQ-1 master ledger | Deductions continued past zero balance | Auto-detection pattern needed. Suggests refund obligation |
| 11 | 31 of 63 MDAs have zero files on the CD | SQ-1 Phase 1 | 32 MDAs with files, 31 without | Data gap — compliance issue vs collection issue. Migration dashboard (3.5) must track this |
| 12 | Working HTML prototypes | SQ-1 generated artifacts | master-beneficiary-ledger.html (2,952 staff), individual-trace-olaniyan.html | De-risk new stories — we know what the output should look like |

---

## 2. Impact Analysis

### 2.1 Epic 3 — Direct Impact

**Can Epic 3 be completed as originally planned?** NO.

The current 5 stories cover the mechanics of upload → validate → compare → acknowledge → track. They do NOT cover:

1. **Cross-MDA person matching** — 425 staff span multiple MDAs. Without matching, the same person appears as separate unrelated records in different MDAs, making scheme-wide analysis impossible
2. **Interest rate variance detection** — 577 loans with non-standard rates. Without detection, these silently enter the system as accepted values, and the computation engine will produce variance alerts every month for the entire operational life of the loan
3. **Intra-file MDA delineation** — CDU-in-Agriculture pattern means a single Excel file contains records for multiple MDAs, with MDA boundaries marked by a column value mid-sheet. Without delineation, CDU records are attributed to Agriculture
4. **Cross-file deduplication** — CDU submitted independently AND appears in Agriculture. Without deduplication, CDU staff are counted twice in every aggregate metric
5. **Observation engine with review workflow** — 1,509 observations need surfacing at migration time with non-punitive language. Without this, observations are invisible until they trigger exceptions during monthly operations (Epic 7), overwhelming the Department Admin
6. **Individual trace report generation** — Proven by OLANIYAN case study. Cross-MDA, cross-time loan history in a single view
7. **Extra field capture** — 298 column headers, 6+ MDAs provide staff IDs, dates, bank details. "Can't throw anything away" (PO directive)

**The original 5 stories assumed:**
- Clean, single-MDA-per-file Excel templates
- A known, consistent column structure
- One-to-one mapping between file and MDA
- Basic variance = declared vs computed
- Staff records isolated within a single MDA

**The actual data shows:**
- 298 column header variants across 4 format eras
- Multi-MDA files (CDU in Agriculture)
- Dual submissions (CDU independently + in Agriculture)
- Staff spanning 2+ MDAs over time (transfers)
- 6+ distinct interest rates (not just 13.33%)
- Rich auxiliary data (employee numbers, appointment dates, bank details)

### 2.2 Impact on Other Epics

| Epic | Impact Level | Details |
|------|-------------|---------|
| **Epic 4: Executive Dashboard & Scheme Visibility** | **Positive** | Observation engine (Story 3.6) feeds directly into Epic 4's attention items (FR33). Dashboard metrics include observation counts and resolution rates. Master beneficiary ledger (Story 3.5) provides data for staff drill-down. Individual trace (Story 3.7) is accessible from loan detail views |
| **Epic 5: MDA Monthly Submission** | **Minor positive** | Observation templates established in Story 3.6 are reusable for monthly submission variances. Column mapping intelligence from Story 3.1 benefits the CSV upload validation pipeline |
| **Epic 6: Reporting & PDF Export** | **Positive** | Individual trace reports (Story 3.7) become a new report type available in the reports suite. Observation summaries are a natural addition to Executive Summary reports |
| **Epic 7: Exception Management & Record Annotations** | **Significant — boundary clarification needed** | Risk: Observation engine (3.6) and exception engine (7.x) could overlap or conflict. **Resolution:** Define clear boundary — **observations** are auto-generated at migration/import time (system-detected patterns requiring review); **exceptions** are human-flagged during ongoing operations (officer-raised issues requiring resolution). Both use the same underlying data model but have different lifecycle states and different trigger sources. Observation → exception promotion path: if an observation is not resolved during migration review, it can be promoted to an active exception for operational follow-up |
| **Epic 8: Auto-Stop Certificate & Loan Completion** | **Minor positive** | Negative balance detection (142 cases) during migration creates early awareness of over-deduction cases that will eventually trigger auto-stop logic |
| **Epic 9: Notifications & Automated Alerts** | **No impact** | Notification patterns unchanged |
| **Epic 10: Staff Temporal Profile & Retirement Validation** | **Dependency unchanged** | Epic 3 still depends on Epic 10 for retirement date computation needed during migration (post-retirement deduction detection). No change to dependency direction |
| **Epic 11: Pre-Submission & Mid-Cycle Events** | **Positive** | Story 11.4 (MDA Historical Data Upload) shares upload/validation logic with Story 3.1. Column mapping engine and validation pipeline are reusable. Extra field capture logic benefits historical upload |
| **Epic 12: Early Exit Processing** | **No impact** | Early exit unrelated to migration |
| **Epic 13: Staff ID Governance** | **Positive** | Story 3.1 captures Staff IDs from extra fields in 6+ MDAs during migration. This feeds Staff ID coverage and provides seed data for the Staff ID governance system. Migration becomes the primary source of Staff ID data for legacy records |

### 2.3 New Epics Needed?

**No.** The 3 new stories (3.6, 3.7, 3.8) fit naturally within Epic 3's scope — "Data Migration & Legacy Import." The observation engine, individual traces, and deduplication are all migration-time capabilities that generate data consumed by downstream epics. Creating a separate epic would fragment the migration workflow.

### 2.4 Epic Order / Priority Changes

**No resequencing needed.** The critical path remains:

```
Epic 1 (done) → Epic 2 (in-progress) → Epic 10 → Epic 3 → Epic 4 → Epic 5 → Epic 11
```

Epic 3 is still Sprint 5 in the sequence. The scope increase adds 3 stories but doesn't change dependencies. Epic 10 (temporal validation) is still required before Epic 3 for retirement date computation during migration.

---

## 3. Artifact Conflict and Impact Analysis

### 3.1 PRD Impact

**Conflicts with existing FRs:** None. All existing FRs (FR25-FR31, FR70-FR71, FR85) remain valid and are still covered.

**PRD additions required:**

#### FR86: Observation Engine (New — Story 3.6)

System can auto-generate observations during migration processing. Observation types:
- **Rate Variance** — Loan's effective interest rate differs from the standard 13.33%. System computes actual rate from principal and total loan amount, compares against standard, and categorises the variance. Template: *"This loan's total interest is {rate}% ({interestAmount} on {principal}), which differs from the standard 13.33%. This is consistent with a {tenure}-installment repayment plan. Possible explanations: different approved tenure, GL-level based rate tier, administrative adjustment. Verify against loan application records."*
- **Stalled Balance** — Outstanding balance unchanged for 3+ consecutive months. Template: *"Outstanding balance has remained at {amount} for {count} consecutive months ({startMonth}–{endMonth}). Possible explanations: salary deduction suspension, administrative hold, data entry lag. Confirm with MDA payroll records."*
- **Negative Balance** — Balance below zero, indicating over-deduction. Template: *"Balance reached {amount} (below zero) in {period}, suggesting deductions continued after loan completion. An estimated {overAmount} may be due for refund. Possible explanations: delayed stop-deduction processing, timing difference between payroll and loan records. Verify deduction stop date."*
- **Multi-MDA** — Staff has loan records across 2+ MDAs. Template: *"This staff member has loan records across {count} MDAs ({mdaList}). This typically indicates an inter-MDA transfer. Verify transfer documentation and confirm loan continuity."*
- **No Approval Match** — Active deduction records but no entry on loaded approved beneficiary lists. Template: *"This staff member has active deduction records but does not appear on the loaded approved beneficiary lists. Possible explanations: approved on an earlier list not yet uploaded, name variance between list and records, legacy loan predating current approval process. Cross-check with MDA loan files."*

Each observation includes: factual description, what the data shows, context with possible explanations, suggested next step, status (Unreviewed / Reviewed / Resolved), source reference (file → sheet → row).

All observation language must comply with the non-punitive vocabulary established in the UX specification and `packages/shared/src/constants/vocabulary.ts`. Observations are informational, not accusatory.

#### FR87: Individual Staff Trace Report (New — Story 3.7)

System can generate individual staff trace reports showing:
- Complete loan history across all MDAs and time periods
- Loan cycle detection (start, trajectory, completion/transition)
- Interest rate analysis per cycle with mathematical verification
- Balance trajectory chart
- Observations attached to each cycle with context
- Cross-MDA transfer timeline
- Approval list cross-reference (which lists the staff appeared on)

Reports exportable as HTML and PDF. One-click generation from any staff profile view.

#### FR88: Multi-MDA File Delineation & Deduplication (New — Story 3.8)

System can:
1. **Detect intra-file MDA boundaries** — When a single uploaded file contains records for multiple MDAs (e.g., Agriculture files containing CDU records), the system detects MDA column markers mid-sheet and assigns each record to the correct MDA. Users confirm the detected boundaries before import.
2. **Detect cross-file duplicates** — When the same staff member appears in both a parent MDA's file and a sub-agency's independent file (e.g., CDU in Agriculture AND CDU's own files), the system detects the duplication using name matching and flags it for resolution.
3. **Track parent/agency relationships** — The MDA registry supports parent/agency relationships (e.g., CDU is a department under Agriculture). This relationship informs deduplication logic and prevents double-counting in aggregate metrics.

#### FR89: Intelligent Column Mapping (Extension of FR25 — Story 3.1)

Migration column mapping can:
1. **Auto-detect source columns** from 298+ known header variants across 4 format eras. The system maintains a header vocabulary mapping common variants to canonical VLPRS field names (e.g., "BAL B/F" → outstanding_balance, "TAVS COMMENCEMENT DATE" → commencement_date, "EMPLOYEE NO" → staff_id)
2. **Capture all available fields** including non-standard extras: employee number, appointment dates, commencement dates, bank details, grade level, step, station, reference ID, start/end dates, department. No data is discarded — extra fields stored in a flexible schema for historical record completeness
3. **Handle 4 format eras** — Pre-2019 (minimal columns), 2019-2020 (standardising), 2021-2023 (mostly consistent), 2024-2025 (current template). Each era has different column order, naming, and available fields

**MVP impact:** No negative impact. These additions make the migration tool more intelligent, not more complex for the user. The AG's "all 63 MDAs uploaded at inception" launch strategy is strengthened because observations surface automatically rather than requiring weeks of manual investigation. The AG opens VLPRS and sees not just numbers but intelligence.

### 3.2 Architecture Impact

**Conflicts with existing architecture:** None. The existing architecture already defines `migrationService.ts`, `comparisonEngine.ts`, and `temporalValidationService.ts` as the migration foundation.

**New services required:**

| Service | Location | Responsibility | Dependencies | Forbidden Actions |
|---------|----------|---------------|--------------|-------------------|
| `observationEngine.ts` | `apps/server/src/services/` | Auto-generate observations during migration. Classify by type (rate variance, stalled, negative, multi-MDA, no approval). Apply non-punitive templates from vocabulary.ts. Store in observations table | `comparisonEngine`, `computationEngine`, `vocabulary.ts` | Direct ledger UPDATE/DELETE |
| `personMatchingService.ts` | `apps/server/src/services/` | Cross-MDA person matching using name similarity + Staff ID when available. Handle name variants (OLUWADAMILARE vs DAMILARE, middle name presence/absence). Confidence scoring | `migrationService` | Creating false matches without confidence thresholds |
| `fileDelineationService.ts` | `apps/server/src/services/` | Parse MDA column markers within sheets. Detect parent/agency boundaries mid-file. Assign correct MDA to each record. Generate delineation preview for user confirmation | `migrationService`, MDA registry | Silently re-assigning records without user confirmation |
| `traceReportService.ts` | `apps/server/src/services/` | Generate individual loan trace HTML/PDF from ledger entries + observations + cross-MDA matches. Compose loan timeline, rate analysis, balance trajectory | `ledgerService`, `observationEngine`, `personMatchingService`, `computationEngine` | Generating reports with accusatory language |

**New routes:**

| Route | Method | Description |
|-------|--------|-------------|
| `/api/observations` | GET | List observations with filters (type, MDA, status, staff) |
| `/api/observations/:id` | PATCH | Update observation status (Unreviewed → Reviewed → Resolved) |
| `/api/observations/:id/promote` | POST | Promote observation to active exception (Epic 7 handoff) |
| `/api/staff/:id/trace` | GET | Get full cross-MDA loan trace for a staff member |
| `/api/staff/:id/trace/report` | GET | Generate individual trace report (HTML/PDF) |
| `/api/migrations/delineate` | POST | Preview MDA boundaries detected within an uploaded file |
| `/api/migrations/deduplicate` | POST | Check for cross-file duplicates before import confirmation |

**Schema additions:**

```sql
-- observations table (auto-generated during migration)
CREATE TABLE observations (
    id UUID PRIMARY KEY,                    -- UUIDv7
    type TEXT NOT NULL,                     -- 'rate_variance' | 'stalled_balance' | 'negative_balance' | 'multi_mda' | 'no_approval_match'
    staff_name TEXT NOT NULL,
    staff_id TEXT,                          -- nullable (not all legacy records have staff ID)
    loan_id UUID REFERENCES loans(id),     -- nullable (observation may span multiple loans)
    mda_id UUID REFERENCES mdas(id),
    description TEXT NOT NULL,             -- factual description
    context JSONB NOT NULL,                -- { possibleExplanations: string[], suggestedAction: string, dataPoints: {...} }
    source_reference JSONB,                -- { file: string, sheet: string, row: number }
    status TEXT NOT NULL DEFAULT 'UNREVIEWED',  -- 'UNREVIEWED' | 'REVIEWED' | 'RESOLVED'
    reviewer_id UUID REFERENCES users(id),
    reviewer_note TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- person_matches table (cross-MDA person linking)
CREATE TABLE person_matches (
    id UUID PRIMARY KEY,                    -- UUIDv7
    person_a_name TEXT NOT NULL,
    person_a_staff_id TEXT,
    person_a_mda_id UUID REFERENCES mdas(id),
    person_a_loan_id UUID REFERENCES loans(id),
    person_b_name TEXT NOT NULL,
    person_b_staff_id TEXT,
    person_b_mda_id UUID REFERENCES mdas(id),
    person_b_loan_id UUID REFERENCES loans(id),
    match_type TEXT NOT NULL,              -- 'exact_name' | 'staff_id' | 'fuzzy_name' | 'manual'
    confidence NUMERIC(3,2) NOT NULL,      -- 0.00 to 1.00
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- migration_extra_fields table (flexible store for non-standard columns)
CREATE TABLE migration_extra_fields (
    id UUID PRIMARY KEY,                    -- UUIDv7
    loan_id UUID NOT NULL REFERENCES loans(id),
    field_name TEXT NOT NULL,              -- canonical field name (e.g., 'employee_no', 'bank_name', 'grade_level')
    field_value TEXT NOT NULL,             -- stored as text, typed at application layer
    source_header TEXT NOT NULL,           -- original column header from Excel (e.g., 'EMPLOYEE NO', 'BANK')
    source_file TEXT NOT NULL,             -- filename
    source_sheet TEXT,                     -- sheet name
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- mda_relationships table (parent/agency hierarchy)
CREATE TABLE mda_relationships (
    id UUID PRIMARY KEY,                    -- UUIDv7
    parent_mda_id UUID NOT NULL REFERENCES mdas(id),
    child_mda_id UUID NOT NULL REFERENCES mdas(id),
    relationship_type TEXT NOT NULL,        -- 'department' | 'agency' | 'unit'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(parent_mda_id, child_mda_id)
);
```

**Cross-cutting concerns affected:**

| Concern | Impact |
|---------|--------|
| Non-punitive vocabulary | `observationEngine.ts` must use templates from `vocabulary.ts`. New observation-specific vocabulary terms added |
| Audit logging | All observation status changes audit-logged. Person match confirmations audit-logged |
| Transaction atomicity | Observation generation is atomic with migration import — if migration fails, no orphan observations created |
| RBAC | Observation review: Department Admin + Super Admin. Individual trace: Department Admin + Super Admin. Person match confirmation: Department Admin + Super Admin |

### 3.3 UX Specification Impact

**Conflicts with existing UX spec:** None. The existing non-punitive design tokens, semantic colours, and language patterns all apply directly to the new components.

**New components required:**

#### ObservationCard (Story 3.6)

```
Purpose: Display a single auto-generated observation with non-punitive framing
Content:
  ┌─────────────────────────────────────────────────┐
  │  ℹ Observation: [Factual description]            │
  │                                                   │
  │  What the data shows:                             │
  │    [Plain English statement of the pattern]       │
  │                                                   │
  │  Context:                                         │
  │    • [Possible explanation 1]                     │
  │    • [Possible explanation 2]                     │
  │    • [Possible explanation 3]                     │
  │                                                   │
  │  Suggested next step:                             │
  │    [Specific, actionable verification step]       │
  │                                                   │
  │  Status: [Unreviewed] [Reviewed] [Resolved]       │
  │                                                   │
  │  Source: [File → Sheet → Row] [View original]     │
  └─────────────────────────────────────────────────┘
Colours: Grey #6B7280 background, Teal #0D7377 info icon, Gold #D4A017 for
         Unreviewed status badge, Green #16A34A for Resolved
Icon: Info circle (ℹ) — NEVER warning triangle
States: Collapsed (summary line), Expanded (full card), Reviewed, Resolved
Actions: Mark as Reviewed, Mark as Resolved (with note), Promote to Exception,
         View Source Record
Variants: Rate Variance, Stalled Balance, Negative Balance, Multi-MDA,
          No Approval Match — each with type-specific template
Accessibility: aria-label="Observation: {type} for {staffName}".
               Status uses aria-live="polite" for screen reader updates.
               NEVER uses role="alert" — observations are informational
```

#### LoanTimeline (Story 3.3)

```
Purpose: Visual horizontal timeline showing loan cycles across MDAs and time
Content: Horizontal bars per loan cycle, colour-coded by MDA. Each bar shows:
         principal, rate, tenure, start/end dates. Gaps between cycles visible.
         Transfer events marked with connecting arrows.
Layout:  Time axis (horizontal) → MDA rows (vertical)
         |--- Justice -------|  gap  |--- Information ------------|
         ₦330K @ 13.33%             ₦485K @ 8.0%
States: Default (all cycles visible), Focused (one cycle highlighted with detail),
        Loading (skeleton bars)
Actions: Click cycle → expand detail. Hover → tooltip with key metrics.
Colours: Each MDA gets a distinct muted colour from the palette. Gaps shown
         as dashed lines. Active cycle uses teal border.
Accessibility: Timeline uses role="img" with aria-label describing the full
               loan history. Each cycle is a focusable element with detail.
```

#### StaffProfilePanel (Story 3.3)

```
Purpose: Person-level view aggregating all loans, observations, and MDA history
Content: Staff name, Staff ID (if available), all known MDAs, total loan cycles,
         current status, LoanTimeline component, observation list, approval
         history, extra fields captured (employee no, dates, etc.)
Layout:  Header (name, IDs, status) → Timeline → Observations → Details
Actions: Generate trace report, review observations, view source records
States: Complete (all data present), Partial (some MDAs missing data),
        Loading (progressive — header first, then timeline, then observations)
Variants: Migration view (during import — focus on observations),
          Operations view (post-migration — focus on current status)
```

#### MasterBeneficiaryLedger (Story 3.5)

```
Purpose: Interactive table of ALL staff with computed fields, sortable/filterable
         Prototype: docs/legacy_cd/output/master-beneficiary-ledger.html
Content: Staff name, primary MDA, loan count, total principal, current balance,
         installments remaining, interest rate, observation count, observation
         types, approval status, multi-MDA indicator
Metrics strip: Total Staff | Total Loans | Observations | Total Exposure
               (Story 3.5 ships with 4 general metrics. Detailed observation-type
               breakdown — Approved, Multi-MDA, Rate Variance, Stalled, Negative —
               deferred to Story 3.6 integration when observation engine is available)
Actions: Sort by any column, filter by MDA, filter by observation type,
         search by name, click row → StaffProfilePanel, export filtered view
States: Default (full table), Filtered (subset visible with filter badges),
        Loading (progressive — metrics strip first, then rows)
Non-punitive: Observation counts shown as neutral badges (grey background,
              teal text), not warning indicators. Column header says
              "Observations" not "Flags" or "Issues"
```

#### IndividualTraceReport (Story 3.7)

```
Purpose: Printable/exportable staff trace report
         Prototype: docs/legacy_cd/output/individual-trace-olaniyan.html
Content: Executive summary, loan cycle details (per cycle: MDA, principal, rate,
         tenure, monthly deduction, balance trajectory), interest rate analysis
         with mathematical verification, netting analysis (if applicable),
         observations with context, cross-MDA transfer timeline
Layout:  Designed for A4 print. Header with staff info, body with sections,
         footer with generation metadata
Actions: Print, export PDF, export HTML, share link
Variants: Full report (all sections), Summary report (executive summary only),
          Comparison report (two staff side-by-side for audit)
```

#### FileDelineationPreview (Story 3.8)

```
Purpose: Show detected MDA boundaries within a file before import confirmation
Content: File name, sheet list, detected MDA sections per sheet with row ranges,
         record counts per detected MDA, colour-coded section markers
Layout:  Sheet tabs → Section list per sheet → Confirm/Reject per section
Actions: Confirm all detected boundaries, adjust boundary (manual override),
         reject file (re-upload), preview records in a section
States: Detected (boundaries found — teal indicator), Ambiguous (boundaries
        unclear — gold attention indicator, needs manual confirmation),
        Confirmed (user confirmed — green), Single-MDA (no delineation needed)
```

**Non-punitive vocabulary extensions** (additions to `packages/shared/src/constants/vocabulary.ts`):

| Context | Approved Term | Prohibited Term |
|---------|--------------|-----------------|
| Auto-detected pattern | "Observation" | "Anomaly", "Flag", "Issue" |
| Record marked for review | "For review" | "Flagged", "Suspect" |
| Needs human verification | "Requires clarification" | "Suspicious", "Questionable" |
| Deductions past zero | "Balance below zero" | "Over-deduction", "Over-payment" |
| No approved list match | "No matching approval record found" | "Unauthorized loan", "Unapproved" |
| Data pattern detected | "Pattern for review" | "Fraud indicator", "Red flag" |
| Badge colour for observations | Amber/Gold (attention) | Red (never for data observations) |
| Observation status | "Unreviewed / Reviewed / Resolved" | "Open / Flagged / Closed" |

**"Three Clicks to Clarity" interaction pattern:**

1. **Click 1 — Dashboard (MasterBeneficiaryLedger):** See the big picture. 2,952 staff. 1,509 observations. Filter by MDA, by observation type. Numbers go DOWN as people review and resolve. Non-punitive metric labels.
2. **Click 2 — Staff Profile (StaffProfilePanel):** Click a name. See complete loan timeline (LoanTimeline). See observations with context and possible explanations (ObservationCard). No accusatory language.
3. **Click 3 — Action:** Mark observation as reviewed, request documentation from MDA, generate trace report (IndividualTraceReport) for AG briefing, or promote to exception (Epic 7 handoff). Every action is audit-logged.

### 3.4 Other Artifacts

| Artifact | Impact | Action Needed |
|----------|--------|---------------|
| `sprint-status.yaml` | Must reflect 8 stories (from 5) | Update after approval |
| `epics.md` | Story definitions must be rewritten | Update after approval — full story definitions below |
| SQ-1 pipeline outputs | Serve as prototypes and test fixtures | Reference in story acceptance criteria |
| `vocabulary.ts` | New observation-specific terms needed | Update during Story 3.6 implementation |
| `db/schema.ts` | 4 new tables needed | Add during Story 3.6/3.8 implementation |

**Key advantage:** Epic 3 is still in `backlog` — no story files created yet, no code written, no migrations generated. This is the ideal time to reshape. Zero rework cost.

---

## 4. Path Forward Evaluation

### 4.1 Option 1: Direct Adjustment (RECOMMENDED)

**Description:** Modify existing Epic 3 stories and add 3 new stories, all in backlog before implementation begins.

**Viability:** YES — straightforward because:
- Epic 3 is in `backlog` — no story files created, no code written
- We're reshaping BEFORE implementation, not mid-sprint
- 2 of 5 existing stories (3.1, 3.2) need scope extension
- 1 story (3.4) stays as-is
- 2 stories (3.3, 3.5) reshape from column-comparison focus to person-level focus
- 3 new stories (3.6, 3.7, 3.8) add capabilities proven by SQ-1 prototypes

**Effort estimate:** Medium
- Stories 3.1, 3.2 (extend): +1-2 days each due to header vocabulary and rate detection
- Story 3.3 (reshape): New — person matching service + timeline UI. ~3-4 days
- Story 3.4 (keep): No change to effort
- Story 3.5 (reshape): +1-2 days for master ledger table
- Story 3.6 (new): Observation engine + templates + review workflow. ~3-4 days. De-risked by SQ-1 prototypes
- Story 3.7 (new): Trace report generation. ~2-3 days. De-risked by individual-trace-olaniyan.html prototype
- Story 3.8 (new): File delineation + deduplication. ~2-3 days. De-risked by SQ-1 CDU analysis

**Risk level:** Low
- No rework of completed stories
- SQ-1 prototypes validate the approach
- Column header vocabulary already catalogued (298 headers)
- Observation templates already designed (Part 9 of lowdown)
- Person matching logic already proven in SQ-1 crossref engine

**[x] Viable — RECOMMENDED**

### 4.2 Option 2: Potential Rollback

**Not applicable.** Epic 3 hasn't started. Nothing to roll back.

**[N/A] Skip**

### 4.3 Option 3: PRD MVP Review (Scope Reduction)

**Description:** Reduce Epic 3 scope to keep it at 5 stories, deferring observations, traces, and deduplication to Phase 2.

**Viability:** Technically viable but NOT recommended because:
- Without observation engine at migration time, 1,509 observations surface as exceptions during daily operations (Epic 7), overwhelming the Department Admin on day one
- Without deduplication, CDU staff are double-counted in every aggregate metric from day one — the AG's headline numbers are wrong
- Without cross-MDA matching, the same person appears as unrelated records — the "full picture" promise of VLPRS is broken
- Without extra field capture at import time, the data is permanently lost (spreadsheets are not re-uploaded)

**Effort estimate:** Low (keep current scope)
**Risk level:** HIGH (silent data quality problems from day one, permanently lost extra field data)

**[x] Not recommended**

### 4.4 Selected Approach

**Option 1: Direct Adjustment**

**Rationale:**
1. **Zero rework cost** — Epic 3 is in backlog, no story files or code exist
2. **SQ-1 prototypes de-risk new stories** — working HTML prototypes, proven algorithms, catalogued data
3. **Observation engine feeds downstream epics** — Epic 4 (dashboard attention items) and Epic 7 (exception management) both consume observation data
4. **Cross-MDA matching prevents silent data quality problems** — without it, 425 staff appear as unrelated records and CDU is double-counted
5. **Extra field capture is now-or-never** — if not captured at migration time, the data is permanently lost. Spreadsheets won't be re-uploaded
6. **Stronger day-one experience** — the AG opens VLPRS and sees intelligence, not just uploaded numbers

---

## 5. Detailed Change Proposals

### Story 3.1: Legacy Upload & Intelligent Column Mapping (EXTEND)

**OLD scope (FR25):**
- Upload .xlsx or .csv (up to 10MB / 500 rows)
- Present column-mapping interface showing detected source columns
- Admin maps each source column to required VLPRS fields
- Process file using mapping in <15 seconds for ~50 records
- Atomic upload — all rows processed or none

**NEW scope (FR25 + FR89):**
All of the above PLUS:
- **Auto-detect source columns** from 298+ known header variants. System maintains a `headerVocabulary` mapping (e.g., "BAL B/F" → outstanding_balance, "EMPLOYEE NO" → staff_id, "TAVS COMMENCEMENT DATE" → commencement_date). Admin sees pre-mapped suggestions and only needs to confirm or override
- **Handle 4 format eras** — Pre-2018 (minimal columns, no standard template), 2018-2020 (standardising, has Employee No / TAVS Commencement Date), 2020-2023 (CDU standardised template, mostly consistent), 2023+ (current template with START DATE / END DATE, most likely to contain DOB / appointment date). Each era has different column order, naming, and available fields
- **Capture ALL available fields** including non-standard extras. Required fields: staff name, principal, outstanding balance, interest rate, tenure, monthly deduction. Optional extra fields: employee number, appointment dates, commencement dates, bank details, grade level, step, station, reference ID, start/end dates, department. No data is discarded — extra fields stored in `migration_extra_fields` table
- **MDA selection with parent/agency awareness** — when selecting target MDA, system shows parent/agency relationships. If uploading an Agriculture file, system asks "Does this file contain records for sub-agencies (e.g., CDU)?" to trigger delineation flow (Story 3.8)

**Rationale:** The original story assumed a known, consistent column structure. SQ-1 proved 298 header variants exist across 4 format eras. Auto-detection reduces MDA officer effort from manual mapping to confirm-and-go. Extra field capture preserves historical data that would otherwise be permanently lost.

---

### Story 3.2: Migration Validation, Rate Detection & MDA Delineation (EXTEND)

**OLD scope (FR26):**
- Validate each record against the computation engine
- Categorise as: Clean, Minor Variance (<₦500), Significant Variance (₦500-₦50,000), Structural Error (wrong rate/formula), Anomalous (unexplainable)
- Summary shows count and percentage per category
- Non-punitive language throughout

**NEW scope (FR26 + partial FR87 + partial FR89):**
All of the above PLUS:
- **Interest rate computation & variance detection** — For each record, compute the effective interest rate from (total loan amount - principal) / principal. Compare against the standard 13.33%. If different, classify the rate and check against known rate tiers (6.67%, 8.0%, 8.89%, 10.66%, 11.11%, 13.33%). Flag record with `has_rate_variance` for observation engine (Story 3.6)
- **Intra-file MDA detection** — Scan for MDA column markers within sheets (e.g., "COCOA DEVELOPMENT UNIT" in a column mid-sheet). Store detected boundaries; full FileDelineationPreview UI deferred to Story 3.8

**Accepted scope distribution (validated 2026-03-06):** Cross-MDA person detection → Story 3.3 (requires personMatchingService). Balance trajectory analysis (stalled/negative) → Story 3.6 (observation engine). Full observation record creation → Story 3.6. File delineation UI → Story 3.8. Story 3.2 detects and flags; downstream stories act on the flags.

**Variance thresholds (updated 2026-03-06):** Clean (<₦1 sub-kobo rounding), Minor Variance (₦1-₦499), Significant Variance (≥₦500), Structural Error (rate not in any known tier), Anomalous (no pattern). All variances ≥₦1 are surfaced — nothing hidden.

**Rationale:** The original story validated individual records against the computation engine. SQ-1 proved that cross-record analysis (rate patterns, cross-MDA matching, balance trajectories) is equally important. Detection is split across stories by service ownership: validation flags in 3.2, person matching in 3.3, observation creation in 3.6, delineation UI in 3.8.

---

### Story 3.3: Staff Loan Profile & Cross-MDA Timeline (RESHAPE)

**OLD scope (FR27):**
Side-by-side comparison of MDA-declared values vs system-computed values with mathematical explanation. ComparisonPanel component.

**NEW scope (FR27 + new person-level view):**
The side-by-side comparison capability (ComparisonPanel) remains — it's still needed for individual record variance display. But the story's PRIMARY focus shifts to:

- **Staff Loan Profile (StaffProfilePanel)** — Person-level view aggregating all loans, observations, and MDA history for a single staff member. Shows: name, Staff ID (if available), all known MDAs, total loan cycles, current status, extra fields captured (employee no, dates, etc.)
- **Loan Timeline (LoanTimeline)** — Visual horizontal timeline showing loan cycles across MDAs and time. Each cycle shown as a bar with: principal, rate, tenure, MDA. Gaps between cycles visible. Transfer events marked
- **Cross-MDA linking** — Uses `personMatchingService` to link records across MDAs. Shows confidence score for each match. Department Admin can confirm/reject matches
- **Cycle detection** — Automatic detection of loan cycles: new loan starts (balance jump), loan completions (balance reaches zero), MDA transfers (same person appears in new MDA)

**Rationale:** The original story was about comparing two columns of numbers. SQ-1's OLANIYAN case study proved that the real insight comes from connecting records across MDAs and time into a person-level story. The ComparisonPanel is retained as a sub-component but the story is now person-centric, not spreadsheet-centric.

---

### Story 3.4: Baseline Acknowledgment & Ledger Entry Creation (KEEP)

**Scope unchanged (FR28, FR29):**
- Department Admin clicks "Accept as Declared — Establish Baseline"
- Summary ledger entry of type `MIGRATION_BASELINE` created in immutable ledger
- Variance recorded as metadata on baseline entry
- No retroactive corrections applied — baseline reflects what MDA declared

**Minor addition:**
- Baseline acknowledgment now also includes acknowledging any observations attached to the record. When a record has observations (rate variance, stalled balance, etc.), the acknowledgment screen shows them with the ObservationCard component. Department Admin can review observations before or after baseline creation. Observations are NOT blockers — baseline can be created regardless of observation status.

**Note — ObservationCard timing:** At the Story 3.4 point in the pipeline, the Observation Engine (Story 3.6) has not yet run. The acknowledgment screen shows **variance data from Story 3.2** (variance category, computed vs declared values) directly — not ObservationCard components. ObservationCard becomes available after Story 3.6 creates formal observation records. Story 3.4's UI shows a variance summary panel, not the full ObservationCard.

**Rationale:** The core story is unchanged. The minor addition ensures variance data is visible during the acknowledgment workflow, not hidden until a later discovery.

---

### Story 3.5: Migration Dashboard & Master Beneficiary Ledger (RESHAPE)

**OLD scope (FR30, FR31):**
Migration dashboard at `/migration` route showing all 63 MDAs with pipeline status: Pending, Received, Imported, Validated, Reconciled, Certified. MigrationProgressCard per MDA. Overall progress indicator.

**NEW scope (FR30, FR31 + master ledger):**
All of the above PLUS:
- **Master Beneficiary Ledger (MasterBeneficiaryLedger)** — Interactive table of ALL staff imported across all MDAs. Prototype: `docs/legacy_cd/output/master-beneficiary-ledger.html`. Columns: staff name, primary MDA, loan count, total principal, current balance, installments remaining, interest rate, observation count, observation types, approval status, multi-MDA indicator
- **Metrics strip** — Total staff | Approved | Multi-MDA | Rate Variance | Stalled | Negative | With Observations. Numbers update as observations are reviewed and resolved
- **Filter/sort/search** — Filter by MDA, observation type, approval status. Sort by any column. Search by name. Click row → StaffProfilePanel (Story 3.3)
- **Export** — Export filtered view as CSV for offline analysis

**Rationale:** The original MDA-level migration dashboard is still needed for tracking the 63-MDA import marathon. But SQ-1 proved that a person-level master view is equally essential — Awwal's exact words: *"I believe we will need to create a table of all beneficiaries so that from this full pool we can sort, filter and analyse a particular individual across multiple MDAs."*

---

### Story 3.6: Observation Engine & Review Workflow (NEW)

**Scope (FR87):**

As a **Department Admin**,
I want the system to automatically generate non-punitive observations during migration with context, possible explanations, and suggested actions,
So that I can prioritise investigations based on data patterns without being overwhelmed by raw variance numbers.

**Acceptance Criteria:**

**Given** a completed migration import (Story 3.1 + 3.2)
**When** the system processes the imported records
**Then** observations are auto-generated for each detected pattern:
- **Rate Variance** — effective rate differs from standard 13.33%
- **Stalled Balance** — balance unchanged for 3+ consecutive months
- **Negative Balance** — balance below zero (over-deduction)
- **Multi-MDA** — staff has records in 2+ MDAs
- **No Approval Match** — active deductions but not on approved beneficiary lists
- **Consecutive Loan Without Clearance** — new loan commenced while prior loan has outstanding balance (non-punitive framing)

**Given** an auto-generated observation
**When** Department Admin views it
**Then** the ObservationCard displays: factual description, what the data shows (plain English), context with 2-3 possible explanations, suggested next step, status badge (Unreviewed/Reviewed/Resolved), source reference (file → sheet → row)
**And** all language complies with non-punitive vocabulary
**And** the icon is info circle (ℹ) in teal — NEVER warning triangle
**And** the background is neutral grey — NEVER red or amber

**Given** an observation in "Unreviewed" status
**When** Department Admin clicks "Mark as Reviewed"
**Then** status changes to "Reviewed" with reviewer name and timestamp
**And** the reviewer can optionally add a note

**Given** an observation in "Reviewed" status
**When** Department Admin clicks "Mark as Resolved"
**Then** status changes to "Resolved" with resolution note (required)
**And** the observation counter on the master ledger decrements

**Given** an observation that requires operational follow-up
**When** Department Admin clicks "Promote to Exception"
**Then** the observation creates a linked exception record (Epic 7 handoff)
**And** the observation status changes to "Promoted"

**Observation templates (from SQ-1 analysis):**

**Rate Variance:** *"This loan's total interest is {rate}% ({interestAmount} on {principal}), which differs from the standard 13.33%. This is consistent with a {tenure}-installment repayment plan. Possible explanations: different approved tenure, GL-level based rate tier, administrative adjustment. Verify against loan application records."*

**Stalled Balance:** *"Outstanding balance has remained at {amount} for {count} consecutive months ({startMonth}–{endMonth}). Possible explanations: salary deduction suspension, administrative hold, data entry lag. Confirm with MDA payroll records."*

**Negative Balance:** *"Balance reached {amount} (below zero) in {period}, suggesting deductions continued after loan completion. An estimated {overAmount} may be due for refund. Possible explanations: delayed stop-deduction processing, timing difference between payroll and loan records. Verify deduction stop date."*

**Multi-MDA:** *"This staff member has loan records across {count} MDAs ({mdaList}). This typically indicates an inter-MDA transfer. Verify transfer documentation and confirm loan continuity."*

**No Approval Match:** *"This staff member has active deduction records but does not appear on the loaded approved beneficiary lists. Possible explanations: approved on an earlier list not yet uploaded, name variance between list and records, legacy loan predating current approval process. Cross-check with MDA loan files."*

---

### Story 3.7: Individual Trace Report Generation (NEW)

**Scope (FR88):**

As a **Department Admin**,
I want to generate a complete loan history report for any individual staff member showing all loans across all MDAs and time periods,
So that I can brief the AG or PS with a single document that tells the full story of a person's borrowing history.

**Acceptance Criteria:**

**Given** a staff member with records in the system
**When** Department Admin clicks "Generate Trace Report" from the StaffProfilePanel
**Then** the system generates a report containing:
- Executive summary (name, Staff ID, MDAs, total loan cycles, current status)
- Per-cycle detail (MDA, principal, total loan, interest rate, tenure, monthly deduction, balance trajectory, start/end dates)
- Interest rate analysis with mathematical verification (principal × rate = expected total; actual total; match/variance)
- Balance trajectory (month-by-month if data available)
- Observations attached to each cycle with context
- Cross-MDA transfer timeline (if applicable)
- Approval list cross-reference (which approved lists the staff appeared on)
- Source file references for each data point

**Given** the generated report
**When** Department Admin exports it
**Then** it is available as HTML (viewable in browser) and PDF (printable, A4-formatted)
**And** the report header includes generation timestamp, generating user, and a note: "Generated from legacy data migration records"

**Prototype reference:** `docs/legacy_cd/output/individual-trace-olaniyan.html`

---

### Story 3.8: Multi-MDA File Delineation & Deduplication (NEW)

**Scope (FR88):**

As a **Department Admin**,
I want the system to detect when a single uploaded file contains records from multiple MDAs, and to detect when the same staff appears in both a parent MDA file and a sub-agency file,
So that records are correctly attributed to MDAs and staff are not double-counted in scheme-wide metrics.

**Acceptance Criteria:**

**Given** an uploaded migration file
**When** the system detects MDA column markers mid-sheet (e.g., "COCOA DEVELOPMENT UNIT" in a column that otherwise contains staff data)
**Then** the FileDelineationPreview shows: detected MDA sections per sheet, row ranges per section, record counts per detected MDA
**And** Department Admin confirms or adjusts the detected boundaries before import proceeds

**Given** confirmed MDA boundaries within a file
**When** the import processes
**Then** each record is attributed to the correct MDA based on its position relative to the boundaries
**And** the migration dashboard shows separate entries for each MDA found in the file

**Given** a staff member who appears in both a parent MDA file and a sub-agency file
**When** the system detects the duplication (name match + MDA relationship)
**Then** it flags a "Potential Duplicate" observation with: both source files, both MDA attributions, and recommended resolution (keep sub-agency record, mark parent record as duplicate)
**And** Department Admin resolves the duplication before the duplicate inflates aggregate metrics

**Given** the MDA registry
**When** Department Admin configures parent/agency relationships (e.g., CDU is a department under Agriculture)
**Then** the system uses these relationships to inform deduplication logic during all future imports

**Known patterns from SQ-1 analysis:**
- CDU records in ALL Agriculture files (2018–2025), identified by "COCOA DEVELOPMENT UNIT" in Column 3 (MDA column)
- CDU also submitted 8 independent files
- AANFE has "LPC OUT TO TREE CROPS" remark (transfer tracking between CDU, Agriculture, AANFE, and Finance)

---

## 6. Implementation Handoff

### 6.1 Change Scope Classification

**MODERATE** — Requires backlog reorganisation and story redefinition, but no rollback of completed work and no fundamental architectural change.

### 6.2 Handoff Responsibilities

| Role | Agent | Responsibility | When |
|------|-------|---------------|------|
| **PM (John)** | PM Agent | Update PRD with FR86-FR89. Reshape Epic 3 story definitions in epics.md. Verify acceptance criteria completeness | After approval |
| **Architect (Winston)** | Architect Agent | Add observationEngine, personMatching, fileDelineation, traceReport services to architecture.md. Define schema for observations, person_matches, migration_extra_fields, mda_relationships tables. Define API routes. Review cross-cutting concerns | After PM updates |
| **UX (Sally)** | UX Agent | Add ObservationCard, LoanTimeline, StaffProfilePanel, MasterBeneficiaryLedger, IndividualTraceReport, FileDelineationPreview to UX spec. Extend non-punitive vocabulary. Define "Three Clicks to Clarity" interaction pattern | After PM updates |
| **SM (Bob)** | SM Agent | Update sprint-status.yaml (5 → 8 stories). Create story files for 3.1-3.8 when sprint reaches Epic 3. Incorporate SQ-1 prototypes as acceptance criteria references | After all artifact updates |
| **Dev (Amelia)** | Dev Agent | Implement stories using SQ-1 pipeline code as reference. Key reusable SQ-1 code: column header detection logic, person name matching, rate computation, CDU delineation patterns | During Sprint 5 |
| **QA (Quinn)** | QA Agent | Test observation generation accuracy, cross-MDA matching precision, deduplication correctness, non-punitive language compliance | During Sprint 5 |

### 6.3 SQ-1 Assets Available for Reuse

| SQ-1 Asset | Reusable For | Notes |
|------------|-------------|-------|
| `scripts/legacy-report/crossref.ts` — MDA_CODE_MAP (45 entries) | Story 3.1 — header vocabulary and MDA name resolution | Production code needs error handling, but the mappings are verified |
| `scripts/legacy-report/utils/mda-resolve.ts` — 5-layer MDA resolution | Story 3.2 — MDA name normalisation during validation | Algorithm proven across 122 files |
| SQ-1 rate computation logic | Story 3.2 / 3.6 — interest rate detection | Formula: (totalLoan - principal) / principal × 100 = effective rate |
| SQ-1 person matching (name + MDA) | Story 3.3 — cross-MDA person matching | Basic exact match + suffix stripping. Production version needs fuzzy matching |
| SQ-1 CDU delineation detection | Story 3.8 — intra-file MDA detection | Column 3 marker pattern. Production version needs generalisation beyond CDU |
| `docs/legacy_cd/output/master-beneficiary-ledger.html` | Story 3.5 — master ledger prototype | Working HTML with sort/filter/search. Use as acceptance criteria reference |
| `docs/legacy_cd/output/individual-trace-olaniyan.html` | Story 3.7 — trace report prototype | Working HTML with full loan history. Use as acceptance criteria reference |
| `docs/legacy_cd/output/analysis.json` | Test fixtures | Cross-reference data for integration testing |
| `docs/legacy_cd/output/catalog.json` | Test fixtures | Parsed file catalog for integration testing |

### 6.4 Success Criteria

1. All 63 MDAs importable with correct MDA attribution (including multi-MDA files)
2. Extra fields captured from 6+ MDAs — zero data loss
3. Observations auto-generated with non-punitive language — The MDA Officer Test: "Would an MDA officer feel defensive looking at this?" Answer must be NO
4. Cross-MDA matches detected for 425+ staff with confidence scores
5. CDU/Agriculture dual-submission deduplicated — zero double-counting
6. Individual trace reports generatable for any staff member
7. Master beneficiary ledger supports sort/filter/search across all imported staff
8. Observation review workflow: Unreviewed → Reviewed → Resolved, with audit trail
9. All observation templates comply with vocabulary.ts non-punitive terms

### 6.5 Open Questions for Resolution During Implementation

These questions were surfaced during SQ-1 analysis and need answers from the PO/stakeholders before or during Epic 3 implementation:

1. **Interest rate determination logic:** What determines which rate a beneficiary receives? Is it tenure-based (36 installments = 8%, 50 = 13.33%, 60 = 13.33%), GL-level-based, or determined at time of approval? This affects the observation engine's rate variance detection — we need to know what's "expected" vs what's "variant." SQ-1 data shows 6+ distinct rates but the correlation is not fully understood.

2. **Prior balance handling at new loan disbursement:** How is a prior loan balance handled when a new loan is approved? The OLANIYAN case shows interest charged on full approved amount (₦450,000), not net amount (₦450,000 - ₦80,993). Is this standard policy? Is the old balance netted from cash disbursement, settled via final deductions, or written off?

3. **Stalled deduction root cause:** Why do deductions stall? OLANIYAN's balance was frozen Oct–Dec 2025 (₦364,491 unchanged for 3 months). 203 other staff show similar patterns. Is this a payroll issue, administrative hold, or reporting lag? The answer affects how the observation engine frames the "suggested next step."

4. **CDU organisational status:** Should CDU be modelled as a sub-MDA of Agriculture, or as an independent MDA that happens to share data? This affects the MDA registry's parent/agency relationship model and how the deduplication logic works.

5. **Missing MDAs (31 of 63):** The 31 MDAs with zero files on the CD — were files never submitted to the scheme, or simply not included on this particular CD? This affects migration completeness tracking. The dashboard shows "X of 63 MDAs complete" but if 31 never had data, the denominator may be wrong.

6. **Person matching confidence threshold:** For cross-MDA matching, what confidence level should auto-match vs require manual confirmation? Exact name + same Staff ID = auto-match. Exact name + different MDA + no Staff ID = suggest match but require confirmation. Fuzzy name = always require confirmation. PO should validate these thresholds.

7. **Observation → Exception promotion criteria:** When should an observation be promoted to an active exception (Epic 7)? All unresolved observations after migration certification? Only specific types? PO should define the promotion rules.

---

## 7. Summary

### Before (Current Epic 3)

| # | Story | FRs |
|---|-------|-----|
| 3.1 | Legacy Spreadsheet Upload & Column Mapping | FR25 |
| 3.2 | Migration Validation & Variance Categorisation | FR26 |
| 3.3 | Side-by-Side Comparison with Mathematical Explanation | FR27 |
| 3.4 | Baseline Acknowledgment & Ledger Entry Creation | FR28, FR29 |
| 3.5 | Migration Dashboard & MDA Status Tracking | FR30, FR31 |
| — | *FR85 (Beneficiary Cross-Reference) listed but no dedicated story* | FR85 |
| **Total** | **5 stories** | **8 FRs** |

### After (Proposed Epic 3)

| # | Story | Change | FRs |
|---|-------|--------|-----|
| 3.1 | Legacy Upload & Intelligent Column Mapping | EXTEND | FR25, FR89 |
| 3.2 | Migration Validation, Rate Detection & MDA Delineation | EXTEND | FR26, partial FR86, partial FR88 |
| 3.3 | Staff Loan Profile & Cross-MDA Timeline | RESHAPE | FR27 (retained) + person matching |
| 3.4 | Baseline Acknowledgment & Ledger Entry Creation | KEEP | FR28, FR29 |
| 3.5 | Migration Dashboard & Master Beneficiary Ledger | RESHAPE | FR30, FR31 + master ledger |
| 3.6 | Observation Engine & Review Workflow | **NEW** | FR86, FR85 |
| 3.7 | Individual Trace Report Generation | **NEW** | FR87 |
| 3.8 | Multi-MDA File Delineation & Deduplication | **NEW** | FR88 |
| **Total** | **8 stories** | **+3 new** | **12 FRs** |

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Scope increase delays Sprint 5 | Medium | SQ-1 prototypes de-risk new stories. Parallel story execution possible (3.6/3.7/3.8 are independent of each other) |
| Person matching produces false positives | Low | Confidence scoring + manual confirmation for non-exact matches |
| Observation volume overwhelms Department Admin | Low | Observations are non-blocking. Batch review workflow. Filter/sort by type |
| CDU delineation pattern doesn't generalise | Low | Start with known CDU pattern, generalise as more multi-MDA files are discovered |
| Extra field storage grows large | Low | Flexible key-value schema. Only populated for MDAs that provide extras |

### Approval Request

This Sprint Change Proposal reshapes Epic 3 from 5 stories (data plumbing) to 8 stories (data intelligence) based on evidence from SQ-1 Legacy CD Analysis. The change is LOW RISK (Epic 3 is in backlog — zero rework), MEDIUM EFFORT (3 new stories de-risked by prototypes), and POSITIVE MVP IMPACT (smarter migration = better day-one AG experience).

**Awaiting Product Owner approval to proceed with artifact updates.**
