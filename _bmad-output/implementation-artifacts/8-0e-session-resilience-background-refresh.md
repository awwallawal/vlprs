# Story 8.0e: Session Resilience — Background Token Refresh

Status: ready-for-dev

## Story

As **any admin user**,
I want the system to keep my session alive while I'm actively working (even if I step away briefly to discuss findings),
So that I'm not logged out mid-workflow during migration uploads or UAT sessions.

**Origin:** UAT Finding #7 from E7+E6 retro (2026-03-29). Current 30-minute inactivity timeout with no background keep-alive is too aggressive for real workflows.

**Dependencies:** None — independent of 8.0a–8.0d. Pure client-side + auth service change.

## Acceptance Criteria

1. **Given** a user is logged in with the dashboard tab open and focused, **When** 12 minutes pass without any API call, **Then** the system silently refreshes the access token in the background, resetting the server-side `lastUsedAt` timestamp without any visible UI change.

2. **Given** a user switches to another browser tab for 20 minutes then returns, **When** the dashboard tab regains focus, **Then** the system immediately attempts a silent token refresh. If successful, the session continues seamlessly. If the refresh token has expired (>7 days) or been revoked, the user is redirected to login.

3. **Given** the background refresh is active, **When** the user has been genuinely idle (no mouse, keyboard, scroll, or API activity) for 55 minutes, **Then** a session warning dialog appears: "Your session will expire in 5 minutes due to inactivity." The user can click "Continue Working" to refresh, or "Log Out" to end the session.

4. **Given** the session warning dialog is shown, **When** the user takes no action for 5 minutes, **Then** the system automatically logs out (revokes refresh token, clears auth store, redirects to login).

5. **Given** a user is mid-workflow (file upload in progress, form partially filled), **When** the background refresh fires, **Then** the refresh is transparent — no interruption, no page reload, no lost form state. The ongoing API call (if any) is not affected.

6. **Given** the background refresh fails (network error, not auth error), **When** the next refresh interval fires, **Then** it retries. The system does not log the user out due to a transient network failure — only explicit `401 REFRESH_TOKEN_EXPIRED` or `SESSION_INACTIVE` triggers logout.

7. **Given** the server-side inactivity timeout remains at 60 minutes, **When** the client refreshes every 12 minutes, **Then** the server's `lastUsedAt` is updated on each successful refresh, preventing the server-side `SESSION_INACTIVE` check from triggering as long as the browser tab exists.

## Tasks / Subtasks

- [ ] Task 1: Increase server-side inactivity timeout (AC: 7)
  - [ ] 1.1: In `apps/server/src/config/env.ts`, change `INACTIVITY_TIMEOUT_MINUTES` from `30` to `60`
  - [ ] 1.2: Verify the server-side inactivity check in `apps/server/src/services/authService.ts` (line 320-326) reads from this config value — confirm it uses `env.INACTIVITY_TIMEOUT_MINUTES` not a hardcoded `30`
  - [ ] 1.3: If hardcoded, refactor to use the env config value
  - [ ] 1.4: **Update existing test** in `apps/server/src/services/authService.refresh.integration.test.ts` at lines 126-135: the current test seeds `lastUsedAt` 31 minutes ago and expects `SESSION_INACTIVE`. After changing timeout to 60 min, 31 min is within the window and this test will FAIL. Change to 65 minutes and update the test description from ">30 min" to ">60 min"
  - [ ] 1.5: Add test in same file: refresh token with `lastUsedAt` 45 minutes ago succeeds (previously would have failed at 30 min — confirms the new 60-min window)
  - [ ] 1.6: Add test in same file: refresh token with `lastUsedAt` 65 minutes ago fails with `SESSION_INACTIVE`

- [ ] Task 2: Add background token refresh interval (AC: 1, 5, 6)
  - [ ] 2.1: Create `apps/client/src/hooks/useBackgroundRefresh.ts`:
    ```typescript
    const REFRESH_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes

    export function useBackgroundRefresh() {
      // Only runs when user is authenticated
      // Sets up setInterval that calls refreshToken() silently
      // refreshToken() returns Promise<boolean> (true=success, false=failure)
      // It does NOT throw — check return value instead of catch:
      //   const ok = await refreshToken();
      //   if (!ok) { /* failure path */ }
      // On success (true): token already updated in auth store internally
      // On failure (false): could be auth failure OR network failure — see E1 note
      // Cleans up interval on unmount
    }
    ```
  - [ ] 2.2: Use the existing `refreshToken()` function from `apps/client/src/lib/apiClient.ts` (lines 19-46) — returns `Promise<boolean>` (NOT `Promise<string>`). It handles cookie-based refresh, CSRF, and auth store update internally. On failure it returns `false` without throwing. **To distinguish auth failure from network failure:** export a `getLastRefreshError()` helper or a `refreshTokenWithReason()` variant from apiClient.ts that returns `'ok' | 'auth_error' | 'network_error'`. Only `auth_error` should trigger logout; `network_error` retries next interval
  - [ ] 2.3: Add guard: skip refresh if an explicit refresh is already in progress (check `refreshPromise` from `apiClient.ts` line 96-100 — may need to export a flag or use a shared ref)
  - [ ] 2.4: Mount `useBackgroundRefresh()` in `apps/client/src/components/layout/DashboardLayout.tsx` alongside existing `useSessionTimeout()`

- [ ] Task 3: Add visibilitychange handler for tab focus (AC: 2)
  - [ ] 3.1: Inside `useBackgroundRefresh.ts`, add a `visibilitychange` event listener:
    ```typescript
    useEffect(() => {
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
          // Tab regained focus — refresh immediately
          // refreshToken() returns boolean, does NOT throw
          const result = await refreshTokenWithReason();
          if (result === 'auth_error') handleAuthFailure();
          // 'network_error' → ignore, retry next interval
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, []);
    ```
  - [ ] 3.2: Debounce: if tab gains focus within 2 minutes of the last successful refresh, skip the immediate refresh (avoid redundant calls when switching tabs rapidly)
  - [ ] 3.3: Track `lastRefreshAt` timestamp (useRef) — updated on every successful refresh (from interval or visibility change)

- [ ] Task 4: Update session timeout thresholds (AC: 3, 4)
  - [ ] 4.1: In `apps/client/src/hooks/useSessionTimeout.ts`, change:
    - `WARNING_THRESHOLD_MS` from `29 * 60 * 1000` (29 min) → `55 * 60 * 1000` (55 min)
    - `LOGOUT_DELAY_MS` from `60 * 1000` (60 sec) → `5 * 60 * 1000` (5 min) — total timeout = 55 + 5 = 60 min, matching server
  - [ ] 4.2: Update warning dialog text in `DashboardLayout.tsx` (line ~320): change from "Your session is expiring soon" → "Your session will expire in 5 minutes due to inactivity."
  - [ ] 4.3: Update "Continue" button label to "Continue Working" for clarity
  - [ ] 4.4: The `onContinue` handler already calls `/auth/refresh` (line 50) — no change needed, just verify it resets the inactivity timer in both client and server

- [ ] Task 5: Coordinate background refresh with inactivity timer (AC: 1, 3)
  - [ ] 5.1: Background refresh (Task 2) resets server-side `lastUsedAt` but should NOT reset the client-side inactivity timer — the client timer tracks real user interaction (mouse, keyboard, scroll), not API activity. This ensures a user who leaves the tab open but walks away for 55+ minutes still gets the warning
  - [ ] 5.2: Remove the `resetActivityTimer()` call from the background refresh path — it should only fire on real API calls initiated by user actions, not background keep-alive
  - [ ] 5.3: Verify: `authenticatedFetch()` in `apiClient.ts` (line 123) calls `resetActivityTimer()` on successful responses — this is correct for user-initiated calls. The background refresh uses `refreshToken()` directly (not `authenticatedFetch`), so it naturally bypasses this reset. Confirm this separation holds

- [ ] Task 6: Full regression and verification (AC: all)
  - [ ] 6.1: Run `pnpm typecheck` — zero errors
  - [ ] 6.2: Run `pnpm test` — zero regressions
  - [ ] 6.3: Manual test scenario A: login → leave tab focused → wait 15 min → verify no logout, no warning, token refreshed (check network tab for POST /auth/refresh)
  - [ ] 6.4: Manual test scenario B: login → switch to another tab for 20 min → switch back → verify session alive (immediate refresh on visibility change)
  - [ ] 6.5: Manual test scenario C: login → leave tab open, don't touch mouse/keyboard → wait 55 min → verify warning appears → click "Continue Working" → verify session continues
  - [ ] 6.6: Manual test scenario D: login → leave tab open, don't touch mouse/keyboard → wait 60 min without clicking "Continue" → verify auto-logout

## Dev Notes

### Current Session Architecture

| Parameter | Current | New (8.0e) |
|---|---|---|
| Access token TTL | 15 min | 15 min (unchanged) |
| Refresh token absolute expiry | 7 days | 7 days (unchanged) |
| Server inactivity timeout | 30 min | **60 min** |
| Client warning threshold | 29 min | **55 min** |
| Client auto-logout delay | 60 sec after warning | **5 min** after warning |
| Background refresh interval | None | **Every 12 min** |
| Tab focus refresh | None | **Immediate on visibility change** |
| Total idle timeout | ~30 min | **~60 min** |

### Why 12 Minutes for Background Refresh

- Access token expires at 15 min — refreshing at 12 min provides 3-min buffer
- Server inactivity timeout at 60 min — refreshing every 12 min means ~5 refreshes before timeout, keeping `lastUsedAt` current
- Not too frequent (saves network/battery), not too infrequent (prevents edge-case expiry)

### Why 60 Minutes for Inactivity Timeout

UAT Finding #7: Awwal was discussing findings with the team during UAT, stepped away for 20-30 minutes, returned to find session expired. A 60-minute timeout accommodates:
- Brief discussions during data review
- Context switching between VLPRS and other tools
- Waiting for upload processing to complete

### Critical: Background Refresh ≠ Activity Reset

The background refresh keeps the server-side refresh token alive (`lastUsedAt` updated) but does NOT reset the client-side inactivity timer. This is by design:

```
Background refresh → resets server lastUsedAt → prevents SESSION_INACTIVE on next explicit refresh
Background refresh → does NOT reset client inactivity counter → user still gets warning at 55 min

User mouse/keyboard → resets client inactivity counter → warning timer starts over
User API call (button click, navigation) → resets client inactivity counter via resetActivityTimer()
```

If background refresh also reset the client inactivity counter, the user would NEVER get logged out (the 12-min refresh would perpetually reset the 55-min counter). The warning/logout mechanism is the user's reminder to return to the session.

### Existing Token Refresh Infrastructure (Reuse)

**`refreshToken()` in `apiClient.ts` (lines 19-46):**
```typescript
async function refreshToken(): Promise<boolean> {
  try {
    const csrfToken = getCsrfToken();
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',  // sends httpOnly refresh cookie
      headers: csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {},
    });
    if (!res.ok) return false;  // auth failure — returns false, does NOT throw
    const body = await res.json();
    useAuthStore.getState().setAuth(body.data.accessToken, body.data.user ?? currentUser);
    return true;
  } catch {
    return false;  // network failure — also returns false
  }
}
```

**Key:** Returns `boolean`, never throws. Auth failure and network failure both return `false`. The background refresh hook must distinguish these — see Task 2.2 for the `refreshTokenWithReason()` approach. This function is already used by `authenticatedFetch()` on 401 responses. No new server endpoint needed.

**Concurrent refresh guard** (`apiClient.ts` lines 96-100):
```typescript
let refreshPromise: Promise<string> | null = null;
// If a refresh is in progress, return the existing promise
```

The background refresh should check this guard before calling `refreshToken()` to avoid parallel refresh requests.

### visibilitychange: Tab Focus Handling

```typescript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Tab regained focus — user is back
    // Refresh immediately unless recently refreshed (<2 min ago)
  }
});
```

This handles the UAT scenario: user switches to Slack/email, discusses findings for 20 min, switches back. The immediate refresh on return prevents the next API call from hitting a 401.

### What This Story Does NOT Change

- **Access token TTL** — stays at 15 min
- **Refresh token absolute expiry** — stays at 7 days
- **Token rotation** — still single-use, rotated on every refresh
- **Token reuse detection** — still revokes all tokens on reuse
- **CSRF protection** — still required on refresh calls
- **Login/logout flow** — unchanged
- **AuthGuard session restoration** — unchanged (handles page reload)
- **authenticatedFetch 401 retry** — unchanged (handles expired access tokens on API calls)

### File Locations

| What | Path | Key Lines |
|---|---|---|
| Server env config | `apps/server/src/config/env.ts` | 28 (INACTIVITY_TIMEOUT_MINUTES) |
| Auth service (refresh) | `apps/server/src/services/authService.ts` | 278-430 (refreshToken), 320-326 (inactivity check) |
| JWT lib | `apps/server/src/lib/jwt.ts` | 5-13 (token creation) |
| Client API client | `apps/client/src/lib/apiClient.ts` | 19-46 (refreshToken fn), 60-126 (authenticatedFetch), 96-100 (concurrent guard), 123 (resetActivityTimer) |
| Session timeout hook | `apps/client/src/hooks/useSessionTimeout.ts` | WARNING_THRESHOLD_MS, LOGOUT_DELAY_MS, activity events |
| Auth store | `apps/client/src/stores/authStore.ts` | Zustand + localStorage |
| Auth guard | `apps/client/src/components/layout/AuthGuard.tsx` | Session restoration on load |
| Dashboard layout | `apps/client/src/components/layout/DashboardLayout.tsx` | 69 (mounts useSessionTimeout) |
| Refresh token tests | `apps/server/src/services/authService.refresh.integration.test.ts` | Existing refresh tests |

### Testing Standards

- Server tests: `authService.refresh.integration.test.ts` (extend with new timeout values)
- Client hook: manual testing + potentially a unit test for the interval/visibility logic using `vi.useFakeTimers()`
- Co-located test files next to source

### Non-Punitive Vocabulary

- Warning dialog: "Your session will expire in 5 minutes due to inactivity" (neutral, informational)
- Button: "Continue Working" (positive action) / "Log Out" (neutral)
- No "kicked out", "timed out", "session killed"

### Team Agreements Applicable

- **Extend, don't fork** — reuse existing `refreshToken()` function, don't create a parallel refresh mechanism
- **No background process leaks** — `useBackgroundRefresh` must clean up interval on unmount

### References

- [Source: _bmad-output/implementation-artifacts/epic-7-6-retro-2026-03-29.md#UAT Finding #7 — Session timeout]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 8.0e]
- [Source: apps/server/src/config/env.ts:28 — INACTIVITY_TIMEOUT_MINUTES = 30]
- [Source: apps/server/src/services/authService.ts:320-326 — Server-side inactivity check]
- [Source: apps/server/src/services/authService.ts:278-430 — Full refresh token flow]
- [Source: apps/client/src/lib/apiClient.ts:19-46 — Client refreshToken function]
- [Source: apps/client/src/lib/apiClient.ts:96-100 — Concurrent refresh guard]
- [Source: apps/client/src/lib/apiClient.ts:123 — resetActivityTimer on API success]
- [Source: apps/client/src/hooks/useSessionTimeout.ts — Current inactivity detection]
- [Source: apps/client/src/components/layout/DashboardLayout.tsx:69 — Hook mounting point]

## Dev Agent Record

### Agent Model Used

(to be filled by dev agent)

### Debug Log References

### Completion Notes List

### File List
