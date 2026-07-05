# Auditor Station — Install & Setup Guide

This guide travels with the folder. It covers **Gate 0** (the model smoke test you run *now*)
and a forward note on installing the **full station** later.

> **Golden rule: never `git clone` the VLPRS repo onto an auditor laptop.**
> The repo holds the whole app, other side quests, and thousands of citizens' financial records.
> An auditor laptop only ever gets *what's in the box* — and the box is **this `auditor-station/`
> folder**, copied as a built bundle via **encrypted media**, not pulled from git.

---

## Part A — Gate 0 smoke test (do this first)

**Goal:** confirm a small local model reliably emits a *tool call*, and measure its speed, on the
actual target laptop. This gates all build work (`SQ2-0`).

**Footprint on the laptop:** Ollama + two model files + one script. Nothing from the repo, no PII,
no `catalog.db`.

### Steps

1. **Install Ollama.** Run `OllamaSetup.exe`. It starts a background service on
   `http://localhost:11434`. Confirm by browsing to that URL — it should say *"Ollama is running"*.

2. **Pull the candidate models** (needs internet):
   ```powershell
   ollama pull qwen2.5:3b
   ollama pull llama3.2:3b
   # 16 GB RAM (recommended tier) — also pull the bigger, better-routing models:
   ollama pull qwen2.5:7b
   ollama pull qwen2.5:14b
   ```
   **Air-gapped laptop?** Pull on a connected machine, then copy the whole folder
   `C:\Users\<user>\.ollama\models` to the same path on the auditor laptop — or use
   `stage-to-device.ps1 -IncludeModels` (step 3) to do it for you. No internet needed there.

3. **Stage the kit onto your removable device** (run on the machine that has the script/models):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\stage-to-device.ps1            # copies to D:\
   # air-gapped target with no internet to pull? also carry the model blobs:
   .\stage-to-device.ps1 -Drive D:\ -IncludeModels
   ```
   This assembles `D:\auditor-station-gate0\` with the smoke-test script, this guide, a
   double-click `run-gate0.cmd`, and a `MANIFEST.sha256`. **No repo, no `catalog.db`, no PII** —
   Gate 0 only proves the model emits tool calls. Then plug the device into the auditor laptop.

4. **Run it** on the auditor laptop — double-click `run-gate0.cmd`, or from PowerShell:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\gate0-smoke-test.ps1
   ```
   `-ExecutionPolicy Bypass` lets this one unsigned script run without changing any system setting.
   Government laptops usually block unsigned `.ps1` by default; this bypasses it for that run only.

   With no `-Models`, the script **auto-detects every installed candidate** (3B/7B/14B) and tests
   each. Pin an explicit set if you prefer:
   ```powershell
   .\gate0-smoke-test.ps1 -Models qwen2.5:14b,qwen2.5:7b,qwen2.5:3b -Repeats 5
   ```

5. **Read the results table; keep the log** (written to `auditor-station/audit/`). Record two facts:
   - the **winning `model:quant`** string, and
   - the **laptop RAM** (the script prints it).

   These two facts close `SQ2-0`.

### Reading the result

| Signal | Meaning |
|---|---|
| `TOOL CALL` hit rate near full (e.g. 4/4) | Model routes reliably — viable. |
| Mostly prose, few/no tool calls | Not fatal — confirms the **SQ2-4 deterministic fallback router** is required (already planned). Prefer whichever model calls tools more often. |
| **tokens/sec** | 8 GB CPU-only: ~5–15 tok/s is normal. Below ~4 is sluggish (streaming UX still usable); 15+ is comfortable. |
| **load (s)** | One-time per session (cold start). |

### RAM decides the model tier
- **8 GB** → 3B floor (`qwen2.5:3b` / `llama3.2:3b`). Windows takes ~3–4 GB; a 3B Q4 fits the rest.
- **16 GB** → 7B/14B viable — materially better tool-calling and reasoning. If the fleet can be
  specced at 16 GB, do it. Document 8 GB as the *floor*, 16 GB as *recommended*.

---

## Part B — Installing the full station (later, Phase 1+)

> Not built yet. This is the forward shape so the guide is complete.

The auditor laptop receives **only the built `auditor-station/` folder** — code + `data/catalog.db`
+ `vendor/` snapshots — copied via **encrypted USB**, never cloned.

1. **Full-disk encryption (BitLocker)** on the laptop — mandatory before any data lands.
2. **Ollama installed + the pinned model present** (Part A, steps 1–2).
3. **Copy the bundle folder** to the laptop; the app **verifies `MANIFEST.sha256`** and refuses a
   `catalog.db` whose hash doesn't match the signed manifest.
4. **Launch the station** (portable run script in Phase 2; double-click Tauri installer in Phase 3).
5. **Provenance is always on screen** — "data as of `<date>`, snapshot `<sha>`,
   *Operational — non-authoritative pilot*". A copied snapshot is frozen; never present it as live truth.

### Keeping a laptop current
Rebuild `catalog.db` centrally after a pipeline cycle, then redistribute via signed/encrypted media.
The station displays "data as of `<builtAt>`, snapshot `<sha>`" so staleness is visible.

---

## What is NEVER on the auditor laptop
- The VLPRS git repo (app, other side quests, `docs/Car_Loan` source spreadsheets).
- Any online/paid/free LLM API key. The brain is **local Ollama only** — PII never leaves the machine.
- Uncited answers — every figure traces to a `sourceFile`.

See `README.md` and `WAKEUP.md` for context, and `planning/epic.md` for the story ladder.
