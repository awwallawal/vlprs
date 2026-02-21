# Story 1.2: User Registration & Login

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-18 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocks: 1.3 (Session Security), 1.4 (RBAC), 1.5 (Audit Logging), 1.6 (Frontend Auth Shell) -->
<!-- Blocked By: 1.1 (Monorepo Scaffold) — DONE -->
<!-- FRs: FR42, FR43, FR47, FR72, FR73 | NFRs: NFR-SEC-1, NFR-SEC-3, NFR-SEC-8, NFR-SEC-11 -->

## Story

As a **system administrator**,
I want to create user accounts and allow users to log in with email and password,
so that only authorised personnel can access the system.

## Acceptance Criteria (BDD)

### AC1: User Creation by Super Admin

```gherkin
Given the system has a users table with the schema defined in this story
When a Super Admin calls POST /api/auth/register with valid user data
  | field     | value                    |
  | email     | officer@mda.gov.ng       |
  | password  | SecurePass1              |
  | firstName | Adebayo                  |
  | lastName  | Ogunleye                 |
  | role      | mda_officer              |
  | mdaId     | <valid MDA UUID>         |
Then a new user is created with bcrypt-hashed password (12 rounds)
And the response returns 201 with user details (without password_hash):
  {
    "success": true,
    "data": { "id": "<UUIDv7>", "email": "officer@mda.gov.ng", "firstName": "Adebayo",
              "lastName": "Ogunleye", "role": "mda_officer", "mdaId": "<uuid>",
              "isActive": true, "createdAt": "<ISO8601>" }
  }
And password validation enforces:
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 digit
```

### AC2: Successful Login

```gherkin
Given a registered, active user with email "admin@vlprs.gov.ng" and password "Admin1234"
When they call POST /api/auth/login with correct email and password
Then the response returns 200 with:
  {
    "success": true,
    "data": {
      "accessToken": "<JWT, 15-minute expiry>",
      "user": { "id": "<uuid>", "email": "admin@vlprs.gov.ng", "firstName": "...",
                "lastName": "...", "role": "super_admin", "mdaId": null, "createdAt": "..." }
    }
  }
And the access token JWT contains claims: { userId, email, role, mdaId, iat, exp }
And a refresh token (7-day expiry) is set in an httpOnly, secure, sameSite: strict cookie
And the refresh token is stored as a SHA-256 hash in the refresh_tokens table (raw token NEVER persisted)
And failed_login_attempts is reset to 0 on success
```

### AC3: Failed Login — Invalid Credentials

```gherkin
Given a registered user with email "admin@vlprs.gov.ng"
When they call POST /api/auth/login with incorrect password
Then the response returns 401 with:
  {
    "success": false,
    "error": { "code": "LOGIN_UNSUCCESSFUL", "message": "Email or password is incorrect. Please try again." }
  }
And the same 401 response is returned for a non-existent email (no credential enumeration)
And failed_login_attempts is incremented by 1
```

### AC4: Account Lockout After Failed Attempts

```gherkin
Given a registered user with 4 prior failed login attempts
When they fail login a 5th consecutive time
Then the response returns 423 with:
  {
    "success": false,
    "error": { "code": "ACCOUNT_TEMPORARILY_LOCKED",
               "message": "Your account is temporarily unavailable. Please try again in 15 minutes." }
  }
And the user's locked_until is set to now + 15 minutes
And subsequent login attempts (even with correct credentials) return 423 until lockout expires
And after lockout expires, successful login resets failed_login_attempts to 0
```

### AC5: Inactive Account Rejection

```gherkin
Given a registered user whose is_active flag is false
When they call POST /api/auth/login with correct credentials
Then the response returns 403 with:
  {
    "success": false,
    "error": { "code": "ACCOUNT_INACTIVE", "message": "Your account is currently inactive. Please contact your administrator." }
  }
```

### AC6: Register Endpoint Protection

```gherkin
Given a user with role "dept_admin" or "mda_officer"
When they call POST /api/auth/register
Then the response returns 403 Forbidden
And only users with role "super_admin" can create new accounts
```

### AC7: Database Seed Scripts

```gherkin
Given a fresh database with schema applied
When the demo seed script runs (pnpm seed:demo)
Then 3 MDA records exist (Ministry of Finance, Ministry of Education, Ministry of Health)
And 5 user accounts exist with bcrypt-hashed passwords:
  | email                       | role          | mdaId               |
  | super.admin@vlprs.test      | super_admin   | null                |
  | dept.admin@vlprs.test       | dept_admin    | null                |
  | finance.officer@vlprs.test  | mda_officer   | Ministry of Finance |
  | education.officer@vlprs.test| mda_officer   | Ministry of Education|
  | health.officer@vlprs.test   | mda_officer   | Ministry of Health  |
And all demo passwords are "Password1" (meets policy: 8+ chars, uppercase, lowercase, digit)

When the production seed script runs (pnpm seed:prod)
Then exactly 1 super_admin user is created from SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD env vars
And the script is idempotent (skips if super admin email already exists)
```

### AC8: Input Validation

```gherkin
Given a request to POST /api/auth/register or POST /api/auth/login
When the request body fails Zod schema validation
Then the response returns 400 with field-level error details:
  {
    "success": false,
    "error": { "code": "VALIDATION_FAILED", "message": "Please check your input and try again.",
               "details": [{ "field": "email", "message": "Please use a valid email format" }] }
  }
And validation is server-side only (never trust client-side)
```

### AC9: Rate Limiting on Auth Endpoints

```gherkin
Given the auth endpoints are protected by rate limiting
When a client exceeds 5 requests per 15 minutes from the same IP to /api/auth/login or /api/auth/register
Then the response returns 429 with:
  {
    "success": false,
    "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "Too many requests. Please wait before trying again." }
  }
And the Retry-After header is set with seconds until the limit resets
```

## Tasks / Subtasks

- [x] Task 1: Database schema — users, mdas, refresh_tokens tables (AC: #1, #2, #4, #7)
  - [x] 1.1 Define `roleEnum` pgEnum for `super_admin`, `dept_admin`, `mda_officer`
  - [x] 1.2 Define `mdas` table (id, name, code, created_at, updated_at) — stub for FK, expanded in Epic 2
  - [x] 1.3 Define `users` table (id, email, hashed_password, first_name, last_name, role, mda_id FK, is_active, failed_login_attempts, locked_until, created_at, updated_at, deleted_at)
  - [x] 1.4 Define `refresh_tokens` table (id, user_id FK, token_hash, expires_at, created_at, revoked_at)
  - [x] 1.5 Add index: `idx_users_email` on users(email)
  - [x] 1.6 Add index: `idx_refresh_tokens_user_revoked` on refresh_tokens(user_id, revoked_at)
  - [x] 1.7 Run `pnpm drizzle-kit push` to apply schema to Docker PostgreSQL
- [x] Task 2: Shared package — auth types, validators, constants (AC: #1, #3, #8)
  - [x] 2.1 Create `packages/shared/src/types/api.ts` — ApiResponse<T>, ApiError types
  - [x] 2.2 Create `packages/shared/src/types/auth.ts` — User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest types
  - [x] 2.3 Create `packages/shared/src/constants/roles.ts` — ROLES enum and role array
  - [x] 2.4 Create `packages/shared/src/validators/authSchemas.ts` — loginSchema, registerSchema with password policy
  - [x] 2.5 Update `packages/shared/src/constants/vocabulary.ts` — add auth error codes
  - [x] 2.6 Update `packages/shared/src/index.ts` — export all new modules
- [x] Task 3: Server auth libraries (AC: #1, #2)
  - [x] 3.1 Create `apps/server/src/lib/appError.ts` — AppError class with statusCode, code, message, details
  - [x] 3.2 Create `apps/server/src/lib/password.ts` — hashPassword(plain), comparePassword(plain, hash) using bcrypt 12 rounds
  - [x] 3.3 Create `apps/server/src/lib/jwt.ts` — signAccessToken(payload), verifyAccessToken(token) using jsonwebtoken
  - [x] 3.4 Create `apps/server/src/lib/tokenHash.ts` — hashToken(token) using SHA-256 for refresh token storage
- [x] Task 4: Server middleware (AC: #6, #8, #9)
  - [x] 4.1 Create `apps/server/src/middleware/validate.ts` — Zod schema validation middleware
  - [x] 4.2 Create `apps/server/src/middleware/authenticate.ts` — JWT verification, attaches req.user
  - [x] 4.3 Create `apps/server/src/middleware/rateLimiter.ts` — tiered rate limiting (auth: 5/15min, write: 30/min, read: 120/min)
  - [x] 4.4 Update `apps/server/src/app.ts` — add cookie-parser, mount auth routes, update error handler to use AppError
- [x] Task 5: Auth service (AC: #1, #2, #3, #4, #5)
  - [x] 5.1 Create `apps/server/src/services/authService.ts` — register(), login() with all auth logic
  - [x] 5.2 Implement register: validate role permissions, check duplicate email, hash password, create user, return sanitised user
  - [x] 5.3 Implement login: find user by email, check is_active, check lockout, compare password, handle failed attempts, generate tokens, store refresh token hash, set cookie, return accessToken + user
- [x] Task 6: Auth routes (AC: #1, #2, #6)
  - [x] 6.1 Create `apps/server/src/routes/authRoutes.ts` — POST /auth/register, POST /auth/login
  - [x] 6.2 Register route: authenticate → inline super_admin check → validate(registerSchema) → authService.register
  - [x] 6.3 Login route: rateLimiter.auth → validate(loginSchema) → authService.login
  - [x] 6.4 Mount authRoutes at `/api` in app.ts
- [x] Task 7: Database seed scripts (AC: #7)
  - [x] 7.1 Create `apps/server/src/db/seed-demo.ts` — 3 MDAs + 5 demo users
  - [x] 7.2 Create `apps/server/src/db/seed-production.ts` — initial super admin from env vars (idempotent)
  - [x] 7.3 Add `seed:demo` and `seed:prod` scripts to apps/server/package.json
- [x] Task 8: Install new dependencies
  - [x] 8.1 Install in apps/server: `bcrypt`, `jsonwebtoken`, `express-rate-limit`, `cookie-parser`
  - [x] 8.2 Install in apps/server devDependencies: `@types/bcrypt`, `@types/jsonwebtoken`, `@types/cookie-parser`
- [x] Task 9: Tests (AC: all)
  - [x] 9.1 Create `apps/server/src/lib/password.test.ts` — hash and compare tests
  - [x] 9.2 Create `apps/server/src/lib/jwt.test.ts` — sign and verify tests
  - [x] 9.3 Create `apps/server/src/services/authService.test.ts` — register and login logic tests
  - [x] 9.4 Create `apps/server/src/routes/authRoutes.test.ts` — integration tests with supertest (register, login, lockout, rate limiting)
  - [x] 9.5 Create `packages/shared/src/validators/authSchemas.test.ts` — schema validation tests
  - [x] 9.6 Update `packages/testing/src/factories/createTestUser.ts` — align with new User type, add auth factory helpers
  - [x] 9.7 Verify `pnpm test` from root — all tests pass across all 4 workspaces

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 2 of 58** — the authentication foundation that **4 subsequent stories directly depend on** (1.3 Session Security, 1.4 RBAC, 1.5 Audit Logging, 1.6 Frontend Auth Shell) and every downstream epic requires for access control.

**VLPRS is a government financial system** — Vehicle Loan Processing & Receivables System for Oyo State Government. Security is non-negotiable:
- No self-registration — only authorised admins create accounts
- No credential enumeration — identical error for wrong email vs wrong password
- Account lockout protects against brute force
- Refresh tokens never stored in plaintext — SHA-256 hash only
- Access tokens never stored in localStorage — in-memory only (enforced in Story 1.6)

**What this story produces vs what comes next:**

| This Story (1.2) | Story 1.3 | Story 1.4 | Story 1.5 |
|---|---|---|---|
| POST /api/auth/register | POST /api/auth/refresh | authorise middleware | auditLog middleware |
| POST /api/auth/login | POST /api/auth/logout | scopeToMda middleware | audit_log table |
| users + refresh_tokens tables | Token rotation + reuse detection | Role-based route guards | Event logging |
| authenticate middleware (JWT verify) | CSRF middleware | Permission matrix | Structured pino logging |
| Account lockout logic | Silent refresh flow | | |

### What NOT To Do

1. **DO NOT create a frontend login page** — that is Story 1.6. This story is backend-only (API endpoints + database).
2. **DO NOT implement POST /api/auth/refresh** — that is Story 1.3. This story generates and stores refresh tokens but the refresh endpoint comes later.
3. **DO NOT implement POST /api/auth/logout** — that is Story 1.3.
4. **DO NOT implement POST /api/auth/password-reset** — that is Story 1.3.
5. **DO NOT implement token rotation or reuse detection** — that is Story 1.3.
6. **DO NOT implement CSRF protection** — that is Story 1.3 (needed for cookie-based refresh).
7. **DO NOT implement the authorise(requiredRoles) middleware** — that is Story 1.4. Use a simple inline role check for the register endpoint.
8. **DO NOT implement the scopeToMda middleware** — that is Story 1.4.
9. **DO NOT implement audit logging middleware** — that is Story 1.5. Do NOT create an audit_log table yet.
10. **DO NOT implement reCAPTCHA** — that is Story 1.6 (requires frontend integration).
11. **DO NOT use `localStorage` for tokens** — access tokens go in React state (Story 1.6). The backend returns accessToken in JSON body only.
12. **DO NOT store raw refresh tokens** in the database — store SHA-256 hash only. The raw token is set in the httpOnly cookie and never persisted server-side.
13. **DO NOT use `res.status().json()` directly in route handlers** — always use the AppError class for errors. Success responses use the standard `{ success: true, data: ... }` envelope.
14. **DO NOT hardcode role strings** — import ROLES from `@vlprs/shared`. (OSLRS lesson: frontend/backend role string mismatch caused 3 roles to fail at runtime despite 53 passing tests.)
15. **DO NOT use Zod v3 import** — use `import { z } from 'zod/v4'`. The old import silently gives Zod 3.
16. **DO NOT use `z.string().uuid()` for UUIDv7** — Zod 4's `z.uuid()` enforces RFC 4122 which may reject UUIDv7. Use `z.string().regex()` with UUID pattern or `z.uuidv7()` if available.
17. **DO NOT create a `__tests__` directory** — tests are co-located next to source files.
18. **DO NOT use `npm` or `yarn`** — pnpm only.
19. **DO NOT install packages without checking existing deps** — Story 1.1 already installed zod, helmet, cors, pg, drizzle-orm, pino, dotenv, express, supertest.
20. **DO NOT use `express.urlencoded({ extended: true })` for auth endpoints** — Express 5 defaults `extended: false`. The existing `app.ts` has `extended: true` which is fine, but auth endpoints use JSON only.

### Database Schema

**All tables in single file: `apps/server/src/db/schema.ts`**

Three tables to add (preserving the existing convention comments):

**roleEnum:**
```typescript
export const roleEnum = pgEnum('role', ['super_admin', 'dept_admin', 'mda_officer']);
```

**mdas table (stub — expanded in Epic 2):**
```
mdas:
  id          uuid PRIMARY KEY (UUIDv7)
  name        varchar(255) NOT NULL        -- e.g., "Ministry of Finance"
  code        varchar(50) NOT NULL UNIQUE  -- e.g., "MOF"
  created_at  timestamptz NOT NULL DEFAULT now()
  updated_at  timestamptz NOT NULL DEFAULT now()
```

**users table:**
```
users:
  id                      uuid PRIMARY KEY (UUIDv7)
  email                   varchar(255) NOT NULL UNIQUE
  hashed_password         text NOT NULL              -- bcrypt hash, 12 rounds
  first_name              varchar(100) NOT NULL
  last_name               varchar(100) NOT NULL
  role                    role enum NOT NULL          -- super_admin | dept_admin | mda_officer
  mda_id                  uuid REFERENCES mdas(id)   -- nullable for super_admin/dept_admin
  is_active               boolean NOT NULL DEFAULT true
  failed_login_attempts   integer NOT NULL DEFAULT 0
  locked_until            timestamptz                -- null = not locked
  created_at              timestamptz NOT NULL DEFAULT now()
  updated_at              timestamptz NOT NULL DEFAULT now()
  deleted_at              timestamptz                -- soft delete
```

**refresh_tokens table:**
```
refresh_tokens:
  id          uuid PRIMARY KEY (UUIDv7)
  user_id     uuid NOT NULL REFERENCES users(id)
  token_hash  text NOT NULL              -- SHA-256 hash, raw token NEVER stored
  expires_at  timestamptz NOT NULL
  created_at  timestamptz NOT NULL DEFAULT now()
  revoked_at  timestamptz                -- soft-revoke, never hard delete
```

**Indexes:**
- `idx_users_email` on users(email) — fast lookup on login
- `idx_refresh_tokens_user_revoked` on refresh_tokens(user_id, revoked_at) — efficient rotation checks

**Business Rules enforced in service layer (NOT database constraints):**
- `mda_officer` MUST have a valid, non-null `mda_id`
- `super_admin` and `dept_admin` MUST have null `mda_id`
- Enforce in `authService.register()` with clear error messages

### API Endpoints

**POST /api/auth/login** (public, rate-limited)

```
Middleware chain: rateLimiter.auth → validate(loginSchema) → handler

Request:
  Content-Type: application/json
  {
    "email": "string (email format, required)",
    "password": "string (required)"
  }

Success Response (200):
  JSON body: {
    "success": true,
    "data": {
      "accessToken": "<JWT string>",
      "user": {
        "id": "<UUIDv7>",
        "email": "...",
        "firstName": "...",
        "lastName": "...",
        "role": "super_admin|dept_admin|mda_officer",
        "mdaId": "<uuid>|null",
        "createdAt": "<ISO8601>"
      }
    }
  }
  Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800

Error Responses:
  400 — VALIDATION_FAILED (bad input)
  401 — LOGIN_UNSUCCESSFUL (wrong email or password — same message for both)
  403 — ACCOUNT_INACTIVE (is_active=false)
  423 — ACCOUNT_TEMPORARILY_LOCKED (failed attempts exceeded)
  429 — RATE_LIMIT_EXCEEDED (too many requests)
```

**POST /api/auth/register** (protected, Super Admin only)

```
Middleware chain: authenticate → inlineSuperAdminCheck → validate(registerSchema) → handler

Request:
  Authorization: Bearer <accessToken>
  Content-Type: application/json
  {
    "email": "string (email format, required)",
    "password": "string (8+ chars, 1 upper, 1 lower, 1 digit, required)",
    "firstName": "string (required)",
    "lastName": "string (required)",
    "role": "super_admin|dept_admin|mda_officer (required)",
    "mdaId": "string (uuid, required if role=mda_officer, null otherwise)"
  }

Success Response (201):
  {
    "success": true,
    "data": {
      "id": "<UUIDv7>",
      "email": "...",
      "firstName": "...",
      "lastName": "...",
      "role": "...",
      "mdaId": "<uuid>|null",
      "isActive": true,
      "createdAt": "<ISO8601>"
    }
  }

Error Responses:
  400 — VALIDATION_FAILED (bad input)
  401 — AUTHENTICATION_REQUIRED (no/invalid JWT)
  403 — INSUFFICIENT_PERMISSIONS (not super_admin)
  409 — EMAIL_ALREADY_EXISTS (duplicate email)
```

### Authentication Implementation Details

**Login Flow (authService.login):**
```
1. Query users table by email (case-insensitive: WHERE LOWER(email) = LOWER(input))
2. If user not found → return 401 LOGIN_UNSUCCESSFUL (no credential enumeration)
3. If user.is_active === false → return 403 ACCOUNT_INACTIVE
4. If user.locked_until !== null AND user.locked_until > now() → return 423 ACCOUNT_TEMPORARILY_LOCKED
5. If user.locked_until !== null AND user.locked_until <= now() → clear lockout (set locked_until=null, failed_login_attempts=0)
6. Compare password with bcrypt.compare(input, user.hashed_password)
7. If password mismatch:
   a. Increment failed_login_attempts
   b. If failed_login_attempts >= 5 → set locked_until = now() + 15 minutes
   c. Return 401 LOGIN_UNSUCCESSFUL
8. Password matches:
   a. Reset failed_login_attempts to 0, locked_until to null
   b. Generate JWT access token (15min expiry) with claims: { userId, email, role, mdaId }
   c. Generate random refresh token (crypto.randomBytes(64).toString('hex'))
   d. Hash refresh token with SHA-256
   e. Store hash in refresh_tokens table with 7-day expiry
   f. Set refresh token in httpOnly cookie
   g. Return { accessToken, user } in response body
```

**Register Flow (authService.register):**
```
1. Caller already authenticated as super_admin (middleware handles this)
2. Validate role-mdaId combination:
   - If role=mda_officer and mdaId is null → error
   - If role=super_admin/dept_admin and mdaId is not null → error
3. Check for duplicate email (case-insensitive)
4. If duplicate → 409 EMAIL_ALREADY_EXISTS
5. Hash password with bcrypt (12 rounds)
6. Generate UUIDv7 for user id
7. Insert into users table
8. Return sanitised user object (no hashed_password in response)
```

**JWT Access Token Structure:**
```json
{
  "userId": "<UUIDv7>",
  "email": "user@example.com",
  "role": "super_admin",
  "mdaId": null,
  "iat": 1739880000,
  "exp": 1739880900
}
```
- Algorithm: HS256
- Secret: env.JWT_SECRET (MUST be changed from default in production)
- Expiry: 15 minutes (env.JWT_EXPIRY)

**Refresh Token:**
- Format: 128 hex characters (crypto.randomBytes(64).toString('hex'))
- Storage: SHA-256 hash in `refresh_tokens.token_hash` — raw token NEVER in DB
- Delivery: httpOnly, secure, sameSite=strict cookie
- Cookie path: `/api/auth` (restricts cookie to auth endpoints only)
- Expiry: 7 days (env.REFRESH_TOKEN_EXPIRY)
- Note: `secure: true` should be conditional on `env.NODE_ENV === 'production'` for local dev to work over HTTP

### AppError Class

Create `apps/server/src/lib/appError.ts`:

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown[];

  constructor(statusCode: number, code: string, message: string, details?: unknown[]) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
```

Update the global error handler in `app.ts` to check for `AppError` instances and use their statusCode/code/details. Non-AppError errors remain as 500 INTERNAL_ERROR.

### Authenticate Middleware

`apps/server/src/middleware/authenticate.ts`:

```
1. Extract Authorization header: "Bearer <token>"
2. If missing/malformed → throw AppError(401, 'AUTHENTICATION_REQUIRED', 'Please provide a valid access token.')
3. Verify JWT with jsonwebtoken.verify(token, env.JWT_SECRET)
4. If expired/invalid → throw AppError(401, 'TOKEN_EXPIRED', 'Your session has expired. Please log in again.')
5. Attach decoded payload to req.user = { userId, email, role, mdaId }
6. Call next()
```

Express 5 TypeScript: Extend the Express Request type to include `user`:
```typescript
// In a declaration file or at top of authenticate.ts
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string; role: string; mdaId: string | null };
    }
  }
}
```

### Validate Middleware

`apps/server/src/middleware/validate.ts`:

```typescript
export function validate(schema: ZodObject<any>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      throw new AppError(400, 'VALIDATION_FAILED', 'Please check your input and try again.', details);
    }
    req.body = result.data; // Use parsed (typed) data
    next();
  };
}
```

### Rate Limiter Configuration

`apps/server/src/middleware/rateLimiter.ts`:

```typescript
import { rateLimit } from 'express-rate-limit';

// Auth endpoints: 5 requests per 15 minutes per IP
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please wait before trying again.' },
  },
});

// Write endpoints: 30 requests per minute per user (for future use)
export const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, ... });

// Read endpoints: 120 requests per minute per user (for future use)
export const readLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, ... });
```

Note: use `limit` not `max` (express-rate-limit v8 API).

### Shared Package Additions

**`packages/shared/src/types/api.ts`:**
```typescript
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;
```

**`packages/shared/src/types/auth.ts`:**
```typescript
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'dept_admin' | 'mda_officer';
  mdaId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'dept_admin' | 'mda_officer';
  mdaId: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'dept_admin' | 'mda_officer';
  mdaId?: string | null;
}
```

**`packages/shared/src/constants/roles.ts`:**
```typescript
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEPT_ADMIN: 'dept_admin',
  MDA_OFFICER: 'mda_officer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER];
```

**`packages/shared/src/constants/vocabulary.ts`** (update existing):
```typescript
export const VOCABULARY = {
  // Authentication
  LOGIN_UNSUCCESSFUL: 'Email or password is incorrect. Please try again.',
  ACCOUNT_TEMPORARILY_LOCKED: 'Your account is temporarily unavailable. Please try again in 15 minutes.',
  ACCOUNT_INACTIVE: 'Your account is currently inactive. Please contact your administrator.',
  AUTHENTICATION_REQUIRED: 'Please provide a valid access token.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
  // Registration
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists.',
  // Validation
  VALIDATION_FAILED: 'Please check your input and try again.',
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
} as const;
```

**`packages/shared/src/validators/authSchemas.ts`:**
```typescript
import { z } from 'zod/v4';

// Password policy: min 8 chars, 1 uppercase, 1 lowercase, 1 digit
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one digit');

export const loginSchema = z.object({
  email: z.email('Please use a valid email format'),
  password: z.string().min(1, 'Please enter your password'),
});

export const registerSchema = z.object({
  email: z.email('Please use a valid email format'),
  password: passwordSchema,
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  role: z.enum(['super_admin', 'dept_admin', 'mda_officer']),
  mdaId: z.string().nullable().optional(),
});
```

Note: For `loginSchema`, password validation is minimal (just non-empty) because we don't want to leak password policy info on the login form. Full password policy is enforced only on `registerSchema`.

**Update `packages/shared/src/index.ts`:**
```typescript
// Schemas (legacy from Story 1.1)
export { emailSchema } from './schemas/emailSchema';
// Validators
export { loginSchema, registerSchema } from './validators/authSchemas';
// Types
export type { ApiResponse, ApiError, ApiResult } from './types/api';
export type { User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest } from './types/auth';
// Constants
export { ROLES, ALL_ROLES, type Role } from './constants/roles';
export { VOCABULARY } from './constants/vocabulary';
```

### Express 5 Specific Considerations

The dev MUST be aware of these Express 5 behavioural differences from Express 4:

| Behaviour | Express 4 | Express 5 | Impact on This Story |
|---|---|---|---|
| `req.body` when unparsed | `{}` | `undefined` | Must null-check before accessing login credentials in authService |
| Async error handling | Manual `next(err)` required | **Rejected promises auto-forwarded** | Auth middleware and service can be `async` without try/catch wrappers |
| `res.clearCookie()` | Respects maxAge/expires | **Ignores** maxAge/expires | Not relevant for 1.2, but important for 1.3 logout |
| `express.urlencoded` | `extended: true` default | `extended: false` default | Already set to true in app.ts — no change needed |

**Key benefit:** Express 5 auto-catches rejected promises in async middleware/handlers. This means `authenticate.ts`, `validate.ts`, and route handlers can simply `throw new AppError(...)` without wrapping in try/catch. The global error handler catches them automatically.

### Non-Punitive Vocabulary Rules

Error messages MUST follow the UX design specification's non-punitive language patterns:

| Context | Use This Language | NEVER This |
|---|---|---|
| Invalid credentials | "Email or password is incorrect. Please try again." | "Invalid login", "Authentication failed", "Wrong password" |
| Account locked | "Your account is temporarily unavailable. Please try again in 15 minutes." | "Account locked", "Access denied", "Too many failures" |
| Account inactive | "Your account is currently inactive. Please contact your administrator." | "Account disabled", "Account suspended" |
| Duplicate email | "An account with this email address already exists." | "Email already taken", "Duplicate user" |
| Validation error | "Please check your input and try again." | "Invalid input", "Error in request" |

- Error codes are SCREAMING_SNAKE for machine consumption
- Messages are human-readable, constructive, blame-free
- NEVER use "Error", "Failed", "Invalid", or "Violation" in user-facing messages
- Import messages from `VOCABULARY` constant — never hardcode strings in route handlers

### Project Structure Notes

**Existing structure from Story 1.1 (DO NOT recreate or modify unless specified):**
```
apps/server/src/
├── index.ts              # Entry — DO NOT MODIFY (already has graceful shutdown)
├── app.ts                # Express factory — MODIFY (add cookie-parser, auth routes, AppError handler)
├── routes/
│   └── healthRoutes.ts   # GET /api/health — DO NOT MODIFY
├── middleware/            # Empty .gitkeep — ADD NEW FILES HERE
├── services/             # Empty .gitkeep — ADD NEW FILES HERE
├── db/
│   ├── schema.ts         # Empty — ADD TABLES HERE
│   └── index.ts          # Drizzle client — DO NOT MODIFY
├── lib/
│   └── uuidv7.ts         # UUIDv7 generator — DO NOT MODIFY
└── config/
    └── env.ts            # Env validation — MAY NEED UPDATE for new env vars
```

**Alignment:** All new files follow established naming conventions (camelCase.ts for utilities/middleware/routes, PascalCase only for React components). Tests co-located next to source.

### Architecture Compliance

**Middleware Chain Order** (from architecture — this story adds items 4, 7, 8):
```
1. helmet          ← Story 1.1 (exists in app.ts)
2. cors            ← Story 1.1 (exists in app.ts)
3. cookie-parser   ← THIS STORY (new — add after cors)
4. rateLimiter     ← THIS STORY (applied per-route, not global)
5. [captcha]       ← Story 1.6
6. authenticate    ← THIS STORY (applied per-route, not global)
7. authorise       ← Story 1.4
8. scopeToMda      ← Story 1.4
9. validate        ← THIS STORY (applied per-route)
10. auditLog       ← Story 1.5
11. route handler
```

Rate limiting, authenticate, and validate are applied per-route (not globally) because public endpoints (login, health) don't need all middleware.

**API Response Format** — ALL endpoints MUST follow (established in Story 1.1):
```json
// Success
{ "success": true, "data": { ... } }

// Error (use AppError class)
{ "success": false, "error": { "code": "SCREAMING_SNAKE", "message": "Non-punitive human-readable", "details": [...] } }
```

**Database Conventions** (established in Story 1.1 schema.ts comments):
- Tables: snake_case, plural
- Columns: snake_case
- PKs: UUIDv7 via `generateUuidv7()`
- Timestamps: Always `timestamptz` (UTC)
- Soft deletes: `deleted_at` timestamp
- Booleans: `is_` or `has_` prefix

**Naming Conventions:**
- Files: `camelCase.ts` (authRoutes.ts, authService.ts, authenticate.ts)
- Functions: camelCase, verb-first (hashPassword, signAccessToken, comparePassword)
- Constants: SCREAMING_SNAKE (ROLES, VOCABULARY, JWT_EXPIRY)
- Types/Interfaces: PascalCase, no I prefix (User, JwtPayload, LoginRequest)
- Zod schemas: camelCase + Schema suffix (loginSchema, registerSchema)
- Error codes: SCREAMING_SNAKE (LOGIN_UNSUCCESSFUL, VALIDATION_FAILED)
- JSON response fields: camelCase (accessToken, firstName, mdaId)
- DB columns: snake_case (hashed_password, first_name, mda_id)

### Library & Framework Requirements

**New dependencies for `apps/server/package.json`:**

| Package | Version | Purpose |
|---|---|---|
| `bcrypt` | `^6.0.0` | Password hashing (12 rounds). v6 uses prebuildify — no more node-pre-gyp issues. Needs `pnpm.onlyBuiltDependencies: ["bcrypt"]` in root package.json (already configured in Story 1.1). |
| `jsonwebtoken` | `^9.0.2` | JWT sign/verify. Architecture-specified. CJS-only — use `import jwt from 'jsonwebtoken'` with `esModuleInterop`. |
| `express-rate-limit` | `^8.2.1` | Rate limiting. v8 API: use `limit` not `max`, `standardHeaders: 'draft-7'`. |
| `cookie-parser` | `^1.4.7` | Parse cookies for refresh token handling. |

**New devDependencies for `apps/server/package.json`:**

| Package | Version | Purpose |
|---|---|---|
| `@types/bcrypt` | latest | TypeScript types for bcrypt |
| `@types/jsonwebtoken` | latest | TypeScript types for jsonwebtoken |
| `@types/cookie-parser` | latest | TypeScript types for cookie-parser |

**Already installed (DO NOT reinstall):**
- express ^5.1.0, drizzle-orm ^0.45.0, pg ^8.16.0, zod ^4.0.0, pino, helmet, cors, dotenv, supertest, vitest, tsx, tsup

**Environment Variables** — already defined in `config/env.ts`:
- `JWT_SECRET` (default: 'change-me-in-production') — used by jwt.ts
- `JWT_EXPIRY` (default: '15m') — used by jwt.ts
- `REFRESH_TOKEN_EXPIRY` (default: '7d') — used by authService.ts

**Additional env vars needed** — add to `config/env.ts`:
- `SUPER_ADMIN_EMAIL` (optional, for production seed)
- `SUPER_ADMIN_PASSWORD` (optional, for production seed)
- `MAX_LOGIN_ATTEMPTS` (optional, default: 5)
- `LOCKOUT_DURATION_MINUTES` (optional, default: 15)

### File Structure Requirements

**New files this story MUST create:**

```
apps/server/src/
├── lib/
│   ├── appError.ts              # AppError class
│   ├── appError.test.ts         # AppError tests
│   ├── password.ts              # bcrypt hash/compare (12 rounds)
│   ├── password.test.ts         # Password hash/compare tests
│   ├── jwt.ts                   # JWT sign/verify
│   ├── jwt.test.ts              # JWT sign/verify tests
│   └── tokenHash.ts             # SHA-256 hash for refresh tokens
├── middleware/
│   ├── authenticate.ts          # JWT verification → req.user
│   ├── validate.ts              # Zod schema validation
│   └── rateLimiter.ts           # Tiered rate limiting
├── services/
│   ├── authService.ts           # register(), login() business logic
│   └── authService.test.ts      # Auth service unit tests
├── routes/
│   └── authRoutes.ts            # POST /auth/register, POST /auth/login
│   └── authRoutes.test.ts       # Integration tests with supertest
└── db/
    ├── seed-demo.ts             # 3 MDAs + 5 demo users
    └── seed-production.ts       # Initial super admin from env vars

packages/shared/src/
├── types/
│   ├── api.ts                   # ApiResponse<T>, ApiError
│   └── auth.ts                  # User, JwtPayload, LoginRequest/Response, RegisterRequest
├── constants/
│   └── roles.ts                 # ROLES enum, Role type, ALL_ROLES array
├── validators/
│   ├── authSchemas.ts           # loginSchema, registerSchema
│   └── authSchemas.test.ts      # Validation tests

packages/testing/src/
└── factories/
    └── createTestUser.ts        # UPDATE: align with User type, add createTestJwt()
```

**Files this story MUST modify:**

```
apps/server/src/app.ts           # Add cookie-parser, mount authRoutes, update error handler for AppError
apps/server/src/db/schema.ts     # Add roleEnum, mdas, users, refresh_tokens tables
apps/server/src/config/env.ts    # Add SUPER_ADMIN_EMAIL/PASSWORD, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES
apps/server/package.json         # Add new dependencies + seed scripts
packages/shared/src/index.ts     # Export new types, validators, constants
packages/shared/src/constants/vocabulary.ts  # Add auth vocabulary entries
```

**Files this story MUST NOT modify:**
```
apps/server/src/index.ts         # Entry point — already has graceful shutdown
apps/server/src/routes/healthRoutes.ts  # Health check — no changes
apps/server/src/db/index.ts      # Drizzle client — no changes needed
apps/server/src/lib/uuidv7.ts    # UUID generator — no changes
apps/client/**                   # NO frontend changes in this story
```

### Testing Requirements

**Framework:** Vitest (already configured in all workspaces)
**Location:** Co-located with source files (e.g., `authService.ts` + `authService.test.ts`)
**HTTP testing:** supertest (already installed)

**Unit Tests:**

1. **`apps/server/src/lib/password.test.ts`:**
   - `hashPassword()` returns a bcrypt hash (starts with `$2b$12$`)
   - `comparePassword()` returns true for correct password
   - `comparePassword()` returns false for incorrect password
   - Hash is different each time (salt uniqueness)

2. **`apps/server/src/lib/jwt.test.ts`:**
   - `signAccessToken()` returns a valid JWT string
   - `verifyAccessToken()` decodes correct claims (userId, email, role, mdaId)
   - `verifyAccessToken()` throws for expired token
   - `verifyAccessToken()` throws for invalid token
   - Token expiry matches JWT_EXPIRY config

3. **`apps/server/src/services/authService.test.ts`:**
   - `register()` creates user with hashed password
   - `register()` rejects duplicate email with 409
   - `register()` enforces role-mdaId rules (mda_officer requires mdaId, super_admin rejects mdaId)
   - `register()` returns user without hashed_password
   - `login()` returns accessToken + user for valid credentials
   - `login()` sets refresh token cookie
   - `login()` stores refresh token as SHA-256 hash
   - `login()` returns 401 for wrong email (same message as wrong password)
   - `login()` returns 401 for wrong password
   - `login()` returns 403 for inactive user
   - `login()` increments failed_login_attempts
   - `login()` locks account after 5 failed attempts
   - `login()` rejects login during lockout period
   - `login()` resets failed attempts on successful login after lockout expires

4. **`packages/shared/src/validators/authSchemas.test.ts`:**
   - `loginSchema` validates correct input
   - `loginSchema` rejects missing email
   - `loginSchema` rejects invalid email format
   - `loginSchema` rejects missing password
   - `registerSchema` validates correct input
   - `registerSchema` rejects password < 8 chars
   - `registerSchema` rejects password without uppercase
   - `registerSchema` rejects password without lowercase
   - `registerSchema` rejects password without digit
   - `registerSchema` rejects invalid role enum

**Integration Tests:**

5. **`apps/server/src/routes/authRoutes.test.ts`:**
   - POST /api/auth/login with valid credentials → 200 + accessToken + cookie
   - POST /api/auth/login with wrong password → 401
   - POST /api/auth/login with non-existent email → 401 (same response)
   - POST /api/auth/login with inactive user → 403
   - POST /api/auth/login lockout after 5 failures → 423
   - POST /api/auth/register with valid Super Admin JWT → 201
   - POST /api/auth/register without auth → 401
   - POST /api/auth/register with non-super_admin JWT → 403
   - POST /api/auth/register with duplicate email → 409
   - POST /api/auth/register with invalid body → 400 with field errors
   - Rate limiting: 6th request within 15 minutes → 429

**Test Database Strategy:**
- Integration tests should use the Docker PostgreSQL instance
- Create test-specific helper to seed and cleanup test data between tests
- Use `beforeEach` / `afterEach` to ensure test isolation
- Use the `packages/testing` factories — update `createTestUser` to match the new User schema

### Previous Story Intelligence (from Story 1.1)

**Debug learnings the dev MUST know:**
1. **Drizzle Kit versioning:** ORM is `0.45.x` but Kit is `0.31.x` (different version tracks). Don't try to align them.
2. **Express 5 + pnpm strict resolution:** TS2742 errors resolved by disabling `declaration`/`declarationMap` in server tsconfig. Already fixed.
3. **Empty schema.ts causes TS2306:** Current file has `export {}` to prevent this. When adding tables, remove the `export {}` line.
4. **DB port:** VLPRS PostgreSQL runs on port **5433** (not 5432) to avoid conflict with OSLRS project. DATABASE_URL uses port 5433.
5. **Docker volume:** Named `vlprs_pgdata` to avoid conflict with OSLRS.
6. **shadcn/ui:** Initialised manually (components.json + Button) rather than interactive CLI.
7. **14 code review issues** found and fixed in Story 1.1 — the scaffold is now clean.
8. **pnpm dev** starts DB (Docker compose) + client (Vite:5173) + server (tsx:3001).
9. **pnpm 9.15** is installed (story 1.1 specified 10.x) — compatible. `onlyBuiltDependencies` already configured for bcrypt.

**Files created by Story 1.1 that this story builds on:**
- `apps/server/src/app.ts` — Express app with helmet, cors, body parsing, health route, 404 + error handlers
- `apps/server/src/db/schema.ts` — Empty with convention comments (add tables here)
- `apps/server/src/db/index.ts` — Drizzle client: `drizzle(env.DATABASE_URL, { schema })`
- `apps/server/src/config/env.ts` — Validates DATABASE_URL, PORT, NODE_ENV, JWT_SECRET, JWT_EXPIRY, REFRESH_TOKEN_EXPIRY
- `apps/server/src/lib/uuidv7.ts` — `generateUuidv7()` for all PKs
- `packages/shared/src/constants/vocabulary.ts` — Empty `VOCABULARY` object to populate
- `packages/testing/src/factories/createTestUser.ts` — Basic factory to update

### Git Intelligence

**Recent commits (2 total):**
```
9e6dd63 fix: code review fixes for Story 1.1 scaffold (14 issues resolved)
2084119 chore: scaffold VLPRS monorepo (Story 1.1)
```

**Current branch:** `dev` (working branch — all development happens here)
**Patterns established:**
- Commit style: `type: description` (conventional commits)
- Branch strategy: develop on `dev`, merge to `main` for production
- Code review: adversarial review finding 3+ issues (High/Medium/Low)

### Latest Technology Intelligence (Feb 2026)

**Version updates the dev MUST use:**

| Package | Architecture Says | Latest Stable (Feb 2026) | Action |
|---|---|---|---|
| bcrypt | (unspecified) | **6.0.0** | Use `^6.0.0`. v6 uses prebuildify (no node-pre-gyp). 12 rounds must be explicit. |
| jsonwebtoken | (unspecified) | **9.0.2** | Use `^9.0.2`. CJS-only — import with esModuleInterop. Minimal updates since 2023. |
| express-rate-limit | (unspecified) | **8.2.1** | Use `^8.2.1`. v8 API: `limit` not `max`, `standardHeaders: 'draft-7'`, `legacyHeaders: false`. |
| cookie-parser | (unspecified) | **1.4.7** | Use `^1.4.7`. Works with Express 5. |
| helmet | 8.x | **8.1.0** | Already installed ✓ |

**bcrypt v6.0.0 critical notes:**
- Dropped Node.js <= 16 (requires Node 18+) ✓ (our project uses Node 22+)
- Replaced `node-pre-gyp` with `prebuildify` — prebuilt binaries ship directly
- Default salt rounds is 10, NOT 12 — must explicitly pass 12 as `saltRounds`
- Versions < 5.0.0 have a password truncation bug (255+ chars) — v6 is safe

**jsonwebtoken alternative consideration:**
The `jose` package (v6.1.3) is the modern alternative: zero deps, native ESM, TypeScript-first, async-only, actively maintained. However, the architecture document specifies `jsonwebtoken`, so use that unless the team explicitly decides to switch. If jsonwebtoken causes ESM/CJS issues in the monorepo, `jose` is the fallback. Migration is straightforward:
```typescript
// jsonwebtoken: jwt.sign(payload, secret, { expiresIn })
// jose: await new SignJWT(payload).setProtectedHeader({alg:'HS256'}).setExpirationTime('15m').sign(secret)
```

**Express 5 auth-specific changes:**
- `req.body` is `undefined` when unparsed (was `{}` in Express 4) — null-check before accessing credentials
- Async errors auto-forwarded to error handler — no more `asyncHandler` wrappers needed
- `res.clearCookie()` ignores `maxAge`/`expires` — relevant for Story 1.3 logout

### UX Context (for Story 1.6 awareness — DO NOT implement frontend)

The backend API error responses must align with the UX design specification's non-punitive language:
- Validation triggers on blur, not keystroke
- Errors use amber `#D4A017` border (never red for form errors)
- Error messages are positive instructional ("Email should be a valid email format") never accusatory
- Login form: email + password fields, crimson primary button
- Toast feedback: success=green, error=amber
- WCAG 2.1 AA: `aria-live="polite"` for login errors, keyboard navigation
- Mobile: 16px min font, 48px touch targets, 44x44px minimum interactive elements

This context ensures the API error codes and messages are aligned for when Story 1.6 builds the frontend.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.2]
- [Source: _bmad-output/planning-artifacts/architecture.md#Authentication]
- [Source: _bmad-output/planning-artifacts/architecture.md#API Style]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Testing]
- [Source: _bmad-output/planning-artifacts/architecture.md#Middleware Chain]
- [Source: _bmad-output/planning-artifacts/architecture.md#Security]
- [Source: _bmad-output/planning-artifacts/prd.md#FR42-FR48 Access Control]
- [Source: _bmad-output/planning-artifacts/prd.md#FR72-FR73 Account Administration]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC Security Requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Form Patterns]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Non-Punitive Language]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Accessibility]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-development-environment.md#Dev Notes]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-development-environment.md#Debug Log]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- File parallelism disabled in vitest.config.ts to prevent DB conflicts between test suites running concurrently
- Rate limiter configured to skip in test environment (NODE_ENV=test) to prevent rate limit state bleeding between tests
- `@types/jsonwebtoken` v9.x uses branded `StringValue` type for `expiresIn` — used type assertion as workaround
- Shared package renamed from `shared` to `@vlprs/shared` to enable workspace imports across packages
- Testing package renamed from `testing` to `@vlprs/testing` for consistency
- `drizzle-kit push` requires explicit `DATABASE_URL` env var when running from apps/server directory (dotenv/config loads from cwd)

### Completion Notes List

- All 9 tasks and 45 subtasks implemented and verified
- 61 tests pass across all 4 workspaces (45 server, 12 shared, 2 testing, 2 client)
- Full typecheck passes across all workspaces
- Demo seed script verified: creates 3 MDAs + 5 users with bcrypt-hashed passwords
- Authentication follows all security requirements: bcrypt 12 rounds, SHA-256 refresh token hashing, httpOnly cookies, no credential enumeration, account lockout, rate limiting
- Non-punitive vocabulary from VOCABULARY constant used for all user-facing error messages
- Express 5 async error handling leveraged (no try/catch wrappers needed)

### Senior Developer Review (AI)

**Reviewer:** Adversarial Code Review (Claude Opus 4.6)
**Date:** 2026-02-19
**Outcome:** Approved (after auto-fixes)
**Issues Found:** 4 High, 5 Medium, 2 Low — **all resolved**

#### Review Follow-ups (AI) — All Fixed

- [x] [AI-Review][HIGH] H1: Hardcoded validation strings in validate.ts and authService.ts instead of VOCABULARY constants — **Fixed:** imported VOCABULARY, replaced all hardcoded top-level messages
- [x] [AI-Review][HIGH] H2: Unsafe double type assertion `as unknown as number` in jwt.ts for expiresIn — **Fixed:** changed to `as jwt.SignOptions['expiresIn']`
- [x] [AI-Review][HIGH] H3: Missing appError.test.ts (listed in File Structure Requirements) — **Fixed:** created with 5 tests (statusCode, code, message, details, instanceof, stack trace)
- [x] [AI-Review][HIGH] H4: Missing tokenHash.test.ts for security-critical SHA-256 hashing — **Fixed:** created with 3 tests (hex format, deterministic, unique hashes)
- [x] [AI-Review][MEDIUM] M1: Rate limiter test uses separate Express app, not actual app — **Fixed:** added comment documenting the test isolation trade-off
- [x] [AI-Review][MEDIUM] M2: Demo seed logs "User created" even on conflict/skip — **Fixed:** added `.returning()` and conditional log (consistent with MDA handling)
- [x] [AI-Review][MEDIUM] M3: authService.login coupled to Express Response (sets cookie in service layer) — **Fixed:** refactored login() to return `LoginResult` with `refreshToken.raw` and `refreshToken.expiresMs`; cookie now set in route handler
- [x] [AI-Review][MEDIUM] M4: Production seed hardcodes firstName/lastName for super admin — **Fixed:** added SUPER_ADMIN_FIRST_NAME and SUPER_ADMIN_LAST_NAME env vars with defaults
- [x] [AI-Review][MEDIUM] M5: validate.ts schema parameter restricted to ZodObject — **Fixed:** changed to `z.ZodType<any>` for compatibility with refined/transformed schemas
- [x] [AI-Review][LOW] L1: Untracked error.txt debug artifact in project root — **Fixed:** deleted
- [x] [AI-Review][LOW] L2: pnpm-lock.yaml and epics.md not in File List — **Fixed:** documented below

### Change Log

- 2026-02-18: Story 1.2 implementation complete — user registration & login with full auth foundation
- 2026-02-19: Code review (11 findings) — all HIGH and MEDIUM issues auto-fixed; tests increased from 52 to 61

### File List

**New files created:**
- `apps/server/src/db/schema.ts` (modified — added roleEnum, mdas, users, refresh_tokens tables)
- `apps/server/src/lib/appError.ts` — AppError class
- `apps/server/src/lib/appError.test.ts` — 5 unit tests (added during code review)
- `apps/server/src/lib/password.ts` — bcrypt hash/compare (12 rounds)
- `apps/server/src/lib/password.test.ts` — 4 unit tests
- `apps/server/src/lib/jwt.ts` — JWT sign/verify
- `apps/server/src/lib/jwt.test.ts` — 5 unit tests
- `apps/server/src/lib/tokenHash.ts` — SHA-256 refresh token hashing
- `apps/server/src/lib/tokenHash.test.ts` — 3 unit tests (added during code review)
- `apps/server/src/middleware/validate.ts` — Zod schema validation
- `apps/server/src/middleware/authenticate.ts` — JWT verification middleware
- `apps/server/src/middleware/rateLimiter.ts` — tiered rate limiting
- `apps/server/src/services/authService.ts` — register() and login() business logic
- `apps/server/src/services/authService.test.ts` — 15 unit tests (14 original + 1 added during review)
- `apps/server/src/routes/authRoutes.ts` — POST /auth/register, POST /auth/login
- `apps/server/src/routes/authRoutes.test.ts` — 12 integration tests
- `apps/server/src/db/seed-demo.ts` — 3 MDAs + 5 demo users
- `apps/server/src/db/seed-production.ts` — idempotent super admin from env
- `packages/shared/src/types/api.ts` — ApiResponse<T>, ApiError, ApiResult<T>
- `packages/shared/src/types/auth.ts` — User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest
- `packages/shared/src/constants/roles.ts` — ROLES enum, Role type, ALL_ROLES
- `packages/shared/src/validators/authSchemas.ts` — loginSchema, registerSchema
- `packages/shared/src/validators/authSchemas.test.ts` — 10 validation tests

**Files modified:**
- `apps/server/src/app.ts` — added cookie-parser, auth routes, AppError error handler
- `apps/server/src/config/env.ts` — added SUPER_ADMIN_EMAIL/PASSWORD, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES, SUPER_ADMIN_FIRST_NAME/LAST_NAME
- `apps/server/src/db/schema.ts` — replaced `export {}` with full schema (roleEnum, mdas, users, refresh_tokens)
- `apps/server/package.json` — added deps (bcrypt, jsonwebtoken, express-rate-limit, cookie-parser, @vlprs/shared) + seed scripts
- `apps/server/vitest.config.ts` — added fileParallelism: false for DB test isolation
- `packages/shared/src/index.ts` — added exports for types, validators, constants
- `packages/shared/src/constants/vocabulary.ts` — added auth error messages
- `packages/shared/package.json` — renamed to @vlprs/shared
- `packages/testing/package.json` — renamed to @vlprs/testing
- `packages/testing/src/factories/createTestUser.ts` — aligned with User type, added createTestJwt
- `packages/testing/src/index.ts` — added createTestJwt export
- `packages/testing/src/index.test.ts` — updated assertions for new factory shape
- `pnpm-lock.yaml` — updated from new dependency installations
