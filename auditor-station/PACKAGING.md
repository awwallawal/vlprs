# Auditor Station — Packaging & Distribution (SQ2-8)

This covers how the station is distributed. It has two layers: **what works today** (no funds,
no extra toolchain) and **the funded one-click installer** (documented; needs a Rust toolchain,
the target machine, and a code-signing certificate to build and verify).

---

## Layer 1 — works today (built, tested)

### Run it
Double-click **`run-station.cmd`** (or `pnpm start`). The station:
- auto-selects the model by the laptop's RAM (`STATION_MODEL` overrides — see `src/lib/model-profile.ts`),
- verifies `MANIFEST.sha256`, decrypts the catalog **in memory** (with `STATION_DB_KEY`),
- serves `http://127.0.0.1:8717` — fully offline, writes a local audit entry per question.

This already satisfies the spirit of "double-click, offline, decrypts, answers, shows provenance,
writes an audit entry."

### Distribute it
```
pnpm bundle                 # → ../auditor-station-bundle  (clean + BUNDLE.sha256)
pnpm bundle -- --out D:\dist
```
The bundle excludes `node_modules`, `.env` (the secret), the plaintext db, audit logs, and tests;
it carries the **encrypted** catalog + manifest + a `BUNDLE.sha256` over every file. On the laptop:
1. `manage-bde -status C:` → BitLocker On (see `GOVERNANCE.md`).
2. Verify `BUNDLE.sha256`, copy the folder via encrypted media.
3. `pnpm install --ignore-workspace` (one-time deps).
4. Create `.env` (PIN + `STATION_DB_KEY`, delivered separately).
5. `run-station.cmd`.
6. `pnpm copy-log -- --laptop "<id>" --operator "<name>"`.

### Model setup (one-time, air-gap friendly)
Install Ollama; `ollama pull qwen2.5:7b` (and 3b/14b). Air-gapped: copy `~/.ollama/models`
across (or `stage-to-device.ps1 -IncludeModels`). RAM→model is automatic at launch.

### Audit export
`pnpm audit:export` → `audit/exports/audit-export-<stamp>.csv` for AG-office review.

---

## Layer 2 — the funded one-click installer (NOT built here)

> Deliberately documented, not implemented: a Tauri app needs the **Rust toolchain**, must be
> built/verified **on the target Windows machine**, and signing needs the **code-signing
> certificate** (APEX Insight Solutions). None of that can be validated on the build box, so
> shipping an untested installer config would be dishonest. This is the funded Phase-3 step.

Intended shape when funded:
1. **Tauri shell** wrapping the existing local server + `web/` chat page (reuse as-is; Tauri just
   hosts them). `src-tauri/` with the Rust entry that spawns the Node/station process.
2. **Ollama as a sidecar** — bundle the Ollama binary + the pinned model as Tauri sidecars so the
   installer is self-contained (no separate Ollama install). Size: model weights are GBs — ship on
   encrypted media, not a download.
3. **RAM→model profile** — already implemented (`selectModelForRam`); the installer just surfaces it.
4. **Code signing** — sign the installer with the APEX certificate so Windows SmartScreen trusts it.
5. **Signed/checksummed update channel** — publish `latest.json` + signed artifacts; the app checks
   a signature before applying. For an air-gapped fleet this may instead be a **manual signed-USB
   update** verified against `BUNDLE.sha256` — simpler and matches the no-internet posture.

### Recommendation
The pilot does **not** need Layer 2. Ship Layer 1 (folder + `run-station.cmd`), validate that
auditors trust and use it, then fund the Tauri installer only if a fleet rollout demands one-click.
