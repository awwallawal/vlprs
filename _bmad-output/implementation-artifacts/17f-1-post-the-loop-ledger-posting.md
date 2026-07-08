# Story 17f.1: Post the Loop — Submission/Payroll → Ledger Posting Pipeline (W1)

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As **every computed surface in the product**,
I want confirmed MDA submissions and payroll uploads to post PAYROLL ledger events with provenance and confidence,
So that dashboards, reports, loan detail, auto-stop, and inactivity detection read live events instead of baseline-frozen figures — the loop the register showed was never wired.

**Origin:** CREATED by Addendum 3 §3 (17f.1) [H1, H2] (published 2026-07-06) + the W2 rider (ii) supersede-safety AC (added pre-signature 2026-07-04). This is **W1** of the frozen verdict — gate-carrier for 17b (with 17f.3). Implements FR103.

**Priority:** first buildable 17f story post-17a; **nothing 17b starts before this + 17f.3 are done** (binding sequence, A3 §6). Epics 19/20 sit explicitly behind this story (statements over a starved ledger would issue baseline-frozen numbers as positions).

## Scope (creation text, consolidated)

Wire `submissionService` and `payrollUploadService` to emit PAYROLL ledger entries with provenance + confidence on every confirmed row, so computed surfaces present live truth, auto-stop becomes reachable from ongoing deductions, `monthlyRecovery` reflects reality, and the 60-day inactivity detector reads entries that exist. Grep-confirmed baseline (2026-07-04): zero occurrences of "ledger" in either service; the detector reads PAYROLL entries nothing writes (`loanService.ts:241–243`).

**Keys follow the W2 rule (A3 §4.4 / W2-AMENDED design):** W1 writes through sound keys, never denormalised identity — `ledger_entries.mdaId` = collecting MDA (historical fact); no reader consumes `ledger_entries.staffId` (deprecated, CI-guarded).

**Regression anchors:** canonical fixtures + the golden harness (contract §10.2#3: harness green before shipping anything touching detection).

## Acceptance Criteria

1. **Given** a confirmed MDA submission row, **When** confirmation commits, **Then** a PAYROLL ledger entry posts with provenance + confidence attributes (FR103). [A3 §3, H1/H2]
2. **Given** a payroll upload row (17.3b path), **When** confirmed, **Then** the same posting applies — one pipeline, two entry points. [A3 §3]
3. **Given** posted events, **When** computed surfaces render (dashboard, reports, loan detail, `monthlyRecovery`, auto-stop, 60-day inactivity), **Then** they read live events, not baseline-frozen figures. [A3 §3, H1]
4. **Given** every posted entry, **When** keyed, **Then** keys follow the W2 rule — collecting-MDA semantics, no denormalised identity, zero `ledger_entries.staffId` readers (CI guard). [W2-AMENDED]
5. **SUPERSEDE-SAFETY AC [W2 rider (ii), verbatim property]:** the upload-supersede purge (`migrationService.ts:903–934`) deletes whole un-shared loan threads — including their ledger entries (`tx.delete(ledgerEntries)` at `:920`) — under a sanctioned trigger-disable. Today that removes only baseline entries; once this story posts real PAYROLL events, a supersede would silently remove posted deduction history with no replay. **AC: posted PAYROLL events must be supersede-safe — block the purge, archive-and-replay, or an equivalent mechanism (Winston/Amelia decide the mechanism at story time; this criterion pins the property: no posted deduction event is silently removed by an upload supersede).**
6. **Given** the golden harness at its pin, **When** this story ships, **Then** the harness is green (it touches detection inputs). [contract §10.2#3]

## Sequencing

- **After:** 17a K-gate (schema carries the W2 amendment first).
- **Gates:** 17b (with 17f.3); Epics 19/20 story decomposition; "live" money screens in Epic 21 (truth-type sequencing).
- **Related:** 17.3b produces identity knowledge; this story posts value — same uploads, two distinct products.

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17f.1; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | A3 §3 — 17f.1 (`scp-addendum-3-2026-07-04.md`) | Story creation: posting pipeline, grep-confirmed baseline, W2-rule keys, harness anchor [H1, H2] |
| 2 | W2 rider (ii) — pre-signature A3 §3 addition (2026-07-04) | Supersede-safety AC (verbatim), source-verified ×3 (Winston, W2-brief author, PM) |

Evidence keys carried: H1, H2 (+ FR103; W2 rider (ii))
Collision resolution: none
Engine status: — (app-side build; SQ-1 posting concept field-proven)
Pending amendments: none — additions queue to A5+
