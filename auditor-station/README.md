# Auditor Station (SQ-2)

A **self-contained, offline, local-Ollama** car-loan analyst for the Auditor-General's office.
An auditor asks natural-language questions and gets **cited, non-punitive** answers from the
deduplicated catalog — on their own laptop, **PII never leaving the machine**, at **zero
licensing cost**.

> **This folder is the unit of delivery.** Copy `/auditor-station/` = the whole thing.
> It is a **parallel side quest (SQ-2)** — *not* part of the VLPRS app. The app never imports
> this folder; this folder reads app outputs only once, at build, as snapshots.

## Status

Planning approved 2026-06-23 (Incremental course correction). Build not started.
Gate 0 (`SQ2-0` smoke test) gates all build work. See `planning/epic.md` and
`planning/sprint-status.yaml`.

## The four invariants (what "self-contained" means here)

1. **Severability** — copies anywhere and runs with zero reference to the parent repo.
2. **One-way boundary** — reads repo outputs once at build; the app never imports this folder.
3. **Pipeline isolation** — own `package.json`/lockfile, excluded from root workspace + app CI.
4. **PII hygiene** — `data/` (catalog.db) and `audit/` are gitignored; never committed.

## Brain

Local **Ollama only**. 3B floor at 8 GB RAM; swappable to 7B/14B by config on higher-RAM
laptops. Correctness lives in the deterministic read-only tools, not the model. A deterministic
fallback router guarantees the tools fire even when a small model returns prose.

## Layout (target)

```
auditor-station/
  planning/        epic.md, stories, sprint-status.yaml   ← stories live HERE
  src/server/      4 read-only tools + Ollama adapter + fallback router
  src/web/         plain streaming chat page (NOT the React app)
  scripts/         build-catalog-db.ts, sync-from-parent.ts
  vendor/          snapshotted vocabulary + loan-model (committed, non-PII)
  data/            catalog.db at runtime        ← GITIGNORED (PII)
  audit/           local append-only log        ← GITIGNORED
  station.config   provider=ollama, RAM->model profile, tolerance
  MANIFEST.sha256  integrity of the copy unit
```

## Provenance & mode

Every answer shows the snapshot it used (catalog SHA-256 + build date) and is labelled
**"Operational — non-authoritative pilot"**. A copied catalog.db is frozen — never present a
stale snapshot as live truth.

See `WAKEUP.md` for fresh-session bootstrap.
