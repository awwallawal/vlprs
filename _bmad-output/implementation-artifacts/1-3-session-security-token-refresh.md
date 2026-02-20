# Story 1.3: Session Security & Token Refresh

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-18 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocks: 1.4 (RBAC), 1.5 (Audit Logging), 1.6 (Frontend Auth Shell) -->
<!-- Blocked By: 1.2 (User Registration & Login) — ready-for-dev -->
<!-- FRs: FR42, FR47 | NFRs: NFR-SEC-10, NFR-SEC-11 -->

## Story

As an **authenticated user**,
I want my session to remain secure with automatic token refresh and protection against token theft,
so that my account is protected while maintaining a smooth, uninterrupted experience.

## Acceptance Criteria (BDD)

### AC1: Token Refresh with Rotation

```gherkin
Given an authenticated user with a valid, non-revoked refresh token in their httpOnly cookie
When the client calls POST /api/auth/refresh
Then the old refresh token is revoked (revoked_at set to now())
And a new refresh token is generated, hashed (SHA-256), and stored in the refresh_tokens table
And the new refresh token replaces the old one in the httpOnly cookie
And a new JWT access token (15-minute expiry) is returned in the response body:
  {
    "success": true,
    "data": { "accessToken": "<new JWT>" }
  }
And the refresh_tokens.last_used_at is updated to now()
```

### AC2: Reuse Detection — Token Theft Protection

```gherkin
Given a refresh token that has already been rotated (revoked_at is set)
When a client presents that revoked token to POST /api/auth/refresh
Then ALL refresh tokens for that user are revoked (nuclear revocation)
And the response returns 401:
  {
    "success": false,
    "error": { "code": "TOKEN_REUSE_DETECTED",
               "message": "A security concern was detected with your session. Please log in again." }
  }
And the user must re-authenticate on all devices
```

### AC3: Logout

```gherkin
Given an authenticated user with a valid access token
When they call POST /api/auth/logout
Then ALL refresh tokens for that user are revoked (revoked_at set to now())
And the refresh token httpOnly cookie is cleared
And the CSRF cookie is cleared
And the response returns 200:
  {
    "success": true,
    "data": null
  }
```

### AC4: Inactivity Timeout (30 Minutes)

```gherkin
Given an authenticated user whose last token refresh was more than 30 minutes ago
When the client calls POST /api/auth/refresh
Then the refresh token is revoked
And the response returns 401:
  {
    "success": false,
    "error": { "code": "SESSION_INACTIVE",
               "message": "Your session has expired due to inactivity. Please log in again." }
  }
And the user must re-authenticate

Given an authenticated user whose last refresh was less than 30 minutes ago
When the client calls POST /api/auth/refresh
Then the refresh succeeds and last_used_at is updated to now()
```

### AC5: Single Concurrent Session

```gherkin
Given User A is already logged in with an active refresh token
When User A logs in again from a different device/browser
Then ALL existing refresh tokens for User A are revoked before the new token is issued
And only the new session is active (max 1 concurrent session per user)
And the old device/browser will receive 401 on next refresh attempt
```

### AC6: CSRF Protection

```gherkin
Given the server uses httpOnly cookies for refresh tokens (vulnerable to CSRF)
When the user logs in successfully
Then a signed CSRF token is set in a non-httpOnly cookie (readable by the SPA)

When the client calls any state-changing endpoint (POST /api/auth/refresh, POST /api/auth/logout)
Then the request MUST include the CSRF token in the X-CSRF-Token header
And the server validates the header token matches the cookie token (signed double-submit)
And if the CSRF token is missing or invalid, the response returns 403:
  {
    "success": false,
    "error": { "code": "CSRF_VALIDATION_FAILED",
               "message": "Your request could not be verified. Please refresh the page and try again." }
  }
```

### AC7: Password Change Token Invalidation

```gherkin
Given an authenticated user
When their password is changed (by admin or self-service in a future story)
Then ALL existing refresh tokens for that user are revoked
And the user must re-authenticate on all devices
And the function revokeAllUserTokens(userId) is exported for use by future stories (1.4, Epic 13)
```

### AC8: Refresh Token Expiry

```gherkin
Given a refresh token that has exceeded its 7-day expiry (expires_at < now())
When the client calls POST /api/auth/refresh with the expired token
Then the response returns 401:
  {
    "success": false,
    "error": { "code": "REFRESH_TOKEN_EXPIRED",
               "message": "Your session has expired. Please log in again." }
  }
```

## Tasks / Subtasks

- [x] Task 1: Schema update — add last_used_at column to refresh_tokens (AC: #1, #4)
  - [x] 1.1 Add `last_used_at` column (timestamptz, NOT NULL, DEFAULT now()) to refresh_tokens in `db/schema.ts`
  - [x] 1.2 Run `pnpm drizzle-kit push` to apply schema change
- [x] Task 2: Install new dependencies (AC: #6)
  - [x] 2.1 Install `csrf-csrf` (^4.0.3) in apps/server
  - [x] 2.2 Add `CSRF_SECRET` and `INACTIVITY_TIMEOUT_MINUTES` to `config/env.ts`
  - [x] 2.3 Add `CSRF_SECRET` to `.env.example` and `.env`
- [x] Task 3: CSRF middleware (AC: #6)
  - [x] 3.1 Create `apps/server/src/middleware/csrf.ts` — configure csrf-csrf with signed double-submit cookie
  - [x] 3.2 Mount CSRF protection on state-changing auth routes (refresh, logout)
  - [x] 3.3 Set CSRF cookie on login response (alongside refresh token cookie)
- [x] Task 4: Auth service — new functions (AC: #1, #2, #3, #4, #5, #7)
  - [x] 4.1 Add `refreshToken(tokenFromCookie)` — validate, check expiry, check inactivity, check reuse, rotate, return new tokens
  - [x] 4.2 Add `logout(userId)` — revoke all user tokens
  - [x] 4.3 Add `revokeAllUserTokens(userId)` — exported utility for reuse detection, password change, deactivation
  - [x] 4.4 Modify `login()` — revoke all existing tokens before issuing new (single concurrent session)
  - [x] 4.5 Add `changePassword(userId, newPasswordHash)` — update password + revoke all tokens (infrastructure for future stories)
- [x] Task 5: Auth routes — new endpoints (AC: #1, #3, #6, #8)
  - [x] 5.1 Add `POST /api/auth/refresh` — csrfProtect → handler → authService.refreshToken
  - [x] 5.2 Add `POST /api/auth/logout` — authenticate → csrfProtect → handler → authService.logout
  - [x] 5.3 Modify login route — set CSRF cookie alongside refresh token cookie
- [x] Task 6: Shared package updates (AC: #1, #2, #4)
  - [x] 6.1 Add `RefreshResponse` type to `packages/shared/src/types/auth.ts`
  - [x] 6.2 Add new vocabulary entries to `packages/shared/src/constants/vocabulary.ts`
  - [x] 6.3 Update `packages/shared/src/index.ts` exports
- [x] Task 7: Update app.ts (AC: #6)
  - [x] 7.1 Import and configure csrf-csrf in `apps/server/src/app.ts` — CSRF is per-route, no global mount needed; imports are in authRoutes.ts
  - [x] 7.2 Ensure cookie-parser is mounted before CSRF middleware (dependency from Story 1.2) — verified in app.ts
- [x] Task 8: Tests (AC: all)
  - [x] 8.1 Create `apps/server/src/services/authService.refresh.test.ts` — token rotation, reuse detection, inactivity timeout, expiry
  - [x] 8.2 Create `apps/server/src/middleware/csrf.test.ts` — CSRF validation tests
  - [x] 8.3 Create `apps/server/src/routes/authRoutes.refresh.test.ts` — integration tests for /refresh, /logout, CSRF
  - [x] 8.4 Update `apps/server/src/services/authService.test.ts` — add tests for modified login() (single session enforcement)
  - [x] 8.5 Verify `pnpm test` from root — all tests pass across all 4 workspaces

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 3 of 58** — the session security layer that completes the authentication lifecycle started in Story 1.2. After this story, the VLPRS auth system will have:
- Login (1.2) → Token Refresh with Rotation (1.3) → Logout (1.3)
- CSRF protection for all cookie-based operations
- Inactivity timeout (30 min) enforced server-side
- Single concurrent session per user
- Token theft detection and nuclear revocation
- Infrastructure for password change/account deactivation token cleanup

**What Story 1.2 created that this story builds on:**

| Component | Location | What 1.2 Created |
|---|---|---|
| Auth Service | `services/authService.ts` | `register()`, `login()` — generates access + refresh tokens |
| Auth Routes | `routes/authRoutes.ts` | POST /auth/register, POST /auth/login |
| JWT Library | `lib/jwt.ts` | `signAccessToken()`, `verifyAccessToken()` |
| Password Library | `lib/password.ts` | `hashPassword()`, `comparePassword()` |
| Token Hash | `lib/tokenHash.ts` | `hashToken()` — SHA-256 for refresh tokens |
| AppError | `lib/appError.ts` | Error class with statusCode, code, message, details |
| Authenticate MW | `middleware/authenticate.ts` | JWT verification → req.user |
| Validate MW | `middleware/validate.ts` | Zod schema validation |
| Rate Limiter | `middleware/rateLimiter.ts` | Tiered rate limiting (auth: 5/15min) |
| DB Schema | `db/schema.ts` | users, mdas, refresh_tokens tables |
| Shared Types | `packages/shared/src/types/auth.ts` | User, JwtPayload, LoginRequest/Response |
| Shared Constants | `packages/shared/src/constants/roles.ts` | ROLES, Role, ALL_ROLES |
| Vocabulary | `packages/shared/src/constants/vocabulary.ts` | Auth error messages |

### What NOT To Do

1. **DO NOT create any frontend components** — Story 1.6 builds the login UI and silent refresh client logic. This story is backend-only.
2. **DO NOT create the password reset REST endpoint** — That is Epic 1, Story 1.9a. This story only creates the `revokeAllUserTokens()` and `changePassword()` infrastructure functions.
3. **DO NOT implement audit logging** — Story 1.5. Token revocation events should be logged eventually, but the audit infrastructure doesn't exist yet.
4. **DO NOT implement reCAPTCHA on refresh/logout** — Story 1.6. These endpoints are already protected by authentication + CSRF.
5. **DO NOT use the deprecated `csurf` package** — It was deprecated by the Express.js team. Use `csrf-csrf` v4 (signed double-submit cookie pattern).
6. **DO NOT rely on SameSite=Strict as sole CSRF defense** — OWASP explicitly states SameSite is defense-in-depth only, not a replacement for CSRF tokens. Subdomain attacks and client-side redirects can bypass it.
7. **DO NOT use family_id for token tracking** — With max 1 concurrent session, user-level revocation is sufficient and simpler.
8. **DO NOT create a separate test database** — Use the Docker PostgreSQL instance (port 5433) with test isolation via beforeEach/afterEach cleanup.
9. **DO NOT modify the authenticate middleware** — Story 1.2 already created it. Reuse it for the logout endpoint.
10. **DO NOT store CSRF tokens in the database** — CSRF uses the signed double-submit cookie pattern (stateless). The HMAC signature IS the validation.

### API Endpoints

**POST /api/auth/refresh** (cookie-authenticated, CSRF-protected, rate-limited)

```
Middleware chain: rateLimiter.auth → csrfProtect → handler

Request:
  Cookie: refreshToken=<token> (sent automatically by browser)
  Cookie: __csrf=<csrfToken> (sent automatically by browser)
  Header: X-CSRF-Token: <csrfToken> (set by SPA from cookie)
  No request body required.

Success Response (200):
  JSON body: {
    "success": true,
    "data": { "accessToken": "<new JWT string>" }
  }
  Set-Cookie: refreshToken=<newToken>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800
  Set-Cookie: __csrf=<newCsrfToken>; Secure; SameSite=Strict; Path=/

Error Responses:
  401 — REFRESH_TOKEN_EXPIRED (token past 7-day expiry)
  401 — SESSION_INACTIVE (last_used_at > 30 minutes ago)
  401 — TOKEN_REUSE_DETECTED (revoked token reused — all user tokens nuked)
  401 — REFRESH_TOKEN_INVALID (token not found, malformed, or missing)
  403 — CSRF_VALIDATION_FAILED (missing or invalid CSRF token)
  429 — RATE_LIMIT_EXCEEDED (too many requests)
```

**POST /api/auth/logout** (JWT-authenticated, CSRF-protected)

```
Middleware chain: authenticate → csrfProtect → handler

Request:
  Authorization: Bearer <accessToken>
  Cookie: __csrf=<csrfToken>
  Header: X-CSRF-Token: <csrfToken>
  No request body required.

Success Response (200):
  JSON body: { "success": true, "data": null }
  Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0
  Set-Cookie: __csrf=; Secure; SameSite=Strict; Path=/; Max-Age=0

Error Responses:
  401 — AUTHENTICATION_REQUIRED (no/invalid access token)
  403 — CSRF_VALIDATION_FAILED (missing or invalid CSRF token)
```

### Token Refresh Flow (authService.refreshToken)

```
1. Extract refresh token from cookie (req.cookies.refreshToken)
2. If missing → throw AppError(401, 'REFRESH_TOKEN_INVALID')
3. Hash the token with SHA-256
4. Query refresh_tokens table: WHERE token_hash = hash

5. If not found → throw AppError(401, 'REFRESH_TOKEN_INVALID')

6. If token.revoked_at IS NOT NULL → REUSE DETECTED:
   a. Revoke ALL refresh tokens for token.user_id (UPDATE SET revoked_at = now() WHERE user_id = X AND revoked_at IS NULL)
   b. Throw AppError(401, 'TOKEN_REUSE_DETECTED')

7. If token.expires_at < now() → TOKEN EXPIRED:
   a. Revoke this token
   b. Throw AppError(401, 'REFRESH_TOKEN_EXPIRED')

8. If now() - token.last_used_at > INACTIVITY_TIMEOUT (30 min) → INACTIVE:
   a. Revoke this token
   b. Throw AppError(401, 'SESSION_INACTIVE')

9. TOKEN VALID — Rotate:
   a. Revoke old token: UPDATE SET revoked_at = now() WHERE id = token.id
   b. Load user from users table (need current role, mdaId for new JWT)
   c. If user.is_active === false → revoke token, throw AppError(401, 'ACCOUNT_INACTIVE')
   d. Generate new random refresh token (crypto.randomBytes(64).toString('hex'))
   e. Hash new token with SHA-256
   f. Insert new refresh_tokens row: { userId, tokenHash, expiresAt: now()+7d, lastUsedAt: now() }
   g. Generate new JWT access token with current user claims
   h. Set new refresh token in httpOnly cookie
   i. Set new CSRF token cookie
   j. Return { accessToken } in response body
```

### Logout Flow (authService.logout)

```
1. Get userId from req.user (set by authenticate middleware)
2. Revoke ALL refresh tokens for user:
   UPDATE refresh_tokens SET revoked_at = now()
   WHERE user_id = userId AND revoked_at IS NULL
3. Clear refresh token cookie (res.clearCookie with matching options)
4. Clear CSRF cookie
5. Return success
```

### Single Concurrent Session — Login Modification

**Modify Story 1.2's `authService.login()`** — add one step before token generation:

```
After step 7 (password matches), BEFORE generating new tokens:
  7a. Revoke ALL existing refresh tokens for this user:
      UPDATE refresh_tokens SET revoked_at = now()
      WHERE user_id = user.id AND revoked_at IS NULL
```

This ensures only one active session per user. Previous devices/browsers will get 401 on next refresh.

### CSRF Implementation

**Package:** `csrf-csrf` v4.0.3 (signed double-submit cookie pattern)

**Why csrf-csrf:** Stateless (no session store), OWASP-recommended HMAC-signed pattern, works with cookie-parser (already installed from Story 1.2), actively maintained replacement for deprecated `csurf`.

**`apps/server/src/middleware/csrf.ts`:**

```typescript
import { doubleCsrf } from 'csrf-csrf';

const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret: () => env.CSRF_SECRET,
  getSessionIdentifier: (req) => req.cookies?.refreshToken ?? '',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: false,    // SPA must read this cookie
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  },
  size: 64,             // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

export { doubleCsrfProtection, generateToken };
```

**Cookie layout after login:**

| Cookie | httpOnly | Secure | SameSite | Path | Purpose |
|---|---|---|---|---|---|
| `refreshToken` | Yes | Yes (prod) | Strict | `/api/auth` | Refresh token (immune to XSS) |
| `__csrf` | **No** | Yes (prod) | Strict | `/` | CSRF token (SPA reads this) |

**Login route modification** — after setting the refresh token cookie, also set the CSRF cookie:

```typescript
// In authRoutes POST /auth/login handler, after authService.login():
const csrfToken = generateToken(req, res); // Sets __csrf cookie automatically
```

### Inactivity Timeout Implementation

**NFR-SEC-10:** 30-minute inactivity timeout for all roles.

**Mechanism:** Track `last_used_at` on the refresh_tokens table.

| Event | last_used_at value |
|---|---|
| Login (new token created) | Set to `now()` |
| Token refresh (rotation) | Updated to `now()` |
| Inactivity check (on refresh) | If `now() - last_used_at > 30 min` → reject |

**Why this works with 15-minute access tokens:**
- Active user: access token expires every 15 min → client refreshes → last_used_at updated
- Inactive user: access token expires at T+15 → if no API call until T+31 → refresh fails (31 min > 30 min threshold)
- The maximum "grace window" is ~15 min (access token lifetime). User could be inactive for up to 44 min in worst case (active at T=0, token expires at T=15, refresh at T=14, then inactive until T=44). This is acceptable for a 30-minute policy.

### Schema Update

**Add to `refresh_tokens` table in `apps/server/src/db/schema.ts`:**

```
refresh_tokens (modified):
  ...existing columns from Story 1.2...
  last_used_at    timestamptz NOT NULL DEFAULT now()  -- tracks inactivity
```

This is a single column addition. The column defaults to `now()` so existing rows (if any from 1.2 development) will get a reasonable default.

### revokeAllUserTokens Utility

Create an exported function for use by this story and future stories:

```typescript
// In authService.ts
export async function revokeAllUserTokens(userId: string): Promise<number> {
  const result = await db.update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt)
      )
    );
  return result.rowCount ?? 0; // Number of tokens revoked
}
```

**Consumers:**
- `refreshToken()` — reuse detection (this story)
- `logout()` — logout all sessions (this story)
- `login()` — enforce single concurrent session (this story)
- `changePassword()` — password change invalidation (this story — infrastructure)
- Account deactivation — Epic 1, Story 1.9a (future)
- Admin password reset — Epic 1, Story 1.9a (future)

### Express 5 Cookie Clearing

**Critical:** Express 5 `res.clearCookie()` ignores `maxAge` and `expires` options. You MUST pass the same `path`, `httpOnly`, `secure`, and `sameSite` that were used when setting the cookie.

```typescript
// Clear refresh token cookie
res.clearCookie('refreshToken', {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  // DO NOT pass maxAge or expires — Express 5 ignores them
});

// Clear CSRF cookie
res.clearCookie('__csrf', {
  httpOnly: false,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
});
```

### Shared Package Additions

**`packages/shared/src/types/auth.ts`** — add:
```typescript
export interface RefreshResponse {
  accessToken: string;
}
```

**`packages/shared/src/constants/vocabulary.ts`** — add:
```typescript
// Session Security (Story 1.3)
TOKEN_REUSE_DETECTED: 'A security concern was detected with your session. Please log in again.',
SESSION_INACTIVE: 'Your session has expired due to inactivity. Please log in again.',
REFRESH_TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
REFRESH_TOKEN_INVALID: 'Your session could not be verified. Please log in again.',
CSRF_VALIDATION_FAILED: 'Your request could not be verified. Please refresh the page and try again.',
LOGOUT_SUCCESSFUL: 'You have been successfully logged out.',
```

### Environment Variables

**Add to `apps/server/src/config/env.ts`:**

```typescript
CSRF_SECRET: z.string().min(32).default('change-csrf-secret-in-production'),
INACTIVITY_TIMEOUT_MINUTES: z.coerce.number().default(30),
```

**Add to `.env.example`:**
```env
# CSRF (Story 1.3)
CSRF_SECRET=change-csrf-secret-in-production-min-32-chars

# Session (Story 1.3)
INACTIVITY_TIMEOUT_MINUTES=30
```

### Architecture Compliance

**Middleware Chain** (updated with Story 1.3 additions):
```
1. helmet          ← Story 1.1
2. cors            ← Story 1.1
3. cookie-parser   ← Story 1.2
4. rateLimiter     ← Story 1.2 (per-route)
5. [captcha]       ← Story 1.6
6. authenticate    ← Story 1.2 (per-route)
7. csrfProtect     ← THIS STORY (per-route, on cookie-dependent endpoints)
8. authorise       ← Story 1.4
9. scopeToMda      ← Story 1.4
10. validate       ← Story 1.2 (per-route)
11. auditLog       ← Story 1.5
12. route handler
```

**Route-level middleware application:**

| Endpoint | Rate Limit | Auth | CSRF | Notes |
|---|---|---|---|---|
| POST /api/auth/login | authLimiter | No | No | Public, sets refresh + CSRF cookies |
| POST /api/auth/register | No | authenticate | No | Bearer token only, no cookies involved |
| POST /api/auth/refresh | authLimiter | No | csrfProtect | Cookie-based auth, CSRF required |
| POST /api/auth/logout | No | authenticate | csrfProtect | Both Bearer + cookie, CSRF required |
| GET /api/health | No | No | No | Public health check |

### Library & Framework Requirements

**New dependency for `apps/server/package.json`:**

| Package | Version | Purpose |
|---|---|---|
| `csrf-csrf` | `^4.0.3` | Signed double-submit CSRF protection. Stateless, works with cookie-parser. Replaces deprecated `csurf`. |

**Already installed by Story 1.2 (DO NOT reinstall):**
- bcrypt, jsonwebtoken, express-rate-limit, cookie-parser, and all their @types
- express, drizzle-orm, pg, zod, pino, helmet, cors, dotenv, supertest, vitest

### File Structure Requirements

**New files this story MUST create:**

```
apps/server/src/
├── middleware/
│   └── csrf.ts                         # CSRF double-submit cookie (csrf-csrf)
│   └── csrf.test.ts                    # CSRF middleware tests
├── services/
│   └── authService.refresh.test.ts     # Refresh, logout, reuse detection tests
└── routes/
    └── authRoutes.refresh.test.ts      # Integration tests for /refresh, /logout
```

**Files this story MUST modify:**

```
apps/server/src/db/schema.ts            # Add last_used_at to refresh_tokens
apps/server/src/services/authService.ts # Add refreshToken(), logout(), revokeAllUserTokens(), changePassword(); modify login()
apps/server/src/routes/authRoutes.ts    # Add POST /auth/refresh, POST /auth/logout; modify login to set CSRF cookie
apps/server/src/app.ts                  # No global CSRF mount needed (per-route), but may need import adjustments
apps/server/src/config/env.ts           # Add CSRF_SECRET, INACTIVITY_TIMEOUT_MINUTES
apps/server/package.json                # Add csrf-csrf dependency
.env.example                            # Add CSRF_SECRET, INACTIVITY_TIMEOUT_MINUTES
packages/shared/src/types/auth.ts       # Add RefreshResponse
packages/shared/src/constants/vocabulary.ts  # Add session security vocabulary
packages/shared/src/index.ts            # Export new types
```

**Files this story MUST NOT modify:**

```
apps/server/src/index.ts                # Entry point — no changes
apps/server/src/routes/healthRoutes.ts  # Health check — no changes
apps/server/src/db/index.ts             # Drizzle client — no changes
apps/server/src/lib/uuidv7.ts           # UUID generator — no changes
apps/server/src/lib/jwt.ts              # JWT library — no changes (reuse as-is)
apps/server/src/lib/password.ts         # Password library — no changes
apps/server/src/lib/tokenHash.ts        # Token hash — no changes (reuse as-is)
apps/server/src/lib/appError.ts         # AppError class — no changes
apps/server/src/middleware/authenticate.ts  # JWT verification — no changes (reuse as-is)
apps/server/src/middleware/validate.ts  # Zod validation — no changes
apps/server/src/middleware/rateLimiter.ts   # Rate limiter — no changes (reuse authLimiter)
apps/client/**                          # NO frontend changes in this story
```

### Testing Requirements

**Framework:** Vitest (co-located) + supertest (integration)

**Unit Tests:**

1. **`apps/server/src/services/authService.refresh.test.ts`:**
   - `refreshToken()` returns new accessToken for valid refresh token
   - `refreshToken()` rotates: old token revoked, new token stored
   - `refreshToken()` updates last_used_at on successful refresh
   - `refreshToken()` returns 401 for missing/malformed token
   - `refreshToken()` returns 401 for token not found in DB
   - `refreshToken()` returns 401 for expired token (7-day expiry)
   - `refreshToken()` returns 401 for inactive session (>30 min since last_used_at)
   - `refreshToken()` REUSE DETECTION: revokes ALL user tokens when revoked token is presented
   - `refreshToken()` re-checks user.is_active on refresh (inactive user rejected)
   - `logout()` revokes all user refresh tokens
   - `revokeAllUserTokens()` revokes only non-revoked tokens for specified user
   - `revokeAllUserTokens()` returns count of revoked tokens
   - `changePassword()` updates hashed_password and revokes all tokens
   - Modified `login()` revokes existing tokens before creating new one (single session)

2. **`apps/server/src/middleware/csrf.test.ts`:**
   - CSRF passes when header matches cookie token
   - CSRF rejects when header is missing
   - CSRF rejects when header doesn't match cookie
   - CSRF skips GET/HEAD/OPTIONS methods
   - CSRF rejects on POST with missing cookie

**Integration Tests:**

3. **`apps/server/src/routes/authRoutes.refresh.test.ts`:**
   - POST /api/auth/refresh with valid cookie → 200 + new accessToken + rotated cookie
   - POST /api/auth/refresh without cookie → 401
   - POST /api/auth/refresh with expired token → 401 REFRESH_TOKEN_EXPIRED
   - POST /api/auth/refresh after 30+ min inactivity → 401 SESSION_INACTIVE
   - POST /api/auth/refresh with revoked token → 401 TOKEN_REUSE_DETECTED + all tokens revoked
   - POST /api/auth/refresh without CSRF header → 403 CSRF_VALIDATION_FAILED
   - POST /api/auth/logout with valid auth + CSRF → 200 + cookies cleared
   - POST /api/auth/logout without auth → 401
   - POST /api/auth/logout without CSRF → 403
   - Login creates new session and revokes old tokens (single session enforcement)
   - Rate limiting: 6th refresh request within 15 minutes → 429

**Test Helpers Needed:**
- Helper to seed a user + active refresh token for refresh tests
- Helper to simulate time passage for inactivity/expiry tests (mock Date.now() or use Vitest's fake timers)
- Helper to extract Set-Cookie values from supertest responses

### Previous Story Intelligence (from Stories 1.1 & 1.2)

**From Story 1.1 (scaffold):**
1. DB port is **5433** (not 5432) — VLPRS avoids conflict with OSLRS
2. Drizzle Kit is `0.31.x` (not 0.45.x) — different version tracks from ORM
3. Tests co-located: `foo.ts` + `foo.test.ts` — no `__tests__` directories
4. Express 5 async errors auto-forwarded — no try/catch wrappers needed
5. `pnpm dev` starts DB + client (5173) + server (3001)

**From Story 1.2 (auth foundation):**
1. `refreshToken` cookie path is `/api/auth` — CSRF cookie path should be `/` (broader)
2. `secure: true` on cookies is conditional on `env.NODE_ENV === 'production'`
3. Refresh token format: `crypto.randomBytes(64).toString('hex')` (128 hex chars)
4. Token hash: SHA-256 via `lib/tokenHash.ts` → `hashToken()`
5. Story 1.2 deferred these to 1.3: refresh endpoint, logout, token rotation, reuse detection, CSRF
6. Story 1.2's login already stores refresh token hash — this story adds pre-login revocation for single session
7. AppError class in `lib/appError.ts` — use for all error responses
8. VOCABULARY constant in `packages/shared` — import messages, never hardcode
9. All auth routes mounted at `/api` in `app.ts`

**Express 5 gotchas relevant to this story:**
- `res.clearCookie()` ignores maxAge/expires — must match path, httpOnly, secure, sameSite
- Async route handlers auto-catch errors — `throw new AppError(...)` works without wrappers
- `req.body` is `undefined` when unparsed (not `{}`)

### Git Intelligence

**Recent commits (2 total, Story 1.2 not yet implemented):**
```
9e6dd63 fix: code review fixes for Story 1.1 scaffold (14 issues resolved)
2084119 chore: scaffold VLPRS monorepo (Story 1.1)
```

**Branch:** `dev` | **Commit style:** `type: description` (conventional commits)

### Latest Technology Intelligence (Feb 2026)

| Package | Version | Key Notes |
|---|---|---|
| `csrf-csrf` | **4.0.3** | Signed double-submit cookie pattern. Replaces deprecated `csurf`. Stateless, uses HMAC-SHA256. Requires cookie-parser. |
| `csurf` | **DEPRECATED** | Officially deprecated by Express.js team (Sep 2022, re-confirmed May 2025). Do NOT use. |
| `csrf-sync` | 4.2.1 | Alternative — requires express-session (stateful). Not suitable for JWT-based architecture. |

**csurf deprecation context:**
- Express.js team: "deprecated due to the large influx of security vulnerability reports... exploiting the underlying limitations of CSRF itself"
- The team does NOT officially recommend a specific replacement
- `csrf-csrf` is the most popular community alternative for stateless apps

**OWASP CSRF prevention (2025 update):**
- Naive double-submit (no HMAC) is discouraged — vulnerable to cookie injection from subdomains
- Signed double-submit with HMAC + session binding is the recommended variant
- Always use `crypto.timingSafeEqual()` for token comparison (prevent timing attacks)
- SameSite is defense-in-depth only — NOT a replacement for CSRF tokens

**Token rotation best practices:**
- No widely-adopted npm package for rotation — custom implementation is standard
- Reuse detection: if revoked token is presented, revoke ALL tokens for user (nuclear option)
- Always re-check user.is_active on refresh (catch deactivation between refreshes)

### Scope Boundaries

**Explicitly IN scope:**
- POST /api/auth/refresh (token rotation + reuse detection)
- POST /api/auth/logout (token revocation + cookie clearing)
- CSRF middleware (csrf-csrf, signed double-submit)
- Inactivity timeout (30 min, via last_used_at tracking)
- Single concurrent session (revoke old tokens on login)
- revokeAllUserTokens() utility function
- changePassword() infrastructure function

**Explicitly NOT in scope (later stories):**
- Frontend silent refresh logic (Story 1.6 — apiClient interceptor)
- Frontend CSRF header attachment (Story 1.6 — apiClient reads __csrf cookie)
- Password reset REST endpoint (Epic 1, Story 1.9a)
- User deactivation endpoint (Epic 1, Story 1.9a)
- Audit logging of token events (Story 1.5)
- RBAC authorise middleware (Story 1.4)
- MDA scope middleware (Story 1.4)
- reCAPTCHA (Story 1.6)
- Email notifications on session events (Epic 9)

### Non-Punitive Vocabulary Rules

All new error messages follow the UX design spec:

| Code | Message | NEVER This |
|---|---|---|
| TOKEN_REUSE_DETECTED | "A security concern was detected with your session. Please log in again." | "Token stolen", "Security violation", "Unauthorized reuse" |
| SESSION_INACTIVE | "Your session has expired due to inactivity. Please log in again." | "Session timed out", "Idle timeout exceeded" |
| REFRESH_TOKEN_EXPIRED | "Your session has expired. Please log in again." | "Token expired", "Refresh failed" |
| CSRF_VALIDATION_FAILED | "Your request could not be verified. Please refresh the page and try again." | "CSRF error", "Invalid CSRF token", "Request rejected" |

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.3]
- [Source: _bmad-output/planning-artifacts/architecture.md#Token Lifecycle]
- [Source: _bmad-output/planning-artifacts/architecture.md#Token Rotation]
- [Source: _bmad-output/planning-artifacts/architecture.md#CSRF Protection]
- [Source: _bmad-output/planning-artifacts/architecture.md#Auth Flow Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#Middleware Chain]
- [Source: _bmad-output/planning-artifacts/prd.md#FR42 Session Management]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC-10 Inactivity Timeout]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC-11 Account Lockout]
- [Source: _bmad-output/planning-artifacts/prd.md#FR72 Account Deactivation]
- [Source: _bmad-output/implementation-artifacts/1-2-user-registration-login.md#Authentication Implementation]
- [Source: _bmad-output/implementation-artifacts/1-2-user-registration-login.md#What NOT To Do]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-development-environment.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

- CSRF session binding fix: `generateCsrfToken` must be called AFTER setting `req.cookies.refreshToken` to the new token value, otherwise the HMAC is signed with an empty/stale session identifier. Both login and refresh handlers updated with `overwrite: true` option.
- csrf-csrf v4 API: `generateCsrfToken` (not `generateToken`), `getCsrfTokenFromRequest` (not `getTokenFromRequest`).
- Transaction rollback bug: Throwing `AppError` inside a Drizzle `db.transaction()` callback causes rollback, which undid revocations on error paths (reuse detection, expiry, inactivity, inactive user). Fixed by returning `{ error }` from the transaction and throwing after commit.

### Completion Notes List

- All 8 acceptance criteria implemented and tested
- AC1: Token refresh with rotation — POST /api/auth/refresh rotates token, returns new JWT
- AC2: Reuse detection — revoked token presentation triggers nuclear revocation of all user tokens
- AC3: Logout — POST /api/auth/logout revokes all tokens, clears cookies
- AC4: Inactivity timeout — 30-minute server-side enforcement via last_used_at tracking
- AC5: Single concurrent session — login() revokes all existing tokens before issuing new
- AC6: CSRF protection — csrf-csrf v4 signed double-submit cookie pattern on refresh/logout
- AC7: Password change token invalidation — changePassword() and revokeAllUserTokens() exported
- AC8: Refresh token expiry — 7-day absolute expiry checked on every refresh
- 91 tests pass across all 4 workspaces (75 server, 12 shared, 2 client, 2 testing)
- No regressions — all existing Story 1.1 and 1.2 tests continue to pass

### File List

**New files:**
- apps/server/src/middleware/csrf.ts
- apps/server/src/middleware/csrf.test.ts
- apps/server/src/services/authService.refresh.test.ts
- apps/server/src/routes/authRoutes.refresh.test.ts

**Modified files:**
- apps/server/src/db/schema.ts (added last_used_at column to refresh_tokens; added token_hash index)
- apps/server/src/services/authService.ts (added refreshToken, logout, revokeAllUserTokens, changePassword; modified login for single session)
- apps/server/src/routes/authRoutes.ts (added POST /auth/refresh, POST /auth/logout; modified login to set CSRF cookie)
- apps/server/src/config/env.ts (added CSRF_SECRET, INACTIVITY_TIMEOUT_MINUTES; added production secret validation)
- apps/server/src/app.ts (added CSRF error mapping in global error handler)
- apps/server/package.json (added csrf-csrf dependency)
- apps/server/src/services/authService.test.ts (added single session enforcement test)
- packages/shared/src/types/auth.ts (added RefreshResponse type)
- packages/shared/src/constants/vocabulary.ts (added session security vocabulary entries incl. LOGOUT_SUCCESSFUL)
- packages/shared/src/index.ts (added RefreshResponse export)
- .env.example (added CSRF_SECRET, INACTIVITY_TIMEOUT_MINUTES)
- .env (added CSRF_SECRET, INACTIVITY_TIMEOUT_MINUTES)
- pnpm-lock.yaml (updated with csrf-csrf dependency)

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Add index on token_hash column — every refreshToken() call does full table scan [schema.ts:75]
- [x] [AI-Review][HIGH] Make changePassword() atomic — password update and token revocation must be in a transaction [authService.ts:343-348]
- [x] [AI-Review][HIGH] Add production guard for CSRF_SECRET default — known string allows CSRF forgery [env.ts:23]
- [x] [AI-Review][MEDIUM] Add missing LOGOUT_SUCCESSFUL vocabulary constant from spec [vocabulary.ts]
- [x] [AI-Review][MEDIUM] Rate limiting properly tested — removed `skip` in test mode, added explicit MemoryStore with `resetRateLimiters()` for test isolation. Integration tests for 429 on both /auth/login and /auth/refresh [rateLimiter.ts, authRoutes.test.ts, authRoutes.refresh.test.ts]
- [x] [AI-Review][MEDIUM] Update File List — missing pnpm-lock.yaml, sprint-status.yaml, app.ts
- [x] [AI-Review][MEDIUM] Explicitly set lastUsedAt in login() token insert for consistency with refreshToken() [authService.ts:179-184]
- [x] [AI-Review][LOW] Document csrf-csrf err.code dependency in error handler comment [app.ts:49]
- [x] [AI-Review][LOW] Add HEAD/OPTIONS CSRF bypass integration test (unit test covers GET only)

## Change Log

- 2026-02-20: Code review — all 9 issues fixed: token_hash index, atomic changePassword, production secret guard, LOGOUT_SUCCESSFUL vocab, File List update, explicit lastUsedAt in login, CSRF handler comment, HEAD/OPTIONS CSRF bypass test, rate limiter properly testable (removed skip, added store reset). 105 tests passing.
- 2026-02-19: Story 1.3 implemented — Session Security & Token Refresh (all 8 ACs satisfied, 91 tests passing)
- 2026-02-19: Fix transaction rollback bug — error paths in refreshToken() now return error indicators instead of throwing inside db.transaction(), preventing rollback of revocations (reuse detection nuclear revocation was silently undone)
