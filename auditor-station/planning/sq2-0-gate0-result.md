# SQ2-0 — Gate 0 Result (CLOSED)

**Ran:** 2026-06-26 on the target auditor laptop
**Hardware:** 15.8 GB RAM (16 GB tier — 7B/14B viable)
**Method:** `gate0-smoke-test.ps1`, 5 measured calls/model, one tool defined
(`search_beneficiary`), question *"Trace BADMUS F.G. across all MDAs"*.
Raw log: `D:/audit/gate0-smoke-2026-06-26-114755.txt` (on the device).

## Results

| Model | Tool-call rate | Tok/s | Cold load |
|---|---|---|---|
| qwen2.5:14b | 5/5 | 1.9 | 0.5 s |
| **qwen2.5:7b** | **5/5** | **3.6** | 17.8 s |
| qwen2.5:3b | 5/5 | 8.1 | 4.8 s |
| llama3.2:3b | 5/5 | 7.3 | 6.5 s |

## Decisions (the SQ2-0 DoD pins)

- **Pinned default brain: `qwen2.5:7b`** — best routing + non-punitive narration of the
  interactively-viable speeds. Goes into `station.config` at SQ2-1/SQ2-5.
- **Fast mode: `qwen2.5:3b`** — configurable snappy alternative (8.1 tok/s), identical numbers.
- **14B rejected for default** — 1.9 tok/s is too slow for interactive Q&A (still selectable).
- **Keep the model resident** via `OLLAMA_KEEP_ALIVE` so the 17.8 s cold load is paid once.

## Go/no-go on the fallback router

**All four models hit 5/5.** Tool-calling is reliable on this hardware, so the SQ2-4
deterministic fallback router is **insurance, not load-bearing**. It is still built as planned
(robustness against phrasing drift / the 4-tool ambiguity), but the design does not depend on it.

## Gate status

✅ **SQ2-0 PASSED — all build work unblocked.** Next: SQ2-1 (folder scaffold + isolation).
