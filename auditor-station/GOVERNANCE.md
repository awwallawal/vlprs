# Auditor Station — Governance & At-Rest Security (SQ2-7)

The station holds a snapshot of citizens' financial records. Copying it to a laptop is a
governance event. This document is the policy that must travel and be followed with every copy.

## 1. Full-disk encryption — BitLocker (mandatory)
Before any catalog reaches a laptop, that laptop **must have BitLocker enabled** (full-disk
encryption). This is the primary at-rest control. Verify with `manage-bde -status C:` (should
read *Percentage Encrypted: 100%*, *Protection Status: On*). No catalog lands on an unencrypted
disk — no exceptions.

## 2. Catalog at-rest encryption (defence in depth)
The catalog itself is also encrypted (AES-256-GCM) so it is useless if the file is copied off the
machine.

- **Build encrypted:** set `STATION_DB_KEY` in `.env`, then `pnpm build:catalog`. This produces
  `data/catalog.db.enc` and removes the plain `data/catalog.db`. No plaintext database is written
  to disk at runtime — it is decrypted into memory only.
- **The key is delivered separately from the catalog.** Never put `STATION_DB_KEY` in the copied
  bundle. Hand it to the laptop operator by a different channel; they place it in the laptop's
  local `.env`. Catalog + key together = readable; either alone = useless.
- A wrong key or any modification of the `.enc` file fails decryption (GCM authentication).

## 3. Integrity gate — MANIFEST.sha256
Every build writes `data/MANIFEST.sha256` (the SHA-256 of the catalog artifact). At launch the
station re-hashes the artifact and **refuses to start if it doesn't match** — catching a
corrupted, truncated, or substituted snapshot before any answer is given. Ship `MANIFEST.sha256`
alongside the catalog.

## 4. Snapshot → laptop copy-log (mandatory record)
Every time a snapshot is placed on a laptop, record it:

```
pnpm copy-log -- --laptop "AG-LAPTOP-01" --operator "Your Name" --note "initial deploy"
```

This appends to `audit/copy-log.jsonl` (which snapshot SHA went to which laptop, by whom, when).
Keep this log; it is the accountability trail for where citizen data physically resides.

## 5. What never leaves a controlled channel
- The git repo (app + other side quests + source spreadsheets) — never on an auditor laptop.
- `STATION_DB_KEY` — never in the bundle; separate delivery only.
- Any online/paid LLM key — the brain is local Ollama only; PII never egresses.

## Quick deploy checklist
1. Laptop BitLocker = On (100%).
2. Build with `STATION_DB_KEY` → `catalog.db.enc` + `MANIFEST.sha256`.
3. Copy the `auditor-station/` bundle (encrypted catalog + manifest) via encrypted media.
4. Deliver the key separately; operator sets it in the laptop's `.env`.
5. `pnpm copy-log …` to record the deployment.
6. `pnpm start` — station verifies the manifest, decrypts in memory, and is ready.
