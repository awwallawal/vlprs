# Story 1.9a: User Account Lifecycle API & Email Invitation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Generated: 2026-02-19 | Epic: 1 — Project Foundation & Secure Access | Sprint: 1 -->
<!-- Blocked By: 1.4 (RBAC middleware), 1.5 (audit logging), 1.3 (change-password endpoint, token revocation) -->
<!-- Blocks: 1.9b (User Administration Interface, Profile Self-Service & First-Login Flow) -->
<!-- FRs: FR72 (user account lifecycle), FR73 (admin-initiated password reset) -->

## Story

As a **Super Admin or Department Admin**,
I want to create user accounts that send welcome emails with temporary credentials, and manage account lifecycle (deactivate, reactivate, reassign, delete, password reset),
so that authorised personnel can be onboarded and managed without developer intervention, while respecting the role hierarchy.

## Acceptance Criteria (BDD)

### AC1: Role Hierarchy Enforcement

```gherkin
Given the management hierarchy: super_admin manages dept_admin + mda_officer; dept_admin manages mda_officer only
When any user management endpoint is called
Then the system enforces downward-only management — the acting user's role must be strictly above the target user's role in the hierarchy (FR72)
And attempting to manage a peer or superior role returns 403 with message "Insufficient permissions to manage this account level"
And attempting to manage one's own account returns 403 with message "Cannot modify own account through this endpoint"

Given the super_admin role
When any attempt is made to create, deactivate, reactivate, delete, or reset password for another super_admin via API
Then the request is rejected with 403 — super admin accounts are managed exclusively via CLI commands
```

### AC2: Account Creation with Invitation Email

> **Epics Alignment Note:** Epics spec (line 983) uses a single `name` field. This story uses split `firstName`/`lastName` fields to match the existing DB schema (users table has separate `first_name`/`last_name` columns since Story 1.2). Epics should be updated to reflect `firstName, lastName`. Story 1.9b (UI) must send split fields.

```gherkin
Given POST /api/users with body { email, firstName, lastName, role, mdaId? }
When a super_admin creates a dept_admin or mda_officer, or a dept_admin creates an mda_officer
Then the account is created with:
  UUIDv7 PK, email (unique, case-insensitive), firstName, lastName,
  bcrypt-hashed temporary password (system-generated, 12 chars, meeting FR42 policy),
  role, mda_id (required for mda_officer, null for dept_admin/super_admin),
  is_active = true, must_change_password = true
And a welcome email is sent via Resend containing:
  login URL, temporary credentials, instruction to change password on first login,
  brief description of their role's capabilities
And the creation event is audit-logged with: acting user, new user ID, assigned role, assigned MDA

Given POST /api/users with an email that already exists (active, deactivated, or soft-deleted)
When the request is processed
Then it returns 409 Conflict with message "Email already registered"

Given POST /api/users with role mda_officer but no mdaId
When the request is processed
Then it returns 422 with message "MDA assignment required for MDA Reporting Officer accounts"
```

### AC3: Forced Password Change on First Login

```gherkin
Given a user with must_change_password = true
When they successfully authenticate via POST /api/auth/login
Then the response includes { mustChangePassword: true } alongside the access token
And all API endpoints except POST /api/auth/change-password and POST /api/auth/logout
  return 403 with code PASSWORD_CHANGE_REQUIRED until the password is changed
And after changing password, must_change_password is set to false and normal access resumes
```

### AC4: Account Deactivation

```gherkin
Given POST /api/users/:id/deactivate with optional body { reason: string }
When a permitted admin deactivates an account
Then is_active is set to false, all refresh tokens for that user are revoked,
  any active sessions are terminated immediately (FR72)
And the deactivation is audit-logged with: acting user, target user, reason, timestamp, IP

Given a deactivated user
When they attempt to log in with correct credentials
Then the response returns 401 with the same generic "Invalid email or password" message
  (no status enumeration — already implemented in Story 1.2)
```

### AC5: Account Reactivation

```gherkin
Given POST /api/users/:id/reactivate
When a permitted admin reactivates a previously deactivated account
Then is_active is set to true and the user can log in again (FR72)
And the reactivation is audit-logged
And the user's password is NOT reset — they use their existing password

Given a soft-deleted account (deleted_at IS NOT NULL)
When a reactivation is attempted
Then the request returns 422 with message "Deleted accounts cannot be reactivated — create a new account instead"
```

### AC6: Account Soft Delete

```gherkin
Given DELETE /api/users/:id with required body { confirmEmail: string }
When a permitted admin deletes an account and confirmEmail matches the target user's email
Then deleted_at is set to current timestamp, is_active is set to false,
  all refresh tokens revoked, all sessions terminated (FR72)
And the deletion is audit-logged with enhanced detail:
  acting user, target user full profile snapshot, timestamp
And the deleted user is excluded from all user list queries
  (but preserved in DB for audit trail and referential integrity)

Given DELETE /api/users/:id where confirmEmail does not match the target user's email
When the request is processed
Then it returns 422 with message "Confirmation email does not match — deletion aborted"
```

### AC7: MDA Reassignment

```gherkin
Given PATCH /api/users/:id with body { mdaId: newMdaId }
When a permitted admin reassigns an mda_officer to a different MDA
Then the user's mda_id is updated and all subsequent API calls are scoped to the new MDA (FR72)
And the reassignment is audit-logged with: old MDA, new MDA, acting user, timestamp

Given a reassignment of a non-mda_officer user
When mdaId is provided
Then the request returns 422 with message "MDA assignment is only applicable to MDA Reporting Officer accounts"
```

### AC8: Admin-Initiated Password Reset

```gherkin
Given POST /api/users/:id/reset-password
When a permitted admin initiates a password reset
Then a new temporary password is generated, bcrypt-hashed and stored,
  must_change_password set to true, all refresh tokens revoked (FR73)
And a password reset email is sent via Resend with:
  temporary credentials, login URL, instruction to change password immediately
And the reset is audit-logged with acting user and timestamp
```

### AC9: Email Service (Resend Integration)

```gherkin
Given apps/server/src/lib/email.ts
When a welcome email or password reset email is triggered
Then the email is sent via Resend SDK using RESEND_API_KEY from environment variables
And if Resend API fails, the error is logged but the account creation/reset still succeeds
  (fire-and-forget with logged failure — email delivery does not block account operations)
And the email sender is configurable via EMAIL_FROM environment variable
  (e.g., noreply@vlprs.oyo.gov.ng)
```

### AC10: User Listing

```gherkin
Given GET /api/users with optional query params { role?, mdaId?, status?, page?, pageSize? }
When a super_admin calls the endpoint
Then they see all non-deleted users across all roles
  (the acting user's own record is flagged isSelf: true but still visible)
And response uses the standard pagination envelope

Given GET /api/users
When a dept_admin calls the endpoint
Then they see only mda_officer accounts (their manageable scope)

Given GET /api/users
When an mda_officer calls the endpoint
Then the request returns 403
```

### AC11: Super Admin CLI Management

```gherkin
Given the production server has access to CLI commands
When an administrator runs pnpm user:create-admin --email ag@vlprs.oyo.gov.ng --name "Accountant General"
Then a super_admin account is created with a system-generated temporary password
  displayed in the terminal output (never emailed — communicated in person)
And the account has must_change_password = true
And the creation is audit-logged as SYSTEM_CLI actor

Given the CLI
When an administrator runs pnpm user:deactivate-admin --email deputy.ag@vlprs.oyo.gov.ng
Then the super admin account is deactivated (sessions terminated, tokens revoked)
And the command requires interactive confirmation:
  "You are about to deactivate a Super Admin account. Type the email again to confirm:"

Given the CLI
When the deactivation would leave zero active super admin accounts
Then the command is rejected with:
  "Cannot deactivate — this is the last active Super Admin. Create a replacement first."
```

### AC12: Validation Schemas

```gherkin
Given packages/shared/src/validators/userSchemas.ts
When I inspect its exports
Then it exports: createUserSchema, updateUserSchema, deactivateUserSchema, deleteUserSchema
  (no resetPasswordSchema — reset-password endpoint has no body)
And both apps/server and apps/client import them from @vlprs/shared
```

### AC13: Tests

```gherkin
Given Story 1.9a is implemented
When I run pnpm test from the monorepo root
Then unit tests pass for:
  - role hierarchy enforcement (all role combinations)
  - temporary password generation (meets FR42 policy)
  - must_change_password enforcement
  - last-super-admin guardrail
And integration tests pass for:
  - super_admin creating dept_admin (201)
  - super_admin creating mda_officer (201)
  - dept_admin creating mda_officer (201)
  - dept_admin creating dept_admin (403)
  - mda_officer creating anyone (403)
  - super_admin managing another super_admin (403)
  - self-management attempt (403)
  - deactivation + session termination
  - reactivation
  - soft delete with email confirmation
  - soft delete with wrong email (422)
  - reactivation of deleted account (422)
  - MDA reassignment
  - password reset + token revocation
  - duplicate email (409)
  - mda_officer without mdaId (422)
  - forced password change flow (login → PASSWORD_CHANGE_REQUIRED → change password → normal access)
  - user listing with role-based scoping
And all existing tests from Stories 1.1-1.3 continue to pass
```

## Tasks / Subtasks

- [ ] Task 1: Install dependencies and configure environment (AC: #9)
  - [ ] 1.1 Install Resend SDK: `pnpm --filter server add resend`
  - [ ] 1.2 Add to `apps/server/src/config/env.ts` envSchema:
    ```typescript
    RESEND_API_KEY: z.string().optional(), // Optional in dev (emails logged instead of sent)
    EMAIL_FROM: z.string().default('noreply@vlprs.oyo.gov.ng'),
    APP_URL: z.string().default('http://localhost:5173'), // For login URL in emails
    ```
  - [ ] 1.3 Update `.env.example` — add `EMAIL_FROM=noreply@vlprs.oyo.gov.ng` and `APP_URL=http://localhost:5173`
  - [ ] 1.4 Verify `pnpm typecheck` and `pnpm test` still pass

- [ ] Task 2: Add `must_change_password` column to users table (AC: #3)
  - [ ] 2.1 Add column to `apps/server/src/db/schema.ts` users table:
    ```typescript
    mustChangePassword: boolean('must_change_password').notNull().default(false),
    ```
  - [ ] 2.2 Generate Drizzle migration: `pnpm --filter server drizzle-kit generate`
  - [ ] 2.3 Run migration: `pnpm --filter server drizzle-kit migrate` (or via Docker)
  - [ ] 2.4 Update `packages/shared/src/types/auth.ts` — add `mustChangePassword` to `User` interface:
    ```typescript
    export interface User {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: 'super_admin' | 'dept_admin' | 'mda_officer';
      mdaId: string | null;
      isActive: boolean;
      mustChangePassword: boolean;
      createdAt: string;
    }
    ```
  - [ ] 2.5 Update `LoginResponse` to include `mustChangePassword`:
    ```typescript
    export interface LoginResponse {
      accessToken: string;
      user: User;
      mustChangePassword: boolean;
    }
    ```
  - [ ] 2.6 Update `sanitiseUser()` in `authService.ts` to include `mustChangePassword`
  - [ ] 2.7 Update `authService.login()` to return `mustChangePassword` flag from the user record
  - [ ] 2.8 Verify existing auth tests still pass after schema change

- [ ] Task 3: Add vocabulary constants for user admin (AC: #1-#8)
  - [ ] 3.1 Add to `packages/shared/src/constants/vocabulary.ts`:
    ```typescript
    // User Account Management (Story 1.9a)
    PASSWORD_CHANGE_REQUIRED: 'You must change your password before continuing.',
    HIERARCHY_INSUFFICIENT: 'Insufficient permissions to manage this account level.',
    SELF_MANAGEMENT_DENIED: 'Cannot modify own account through this endpoint.',
    SUPER_ADMIN_CLI_ONLY: 'Super Admin accounts can only be managed via system administration.',
    MDA_REQUIRED_FOR_OFFICER: 'MDA assignment required for MDA Reporting Officer accounts.',
    MDA_ONLY_FOR_OFFICER: 'MDA assignment is only applicable to MDA Reporting Officer accounts.',
    DELETED_CANNOT_REACTIVATE: 'Deleted accounts cannot be reactivated — create a new account instead.',
    DELETE_CONFIRM_MISMATCH: 'Confirmation email does not match — deletion aborted.',
    LAST_SUPER_ADMIN: 'Cannot deactivate — this is the last active Super Admin. Create a replacement first.',
    INVITATION_SENT: 'Invitation sent successfully.',
    PASSWORD_RESET_SENT: 'Password reset email sent successfully.',
    ```
  - [ ] 3.2 Update `packages/shared/src/index.ts` to export new vocabulary (already exported via `VOCABULARY`)

- [ ] Task 4: Create validation schemas for user admin (AC: #12)
  - [ ] 4.1 Create `packages/shared/src/validators/userSchemas.ts`:
    ```typescript
    import { z } from 'zod/v4';

    export const createUserSchema = z.object({
      email: z.email('Please use a valid email format'),
      firstName: z.string().min(1, 'First name is required').max(100),
      lastName: z.string().min(1, 'Last name is required').max(100),
      role: z.enum(['dept_admin', 'mda_officer']), // super_admin is CLI-only
      mdaId: z.string().uuid().nullable().optional(),
    });

    export const updateUserSchema = z.object({
      mdaId: z.string().uuid(),
    });

    export const deactivateUserSchema = z.object({
      reason: z.string().max(500).optional(),
    });

    export const deleteUserSchema = z.object({
      confirmEmail: z.string().email('Please provide a valid email'),
    });

    // NOTE: No resetPasswordSchema — endpoint has no body, so validate() middleware is not applied to it
    ```
  - [ ] 4.2 Export from `packages/shared/src/index.ts`:
    ```typescript
    export { createUserSchema, updateUserSchema, deactivateUserSchema, deleteUserSchema } from './validators/userSchemas';
    ```
  - [ ] 4.3 Create `packages/shared/src/validators/userSchemas.test.ts` — validate happy path and error cases

- [ ] Task 5: Create email service (Resend integration) (AC: #9)
  - [ ] 5.1 Create `apps/server/src/lib/email.ts`:
    ```typescript
    import { Resend } from 'resend';
    import { env } from '../config/env';
    import pino from 'pino';

    const logger = pino({ name: 'email' });
    const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

    export interface WelcomeEmailParams {
      to: string;
      firstName: string;
      temporaryPassword: string;
      role: string;
      mdaName?: string; // Required for mda_officer — fetched by userAdminService before calling
      loginUrl: string;
    }

    export interface PasswordResetEmailParams {
      to: string;
      firstName: string;
      temporaryPassword: string;
      loginUrl: string;
    }

    export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
      // Fire-and-forget — log errors but never throw
      try {
        if (!resend) {
          logger.info({ to: params.to, type: 'welcome' }, 'Email skipped (no RESEND_API_KEY)');
          logger.info({ temporaryPassword: params.temporaryPassword }, 'DEV: Temporary password');
          return;
        }
        await resend.emails.send({
          from: env.EMAIL_FROM,
          to: params.to,
          subject: 'Welcome to VLPRS — Your Account is Ready',
          html: buildWelcomeHtml(params),
        });
        logger.info({ to: params.to }, 'Welcome email sent');
      } catch (error) {
        // Extract message safely — never log full error object (may contain API keys)
        const message = error instanceof Error ? error.message : 'Unknown error';
        const isTransient = message.includes('429') || message.includes('rate');
        logger[isTransient ? 'warn' : 'error']({ message, to: params.to }, 'Failed to send welcome email');
      }
    }

    export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
      // Same fire-and-forget pattern with safe error extraction
    }
    ```
  - [ ] 5.2 Build HTML email templates as simple string functions (no template engine needed for MVP):
    - Welcome email: login URL, temporary password, role description, "change password on first login" instruction
    - Password reset email: login URL, new temporary password, "change password immediately" instruction
  - [ ] 5.3 In development mode (no `RESEND_API_KEY`): log email content + temp password to console instead of sending
  - [ ] 5.4 Create `apps/server/src/lib/email.test.ts` — test template generation, test dev-mode logging

- [ ] Task 6: Create temporary password generator (AC: #2, #8)
  - [ ] 6.1 Add to `apps/server/src/lib/password.ts`:
    ```typescript
    import { randomInt } from 'node:crypto';

    const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const LOWER = 'abcdefghijklmnopqrstuvwxyz';
    const DIGITS = '0123456789';
    const ALL = UPPER + LOWER + DIGITS;

    /**
     * Generates a 12-char temporary password meeting FR42 policy:
     * min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit.
     * Uses alphanumeric charset only (no +/= from base64 that confuse users in emails).
     */
    export function generateTemporaryPassword(): string {
      const pick = (charset: string) => charset[randomInt(charset.length)];
      const chars = [pick(UPPER), pick(LOWER), pick(DIGITS)]; // Guarantee policy
      for (let i = 0; i < 9; i++) chars.push(pick(ALL)); // Fill to 12 chars
      // Shuffle to avoid predictable positions
      for (let i = chars.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
      }
      return chars.join('');
    }
    ```
  - [ ] 6.2 Create unit test verifying generated passwords meet FR42 policy (length, uppercase, lowercase, digit)

- [ ] Task 7: Create role hierarchy utility (AC: #1)
  - [ ] 7.1 Add to `packages/shared/src/constants/roles.ts`:
    ```typescript
    /**
     * Role hierarchy levels — higher number = higher authority.
     * Used for downward-only management enforcement.
     */
    export const ROLE_HIERARCHY: Record<Role, number> = {
      [ROLES.MDA_OFFICER]: 1,
      [ROLES.DEPT_ADMIN]: 2,
      [ROLES.SUPER_ADMIN]: 3,
    };

    /**
     * Returns roles that the given role can manage (downward only).
     * super_admin → [dept_admin, mda_officer] (but NOT other super_admins via API)
     * dept_admin → [mda_officer]
     * mda_officer → [] (cannot manage anyone)
     */
    export function getManageableRoles(actingRole: Role): Role[] {
      const level = ROLE_HIERARCHY[actingRole];
      return ALL_ROLES.filter(r => ROLE_HIERARCHY[r] < level);
    }

    export function canManageRole(actingRole: Role, targetRole: Role): boolean {
      return ROLE_HIERARCHY[actingRole] > ROLE_HIERARCHY[targetRole];
    }
    ```
  - [ ] 7.2 Export from `packages/shared/src/index.ts`
  - [ ] 7.3 Create tests for all role combinations:
    - super_admin can manage dept_admin ✓, mda_officer ✓, super_admin ✗
    - dept_admin can manage mda_officer ✓, dept_admin ✗, super_admin ✗
    - mda_officer can manage nobody

- [ ] Task 8: Create userAdminService (AC: #1-#8)
  - [ ] 8.1 Create `apps/server/src/services/userAdminService.ts` with functions:
    ```typescript
    // Core CRUD
    export async function createUser(actingUser, data): Promise<User>
    export async function listUsers(actingUser, filters): Promise<PaginatedResponse<User>>
    export async function getUserById(id): Promise<User | null>

    // Lifecycle
    export async function deactivateUser(actingUser, targetId, reason?): Promise<void>
    export async function reactivateUser(actingUser, targetId): Promise<void>
    export async function softDeleteUser(actingUser, targetId, confirmEmail): Promise<void>

    // Updates
    export async function reassignMda(actingUser, targetId, newMdaId): Promise<void>
    export async function resetPassword(actingUser, targetId): Promise<void>
    ```
  - [ ] 8.2 Every function MUST:
    - Validate role hierarchy via `canManageRole()` before proceeding
    - Reject self-management (`actingUser.userId === targetId`)
    - Reject managing super_admin via API (explicit check with `VOCABULARY.SUPER_ADMIN_CLI_ONLY`)
    - Check target user exists and is not soft-deleted (for lifecycle ops)
    - Use `AppError` for all error responses — NEVER raw `res.status().json()`
    - Use `VOCABULARY` constants for all user-facing messages
    - **Audit logging**: If Story 1.5 `auditLog` middleware exists, it captures mutations automatically at route level — service layer does NOT call audit functions directly. If Story 1.5 is not yet available, use `logger.info({ action, actingUserId, targetUserId, ...details }, 'audit')` via pino as interim fallback.
    - **Service boundary**: `userAdminService` calls ONLY: `authService` helpers, `password.ts`, `email.ts`, DB queries. NEVER calls: computation, submission, or exception services.
  - [ ] 8.3 `createUser()`:
    - **First**: Check target role is not `SUPER_ADMIN` → `throw new AppError(403, 'SUPER_ADMIN_CLI_ONLY', VOCABULARY.SUPER_ADMIN_CLI_ONLY)` — this check BEFORE generic `canManageRole()` to give a specific error message
    - Validate hierarchy via `canManageRole(actingUser.role, data.role)`
    - Generate 12-char temporary password via `generateTemporaryPassword()`
    - Hash with bcrypt via existing `hashPassword()`
    - Insert user — **always explicitly set `mustChangePassword: true`** (never rely on column default of `false`)
    - For `mda_officer`: fetch MDA name via DB lookup, pass as `mdaName` to email params
    - Send welcome email via `sendWelcomeEmail()` (fire-and-forget)
    - Return sanitised user (no password hash)
    - Reuse existing validation from `authService.register()` (role-mdaId checks, duplicate email, MDA exists)
  - [ ] 8.4 `deactivateUser()`:
    - Set `isActive = false`
    - Revoke all tokens via existing `revokeAllUserTokens()`
    - Last-super-admin guardrail: count active super_admins, reject if would leave zero
  - [ ] 8.5 `softDeleteUser()`:
    - Verify `confirmEmail` matches target user's email (case-insensitive)
    - Set `deletedAt = now`, `isActive = false`
    - Revoke all tokens
  - [ ] 8.6 `reactivateUser()`:
    - Check `deletedAt` is null — reject if soft-deleted
    - Set `isActive = true`
  - [ ] 8.7 `reassignMda()`:
    - Verify target is `mda_officer`
    - Verify new MDA exists
    - Update `mdaId`
  - [ ] 8.8 `resetPassword()`:
    - Generate new temporary password
    - Hash and update
    - Set `mustChangePassword = true`
    - Revoke all tokens
    - Send password reset email (fire-and-forget)
  - [ ] 8.9 `listUsers()`:
    - `super_admin` sees all non-deleted users
    - `dept_admin` sees only `mda_officer` accounts
    - Support filters: role, mdaId, status (active/deactivated), search (name/email)
    - Standard pagination envelope
    - Flag `isSelf: true` on the acting user's own record

- [ ] Task 9: Create forced password change middleware (AC: #3)
  - [ ] 9.1 Create `apps/server/src/middleware/requirePasswordChange.ts`:
    ```typescript
    export function requirePasswordChange(req: Request, _res: Response, next: NextFunction) {
      // Skip for allowed endpoints
      const allowedPaths = ['/api/auth/change-password', '/api/auth/logout'];
      if (allowedPaths.includes(req.path)) {
        return next();
      }

      // Check mustChangePassword flag from JWT claims (DECIDED: JWT approach, not DB lookup)
      if (req.user?.mustChangePassword) {
        throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', VOCABULARY.PASSWORD_CHANGE_REQUIRED);
      }
    }
    ```
  - [ ] 9.2 **DECIDED approach**: Add `mustChangePassword` to JWT claims (NOT DB lookup on every request). When admin resets password, tokens are revoked (already implemented), forcing re-login → fresh JWT with `mustChangePassword: true`. After changing password, new JWT has `mustChangePassword: false`. This is accurate because token revocation is already implemented in Story 1.3.
  - [ ] 9.3 Update `apps/server/src/lib/jwt.ts` — add `mustChangePassword` to JWT payload
  - [ ] 9.4 Update `packages/shared/src/types/auth.ts` — add `mustChangePassword` to `JwtPayload`
  - [ ] 9.5 Update `authService.login()` — include `mustChangePassword` in the signed JWT
  - [ ] 9.6 Update `authService.changePassword()` — set `mustChangePassword = false` and issue new tokens
  - [ ] 9.7 Apply middleware in `app.ts` — insert **between `authenticate` and `authorise`** in the middleware chain:
    ```
    authenticate → requirePasswordChange → authorise → scopeToMda → validate → auditLog → handler
    ```
    Wrong ordering (e.g., after `authorise`) could return 403 UNAUTHORIZED before the password-change check fires.
  - [ ] 9.8 Test: login with `mustChangePassword = true` → all routes return 403 `PASSWORD_CHANGE_REQUIRED` except change-password and logout

- [ ] Task 10: Create user routes (AC: #1-#10)
  - [ ] 10.1 Create `apps/server/src/routes/userRoutes.ts`:
    ```typescript
    import { Router } from 'express';
    import { authenticate } from '../middleware/authenticate';
    import { authorise } from '../middleware/authorise';  // From Story 1.4
    import { validate } from '../middleware/validate';
    import { ROLES } from '@vlprs/shared';
    import { createUserSchema, updateUserSchema, deactivateUserSchema, deleteUserSchema } from '@vlprs/shared';
    import * as userAdminService from '../services/userAdminService';

    const router = Router();

    // GET /api/users — list users (role-scoped)
    router.get('/users',
      authenticate,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
      async (req, res) => { ... }
    );

    // POST /api/users — create user with invitation
    router.post('/users',
      authenticate,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
      validate(createUserSchema),
      async (req, res) => { ... }
    );

    // POST /api/users/:id/deactivate
    router.post('/users/:id/deactivate',
      authenticate,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
      validate(deactivateUserSchema),
      async (req, res) => { ... }
    );

    // POST /api/users/:id/reactivate
    router.post('/users/:id/reactivate',
      authenticate,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
      async (req, res) => { ... }
    );

    // DELETE /api/users/:id — soft delete
    router.delete('/users/:id',
      authenticate,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
      validate(deleteUserSchema),
      async (req, res) => { ... }
    );

    // PATCH /api/users/:id — MDA reassignment
    router.patch('/users/:id',
      authenticate,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
      validate(updateUserSchema),
      async (req, res) => { ... }
    );

    // POST /api/users/:id/reset-password
    router.post('/users/:id/reset-password',
      authenticate,
      authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
      async (req, res) => { ... }
    );

    export default router;
    ```
  - [ ] 10.2 Route handlers are THIN — validate → call service → format response:
    ```typescript
    async (req: Request, res: Response) => {
      const user = await userAdminService.createUser(req.user!, req.body);
      res.status(201).json({ success: true, data: user });
    }
    ```
  - [ ] 10.3 Mount in `apps/server/src/app.ts`: `app.use('/api', userRoutes);`
  - [ ] 10.4 Create `apps/server/src/routes/userRoutes.test.ts` — integration tests for all endpoints

- [ ] Task 11: Create Super Admin CLI scripts (AC: #11)
  - [ ] 11.1 Create `apps/server/src/cli/createAdmin.ts` (camelCase per architecture convention):
    - Parse `--email` and `--name` arguments via `process.argv` (DECIDED: no `commander` dependency — sufficient for 2 args)
    - Generate temporary password, hash it, insert super_admin user
    - Print temporary password to stdout
    - Set `mustChangePassword = true`
    - Log creation as `SYSTEM_CLI` actor in audit log
    - Exit cleanly
  - [ ] 11.2 Create `apps/server/src/cli/deactivateAdmin.ts`:
    - Parse `--email` argument
    - Require interactive confirmation via readline: "Type the email again to confirm:"
    - Check last-super-admin guardrail before proceeding
    - Deactivate, revoke tokens
    - Log deactivation as `SYSTEM_CLI` actor
  - [ ] 11.3 Add to `apps/server/package.json` scripts:
    ```json
    "user:create-admin": "tsx src/cli/createAdmin.ts",
    "user:deactivate-admin": "tsx src/cli/deactivateAdmin.ts"
    ```
  - [ ] 11.4 Create `apps/server/src/cli/createAdmin.test.ts` — test password generation, validation

- [ ] Task 12: Update login flow for mustChangePassword (AC: #3)
  - [ ] 12.1 Modify `authService.login()` — after successful auth, check `user.mustChangePassword`:
    - If true, still issue access token but include `mustChangePassword: true` in JWT claims
    - Return `mustChangePassword: true` in the login response body
  - [ ] 12.2 Modify `authService.changePassword()`:
    - After changing password, set `mustChangePassword = false` in DB
    - Issue new tokens WITHOUT `mustChangePassword` claim
  - [ ] 12.3 Update existing login tests — add test for `mustChangePassword` flow
  - [ ] 12.4 Verify Story 1.3 change-password endpoint exists and works (it should per review status)

- [ ] Task 13: Verify all tests pass (AC: #13)
  - [ ] 13.1 Run `pnpm --filter shared build` — types compile
  - [ ] 13.2 Run `pnpm test` from monorepo root — all workspaces pass
  - [ ] 13.3 Run `pnpm typecheck` — no type errors
  - [ ] 13.4 Run `pnpm lint` — no lint errors
  - [ ] 13.5 Verify all existing Story 1.1-1.3 tests still pass (no regressions)

## Dev Notes

### Critical Context — What This Story Establishes

This is **Story 9a of 58** — the **user account management API**. When complete, Super Admins and Department Admins can create user accounts via API, sending welcome emails with temporary credentials. Full account lifecycle management (deactivate, reactivate, reassign, delete, password reset) is available with downward-only hierarchy enforcement.

**This is a backend-heavy story.** No frontend UI — that's Story 1.9b. This story produces API endpoints, a service layer, email integration, CLI commands, and validation schemas.

**Sprint 1 demonstrability milestone includes:**
> User invitation system operational — AG can create dept admin and MDA officer accounts via UI with welcome emails.

This means 1.9a (API) + 1.9b (UI) together deliver the user invitation capability.

### Dependency Status

| Dependency | Status | What This Story Needs From It |
|---|---|---|
| Story 1.1 (scaffold) | done | Monorepo, DB, shared package |
| Story 1.2 (auth) | done | Users table, password hashing, login, register, `sanitiseUser()` |
| Story 1.3 (session security) | review | `changePassword()`, `revokeAllUserTokens()`, token rotation |
| Story 1.4 (RBAC) | **in-progress** | `authorise()` middleware, permission matrix |
| Story 1.5 (audit logging) | ready-for-dev | Audit log table, `auditLog` middleware |

**IMPORTANT:** If Story 1.4's `authorise()` middleware is not yet available, create a temporary inline role check (as currently done in `authRoutes.ts` line 17-22) and mark it as TODO for refactoring when 1.4 completes. If Story 1.5's audit logging is not available, log to console/pino and add TODO for audit table integration.

### What Already Exists (Reuse, Don't Reinvent)

| Component | Location | Reuse For |
|---|---|---|
| `hashPassword()` | `apps/server/src/lib/password.ts` | Hashing temporary passwords |
| `comparePassword()` | `apps/server/src/lib/password.ts` | N/A for this story |
| `revokeAllUserTokens()` | `apps/server/src/services/authService.ts` | Deactivation, deletion, password reset |
| `sanitiseUser()` | `apps/server/src/services/authService.ts` | Stripping password hash from responses |
| `generateUuidv7()` | `apps/server/src/lib/uuidv7.ts` | All new record IDs |
| `AppError` | `apps/server/src/lib/appError.ts` | All error responses |
| `validate()` middleware | `apps/server/src/middleware/validate.ts` | Request body validation |
| `authenticate` middleware | `apps/server/src/middleware/authenticate.ts` | JWT verification |
| `ROLES`, `ALL_ROLES` | `packages/shared/src/constants/roles.ts` | Role checks — NEVER hardcode strings |
| `VOCABULARY` | `packages/shared/src/constants/vocabulary.ts` | All user-facing messages |
| `registerSchema` | `packages/shared/src/validators/authSchemas.ts` | Reference for validation patterns |
| Existing `register()` | `apps/server/src/services/authService.ts` | Pattern for role-mdaId validation, duplicate email check |

**CRITICAL:** The existing `authService.register()` function already handles:
- Role-mdaId combination validation
- MDA existence check
- Case-insensitive duplicate email check
- Password hashing and user insertion

`userAdminService.createUser()` should reuse this logic or extract it into shared helpers. DO NOT duplicate the validation code.

### What NOT To Do

1. **DO NOT hardcode role strings** — Import `ROLES` from `@vlprs/shared`. OSLRS lesson: frontend/backend role string mismatch caused 3 roles to fail despite 53 passing tests.
2. **DO NOT send raw `res.status().json()` in route handlers** — Use `AppError` class for all errors.
3. **DO NOT block account creation on email failure** — Email is fire-and-forget. Log the failure but return 201 to the caller.
4. **DO NOT allow super_admin creation via API** — Super admins are CLI-only (political safety, separation of duties).
5. **DO NOT enumerate account status on login failure** — Deactivated users get the same "Invalid email or password" message as wrong-password users (already implemented in Story 1.2).
6. **DO NOT hard-delete users** — Always soft delete via `deleted_at` timestamp. Preserves audit trail and referential integrity.
7. **DO NOT create frontend components** — That's Story 1.9b.
8. **DO NOT create a separate `__tests__` directory** — Tests are co-located next to source files.
9. **DO NOT use `isLoading`** in any TanStack Query code — Use `isPending` (TanStack Query v5).
10. **DO NOT store temporary passwords in plaintext** — Always bcrypt hash before storing. Only the email and CLI stdout get the plaintext.
11. **DO NOT duplicate validation logic** — Extract common checks from `authService.register()` into reusable helpers or call the existing functions.

### API Endpoint Summary

| Method | Path | Body | Auth | Purpose |
|---|---|---|---|---|
| `POST` | `/api/users` | `{ email, firstName, lastName, role, mdaId? }` | super_admin, dept_admin | Create user + send invitation |
| `GET` | `/api/users` | Query: `role?, mdaId?, status?, page?, pageSize?` | super_admin, dept_admin | List users (role-scoped) |
| `POST` | `/api/users/:id/deactivate` | `{ reason? }` | super_admin, dept_admin | Deactivate account |
| `POST` | `/api/users/:id/reactivate` | — | super_admin, dept_admin | Reactivate account |
| `DELETE` | `/api/users/:id` | `{ confirmEmail }` | super_admin, dept_admin | Soft delete account |
| `PATCH` | `/api/users/:id` | `{ mdaId }` | super_admin, dept_admin | Reassign MDA |
| `POST` | `/api/users/:id/reset-password` | — | super_admin, dept_admin | Reset password + send email |

**All endpoints follow the standard response envelope:**
```typescript
// Success: { success: true, data: { ... } }
// Paginated: { success: true, data: [...], pagination: { page, pageSize, totalItems, totalPages } }
// Error: { success: false, error: { code, message, details? } }
```

### Downward-Only Hierarchy — Decision Matrix

| Acting Role | Target: super_admin | Target: dept_admin | Target: mda_officer |
|---|---|---|---|
| super_admin | 403 (CLI only) | ✓ Create/Deactivate/Delete/Reset | ✓ Create/Deactivate/Delete/Reset/Reassign |
| dept_admin | 403 | 403 (peer) | ✓ Create/Deactivate/Delete/Reset/Reassign |
| mda_officer | 403 | 403 | 403 |

### Account State Machine

```
                    ┌──────────────┐
   create ─────────>│    Active    │<──── reactivate
                    │ is_active=T  │
                    │ deleted_at=∅ │
                    └──────┬───────┘
                           │
              deactivate   │   soft delete
                    ┌──────┼──────────────────┐
                    ▼                          ▼
            ┌──────────────┐          ┌──────────────┐
            │ Deactivated  │          │   Deleted     │
            │ is_active=F  │──delete─>│ is_active=F   │
            │ deleted_at=∅ │          │ deleted_at=ts  │
            └──────────────┘          └──────────────┘
                    ▲                   (one-way, no
              reactivate                 reactivation)
```

### Email Templates (Simple HTML Strings)

**Welcome Email:**
```
Subject: Welcome to VLPRS — Your Account is Ready

Body:
- "You have been invited to VLPRS (Vehicle Loan Processing & Recovery System)"
- Login URL: {APP_URL}/login
- Email: {email}
- Temporary Password: {tempPassword}
- "You will be required to change your password on first login."
- Role description based on role:
  - dept_admin: "As Department Admin, you can manage loans, process migrations, and oversee MDA submissions."
  - mda_officer: "As MDA Reporting Officer for {mdaName}, you can submit monthly deduction reports for your assigned MDA."
```

**Password Reset Email:**
```
Subject: VLPRS — Your Password Has Been Reset

Body:
- "Your password has been reset by an administrator."
- Login URL: {APP_URL}/login
- New Temporary Password: {tempPassword}
- "Please change your password immediately after logging in."
```

### Resend SDK Usage Pattern

```typescript
import { Resend } from 'resend';

const resend = new Resend(env.RESEND_API_KEY);

await resend.emails.send({
  from: env.EMAIL_FROM,        // 'noreply@vlprs.oyo.gov.ng'
  to: recipient,
  subject: 'Welcome to VLPRS',
  html: '<html>...</html>',    // Simple HTML string
});
```

**Dev mode:** When `RESEND_API_KEY` is empty/undefined, skip the Resend call and log the email content + temporary password to the server console. This allows development without a Resend account.

### Testing Strategy

**Unit Tests (co-located):**
- `password.test.ts` — add test for `generateTemporaryPassword()` (meets FR42 policy)
- `email.test.ts` — template generation, dev-mode logging
- `userSchemas.test.ts` — validation happy path and error cases
- `roles.test.ts` — add tests for `canManageRole()`, `getManageableRoles()`

**Integration Tests (co-located with routes/services):**
- `userAdminService.test.ts` — all CRUD operations with DB
- `userRoutes.test.ts` — HTTP-level tests for all 7 endpoints

**Test Helpers (from `packages/testing`):**
```typescript
// Create authenticated request helper (if available from Story 1.2):
const agent = request(app)
  .set('Authorization', `Bearer ${superAdminToken}`)
  .set('Content-Type', 'application/json');
```

### File Structure — What This Story Creates

```
packages/shared/src/
├── constants/
│   ├── roles.ts                          # MODIFY — add ROLE_HIERARCHY, canManageRole(), getManageableRoles()
│   └── vocabulary.ts                     # MODIFY — add user admin vocabulary entries
├── types/
│   └── auth.ts                           # MODIFY — add mustChangePassword to User, JwtPayload, LoginResponse
├── validators/
│   ├── authSchemas.ts                    # NO CHANGE
│   ├── userSchemas.ts                    # NEW — createUserSchema, updateUserSchema, etc.
│   └── userSchemas.test.ts              # NEW
└── index.ts                             # MODIFY — export new schemas, role utilities

apps/server/src/
├── config/
│   └── env.ts                           # MODIFY — add RESEND_API_KEY, EMAIL_FROM, APP_URL
├── db/
│   ├── schema.ts                        # MODIFY — add must_change_password column
│   └── migrations/                      # NEW migration file (auto-generated by drizzle-kit)
├── lib/
│   ├── email.ts                         # NEW — Resend integration
│   ├── email.test.ts                    # NEW
│   ├── jwt.ts                           # MODIFY — add mustChangePassword to JWT claims
│   └── password.ts                      # MODIFY — add generateTemporaryPassword()
├── middleware/
│   ├── requirePasswordChange.ts         # NEW — enforce must_change_password
│   └── requirePasswordChange.test.ts    # NEW
├── routes/
│   ├── userRoutes.ts                    # NEW — 7 endpoints
│   └── userRoutes.test.ts              # NEW
├── services/
│   ├── authService.ts                   # MODIFY — login returns mustChangePassword, changePassword clears flag
│   ├── userAdminService.ts              # NEW — account CRUD, lifecycle, email
│   └── userAdminService.test.ts         # NEW
├── cli/
│   ├── createAdmin.ts                   # NEW — pnpm user:create-admin
│   ├── createAdmin.test.ts              # NEW
│   └── deactivateAdmin.ts              # NEW — pnpm user:deactivate-admin
├── app.ts                               # MODIFY — mount userRoutes, add requirePasswordChange middleware

(project root)
├── .env.example                          # MODIFY — add EMAIL_FROM, APP_URL
```

**Files this story MUST NOT modify:**

```
apps/client/**                            # No frontend changes (Story 1.9b)
apps/server/src/routes/authRoutes.ts     # Auth routes stay separate
apps/server/src/routes/healthRoutes.ts   # No change
apps/server/src/db/seed-demo.ts          # Seed script unchanged (Story 1.8b handles)
apps/server/src/db/seed-production.ts    # Uses existing register, not userAdmin
packages/shared/src/constants/vocabulary.ts  # Except additions (DO NOT remove existing entries)
```

### Previous Story Intelligence

**From Story 1.2 (auth — done):**
1. `register()` in authService.ts validates role-mdaId, checks duplicate email, hashes password — extract shared logic
2. Login returns 401 for deactivated users with generic message — already handles AC4 login blocking
3. `sanitiseUser()` strips password hash — reuse for all user responses
4. Zod v4 used (`import { z } from 'zod/v4'`) — NOT Zod v3

**From Story 1.3 (session security — review, 2 new commits):**
1. `changePassword()` exists in authService — updates hash and revokes all tokens
2. `revokeAllUserTokens()` exists — reuse for deactivation, deletion, password reset
3. Token rotation with reuse detection implemented
4. CSRF middleware exists
5. Two new commits: session security implementation + transaction rollback fix for token revocations

**From Story 1.4 (RBAC — in-progress):**
1. `authorise()` middleware may or may not exist yet — check before using
2. Permission matrix defined in constants — may already be implemented
3. `scopeToMda` middleware for MDA data isolation — relevant for user listing

### Architecture Compliance

**Naming Conventions:**
- Tables: `snake_case`, plural (`users`)
- Columns: `snake_case` (`must_change_password`, `deleted_at`)
- Routes: `/api/users`, `/api/users/:id/deactivate`
- Files: `camelCase.ts` (`userAdminService.ts`, `userRoutes.ts`)
- Functions: `camelCase`, verb-first (`createUser()`, `deactivateUser()`)
- Zod schemas: `camelCase` + `Schema` suffix (`createUserSchema`)

**Error Response Pattern:**
```typescript
throw new AppError(403, 'HIERARCHY_INSUFFICIENT', VOCABULARY.HIERARCHY_INSUFFICIENT);
// → { success: false, error: { code: 'HIERARCHY_INSUFFICIENT', message: '...' } }
```

**Middleware Chain for User Routes:**
```
authenticate → requirePasswordChange → authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN) → validate(schema) → handler
```
Note: `requirePasswordChange` sits BEFORE `authorise` — a user who must change their password gets 403 PASSWORD_CHANGE_REQUIRED regardless of their role permissions.

**Database Conventions:**
- UUIDv7 for all PKs via `generateUuidv7()`
- `timestamptz` for all timestamps
- Soft deletes via `deleted_at` — NEVER hard delete users
- Boolean columns with `is_` prefix (`is_active`, `must_change_password`)

### Scope Boundaries

**Explicitly IN scope:**
- User CRUD API endpoints (7 endpoints)
- Resend email integration (welcome + password reset)
- Temporary password generation
- Downward-only role hierarchy enforcement
- Forced password change middleware
- Account state machine (Active ↔ Deactivated → Deleted)
- MDA reassignment
- Admin-initiated password reset
- User listing with role-based scoping and pagination
- Super Admin CLI commands (create, deactivate)
- Last-super-admin guardrail
- Validation schemas in shared package
- Vocabulary constants for user admin messages
- `must_change_password` column addition

**Explicitly NOT in scope (Story 1.9b):**
- User management UI (AdminPage, invite dialog, user table, action menus)
- First-login password change screen
- Profile page (view own details, change own password UI)
- Navigation integration (User Management sidebar item)
- Mobile responsive table/card layouts for user list

**Explicitly NOT in scope (later stories):**
- Audit log table creation (Story 1.5) — use console/pino logging as fallback
- Email notification scheduling (Epic 9)
- Password complexity history/reuse prevention (Phase 2)
- Multi-factor authentication (Phase 2)

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.9a: User Account Lifecycle API & Email Invitation]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.9b (dependency context)]
- [Source: _bmad-output/planning-artifacts/epics.md#FR72 — User account lifecycle]
- [Source: _bmad-output/planning-artifacts/epics.md#FR73 — Admin-initiated password reset]
- [Source: _bmad-output/planning-artifacts/architecture.md#RBAC Middleware — 3 Roles, Hierarchy]
- [Source: _bmad-output/planning-artifacts/architecture.md#Email — Resend Integration]
- [Source: _bmad-output/planning-artifacts/architecture.md#userAdminService — Service Boundaries]
- [Source: _bmad-output/planning-artifacts/architecture.md#userRoutes — Route Structure]
- [Source: _bmad-output/planning-artifacts/architecture.md#Soft Deletes — deleted_at Pattern]
- [Source: _bmad-output/planning-artifacts/architecture.md#Audit Logging — Append-Only]
- [Source: _bmad-output/planning-artifacts/architecture.md#Validation Pipeline — 3-Stage Zod]
- [Source: _bmad-output/planning-artifacts/architecture.md#Enforcement Rules — AI Agent Mandates]
- [Source: _bmad-output/planning-artifacts/architecture.md#Database Schema — users, refresh_tokens]
- [Source: _bmad-output/planning-artifacts/architecture.md#Environment Variables — RESEND_API_KEY, EMAIL_FROM]
- [Source: _bmad-output/planning-artifacts/architecture.md#CLI Commands — user:create-admin, user:deactivate-admin]
- [Source: _bmad-output/planning-artifacts/prd.md#FR42-FR46 — RBAC Role Definitions]
- [Source: _bmad-output/planning-artifacts/prd.md#FR72 — Account Lifecycle Full Definition]
- [Source: _bmad-output/planning-artifacts/prd.md#FR73 — Password Reset Full Definition]
- [Source: _bmad-output/planning-artifacts/prd.md#Journey 4 — Dept Admin User Management Scenario]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#User Management Screen Requirements]
- [Source: apps/server/src/services/authService.ts — register(), login(), revokeAllUserTokens(), changePassword()]
- [Source: apps/server/src/db/schema.ts — users table, refresh_tokens table]
- [Source: apps/server/src/lib/password.ts — hashPassword(), comparePassword()]
- [Source: apps/server/src/middleware/authenticate.ts — JWT verification pattern]
- [Source: apps/server/src/middleware/validate.ts — Zod validation pattern]
- [Source: apps/server/src/lib/appError.ts — AppError class]
- [Source: packages/shared/src/constants/roles.ts — ROLES, ALL_ROLES]
- [Source: packages/shared/src/constants/vocabulary.ts — existing vocabulary entries]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
