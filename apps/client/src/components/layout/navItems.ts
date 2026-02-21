import { ROLES, type Role } from '@vlprs/shared';
import {
  LayoutDashboard,
  Settings,
  AlertTriangle,
  FileText,
  Upload,
  History,
  FolderSync,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: [ROLES.SUPER_ADMIN] },
  { label: 'Operations', path: '/operations', icon: Settings, roles: [ROLES.DEPT_ADMIN] },
  { label: 'Submit', path: '/submissions', icon: Upload, roles: [ROLES.MDA_OFFICER] },
  { label: 'History', path: '/history', icon: History, roles: [ROLES.MDA_OFFICER] },
  { label: 'Migration', path: '/migration', icon: FolderSync, roles: [ROLES.DEPT_ADMIN] },
  { label: 'Reports', path: '/reports', icon: FileText, roles: [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN] },
  { label: 'Exceptions', path: '/exceptions', icon: AlertTriangle, roles: [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN] },
];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.DEPT_ADMIN]: 'Department Admin',
  [ROLES.MDA_OFFICER]: 'MDA Officer',
};
