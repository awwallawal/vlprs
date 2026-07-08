# Step-5 Fold Manifest — §I Step 3

**Owner:** SM Bob · **Date:** 2026-07-06 · **Authority:** Deputy AG signature 2026-07-05 (both lines; Line-2 transcription completed 2026-07-06 on PO confirmation — see pack signature blocks) · **Governing records:** `scp-consolidation-ledger.md` §A (fold chains) + §I step 3 (mandate)

**What this is:** the persisted fold plan for the Step-5 fold. John's step-2 handoff block existed only in his session output; this manifest replaces it as the written instruction source, so step-4 verification (Fable) checks fold-order against a plan on disk, not chat memory. Each row below is folded in queue order; completion is marked here (checklist) and in the ledger §A (official FOLDED mark, with file path + date).

---

## 1. Scope decision

**IN SCOPE — consolidated story files produced (20 files + 1 fold-by-delivery):**
- All §A.1 multi-addendum stacks (12 rows; the 17a-schema row folds by delivery — see queue #12).
- All §A.2 single-addendum fold rows (7 rows; the §A.2 final row is a pointer to chains above, not a target).
- Two §A.3 creations explicitly required by the step-3 mandate: **17f.1** (carries the supersede-safety AC = W2 rider (ii)) and **17f.2** (story text = formalisation of work shipped 2026-07-05 under PO decision D-a).

**OUT OF SCOPE — N/A rows, enumerated so the count reconciles (conservation applied to the ledger itself):**
| §A row | Why not folded here |
|---|---|
| §A.3 creations other than 17f.1/17f.2 (17.6a, 17.3c/d/e, 17.33a, 17f.3–7, 17.4b*, 17.4c/d/e, 17.obs, 17.x, 17.y, 17.11b, 15.7, 17.13b, 17b retrofit placeholders, Epics 19/20/21, Agreements) | Creations, not amendments — "no fold, allocation only" (§A.3 header). Story files arrive via create-story at sprint time; their single-source truth is the epic/addendum text. *17.4b is ALSO an §A.1 fold row (amended by A4) and IS folded — queue #4. |
| §A.4 FR rows (FR103–116, FR85/87, FR61/101, FR41/53/54, FR91–92, IA section, epistemics) | PRD-delta territory — PM document work (John), not story files. Not part of the step-3 mandate. |

**FOLDED count for Fable's checksum: 21 ledger §A marks** (20 story files + 17a-schema fold-by-delivery).

---

## 2. Source documents

| Key | Path |
|---|---|
| Base (SCP) | `_bmad-output/planning-artifacts/sprint-change-proposal-2026-04-15.md` (§4.1 story table + cross-refs) |
| Base (epics) | `_bmad-output/planning-artifacts/epics.md` — Epic 17 section (~line 4022+; 17f at ~4158) |
| Base (sprint-status) | `_bmad-output/implementation-artifacts/sprint-status.yaml` — per-story comment (NOTE: comments already embed A1 text; dedupe against A1, the addendum is authoritative) |
| A1 | `_bmad-output/planning-artifacts/scp-2026-04-15-addendum-1.md` |
| A2 | `_bmad-output/planning-artifacts/scp-2026-04-15-addendum-2.md` |
| A3 | `_bmad-output/planning-artifacts/scp-addendum-3-2026-07-04.md` |
| A4 | `_bmad-output/planning-artifacts/scp-addendum-4-2026-07-04.md` |
| W2 design | `_bmad-output/implementation-artifacts/architect-winston-17a-schema-2026-07-04-W2-AMENDED.md` (PO-approved 2026-07-04) |
| Format exemplar | `_bmad-output/implementation-artifacts/15-0n-supersede-data-comparison-correction-reason.md` |

---

## 3. Consolidated story file spec

**Location + naming:** flat in `_bmad-output/implementation-artifacts/`, filename = sprint-status key + `.md` (house convention — the key IS the wiring).

**Structure (house format):** `# Story N.M: Title` · `Status:` (mirror sprint-status; add `— consolidated at Step-5 fold 2026-07-06`) · `## Story` (As-a / I-want / So-that + Origin + Priority) · `## Acceptance Criteria` (Given/When/Then, numbered; amendment-sourced ACs tagged with their evidence key, e.g. `[H25]`, `[L13]`) · supporting sections as needed.

**Fold rules:**
1. Amendments fold in strict chronological order: base → A1 → A2 → A3 → A4 → W2-design notes where the chain includes them. A later amendment extends or supersedes an earlier one *within the story text*; the footer records both.
2. Nothing invented: every substantive sentence traces to a cited source section. Where sources conflict, the ledger §B collision resolution (X-#) governs; note it in the text.
3. Verbatim-gate items are copied verbatim, quoted, and cite-tagged (17.17 instrument-grading gate; 17f.1 supersede-safety AC).
4. Non-punitive vocabulary throughout (Agreement/FR22): Observation not Anomaly, Variance not Discrepancy.

**Provenance footer (mandatory, identical shape — this is Fable's checksum surface):**

```markdown
---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story N.M; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | … |
| 2 | A1 §3 | … |
| … | … | … |

Evidence keys carried: H## / L## / rider cites …
Collision resolution: X-# (…) or "none"
Engine status (per ledger §A): …
Pending amendments: none — additions queue to A5+   ← or the 17.5 A5-guard line
```

---

## 4. Fold queue (execution order)

Deep stacks first (any fold-method defect surfaces in files 1–2, not file 15), then Sprint-1 dependencies (earliest step-4 verification of sprint-critical texts), then remaining §A.1, then §A.2 singles, then the two 17f creations.

| # | Story | Target file | Fold chain (exact cites) | Honour notes | ✅ |
|---|---|---|---|---|---|
| 1 | 17.2 | `17-2-port-side-quest-utilities.md` | Base → A1 §3 → A2 §2.4 → A3 §4.4 → A4 §3.12 | X-1 quadruple stack; X-3 (17.2 hosts the shared content-vs-filename utility; 17.3b + 17.13 consume) | ✅ |
| 2 | 17.17 | `17-17-dual-truth-dashboard-rendering.md` | Base → A1 §3 → A3 §4.3 → A4 §3.4 → W2-design §5 note | X-4; **instrument-grading gate VERBATIM** ("no refund tier without instrument grading"); PARSER_BLIND w/ H10 verification as AC #1; transfer-month divergence = signal, observation-with-explanation, never error | ✅ |
| 3 | 17.4 | `17-4-person-identity-service.md` | Base → A1 §3 → A2 §2.4 → A4 §3.2 | X-8 (segmentation utility lives in A3 §4.4/17.2 + 17.8 schema — single design; 17.4 consumes) | ✅ |
| 4 | 17.4b | `17-4b-yoruba-name-canonicalizer.md` | A2 §2.5.1 (creation = base) → A4 §3.2 | X-2: G5 re-scoped to BOTH rule sets; §E staging option (9 rules for activation, map fast-follow) | ✅ |
| 5 | 17.3b | `17-3b-mda-payroll-snapshot-ingestion.md` | Base → A2 §2.4 → A4 (X-3 consumer — no separate build) | X-3: consumes 17.2's shared check | ✅ |
| 6 | 17.5 | `17-5-person-link-candidates-transfer-handshake-wiring.md` | Base → A1 §3 → A4 §3.6 | X-9 (one valve; L9 = field confirmation + sub-case); **PENDING: A5 §H#3 Species-C continuity guard = BLOCKING AC, story enters NO sprint before it lands in this text** | ✅ |
| 7 | 17.13 | `17-13-upload-pipeline-integration-content-validation.md` | Base → A4 §3.1 (L4/L11, L12, L15, L16, L19, L20) | X-3 consumer | ✅ |
| 8 | 17.16 | `17-16-idempotency-property-test-framework.md` | Base → A4 §3.3 + A3 contract §10.2#3 | X-5: one CI policy, two instrument families; golden harness = cross-track treaty | ✅ |
| 9 | 17.18 | `17-18-variance-badge-direction-explicit.md` | Base → A4 §3.5 | X-4 residual only (PARSER_BLIND 4th badge state) | ✅ |
| 10 | 17.26 | `17-26-overdeduction-refund-workflow.md` | Base → A3 §4.1 | REFUND/REVERSAL types [H7]; Bakare month-count rule [H25]; settlement-path blocking AC + ghost-≠-claimant AC (A3 §14 reopen); H8 authority restated | ✅ |
| 11 | 17.33 | `17-33-retroactive-backfill-74k-records.md` | Base → A1 §3 → A3 §4.2 | attestation seal; materiality policy; %-attested termination metric [H15] | ✅ |
| 12 | 17a-schema | **fold-by-delivery — no new file** | A2 §2.1 → A3 §4.5 → W2-AMENDED doc (PO-approved) | The approved W2-AMENDED doc already folds its chain and IS the consolidated truth. Ledger row marked FOLDED-BY-DELIVERY pointing at it. Never edit an approved design doc. | ✅ |
| 13 | 17.7 | `17-7-loan-detail-page-unified.md` | Base → A4 §3.13 (L1, L3) | | ✅ |
| 14 | 17.10 | `17-10-most-likely-explanation-suggestion-engine.md` | Base → A1 §3 → A4 §3.11 | counts per §G C6: 14 narrative rows / 12 classes | ✅ |
| 15 | 17.11 | `17-11-missing-record-detection-mda-prompt.md` | Base → A2 §4.2.3 → A4 §3.7 | chain restored per §G C2; A2 sweep parked in 17c — record in text | ✅ |
| 16 | 17.12 | `17-12-person-reconciliation-pass-prp.md` | Base → A1 §3 → A4 §3.9 | | ✅ |
| 17 | 17.15 | `17-15-monthly-dashboard-snapshots.md` | Base → A4 §3.10 (L6, L17) | | ✅ |
| 18 | 17.22 | `17-22-settlement-pathway-3-event-car-loan-dept-ux.md` | Base → A4 §3.8 (L1) | | ✅ |
| 19 | 17.32 | `17-32-external-auditor-read-only-role.md` | Base → A4 §3.14 (L8, FR108) | | ✅ |
| 20 | 17f.1 | `17f-1-post-the-loop-ledger-posting.md` | Creation: A3 §3 [H1, H2] + W2 rider (ii) | **supersede-safety AC VERBATIM** (posted PAYROLL events survive upload supersede — `migrationService.ts:903–934`; block, archive-and-replay, or equivalent) | ✅ |
| 21 | 17f.2 | `17f-2-staleness-disclosure-chip.md` | Creation: A3 §3 [H1] + D-a decision | **Formalisation of SHIPPED work** (commits `1826c6d` + `660563e`) — past tense record: what shipped, tests, adversarial-review record, TA-C application. Status: done. | ✅ |

---

## 5. After the fold

1. Mark each ledger §A row **FOLDED (2026-07-06, → file)** as its file lands.
2. Wire sprint-status.yaml: per-story comment gains `CONSOLIDATED → <filename> (Step-5 fold 2026-07-06)`; the story file is the single truth from that mark.
3. Draft 17a Sprint-1 plan — **DRAFT, activates on §I.1 fold sign-off** (migrations 8–9 per W2-AMENDED §11; TRANSFER-01 joins golden fixtures; Sprint 1 = 17-2 + 17-4b + 17-3b per the standing 17a plan).
4. Hand off to Fable (§I step 4): FOLDED count (21) + per-file diff list (ordered §-cites applied) + priority verification targets = queue #1 and #2 (the ×4 stacks) + footer-vs-ledger checksum on all rows.
