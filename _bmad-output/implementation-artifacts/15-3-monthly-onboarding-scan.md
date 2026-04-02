# Story 15.3: Monthly Onboarding Scan

Status: ready-for-dev

## Story

As a **Super Admin**,
I want the system to automatically scan each month's MDA submissions against the approved beneficiary list,
So that I can track when each approved beneficiary's deductions actually started and see the onboarding pipeline fill up over time.

**Origin:** Epic 15, FR85 extended, FR33(l) extended. Full specification: `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md` § "The Monthly Scanning Model."

**Dependencies:** Story 15.2 (Fuzzy Name Matching Engine) must be complete — this story calls the matching engine on each submission. Story 15.1 (Committee List Upload) provides the `approved_beneficiaries` table.

## Acceptance Criteria

1. **Given** an MDA submits monthly returns via Epic 5 pipeline (CSV or manual), **When** the submission is processed, **Then** the system checks `NOT_YET_OPERATIONAL` approved beneficiaries for that MDA against the submission rows using the Story 15.2 matching engine — fire-and-forget, does not block submission processing.

2. **Given** a new HIGH-confidence match is found between a submission row and an approved beneficiary, **Then** `first_deduction_month` is set to the submission period, `onboarding_status` → `OPERATIONAL`, `matched_loan_id` linked.

3. **Given** a new MEDIUM-confidence match is found, **Then** it is added to the review queue with context: "This name appeared in {MDA}'s {month} submission — confirm match?"

4. **Given** an approved beneficiary has been `NOT_YET_OPERATIONAL` for ≥3 months since batch upload, **Then** an attention item is generated: "{Name} approved in {batch_label}, {N} months without recorded deduction at {MDA}" with amber status.

5. **Given** an approved beneficiary has been `NOT_YET_OPERATIONAL` for ≥6 months, **Then** the attention item escalates to gold (review) status.

6. **Given** a scan completes for a submission period, **Then** a summary is logged: total scanned, new matches (high/medium), still awaiting. No persistent scan history table needed — results are reflected in the `approved_beneficiaries` records themselves.

7. **Given** the scan runs, **Then** it is incremental — only checks beneficiaries with `onboarding_status = 'NOT_YET_OPERATIONAL'` for the MDA that submitted. Already-operational beneficiaries are skipped.

## Tasks / Subtasks

- [ ] Task 1: Create onboarding scan service (AC: 1, 2, 3, 6, 7)
  - [ ] 1.1: Create `apps/server/src/services/onboardingScanService.ts` with:
    ```typescript
    export async function scanSubmissionForOnboarding(
      mdaId: string,
      period: string,           // YYYY-MM
      submissionId: string,
    ): Promise<OnboardingScanResult>
    ```
  - [ ] 1.2: Query `approved_beneficiaries` WHERE `mda_canonical_id = mdaId AND onboarding_status = 'NOT_YET_OPERATIONAL'`
  - [ ] 1.3: Query `submission_rows` for this submission — get all `staffId` values. Then query `loans` to get `staffName` for each staffId (submission_rows has staffId but NOT staffName)
  - [ ] 1.4: For each unmatched beneficiary, run `tokenSetSimilarity()` (Story 15.2 engine) against the submission's staff names within this MDA
  - [ ] 1.5: On HIGH match (≥95%):
    - Update `approved_beneficiaries`: `match_status = 'MATCHED_HIGH'`, `matched_loan_id = loan.id`, `match_confidence = score`, `first_deduction_month = period`, `onboarding_status = 'OPERATIONAL'`, `updatedAt = NOW()`
  - [ ] 1.6: On MEDIUM match (85-94%):
    - Update `approved_beneficiaries`: `match_status = 'MATCHED_MEDIUM'`, `match_confidence = score`, `updatedAt = NOW()`
    - Do NOT set `first_deduction_month` or `onboarding_status` — awaits human review
  - [ ] 1.7: LOW and UNMATCHED — no update (leave as-is, will be re-scanned next month)
  - [ ] 1.8: Return `OnboardingScanResult`:
    ```typescript
    { mdaId, period, totalScanned, newHighMatches, newMediumMatches, stillAwaiting, durationMs }
    ```
  - [ ] 1.9: Log summary: `logger.info({ ...result }, 'Onboarding scan completed for MDA')`
  - [ ] 1.10: Unit test in `apps/server/src/services/onboardingScanService.test.ts` (**new file**): submission with known beneficiary name → HIGH match, status updated to OPERATIONAL
  - [ ] 1.11: Unit test in same file: submission with similar name → MEDIUM match, status stays NOT_YET_OPERATIONAL
  - [ ] 1.12: Unit test in same file: submission with no matches → no updates, stillAwaiting count correct
  - [ ] 1.13: Unit test in same file: already-OPERATIONAL beneficiary → skipped (not re-scanned)

- [ ] Task 2: Hook into submission pipeline (AC: 1)
  - [ ] 2.1: In `apps/server/src/services/submissionService.ts`, add a fire-and-forget hook after the existing hooks (after line ~484, alongside three-way reconciliation trigger):
    ```typescript
    // Fire-and-forget: Monthly Onboarding Scan (Story 15.3)
    scanSubmissionForOnboarding(mdaId, period, submissionId)
      .catch((err) => logger.error({ err, mdaId, period }, 'Onboarding scan failed (non-blocking)'));
    ```
  - [ ] 2.2: Only trigger for `source === 'csv'` or `source === 'manual'` — NOT for `'historical'` or `'payroll'`. NOTE: this guard is defensive — by the time execution reaches the hook point (~line 484), `source` is guaranteed to be 'csv' or 'manual' (historical already returns at line 467, payroll uses a separate code path in `payrollService`). Still add the check for explicitness and safety
  - [ ] 2.3: Guard: only trigger if `approved_beneficiaries` table has any `NOT_YET_OPERATIONAL` records for this MDA (quick count query to avoid unnecessary work)
  - [ ] 2.4: Integration test in `apps/server/src/routes/submission.integration.test.ts` (extend existing or new): submit CSV → verify onboarding scan fires and updates beneficiary status

- [ ] Task 3: Implement onboarding lag attention items (AC: 4, 5)
  - [ ] 3.1: Implement `detectOnboardingLag()` in `apps/server/src/services/attentionItemService.ts` (currently a stub at line ~476):
    ```typescript
    async function detectOnboardingLag(mdaScope?: string | null): Promise<AttentionItem[]>
    ```
  - [ ] 3.2: Query `approved_beneficiaries` WHERE `onboarding_status = 'NOT_YET_OPERATIONAL'`:
    - Compute months since batch upload: `EXTRACT(YEAR FROM AGE(NOW(), ab.created_at)) * 12 + EXTRACT(MONTH FROM AGE(NOW(), ab.created_at))`
    - Group by MDA
  - [ ] 3.3: For beneficiaries ≥3 months and <6 months:
    - Category: `'review'` (amber)
    - Description: "{count} approved beneficiaries at {MDA} awaiting first deduction ({N} months since approval)"
    - Priority: 20 (medium)
  - [ ] 3.4: For beneficiaries ≥6 months:
    - Category: `'review'` (gold/escalated)
    - Description: "{count} approved beneficiaries at {MDA} awaiting first deduction for {N}+ months — review recommended"
    - Priority: 10 (higher)
  - [ ] 3.5: Use existing `buildPerMdaItems()` helper (lines 491-538) — max 3 MDA-level items with "and N more MDAs"
  - [ ] 3.6: **UPDATE** the existing `onboarding_lag` MetricHelp entry in `ATTENTION_HELP` at `packages/shared/src/constants/metricGlossary.ts` lines 161-166. The existing entry has a placeholder MDA-level description ("An MDA that was recently onboarded...") but the type, stub, and detector were ALWAYS intended for beneficiary-level onboarding (the stub TODO says "when Beneficiary Pipeline Service exists"). Replace with the beneficiary-level description — do NOT create a new `beneficiary_onboarding_lag` key:
    ```typescript
    onboarding_lag: {
      label: 'Beneficiary Onboarding Lag',
      description: 'Approved beneficiaries who have not yet appeared in any MDA monthly submission.',
      derivedFrom: 'Time elapsed since batch upload date for NOT_YET_OPERATIONAL beneficiaries.',
      guidance: 'Contact the MDA to verify whether payroll deductions have started. Common causes: MDA processing delay, staff on leave, incorrect MDA assignment.',
    },
    ```
  - [ ] 3.7: Unit test: beneficiary at 2 months → no attention item
  - [ ] 3.8: Unit test: beneficiary at 4 months → amber attention item
  - [ ] 3.9: Unit test: beneficiary at 7 months → gold/escalated attention item

- [ ] Task 4: Handle review queue context for monthly scan matches (AC: 3)
  - [ ] 4.1: When a MEDIUM match is found during monthly scan, enrich the review queue entry with scan context. Add a `scanContext` field to the review queue response (from Story 15.2 Task 5.2):
    ```typescript
    scanContext?: {
      period: string;        // "2026-04"
      mdaName: string;
      source: 'batch_upload' | 'monthly_scan';
    }
    ```
  - [ ] 4.2: The review queue UI (Story 15.2 Task 6) should show: "This name appeared in {MDA}'s {month} submission — confirm match?" for monthly scan matches, vs no context note for batch upload matches
  - [ ] 4.3: When a monthly scan MEDIUM match is confirmed by admin → also set `first_deduction_month` and `onboarding_status = 'OPERATIONAL'` (not just `match_status = 'CONFIRMED'`)

- [ ] Task 5: Full regression and verification (AC: all)
  - [ ] 5.1: Run `pnpm typecheck` — zero errors
  - [ ] 5.2: Run `pnpm test` — zero regressions (especially submission pipeline tests — verify fire-and-forget hook doesn't break existing flow)
  - [ ] 5.3: Run `pnpm lint` — zero new warnings
  - [ ] 5.4: Integration test: upload approval list (15.1) → submit CSV for same MDA with matching names → verify beneficiary status transitions to OPERATIONAL with correct `first_deduction_month`
  - [ ] 5.5: Manual test: wait 3+ months (or backdate test data) → verify amber attention item appears on dashboard

## Dev Notes

### The Monthly Scanning Model

From the epic spec:

```
Batch uploaded: 2026 Approval List (500 beneficiaries)

Month 1 (Jan submissions arrive):
  → Scan: 320 of 500 found → 64% operational
  → 180 awaiting

Month 2 (Feb submissions arrive):
  → Rescan: 410 of 500 found → 82% operational
  → 90 new matches since last scan

Month 3 (Mar submissions arrive):
  → Rescan: 450 of 500 found → 90% operational
  → 50 still awaiting → attention items at 3 months
```

The scan piggybacks on the existing submission pipeline. No separate cron job needed.

### Integration Point: Fire-and-Forget Pattern

**Location:** `apps/server/src/services/submissionService.ts` (after line ~484)

Three hooks already exist at this point:
1. Reconciliation alert email (lines 446-460)
2. Three-way reconciliation trigger (lines 480-484)
3. Comparison engine (lines 486-517)

The onboarding scan becomes hook #4, following the same pattern:

```typescript
// Existing hooks...
triggerThreeWayReconciliation(mdaId, period, userId, source)
  .catch(() => { /* fire-and-forget */ });

// NEW: Monthly Onboarding Scan (Story 15.3)
if (source === 'csv' || source === 'manual') {
  scanSubmissionForOnboarding(mdaId, period, submissionId)
    .catch((err) => logger.error({ err, mdaId, period }, 'Onboarding scan failed'));
}
```

### Data Flow: Submission Row → Beneficiary Match

```
submission_rows (staffId, month, amountDeducted)
  ↓ staffId
loans (id, staffId, staffName, mdaId, principalAmount)
  ↓ staffName
tokenSetSimilarity(beneficiary.name, loan.staffName)
  ↓ score
approved_beneficiaries update (match_status, first_deduction_month, onboarding_status)
```

**Key:** Submission rows have `staffId` but NOT `staffName`. The scan must join to `loans` to get the name for fuzzy matching. This is the same data path the comparison engine uses.

### Why Not Match Directly Against Submission Rows?

Submission rows contain `staffId` (e.g., `"OY/2345/BIR"`) but approved beneficiaries have `name` (e.g., `"ADEWALE ADEOLA SAUDAT"`) — there's no Staff ID in the approval files. The matching must go through `loans.staffName` as the bridge.

### Incremental Scan — Performance

The scan only processes `NOT_YET_OPERATIONAL` beneficiaries for the submitting MDA:
- First month: 500 beneficiaries × 100 loans per MDA = 50K comparisons
- Month 2: only 180 remaining × 100 = 18K
- Month 3: only 90 × 100 = 9K

Over time the workload shrinks as beneficiaries become operational. Each comparison uses pre-normalized names from the 15.2 engine — <1ms per comparison.

### Attention Items: Aging Logic

Attention items are computed on-demand (not stored). `detectOnboardingLag()` queries `approved_beneficiaries` and computes months elapsed:

```sql
SELECT ab.mda_canonical_id, m.name as mda_name,
  COUNT(*) as awaiting_count,
  MIN(ab.created_at) as earliest_upload,
  MAX(EXTRACT(YEAR FROM AGE(NOW(), ab.created_at)) * 12 +
      EXTRACT(MONTH FROM AGE(NOW(), ab.created_at))) as max_months
FROM approved_beneficiaries ab
JOIN mdas m ON ab.mda_canonical_id = m.id
WHERE ab.onboarding_status = 'NOT_YET_OPERATIONAL'
GROUP BY ab.mda_canonical_id, m.name
HAVING MAX(EXTRACT(YEAR FROM AGE(NOW(), ab.created_at)) * 12 +
           EXTRACT(MONTH FROM AGE(NOW(), ab.created_at))) >= 3
```

- 3-5 months: amber (informational — normal processing lag possible)
- 6+ months: gold (review recommended — something may be wrong)

### Confirmed Review Queue Matches From Monthly Scan

When admin confirms a MEDIUM match found during monthly scan, two things happen:
1. `match_status → 'CONFIRMED'` (standard 15.2 behavior)
2. `first_deduction_month → period`, `onboarding_status → 'OPERATIONAL'` (15.3 addition)

The review queue must carry the `scanContext` to enable this second update.

### What This Story Does NOT Build

- **Onboarding dashboard / curves** — Story 15.4
- **Matching engine itself** — Story 15.2 (this story calls it)
- **Separate scheduler** — piggybacks on submission pipeline (Team Decision 2: fire-and-forget)
- **Scan history table** — no persistent scan log. Results are reflected in `approved_beneficiaries` records. Summary logged via Pino

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Submission pipeline | `apps/server/src/services/submissionService.ts` | 444-517 (fire-and-forget hooks) |
| Attention items | `apps/server/src/services/attentionItemService.ts` | ~476 (detectOnboardingLag stub) |
| Matching engine (15.2) | `apps/server/src/services/nameMatchingEngine.ts` | tokenSetSimilarity |
| Beneficiary matching (15.2) | `apps/server/src/services/beneficiaryMatchingService.ts` | runBeneficiaryMatching |
| Approved beneficiaries (15.1) | `apps/server/src/db/schema.ts` | Created in Story 15.1 |
| Loans table | `apps/server/src/db/schema.ts` | 109-140 (staffName, staffId, mdaId) |
| Submission rows | `apps/server/src/db/schema.ts` | submission_rows (staffId, month — NO staffName) |
| Metric glossary | `packages/shared/src/constants/metricGlossary.ts` | ATTENTION_HELP section |
| New service | `apps/server/src/services/onboardingScanService.ts` | To be created |
| Epic 15 full spec | `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md` | § Monthly Scanning Model |
| Team review | `_bmad-output/planning-artifacts/epic-15-team-review.md` | Decision 2 (scan trigger pattern) |

### Non-Punitive Vocabulary

- "Awaiting first deduction" not "Missing" or "Non-compliant"
- "Review recommended" not "Overdue" or "Failed"
- "Onboarding lag" — factual, not judgmental
- Amber/gold indicators, never red

### Testing Standards

- Co-located tests: `onboardingScanService.test.ts`
- Integration test in submission route tests: verify fire-and-forget hook
- Vitest framework

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 15.3]
- [Source: _bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md — § Monthly Scanning Model]
- [Source: _bmad-output/planning-artifacts/epic-15-team-review.md — Decision 2 (fire-and-forget scan)]
- [Source: apps/server/src/services/submissionService.ts:444-517 — Fire-and-forget hook point]
- [Source: apps/server/src/services/attentionItemService.ts:~476 — detectOnboardingLag stub]
- [Source: apps/server/src/services/attentionItemService.ts:491-538 — buildPerMdaItems helper]
- [Source: _bmad-output/implementation-artifacts/15-2-fuzzy-name-matching-engine.md — Matching engine]
- [Source: _bmad-output/implementation-artifacts/15-1-committee-list-upload-pipeline.md — approved_beneficiaries table]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
