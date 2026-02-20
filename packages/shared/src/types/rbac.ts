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
 * Consumed by frontend AuthGuard and role guards (Story 1.6).
 */
export interface AuthorisedContext {
  user: AuthenticatedUser;
  mdaScope: string | null;
}
