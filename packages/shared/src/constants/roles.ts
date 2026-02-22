export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  DEPT_ADMIN: 'dept_admin',
  MDA_OFFICER: 'mda_officer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [ROLES.MDA_OFFICER]: 1,
  [ROLES.DEPT_ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3,
};

export function getManageableRoles(actingRole: Role): Role[] {
  const level = ROLE_HIERARCHY[actingRole];
  return ALL_ROLES.filter(r => ROLE_HIERARCHY[r] < level);
}

export function canManageRole(actingRole: Role, targetRole: Role): boolean {
  return ROLE_HIERARCHY[actingRole] > ROLE_HIERARCHY[targetRole];
}
