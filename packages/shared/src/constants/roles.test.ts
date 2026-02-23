import { describe, it, expect } from 'vitest';
import { ROLES, ROLE_HIERARCHY, getManageableRoles, canManageRole } from './roles';

describe('ROLE_HIERARCHY', () => {
  it('ranks super_admin highest', () => {
    expect(ROLE_HIERARCHY[ROLES.SUPER_ADMIN]).toBeGreaterThan(ROLE_HIERARCHY[ROLES.DEPT_ADMIN]);
    expect(ROLE_HIERARCHY[ROLES.SUPER_ADMIN]).toBeGreaterThan(ROLE_HIERARCHY[ROLES.MDA_OFFICER]);
  });

  it('ranks dept_admin above mda_officer', () => {
    expect(ROLE_HIERARCHY[ROLES.DEPT_ADMIN]).toBeGreaterThan(ROLE_HIERARCHY[ROLES.MDA_OFFICER]);
  });
});

describe('getManageableRoles', () => {
  it('super_admin can manage dept_admin and mda_officer', () => {
    const roles = getManageableRoles(ROLES.SUPER_ADMIN);
    expect(roles).toContain(ROLES.DEPT_ADMIN);
    expect(roles).toContain(ROLES.MDA_OFFICER);
    expect(roles).not.toContain(ROLES.SUPER_ADMIN);
  });

  it('dept_admin can manage only mda_officer', () => {
    const roles = getManageableRoles(ROLES.DEPT_ADMIN);
    expect(roles).toContain(ROLES.MDA_OFFICER);
    expect(roles).not.toContain(ROLES.DEPT_ADMIN);
    expect(roles).not.toContain(ROLES.SUPER_ADMIN);
  });

  it('mda_officer can manage no one', () => {
    const roles = getManageableRoles(ROLES.MDA_OFFICER);
    expect(roles).toHaveLength(0);
  });
});

describe('canManageRole', () => {
  it('super_admin can manage dept_admin', () => {
    expect(canManageRole(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN)).toBe(true);
  });

  it('super_admin can manage mda_officer', () => {
    expect(canManageRole(ROLES.SUPER_ADMIN, ROLES.MDA_OFFICER)).toBe(true);
  });

  it('super_admin cannot manage super_admin', () => {
    expect(canManageRole(ROLES.SUPER_ADMIN, ROLES.SUPER_ADMIN)).toBe(false);
  });

  it('dept_admin can manage mda_officer', () => {
    expect(canManageRole(ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER)).toBe(true);
  });

  it('dept_admin cannot manage dept_admin', () => {
    expect(canManageRole(ROLES.DEPT_ADMIN, ROLES.DEPT_ADMIN)).toBe(false);
  });

  it('dept_admin cannot manage super_admin', () => {
    expect(canManageRole(ROLES.DEPT_ADMIN, ROLES.SUPER_ADMIN)).toBe(false);
  });

  it('mda_officer cannot manage anyone', () => {
    expect(canManageRole(ROLES.MDA_OFFICER, ROLES.MDA_OFFICER)).toBe(false);
    expect(canManageRole(ROLES.MDA_OFFICER, ROLES.DEPT_ADMIN)).toBe(false);
    expect(canManageRole(ROLES.MDA_OFFICER, ROLES.SUPER_ADMIN)).toBe(false);
  });
});
