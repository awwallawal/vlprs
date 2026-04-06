# Story 15.2: Fuzzy Name Matching Engine

Status: ready-for-dev

## Story

As a **Department Admin**,
I want the system to automatically match approved beneficiaries against operational loan records using intelligent name matching,
So that I can see which approved people are already in the system without manually searching 2,500+ names.

**Origin:** Epic 15, FR85 extended. Full specification: `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md` § "The Matching Problem."

**Dependencies:** Story 15.1 (Committee List Upload Pipeline) must be complete — this story consumes the `approved_beneficiaries` table and extends the matching stub from 15.1 Task F3.

## Acceptance Criteria

1. **Given** approved beneficiary records with `match_status = 'UNMATCHED'`, **When** the matching engine runs, **Then** it compares each name against loan records within the same canonical MDA using normalized token-set similarity.

2. **Given** a match scores ≥95% similarity with exact MDA match, **Then** it is classified as HIGH confidence and auto-linked (`match_status = 'MATCHED_HIGH'`, `matched_loan_id` populated). For common names within the same MDA, `approved_amount` vs `loan.principalAmount` is used as a disambiguation tiebreaker.

3. **Given** a match scores 85-94% similarity with exact MDA, OR ≥95% with fuzzy MDA, **Then** it is MEDIUM confidence — placed in human review queue (`match_status = 'MATCHED_MEDIUM'`).

4. **Given** a match scores 70-84%, **Then** it is LOW confidence — flagged but not linked (`match_status = 'MATCHED_LOW'`).

5. **Given** no plausible match found (no candidate above 70%), **Then** record remains `UNMATCHED`.

6. **Given** medium-confidence matches exist, **When** the Department Admin opens the review queue, **Then** they see: approved name, MDA, best-match loan (name, MDA, principal, status), confidence score, and Confirm / Reject / Skip buttons.

7. **Given** the matching engine runs against ~2,500 approved beneficiaries and ~5,000 loan records, **When** partitioned by MDA, **Then** it completes in under 30 seconds.

8. **Given** both Jaro-Winkler and Levenshtein-based token-set algorithms are implemented, **When** benchmarked against a 20-record fixture with known variants, **Then** the algorithm with better precision at the 85% and 95% thresholds is selected as the default (Team Decision 1).

## Tasks / Subtasks

- [ ] Task 1: Implement token-set similarity algorithm (AC: 1, 8)
  - [ ] 1.1: Create `apps/server/src/services/nameMatchingEngine.ts` with:
    ```typescript
    export function tokenSetSimilarity(
      nameA: string,
      nameB: string,
      distanceFn: 'levenshtein' | 'jaro_winkler'
    ): number  // Returns 0-100 score
    ```
  - [ ] 1.2: Algorithm:
    1. Normalize both names via existing `normalizeName()` from `apps/server/src/migration/nameMatch.ts`
    2. Tokenize: split on whitespace → sorted token sets (e.g., `{"ADEWALE", "ADEOLA", "SAUDAT"}`)
    3. Build 3 comparison strings (token-set ratio pattern):
       - `intersection`: tokens in both sets → sorted, joined
       - `diff_a`: intersection + tokens only in A → sorted, joined
       - `diff_b`: intersection + tokens only in B → sorted, joined
    4. Compute similarity for each pair using the chosen distance function
    5. Return MAX of: `sim(intersection, diff_a)`, `sim(intersection, diff_b)`, `sim(diff_a, diff_b)`
    6. Convert to 0-100 score
  - [ ] 1.3: This handles name reordering (surname-first vs given-name-first) which is the most common variant in the dataset
  - [ ] 1.4: **IMPORTANT:** The existing `levenshtein()` (nameMatch.ts line 66) has an early exit when `Math.abs(a.length - b.length) > 3` — returns max length as distance. In token-set similarity, comparison strings (intersection vs diff_a) can differ by 7+ chars by design, triggering this exit and producing near-zero similarity. Either: (a) create a `levenshteinFull()` variant without the early exit for use in token-set, or (b) bypass the optimization when called from `tokenSetSimilarity()`. This does NOT affect Jaro-Winkler — the benchmark (Task 3) may reveal this empirically

- [ ] Task 2: Implement Jaro-Winkler distance (AC: 8)
  - [ ] 2.1: Add `jaroWinkler(a: string, b: string): number` function in `nameMatchingEngine.ts`:
    - Jaro similarity: matching characters within `floor(max(|s1|,|s2|)/2) - 1` window + transposition penalty
    - Winkler extension: boost score for common prefix (up to 4 chars), `p = 0.1`
    - Return 0-1 similarity (1 = identical)
  - [ ] 2.2: No external library — implement in-house alongside existing Levenshtein (keeps dependency footprint zero)
  - [ ] 2.3: Unit test in `apps/server/src/services/nameMatchingEngine.test.ts` (**new file**): `jaroWinkler("ADEWALE", "ADEWALE")` → 1.0
  - [ ] 2.4: Unit test in same file: `jaroWinkler("ADEWALE", "ADWALE")` → >0.9 (transposition/deletion)
  - [ ] 2.5: Unit test in same file: `jaroWinkler("COMPLETELY", "DIFFERENT")` → <0.5

- [ ] Task 3: Create benchmark fixture and select algorithm (AC: 8)
  - [ ] 3.1: Create `apps/server/src/services/__fixtures__/name-matching-benchmark.json` with 20 record pairs from actual data:
    - 5 exact matches (after normalization)
    - 5 reordered names (surname-first ↔ given-name-first)
    - 5 abbreviated/missing middle names
    - 5 typos/spelling variants
    - Each pair: `{ approvedName, loanName, expectedMatch: true/false, expectedBand: 'high'|'medium'|'low' }`
  - [ ] 3.2: Create benchmark test in `nameMatchingEngine.test.ts`:
    - Run both `levenshtein` and `jaro_winkler` token-set similarity on all 20 pairs
    - Report: precision at 95% threshold (high band), precision at 85% threshold (medium band)
    - Log results for developer to inspect
  - [ ] 3.3: Based on benchmark results, set `DEFAULT_DISTANCE_FN` constant in engine:
    ```typescript
    export const DEFAULT_DISTANCE_FN: 'levenshtein' | 'jaro_winkler' = 'jaro_winkler'; // or 'levenshtein' — empirically chosen
    ```
  - [ ] 3.4: Document the benchmark results in a code comment explaining the choice

- [ ] Task 4: Create batch matching service (AC: 1, 2, 3, 4, 5, 7)
  - [ ] 4.1: Create `apps/server/src/services/beneficiaryMatchingService.ts` with:
    ```typescript
    export async function runBeneficiaryMatching(
      options?: { batchId?: string; mdaId?: string }
    ): Promise<MatchingResult>
    ```
  - [ ] 4.2: Query `approved_beneficiaries` WHERE `match_status = 'UNMATCHED'` (or filter by batchId/mdaId)
  - [ ] 4.3: **Partition by MDA for performance:**
    - Group unmatched beneficiaries by `mda_canonical_id`
    - For each MDA: query `loans` WHERE `mdaId = mda AND status IN ('ACTIVE', 'RETIRED', 'SUSPENDED', 'LWOP')` — include non-terminal statuses
    - Run matching within MDA partition only (avoids 2,500 × 5,000 comparisons)
  - [ ] 4.4: For each unmatched beneficiary × loan in same MDA:
    - Compute `tokenSetSimilarity(beneficiary.name, loan.staffName, DEFAULT_DISTANCE_FN)`
    - Track best match per beneficiary (highest score)
  - [ ] 4.5: Classification:
    ```typescript
    if (score >= 95 && exactMdaMatch) → MATCHED_HIGH (auto-link)
    if (score >= 85 && exactMdaMatch) → MATCHED_MEDIUM (review queue)
    if (score >= 70) → MATCHED_LOW (flagged, not linked)
    else → remains UNMATCHED
    ```
  - [ ] 4.6: **Amount disambiguation for HIGH matches:** if multiple loans in the same MDA score ≥95% for the same beneficiary name (common name scenario), use `approved_amount` vs `loan.principalAmount` as tiebreaker — pick the loan where amounts match within ₦1,000
  - [ ] 4.7: Update `approved_beneficiaries` records: set `match_status`, `matched_loan_id` (for HIGH only), `match_confidence` (0-100 score)
  - [ ] 4.8: Return `MatchingResult`: `{ total, matchedHigh, matchedMedium, matchedLow, unmatched, durationMs }`
  - [ ] 4.9: Performance: process per-MDA with pre-built normalized name maps (O(n×m) per MDA, but MDA partitioning keeps n and m small)
  - [ ] 4.10: Unit test in `apps/server/src/services/beneficiaryMatchingService.test.ts` (**new file**): beneficiary with exact name match → MATCHED_HIGH
  - [ ] 4.11: Unit test in same file: beneficiary with reordered name → MATCHED_HIGH (token-set handles reordering)
  - [ ] 4.12: Unit test in same file: beneficiary with abbreviated middle name → MATCHED_MEDIUM
  - [ ] 4.13: Unit test in same file: beneficiary with no plausible match → UNMATCHED
  - [ ] 4.14: Unit test in same file: two loans with same name in same MDA, different amounts → amount tiebreaker picks correct loan

- [ ] Task 5: Create matching API endpoints (AC: 1, 6)
  - [ ] 5.1: Add to `apps/server/src/routes/committeeListRoutes.ts` (created in 15.1):
    - `POST /api/committee-lists/match` — trigger matching run (DEPT_ADMIN, SUPER_ADMIN). Body: `{ batchId?: string, mdaId?: string }`. Returns `MatchingResult`
    - `GET /api/committee-lists/review-queue` — paginated list of MATCHED_MEDIUM records with candidate loan details. Query params: `batchId`, `mdaId`, `page`, `limit`
    - `PATCH /api/committee-lists/beneficiaries/:id/confirm-match` — confirm medium match. Body: `{ loanId: string }`. Sets `match_status = 'CONFIRMED'`, `matched_loan_id`
    - `PATCH /api/committee-lists/beneficiaries/:id/dismiss-match` — dismiss match (non-punitive — not "reject"). Sets `match_status = 'UNMATCHED'`, clears `matched_loan_id`
  - [ ] 5.2: Review queue response shape:
    ```typescript
    {
      beneficiaryId, beneficiaryName, mdaName, approvedAmount, gradeLevel,
      bestMatch: { loanId, loanStaffName, loanPrincipal, loanStatus, confidenceScore },
      otherCandidates: Array<{ loanId, staffName, principal, score }>  // top 3
    }
    ```
  - [ ] 5.3: Integration test in `apps/server/src/routes/committeeList.integration.test.ts` (extends 15.1's file): trigger match → verify records updated with correct statuses
  - [ ] 5.4: Integration test in same file: confirm medium match → status changes to CONFIRMED

- [ ] Task 6: Create review queue UI (AC: 6)
  - [ ] 6.1: Create `apps/client/src/pages/dashboard/components/MatchReviewQueue.tsx`:
    - Table: Approved Name | MDA | Amount | Best Match (loan name) | Score | Principal | Status | Actions
    - Score displayed as percentage badge with color: ≥95 teal, 85-94 amber, <85 gray
    - Actions: Confirm (teal button), Dismiss (outline), Skip (link)
    - Expandable row showing other candidates (top 3 alternate matches)
  - [ ] 6.2: Add "Run Matching" button on CommitteeListsPage (15.1) that triggers `POST /api/committee-lists/match`
  - [ ] 6.3: Add "Review Queue" tab or link from CommitteeListsPage showing MATCHED_MEDIUM records
  - [ ] 6.4: TanStack Query hooks in `apps/client/src/hooks/useCommitteeList.ts`:
    ```typescript
    useRunMatching()              // POST mutation
    useReviewQueue(batchId, page) // GET paginated
    useConfirmMatch()             // PATCH mutation
    useDismissMatch()             // PATCH mutation
    ```

- [ ] Task 7: Replace 15.1 matching stub (AC: 1)
  - [ ] 7.1: In Story 15.1's Track 2 Step 4 (Task F3), the stub does exact name matching only. Replace the stub with a call to `runBeneficiaryMatching({ batchId })` from this story's service
  - [ ] 7.2: The Track 2 wizard Step 4 now shows real match results with confidence scores instead of "Matching engine not yet active"

- [ ] Task 8: Full regression and verification (AC: all)
  - [ ] 8.1: Run `pnpm typecheck` — zero errors
  - [ ] 8.2: Run `pnpm test` — zero regressions
  - [ ] 8.3: Run `pnpm lint` — zero new warnings
  - [ ] 8.4: Performance test: load 2,500 test beneficiary records + 5,000 loan records → run matching → verify <30 seconds
  - [ ] 8.5: Manual test: upload approval list → run matching → review medium matches → confirm/reject → verify statuses update

## Dev Notes

### Prep Story Context (15.0a–15.0n)

- **15.0l:** Cross-MDA dedup now auto-triggers after upload validation (fire-and-forget). The fuzzy matching engine in this story (15.2) is for beneficiary onboarding matching — different scope but same algorithmic domain. Reuse Levenshtein/Jaro-Winkler benchmarks from dedup service if applicable.

### Existing Infrastructure to Reuse

Story 15.2 builds on established patterns — NOT from scratch:

| Existing | File | What We Reuse |
|---|---|---|
| `normalizeName()` | `apps/server/src/migration/nameMatch.ts:9-44` | Uppercase, strip 23 title patterns, remove parentheticals, collapse whitespace |
| `levenshtein()` | `apps/server/src/migration/nameMatch.ts:60-83` | Custom in-house Wagner-Fischer implementation |
| `surnameAndInitial()` | `apps/server/src/migration/nameMatch.ts:50-54` | Extract surname + first initial |
| Dedup confidence model | `deduplicationService.ts:147-167` | 3-tier: exact (1.0), surname+initial (0.8), fuzzy (0.6) |
| Person matching phases | `personMatchingService.ts:122-242` | Staff ID → exact name → fuzzy pattern |

### What's NEW in This Story

| New Capability | Why Needed |
|---|---|
| **Token-set similarity** | Handles name reordering (surname-first vs given-name-first) — the #1 variant in the dataset |
| **Jaro-Winkler** | Benchmark against Levenshtein for prefix-heavy names (Yoruba naming convention: surname-first) |
| **Confidence bands (0-100)** | More granular than dedup's 3-tier (1.0/0.8/0.6). Needed for the 95%/85%/70% thresholds |
| **Amount disambiguation** | Common names within same MDA — use loan principal as tiebreaker |
| **Human review queue** | Interactive UI for medium-confidence matches |

### Token-Set Similarity: Why It Matters

Standard Levenshtein on full strings fails for reordered names:

```
"ADEWALE ADEOLA SAUDAT"  vs  "SAUDAT ADEWALE"
  Levenshtein: 15 (massive edit distance — looks like different people)
  Token-set:   100% (same tokens, different order)
```

The token-set approach:
1. Tokenize both names into sorted sets: `{ADEWALE, ADEOLA, SAUDAT}` vs `{ADEWALE, SAUDAT}`
2. Intersection: `{ADEWALE, SAUDAT}` → "ADEWALE SAUDAT"
3. diff_a: "ADEWALE ADEOLA SAUDAT" (intersection + A-only)
4. diff_b: "ADEWALE SAUDAT" (intersection + B-only)
5. MAX similarity of all pairs → high score (the intersection covers the core identity)

This handles: surname-first vs given-name-first, missing middle names, extra name parts — all common in this dataset.

### MDA Partitioning for Performance

Naive approach: 2,500 × 5,000 = 12.5M comparisons → too slow.

Partitioned approach: group by MDA, then match within each MDA:
- Largest MDA might have 200 beneficiaries × 500 loans = 100K comparisons
- Most MDAs: 30-50 beneficiaries × 50-100 loans = 5K comparisons
- Total across all MDAs: ~500K comparisons ≪ 12.5M

Each comparison: 2 normalization calls (cached) + token-set similarity = ~0.1ms → 500K × 0.1ms = 50 seconds worst case. With pre-normalization and caching: <30 seconds achievable.

**Optimization:** Pre-normalize all names once into maps keyed by MDA. The matching loop only does token-set comparison (no repeated normalization).

### Confidence Bands vs Existing Model

| This Story | Existing Dedup | Why Different |
|---|---|---|
| 95-100 → HIGH (auto-link) | 1.0 → exact | Lower threshold allows near-exact matches (abbreviations) |
| 85-94 → MEDIUM (review) | 0.8 → surname+initial | Wider band captures more variants for human review |
| 70-84 → LOW (flagged) | 0.6 → fuzzy ≤2 | Continuous scoring instead of discrete tiers |
| <70 → UNMATCHED | No match | Same concept |

The dedup service compares names across MDAs (cross-MDA duplicates). This story compares names within the same MDA (approved → operational). Same normalization, different matching strategy.

### Amount Disambiguation

When multiple loans in the same MDA match a beneficiary name at ≥95%:

```
Approved: "BELLO AMINAT" — ₦450,000 — BIR
Loan A:   "BELLO AMINAT" — ₦450,000 — BIR → score 100%, amount match ✓ → PICK THIS
Loan B:   "BELLO AMINAT" — ₦750,000 — BIR → score 100%, amount mismatch
```

If amounts also match (within ₦1,000 tolerance): auto-link to that loan.
If amounts don't match any candidate: downgrade all to MEDIUM (human decides).

### Jaro-Winkler vs Levenshtein: Team Decision 1

The team decided to implement both and benchmark empirically (Team Review, Decision 1):
- **Jaro-Winkler** favours prefix matches → good for Yoruba surname-first convention where the surname (prefix) is the most stable identifier
- **Levenshtein** handles insertions/deletions → good for missing middle names and abbreviations
- Benchmark on a 20-record fixture set with known variants from actual approval files
- Pick the one with better precision at 85% and 95% thresholds
- The losing algorithm stays in the code but isn't the default

### Future: Staff ID Auto-Upgrade (Epic 13 Integration)

AC7 in the epic (deferred from this story): when a loan later gets a Staff ID populated via Epic 13, and that Staff ID matches a previously medium-confidence name match, the confidence auto-upgrades. This is a hook for Epic 13, not built in this story — but the `match_confidence` column supports it.

### What This Story Does NOT Build

- **Monthly onboarding scan** — Story 15.3 (hooks into submission pipeline)
- **Onboarding dashboard** — Story 15.4 (curves, per-MDA drill-down)
- **Retirement verification** — Story 15.5 (retiree → pathway 4)
- **Staff ID auto-upgrade** — Epic 13 integration (future)
- **Cross-MDA matching** — already handled by dedup service (Story 3.8). This story matches within same MDA only

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Name normalization | `apps/server/src/migration/nameMatch.ts` | 9-44 (normalizeName), 50-54 (surnameAndInitial), 60-83 (levenshtein) |
| Dedup matching | `apps/server/src/services/deduplicationService.ts` | 99-169 (detectForPair) |
| Person matching | `apps/server/src/services/personMatchingService.ts` | 122-242 (3-phase matching) |
| Loans table | `apps/server/src/db/schema.ts` | 109-140 (staffName, mdaId, principalAmount) |
| Approved beneficiaries table (15.1) | `apps/server/src/db/schema.ts` | Created in Story 15.1 |
| Committee list routes (15.1) | `apps/server/src/routes/committeeListRoutes.ts` | Add match + review endpoints |
| Committee list hooks (15.1) | `apps/client/src/hooks/useCommitteeList.ts` | Add matching hooks |
| New engine | `apps/server/src/services/nameMatchingEngine.ts` | To be created |
| New service | `apps/server/src/services/beneficiaryMatchingService.ts` | To be created |
| Benchmark fixture | `apps/server/src/services/__fixtures__/name-matching-benchmark.json` | To be created |
| Epic 15 full spec | `_bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md` | § "The Matching Problem" |
| Team review | `_bmad-output/planning-artifacts/epic-15-team-review.md` | Decision 1 (algorithm selection) |

### Non-Punitive Vocabulary

- "Needs review" not "Uncertain match"
- "No match found" not "Unrecognized beneficiary"
- Confidence scores are informational, not judgmental
- "Confirm" / "Dismiss" / "Skip" — "Dismiss" not "Reject" (consistent with endpoint `dismiss-match`)

### Testing Standards

- Co-located tests: `nameMatchingEngine.test.ts`, `beneficiaryMatchingService.test.ts`
- Benchmark test: separate from unit tests, logs results for human inspection
- Vitest framework
- Performance assertion: `expect(durationMs).toBeLessThan(30_000)`

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 15.2]
- [Source: _bmad-output/planning-artifacts/epic-15-beneficiary-onboarding-pipeline.md — § The Matching Problem, Algorithm design]
- [Source: _bmad-output/planning-artifacts/epic-15-team-review.md — Decision 1 (algorithm benchmark)]
- [Source: apps/server/src/migration/nameMatch.ts:9-44 — normalizeName (23 title patterns stripped)]
- [Source: apps/server/src/migration/nameMatch.ts:60-83 — levenshtein (custom implementation)]
- [Source: apps/server/src/services/deduplicationService.ts:99-169 — detectForPair 3-tier matching]
- [Source: apps/server/src/services/personMatchingService.ts:64-70 — confidence model]
- [Source: apps/server/src/db/schema.ts:109-140 — loans table (staffName, principalAmount)]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
