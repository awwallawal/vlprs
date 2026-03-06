# Story 3.3: Staff Loan Profile & Cross-MDA Timeline

Status: done

<!-- Generated: 2026-03-06 | Epic: 3 | Sprint: 5 -->
<!-- Blocked By: 3-2-migration-validation-rate-detection-mda-delineation | Blocks: 3-4-baseline-acknowledgment-ledger-entry-creation, 3-5-migration-dashboard-master-beneficiary-ledger, 3-7-individual-trace-report-generation -->
<!-- FRs: FR27, partial FR88 | Motivation: Person-level view — connects records across MDAs into unified profiles -->
<!-- Source: epics.md § Epic 3 Story 3.3, sprint-change-proposal-2026-02-28.md § Story 3.3 RESHAPE -->

## Story

As a **Department Admin**,
I want to see a person-level view of each staff member's complete loan history across all MDAs with a visual timeline,
So that I can understand cross-MDA patterns and make informed baseline decisions.

### Context

SQ-1 discovered that **425 of 2,952 staff (14.4%) have records in 2+ MDAs**. Without person matching, the same individual appears as unrelated records in different MDAs, making scheme-wide analysis impossible. This story introduces the first person-level view in VLPRS.

**What changed (from sprint change proposal):** The original Story 3.3 was a side-by-side comparison panel for declared vs computed values. SQ-1's OLANIYAN case study proved that the real insight comes from connecting records across MDAs and time into a person-level story. The story was reshaped from spreadsheet-centric to person-centric.

**What this story builds on:**
- Story 3.1 created `migration_records` with 24 canonical fields per extracted row
- Story 3.2 added `variance_category`, `computed_rate`, and `has_rate_variance` to each record
- Story 3.0b added CDU parent/agency relationship (CDU staff may appear in both Agriculture and CDU)

**What this story does NOT do:**
- Does NOT generate observations (Story 3.6 — observation engine)
- Does NOT create baseline ledger entries (Story 3.4 — baseline acknowledgment)
- Does NOT generate trace reports (Story 3.7 — individual trace)
- Does NOT handle file delineation split/reassignment (Story 3.8 — multi-MDA delineation)

**SQ-1 person matching pattern:** The SQ-1 pipeline (`crossref.ts`) builds person timelines keyed by `${mdaCode}:${normalizeName(name)}`. Cross-MDA detection finds normalized names appearing under 2+ MDA codes. The `name-match.ts` utility provides 3-level matching: exact → surname+initial → Levenshtein ≤2.

## Acceptance Criteria

### AC 1: Staff Profile Panel

**Given** migrated records for a staff member
**When** Department Admin clicks on the staff member from any list view
**Then** a StaffProfilePanel displays:
- **Header:** staff name, Staff ID (employee_no if available), current MDA, total migration records across all MDAs, total variance count (from Story 3.2's `variance_category`)
- **LoanTimeline:** horizontal timeline showing loan presence across MDAs and time, colour-coded by MDA, with gap visualisation
- **Loan details list:** each migration record showing MDA name, declared values, system-computed values (from Story 3.2), variance category, and ComputationTransparencyAccordion (FR27)
- **Profile completeness:** amber indicator if DOB or dateOfFirstAppointment is missing ("Profile Incomplete — temporal fields required for retirement computation")

### AC 2: Cross-MDA Person Matching

**Given** a staff member appearing in records from 2+ MDAs
**When** the personMatchingService processes migration data
**Then**:
- Records are matched by Staff ID (exact — highest confidence) or by name:
  - Exact normalized name match across MDAs → auto-match (confidence: 1.0)
  - Surname + first initial match → high confidence (0.8), suggested for review
  - Fuzzy match (Levenshtein ≤ 2) → medium confidence (0.6), requires manual confirmation
- Matches are stored in the `person_matches` table with confidence scores
- The StaffProfilePanel shows the cross-MDA loan history unified under one person view
- Department Admin can confirm or reject suggested matches

### AC 3: Computation Transparency

**Given** the StaffProfilePanel
**When** Department Admin reviews the person-level view
**Then** each loan record shows: MDA name, declared values, system-computed values, variance category, and a ComputationTransparencyAccordion that displays:
- Mathematical formula: "Principal × Rate / 100 = Interest"
- Declared vs computed comparison for totalLoan, monthlyDeduction, outstandingBalance
- Rate analysis: detected rate vs standard 13.33% (if applicable)
- Data completeness indicator showing which fields were available vs missing
**And** variance explanations use approved vocabulary ("Administrative variance" not "Calculation error")

### AC 4: Person Matching API

**Given** migration data from one or more uploads
**When** person matching is triggered (manually via `POST /api/migrations/match-persons` or automatically after validation)
**Then** the system:
- Scans all migration_records across all MDA uploads
- Groups records by normalized staff name per MDA
- Identifies cross-MDA name matches with confidence scoring
- Stores results in `person_matches` table
- Returns summary: total persons found, multi-MDA persons count, auto-matched count, pending-review count

### AC 5: Staff Profile API

**Given** a validated migration upload
**When** the client requests `GET /api/migrations/persons` or `GET /api/migrations/persons/:personKey`
**Then** the response includes:
- Person list: `{ personKey, staffName, staffId?, mdas: string[], recordCount, varianceCount, hasRateVariance, profileComplete }`
- Person detail: complete migration records grouped by MDA, sorted by period, with computed values and variance data
- Cross-MDA matches: linked persons with confidence scores and confirmation status
- Paginated, filterable by MDA, sortable by name/record count/variance count

### AC 6: Integration Tests

**Given** the person matching and staff profile features
**When** integration tests run
**Then** at minimum:
- Test: exact name match across 2 MDAs creates person_match with confidence 1.0
- Test: surname+initial match across MDAs creates person_match with confidence 0.8
- Test: fuzzy match (Levenshtein ≤ 2) creates person_match with confidence 0.6
- Test: Staff ID match across MDAs creates person_match with match_type 'staff_id'
- Test: person profile aggregates records across MDAs with correct counts
- Test: variance data from Story 3.2 appears in person profile
- Test: profile completeness indicator reflects DOB/appointment field presence

## Tasks / Subtasks

- [x] Task 1: Database schema — person_matches table (AC: 2, 4)
  - [x] 1.1 Add `person_matches` table to `apps/server/src/db/schema.ts`:
    - id (UUIDv7 PK)
    - person_a_name (text NOT NULL)
    - person_a_staff_id (text nullable)
    - person_a_mda_id (uuid FK→mdas)
    - person_b_name (text NOT NULL)
    - person_b_staff_id (text nullable)
    - person_b_mda_id (uuid FK→mdas)
    - match_type (text NOT NULL — 'exact_name' | 'staff_id' | 'surname_initial' | 'fuzzy_name' | 'manual')
    - confidence (numeric(3,2) NOT NULL — 0.00 to 1.00)
    - status (text NOT NULL — 'auto_confirmed' | 'pending_review' | 'confirmed' | 'rejected', default 'pending_review')
    - confirmed_by (uuid FK→users, nullable)
    - confirmed_at (timestamptz nullable)
    - created_at (timestamptz NOT NULL DEFAULT NOW())
  - [x] 1.2 Add index on `(person_a_mda_id)` and `(person_b_mda_id)` for cross-MDA queries
  - [x] 1.3 Add `matchTypeEnum` pgEnum: `['exact_name', 'staff_id', 'surname_initial', 'fuzzy_name', 'manual']`
  - [x] 1.4 Add `matchStatusEnum` pgEnum: `['auto_confirmed', 'pending_review', 'confirmed', 'rejected']`
  - [x] 1.5 Run `drizzle-kit generate` to produce migration SQL
  - [x] 1.6 Verify migration SQL is correct and reversible

- [x] Task 2: Port SQ-1 name matching to server (AC: 2)
  - [x] 2.1 Create `apps/server/src/migration/nameMatch.ts` — port `scripts/legacy-report/utils/name-match.ts`:
    - `normalizeName(raw)` — uppercase, trim, collapse whitespace, strip honorifics (MRS, DR, CHIEF, ALHAJI, etc.), strip parenthetical notes like "(LATE)", strip trailing punctuation
    - `matchName(query, candidate)` — 3-level: exact → surname+initial → Levenshtein ≤2
    - `buildNameIndex(records)` — MDA-grouped name index for efficient lookup
    - `searchName(query, mdaCode, index)` — search within MDA in index
  - [x] 2.2 Add `levenshtein(a, b)` — edit distance (port from SQ-1, optimized for short strings with early exit when length diff > 3)
  - [x] 2.3 Add `surnameAndInitial(normalized)` — extract "SURNAME F" pattern for level 2 matching
  - [x] 2.4 Ensure all TITLE_PATTERNS from SQ-1 are preserved: MR/MRS/MISS/DR/CHIEF/ALHAJI/ALHAJA/ALH/PRINCE/PRINCESS/ENGR/ARC/PROF/BARR/HON/COMRADE/COL/GEN/CAPT/PASTOR/REV/ELDER/DEACON/DEACONESS/OTUNBA/BAALE (note: SQ-1 uses regex `ALHAJ[IA]` to match both ALHAJI and ALHAJA)
  - [x] 2.5 Write unit tests: exact match, surname+initial match, fuzzy match, title stripping, parenthetical removal, edge cases (empty string, single-word name)

- [x] Task 3: Person matching service (AC: 2, 4)
  - [x] 3.1 Create `apps/server/src/services/personMatchingService.ts`:
    - `runPersonMatching(mdaScope?)` — scan all migration_records, detect cross-MDA matches
    - `confirmMatch(matchId, userId)` — admin confirms a pending match
    - `rejectMatch(matchId, userId)` — admin rejects a pending match
    - `getMatchesForPerson(personKey, mdaScope)` — get all cross-MDA matches for a person
  - [x] 3.2 Implement cross-MDA detection algorithm:
    - Query all migration_records, group by normalized name
    - For each name appearing in 2+ MDAs, create person_match entries
    - Staff ID matching: if same employee_no in different MDAs → match_type 'staff_id', confidence 1.0
    - Exact name: same normalized name → match_type 'exact_name', confidence 1.0, status 'auto_confirmed'
    - Surname+initial: matching surname + first character of given name → match_type 'surname_initial', confidence 0.8, status 'pending_review'
    - Fuzzy: Levenshtein ≤ 2 → match_type 'fuzzy_name', confidence 0.6, status 'pending_review'
  - [x] 3.3 De-duplicate: don't create duplicate person_matches for the same person pair
  - [x] 3.4 Handle CDU/Agriculture cross-posting: CDU staff appearing in Agriculture files should match against CDU uploads (parent/agency awareness via Story 3.0b's `parent_mda_id`)
  - [x] 3.5 Write unit + integration tests for cross-MDA detection

- [x] Task 4: Staff profile service (AC: 1, 3, 5)
  - [x] 4.1 Create `apps/server/src/services/staffProfileService.ts`:
    - `listPersons(filters, pagination, mdaScope)` — paginated list of persons derived from migration_records, grouped by normalized name
    - `getPersonProfile(personKey, mdaScope)` — full profile with migration records, computed values, variance data, cross-MDA matches
    - `getPersonTimeline(personKey, mdaScope)` — timeline data: month-by-month presence per MDA with financial snapshots
  - [x] 4.2 **Person key**: `${mdaCode}:${normalizedName}` (same pattern as SQ-1 timelines). For cross-MDA views, the primary key is the normalized name; MDA-specific views use the composite key
  - [x] 4.3 **Person list query**: SELECT DISTINCT normalized staff name, group by name, aggregate: MDA count, record count, variance count (non-'clean'), has_rate_variance (any true), profile_complete (DOB + appointment both present)
  - [x] 4.4 **Person profile query**: JOIN migration_records with migration_uploads (for MDA context), LEFT JOIN person_matches. Include computed_rate, variance_category, variance_amount from Story 3.2
  - [x] 4.5 **Timeline builder**: Port SQ-1's `buildTimelines()` pattern — for each person, collect monthly snapshots sorted chronologically, compute firstSeen/lastSeen/gapMonths/totalMonthsPresent. Detect loan cycles: new principal value = new cycle start, balance ≤ 0 = cycle end
  - [x] 4.6 Write integration tests for profile aggregation and timeline computation

- [x] Task 5: Shared types and validation schemas (AC: all)
  - [x] 5.1 Add to `packages/shared/src/types/migration.ts`:
    - `PersonMatch` type: id, personAName, personAStaffId, personAMdaId, personBName, personBStaffId, personBMdaId, matchType, confidence, status, confirmedBy, confirmedAt, createdAt
    - `MatchType`: 'exact_name' | 'staff_id' | 'surname_initial' | 'fuzzy_name' | 'manual'
    - `MatchStatus`: 'auto_confirmed' | 'pending_review' | 'confirmed' | 'rejected'
    - `PersonListItem`: personKey, staffName, staffId?, mdas, recordCount, varianceCount, hasRateVariance, profileComplete
    - `PersonProfile`: staffName, staffId?, mdas, records (grouped by MDA with variance data), matches, timeline
    - `PersonTimelineEntry`: year, month, mdaCode, outstandingBalance, monthlyDeduction, principal, totalLoan, sourceFile
    - `PersonTimeline`: name, mdaCode, months[], firstSeen, lastSeen, totalMonthsPresent, gapMonths (mirrors SQ-1's PersonTimeline interface)
    - `LoanCycle`: mdaCode, startPeriod, endPeriod, principal, rate, monthsPresent, gapMonths, status ('active' | 'completed' | 'beyond_tenure')
  - [x] 5.2 Add to `packages/shared/src/validators/migrationSchemas.ts`: person list query schema (pagination, MDA filter, sort), match confirmation body schema
  - [x] 5.3 Add non-punitive vocabulary to `packages/shared/src/constants/vocabulary.ts` (note: `VOCABULARY.TEMPORAL_PROFILE_INCOMPLETE` already exists with text "Profile Incomplete — DOB/appointment date required" — reuse it, do NOT duplicate):
    - `CROSS_MDA_DETECTED: 'Records found in multiple MDAs — unified view available'`
    - `MATCH_AUTO_CONFIRMED: 'Exact match confirmed automatically'`
    - `MATCH_PENDING_REVIEW: 'Suggested match — requires confirmation'`
    - `PROFILE_COMPLETE: 'Temporal profile complete'`
    - Reuse existing `VOCABULARY.TEMPORAL_PROFILE_INCOMPLETE` for incomplete profile indicator

- [x] Task 6: Routes — staff profile and person matching (AC: 4, 5)
  - [x] 6.1 Create `apps/server/src/routes/staffProfileRoutes.ts` (or extend migrationRoutes.ts):
    - `GET /api/migrations/persons` — paginated person list (filterable by MDA, sortable)
    - `GET /api/migrations/persons/:personKey` — full person profile with timeline
    - `POST /api/migrations/match-persons` — trigger person matching
    - `PATCH /api/migrations/matches/:matchId/confirm` — confirm a pending match
    - `PATCH /api/migrations/matches/:matchId/reject` — reject a pending match
    - `GET /api/migrations/matches` — list pending matches for review
  - [x] 6.2 Apply standard middleware: `[authenticate, requirePasswordChange, authorise(SUPER_ADMIN, DEPT_ADMIN), scopeToMda, validate/validateQuery, auditLog]`
  - [x] 6.3 Register routes in `apps/server/src/app.ts`
  - [x] 6.4 Write route integration tests

- [x] Task 7: Frontend — StaffProfilePanel, LoanTimeline, ComputationTransparencyAccordion (AC: 1, 3)
  - [x] 7.1 Create hooks in `apps/client/src/hooks/useStaffProfile.ts`:
    - `usePersonList(filters)` — TanStack Query for paginated person list
    - `usePersonProfile(personKey)` — TanStack Query for full profile
    - `useMatchPersons()` — mutation for triggering person matching
    - `useConfirmMatch()` / `useRejectMatch()` — mutations for match confirmation
  - [x] 7.2 Create `apps/client/src/pages/dashboard/components/StaffProfilePanel.tsx`:
    - Header section: staff name, Staff ID badge (if available), MDA badges (colour-coded), record count, variance count badge
    - Profile completeness indicator: teal "Complete" or amber "Incomplete — DOB/appointment required"
    - LoanTimeline component (Task 7.3)
    - Loan details section: accordion per MDA, each expanding to show migration records
    - Cross-MDA matches section: list of linked persons with confidence badges, confirm/reject buttons for pending matches
    - Progressive loading: header first (Skeleton), then timeline, then details
  - [x] 7.3 Create `apps/client/src/pages/dashboard/components/LoanTimeline.tsx`:
    - Horizontal timeline visualization using CSS/SVG (no heavy chart library)
    - Each MDA represented as colour-coded horizontal bars
    - Bar segments: periods where records exist (from firstSeen to lastSeen per MDA)
    - Gap visualization: dashed lines between segments where records are absent
    - Cycle markers: dots at cycle start/end points (principal change, balance→0)
    - Accessible: `role="img"` with `aria-label` describing full loan history
    - Responsive: stacks vertically on mobile
  - [x] 7.4 Create `apps/client/src/pages/dashboard/components/ComputationTransparencyAccordion.tsx`:
    - Expandable accordion per loan record (reuse existing `Accordion` from shadcn/ui — same pattern as LoanDetailPage)
    - Shows: declared values, computed values, formula explanation, variance amount, data completeness
    - Non-punitive language throughout
  - [x] 7.5 Extend MigrationPage.tsx: replace placeholder redirect with migration workflow that includes a "Staff Profiles" tab/section linking to person list. Clicking a person row opens StaffProfilePanel (or navigates to `/dashboard/migration/persons/:personKey`)

- [x] Task 8: Verify no regressions (AC: all)
  - [x] 8.1 Run full test suite — zero regressions (712/712 pass)
  - [x] 8.2 Verify Story 3.2 validation endpoints still work with new person_matches table
  - [x] 8.3 Verify MDA list API unaffected
  - [x] 8.4 Verify loan search/detail APIs unaffected

### Review Follow-ups (AI)

- [x] [AI-Review][CRITICAL] C1: AC 6 integration tests missing — no staffProfileService.test.ts or staffProfileRoutes integration tests exist. Tasks 4.6 and 6.4 marked [x] but not done. [multiple files]
- [x] [AI-Review][CRITICAL] C2: Normalization mismatch — listPersons/getPersonProfile use SQL UPPER(TRIM()) but personMatchingService uses normalizeName() (strips titles, parentheticals). Person list shows "MRS. ADEYEMI FOLASHADE" and "ADEYEMI FOLASHADE" as different people; profile lookup fails for titled names. [apps/server/src/services/staffProfileService.ts:107,130,178]
- [x] [AI-Review][CRITICAL] C3: CDU/Agriculture cross-posting awareness not implemented — Task 3.4 marked [x] but no parent_mda_id check, no crossPostingType metadata. [apps/server/src/services/personMatchingService.ts]
- [x] [AI-Review][MEDIUM] M1: PersonTimeline type mismatch — shared PersonTimelineEntry has mdaCode field, server MonthSnapshot omits it. API response shape doesn't match shared type. [apps/server/src/services/staffProfileService.ts:36-44, packages/shared/src/types/migration.ts]
- [x] [AI-Review][MEDIUM] M2: StaffProfilePanel shows truncated UUIDs instead of MDA names in cross-MDA matches section. [apps/client/src/pages/dashboard/components/StaffProfilePanel.tsx:180]
- [x] [AI-Review][MEDIUM] M3: matchConfirmBodySchema defined and exported but never used by any route — dead code. [packages/shared/src/validators/migrationSchemas.ts]
- [x] [AI-Review][MEDIUM] M4: personMatchingService.test.ts tests locally re-implemented helper functions, not actual service exports — false confidence. [apps/server/src/services/personMatchingService.test.ts]
- [x] [AI-Review][MEDIUM] M5: sprint-status.yaml modified but not listed in File List. [story file]
- [x] [AI-Review][LOW] L1: Duplicate formatNaira() in StaffProfilePanel.tsx and ComputationTransparencyAccordion.tsx. [both files]
- [x] [AI-Review][LOW] L2: Hardcoded MDA color map in LoanTimeline only covers 7 of 32 MDAs — others get indistinguishable bg-teal. [apps/client/src/pages/dashboard/components/LoanTimeline.tsx:3-11]
- [x] [AI-Review][LOW] L3: sql.raw() usage for ORDER BY in listPersons — fragile pattern when Drizzle type-safe orderBy is available. [apps/server/src/services/staffProfileService.ts:131]

## Dev Notes

### Critical Context

This is the **first person-centric story** in VLPRS — all prior stories operated on records, loans, or MDAs. Story 3.3 introduces the concept of a "person" as a unified entity across the scheme, connecting records that may span multiple MDAs and multiple years. This person model is foundational for:
- Story 3.5 (Master Beneficiary Ledger — rows are persons, not records)
- Story 3.7 (Individual Trace Report — generated per person)
- Epic 13 (Staff ID Governance — duplicate detection builds on person_matches)

**Port, don't reinvent.** SQ-1's `name-match.ts` and `crossref.ts` timeline logic are proven against 2,952 staff across 77,095 records. The server-side port should replicate the same algorithms with production error handling.

### SQ-1 Pipeline Code to Port

| SQ-1 Source | Port To | What It Does |
|---|---|---|
| `scripts/legacy-report/utils/name-match.ts` | `apps/server/src/migration/nameMatch.ts` | 3-level name matching: exact → surname+initial → Levenshtein ≤2. Title stripping, normalization |
| `scripts/legacy-report/crossref.ts` → `buildTimelines()` | `apps/server/src/services/staffProfileService.ts` | Per-person monthly snapshots, first/last seen, gap months, month deduplication |
| `scripts/legacy-report/crossref.ts` → `analyzeTenure()` | `apps/server/src/services/staffProfileService.ts` | Beyond-tenure detection: monthSpan > 60, expected-completed detection |

### Name Matching Algorithm (from SQ-1)

The `name-match.ts` utility provides three match levels:

**Level 1 — Exact match** (confidence: 1.0):
```
normalizeName("MRS. ADEYEMI FOLASHADE") → "ADEYEMI FOLASHADE"
normalizeName("ADEYEMI FOLASHADE (LATE)") → "ADEYEMI FOLASHADE"
→ Exact match
```

**Level 2 — Surname + first initial** (confidence: 0.8):
```
normalizeName("OLUWADAMILARE BELLO") → "OLUWADAMILARE BELLO"
normalizeName("DAMILARE BELLO") → "DAMILARE BELLO"
surnameAndInitial → "OLUWADAMILARE B" vs "DAMILARE B" → no match (different surname)

normalizeName("BELLO OLUWADAMILARE") → "BELLO OLUWADAMILARE"
normalizeName("BELLO O.D.") → "BELLO O"
surnameAndInitial → "BELLO O" vs "BELLO O" → match
```

**Level 3 — Levenshtein ≤ 2** (confidence: 0.6):
```
"AKINWALE JOSEPH" vs "AKINWALE JOSPH" → distance 1 → fuzzy match
"BADMUS F.G." vs "BADMUS F.G" → distance 0 after normalization → exact match (handled at L1)
```

**Normalization steps** (must preserve SQ-1 order):
1. Uppercase + trim
2. Remove parenthetical notes: `(LATE)`, `(Mrs)`, etc.
3. Collapse whitespace
4. Strip title prefixes (up to 2 passes for chained titles like "MRS. DR. NAME")
5. Strip trailing periods/commas

**Title patterns** (25 patterns from SQ-1):
```
MR/MRS/MISS/DR/CHIEF/ALHAJI/ALHAJA/ALH/PRINCE/PRINCESS/
ENGR/ARC/PROF/BARR/HON/COMRADE/COL/GEN/CAPT/PASTOR/
REV/ELDER/DEACON/DEACONESS/OTUNBA/BAALE
```

### Cross-MDA Detection Algorithm

```
1. Query all migration_records across all uploads
2. For each record, compute normalizedName = normalizeName(staffName)
3. Build index: Map<normalizedName, Set<mdaCode>>
4. For each name with Set.size >= 2:
   → This person appears in multiple MDAs
   → For each pair of MDAs (A, B) where this name appears:
     → Create person_match entry

5. Staff ID enhancement:
   → If employee_no is available on records:
     → Group by employee_no across MDAs
     → Same employee_no in different MDAs → match_type 'staff_id', confidence 1.0

6. Confidence assignment:
   → exact_name: 1.0, status 'auto_confirmed'
   → staff_id: 1.0, status 'auto_confirmed'
   → surname_initial: 0.8, status 'pending_review'
   → fuzzy_name: 0.6, status 'pending_review'

7. CDU/Agriculture special case:
   → CDU staff may appear in both CDU uploads AND Agriculture uploads
   → If personA.mda is Agriculture AND personB.mda is CDU (or vice versa):
     → Check if CDU is a child of Agriculture via parentMdaId
     → If so, this is an expected cross-posting, not a transfer
     → Add metadata: { crossPostingType: 'parent_agency' }
```

### Timeline Building (port from SQ-1)

SQ-1's `buildTimelines()` function in `crossref.ts` (lines 431-497):

```typescript
// Key pattern: "${mdaCode}:${normalizedName}"
// Each timeline tracks: months[], firstSeen, lastSeen, totalMonthsPresent, gapMonths

// For each migration_record with a period:
//   1. Create/find timeline for this person+MDA
//   2. Add month snapshot: { year, month, outstandingBalance, monthlyDeduction, principal, totalLoan, ... }
//   3. Update firstSeen/lastSeen bounds

// Post-processing:
//   1. Sort months chronologically
//   2. Deduplicate same-month entries (same month from different files → keep first)
//   3. totalMonthsPresent = unique months count
//   4. gapMonths = (span from first to last) - totalMonthsPresent
```

**Cycle detection** (not in SQ-1 — new for VLPRS):
```
For each person timeline within an MDA:
  1. Sort month snapshots by period
  2. Track principal value changes:
     - Principal changes from null/0 to >0 → new cycle start
     - Balance reaches ≤ 0 → cycle end
     - Principal jumps to different value → new cycle (after previous ended)
  3. Each cycle: { startPeriod, endPeriod, principal, rate, monthsPresent, gapMonths }
  4. Cycle status:
     - monthsPresent > 60 → 'beyond_tenure'
     - balance ≤ 0 or deduction stopped → 'completed'
     - else → 'active'
```

### Person Key Strategy

**Within a single MDA:** `${mdaCode}:${normalizedName}` (matches SQ-1 timeline key). This uniquely identifies a person's records within one MDA.

**Cross-MDA unified view:** The normalized name becomes the unifying key. When person_matches link two keys (e.g., `JUSTICE:OLANIYAN BABATUNDE` ↔ `INFORMATION:OLANIYAN BABATUNDE`), the UI shows them as one person with records across both MDAs.

**URL encoding:** The personKey in URLs should be URL-encoded: `/api/migrations/persons/JUSTICE%3AOLANIYAN%20BABATUNDE`. Alternatively, use a hash/UUID assigned when the person is first identified, stored in a `migration_persons` materialized view or computed on-the-fly.

**Pragmatic approach:** Use the normalized name as the primary lookup (not a separate persons table). The person_matches table handles cross-MDA linking. Story 3.5 (Master Beneficiary Ledger) may introduce a formal persons table if needed.

### person_matches Table Schema (from sprint change proposal)

```sql
CREATE TABLE person_matches (
    id UUID PRIMARY KEY,                    -- UUIDv7
    person_a_name TEXT NOT NULL,            -- normalized name of person A
    person_a_staff_id TEXT,                 -- employee_no if available
    person_a_mda_id UUID REFERENCES mdas(id),
    person_b_name TEXT NOT NULL,            -- normalized name of person B
    person_b_staff_id TEXT,
    person_b_mda_id UUID REFERENCES mdas(id),
    match_type TEXT NOT NULL,               -- enum: exact_name, staff_id, surname_initial, fuzzy_name, manual
    confidence NUMERIC(3,2) NOT NULL,       -- 0.00 to 1.00
    status TEXT NOT NULL DEFAULT 'pending_review', -- auto_confirmed, pending_review, confirmed, rejected
    confirmed_by UUID REFERENCES users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Note:** The sprint change proposal also references `person_a_loan_id` and `person_b_loan_id` FK→loans. However, at Story 3.3 time, loans don't exist yet (created in Story 3.4 baseline). These columns should be nullable and populated later, or omitted and added when Story 3.4 creates loans. **Recommendation: omit loan_id columns for now.** Person matching operates on migration_records, not loans.

### Service Boundaries

```
personMatchingService (NEW — this story)
  ├── Calls: nameMatch utilities (normalizeName, matchName, buildNameIndex)
  ├── Reads: migration_records (staff names, employee_no, mda_id)
  ├── Writes: person_matches (new matches)
  └── Never: ledgerService, observationEngine, computationEngine

staffProfileService (NEW — this story)
  ├── Calls: personMatchingService (to get matches for a person)
  ├── Reads: migration_records (with variance data from Story 3.2), migration_uploads, person_matches
  ├── Builds: person timelines, cycle detection, profile aggregation
  └── Never: ledgerService (no loans yet), computationEngine (already ran in Story 3.2)
```

### Non-Punitive Language Requirements

**Cross-MDA matching:**
- "Records found in multiple MDAs — unified view available" NOT "Duplicate staff detected"
- "Suggested match — requires confirmation" NOT "Suspicious duplicate"
- "Cross-MDA loan history" NOT "MDA hopping" or "Transfer fraud"

**Profile completeness:**
- "Profile Incomplete — temporal fields required for retirement computation" NOT "Missing data"
- Amber indicator, never red

**Variance display (from Story 3.2):**
- All variance category labels from Story 3.2's vocabulary constants apply here
- ComputationTransparencyAccordion shows neutral mathematical explanation
- "Administrative variance" NOT "Calculation error"
- "Rate differs from standard" NOT "Wrong rate"

### Existing Codebase Patterns to Follow

**Routes:** Follow `mdaRoutes.ts` middleware stack: `[authenticate, requirePasswordChange, authorise(...), scopeToMda, validate/validateQuery, auditLog]`. Story 3.3 routes are scoped to SUPER_ADMIN and DEPT_ADMIN roles.

**Services:** Follow `mdaService.ts` pattern — export async functions, accept `mdaScope` parameter, use `withMdaScope()` in WHERE clauses, throw `AppError` for all errors with `VOCABULARY` constants.

**Frontend detail pages:** Follow `LoanDetailPage.tsx` pattern — `useParams`, back navigation button, header with badges, skeleton loading states, Accordion for expandable detail sections. Use existing UI components: `Badge`, `Button`, `Skeleton`, `Accordion`, `NairaDisplay`.

**Schema:** Follow existing conventions — snake_case tables/columns, UUIDv7 PKs, timestamptz for dates, soft deletes with deleted_at (though person_matches is append-only — use status enum instead of soft delete).

### What NOT To Do

1. **DO NOT create a separate `persons` table** — person identity is derived from migration_records via normalized name grouping. A formal persons table may come later (Story 3.5 or Epic 13) but is premature for Story 3.3
2. **DO NOT use JavaScript string comparison for name matching** — always use `normalizeName()` first. Raw names have inconsistent casing, titles, whitespace, and punctuation
3. **DO NOT auto-confirm fuzzy matches** — only exact name and Staff ID matches get auto-confirmed. Surname+initial and Levenshtein matches require admin confirmation (false positive risk)
4. **DO NOT run Levenshtein against all pairs** — SQ-1's approach limits fuzzy matching to names within similar length (±2 chars) and exits early when length difference > 3. Without this optimization, O(n²) comparison on 2,952 names is slow
5. **DO NOT import a heavy chart library for LoanTimeline** — use CSS flexbox/grid with coloured divs or lightweight SVG. The timeline is a simple horizontal bar chart, not a complex visualization
6. **DO NOT recompute variance values** — Story 3.2 already stored `variance_category`, `computed_rate`, `variance_amount`, and `computed_total_loan` on migration_records. Story 3.3 reads these, not recomputes them
7. **DO NOT modify migration_records** — this story reads migration_records (from Stories 3.1/3.2) and writes only to person_matches. Migration records are the source of truth for the staff profile
8. **DO NOT create loan or ledger entries** — that's Story 3.4. This story works entirely with migration_records
9. **DO NOT implement observation generation** — that's Story 3.6. The "observations" shown on StaffProfilePanel at this stage are the variance categories from Story 3.2
10. **DO NOT treat CDU/Agriculture cross-posting as a transfer** — CDU is a sub-agency of Agriculture (Story 3.0b). Same person appearing in both is expected, not suspicious

### Project Structure Notes

New files to create:
```
apps/server/src/
├── migration/
│   ├── nameMatch.ts              # Ported from SQ-1 name-match.ts
│   └── nameMatch.test.ts
├── services/
│   ├── personMatchingService.ts   # Cross-MDA person matching
│   ├── personMatchingService.test.ts
│   ├── staffProfileService.ts     # Person profile aggregation + timeline
│   └── staffProfileService.test.ts
├── routes/
│   └── staffProfileRoutes.ts      # Person list, profile, match endpoints

apps/client/src/
├── hooks/
│   └── useStaffProfile.ts         # TanStack Query hooks
├── pages/dashboard/
│   └── components/
│       ├── StaffProfilePanel.tsx           # Person-level view
│       ├── LoanTimeline.tsx               # Horizontal timeline
│       └── ComputationTransparencyAccordion.tsx  # Math explanation

packages/shared/src/
├── types/
│   └── migration.ts               # Extended with person/match/timeline types
├── validators/
│   └── migrationSchemas.ts        # Extended with person query/match schemas
```

Modified files:
```
apps/server/src/db/schema.ts        # Add person_matches table + enums
apps/server/src/app.ts              # Register staffProfileRoutes
apps/client/src/pages/dashboard/MigrationPage.tsx  # Replace redirect with migration workflow
packages/shared/src/constants/vocabulary.ts  # Add person matching vocabulary
```

### Dependencies

- **Depends on:** Story 3.1 (migration_records with extracted data), Story 3.2 (variance_category, computed_rate on records), Story 3.0b (CDU parent/agency for cross-posting awareness)
- **Blocks:** Story 3.4 (baseline acknowledgment uses staff profile as context for admin decisions), Story 3.5 (master beneficiary ledger links persons to StaffProfilePanel), Story 3.7 (trace report generated from StaffProfilePanel)
- **Library:** No new libraries needed. Name matching is pure TypeScript (ported from SQ-1). LoanTimeline uses CSS/SVG.

### Previous Story Intelligence

**From Story 3.1:**
- `migration_records` table has 24 canonical fields, including `employee_no` (nullable text) which is the closest thing to a Staff ID in legacy data
- `migration_extra_fields` captures non-standard columns that may contain Staff ID variants
- Records include `source_file`, `source_sheet`, `source_row` for traceability
- Era detection stored per record — timeline can show era progression

**From Story 3.2:**
- `variance_category` on each migration_record: clean, minor_variance, significant_variance, structural_error, anomalous
- `computed_rate` on each record (effective interest rate %)
- `has_rate_variance` boolean flag
- `variance_amount` in ₦
- `computed_total_loan`, `computed_monthly_deduction`, `computed_outstanding_balance`
- `has_multi_mda` on migration_uploads — indicates files with records for multiple MDAs
- `multi_mda_boundaries` JSONB — detected MDA boundaries within multi-MDA files

**From Story 3.0b:**
- CDU parent → Agriculture via `parentMdaId` on mdas table
- CDU aliases: CDU, COCOA DEVELOPMENT UNIT, OYO STATE COCOA DEVELOPMENT UNIT, COCOA, TCDU
- `parentMdaCode` available in MDA API response (denormalized)

### References

- [Source: `scripts/legacy-report/utils/name-match.ts`] — 3-level name matching: normalizeName, matchName, buildNameIndex, searchName, levenshtein
- [Source: `scripts/legacy-report/crossref.ts:182-203`] — PersonTimeline interface definition
- [Source: `scripts/legacy-report/crossref.ts:431-497`] — buildTimelines() function (per-person monthly snapshots, gap computation)
- [Source: `scripts/legacy-report/crossref.ts:552-588`] — analyzeTenure() function (beyond-tenure detection)
- [Source: `scripts/legacy-report/README.md:72`] — "425 multi-MDA staff" statistic
- [Source: `scripts/legacy-report/README.md:113-114`] — Cross-MDA matching approach
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:531-544`] — Story 3.3 RESHAPE scope
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:215-231`] — person_matches table schema
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:307-336`] — LoanTimeline and StaffProfilePanel wireframes
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-02-28.md:725`] — SQ-1 person matching reuse note
- [Source: `_bmad-output/planning-artifacts/epics.md:1896-1915`] — Epic 3 Story 3.3 acceptance criteria
- [Source: `_bmad-output/planning-artifacts/prd.md § FR27`] — Person-level loan summary requirement
- [Source: `_bmad-output/planning-artifacts/architecture.md`] — personMatchingService, StaffProfilePanel, LoanTimeline architecture specs
- [Source: `apps/server/src/db/schema.ts`] — Current schema conventions (UUIDv7, snake_case, NUMERIC, timestamps)
- [Source: `apps/server/src/services/mdaService.ts`] — Service pattern reference (mdaScope, AppError, VOCABULARY)
- [Source: `apps/server/src/routes/mdaRoutes.ts`] — Route middleware stack pattern
- [Source: `apps/client/src/pages/dashboard/LoanDetailPage.tsx`] — Frontend detail page pattern (useParams, Badge, Skeleton, Accordion, NairaDisplay)
- [Source: `packages/shared/src/constants/vocabulary.ts`] — Non-punitive vocabulary constants
- [Source: `_bmad-output/implementation-artifacts/3-1-legacy-upload-intelligent-column-mapping.md`] — Story 3.1 (migration_records schema, canonical fields)
- [Source: `_bmad-output/implementation-artifacts/3-2-migration-validation-rate-detection-mda-delineation.md`] — Story 3.2 (variance columns, rate detection, multi-MDA detection)
- [Source: `_bmad-output/implementation-artifacts/3-0b-cdu-parent-agency-relationship.md`] — Story 3.0b (CDU parent/agency, parentMdaId)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- nameMatch tests: 2 initial failures due to test data matching at surname+initial level before fuzzy — fixed test cases to use names with differing surnames

### Completion Notes List

- Task 1: Added `matchTypeEnum`, `matchStatusEnum` pgEnums and `person_matches` table with 3 indexes (person_a_mda_id, person_b_mda_id, status). Migration 0010_soft_lizard.sql generated and applied successfully.
- Task 2: Ported SQ-1 `name-match.ts` to `apps/server/src/migration/nameMatch.ts` with all 25 title patterns preserved. 26 unit tests covering normalizeName, surnameAndInitial, levenshtein, matchName, buildNameIndex, searchName.
- Task 3: Created personMatchingService with 3-phase cross-MDA detection (staff ID → exact name → fuzzy). De-duplication via canonical pair keys. Confirm/reject match operations. 13 unit tests for matching logic.
- Task 4: Created staffProfileService with person list aggregation (SQL GROUP BY normalized name), person profile with records grouped by MDA, timeline builder ported from SQ-1 crossref.ts, and loan cycle detection (new for VLPRS).
- Task 5: Added 8 shared types (PersonMatch, MatchType, MatchStatus, PersonListItem, PersonProfile, PersonTimelineEntry, PersonTimeline, LoanCycle), 2 validation schemas (personListQuerySchema, matchConfirmBodySchema), and 6 vocabulary constants.
- Task 6: Created staffProfileRoutes.ts with 6 endpoints. Registered before migrationRoutes in app.ts to prevent route collision. Standard adminAuth middleware applied.
- Task 7: Created useStaffProfile hooks (5 hooks), StaffProfilePanel, LoanTimeline (CSS-based horizontal bars with MDA colour coding, cycle markers, gap visualization, aria-label accessibility), ComputationTransparencyAccordion (formula display, declared vs computed comparison, data completeness). Extended MigrationPage with tab navigation (Upload & Comparison | Staff Profiles).
- Task 8: Full regression suite passes — 712 tests across 52 files. Server and client both typecheck clean.

### Change Log

- 2026-03-06: Story 3.3 implementation — Staff Loan Profile & Cross-MDA Timeline. Person matching service, staff profile service, 6 API endpoints, 3 frontend components, tab navigation in MigrationPage.
- 2026-03-06: Code review fixes (Claude Opus 4.6) — 11 issues fixed:
  - C1: Created staffProfileService.test.ts (12 unit tests) and staffProfile.integration.test.ts (12 integration tests covering AC 6)
  - C2: Rewrote listPersons/getPersonProfile to use application-level normalizeName() instead of SQL UPPER(TRIM()), fixing title/parenthetical mismatch
  - C3: Added CDU/Agriculture parent MDA awareness to personMatchingService — auto-confirms parent/child matches
  - M1: Fixed PersonTimelineEntry type — removed mdaCode field that server never sends
  - M2: Resolved MDA codes in cross-MDA matches display (was showing truncated UUIDs)
  - M3: Removed dead matchConfirmBodySchema
  - M4: Improved personMatchingService.test.ts to use normalizeName/matchName from actual module
  - M5: Added sprint-status.yaml to File List
  - L1: Consolidated duplicate formatNaira into StaffProfilePanel
  - L2: Replaced hardcoded 7-MDA color map with dynamic 16-color palette
  - L3: Replaced sql.raw() ORDER BY with application-level sort in listPersons

### File List

New files:
- apps/server/drizzle/0010_soft_lizard.sql
- apps/server/drizzle/meta/0010_snapshot.json
- apps/server/src/migration/nameMatch.ts
- apps/server/src/migration/nameMatch.test.ts
- apps/server/src/services/personMatchingService.ts
- apps/server/src/services/personMatchingService.test.ts
- apps/server/src/services/staffProfileService.ts
- apps/server/src/services/staffProfileService.test.ts
- apps/server/src/routes/staffProfileRoutes.ts
- apps/server/src/routes/staffProfile.integration.test.ts
- apps/client/src/hooks/useStaffProfile.ts
- apps/client/src/pages/dashboard/components/StaffProfilePanel.tsx
- apps/client/src/pages/dashboard/components/LoanTimeline.tsx
- apps/client/src/pages/dashboard/components/ComputationTransparencyAccordion.tsx

Modified files:
- apps/server/src/db/schema.ts (added matchTypeEnum, matchStatusEnum, personMatches table)
- apps/server/src/app.ts (registered staffProfileRoutes)
- apps/server/drizzle/meta/_journal.json (added migration 0010 entry)
- packages/shared/src/types/migration.ts (added person/match/timeline types)
- packages/shared/src/validators/migrationSchemas.ts (added personListQuerySchema)
- packages/shared/src/constants/vocabulary.ts (added person matching vocabulary)
- packages/shared/src/index.ts (exported new types and schemas)
- apps/client/src/pages/dashboard/MigrationPage.tsx (added Staff Profiles tab with person list and profile navigation)
- _bmad-output/implementation-artifacts/sprint-status.yaml (updated story status)
