import { ROLES, type Role } from '@vlprs/shared';
import {
  LayoutDashboard,
  Settings,
  AlertCircle,
  FileText,
  Upload,
  Clock,
  Database,
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
  { label: 'Operations', path: '/dashboard/operations', icon: Settings, roles: [ROLES.DEPT_ADMIN] },
  { label: 'Submit', path: '/dashboard/submissions', icon: Upload, roles: [ROLES.MDA_OFFICER] },
  { label: 'History', path: '/dashboard/submissions', icon: Clock, roles: [ROLES.MDA_OFFICER] },
  { label: 'Migration', path: '/dashboard/migration', icon: Database, roles: [ROLES.DEPT_ADMIN] },
  { label: 'Reports', path: '/dashboard/reports', icon: FileText, roles: [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN] },
  { label: 'Exceptions', path: '/dashboard/exceptions', icon: AlertCircle, roles: [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN] },
];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.DEPT_ADMIN]: 'Department Admin',
  [ROLES.MDA_OFFICER]: 'MDA Officer',
};

export const ROLE_HOME_ROUTES: Record<Role, string> = {
  [ROLES.SUPER_ADMIN]: '/dashboard',
  [ROLES.DEPT_ADMIN]: '/dashboard/operations',
  [ROLES.MDA_OFFICER]: '/dashboard/submissions',
};
