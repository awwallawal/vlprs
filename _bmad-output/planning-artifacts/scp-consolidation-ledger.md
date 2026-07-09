# SCP Consolidation Ledger

> **What this is:** the traceability spine across the SCP 2026-04-15 amendment chain — Addendum 1 (A1, published), Addendum 2 (A2, DRAFT), Addendum 3 (A3, DRAFT, H##-keyed), Addendum 4 (A4, DRAFT, L##-keyed). Addenda are **journal entries** (append-only, never edited); stories and FRs are **accounts**; the current specification of any story is the **computed balance** — base text folded with its amendments in the order below. This ledger is where the balances are computed and where every numbered artifact is allocated.
> **Created:** 2026-07-04 (PM John, per the consolidation playbook, PO "go" 2026-07-04).
> **Second reader:** the non-authoring agent (per §G: Fable for this cycle; original "SQ-1 (Opus)" label was a misattribution) — adversarial pass on §B collision rows and §A fold-order; routed via Awwal. Optional cross-track re-run by the Opus agent post-corrections.
> **Maintenance rule:** one row per target; a new addendum may only append to fold chains, never reorder them. The post-signature fold (playbook Step 5, SM Bob) consumes §A top-to-bottom and produces consolidated story files; when a story file exists, its ledger row is marked FOLDED and the story file becomes the single truth.

---

## §A — Fold-order per target (the computed-balance table)

Fold order is strictly chronological: base SCP → A1 → A2 → A3 → A4. "Engine" column = already-landed-in-engine (the SQ-1 implementation exists and is field-validated; the app-side build remains).

### A.1 Stories — multi-addendum stacks (fold with care)

| Target | Fold chain (in order) | Engine | Flag |
|---|---|---|---|
| **17.2** utility port | Base → A1 §3 (content-level MDA verification; folder-aware resolver 4th layer; RESOLVER_ALIAS_MISSING) → A2 §2.4 (hard-block before 17.3b; mid-sheet recurrence scan; 21-file counter) → A3 §4.4 (H5 priority evidence; thread-segmentation utility, merge point (a)) → A4 §3.12 (L2 alias catalogue as fixtures; L11 period markers; L15/L17 record-picker; L10 editable JSON maps) | YES (all A4 items + segmentation) | **X-1** |
| **17.4** PIS | Base → A1 §3 (5 cross-MDA verdicts; bidirectional continuity; N≥3 guard) → A2 §2.4 (canonicalizer hard dep; canonical-exact before Lev; BIR-only pilot; pessimistic 76% name-only framing) → A4 §3.2 (L18 namesake guard + sequential-loans policy; L10 known-variants table) | YES (namesake guard, variant maps) | X-8 |
| **17.4b** canonicalizer | A2 §2.5.1 (created; 9 rules; G5 native-speaker gate) → A4 §3.2 (L13 token-sort; L14 diminutive map ~30 pairs, ops-editable JSON; G5 re-scoped to both rule sets) | YES (both) | **X-2** |
| **17.3b** Identity Anchor Ingest | Base (as MDA Payroll Snapshot) → A2 §2.4 (retitle; PIS-seed framing; BIR-only config; content-vs-filename fix; roster-month limitation) → A4 (consumes the X-3 shared check — no separate build) | Partial | **X-3** |
| **17.5** link candidates / handshake | Base → A1 §3 (OVERLAPPING_MDA_PRESENCE distinct workflow) → A4 §3.6 (L1 native LPC Out; L9 parent/child bypass — same valve as A1's, field-confirmed) | YES (LPC Out extraction) | X-9 |
| **17.13** upload content validation | Base → A4 §3.1 (consolidated ingest amendment: L4/L11 multi-month, L12 stale markers, L15 ghost rows, L16 year mismatch, L19 year-aggregate, L20 content-hash archives) | YES (all six) | X-3 consumer |
| **17.16** property tests / CI | Base → A4 §3.3 (corpus invariants; BEFORE→AFTER delta gate; content-hash invariant; fixture extensions) + A3 contract §10.2#3 (golden harness as treaty) | YES (6 scripts + harness) | **X-5** |
| **17.17** dual-truth dashboard | Base → A1 §3 (absorbs 17.19/20/21; 6-tile participation block; ₦-weighted severity; register panel) → A3 §4.3 (instrument-grading gate — "no refund tier without instrument grading"; PARSER_BLIND with H10 verification as AC #1; month-0 metric) → A4 §3.4 (L19 year-aggregate tier indicator; L6 three-click drill AC; L3 evidence base — state itself NOT re-routed) → W2-approved design §5 note (transfer-month owner-expected vs collector-collected divergence is *signal*, presented as an observation with explanation, never an error) | Partial (grading logic engine-side) | **X-4** |
| **17.18** variance badge | Base → A4 §3.5 (PARSER_BLIND 4th badge state — the L3 residual A3 did not cover) | — | X-4 residual |
| **17.26** refund workflow | Base → A3 §4.1 (REFUND/REVERSAL entry types [H7]; Bakare month-count rule AC [H25]; H8 authority restated) | — | clean |
| **17.33** backfill | Base → A1 §3 (SHA-256 provenance on every output row) → A3 §4.2 (attestation seal; materiality policy; "% loans attested" termination metric [H15]) | — | clean |
| **17a schema** (Winston deliverable + persons-table migrations) | A2 §2.1 (person / inference_sidecar / identity_decision / name_frequency; additive-only; pilot_scope_tag) → A3 §4.5 (W2 brief by reference [H3]; verbatim gate) → **`architect-winston-17a-schema-2026-07-04-W2-AMENDED.md` — delivered + PO-APPROVED 2026-07-04, gate RELEASED** (adds: person_loans junction; loan_mda_reassignments + single mutator; staffId 3-phase deprecation; collecting-MDA semantic; TRANSFER-01 fixture; rule/data layer split + version-stamping for A4 variant maps) | — | **gate released** |

### A.2 Stories — single-addendum touches

| Target | Amendment | Source | Engine |
|---|---|---|---|
| 17.7 loan detail | LPC Out on Identity tab; "submitted-but-not-extracted" Activity Log entries | A4 §3.13 (L1, L3) | YES |
| 17.10 MLE engine | Base → A1 (broadened to ALL CRITICAL+HIGH variance classes incl. 4 register-driven — 14 narrative rows / 12 classes) → A4 §3.11 (STALE_TEMPLATE_MARKER + sequential-loans narratives) *(counts corrected per §G C6)* | A1; A4 (L12, L18) | YES |
| 17.11 missing-record | Base → A2 §4.2.3 (self-healing reconciliation sweep — parked in 17c, couples with 17.11b) → A4 §3.7 (LPC-Out + 2-month grace suppression, reason recorded) *(chain restored per §G C2)* | A2; A4 (L1) | — |
| 17.12 PRP | Base → A1 (DRY_RUN) → A4 §3.9 (multi-month-order idempotence; completeness tie-break) | A1; A4 (L4, L17) | YES (tie-break) |
| 17.15 snapshots | Completeness tie-break picker; drift-as-signal | A4 §3.10 (L6, L17) | YES |
| 17.22 Path 3 | LPC-Out-with-debt → handshake, not Path 3 | A4 §3.8 (L1) | — |
| 17.32 auditor role | CSV as primary export (FR108) | A4 §3.14 (L8) | YES (report engine) |
| 17.8, 17.9, 17.5, 17.12, 17.4 | A1 §3 amendments as published (tolerance bands to scheme_config; 3 new variance classes; OVERLAPPING workflow; DRY_RUN; verdicts/N≥3) — folded into their §A.1/§A.2 chains above | A1 | — |

### A.3 New stories, epics, agreements (creations — no fold, allocation only)

| Created | By | Notes |
|---|---|---|
| 17.6a, 17.3c, 17.3d, 17.3e, **17.33a** (Quarterly Reconciliation Inventory auto-regen) | A1 §3 | A1's five creations (net 37→39; 17.19/17.20/17.21 retired into 17.17). **17.33a restored per §G C1** — quarterly cron + diff-to-previous + AG heartbeat + per-MDA CRITICAL trend + engine-SHA versioning. A2 §4.2 parks 17.3c/d schema fanout in 17c |
| 17f.1–17f.7 (Foundation Repair) | A3 §3 | Sub-epic gate: 17a → **17f** → 17b → 17c; 17f.2 timing = PO decision D-a. **17f.1 carries the supersede-safety AC [W2 rider (ii)]** (posted PAYROLL events must survive upload supersede — `migrationService.ts:903–934`), added pre-signature 2026-07-04 |
| 17.4b, 17.4d, 17.obs | A2 §2.5 | 17a scope |
| 17.4c, 17.4e, 17.x, 17.y, 17.11b | A2 §4.1 | 17c scope (parked) |
| **17b retrofit amendments — Epics 2 / 5 / 7 / 8 / 14** | A2 §3.1 | DEFERRED placeholders *(added per §G C5)*: person_id staged migration; post-parse inference review; identity exception classes; ID-anchored certs + 17.4d wire-in (highest legal stakes); public-lookup privacy decision. Full story text = Winston, post-pilot authorisation. Listed so the Step-5 fold cannot drop them |
| 15.7 filename hygiene; 17.13b template fingerprint | A4 §2 | 15.0f is DONE — extension story, never an amendment (X-6) |
| Epics 19 (E-issuance), 20 (F-attestation), 21 (UX/IA) | A3 §5 | 19/20 destinations behind W1; Epic 18 = A2 input-only |
| Agreements 23–26 | A2 §6.1 | Published with A2 |
| Agreements 27–29 (TA-A/B/C) | A3 §8 | |
| **Agreement 30** | This ledger §C | Allocation registry + one-open-addendum rule |

### A.4 FRs

| FR | Content | Source |
|---|---|---|
| FR103–FR107 | Posting; refund authority; MDA issuance; borrower attestation; opening-balance seal + materiality | A3 §2 |
| FR108–FR110 | Excel/CSV AG reports; LPC Out first-class; content-integrity observations at ingest | A4 §1 |
| **FR111–FR116** | A1's six, named-but-unnumbered at publication, allocated 2026-07-04 per §G C3: Scheme Participation Headline (6-tile) · MDA Attribution Verification at Ingest · Beneficiary Register Ingest · Employment Event Register Ingest · Register-to-Catalog Match Tiering · Resolver Alias Proposal | A1 §2 (artifact impact) |
| FR85, FR87 | Amended by A1: FR85 + namesake-frequency lookup (catalog+register union calibration); FR87 + 9 variance classes (BALANCE_INCREASE, BALANCE_DECREASE_BEYOND_MONTHLY, MISSING_PRINCIPAL, MDA_ATTRIBUTION_DISAGREEMENT, RESOLVER_ALIAS_MISSING, APPROVED_BUT_NO_RECORD, RECORD_WITHOUT_APPROVAL, RETIRED/DECEASED_BUT_STILL_DEDUCTED) | A1 §2 *(added per §G C3)* |
| FR61, FR101 | Amended (LPC Out field/column) | A4 (L1) |
| FR41/53/54 | Amended (PDF-only stance lifted) | A4 (L8) |
| FR91–92 | Numbering repair (restore to FR body) — see §C exceptions note (a) | A3 §2.7 |
| **IA section** | New PRD section: five altitudes + six primitives; absorbs FR32–37/97/99 — Sally's PRD-delta deliverable *(row added per §G C4)* | A3 §2 (closing) / §5.3 |
| Epistemics statement | PRD preamble | A3 §1 |

### A.5 — FOLDED record (Step-5 fold executed by SM Bob, 2026-07-06)

> Every fold row above is now **FOLDED**: the consolidated story file is the single truth; the addenda are journal history (Agreement 30). Fold plan + spec: `implementation-artifacts/fold-manifest-2026-07-06.md` (persisted replacement for the step-2 chat handoff). Each file carries the mandatory provenance footer = the step-4 checksum surface.

| Target | Consolidated file (in `implementation-artifacts/`) | Chain folded | FOLDED |
|---|---|---|---|
| 17.2 | `17-2-port-side-quest-utilities.md` | Base → A1 §3 → A2 §2.4/§2.6 → A3 §4.4 → A4 §3.12 [X-1, X-3 host] | ✅ 2026-07-06 |
| 17.17 | `17-17-dual-truth-dashboard-rendering.md` | Base → A1 §3 → A3 §4.3 (grading gate verbatim) → A4 §3.4 → W2 §5 [X-4] | ✅ 2026-07-06 |
| 17.4 | `17-4-person-identity-service.md` | Base → A1 §3 → A2 §2.4 → A4 §3.2#3–4 [X-8 consumer] | ✅ 2026-07-06 |
| 17.4b | `17-4b-yoruba-name-canonicalizer.md` | A2 §2.5.1 (base) → A4 §3.2#1–2 → W2 rule/data split [X-2] | ✅ 2026-07-06 |
| 17.3b | `17-3b-mda-payroll-snapshot-ingestion.md` | Base → A2 §2.4 → A4 §3.1#3 [X-3 consumer] | ✅ 2026-07-06 |
| 17.5 | `17-5-person-link-candidates-transfer-handshake-wiring.md` | Base → A1 §3 → A4 §3.6 [X-9] + **A5 §H#3 guard banner + placeholder AC (sprint-blocked)** | ✅ 2026-07-06 |
| 17.13 | `17-13-upload-pipeline-integration-content-validation.md` | Base → A4 §3.1 (six items) [X-3 consumer] | ✅ 2026-07-06 |
| 17.16 | `17-16-idempotency-property-test-framework.md` | Base → A4 §3.3 + A3 §10.2#3 treaty [X-5] | ✅ 2026-07-06 |
| 17.18 | `17-18-variance-badge-direction-explicit.md` | Base → A4 §3.5 [X-4 residual] | ✅ 2026-07-06 |
| 17.26 | `17-26-overdeduction-refund-workflow.md` | Base → A3 §4.1 (incl. §14-folded blocking ACs) | ✅ 2026-07-06 |
| 17.33 | `17-33-retroactive-backfill-74k-records.md` | Base → A1 §3 → A3 §4.2 | ✅ 2026-07-06 |
| 17a schema | **FOLDED-BY-DELIVERY** — `architect-winston-17a-schema-2026-07-04-W2-AMENDED.md` IS the consolidated truth (PO-approved; an approved design doc is never edited) | A2 §2.1 → A3 §4.5 → W2-AMENDED delivery | ✅ 2026-07-06 |
| 17.7 | `17-7-loan-detail-page-unified.md` | Base → A4 §3.13 | ✅ 2026-07-06 |
| 17.10 | `17-10-most-likely-explanation-suggestion-engine.md` | Base → A1 §3 → A4 §3.11 (counts per §G C6) | ✅ 2026-07-06 |
| 17.11 | `17-11-missing-record-detection-mda-prompt.md` | Base → A2 §4.2.3 (recorded, 17c-parked) → A4 §3.7 (§G C2 chain honoured) | ✅ 2026-07-06 |
| 17.12 | `17-12-person-reconciliation-pass-prp.md` | Base → A1 §3 → A4 §3.9 | ✅ 2026-07-06 |
| 17.15 | `17-15-monthly-dashboard-snapshots.md` | Base → A4 §3.10 | ✅ 2026-07-06 |
| 17.22 | `17-22-settlement-pathway-3-event-car-loan-dept-ux.md` | Base → A4 §3.8 | ✅ 2026-07-06 |
| 17.32 | `17-32-external-auditor-read-only-role.md` | Base → A4 §3.14 | ✅ 2026-07-06 |
| 17f.1 | `17f-1-post-the-loop-ledger-posting.md` | Creation A3 §3 [H1,H2] + W2 rider (ii) supersede AC verbatim | ✅ 2026-07-06 (creation text formalised) |
| 17f.2 | `17f-2-staleness-disclosure-chip.md` | Creation A3 §3 [H1] + D-a shipped record (commits `1826c6d`+`660563e`) | ✅ 2026-07-06 (formalisation of shipped work; Status: done) |

**Count for step-4 checksum: 21 marks** (20 files + 1 fold-by-delivery). Out-of-scope §A rows (unfolded by design, reasons in manifest §1): other §A.3 creations (story files at create-story time) + §A.4 FR rows (PRD-delta, PM). **A1–A4 are CLOSED by consolidation per Agreement 30 upon §I.1 sign-off.**

---

## §B — Collision & convergence register (adversarial second-read surface)

Nine rows, X-1 … X-9 — resolutions authored in A4 §6, cross-recorded here verbatim as the second-read checklist. **Second reader verifies:** (1) each resolution names exactly one implementation home; (2) no L## or H## routes to two builds; (3) the 17.2 and 17.17 fold chains produce no contradictory ACs when folded in order; (4) the G5 re-scope (X-2) and the 17a-envelope notes (A3 §4.5, A4 §3.2) don't smuggle scope past Line 1.

| # | Collision / convergence | Resolution (one implementation home) |
|---|---|---|
| X-1 | 17.2 quadruple-stack (A1+A2+A3+A4) | Fold in order; consolidated text at Step-5 fold |
| X-2 | L14 diminutive map ↔ 17a G5 review | 17.4b; G5 re-scoped, one review for both rule sets |
| X-3 | L16 ↔ A2's 17.3b content-vs-filename fix | 17.2 shared utility; 17.3b + 17.13 consume |
| X-4 | L3 ↔ H10 PARSER_BLIND | 17.17 via A3; A4 carries residual only (17.18, 17.7) |
| X-5 | L6/L7 corpus invariants ↔ A3 harness-as-treaty | 17.16, one CI policy, two instrument families |
| X-6 | L5 ↔ 15.0f (done) | New story 15.7 |
| X-7 | FR numbering A3 ↔ A4 | Registry: A3 = 103–107; A4 = 108–110 |
| X-8 | L18 sequential-loans ↔ H21 LOAN_CYCLE | Shared segmentation utility (A3 §4.4) + 17.8 schema; single design |
| X-9 | L9 parent/child ↔ A1's 17.5 OVERLAPPING_MDA_PRESENCE | One valve in 17.5; L9 = field confirmation + sub-case |

---

## §C — Allocation registry (proposed Team Agreement 30)

> **Agreement 30 (proposed, A3 §8 numbering continued):** *Every numbered artifact — addendum, FR, epic, story, agreement — is allocated in this registry **before** any document uses the number. An addendum closes by consolidation into story texts (Step-5 fold) before the next addendum opens. Story truth lives in the story file after consolidation; addenda are journal history.*
> Root cause this fixes: the "Addendum 3" collision — May's lessons package reserved the name informally; July's ledger-reframe package took it independently. A reservation that lives only in a document header is not a reservation.

**Current allocations (2026-07-04):**

| Range | Allocated | Next free |
|---|---|---|
| SCP Addenda | A1–A4 (published) · **A5 (DRAFT 2026-07-09: `scp-addendum-5-2026-07-09-DRAFT.md`; SQ-1 Part-2 three-species package, P1–P9; pending Fable second-read + fold)** | **A6 (Agreement 30: opens only after A5 consolidates)** |
| FRs | …FR102 (PRD) · FR103–107 (A3) · FR108–110 (A4) · FR111–116 (A1's six, retroactive per §G C3) · **FR117 evidence-graded findings [P1] + FR118 structured payroll-request worklists [P8] (A5)** | **FR119** |
| Epics | 1–17 (+17a/17b/17c/**17f**) · 18 (input-only) · 19 · 20 · 21 | **22** |
| Stories | A1's 17.6a/17.3c/17.3d/17.3e/**17.33a** · 17f.1–7 · 15.7 · 17.13b (plus A2's 17.4b/c/d/e, 17.obs, 17.x, 17.y, 17.11b) | per-epic next slot |
| Team Agreements | 1–16 (retros) · 17–22 (SCP) · 23–26 (A2) · 27–29 (A3) · 30 (this ledger) | **31** |

> **Registry annotations:** (i) *Allocation order ≠ authorship order* — A1's FRs were published as named-but-unnumbered and take FR111–116 even though A1 predates A3/A4; renumbering already-drafted addenda pre-signature would be worse than an out-of-chronology registry. The registry, not chronology, is the authority.
> **Exceptions note (per §G C7):** (a) **FR91–92 repair carries no H##** — a deliberate rule exception injected by the A3 drafting prompt itself; its evidence key is the PRD review (Fable critique §8 preamble: FR91–92 in frontmatter, absent from FR body) + PO direction 2026-07-04. Recorded here so the exception is visible, not silent. (b) A3 §10 D-c originally cited **101,338 records** — stale against the live pin; corrected in the A3 draft to the pin-cited figure (**104,396 @ SHA 667ebdd8**, per §D).

---

## §D — Evidence pins (nobody "fixes" a frozen artifact to match a live one)

| Artifact | Pin | Status |
|---|---|---|
| Harmonised findings register (H1–H26) | catalog SHA **83c9e11c…** | ❄ FROZEN — correct at its pin; never edited |
| Golden harness `overdeduction-regression-2026-07.ts` | catalog SHA **667ebdd8…** (re-baselined post-H25 period fix; +1 credible case surfaced from under the month-0 collapse — the fix *working*, consciously re-locked) | LIVE — treaty per contract §10.2#3 |
| Reconciliation Inventory v2 (A1 evidence) | catalog SHA **4960e273…** | Historical pin |
| Reconciliation Inventory v1 | catalog SHA **fc8b5bcb…** | Historical pin |
| **Signature paper trail** — the 33 governance docs presented to (and signed by) the Deputy AG | git commit **`7ef91fd`** on `dev` (pushed) | ✍ SIGNED 2026-07-05 — one SHA identifies exactly what was signed |

Rule: a document cites its pin; divergence between pinned artifacts is *expected across time* and is only an issue if two artifacts claim the same pin with different content.

---

## §E — Signature pack structure — **TWO-LINE, PO-CONFIRMED 2026-07-04 (Awwal)**. Pack-shape decision CLOSED; remove it from the pack's decision list.

- **Line 1 — Authorise 17a activation.** The identical, unchanged ask signature-ready since 2026-04-20 (`DEPUTY_AG_BRIEF_2026-04-20.md`, A2 G9). Nothing in A3/A4 alters it; the W2 schema gate and the G5 re-scope are design inputs *inside* its envelope. **Consequence of signing: Winston's W2-amended schema design becomes the programme's critical path immediately** (persons table arrives Sprint 1–2). **Line-1 latency risk (§G checklist 4):** the G5 re-scope enlarges a Go gate — the native-speaker review now covers the 9 rules + ~30 diminutive pairs + token-sort. Staging option if reviewer availability binds: review the 9 rules for pilot activation; diminutive map as a fast-follow inside the same G5 process. **→ RISK RETIRED 2026-07-07: full-scope G5 executed in one dual-reviewer session (pack `g5-native-speaker-review-pack-2026-07-06.md`, outcome `g5-review-outcome-2026-07-07.md`) — G5 CLEARED at rule-set v2; staging never needed. The gate caught 2 fabricated rules + 2 wrong ground-truth pairs + the canary.**
- **Line 2 — Authorise the consolidated scope:** A2's deferred structure (17b/17c framing, Epic 18 input) + A3 (17f Foundation Repair; PRD delta = FR103–107 + FR91–92 repair + epistemics statement + IA section; the 5-amendment set 17.26/17.33/17.17/17.2/17a-schema; charters 19/20/21; Agreements 27–29; the W1-before-17b rule) + A4 (FR108–110, stories 15.7/17.13b, the 14-amendment hardening set, Agreement 30) + the A1 FR reconciliation (FR111–116). *(Line-2 summary expanded per §G C8.)*
- **Decision list attached to the pack:** A2's four adjudication points · ~~D-a~~ — **CLOSED: ship-and-tell, PO-decided 2026-07-04** (chip ships pre-authorisation as pure disclosure; cover note discloses it; 17f.2 becomes formalisation of shipped work) · D-b (borrower pull-forward — charter now, build post-W1) / D-c (portfolio sweep — authorise with guardrails). ~~Pack shape~~ — **CLOSED: two-line, PO-confirmed 2026-07-04.**

---

## §F — Cycle state (playbook step tracker)

| Step | Status |
|---|---|
| 0 Freeze input set (A1–A4, nothing new) | ✅ 2026-07-04 |
| 1 Re-key lessons → Addendum 4 | ✅ 2026-07-04 (doc header + memory) |
| 2 Draft Addendum 4 (L##-keyed, collisions resolved) | ✅ 2026-07-04 — `scp-addendum-4-2026-07-04-DRAFT.md` |
| 3 Consolidation Ledger | ✅ **COMPLETE** — second-read (§G) → C1–C8 applied (John) → **diff re-read PASS, signed off 2026-07-04 (§G.1)** |
| 4 Two-line signature pack to Deputy AG | 🟡 **pack ASSEMBLED 2026-07-04 (John): `deputy-ag-signature-pack-2026-07-04-DRAFT.md`** — two-line, decision list final, cover note in place (D-a disclosure sentence bracketed pending PO decision). **Appendix W DELIVERED**: `architect-winston-17a-schema-2026-07-04-W2-AMENDED.md` (H3 falsification independently re-run by Winston: PASS all four legs; envelope-clean, zero Line-2 requests) — **endorsed by the W2 brief author (Fable) 2026-07-04, spot-verified from source** (zero `ledger_entries.staffId` readers ✓; `migrationService.ts:903–934` supersede-purge boundary ✓). Endorsement riders: (i) extend the P1 CI guard to also assert the single-mutator rule on `loans.mdaId` (no writes outside `loanOwnershipService`) — closes the gap the deferred DB trigger would have; (ii) **supersede-purge → new 17f.1 AC (John, one line in A3 §3 pre-signature):** post-W1, an upload supersede purges un-shared loan threads *including their posted PAYROLL entries* — 17f.1 must specify replay/protection semantics so posted deduction events cannot be silently destroyed. **Appendix W APPROVED (PO, 2026-07-04)** — gate released; rider (i) folded into the design pre-approval; rider (ii) landed as the 17f.1 supersede-safety AC (A3 §3, pre-signature; purge path re-verified from source by PM before writing the AC). **PACK CLOSED FOR PRESENTATION 2026-07-04** — D-a decided (ship-and-tell; cover-note sentence live). Pre-signature build permission open: 17f.2 chip (D-a) only. **⚠ BOUNDED REOPEN REQUIRED before delivery (Fable, 2026-07-04 PM):** the SQ-1 handoff (`sq1-track-handoff-to-bmad-2026-07-04.md`) arrived post-closure with four H-corrections — **all source-verified by Fable at pin `667ebdd8`** (H20 Adeleke → NEVER_CROSSED_ZERO, harness consciously re-locked at lines 194/199 ✓; H25 the month-0 record is a "WORKING SHEET" ghost bal ₦0.20 and Feb-2025 is genuinely absent ✓; H26 re-derived exactly — 5,458 conformant / 1,662 accelerated / 103 anomalies ✓; H19 accepted on triple-test + in-thread mechanism). **REOPEN EXECUTED + RE-CLOSED (John, 2026-07-04 PM):** handoff §6's seven moves folded into A3 (§1 scope statement; §4.1#4 settlement-path blocking AC; §4.1#5 ghost-≠-claimant AC; §4.4#3 parser behaviours + harness-as-acceptance-test; §6.5/§6.6/§6.7 marked already-landed or extended in place; reopen record = A3 §14). Both cover-note items live in the pack (detection-ceiling scope + settlement-path AC, written for a non-engineer reader). Pack status: **RE-CLOSED FOR PRESENTATION — no open items; sole remaining act: delivery to the Deputy AG.** **17f.2 chip (D-a) SHIPPED 2026-07-05 (John):** `ProvenanceChip` on dashboard money tiles + loan-detail balance; basis = live/baseline/declared/none/unknown (unknown renders nothing — TA-C applied to the chip itself); per-loan provenance from ledger entries in the computation engine; portfolio dataBasis on the metrics response (Zod schema extended). Verified: 16 new tests + 158 server + 380 client regression + 56 dashboard integration tests, typecheck clean both apps. Uncommitted on `dev` pending PO commit call. 17f.2 story text at Step-5 fold = formalisation of this shipped disclosure. **✍ SIGNED — Deputy AG, 2026-07-05 (PO-reported: full pack signed off). §I step 1 ✅ COMPLETE** |
| 5 Post-signature fold (Bob: consolidated story files + sprint-status wiring) | ✅ **VERIFIED + SIGNED OFF (§I.1, Fable, 2026-07-07)** — step-4 all-PASS (fold-order ×4 stacks; 21-row checksum; verbatim gates; conservation; boundary checks incl. 5b immutable-after-FOLDED = 17-4b untouched post-G5). A1–A4 CLOSED by consolidation; Sprint-1 plan activated; A5 unblocked. *(Fold-execution record retained below.)* — 🟡 **FOLD EXECUTED (Bob, 2026-07-06).** Pre-fold verification of step 2: PASS with findings — F1: pack Line-2 signature block untranscribed (PO confirmed both lines signed; transcription completed with dated note, signature blocks only); F2: step-2 handoff block was chat-only (fix: persisted `fold-manifest-2026-07-06.md` as the standing fold plan); F3: governance-table heading corrected 17–22 → 17–30. Fold record: **§A.5 — 21 marks** (20 consolidated story files + 17a-schema fold-by-delivery); 17.17 instrument-grading gate + 17f.1 supersede-safety AC carried verbatim; 17.5 carries the A5 §H#3 guard banner + placeholder AC and is marked sprint-blocked. Sprint-status wired (key = filename rule + block pointer). 17a Sprint-1 plan drafted DRAFT-gated on §I.1. — **§I step 2 ✅ COMPLETE (John, 2026-07-06):** A2/A3/A4 flipped DRAFT → PUBLISHED (A2 → `planning-artifacts/scp-2026-04-15-addendum-2.md` per its own terms; A3/A4 renamed sans -DRAFT, git-mv history preserved; signed pack untouched as historical record); A3 §9 change-list APPLIED to epics.md (Epic 17 signature banner; Agreements 23–30 in the governance table; Epic 17f section + Epics 19/20/21 charters) and sprint-status.yaml (epic-17 in-progress w/ sub-epic tags + amended-story map; 17f block w/ 17f-2 done; new entries 17-4b/17-4d/17-obs/17-13b/15-7; epic-19/20/21 stubs; binding-sequence + 17.5-guard comments). **Next: Bob executes §I step 3 per John's handoff block** |
| 6 Agreement 30 adopted | ✅ **IN FORCE — formally recorded 2026-07-06** in the epics.md governance table (Agreements 23–30 adopted; 27–30 effective from signature) |
| ✍ | **SIGNATURE RECORD:** Deputy AG signed the full pack 2026-07-05. Authorisation in force: **Line 1** — 17a activation (W2-amended schema approved; G5 staging option available) · **Line 2** — consolidated scope (17f Foundation Repair; PRD delta FR103–110 + FR91–92 + IA section + epistemics; the story-amendment sets of A3+A4; Epics 19/20/21 charters; Agreements 27–30; A1 FR reconciliation FR111–116; W1-before-17b rule; D-c portfolio sweep with guardrails). Next actions per §I: step 2 John, step 3 Bob, step 4 Fable, step 5 A5 opens from §H |
| §I step 5 A5 | 🟡 **A5 DRAFTED (John, 2026-07-09): `planning-artifacts/scp-addendum-5-2026-07-09-DRAFT.md`** — P1–P9 keys appended to the handoff (§9); routes: FR117 evidence-graded findings [P1] + FR118 structured payroll-request worklists [P8] + payroll-master-resolver scope [P7] (PRD delta); 5 proposed fold rows on consolidated 17.5/17.4/17.3b/17f.2/17.16 (§6 — appends, NOT rewrites); Species B/C proactive worklists → 16.1/17f.6; PO decision list R-1…R-4 (Fable §H recs). **Next: (a) PO ratifies R-1…R-4; (b) Fable second-read (A5 §7); (c) Bob folds the §6 rows + fold-verify; (d) chain-closed marker.** A6 stays closed (Agreement 30). |

---

## §G — Second-read record (adversarial pass, executed 2026-07-04)

**Reader:** Fable agent, routed via the PO. (Header line above says "SQ-1 (Opus) agent" — label swap carried over from an earlier misattribution; the operative assignment is *the non-authoring agent*, which for this cycle is Fable. If the PO wants cross-track independence as well, the Opus agent can re-run this checklist post-corrections.)
**Method:** full read of this ledger + the A4 draft by the reader; two independent source-verification passes (A1+A2 full amendment text; A3 full draft) — per the discipline, results of source checks outrank the ledger's prose.

### Verdict: **CORRECTIONS REQUIRED before pack assembly.** §B collision resolutions: ALL PASS. §A completeness: FAILS on three counts (below). The author's own caveat on the A1 rows was justified — heading-level construction missed real content, which is exactly what this second-read exists to catch.

### §B checklist results
1. One implementation home per resolution — **PASS** (X-1…X-9 verified against A4 §6 and sources).
2. No dual-routed L##/H## — **PASS.** The X-4 guard held (A4 §3.4.1 explicitly does not re-route PARSER_BLIND; §3.5/§3.13 carry residuals only). All 20 lessons route exactly once (verified by enumeration).
3. 17.2 / 17.17 fold coherence — **PASS**; no contradictory ACs when folded in order.
4. Scope past Line 1 — **PASS, one flag:** the G5 re-scope (X-2) is legitimate design input but **enlarges a Line-1 Go gate** (native-speaker review now covers 9 rules + ~30 diminutive pairs + token-sort). Record in §E as a Line-1 latency risk, with the staging option: review the 9 rules for pilot activation; diminutive map as a fast-follow inside the same G5 process, if reviewer availability binds.

### Corrections required (owner: PM John; then bounded re-read of the diff only, per TA-28)
- **C1 (material):** Add **17.33a** — Quarterly Reconciliation Inventory auto-regeneration, created by A1 §3 (≈ lines 350–363; §7 approval "Add 17-33a"). Missing from §A.3 and §C entirely; A1 created 5 stories, this ledger carries 4.
- **C2 (material):** 17.11 fold chain (§A.2) is missing **A2 §4.2.3** (self-healing reconciliation sweep amendment, parked in 17c, couples with 17.11b) — must precede A4 §3.7 in the chain.
- **C3 (material):** §A.4/§C omit **A1's entire FR contribution** (~6 new FRs: Scheme Participation Headline, MDA Attribution Verification at Ingest, Beneficiary Register Ingest, Employment Event Register Ingest, Register-to-Catalog Match Tiering, Resolver Alias Proposal; + FR85/FR87 extensions — A1 §2 artifact-impact). Reconcile their numbering into the registry **before** FR111 is declared next-free; if A1 left them unnumbered, allocate now.
- **C4:** Add §A.4 row for the PRD-delta **IA section** (five altitudes / six primitives, absorbs FR32–37/97/99 — A3 §2 closing para). Sally's core deliverable currently has no ledger row.
- **C5:** Add §A.3 placeholder rows for A2 §3.1's five **17b retrofit amendments** (Epics 2/5/7/8/14) — deferred is fine; invisible is how they vanish at the Step-5 fold.
- **C6:** §A.1 17.10 row: correct "12 narratives" → **14 narrative rows / 12 classes**, and restore the dropped headline amendment ("MLE broadened to ALL CRITICAL+HIGH classes incl. 4 register-driven").
- **C7:** Append an **exceptions note to §C**: (a) FR91–92 repair carries no H## — a rule exception injected by the drafting prompt itself; record its evidence key explicitly (Fable critique §8, PRD review) rather than leaving a silent self-violation of A3 §0; (b) A3 §10 D-c cites stale "101,338 records" — replace with the pin-cited current figure (104,396 @ SHA 667ebdd8, per §D).
- **C8 (editorial):** §E Line-2 summary under-represents A3 — name its 5-story amendment set, FR91–92, and the epistemics statement.

**Also verified sound, for the record:** all A1/A2/A3 claim-table citations spot-checked were CONFIRMED (only C6's count was loose); §D pins correct; §C allocations correct *except* the C3 FR-layer gap; A4's routing rule held (no L## enters without citation; all 20 lessons enter).

### §G.1 — Diff re-read: ✅ SIGNED OFF (Fable, 2026-07-04; bounded to the C1–C8 diff per Agreement 28 — nothing outside the diff re-litigated)

| Correction | Verified |
|---|---|
| C1 17.33a | ✅ §A.3 row (with story spec summary) + §C stories allocation |
| C2 17.11 chain | ✅ Base → A2 §4.2.3 → A4 §3.7 |
| C3 FR layer | ✅ FR111–116 allocated by name; FR85/FR87 extension row (8 named items / 9 classes with the RETIRED/DECEASED split); next-free FR117; **"allocation order ≠ authorship order" annotation is the right call** — renumbering drafted addenda would have been worse |
| C4 IA-section row | ✅ §A.4, cited to A3 §2 closing / §5.3 |
| C5 17b placeholders | ✅ §A.3, five items enumerated, "deferred ≠ invisible" purpose stated |
| C6 17.10 counts | ✅ 14 rows / 12 classes + broadened-headline restored |
| C7 exceptions | ✅ §C note (a)+(b); **A3 source-verified**: §2.7 carries the declared exception + evidence key; §10 D-c cites 104,396 @ 667ebdd8 with the frozen 101,338 attributed to its own pin (both-correct-at-their-pins framing — exactly §D's rule) |
| C8 §E Line 2 | ✅ expanded; G5 staging option recorded in §E Line 1; header second-reader attribution fixed |

**Ledger status: CONSOLIDATION-READY.** Step-4 blockers remaining: PO pack-shape confirmation + Winston W2 schema. The optional Opus cross-track re-run of §B remains available to the PO but is not a blocker.

---

## §H — A5 queue: SQ-1 Part-2 three-species package (routed by Fable, 2026-07-05 — NO reopen)

**Routing decision:** Part 1 of the SQ-1 handoff contained *corrections* (the pack said wrong things without them) → justified the bounded reopen. **Part 2 (`sq1-track-handoff-to-bmad-2026-07-05.md`) is purely additive** — nothing in the re-closed pack is wrong without it → it does NOT reopen the pack. It is reserved as **Addendum 5**, which per Agreement 30 opens after A1–A4 consolidate at the post-signature fold. **INPUT FREEZE for this signature cycle is now in force: anything further also queues to A5+. The pack ships as re-closed.**

**Verification (Fable, 2026-07-05, at pin `667ebdd8`):** both new detectors re-run — Species B (`projection-register.ts`): 311-case scale + Kolade worked case reproduced verbatim (₦42,499 / 5 deductions / completion ~2025-10); Species C (`transfer-restatement.ts`): worklist + cohorts (BIR→Works ×4, Gov Office→Works ×3) + Oke worked case reproduced verbatim (paid 38→35, +₦33,999 = 3×monthly, CDU reporting-layer correctly separated).

**A5 content queue (H-keyed per contract §10.2#1):**
1. **Evidence-graded finding model** (SPEC) — every reconciliation finding carries a grade (proven / projected / rewound) + a named resolver document; extends the shipped 17f.2 provenance concept from balances to findings. Unifies A/B/C; enforces TA-C at the finding level.
2. **Species A+B proactive worklists** (BUILD) — 16.1/conservation stories emit payslip-request worklists (structured asks: person, MDA, month-range), never refund figures; DELTA watches crossings and resolutions.
3. **Species-C transfer continuity guard** (PLAN, **blocking AC on 17.5/transfer handshake**) — receiving MDA must carry forward true installments-paid; a backward restatement is a blocking reconciliation event, not a silent overwrite; ties to W2 `loan_mda_reassignments` + `person_loans`. **Sequencing note for Bob at Step-5: 17.5 build must not enter a sprint before this A5 guard lands in its story text** (17.5 is post-signature work anyway — the note makes the dependency explicit rather than lucky).
4. **Collector/parent MDA registry** (BUILD, seed-data not schema) — **NOT net-new**: `mdas.parentMdaId` exists and the 17.21 fragment (`is_autonomous` + `reporting_parent_mda`) shipped under parent-SCP Round 3; A5 seeds CDU/AANFE collector semantics so reporting-layer variance never enters the transfer queue. Cohort/batch detection (one handoff fix, not N cases) rides the same stories.
5. **Fixture additions** — Kolade (Species B) and Oke (Species C) join the golden set as canonical anchors (Agreement 15/24 parity).

**Answers to the Part-2 §7 open questions (Fable recommendations, PO to ratify at A5):**
- *Proactive vs on-demand:* engine-side sweeps stay proactive per catalog refresh (already running); app-side B/C surfaces ship as payslip-request queues gated by the evidence-grade model — proactive generation, reviewed consumption.
- *Threshold governance:* ops-editable versioned config (the Winston §7.2 pattern — same as diminutive/typo maps), with a `detector_ruleset_version` stamp on every worklist row so threshold changes are detectable, never silent.
- *Collector registry:* seed data on existing schema (see #4) — not net-new reference data.
- *Do B/C findings post to the ledger?* **No — "if it moves value, it posts; if it moves knowledge, it decides."** Projected/rewound findings are knowledge: they live as observations with evidence grades until a payslip confirms; only AG-authorised refunds/adjustments post (H7 REFUND entry types). The ledger never carries an estimate.

---

## §I — Activation runbook: how the addenda take effect (Fable, 2026-07-05)

The addenda are journal entries; they "take effect" only through this sequence. Each step has one owner, one trigger, one output. Nothing skips a step.

| # | Step | Owner | Trigger | Output |
|---|---|---|---|---|
| 1 | **Deliver the pack** — the one act no agent can perform. Bring: the signature pack (2 lines + decision list), the Query Station for live drill-down (register spec §12.5), the AG worklists as evidence annexes (outside the pack — they show value already flowing) | **Awwal** | meeting secured | Deputy AG signature: Line 1 (17a) and/or Line 2 (consolidated scope) |
| 2 | **Publish + apply** — addenda DRAFT → PUBLISHED for whatever was signed; apply the pre-approved A3 §9 change-list to `epics.md` + `sprint-status.yaml` (17a/17f/17b/17c sub-epic tags, new stories, retirements); formally adopt Agreements 27–30 into the team-agreements record | John | signature | planning artifacts match the signed scope; Agreement 30 (registry + one-open-addendum) becomes binding |
| 3 | **Step-5 fold** — consume §A top-to-bottom; for every amended story produce the consolidated story file (base + amendments in fold order, provenance footer listing which addenda touched it); mark ledger rows FOLDED. From each FOLDED moment, **the story file is the single truth and the addenda become history** | Bob (SM) | step 2 complete | consolidated story files; A1–A4 close per Agreement 30 |
| 4 | **Fold verification** — second reader checks fold-order on the multi-addendum stacks (§A.1, esp. 17.2 ×4 and 17.17 ×4) + checksum: each story file's provenance footer must match its ledger rows | Fable (non-authoring agent) | step 3 complete | fold sign-off appended here (§I.1 when done) |
| 5 | **A5 opens** — now, and only now (Agreement 30: an addendum closes by consolidation before the next opens). John drafts A5 from the §H queue with `sq1-track-handoff-to-bmad-2026-07-05.md` as its single evidence input, same contract shape as A3/A4: **key the Part-2 findings P1–P9 first** (one evidence doc, one key namespace — the A4/L## pattern), stop-guard, no re-litigating consolidated texts, second-read by the non-authoring agent | John → Fable second-read | step 4 complete | A5 DRAFT, folded onto *consolidated* story files via new ledger rows |
| 6 | **Sprints begin** — 17a first (Winston's approved W2 schema → Bob sprint plan → Amelia), Sally's UX/IA spec in parallel; 17.5 enters no sprint before A5's continuity guard lands in its story text (§H note) | Bob / Sally / Amelia | steps 2–3 for Line-1 scope | working software under the signed envelope |

**Contingency — Line 1 signs, Line 2 does not:** partial fold. Bob folds only the Line-1 scope (17a stories incl. the W2 amendments); A3/A4 remain open drafts, A5 stays reserved (cannot open until they consolidate), and the 17a pilot proceeds alone — exactly what the two-line design was built for. The §H queue and the engine-side detectors lose nothing by waiting: SQ-1 needs no authorisation and keeps producing worklists.

**What must NOT happen:** drafting A5 before step 5 (violates Agreement 30 and would fold amendments onto story texts that do not exist yet); editing any published addendum (journal entries — corrections are new entries); starting 17.5 before its A5 guard.

---

## §I.1 — Fold verification (§I step 4): ✅ SIGN-OFF (Fable, non-authoring reader, 2026-07-07)

**Scope (TA-28 bounded):** verified the Step-5 fold diff only — the 20 consolidated story files + the 17a fold-by-delivery pointer + the post-fold events (F1 transcription, G5 records, ledger edits). Did NOT re-litigate addenda content (that closed at §G/§G.1). Result of source checks outranks prose.

### Mandate results — all PASS

**1. Fold-order, the two ×4 stacks (priority per §I step 4):**
- **17.2** (`17-2-port-side-quest-utilities.md`) — chain Base → A1 §3 → A2 §2.4/§2.6 → A3 §4.4 → A4 §3.12, folded strictly chronological; every scope item and AC cite-tagged to its source section ([A1]/[A2 §2.6]/[A3 §4.4, H21]/[A4, L2]…); nothing invented; X-1 quadruple-stack + X-3 host both noted. PASS.
- **17.17** (`17-17-dual-truth-dashboard-rendering.md`) — chain Base → A1 §3 → A3 §4.3 → A4 §3.4 → W2 §5 (correctly NO A2); strict order; X-4 dual-route guard explicit (scope #10: "PARSER_BLIND NOT re-routed here"); AC #1 = H10 verification-first by design; transfer-month divergence-as-signal carried from W2 §5. PASS.

**2. Checksum — all 21 §A.5 rows:** 20 story files each carry the mandatory identical-shape provenance footer (swept: all present); 8 footers verified in full against their §A.5 rows (17.2, 17.17, 17f.1, 17.5, 17.26, 17.11, 17f.2, 17.32) — chain, §-cites, evidence keys, collision homes, engine column, and Pending line all match; the §A.5 chain table cross-references the story-file origins with zero mismatch. 21st row (17a schema) confirmed FOLDED-BY-DELIVERY — the PO-approved W2-AMENDED doc is the truth, no file expected. PASS.

**3. Verbatim gates:** 17.17 AC #3 carries **"no refund tier without instrument grading"** verbatim + cite-tagged. 17f.1 AC #5 carries the supersede-safety property verbatim (no posted deduction event silently removed by an upload supersede), citing `migrationService.ts:903–934` + the `tx.delete(ledgerEntries)` at `:920`. 17.5 carries the ⛔ A5 §H#3 guard banner + placeholder AC #6 (QUEUED, not implementable) + `SPRINT-BLOCKED` status line + the footer Pending-amendments exception. PASS.

**4. Conservation:** 21 marks = 20 story files + 1 fold-by-delivery. Git working tree shows **exactly 20 untracked `17*.md` story files** — none stray, none dropped; no 21st file (17a correctly file-less). Out-of-scope §A rows (other §A.3 creations; §A.4 FR rows) enumerated in manifest §1 as N/A with reasons. PASS.

**5. Boundary checks (post-fold events):**
- **5a — F1 pack transcription:** `git diff` on the pack = a single hunk: the Line-2 signature block (`Approved … Date: 05/07/2026`) + a dated SM-Bob transcription note explicitly stating no pack content was altered. Signature blocks only. PASS. *(Minor: the earlier §F step-2 phrase "signed pack untouched" is now imprecise given the Line-2 transcription; the dated note in the pack supersedes it and is self-documenting — non-blocking, flag for John to align wording at next natural edit or in the commit message.)*
- **5b — immutable-after-FOLDED (the load-bearing check):** all 20 FOLDED story files carry mtime 2026-07-06 (18:04–18:15); both G5 docs are 2026-07-07 (15:31 / 15:44). **`17-4b-yoruba-name-canonicalizer.md` = 2026-07-06 18:06 — NOT modified after the 07-07 G5 work**, despite the G5 outcome legitimately wanting to touch its v2 match-count. The one-day-old immutability discipline held under its first real temptation; the outcome doc correctly routes those edits to future A5 fold rows (Agreement 30). PASS.
- **5c — ledger append-only:** one removed line in the entire post-step-2 ledger diff — the §F step-5 row extended in place, prior step-2 content preserved verbatim within the new line. All other changes (§A.5 subsection, §E "RISK RETIRED" sentence, §H, §I, §D pin) are pure additions. PASS.

### Two green observations (fold being *more* precise, not defects)
- §A.1's original 17.2 chain cited "A2 §2.4"; the fold refined it to "A2 §2.4/§2.6" (correctly attributing the sequencing hard-block to §2.6). §A.5 and the story footer match each other exactly — a traceability improvement.
- 19 of 20 footers add a helpful parenthetical to the Pending line naming the adjacent A5 item (e.g. 17.26 "evidence-graded model touches findings, not this workflow — A5 §H#1"); disciplined, not noise.

### Consequences (now in force)
- **A1–A4 CLOSE by consolidation** per Agreement 30. From their FOLDED marks the 20 story files + the W2-AMENDED doc are the single truth; the addenda are journal history.
- **17a Sprint-1 plan ACTIVATES** — `sm-bob-17a-sprint1-plan-2026-07-06.md` un-gated (Sprint 1 = 17-2 + 17-4b + 17-3b; W2 migrations 8–9; TRANSFER-01 joins the golden set).
- **§I step 5 UNBLOCKS** — John may open A5 from the §H queue (P1–P9 keying first; single evidence input `sq1-track-handoff-to-bmad-2026-07-05.md`; A5 amendments land as new fold rows on the *consolidated* files).

**Note for John (do not execute here):** one clean commit should sweep the fold batch (20 files) + `fold-manifest-2026-07-06.md` + both G5 docs + `sm-bob-17a-sprint1-plan-2026-07-06.md` + the ledger/sprint-status/pack updates as a single verified unit — the verify-then-commit order was chosen precisely so the history shows one verified fold rather than a trickle. Align the §F step-2 "untouched" wording (5a note) in that commit.
