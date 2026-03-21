import type { Role } from '@vlprs/shared';

export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by authenticate middleware after JWT verification */
      user?: {
        userId: string;
        email: string;
        role: Role;
        mdaId: string | null;
        mustChangePassword?: boolean;
      };
      /** Set by scopeToMda middleware — null means unscoped (super_admin/dept_admin) */
      mdaScope?: string | null;
      /** Can be set by route handlers to override action derivation in auditLog middleware */
      auditAction?: string;
      /** Set by queryCounter middleware — total DB queries executed during this request */
      queryCount?: number;
    }
  }
}
