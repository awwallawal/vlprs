# Story 17.32: External Auditor Read-Only Role

Status: backlog — consolidated at Step-5 fold 2026-07-06

## Story

As an **external auditor (federal AG, civil society, parliamentary access)**,
I want a scoped read-only role with audit-log feed and standard-format export — CSV first-class,
So that independent verification of scheme figures is possible without write access and without format friction.

**Origin:** SCP 2026-04-15 §4.1 (base). Amended ×1: Addendum 4 §3.14 (published 2026-07-06) [L8, FR108].

**Priority:** core Epic 17, Backfill & Pilot sub-theme. Engine status: YES (report engine).

## Scope (folded)

**Base (SCP §4.1):** scoped queries + audit-log feed + standard-format export. Designed for federal AG, civil society, parliamentary access.

**+ A4 §3.14 [L8]:** **CSV export as a primary format (FR108), not a PDF afterthought** — the AG report cycle proved the working format is spreadsheet-first; the PDF-only stance (FR41/53/54) is lifted by the same addendum.

## Acceptance Criteria

1. **Given** the external-auditor role, **When** provisioned, **Then** access is read-only, query scope is explicit, and every access lands in the audit-log feed. [Base]
2. **Given** any exportable surface available to the role, **When** exported, **Then** CSV is a first-class option alongside PDF (FR108) — column-stable and re-runnable for independent verification. [A4, L8]
3. **Given** a rerun request against pinned inputs, **When** executed with 17.33's hash provenance, **Then** the auditor can verify outputs against the same catalog/script/register hashes. [Base + 17.33 chain]

---
## Provenance (Step-5 fold, 2026-07-06)
Consolidated per scp-consolidation-ledger.md §A. From this FOLDED moment this file is the
single truth for Story 17.32; the addenda are journal history (Agreement 30). Corrections
reopen; additions queue to A5+ as new ledger fold rows.

| # | Source | Contribution |
|---|---|---|
| 1 | Base — SCP 2026-04-15 §4.1 | Read-only role; scoped queries; audit-log feed; standard exports |
| 2 | A4 §3.14 (`scp-addendum-4-2026-07-04.md`) | L8 CSV as primary export format (FR108) |

Evidence keys carried: L8 (+ FR108)
Collision resolution: none
Engine status (per ledger §A): YES — report engine
Pending amendments: none — additions queue to A5+
