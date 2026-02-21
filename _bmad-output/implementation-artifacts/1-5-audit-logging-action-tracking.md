# Story 1.5: Audit Logging & Action Tracking

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-18 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocks: 1.6 (Frontend Auth Shell), 1.7 (CI/CD), ALL Epics 2-13 (every mutation is audit-logged) -->
<!-- Blocked By: 1.2 (User Registration & Login), 1.3 (Session Security), 1.4 (RBAC) -->
<!-- FRs: FR47, FR48 | NFRs: NFR-SEC-6, NFR-SEC-7 -->

## Story

As the **Accountant General**,
I want every user action logged with timestamp, identity, role, and IP address,
so that all system activity is fully traceable for governance and audit compliance.

## Acceptance Criteria (BDD)

### AC1: Authenticated API Call Logging

```gherkin
Given a dedicated audit_log table with UUIDv7 PK, columns: user_id, role, mda_id, action, resource, method, request_body_hash, response_status, ip_address, user_agent, duration_ms, created_at
When any authenticated API call is made (GET, POST, PUT, PATCH, DELETE)
Then an audit log entry is created automatically via Express middleware (FR48)
And the entry captures: user_id from JWT, role, mda_id, HTTP method, resource path, SHA-256 hash of request body, response status code, client IP address, user agent, and request duration in milliseconds
And the audit log insertion is fire-and-forget (never blocks the HTTP response)
And if the audit log insertion fails, the error is logged to pino (operational log) but the API response is unaffected
```

### AC2: Authentication Event Logging

```gherkin
Given a user logs in successfully
When the login completes
Then an auth event is logged with: action=AUTH_LOGIN_SUCCESS, user_id, email, role, ip_address, user_agent (FR47)

Given a user fails a login attempt
When the login fails (wrong password, wrong email, locked account)
Then an auth event is logged with: action=AUTH_LOGIN_FAILED, email (no user_id — not authenticated), ip_address, response_status

Given a user logs out
When the logout completes
Then an auth event is logged with: action=AUTH_LOGOUT, user_id, email, ip_address

Given a user's account is locked after 5 failed attempts
When the lockout triggers
Then an auth event is logged with: action=AUTH_ACCOUNT_LOCKED, email, ip_address
```

### AC3: Audit Log Immutability — Database Trigger

```gherkin
Given the audit_log table
When any attempt is made to UPDATE an existing row
Then the operation is rejected at the database level with an exception
And the error message is: "Modifications to audit_log are not allowed: UPDATE operation rejected"

When any attempt is made to DELETE an existing row
Then the operation is rejected at the database level with an exception
And the error message is: "Modifications to audit_log are not allowed: DELETE operation rejected"

And only INSERT operations are permitted on the audit_log table (NFR-SEC-7)
```

### AC4: Structured Request Logging (pino)

```gherkin
Given the Express server processes any HTTP request (authenticated or not)
When the response is sent
Then a structured pino JSON log entry is emitted with: level, time, requestId, method, url, statusCode, durationMs, ip
And in development mode, pino-pretty formats the log for human readability
And the requestId is generated per-request and returned in the X-Request-Id response header
And pino log levels follow the convention: error (500+), warn (400-499), info (200-399)
```

### AC5: Request Body Hash — Privacy Protection

```gherkin
Given a POST/PUT/PATCH request with a JSON body
When the audit log entry is created
Then the request body is hashed with SHA-256 (deterministic, sorted keys)
And the raw request body is NEVER stored in the audit log (privacy: passwords, PII)
And GET/HEAD/OPTIONS requests have a null request_body_hash (no body)
```

### AC6: Trigger Setup Script

```gherkin
Given the audit_log table is created via drizzle-kit push
When the developer runs pnpm db:triggers
Then the immutability trigger (fn_prevent_modification) is applied to the audit_log table
And the script is idempotent (safe to run multiple times)
And a db:push script runs drizzle-kit push followed by db:triggers
```

### AC7: Tests — Audit Coverage

```gherkin
Given Story 1.5 is implemented
When I run pnpm test from the monorepo root
Then unit tests pass for: auditLog middleware (captures correct fields), hashBody utility (deterministic SHA-256), logAuthEvent function (correct event types)
And integration tests pass for: audit entries created on API calls, auth events logged for login/logout/failed, immutability trigger rejects UPDATE/DELETE
And all existing tests from Stories 1.1-1.4 continue to pass
```

## Tasks / Subtasks

- [x] Task 1: Database schema — audit_log table (AC: #1, #3)
  - [x] 1.1 Add `audit_log` table to `apps/server/src/db/schema.ts` — UUIDv7 PK, all specified columns, NO updated_at, NO deleted_at
  - [x] 1.2 Add index: `idx_audit_log_user_id` on audit_log(user_id)
  - [x] 1.3 Add index: `idx_audit_log_created_at` on audit_log(created_at) — for time-range queries
  - [x] 1.4 Add index: `idx_audit_log_action` on audit_log(action) — for filtering by event type
  - [x] 1.5 Run `pnpm drizzle-kit push` to apply schema
- [x] Task 2: Immutability trigger (AC: #3, #6)
  - [x] 2.1 Create `apps/server/src/db/applyTriggers.ts` — idempotent script applying fn_prevent_modification + trigger
  - [x] 2.2 Add `db:triggers` and `db:push` scripts to `apps/server/package.json`
  - [x] 2.3 Run trigger script and verify UPDATE/DELETE are rejected
- [x] Task 3: Shared logger factory (AC: #4)
  - [x] 3.1 Create `apps/server/src/lib/logger.ts` — pino logger with serializers, redaction, child logger support
  - [x] 3.2 Update `apps/server/src/index.ts` — replace inline pino with shared logger
- [x] Task 4: Request body hash utility (AC: #5)
  - [x] 4.1 Create `apps/server/src/lib/hashBody.ts` — SHA-256 hash with sorted keys, null for empty
  - [x] 4.2 Create `apps/server/src/lib/hashBody.test.ts` — determinism, null handling, key order tests
- [x] Task 5: Request logger middleware (AC: #4)
  - [x] 5.1 Create `apps/server/src/middleware/requestLogger.ts` — pino request/response logging with requestId
  - [x] 5.2 Mount requestLogger globally in app.ts (before routes, after body parsing)
  - [x] 5.3 Generate X-Request-Id per request, return in response header
- [x] Task 6: Audit log middleware (AC: #1, #5)
  - [x] 6.1 Create `apps/server/src/middleware/auditLog.ts` — captures authenticated request data, writes to DB on res.finish
  - [x] 6.2 Fire-and-forget pattern: audit insertion failures logged to pino, never block response
  - [x] 6.3 Create `apps/server/src/middleware/auditLog.test.ts` — unit tests
- [x] Task 7: Audit service — auth event logging (AC: #2)
  - [x] 7.1 Create `apps/server/src/services/auditService.ts` — logAuthEvent(), logAuditEntry() functions
  - [x] 7.2 Create `apps/server/src/services/auditService.test.ts` — unit tests
  - [x] 7.3 Modify `apps/server/src/services/authService.ts` — add logAuthEvent() calls to login(), logout(), failed login, account lockout
- [x] Task 8: Wire up middleware and routes (AC: #1, #2)
  - [x] 8.1 Mount auditLog middleware on all protected routes in app.ts
  - [x] 8.2 Apply auditLog to existing protected endpoints (register, users)
  - [x] 8.3 Update shared vocabulary with audit-related messages
  - [x] 8.4 Update shared index.ts exports
- [x] Task 9: Integration tests (AC: #7)
  - [x] 9.1 Create `apps/server/src/routes/auditLog.integration.test.ts` — verify audit entries created on API calls
  - [x] 9.2 Test auth event logging: login success/failure, logout, account lockout
  - [x] 9.3 Test immutability trigger: UPDATE and DELETE rejected on audit_log
  - [x] 9.4 Verify `pnpm test` from root — all tests pass across all 4 workspaces

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] `hashBody` — `JSON.stringify` array replacer silently drops nested object properties. Replace with recursive key-sorting function. [apps/server/src/lib/hashBody.ts:12]
- [x] [AI-Review][HIGH] Missing `AUTH_TOKEN_REUSE_DETECTED` and `AUTH_TOKEN_REFRESH` audit events in `refreshToken()`. Add `AuditContext` param and `logAuthEvent()` calls. [apps/server/src/services/authService.ts:303,343]
- [x] [AI-Review][MEDIUM] `requestLogger` accepts external `X-Request-Id` without length/format validation. Validate before using. [apps/server/src/middleware/requestLogger.ts:11]
- [x] [AI-Review][MEDIUM] Integration test doesn't assert action name for register endpoint. Add action assertion. [apps/server/src/routes/auditLog.integration.test.ts:103]
- [x] [AI-Review][MEDIUM] Integration tests use fragile 200ms `setTimeout` for fire-and-forget verification. Replace with polling helper. [apps/server/src/routes/auditLog.integration.test.ts]
- [x] [AI-Review][MEDIUM] Floating promises — `logAuthEvent()` called without `void` prefix at 6 call sites. [apps/server/src/services/authService.ts]
- [x] [AI-Review][LOW] Misleading JSDoc on `auditAction` in express.d.ts — says "Set by logAuthEvent" but logAuthEvent doesn't set it. [apps/server/src/types/express.d.ts:17]
- [x] [AI-Review][LOW] `deriveAction()` produces empty resource prefix for edge-case paths like `/` or `/:id`. [apps/server/src/middleware/auditLog.ts:19]
- [x] [AI-Review][LOW] Git discrepancy: `.gitignore` and `docs/live_demo.txt` modified in git but not documented in story File List (likely from other work).

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 5 of 58** — the audit logging foundation that makes every VLPRS action traceable. This is a **government financial system** — the Accountant General's Office and auditors MUST be able to verify that every action is logged, timestamped, attributed, and tamper-proof.

**VLPRS has two distinct logging systems:**

| System | Purpose | Storage | Retention | Middleware |
|---|---|---|---|---|
| **Audit Log** (this story) | Governance & compliance — who did what, when, from where | PostgreSQL `audit_log` table (append-only, immutable) | 7+ years (per government regulation) | `auditLog` middleware |
| **Request Log** (this story) | Operations & debugging — request/response lifecycle, performance | pino → stdout → Docker log driver | Docker log rotation | `requestLogger` middleware |

Both are created in this story. They serve different purposes and have different lifecycles.

**What this story produces:**

| Component | Purpose | Consumed By |
|---|---|---|
| `audit_log` table | Immutable audit trail for every authenticated API call | Auditors (Journey 10), Reports (Epic 6), Admin screens (future) |
| `auditLog` middleware | Auto-captures user, action, resource, status, IP on every request | Every protected route in Epics 1-13 |
| `logAuthEvent()` function | Explicit auth event logging (login, logout, failed, lockout) | authService (this story), future auth flows |
| `requestLogger` middleware | pino structured JSON logging with requestId | Operations, debugging, monitoring |
| `hashBody()` utility | SHA-256 of request body for tamper evidence | auditLog middleware |
| `fn_prevent_modification` trigger | DB-level immutability enforcement | audit_log table (and ledger_entries in Epic 2) |
| `logger` factory | Centralised pino logger with redaction and serializers | Every server module |

**What previous stories created that this story builds on:**

| Component | Location | What Was Created | Story |
|---|---|---|---|
| authenticate middleware | `middleware/authenticate.ts` | JWT verification → req.user = { userId, email, role, mdaId } | 1.2 |
| authorise middleware | `middleware/authorise.ts` | Role-based route gate | 1.4 |
| scopeToMda middleware | `middleware/scopeToMda.ts` | MDA data isolation → req.mdaScope | 1.4 |
| AppError class | `lib/appError.ts` | Error class with statusCode, code, message, details | 1.2 |
| DB schema | `db/schema.ts` | users, mdas, refresh_tokens tables | 1.2 |
| Auth service | `services/authService.ts` | register(), login(), refreshToken(), logout(), revokeAllUserTokens() | 1.2, 1.3 |
| Auth routes | `routes/authRoutes.ts` | POST /auth/login, /register, /refresh, /logout | 1.2, 1.3 |
| User routes | `routes/userRoutes.ts` | GET /api/users (RBAC-protected reference endpoint) | 1.4 |
| pino logger | `index.ts` | Inline pino instance (this story extracts to shared module) | 1.1 |
| Express Request types | `types/express.d.ts` | req.user, req.mdaScope | 1.2, 1.4 |

### What NOT To Do

1. **DO NOT store raw request bodies** — Hash only (SHA-256). Request bodies contain passwords, PII, financial data. Only the hash goes in audit_log.
2. **DO NOT let audit log failures crash API responses** — Fire-and-forget pattern. If the DB insert fails, log to pino, but return the API response normally.
3. **DO NOT create the audit log viewer UI** — Auditors access audit data directly or via future reports (Epic 6). No admin screen in this story.
4. **DO NOT log response bodies** — Only response_status (integer). Response bodies may contain sensitive data and are not needed for audit compliance.
5. **DO NOT use `pino-http` package** — Create a simple custom requestLogger middleware. pino-http adds unnecessary complexity for our use case.
6. **DO NOT implement audit log search/filtering API** — Future story. This story creates the table and write path only.
7. **DO NOT create a `__tests__` directory** — Tests co-located next to source files.
8. **DO NOT use `trust proxy: true`** — Set `'loopback'` specifically. `true` trusts ALL proxies, which is a security vulnerability (IP spoofing via X-Forwarded-For).
9. **DO NOT log to both pino AND audit_log for the same event** — pino is for operational logs (request lifecycle). audit_log is for governance compliance (who did what). They have different schemas and purposes.
10. **DO NOT make the audit middleware async in the request path** — Use `res.on('finish')` with fire-and-forget async DB insert. The middleware itself calls `next()` synchronously.

### Database Schema

**`audit_log` table — add to `apps/server/src/db/schema.ts`:**

```
audit_log:
  id                uuid PRIMARY KEY (UUIDv7)
  user_id           uuid REFERENCES users(id) -- nullable for failed logins
  email             varchar(255)              -- for auth events (login attempts)
  role              varchar(50)               -- from JWT claims (nullable for unauthenticated events)
  mda_id            uuid                      -- from JWT claims (nullable)
  action            varchar(100) NOT NULL     -- e.g., AUTH_LOGIN_SUCCESS, USERS_LIST, AUTH_REGISTER
  resource          varchar(255)              -- e.g., /api/auth/login, /api/users
  method            varchar(10)               -- GET, POST, PUT, PATCH, DELETE
  request_body_hash varchar(64)               -- SHA-256 hex digest (nullable for GET/HEAD)
  response_status   integer                   -- HTTP status code (nullable for service-level events)
  ip_address        varchar(45) NOT NULL      -- IPv4 or IPv6
  user_agent        text                      -- Browser/client identifier
  duration_ms       integer                   -- Request processing time (nullable for service-level events)
  created_at        timestamptz NOT NULL DEFAULT now()
```

**No `updated_at`** — append-only table, never updated.
**No `deleted_at`** — never deleted.
**`user_id` is nullable** — failed login attempts don't have authenticated users.
**`email` column** — for auth events where we need to log which email was attempted.

**Indexes:**
- `idx_audit_log_user_id` on (user_id) — query user's activity history
- `idx_audit_log_created_at` on (created_at) — time-range queries for audit reports
- `idx_audit_log_action` on (action) — filter by event type

**Immutability trigger:**
```sql
CREATE OR REPLACE FUNCTION fn_prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Modifications to % are not allowed: % operation rejected',
    TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
CREATE TRIGGER trg_audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_modification();
```

**Note:** The `fn_prevent_modification()` function is reusable — Epic 2 will apply it to `ledger_entries` too (same 3-layer immutability pattern from architecture).

### Action Naming Convention

```
Pattern: RESOURCE_VERB or AUTH_EVENT

Authentication events (logged explicitly by authService):
  AUTH_LOGIN_SUCCESS        — successful login
  AUTH_LOGIN_FAILED         — wrong credentials
  AUTH_LOGOUT               — user logout
  AUTH_ACCOUNT_LOCKED       — lockout after 5 failures
  AUTH_TOKEN_REFRESH        — token rotation
  AUTH_TOKEN_REUSE_DETECTED — potential theft, nuclear revocation
  AUTH_REGISTER             — new user created

Middleware-generated actions (derived from method + resource):
  GET  /api/users      → USERS_LIST
  POST /api/auth/register → AUTH_REGISTER  (override by explicit auth event)
  GET  /api/health     → not logged (unauthenticated)
```

**Action derivation logic in auditLog middleware:**
```typescript
function deriveAction(req: Request): string {
  // Check for explicit action set by auth event logging
  if (req.auditAction) return req.auditAction;

  const method = req.method.toUpperCase();
  const resource = req.route?.path ?? req.path;

  // Extract resource name from path: /api/users → USERS, /api/auth/login → AUTH_LOGIN
  const segments = resource.replace(/^\/api\//, '').split('/').filter(Boolean);
  const resourceName = segments
    .filter(s => !s.startsWith(':')) // Remove param segments
    .join('_')
    .toUpperCase();

  const verbMap: Record<string, string> = {
    GET: 'LIST',
    POST: 'CREATE',
    PUT: 'UPDATE',
    PATCH: 'UPDATE',
    DELETE: 'DELETE',
  };

  return `${resourceName}_${verbMap[method] ?? method}`;
}
```

### auditLog Middleware — Implementation

**`apps/server/src/middleware/auditLog.ts`:**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { auditLog as auditLogTable } from '../db/schema';
import { hashBody } from '../lib/hashBody';
import { extractClientIp } from '../lib/extractIp';
import { logger } from '../lib/logger';

/**
 * Audit log middleware — captures authenticated API calls.
 * Uses res.on('finish') to capture response status after handler completes.
 * Fire-and-forget: DB failures logged to pino, never block response.
 *
 * Position in chain: authenticate → authorise → scopeToMda → validate → auditLog → handler
 */
export function auditLog(req: Request, res: Response, next: NextFunction): void {
  const startTime = process.hrtime.bigint();

  // Capture request data now (before any mutation)
  const userId = req.user?.userId ?? null;
  const email = req.user?.email ?? null;
  const role = req.user?.role ?? null;
  const mdaId = req.user?.mdaId ?? null;
  const method = req.method;
  const resource = req.originalUrl;
  const bodyHash = hashBody(req.body);
  const ip = extractClientIp(req);
  const userAgent = req.get('user-agent') ?? null;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    // Fire-and-forget: async insert, catch errors silently
    db.insert(auditLogTable)
      .values({
        userId,
        email,
        role,
        mdaId,
        action: deriveAction(req),
        resource,
        method,
        requestBodyHash: bodyHash,
        responseStatus: res.statusCode,
        ipAddress: ip,
        userAgent,
        durationMs: Math.round(durationMs),
      })
      .catch((err) => {
        logger.error({ err, userId, resource, method }, 'Failed to write audit log entry');
      });
  });

  next();
}
```

### logAuthEvent — Explicit Auth Event Logging

**`apps/server/src/services/auditService.ts`:**

```typescript
import { db } from '../db';
import { auditLog } from '../db/schema';
import { logger } from '../lib/logger';

interface AuthEventInput {
  userId?: string | null;
  email: string;
  role?: string | null;
  mdaId?: string | null;
  action: string;
  resource: string;
  method?: string;
  responseStatus?: number;
  ipAddress: string;
  userAgent?: string | null;
}

/**
 * Log an authentication event to the audit_log table.
 * Called explicitly from authService for login, logout, failed attempts, lockout.
 * Fire-and-forget: never throws, logs errors to pino.
 */
export async function logAuthEvent(event: AuthEventInput): Promise<void> {
  try {
    await db.insert(auditLog).values({
      userId: event.userId ?? null,
      email: event.email,
      role: event.role ?? null,
      mdaId: event.mdaId ?? null,
      action: event.action,
      resource: event.resource,
      method: event.method ?? 'POST',
      requestBodyHash: null, // Auth events don't hash bodies (contains passwords)
      responseStatus: event.responseStatus ?? null,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent ?? null,
      durationMs: null,
    });
  } catch (err) {
    logger.error({ err, action: event.action, email: event.email }, 'Failed to log auth event');
  }
}
```

**Integration with authService:**

```typescript
// In authService.login() — after successful login:
await logAuthEvent({
  userId: user.id,
  email: user.email,
  role: user.role,
  mdaId: user.mdaId,
  action: 'AUTH_LOGIN_SUCCESS',
  resource: '/api/auth/login',
  responseStatus: 200,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

// In authService.login() — after failed login:
await logAuthEvent({
  email: loginEmail,
  action: 'AUTH_LOGIN_FAILED',
  resource: '/api/auth/login',
  responseStatus: 401,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

// In authService.login() — after account lockout:
await logAuthEvent({
  email: loginEmail,
  action: 'AUTH_ACCOUNT_LOCKED',
  resource: '/api/auth/login',
  responseStatus: 423,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});

// In authService.logout():
await logAuthEvent({
  userId: req.user.userId,
  email: req.user.email,
  role: req.user.role,
  action: 'AUTH_LOGOUT',
  resource: '/api/auth/logout',
  responseStatus: 200,
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});
```

**Note on passing req context to authService:** The authService functions will need access to `req.ip` and `req.get('user-agent')`. The cleanest pattern is to pass an `auditContext` object from the route handler:

```typescript
interface AuditContext {
  ipAddress: string;
  userAgent: string | null;
}
```

### Shared Logger Factory

**`apps/server/src/lib/logger.ts`:**

```typescript
import { pino } from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
  base: { service: 'vlprs-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.hashedPassword', '*.token'],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});
```

**Update `apps/server/src/index.ts`** — replace the inline pino instance with `import { logger } from './lib/logger'`.

### Request Logger Middleware

**`apps/server/src/middleware/requestLogger.ts`:**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger';

/**
 * Structured request/response logging with pino.
 * Generates a unique X-Request-Id per request.
 * Mounted globally (before routes, after body parsing).
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) ?? randomUUID();
  const startTime = process.hrtime.bigint();

  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;

    const logData = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      userId: req.user?.userId,
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'Request failed');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'Request client error');
    } else {
      logger.info(logData, 'Request completed');
    }
  });

  next();
}
```

### hashBody Utility

**`apps/server/src/lib/hashBody.ts`:**

```typescript
import { createHash } from 'node:crypto';

/**
 * Computes a SHA-256 hex digest of the given request body.
 * Uses sorted keys for deterministic output regardless of property order.
 * Returns null for empty/undefined/null bodies.
 */
export function hashBody(body: unknown): string | null {
  if (body === undefined || body === null) return null;
  if (typeof body === 'object' && Object.keys(body as object).length === 0) return null;

  const serialized = JSON.stringify(body, Object.keys(body as object).sort());

  return createHash('sha256')
    .update(serialized, 'utf8')
    .digest('hex');
}
```

### extractClientIp Utility

**`apps/server/src/lib/extractIp.ts`:**

```typescript
import type { Request } from 'express';

/**
 * Extracts the client IP address from an Express request.
 * When trust proxy is configured, req.ip is the resolved client IP.
 * Normalizes IPv6-mapped IPv4 addresses.
 */
export function extractClientIp(req: Request): string {
  let ip = req.ip;

  if (!ip) {
    ip = req.socket.remoteAddress ?? 'unknown';
  }

  // Normalize ::ffff:127.0.0.1 → 127.0.0.1
  if (ip?.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  return ip;
}
```

### Express Trust Proxy Configuration

**Add to `apps/server/src/app.ts`:**

```typescript
// REQUIRED for correct IP extraction behind Nginx
app.set('trust proxy', 'loopback');
```

This must be set BEFORE any middleware that uses `req.ip`. Place it right after `const app = express()`.

### Trigger Setup Script

**`apps/server/src/db/applyTriggers.ts`:**

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { env } from '../config/env';

async function applyTriggers(): Promise<void> {
  const db = drizzle(env.DATABASE_URL);

  // Reusable immutability function
  await db.execute(sql`
    CREATE OR REPLACE FUNCTION fn_prevent_modification()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'Modifications to % are not allowed: % operation rejected',
        TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'restrict_violation';
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Immutability trigger on audit_log
  await db.execute(sql`
    DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
    CREATE TRIGGER trg_audit_log_immutable
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW
      EXECUTE FUNCTION fn_prevent_modification();
  `);

  console.log('Triggers applied successfully: fn_prevent_modification → audit_log');
  process.exit(0);
}

applyTriggers().catch((err) => {
  console.error('Failed to apply triggers:', err);
  process.exit(1);
});
```

**Add to `apps/server/package.json` scripts:**

```json
"db:triggers": "tsx src/db/applyTriggers.ts",
"db:push": "drizzle-kit push && tsx src/db/applyTriggers.ts"
```

### Middleware Chain — Final Position

**Updated middleware chain with Story 1.5 additions:**

```
1. helmet              ← Story 1.1 (global)
2. cors                ← Story 1.1 (global)
3. cookie-parser       ← Story 1.2 (global)
4. body parsing        ← Story 1.1 (global)
5. requestLogger       ← THIS STORY (global — pino request/response log)
6. rateLimiter         ← Story 1.2 (per-route)
7. [captcha]           ← Story 1.6 (per-route, future)
8. authenticate        ← Story 1.2 (per-route)
9. csrfProtect         ← Story 1.3 (per-route, cookie-dependent only)
10. authorise(...roles) ← Story 1.4 (per-route)
11. scopeToMda         ← Story 1.4 (per-route)
12. validate           ← Story 1.2 (per-route)
13. auditLog           ← THIS STORY (per-route — only on authenticated endpoints)
14. route handler
```

**requestLogger** is global — logs every request including unauthenticated ones (health, login).
**auditLog** is per-route — only on endpoints after authenticate middleware, captures user context.

### Per-Route Middleware Application After Story 1.5

| Endpoint | Rate Limit | Auth | CSRF | Authorise | MDA Scope | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET /api/health | No | No | No | No | No | No | Public, not audited |
| POST /api/auth/login | authLimiter | No | No | No | No | Explicit* | Auth events via logAuthEvent() |
| POST /api/auth/register | No | authenticate | No | authorise(SA) | scopeToMda | auditLog | Admin action |
| POST /api/auth/refresh | authLimiter | No | csrfProtect | No | No | No | Session maintenance |
| POST /api/auth/logout | No | authenticate | csrfProtect | No | No | Explicit* | Auth event via logAuthEvent() |
| GET /api/users | No | authenticate | No | authorise(SA, DA) | scopeToMda | auditLog | Admin listing |

*Login and logout use explicit `logAuthEvent()` calls from authService, not the middleware, because login events include unauthenticated failures.

### Architecture Compliance

**3-Layer Immutability Enforcement** (from architecture — applied to audit_log):

| Layer | Mechanism | Protection |
|---|---|---|
| 1. Database | PostgreSQL `BEFORE UPDATE OR DELETE` trigger | Raises exception, blocks all modifications |
| 2. ORM | Drizzle schema — no `update()` or `delete()` calls on audit_log in codebase | Code-level prevention |
| 3. API | No PUT/PATCH/DELETE routes for audit_log | No HTTP method to modify |

**Structured Log Format** (matches architecture specification):

```json
{
  "level": "info",
  "time": "2026-02-18T10:30:00.000Z",
  "service": "vlprs-api",
  "requestId": "abc-123",
  "method": "POST",
  "url": "/api/submissions",
  "statusCode": 201,
  "durationMs": 342,
  "ip": "102.89.x.x",
  "userId": "019..."
}
```

**Pino Log Levels** (per architecture):

| Level | Usage |
|---|---|
| `error` | Unhandled exceptions, failed DB transactions, audit log failures, 500+ responses |
| `warn` | Rate limit triggered, 400-499 responses, auth failures |
| `info` | Successful API requests, auth events, normal operations |
| `debug` | Query execution, computation steps (dev only) |
| `silent` | Test environment — no log output |

### Library & Framework Requirements

**No new dependencies needed.** All capabilities come from existing packages:

| Capability | Package | Already Installed |
|---|---|---|
| Structured logging | `pino` ^9.6.0 | Yes (Story 1.1) |
| Dev log formatting | `pino-pretty` ^13.0.0 | Yes (Story 1.1) |
| SHA-256 hashing | `node:crypto` (built-in) | Built-in |
| UUID generation | `node:crypto` (randomUUID) | Built-in |
| DB insertion | `drizzle-orm` ^0.45.0 | Yes (Story 1.1) |

### File Structure Requirements

**New files this story MUST create:**

```
apps/server/src/
├── lib/
│   ├── logger.ts                       # Centralised pino logger factory
│   ├── hashBody.ts                     # SHA-256 request body hash
│   ├── hashBody.test.ts               # Hash utility tests
│   ├── extractIp.ts                    # Client IP extraction
│   └── extractIp.test.ts             # IP extraction tests
├── middleware/
│   ├── requestLogger.ts               # pino request/response logging (global)
│   ├── auditLog.ts                    # Audit log middleware (per-route)
│   └── auditLog.test.ts              # Audit middleware tests
├── services/
│   ├── auditService.ts                # logAuthEvent(), logAuditEntry()
│   └── auditService.test.ts          # Audit service tests
├── db/
│   └── applyTriggers.ts              # Idempotent trigger setup script
└── routes/
    └── auditLog.integration.test.ts  # Integration tests for audit logging
```

**Files this story MUST modify:**

```
apps/server/src/db/schema.ts           # Add audit_log table
apps/server/src/app.ts                 # Add trust proxy, mount requestLogger, apply auditLog to routes
apps/server/src/index.ts               # Replace inline pino with shared logger
apps/server/src/services/authService.ts # Add logAuthEvent() calls to login/logout/failed/lockout
apps/server/package.json               # Add db:triggers, db:push scripts
packages/shared/src/constants/vocabulary.ts  # Add audit vocabulary (if needed)
packages/shared/src/index.ts           # Export any new audit types
```

**Files this story MUST NOT modify:**

```
apps/server/src/routes/healthRoutes.ts  # Health check — not audited
apps/server/src/db/index.ts            # Drizzle client — no changes
apps/server/src/lib/uuidv7.ts          # UUID generator — no changes
apps/server/src/lib/jwt.ts             # JWT library — no changes
apps/server/src/lib/password.ts        # Password library — no changes
apps/server/src/lib/tokenHash.ts       # Token hash — no changes
apps/server/src/lib/appError.ts        # AppError class — no changes
apps/server/src/middleware/authenticate.ts   # JWT verification — no changes
apps/server/src/middleware/authorise.ts      # Role authorization — no changes
apps/server/src/middleware/scopeToMda.ts     # MDA scoping — no changes
apps/server/src/middleware/validate.ts       # Zod validation — no changes
apps/server/src/middleware/rateLimiter.ts    # Rate limiter — no changes
apps/server/src/middleware/csrf.ts           # CSRF protection — no changes
apps/server/src/config/env.ts          # Environment — no changes
apps/client/**                         # NO frontend changes in this story
```

### Testing Requirements

**Framework:** Vitest (co-located) + supertest (integration)

**Unit Tests:**

1. **`apps/server/src/lib/hashBody.test.ts`:**
   - `hashBody(undefined)` returns null
   - `hashBody(null)` returns null
   - `hashBody({})` returns null (empty object)
   - `hashBody({ email: 'a@b.com' })` returns a 64-char hex string
   - `hashBody({ b: 1, a: 2 })` equals `hashBody({ a: 2, b: 1 })` (key order independent)
   - Same input always produces same hash (deterministic)
   - Different inputs produce different hashes

2. **`apps/server/src/lib/extractIp.test.ts`:**
   - Extracts req.ip when available
   - Falls back to req.socket.remoteAddress
   - Normalizes `::ffff:127.0.0.1` to `127.0.0.1`
   - Returns 'unknown' when no IP available

3. **`apps/server/src/middleware/auditLog.test.ts`:**
   - Calls next() immediately (does not block)
   - Captures userId, role, mdaId from req.user
   - Captures method, originalUrl, IP, user-agent
   - Hashes request body for POST/PUT/PATCH
   - Sets null hash for GET requests
   - Writes to DB on res.finish with correct responseStatus
   - Logs to pino if DB insert fails (does not throw)

4. **`apps/server/src/services/auditService.test.ts`:**
   - `logAuthEvent()` inserts correct fields for login success
   - `logAuthEvent()` inserts correct fields for login failure (no userId)
   - `logAuthEvent()` inserts correct fields for logout
   - `logAuthEvent()` inserts correct fields for account lockout
   - `logAuthEvent()` catches and logs DB errors (never throws)

**Integration Tests:**

5. **`apps/server/src/routes/auditLog.integration.test.ts`:**
   - GET /api/users with admin JWT → audit_log entry created with USERS_LIST action
   - POST /api/auth/register with admin JWT → audit_log entry with AUTH_REGISTER action
   - Login success → audit_log entry with AUTH_LOGIN_SUCCESS
   - Login failure → audit_log entry with AUTH_LOGIN_FAILED (no user_id)
   - Logout → audit_log entry with AUTH_LOGOUT
   - Account lockout → audit_log entry with AUTH_ACCOUNT_LOCKED
   - Trigger test: direct UPDATE on audit_log → error (restrict_violation)
   - Trigger test: direct DELETE on audit_log → error (restrict_violation)
   - Health check → NO audit_log entry (unauthenticated endpoint)
   - Audit log entry has correct IP address, user agent, duration_ms > 0

### Previous Story Intelligence (from Stories 1.1-1.4)

**From Story 1.1 (scaffold):**
1. DB port is **5433** (not 5432)
2. `pino` and `pino-pretty` already installed — refactor the inline logger, don't reinstall
3. Tests co-located next to source files
4. Express 5 async errors auto-forwarded

**From Story 1.2 (auth foundation):**
1. `authService.login()` needs modification — add `logAuthEvent()` calls
2. `authService.login()` handles both success and failure paths — both need audit logging
3. Route handlers don't currently pass IP/user-agent to service — need to add `auditContext` parameter
4. AppError class catches all errors — audit middleware's `res.on('finish')` fires for both success and error responses

**From Story 1.3 (session security):**
1. `authService.logout()` needs audit logging added
2. `authService.refreshToken()` — token refresh events may optionally be logged (AUTH_TOKEN_REFRESH)
3. Reuse detection already revokes all tokens — should log AUTH_TOKEN_REUSE_DETECTED

**From Story 1.4 (RBAC):**
1. `authorise` middleware 403 responses will be captured by `auditLog` middleware (if mounted after authorise)
2. `scopeToMda` sets `req.mdaScope` — audit middleware captures `req.user.mdaId` directly from JWT
3. GET /api/users is the first protected endpoint — use as test target for audit log integration

**Express 5 gotchas:**
- `res.on('finish')` fires after the response is fully written — `res.statusCode` is correct at this point
- `req.ip` requires `trust proxy` to be configured for correct IP behind Nginx
- Async middleware that calls `next()` synchronously and does async work in `res.on('finish')` is the correct pattern

### Git Intelligence

**Recent commits:**
```
9e6dd63 fix: code review fixes for Story 1.1 scaffold (14 issues resolved)
2084119 chore: scaffold VLPRS monorepo (Story 1.1)
```

**Branch:** `dev` | **Commit style:** `type: description` (conventional commits)

### Latest Technology Intelligence (Feb 2026)

| Technology | Version | Key Notes |
|---|---|---|
| `pino` | 9.6.0 (installed) | v10.x drops Node 18 — stay on 9.x. v9.8.0 has TypeScript BaseLogger regression — 9.6.0 is safe. |
| `pino-pretty` | 13.0.0 (installed) | Compatible with pino 9.x. Dev-only transport. |
| `node:crypto` | Built-in | createHash('sha256') for body hashing. randomUUID() for request IDs. |
| PostgreSQL triggers | PG 14+ | Supports CREATE OR REPLACE TRIGGER. Use DROP IF EXISTS + CREATE for compatibility. |
| `drizzle-kit push` | 0.31.9 | Does NOT manage triggers — apply separately via db.execute(sql`...`). |
| Express 5 `trust proxy` | 5.1.0 | Set to `'loopback'` not `true`. `req.ip` resolves X-Forwarded-For correctly. |

### Scope Boundaries

**Explicitly IN scope:**
- `audit_log` table with UUIDv7 PK, immutability trigger
- `auditLog` middleware (per-route, fire-and-forget)
- `logAuthEvent()` function (explicit auth event logging)
- `requestLogger` middleware (global pino request logging)
- `logger` factory (centralised pino instance)
- `hashBody()` utility (SHA-256)
- `extractClientIp()` utility
- Trigger setup script (`applyTriggers.ts`)
- Integration with existing authService (login/logout/failed/lockout events)
- Comprehensive unit and integration tests

**Explicitly NOT in scope (later stories):**
- Audit log viewer UI / search API (future — possibly Epic 6 or admin screens)
- Frontend request logging (Story 1.6 builds the frontend)
- Email notifications on security events (Epic 9)
- Audit log export to CSV (Journey 10 — auditor workflow)
- Ledger immutability trigger (Epic 2 — uses same fn_prevent_modification)
- Response body logging (not required, privacy concern)
- Log aggregation / external log service (post-MVP)

### Non-Punitive Vocabulary Rules

Audit logging is primarily backend — no user-facing error messages needed. However, if the audit trigger fires (should never happen in normal operation):

| Code | Context | Notes |
|---|---|---|
| (DB trigger) | "Modifications to audit_log are not allowed" | Internal error — never exposed to users. Logged to pino. |

Auth event logging uses existing non-punitive vocabulary from Stories 1.2-1.3. No new user-facing vocabulary needed.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.5]
- [Source: _bmad-output/planning-artifacts/architecture.md#Audit Logging]
- [Source: _bmad-output/planning-artifacts/architecture.md#Structured Log Format]
- [Source: _bmad-output/planning-artifacts/architecture.md#Logging Levels]
- [Source: _bmad-output/planning-artifacts/architecture.md#Data Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#Immutable Ledger Enforcement]
- [Source: _bmad-output/planning-artifacts/architecture.md#Middleware Chain]
- [Source: _bmad-output/planning-artifacts/prd.md#FR47 Authentication Event Logging]
- [Source: _bmad-output/planning-artifacts/prd.md#FR48 User Action Logging]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC-6 Audit Logging]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC-7 Audit Log Protection]
- [Source: _bmad-output/planning-artifacts/prd.md#Journey 10 Auditor Investigation]
- [Source: _bmad-output/planning-artifacts/prd.md#NDPR Compliance Data Retention]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Audit Trail by Design]
- [Source: _bmad-output/implementation-artifacts/1-2-user-registration-login.md#Auth Implementation]
- [Source: _bmad-output/implementation-artifacts/1-3-session-security-token-refresh.md#Token Refresh Flow]
- [Source: _bmad-output/implementation-artifacts/1-4-role-based-access-control.md#Middleware Architecture]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Existing integration tests (Stories 1.1-1.4) failed on cleanup due to FK constraint between audit_log.user_id → users.id and the immutability trigger preventing DELETE. Fixed by adding `TRUNCATE audit_log` before user deletion in all 5 test files. TRUNCATE bypasses row-level triggers.
- Logout integration test failed initially due to incorrect CSRF token extraction. Fixed by using the same cookie parsing pattern as existing authRoutes.refresh.test.ts (`__csrf` cookie + `X-CSRF-Token` header).
- Immutability trigger test assertions failed because Drizzle ORM wraps PostgreSQL errors with "Failed query:" prefix. Fixed by extracting the cause message and matching against the combined string.

### Completion Notes List

- **Task 1:** audit_log table added to schema.ts with UUIDv7 PK, all AC-specified columns, 3 indexes. No updated_at/deleted_at. Schema pushed successfully.
- **Task 2:** Immutability trigger (fn_prevent_modification) created as reusable function. Applied to audit_log via trg_audit_log_immutable. db:triggers and db:push scripts added. Verified UPDATE/DELETE are rejected.
- **Task 3:** Shared logger factory extracted from inline pino in index.ts. Configured with redaction paths, base service name, pino-pretty in dev, silent in test.
- **Task 4:** hashBody utility implements SHA-256 with sorted keys for deterministic hashing. Returns null for empty/undefined/null. extractClientIp utility normalizes IPv6-mapped addresses. Both have comprehensive unit tests (11 tests).
- **Task 5:** requestLogger middleware mounted globally after body parsing. Generates X-Request-Id, logs structured JSON with method/url/statusCode/durationMs. Uses pino log levels: error (500+), warn (400-499), info (200-399).
- **Task 6:** auditLog middleware captures authenticated requests via res.on('finish'). Fire-and-forget pattern: DB errors logged to pino, never block response. deriveAction() generates RESOURCE_VERB action names from method+path. 7 unit tests.
- **Task 7:** auditService provides logAuthEvent() for explicit auth event logging. Integrated with authService: login success/failure, logout, account lockout all log to audit_log. AuditContext pattern passes IP/user-agent from routes. 5 unit tests.
- **Task 8:** auditLog middleware applied per-route to register and users endpoints. Login/logout use explicit logAuthEvent() calls. trust proxy set to 'loopback'. No new shared vocabulary needed (audit is backend-only).
- **Task 9:** 10 integration tests covering: middleware audit entries, auth events (login/fail/logout/lockout), immutability trigger rejection, health check exclusion, data quality. All 139 tests pass across 4 workspaces.

### File List

**New files:**
- apps/server/src/db/applyTriggers.ts
- apps/server/src/lib/logger.ts
- apps/server/src/lib/hashBody.ts
- apps/server/src/lib/hashBody.test.ts
- apps/server/src/lib/extractIp.ts
- apps/server/src/lib/extractIp.test.ts
- apps/server/src/middleware/requestLogger.ts
- apps/server/src/middleware/auditLog.ts
- apps/server/src/middleware/auditLog.test.ts
- apps/server/src/services/auditService.ts
- apps/server/src/services/auditService.test.ts
- apps/server/src/routes/auditLog.integration.test.ts

**Modified files:**
- apps/server/src/db/schema.ts (added audit_log table)
- apps/server/src/app.ts (trust proxy, requestLogger middleware)
- apps/server/src/index.ts (replaced inline pino with shared logger)
- apps/server/src/services/authService.ts (added logAuthEvent calls, AuditContext param)
- apps/server/src/routes/authRoutes.ts (auditLog middleware, extractClientIp, audit context)
- apps/server/src/routes/userRoutes.ts (auditLog middleware)
- apps/server/src/types/express.d.ts (added auditAction to Request)
- apps/server/package.json (db:triggers, db:push scripts)
- apps/server/src/services/authService.test.ts (audit_log TRUNCATE in cleanup)
- apps/server/src/services/authService.refresh.test.ts (audit_log TRUNCATE in cleanup)
- apps/server/src/routes/authRoutes.test.ts (audit_log TRUNCATE in cleanup)
- apps/server/src/routes/authRoutes.refresh.test.ts (audit_log TRUNCATE in cleanup)
- apps/server/src/routes/userRoutes.test.ts (audit_log TRUNCATE in cleanup)

### Change Log

- 2026-02-20: Implemented Story 1.5 — Audit Logging & Action Tracking. Created audit_log table with DB-level immutability trigger, auditLog middleware (per-route, fire-and-forget), requestLogger middleware (global pino), logAuthEvent service, shared logger factory, hashBody utility, extractClientIp utility. Integrated auth event logging into authService. 139 tests passing across all workspaces.
- 2026-02-20: Code review fixes (9 issues: 2 HIGH, 4 MEDIUM, 3 LOW). H1: Fixed hashBody to use recursive key sorting (was silently dropping nested keys via JSON.stringify array replacer). H2: Added AUTH_TOKEN_REUSE_DETECTED and AUTH_TOKEN_REFRESH audit events to refreshToken(). M3: Validated external X-Request-Id header (length/format). M4: Added action name assertion to register integration test. M5: Replaced fragile 200ms setTimeout with polling helper in integration tests. M6: Added `void` prefix to all fire-and-forget logAuthEvent calls. L7: Fixed misleading JSDoc on auditAction. L8: Added fallback for empty resource prefix in deriveAction. 141 tests passing across all workspaces.
