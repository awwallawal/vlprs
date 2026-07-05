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
| SCP Addenda | A1 (published) · A2 (draft) · A3 (draft) · A4 (draft) | **A5** |
| FRs | …FR102 (PRD) · FR103–107 (A3) · FR108–110 (A4) · **FR111–116 (A1's six, allocated retroactively per §G C3)** | **FR117** |
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

Rule: a document cites its pin; divergence between pinned artifacts is *expected across time* and is only an issue if two artifacts claim the same pin with different content.

---

## §E — Signature pack structure — **TWO-LINE, PO-CONFIRMED 2026-07-04 (Awwal)**. Pack-shape decision CLOSED; remove it from the pack's decision list.

- **Line 1 — Authorise 17a activation.** The identical, unchanged ask signature-ready since 2026-04-20 (`DEPUTY_AG_BRIEF_2026-04-20.md`, A2 G9). Nothing in A3/A4 alters it; the W2 schema gate and the G5 re-scope are design inputs *inside* its envelope. **Consequence of signing: Winston's W2-amended schema design becomes the programme's critical path immediately** (persons table arrives Sprint 1–2). **Line-1 latency risk (§G checklist 4):** the G5 re-scope enlarges a Go gate — the native-speaker review now covers the 9 rules + ~30 diminutive pairs + token-sort. Staging option if reviewer availability binds: review the 9 rules for pilot activation; diminutive map as a fast-follow inside the same G5 process.
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
| 4 Two-line signature pack to Deputy AG | 🟡 **pack ASSEMBLED 2026-07-04 (John): `deputy-ag-signature-pack-2026-07-04-DRAFT.md`** — two-line, decision list final, cover note in place (D-a disclosure sentence bracketed pending PO decision). **Appendix W DELIVERED**: `architect-winston-17a-schema-2026-07-04-W2-AMENDED.md` (H3 falsification independently re-run by Winston: PASS all four legs; envelope-clean, zero Line-2 requests) — **endorsed by the W2 brief author (Fable) 2026-07-04, spot-verified from source** (zero `ledger_entries.staffId` readers ✓; `migrationService.ts:903–934` supersede-purge boundary ✓). Endorsement riders: (i) extend the P1 CI guard to also assert the single-mutator rule on `loans.mdaId` (no writes outside `loanOwnershipService`) — closes the gap the deferred DB trigger would have; (ii) **supersede-purge → new 17f.1 AC (John, one line in A3 §3 pre-signature):** post-W1, an upload supersede purges un-shared loan threads *including their posted PAYROLL entries* — 17f.1 must specify replay/protection semantics so posted deduction events cannot be silently destroyed. **Appendix W APPROVED (PO, 2026-07-04)** — gate released; rider (i) folded into the design pre-approval; rider (ii) landed as the 17f.1 supersede-safety AC (A3 §3, pre-signature; purge path re-verified from source by PM before writing the AC). **PACK CLOSED FOR PRESENTATION 2026-07-04** — D-a decided (ship-and-tell; cover-note sentence live). Pre-signature build permission open: 17f.2 chip (D-a) only. **⚠ BOUNDED REOPEN REQUIRED before delivery (Fable, 2026-07-04 PM):** the SQ-1 handoff (`sq1-track-handoff-to-bmad-2026-07-04.md`) arrived post-closure with four H-corrections — **all source-verified by Fable at pin `667ebdd8`** (H20 Adeleke → NEVER_CROSSED_ZERO, harness consciously re-locked at lines 194/199 ✓; H25 the month-0 record is a "WORKING SHEET" ghost bal ₦0.20 and Feb-2025 is genuinely absent ✓; H26 re-derived exactly — 5,458 conformant / 1,662 accelerated / 103 anomalies ✓; H19 accepted on triple-test + in-thread mechanism). **REOPEN EXECUTED + RE-CLOSED (John, 2026-07-04 PM):** handoff §6's seven moves folded into A3 (§1 scope statement; §4.1#4 settlement-path blocking AC; §4.1#5 ghost-≠-claimant AC; §4.4#3 parser behaviours + harness-as-acceptance-test; §6.5/§6.6/§6.7 marked already-landed or extended in place; reopen record = A3 §14). Both cover-note items live in the pack (detection-ceiling scope + settlement-path AC, written for a non-engineer reader). Pack status: **RE-CLOSED FOR PRESENTATION — no open items; sole remaining act: delivery to the Deputy AG.** **17f.2 chip (D-a) SHIPPED 2026-07-05 (John):** `ProvenanceChip` on dashboard money tiles + loan-detail balance; basis = live/baseline/declared/none/unknown (unknown renders nothing — TA-C applied to the chip itself); per-loan provenance from ledger entries in the computation engine; portfolio dataBasis on the metrics response (Zod schema extended). Verified: 16 new tests + 158 server + 380 client regression + 56 dashboard integration tests, typecheck clean both apps. Uncommitted on `dev` pending PO commit call. 17f.2 story text at Step-5 fold = formalisation of this shipped disclosure |
| 5 Post-signature fold (Bob: consolidated story files + sprint-status wiring) | ⬜ post-signature |
| 6 Agreement 30 adopted | ⬜ rides the pack |

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
