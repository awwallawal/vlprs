import { ROLES, type Role } from './roles';

/**
 * Centralised permission matrix — maps resource:action pairs to allowed roles.
 * Used by:
 * - Frontend: Role guards use this to show/hide UI elements (Story 1.6)
 * - Documentation: Reference for which roles each route middleware should permit
 *
 * Note: Backend route authorization is enforced by authorise(...roles) middleware
 * with explicit role lists per route — this matrix is NOT consumed at runtime by
 * the backend. Route middleware definitions are the source of truth for API access.
 *
 * Convention: resource names are plural, actions are CRUD verbs.
 */
export const PERMISSION_MATRIX: Record<string, Role[]> = {
  // Auth & User Management
  'users:create':        [ROLES.SUPER_ADMIN],
  'users:read':          [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'users:update':        [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'users:deactivate':    [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'users:resetPassword': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Dashboard
  'dashboard:read':      [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Loans
  'loans:read':          [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'loans:manage':        [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Submissions
  'submissions:read':    [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'submissions:create':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Exceptions
  'exceptions:read':     [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'exceptions:resolve':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Migrations
  'migrations:read':     [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'migrations:process':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Reports
  'reports:read':        [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'reports:generate':    [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Employment Events
  'employmentEvents:read':   [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'employmentEvents:create': [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Early Exit
  'earlyExits:read':     [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],
  'earlyExits:process':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN],

  // Staff ID
  'staffId:read':        [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
  'staffId:update':      [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],

  // Pre-Submission
  'preSubmission:read':  [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER],
} as const;

/**
 * Helper to check if a role has permission for a resource:action.
 */
export function hasPermission(role: Role, resource: string, action: string): boolean {
  const key = `${resource}:${action}`;
  const allowed = PERMISSION_MATRIX[key];
  return allowed ? allowed.includes(role) : false;
}
