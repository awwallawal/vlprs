export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEPT_ADMIN: 'dept_admin',
  MDA_OFFICER: 'mda_officer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER];
