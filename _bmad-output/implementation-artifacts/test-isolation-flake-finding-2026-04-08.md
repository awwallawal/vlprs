# Finding: Integration Test Isolation Flake — Audit Log Race

**Date discovered:** 2026-04-08
**Discovered during:** Story 15.0i (Certificate Admin Preview) implementation, full integration suite re-run
**Test fix applied:** ✅ 2026-04-08 (Option 1 — see below)
**Open PM decision:** ⚠️ Production audit-log durability (Option 3 — for E15 retro)

---

## TL;DR

The server integration suite intermittently failed with FK-violation errors of the form `Key (user_id|posted_by)=(...) is not present in table "users"`, even though the user had been inserted moments before by the same test's `beforeEach`. **Root cause:** fire-and-forget audit-log INSERTs from one test were still in flight when the next test's `TRUNCATE users CASCADE` ran. **Test fix is shipped** (drain in-flight audit writes before `resetDb()`). **Open product question** for PM at retro: should production logins/requests await audit-log durability, or is fire-and-forget good enough?

---

## What we observed

- One full integration suite run failed with **23 failed tests across 7 files** (`auditLog`, `authRoutes`, `authRoutes.refresh`, `baseline`, `loanRoutes`, `userRoutes`, `authService`, `authService.refresh`).
- All failures had the same shape: a `db.insert(...)` calling out a `user_id` (or `posted_by`) FK violation, where the referenced user had been inserted by the test's own `beforeEach` moments earlier.
- 5 subsequent runs of the same suite — including 3 back-to-back — passed cleanly (42/42 files, 620/620 tests). **The flake is real but intermittent.**
- Each failing file passes when run in isolation.

## Root cause

**Two code paths in the server fire audit-log writes as `void` / fire-and-forget:**

1. **`apps/server/src/services/auditService.ts:28-47`** — `logAuthEvent()` does `await db.insert(auditLog)` inside a try/catch that swallows errors. Called from `apps/server/src/services/authService.ts:115,130,175,188,234,404,414,436` as `void logAuthEvent({...})`.
2. **`apps/server/src/middleware/auditLog.ts:61-78`** — `auditLog` middleware schedules a fire-and-forget `db.insert(auditLog)` from `res.on('finish')`, i.e. **after** the HTTP response goes back to the client. This fires for every authenticated API request.

**The race:**

```
Test A
  └─ login()                            # SELECT users → returns U1
       ├─ INSERT refresh_tokens (U1)    # OK
       └─ void logAuthEvent({userId: U1})   # ── INSERT audit_log queued ──┐
                                                                          │
Test A finishes                                                           │
                                                                          │
Test B beforeEach                                                         │
  └─ TRUNCATE refresh_tokens, audit_log, users CASCADE                    │
       ↑ takes ACCESS EXCLUSIVE lock on users                             │
       ↑ MAY win the race against the queued INSERT ← race window         │
                                                                          ▼
                                                        in-flight INSERT lands
                                                        AFTER truncate, fails FK
```

When the in-flight INSERT loses the race against `TRUNCATE`, it fires against an empty `users` table and gets an FK violation. The error is silently swallowed by `logAuthEvent`'s try/catch. **What we suspect happens next:** the connection that the failed INSERT was running on enters PostgreSQL's "current transaction is aborted" state until a `ROLLBACK` is sent. When test B then checks out *the same connection* from the pool to do its own `db.insert(users)`, the operation runs against a poisoned connection and reports the same FK error against the user it just inserted (because the connection is still in aborted-tx state and rejects everything until rollback).

**Honesty caveat:** the pool-poisoning step is the most plausible explanation that fits the observed symptoms (test inserts a user; test's *own* immediately-following query fails with FK on that user) but I have not put a Postgres protocol trace on the connection to prove it. The fix below is valid regardless of which exact mechanism is at fault — it removes the race entirely.

## What we shipped (Option 1 — test infrastructure fix)

**No production behavior change.** All the changes are inside `auditService` plumbing and the test reset helper.

**New module: `apps/server/src/services/auditTracking.ts`** — single in-memory registry of in-flight audit writes:

- `trackAuditWrite<T>(p: Promise<T>): Promise<T>` — adds the promise to a `Set`, removes it on settlement, returns the same promise unchanged.
- `drainPendingAuditWrites(): Promise<void>` — `Promise.allSettled()`s every tracked promise; loops until the set is empty (handles writes added mid-drain).

**Wired in two places:**
- `auditService.ts:logAuthEvent` — inner `db.insert` body wrapped in `trackAuditWrite(...)`. Caller stays `void logAuthEvent(...)`.
- `middleware/auditLog.ts` — the fire-and-forget body inside `res.on('finish')` wrapped in `trackAuditWrite(...)`.

**Drain at the top of `resetDb()`:**
```ts
export async function resetDb(): Promise<void> {
  await drainPendingAuditWrites();   // ← new
  await db.execute(sql`TRUNCATE ... CASCADE`);
}
```

This guarantees every TRUNCATE in `resetDb()` runs after every audit INSERT has settled. **The race window cannot exist.**

**Production impact:** zero. `trackAuditWrite` only adds a `Set.add` + `Set.delete` per audit write; nobody reads the registry except `resetDb()` (test-only). The `void` caller semantics are preserved — production code doesn't await audit writes.

## Open question for PM (Option 3 — to discuss at E15 retro)

**Should `login()`, `register()`, and authenticated request audit logs be `await`ed in production, not just in tests?**

- **Today:** A login can return `200 OK` to the user *before* the corresponding `audit_log` row is durable in Postgres. Same for every authenticated API call (the audit row is written from `res.on('finish')` after the response is already on the wire). If the server crashes in that microsecond window, **the audit trail loses entries that the client believes happened.**
- **Compliance angle:** for an Oyo-State public-sector system, audit-trail completeness may be a hard requirement (not just a convenience). Worth a 10-minute discussion at retro whether the current fire-and-forget is acceptable.
- **Cost of awaiting in prod:** ~5–20 ms added to every authenticated request (one extra `INSERT` round-trip). Not nothing, but well below a noticeable threshold.
- **Decision needed by:** PM (Awwal). Action item could become a prep story for whichever epic follows E15.

This is **not** blocked by the test fix — the test fix is shipped regardless of which way this decision goes. They are independent.

## Files changed by the test fix

| File | Action |
|---|---|
| `apps/server/src/services/auditTracking.ts` | **NEW** — registry + drain |
| `apps/server/src/services/auditService.ts` | Wrap `logAuthEvent` body in `trackAuditWrite` |
| `apps/server/src/middleware/auditLog.ts` | Wrap fire-and-forget INSERT in `trackAuditWrite` |
| `apps/server/src/test/resetDb.ts` | Call `drainPendingAuditWrites()` before TRUNCATE |
| `apps/server/src/services/auditTracking.test.ts` | **NEW** — unit test for drain mechanism |

## References

- [Source: `apps/server/src/services/authService.ts:115,130,175,188,234,404,414,436`] — every `void logAuthEvent` call site
- [Source: `apps/server/src/services/auditService.ts:28-47`] — `logAuthEvent` body
- [Source: `apps/server/src/middleware/auditLog.ts:61-78`] — middleware fire-and-forget
- [Source: `apps/server/src/test/resetDb.ts`] — canonical reset helper
- Story 15.0i (Certificate Admin Preview) — the work that surfaced the flake
- E8 retro 2026-04-06, finding precedent: "every fire-and-forget needs a reckoning point in tests"
