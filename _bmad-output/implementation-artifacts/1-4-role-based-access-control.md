# Story 1.4: Role-Based Access Control

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-18 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocks: 1.5 (Audit Logging), 1.6 (Frontend Auth Shell), 1.8a (Design Foundation), ALL Epic 2+ stories -->
<!-- Blocked By: 1.2 (User Registration & Login), 1.3 (Session Security & Token Refresh) -->
<!-- FRs: FR43, FR44, FR45, FR46 | NFRs: NFR-SEC-2 -->

## Story

As the **system**,
I want to enforce role-based permissions on every API endpoint,
so that Super Admin, Department Admin, and MDA Officers each access only what they're authorised for.

## Acceptance Criteria (BDD)

### AC1: Middleware Chain Execution Order

```gherkin
Given 3 MVP roles exist: super_admin, dept_admin, mda_officer
When the middleware chain processes a request to a protected endpoint
Then each middleware executes in order: authenticate → authorise(requiredRoles) → scopeToMda → route handler
And the request is rejected at the first failing middleware (short-circuit)
```

### AC2: Super Admin — Full System Access

```gherkin
Given a user with role super_admin
When they access any API endpoint
Then the authorise middleware permits the request
And the scopeToMda middleware sets req.mdaScope to null (unscoped — full cross-MDA visibility)
And all downstream queries return data across all MDAs (FR44)
```

### AC3: Department Admin — Full Data Access with Management Capabilities

```gherkin
Given a user with role dept_admin
When they access API endpoints for loans, migrations, exceptions, reports, and user management
Then the authorise middleware permits the request
And the scopeToMda middleware sets req.mdaScope to null (dept_admin has cross-MDA visibility)
And they can view all data, manage loans, process migrations, and resolve exceptions (FR45)
```

### AC4: MDA Officer — Own-MDA Data Isolation

```gherkin
Given a user with role mda_officer and mdaId "mda-123"
When they access any API endpoint
Then all queries are automatically scoped by their mda_id from the JWT (FR46)
And the scopeToMda middleware sets req.mdaScope to "mda-123"
And attempting to access another MDA's data returns 403:
  {
    "success": false,
    "error": { "code": "MDA_ACCESS_DENIED",
               "message": "You can only access data for your assigned organisation." }
  }
```

### AC5: Missing or Insufficient Role — Request Rejection

```gherkin
Given any API endpoint protected by authorise(requiredRoles)
When a request arrives without a valid JWT
Then the request is rejected with 401 (no token) before reaching authorise

When a request arrives with a valid JWT but insufficient role
Then the authorise middleware rejects with 403:
  {
    "success": false,
    "error": { "code": "INSUFFICIENT_PERMISSIONS",
               "message": "You do not have permission to perform this action." }
  }
And the request never reaches the route handler (NFR-SEC-2)
```

### AC6: Route Protection — Existing Endpoints

```gherkin
Given the existing auth endpoints from Stories 1.2 and 1.3
When the authorise middleware is applied to POST /api/auth/register
Then only super_admin can access it (replacing the inline role check from Story 1.2)

When any future protected endpoint is created
Then it MUST use the middleware chain: authenticate → authorise(...roles) → scopeToMda → handler
And there is a documented permission matrix mapping endpoints to allowed roles
```

### AC7: Shared Package — Role Constants and Permission Types

```gherkin
Given the packages/shared package
When I inspect the role constants and types
Then ROLES, Role, ALL_ROLES are exported from @vlprs/shared (already created in Story 1.2)
And a PERMISSION_MATRIX constant maps resource:action pairs to allowed roles
And an AuthorisedRequest type is exported for handlers that require guaranteed user context
```

### AC8: Tests — Authorisation Coverage

```gherkin
Given Story 1.4 is implemented
When I run pnpm test from the monorepo root
Then unit tests pass for: authorise middleware (each role permitted/denied), scopeToMda middleware (scope set correctly for each role)
And integration tests pass for: protected endpoint access per role, MDA scoping enforcement, 401 for missing auth, 403 for wrong role, 403 for cross-MDA access
And all existing tests from Stories 1.1-1.3 continue to pass
```

## Tasks / Subtasks

- [x] Task 1: Shared package — permission matrix and types (AC: #7)
  - [x] 1.1 Create `packages/shared/src/types/rbac.ts` — AuthorisedRequest, PermissionMatrix, ResourceAction types
  - [x] 1.2 Create `packages/shared/src/constants/permissions.ts` — PERMISSION_MATRIX mapping resource:action to allowed roles
  - [x] 1.3 Update `packages/shared/src/constants/vocabulary.ts` — add RBAC error messages
  - [x] 1.4 Update `packages/shared/src/index.ts` — export new types and constants
- [x] Task 2: Extend Express Request type (AC: #1, #4)
  - [x] 2.1 Create `apps/server/src/types/express.d.ts` — add `mdaScope` property to Express Request
  - [x] 2.2 Ensure `tsconfig.json` includes the types directory
- [x] Task 3: Create authorise middleware (AC: #1, #2, #3, #5)
  - [x] 3.1 Create `apps/server/src/middleware/authorise.ts` — factory function accepting Role[] rest params
  - [x] 3.2 Validate at least one role passed (fail-fast at startup)
  - [x] 3.3 Deny-by-default: reject if no req.user or role not in allowed set
  - [x] 3.4 Use non-punitive VOCABULARY messages for 403 response
- [x] Task 4: Create scopeToMda middleware (AC: #2, #3, #4)
  - [x] 4.1 Create `apps/server/src/middleware/scopeToMda.ts` — set req.mdaScope based on role
  - [x] 4.2 super_admin and dept_admin: set req.mdaScope = null (unscoped)
  - [x] 4.3 mda_officer: set req.mdaScope = req.user.mdaId (enforced scoping)
  - [x] 4.4 If mda_officer has no mdaId in JWT → throw 403 MDA_NOT_ASSIGNED
- [x] Task 5: Create MDA scope query helpers (AC: #4)
  - [x] 5.1 Create `apps/server/src/lib/mdaScope.ts` — withMdaScope() helper for Drizzle queries
  - [x] 5.2 Helper adds WHERE mda_id = scope when scope is not null, passes through when null
  - [x] 5.3 Create `apps/server/src/lib/mdaScope.test.ts` — unit tests for scope helper
- [x] Task 6: Refactor existing register route (AC: #6)
  - [x] 6.1 Replace inline super_admin check in authRoutes.ts with authorise(ROLES.SUPER_ADMIN) middleware
  - [x] 6.2 Add scopeToMda to register route chain (for consistency, even though register doesn't query MDA-scoped data)
  - [x] 6.3 Verify existing register tests still pass
- [x] Task 7: Create protected route example — GET /api/users (AC: #2, #3, #4, #6)
  - [x] 7.1 Create `apps/server/src/routes/userRoutes.ts` — GET /api/users (list users)
  - [x] 7.2 Create `apps/server/src/services/userService.ts` — listUsers() with MDA-scoped query
  - [x] 7.3 Mount userRoutes in app.ts at /api
  - [x] 7.4 Middleware chain: authenticate → authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN) → scopeToMda → handler
  - [x] 7.5 super_admin/dept_admin see all users; mda_officer gets 403 on this endpoint
- [x] Task 8: Tests (AC: #8)
  - [x] 8.1 Create `apps/server/src/middleware/authorise.test.ts` — unit tests for authorise factory
  - [x] 8.2 Create `apps/server/src/middleware/scopeToMda.test.ts` — unit tests for MDA scoping
  - [x] 8.3 Create `apps/server/src/routes/userRoutes.test.ts` — integration tests for GET /api/users with role checks
  - [x] 8.4 Update `apps/server/src/routes/authRoutes.test.ts` — verify register now uses authorise middleware
  - [x] 8.5 Verify `pnpm test` from root — all tests pass across all 4 workspaces

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 4 of 58** — the authorization layer that enforces who can do what across the entire VLPRS system. After this story, every API endpoint has a standard protection pattern:

```
authenticate → authorise(ROLES.X, ROLES.Y) → scopeToMda → validate → handler
```

**RBAC is OWASP Top 10 #1 (Broken Access Control)** — the single most common vulnerability in web applications. This middleware must be correct, complete, and tested exhaustively.

**What this story produces:**

| Component | Purpose | Consumed By |
|---|---|---|
| `authorise(…roles)` middleware | Role-based route gate — rejects 403 if role not permitted | Every protected route in Epics 1-13 |
| `scopeToMda` middleware | MDA data isolation — sets req.mdaScope for query filtering | Every data-access route in Epics 2-13 |
| `withMdaScope()` query helper | Drizzle WHERE clause injector for MDA isolation | Every service/query in Epics 2-13 |
| `PERMISSION_MATRIX` constant | Centralised role→resource mapping | Frontend role guards (Story 1.6), documentation |
| `AuthorisedRequest` type | TypeScript type with guaranteed user context | Every route handler that requires auth |
| GET /api/users endpoint | First fully-protected RBAC endpoint (reference implementation) | Admin screens (Story 1.8b), user management (Epic 13) |

**What previous stories created that this story builds on:**

| Component | Location | What Was Created | Story |
|---|---|---|---|
| authenticate middleware | `middleware/authenticate.ts` | JWT verification → req.user = { userId, email, role, mdaId } | 1.2 |
| AppError class | `lib/appError.ts` | Error class with statusCode, code, message, details | 1.2 |
| DB schema | `db/schema.ts` | users, mdas, refresh_tokens tables with roleEnum | 1.2 |
| ROLES constant | `packages/shared/src/constants/roles.ts` | ROLES enum, Role type, ALL_ROLES array | 1.2 |
| VOCABULARY constant | `packages/shared/src/constants/vocabulary.ts` | Auth error messages (currently empty in codebase) | 1.2 |
| CSRF middleware | `middleware/csrf.ts` | Signed double-submit cookie protection | 1.3 |
| Token refresh/logout | `routes/authRoutes.ts` | POST /auth/refresh, POST /auth/logout | 1.3 |
| Register endpoint | `routes/authRoutes.ts` | POST /auth/register with inline super_admin check | 1.2 |
| Seed scripts | `db/seed-demo.ts` | 3 MDAs + 5 demo users (super_admin, dept_admin, 3× mda_officer) | 1.2 |

### What NOT To Do

1. **DO NOT create frontend role guards (AuthGuard, RoleGuard)** — Story 1.6 builds the frontend auth shell. This story is backend-only.
2. **DO NOT implement audit logging in the authorise middleware** — Story 1.5 creates the auditLog middleware. Authorization failures should eventually be logged, but the audit infrastructure doesn't exist yet.
3. **DO NOT create entity-specific routes** (loans, submissions, migrations) — Epics 2-12 create those. This story creates only the authorise/scopeToMda middleware and one reference endpoint (GET /api/users).
4. **DO NOT implement PostgreSQL Row-Level Security (RLS)** — Application-level scoping via `withMdaScope()` is sufficient for MVP. RLS is a future defense-in-depth addition.
5. **DO NOT implement fine-grained permissions** (read/write/delete per resource) — The 3-role model is sufficient for MVP. Phase 2 adds 4 more roles and may need ABAC.
6. **DO NOT expose role requirements in error messages** — Return generic "You do not have permission to perform this action." Not "Requires super_admin role." This prevents leaking the authorization model.
7. **DO NOT hardcode role strings in middleware** — Import `ROLES` from `@vlprs/shared`. (OSLRS lesson: role string mismatch between frontend/backend caused 3 roles to fail.)
8. **DO NOT create a separate `__tests__` directory** — Tests co-located next to source files.
9. **DO NOT add the `authorise` middleware to public endpoints** — Login, health check, and refresh endpoints are public or cookie-authenticated. Only JWT-protected endpoints get `authorise`.
10. **DO NOT use `csurf`** — It's deprecated. CSRF is already handled by `csrf-csrf` from Story 1.3.

### Middleware Architecture

**Full middleware chain** (updated with Story 1.4 additions):

```
Request lifecycle for protected endpoint:

1. helmet              ← Story 1.1 (global)
2. cors                ← Story 1.1 (global)
3. cookie-parser       ← Story 1.2 (global)
4. body parsing        ← Story 1.1 (global)
5. rateLimiter         ← Story 1.2 (per-route)
6. [captcha]           ← Story 1.6 (per-route, future)
7. authenticate        ← Story 1.2 (per-route) — verifies JWT, sets req.user
8. csrfProtect         ← Story 1.3 (per-route, cookie-dependent endpoints only)
9. authorise(...roles) ← THIS STORY (per-route) — checks req.user.role against allowed roles
10. scopeToMda         ← THIS STORY (per-route) — sets req.mdaScope for data isolation
11. validate           ← Story 1.2 (per-route) — Zod schema validation
12. [auditLog]         ← Story 1.5 (per-route, future)
13. route handler
```

**Per-route middleware application after Story 1.4:**

| Endpoint | Rate Limit | Auth | CSRF | Authorise | MDA Scope | Notes |
|---|---|---|---|---|---|---|
| GET /api/health | No | No | No | No | No | Public health check |
| POST /api/auth/login | authLimiter | No | No | No | No | Public, sets tokens |
| POST /api/auth/register | No | authenticate | No | authorise(SUPER_ADMIN) | scopeToMda | Admin-only user creation |
| POST /api/auth/refresh | authLimiter | No | csrfProtect | No | No | Cookie-based, no role check |
| POST /api/auth/logout | No | authenticate | csrfProtect | No | No | Any authenticated user |
| GET /api/users | No | authenticate | No | authorise(SUPER_ADMIN, DEPT_ADMIN) | scopeToMda | Admin user listing |

### authorise Middleware — Implementation

**`apps/server/src/middleware/authorise.ts`:**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/appError';
import { VOCABULARY } from '@vlprs/shared';
import type { Role } from '@vlprs/shared';

/**
 * Authorization middleware factory.
 *
 * Usage:
 *   authorise(ROLES.SUPER_ADMIN)                       — single role
 *   authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN)     — multiple roles
 *   authorise(...ALL_ROLES)                             — any authenticated user
 *
 * MUST be placed AFTER authenticate middleware in the chain.
 * Express 5 auto-catches thrown errors — no try/catch needed.
 */
export function authorise(...allowedRoles: Role[]) {
  // Fail fast at startup if misconfigured
  if (allowedRoles.length === 0) {
    throw new Error('authorise() requires at least one role');
  }

  const roleSet = new Set<string>(allowedRoles);

  return (req: Request, _res: Response, next: NextFunction) => {
    // Defense-in-depth: should never run without authenticate
    if (!req.user) {
      throw new AppError(401, 'AUTHENTICATION_REQUIRED',
        VOCABULARY.AUTHENTICATION_REQUIRED);
    }

    if (!roleSet.has(req.user.role)) {
      throw new AppError(403, 'INSUFFICIENT_PERMISSIONS',
        VOCABULARY.INSUFFICIENT_PERMISSIONS);
    }

    next();
  };
}
```

**Key design decisions:**
- **Set-based lookup** — O(1) role check, scales when Phase 2 adds 4 more roles
- **Deny-by-default** — Missing user or unrecognised role = denied
- **Non-punitive message** — Generic "You do not have permission" (never reveals which role is required)
- **No async** — Role check is pure in-memory logic, synchronous middleware is faster
- **Express 5 error handling** — `throw new AppError(...)` is auto-caught, no `next(err)` needed

### scopeToMda Middleware — Implementation

**`apps/server/src/middleware/scopeToMda.ts`:**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/appError';
import { ROLES, VOCABULARY } from '@vlprs/shared';

/**
 * MDA data isolation middleware.
 * Sets req.mdaScope for downstream query filtering.
 *
 * - super_admin: req.mdaScope = null (unscoped — sees all MDAs)
 * - dept_admin:  req.mdaScope = null (unscoped — sees all MDAs)
 * - mda_officer: req.mdaScope = user.mdaId (restricted to own MDA)
 *
 * MUST be placed AFTER authenticate and authorise in the chain.
 */
export function scopeToMda(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    throw new AppError(401, 'AUTHENTICATION_REQUIRED',
      VOCABULARY.AUTHENTICATION_REQUIRED);
  }

  const { role, mdaId } = req.user;

  if (role === ROLES.SUPER_ADMIN || role === ROLES.DEPT_ADMIN) {
    // Admin roles bypass MDA scoping — full cross-MDA visibility
    req.mdaScope = null;
  } else {
    // mda_officer (and any future scoped roles) MUST have an mdaId
    if (!mdaId) {
      throw new AppError(403, 'MDA_NOT_ASSIGNED',
        VOCABULARY.MDA_NOT_ASSIGNED);
    }
    req.mdaScope = mdaId;
  }

  next();
}
```

### MDA Scope Query Helper — Implementation

**`apps/server/src/lib/mdaScope.ts`:**

```typescript
import { eq, and, type SQL } from 'drizzle-orm';
import type { AnyColumn } from 'drizzle-orm';

/**
 * Applies MDA scoping to a Drizzle query WHERE clause.
 *
 * Usage:
 *   db.select().from(loans).where(
 *     and(
 *       withMdaScope(loans.mdaId, req.mdaScope),
 *       isNull(loans.deletedAt),
 *     )
 *   );
 *
 * When mdaScope is null (super_admin/dept_admin): returns undefined (no filter)
 * When mdaScope is a string (mda_officer): returns eq(column, mdaScope)
 */
export function withMdaScope(
  mdaIdColumn: AnyColumn,
  mdaScope: string | null | undefined,
): SQL | undefined {
  if (!mdaScope) {
    return undefined; // Drizzle's and() skips undefined conditions
  }
  return eq(mdaIdColumn, mdaScope);
}
```

**Why this pattern:**
- Drizzle's `and()` operator automatically skips `undefined` values — so `withMdaScope()` composes cleanly with other optional filters
- Single function, no class hierarchy, no overengineering
- Returns `SQL | undefined` which is exactly what Drizzle expects in `and()`/`or()` chains
- Defense-in-depth: even if middleware is bypassed, service-level scoping prevents data leakage

### Extend Express Request Type

**`apps/server/src/types/express.d.ts`:**

```typescript
export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by authenticate middleware after JWT verification */
      user?: {
        userId: string;
        email: string;
        role: string;
        mdaId: string | null;
      };
      /** Set by scopeToMda middleware — null means unscoped (super_admin/dept_admin) */
      mdaScope?: string | null;
    }
  }
}
```

**Important:** If Story 1.2 already declared `req.user` inline in `authenticate.ts`, move that declaration to this `.d.ts` file and remove the inline version to avoid duplicate declarations. The `.d.ts` file is the single source of truth for Express type extensions.

### Permission Matrix

**`packages/shared/src/constants/permissions.ts`:**

```typescript
import { ROLES, type Role } from './roles';

/**
 * Centralised permission matrix — maps resource:action pairs to allowed roles.
 * Used by:
 * - Backend: authorise() middleware reads this to validate access
 * - Frontend: Role guards use this to show/hide UI elements (Story 1.6)
 *
 * Convention: resource names are plural, actions are CRUD verbs.
 */
export const PERMISSION_MATRIX: Record<string, Role[]> = {
  // Auth & User Management
  'users:create':      [ROLES.SUPER_ADMIN],
  'users:read':        [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'users:update':      [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'users:deactivate':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'users:resetPassword': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Dashboard
  'dashboard:read':    [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Loans
  'loans:read':        [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'loans:manage':      [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Submissions
  'submissions:read':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'submissions:create': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Exceptions
  'exceptions:read':   [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'exceptions:resolve': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Migrations
  'migrations:read':   [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'migrations:process': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Reports
  'reports:read':      [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'reports:generate':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Employment Events
  'employmentEvents:read':   [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'employmentEvents:create': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Early Exit
  'earlyExits:read':    [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'earlyExits:process': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Staff ID
  'staffId:read':      [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'staffId:update':    [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Pre-Submission
  'preSubmission:read': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
} as const;

/**
 * Helper to check if a role has permission for a resource:action.
 */
export function hasPermission(role: Role, resource: string, action: string): boolean {
  const key = `${resource}:${action}`;
  const allowed = PERMISSION_MATRIX[key];
  return allowed ? allowed.includes(role) : false;
}
```

### Shared Package Types

**`packages/shared/src/types/rbac.ts`:**

```typescript
import type { Role } from '../constants/roles';

/**
 * User context guaranteed to be present after authenticate middleware.
 * Route handlers can use this instead of optional req.user checks.
 */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: Role;
  mdaId: string | null;
}

/**
 * Request context after the full RBAC middleware chain.
 * Contains both authenticated user and MDA scope.
 */
export interface AuthorisedContext {
  user: AuthenticatedUser;
  mdaScope: string | null;
}
```

### Vocabulary Additions

**Add to `packages/shared/src/constants/vocabulary.ts`:**

```typescript
// RBAC (Story 1.4)
INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
MDA_ACCESS_DENIED: 'You can only access data for your assigned organisation.',
MDA_NOT_ASSIGNED: 'Your account is not assigned to any organisation. Please contact your administrator.',
```

### GET /api/users — Reference Protected Endpoint

**`apps/server/src/routes/userRoutes.ts`:**

This is the first fully RBAC-protected endpoint, serving as the reference implementation for all future routes.

```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { ROLES } from '@vlprs/shared';
import { listUsers } from '../services/userService';

const router = Router();

// GET /api/users — List users (admin only)
// super_admin: sees all users
// dept_admin: sees all users (may be filtered in future)
// mda_officer: 403 (not in allowed roles)
router.get(
  '/users',
  authenticate,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  scopeToMda,
  async (req, res) => {
    const users = await listUsers(req.mdaScope ?? null);
    res.json({ success: true, data: users });
  },
);

export default router;
```

**`apps/server/src/services/userService.ts`:**

```typescript
import { db } from '../db';
import { users } from '../db/schema';
import { isNull, and } from 'drizzle-orm';
import { withMdaScope } from '../lib/mdaScope';

/**
 * List users with MDA scoping.
 * - mdaScope = null: returns all active users (admin view)
 * - mdaScope = string: returns users for that MDA only
 */
export async function listUsers(mdaScope: string | null) {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      mdaId: users.mdaId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        withMdaScope(users.mdaId, mdaScope),
      ),
    );

  return result;
}
```

**Key patterns demonstrated:**
1. Middleware chain: `authenticate → authorise → scopeToMda → handler`
2. `withMdaScope()` used in Drizzle query for automatic data isolation
3. `req.mdaScope` passed from middleware to service layer
4. Password hash excluded from SELECT (only select needed columns)
5. Soft-delete filter always applied (`isNull(users.deletedAt)`)

### Refactor Register Route

**Current (Story 1.2):** Inline super_admin check in authRoutes.ts

**After Story 1.4:** Replace with `authorise(ROLES.SUPER_ADMIN)` middleware:

```typescript
// BEFORE (Story 1.2 — inline check):
router.post('/auth/register',
  authenticate,
  (req, res, next) => {
    if (req.user?.role !== 'super_admin') {
      throw new AppError(403, 'INSUFFICIENT_PERMISSIONS', '...');
    }
    next();
  },
  validate(registerSchema),
  registerHandler,
);

// AFTER (Story 1.4 — middleware):
router.post('/auth/register',
  authenticate,
  authorise(ROLES.SUPER_ADMIN),
  scopeToMda,
  validate(registerSchema),
  registerHandler,
);
```

### Environment Variables

**No new environment variables needed for Story 1.4.** The RBAC middleware is configuration-free — roles come from JWT claims, permissions are code-defined.

### Architecture Compliance

**3 MVP Roles — Role Hierarchy:**

| Role | Code | Data Scope | Key Capabilities |
|---|---|---|---|
| Super Admin | `super_admin` | All MDAs (unscoped) | Full system access, user management at all levels (FR44) |
| Department Admin | `dept_admin` | All MDAs (unscoped) | View all data, manage loans, process migrations, resolve exceptions, manage MDA officers (FR45) |
| MDA Officer | `mda_officer` | Own MDA only (scoped) | View and submit data for assigned MDA only (FR46) |

**Data Isolation Defense-in-Depth:**

| Layer | What | Where |
|---|---|---|
| 1. JWT Claims | role + mdaId embedded in access token | authenticate middleware |
| 2. Role Gate | authorise() rejects disallowed roles | authorise middleware |
| 3. MDA Scoping | scopeToMda sets req.mdaScope | scopeToMda middleware |
| 4. Query Filtering | withMdaScope() adds WHERE mda_id = X | Service/query layer |
| 5. (Future) RLS | PostgreSQL row-level security | Database layer (post-MVP) |

**OWASP Compliance (Broken Access Control — #1):**
- Deny-by-default: every protected endpoint requires explicit role list
- Centralised authorization: single `authorise()` factory, not scattered checks
- Server-side enforcement: 100% API-level checks (NFR-SEC-2)
- MDA isolation: query-level scoping prevents IDOR attacks
- Generic error messages: no role information leaked in 403 responses

### Library & Framework Requirements

**No new dependencies needed.** Story 1.4 uses only existing packages:
- express (middleware pattern)
- drizzle-orm (query filtering with `eq`, `and`)
- @vlprs/shared (ROLES, VOCABULARY constants)

**Already installed (from Stories 1.1-1.3):**
- express ^5.1.0, drizzle-orm ^0.45.0, zod ^4.0.0, helmet, cors, bcrypt, jsonwebtoken, cookie-parser, express-rate-limit, csrf-csrf, supertest, vitest

### File Structure Requirements

**New files this story MUST create:**

```
apps/server/src/
├── types/
│   └── express.d.ts                    # Express Request type extensions (user, mdaScope)
├── middleware/
│   ├── authorise.ts                    # Role-based authorization factory
│   ├── authorise.test.ts              # Authorise middleware unit tests
│   ├── scopeToMda.ts                  # MDA data isolation middleware
│   └── scopeToMda.test.ts            # MDA scope middleware unit tests
├── lib/
│   ├── mdaScope.ts                    # withMdaScope() Drizzle query helper
│   └── mdaScope.test.ts              # MDA scope helper unit tests
├── services/
│   └── userService.ts                 # listUsers() with MDA-scoped query
└── routes/
    ├── userRoutes.ts                  # GET /api/users (reference RBAC endpoint)
    └── userRoutes.test.ts            # Integration tests for /api/users

packages/shared/src/
├── types/
│   └── rbac.ts                        # AuthenticatedUser, AuthorisedContext types
└── constants/
    └── permissions.ts                 # PERMISSION_MATRIX, hasPermission()
```

**Files this story MUST modify:**

```
apps/server/src/routes/authRoutes.ts   # Replace inline super_admin check with authorise() middleware
apps/server/src/app.ts                 # Mount userRoutes at /api
packages/shared/src/constants/vocabulary.ts  # Add RBAC error messages
packages/shared/src/index.ts           # Export new types and constants
```

**Files this story MUST NOT modify:**

```
apps/server/src/index.ts               # Entry point — no changes
apps/server/src/routes/healthRoutes.ts # Health check — no changes
apps/server/src/db/index.ts           # Drizzle client — no changes
apps/server/src/db/schema.ts          # Schema — no changes (users table already has role + mda_id)
apps/server/src/lib/uuidv7.ts         # UUID generator — no changes
apps/server/src/lib/jwt.ts            # JWT library — no changes
apps/server/src/lib/password.ts       # Password library — no changes
apps/server/src/lib/tokenHash.ts      # Token hash — no changes
apps/server/src/lib/appError.ts       # AppError class — no changes
apps/server/src/middleware/authenticate.ts  # JWT verification — no changes
apps/server/src/middleware/validate.ts # Zod validation — no changes
apps/server/src/middleware/rateLimiter.ts   # Rate limiter — no changes
apps/server/src/middleware/csrf.ts     # CSRF protection — no changes
apps/server/src/config/env.ts         # Environment — no changes
apps/server/package.json              # Dependencies — no changes
apps/client/**                        # NO frontend changes in this story
```

### Testing Requirements

**Framework:** Vitest (co-located) + supertest (integration)

**Unit Tests:**

1. **`apps/server/src/middleware/authorise.test.ts`:**
   - `authorise()` throws at startup if no roles provided
   - `authorise(SUPER_ADMIN)` calls next() for super_admin user
   - `authorise(SUPER_ADMIN)` throws 403 for dept_admin user
   - `authorise(SUPER_ADMIN)` throws 403 for mda_officer user
   - `authorise(SUPER_ADMIN, DEPT_ADMIN)` calls next() for both roles
   - `authorise(SUPER_ADMIN, DEPT_ADMIN)` throws 403 for mda_officer
   - `authorise(...ALL_ROLES)` calls next() for any valid role
   - `authorise()` throws 401 when req.user is undefined
   - Error messages use VOCABULARY constants (non-punitive)
   - Error response does NOT reveal which roles are required

2. **`apps/server/src/middleware/scopeToMda.test.ts`:**
   - super_admin user → req.mdaScope set to null
   - dept_admin user → req.mdaScope set to null
   - mda_officer with mdaId "mda-123" → req.mdaScope set to "mda-123"
   - mda_officer without mdaId → throws 403 MDA_NOT_ASSIGNED
   - Missing req.user → throws 401
   - Calls next() on success

3. **`apps/server/src/lib/mdaScope.test.ts`:**
   - `withMdaScope(column, null)` returns undefined (no filter)
   - `withMdaScope(column, undefined)` returns undefined (no filter)
   - `withMdaScope(column, "mda-123")` returns SQL expression (eq filter)
   - Returned expression integrates correctly with Drizzle `and()`

**Integration Tests:**

4. **`apps/server/src/routes/userRoutes.test.ts`:**
   - GET /api/users with super_admin JWT → 200 + list of all users
   - GET /api/users with dept_admin JWT → 200 + list of all users
   - GET /api/users with mda_officer JWT → 403 INSUFFICIENT_PERMISSIONS
   - GET /api/users without JWT → 401 AUTHENTICATION_REQUIRED
   - GET /api/users with expired JWT → 401
   - Response excludes hashed_password field
   - Response excludes soft-deleted users (deleted_at IS NOT NULL)

5. **`apps/server/src/routes/authRoutes.test.ts`** (updates):
   - POST /api/auth/register with super_admin JWT still works (now via authorise middleware)
   - POST /api/auth/register with dept_admin JWT → 403 (was inline check, now middleware)
   - POST /api/auth/register with mda_officer JWT → 403
   - All existing register/login tests continue to pass

**Test Helpers Needed:**
- Helper to generate JWT with specific role + mdaId for testing
- Reuse seed data from Story 1.2 (3 MDAs, 5 users) for integration tests
- Helper to make authenticated requests with supertest

### Previous Story Intelligence (from Stories 1.1, 1.2, 1.3)

**From Story 1.1 (scaffold):**
1. DB port is **5433** (not 5432) — VLPRS avoids conflict with OSLRS
2. Tests co-located: `foo.ts` + `foo.test.ts` — no `__tests__` directories
3. Express 5 async errors auto-forwarded — no try/catch wrappers needed
4. `pnpm dev` starts DB + client (5173) + server (3001)

**From Story 1.2 (auth foundation):**
1. `req.user` type declared inline in `authenticate.ts` — Story 1.4 should consolidate to `types/express.d.ts`
2. Register endpoint has inline `req.user?.role !== 'super_admin'` check — Story 1.4 replaces with `authorise(ROLES.SUPER_ADMIN)`
3. ROLES constant at `packages/shared/src/constants/roles.ts` — import from `@vlprs/shared`
4. VOCABULARY is currently `{} as const` in the codebase (Story 1.2 content not yet implemented)
5. Demo seed has 5 users across 3 roles — perfect for integration testing RBAC
6. AppError class in `lib/appError.ts` — use for all 401/403 responses
7. All auth routes mounted at `/api` in `app.ts`

**From Story 1.3 (session security):**
1. CSRF middleware applies only to cookie-dependent endpoints (refresh, logout) — NOT to authorise/scopeToMda endpoints
2. Token refresh re-checks `user.is_active` — role doesn't change between refreshes (role change requires new login)
3. `revokeAllUserTokens()` exported from authService — may be used when demoting a role in future
4. Story 1.3's middleware chain position: csrfProtect runs BEFORE authorise

**Express 5 gotchas relevant to this story:**
- Async middleware/handlers can `throw new AppError(...)` directly — auto-caught by global error handler
- No need for `asyncHandler` or `try/catch` wrappers
- Middleware execution order is strictly sequential (authenticate → authorise → scopeToMda)

**Codebase state note:** The existing codebase has only Story 1.1 implemented (scaffold). Stories 1.2 and 1.3 are `ready-for-dev` but not yet coded. The dev implementing Story 1.4 should implement AFTER Stories 1.2 and 1.3 are done — the components listed in the "previous stories" table above must exist.

### Git Intelligence

**Recent commits (2 total, only Story 1.1 implemented so far):**
```
9e6dd63 fix: code review fixes for Story 1.1 scaffold (14 issues resolved)
2084119 chore: scaffold VLPRS monorepo (Story 1.1)
```

**Branch:** `dev` | **Commit style:** `type: description` (conventional commits)

### Latest Technology Intelligence (Feb 2026)

**Express 5.1.0** (latest on npm since March 2025):
- Native async/await error handling — rejected promises auto-forwarded to error middleware
- Active LTS support until at least April 2027
- Middleware factory pattern is the standard for configurable middleware

**Drizzle ORM 0.45.x** — Dynamic query filtering:
- `and()` / `or()` automatically skip `undefined` values — perfect for conditional MDA scoping
- `$dynamic()` enables composable query building with helper functions
- `eq()`, `isNull()`, `and()` from `drizzle-orm` are the correct imports

**OWASP Top 10 2025** — Broken Access Control remains #1:
- 100% of applications tested had some form of broken access control
- Recommended pattern: deny-by-default + centralised authorization + server-side enforcement
- Generic error messages (no role information leaked)
- Defense-in-depth: middleware + query-level + (optionally) database-level

**No new packages needed** — RBAC middleware is pure application logic using existing Express + Drizzle primitives.

### Scope Boundaries

**Explicitly IN scope:**
- `authorise(…roles)` middleware factory
- `scopeToMda` middleware
- `withMdaScope()` Drizzle query helper
- Express Request type extension for `mdaScope`
- `PERMISSION_MATRIX` constant in shared package
- `AuthenticatedUser` and `AuthorisedContext` types in shared package
- RBAC vocabulary additions
- Refactor register endpoint to use `authorise` middleware
- GET /api/users reference endpoint with full RBAC chain
- Comprehensive unit and integration tests

**Explicitly NOT in scope (later stories):**
- Frontend AuthGuard / RoleGuard components (Story 1.6)
- Audit logging of authorization failures (Story 1.5)
- Entity-specific routes (loans, submissions, etc.) (Epics 2-12)
- PostgreSQL Row-Level Security (post-MVP)
- Fine-grained permissions / ABAC (Phase 2 with 7 roles)
- Role management UI (Epic 13)
- Account deactivation triggering token revocation (Epic 13)
- reCAPTCHA integration (Story 1.6)

### Non-Punitive Vocabulary Rules

All error messages follow the UX design specification:

| Code | Message | NEVER This |
|---|---|---|
| INSUFFICIENT_PERMISSIONS | "You do not have permission to perform this action." | "Access denied", "Forbidden", "Unauthorized role" |
| MDA_ACCESS_DENIED | "You can only access data for your assigned organisation." | "MDA access violation", "Cross-tenant access denied" |
| MDA_NOT_ASSIGNED | "Your account is not assigned to any organisation. Please contact your administrator." | "Missing MDA", "No MDA assigned", "Invalid account" |

- **NEVER** reveal which role is required for an endpoint in the error message
- **NEVER** include the user's current role in the error message
- Import all messages from `VOCABULARY` constant — never hardcode in middleware

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Epic 1, Story 1.4]
- [Source: _bmad-output/planning-artifacts/architecture.md#RBAC Middleware]
- [Source: _bmad-output/planning-artifacts/architecture.md#MDA Data Isolation]
- [Source: _bmad-output/planning-artifacts/architecture.md#Middleware Chain]
- [Source: _bmad-output/planning-artifacts/architecture.md#Naming Conventions]
- [Source: _bmad-output/planning-artifacts/architecture.md#Project Structure]
- [Source: _bmad-output/planning-artifacts/prd.md#FR43-FR46 Role-Based Access Control]
- [Source: _bmad-output/planning-artifacts/prd.md#NFR-SEC-2 API-Level RBAC Enforcement]
- [Source: _bmad-output/planning-artifacts/prd.md#FR72-FR73 User Administration]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Non-Punitive Language]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Role-Based UI Patterns]
- [Source: _bmad-output/implementation-artifacts/1-2-user-registration-login.md#Auth Implementation]
- [Source: _bmad-output/implementation-artifacts/1-3-session-security-token-refresh.md#Middleware Chain]
- [Source: _bmad-output/implementation-artifacts/1-1-monorepo-scaffold-development-environment.md#Dev Notes]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (claude-opus-4-6)

### Debug Log References

No blocking issues encountered. All tasks implemented cleanly following the story Dev Notes.

### Completion Notes List

- **Task 1:** Created RBAC types (`AuthenticatedUser`, `AuthorisedContext`) in `packages/shared/src/types/rbac.ts`, `PERMISSION_MATRIX` with `hasPermission()` helper in `packages/shared/src/constants/permissions.ts`, added `MDA_ACCESS_DENIED` and `MDA_NOT_ASSIGNED` to VOCABULARY, exported all new types/constants from shared index.
- **Task 2:** Created `apps/server/src/types/express.d.ts` with consolidated `req.user` and new `req.mdaScope` type declarations. Removed inline `declare global` from `authenticate.ts` to avoid duplicate declarations.
- **Task 3:** Created `authorise()` middleware factory with Set-based O(1) role lookup, deny-by-default, non-punitive VOCABULARY messages, fail-fast startup validation for empty roles.
- **Task 4:** Created `scopeToMda` middleware — sets `req.mdaScope = null` for super_admin/dept_admin, `req.mdaScope = mdaId` for mda_officer, throws 403 MDA_NOT_ASSIGNED if mda_officer lacks mdaId.
- **Task 5:** Created `withMdaScope()` Drizzle query helper — returns `undefined` for null scope (Drizzle `and()` skips it), returns `eq(column, scope)` for string scope. Unit tests verify both paths.
- **Task 6:** Refactored register route: replaced inline `req.user?.role !== ROLES.SUPER_ADMIN` check with `authorise(ROLES.SUPER_ADMIN)` middleware, added `scopeToMda` to chain. Removed unused `AppError` and `VOCABULARY` imports from authRoutes.ts.
- **Task 7:** Created GET /api/users reference endpoint with full RBAC chain (`authenticate → authorise(SUPER_ADMIN, DEPT_ADMIN) → scopeToMda → handler`). `listUsers()` service uses `withMdaScope()` for query filtering. Excludes `hashedPassword` from SELECT and filters soft-deleted users.
- **Task 8:** Created 10 unit tests for authorise, 6 for scopeToMda, 3 for mdaScope helper, 7 integration tests for GET /api/users, added dept_admin register test to authRoutes.test.ts. All 102 tests pass across 4 workspaces with zero regressions.

### File List

**New files:**
- `packages/shared/src/types/rbac.ts`
- `packages/shared/src/constants/permissions.ts`
- `apps/server/src/types/express.d.ts`
- `apps/server/src/middleware/authorise.ts`
- `apps/server/src/middleware/authorise.test.ts`
- `apps/server/src/middleware/scopeToMda.ts`
- `apps/server/src/middleware/scopeToMda.test.ts`
- `apps/server/src/lib/mdaScope.ts`
- `apps/server/src/lib/mdaScope.test.ts`
- `apps/server/src/services/userService.ts`
- `apps/server/src/routes/userRoutes.ts`
- `apps/server/src/routes/userRoutes.test.ts`

**Modified files:**
- `packages/shared/src/constants/vocabulary.ts` — added MDA_ACCESS_DENIED, MDA_NOT_ASSIGNED
- `packages/shared/src/index.ts` — added rbac types and permissions exports
- `apps/server/src/middleware/authenticate.ts` — removed inline declare global (moved to express.d.ts)
- `apps/server/src/routes/authRoutes.ts` — replaced inline role check with authorise() middleware
- `apps/server/src/routes/authRoutes.test.ts` — added dept_admin register test
- `apps/server/src/app.ts` — mounted userRoutes

## Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Add `expect.assertions(N)` to 7 try/catch tests in authorise.test.ts (5) and scopeToMda.test.ts (2) to prevent silent pass on regression
- [x] [AI-Review][HIGH] H2: Change `withMdaScope` from falsy check `!mdaScope` to strict `=== null || === undefined` — empty string was treated as "no filter"
- [x] [AI-Review][MEDIUM] M1+L1: Update PERMISSION_MATRIX JSDoc to reflect it is a frontend reference, not consumed at runtime by authorise() middleware
- [x] [AI-Review][MEDIUM] M2: Change `express.d.ts` `req.user.role` type from `string` to `Role` for type safety
- [x] [AI-Review][MEDIUM] M3: Add hard LIMIT (100) to `listUsers()` query to prevent unbounded results — full pagination deferred to Story 1.9a
- [x] [AI-Review][MEDIUM] M4: Improve mdaScope unit test — verify SQL expression is `instanceof SQL` with correct value in queryChunks, not just `toBeDefined()`
- [x] [AI-Review][LOW] L2: Add forward-reference comment on `AuthorisedContext` noting it is consumed by frontend Story 1.6

## Change Log

- 2026-02-20: Code review fixes for Story 1.4 — 8 issues resolved (2 HIGH, 4 MEDIUM, 2 LOW)
- 2026-02-20: Implemented Story 1.4 — Role-Based Access Control (authorise middleware, scopeToMda middleware, withMdaScope query helper, PERMISSION_MATRIX, GET /api/users reference endpoint, comprehensive test suite)
