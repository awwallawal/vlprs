// Target: User administration mock data — used by useUserAdmin hooks
// Wire: Sprint 1 (Story 1.9b) — swap queryFn to real API when backend is wired

import type { UserListItem, PaginatedResponse } from '@vlprs/shared';
import { OYO_MDAS } from './oyoMdas';

export const MOCK_USERS: UserListItem[] = [
  {
    id: 'usr-001',
    firstName: 'Adebayo',
    lastName: 'Ogunlesi',
    email: 'ag@vlprs.oyo.gov.ng',
    role: 'super_admin',
    mdaId: null,
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-01-15T09:00:00Z',
    isSelf: false,
    lastLoginAt: '2026-02-20T08:30:00Z',
  },
  {
    id: 'usr-002',
    firstName: 'Chidinma',
    lastName: 'Okafor',
    email: 'dept.admin@vlprs.oyo.gov.ng',
    role: 'dept_admin',
    mdaId: null,
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-01-16T10:00:00Z',
    isSelf: false,
    lastLoginAt: '2026-02-19T14:00:00Z',
  },
  {
    id: 'usr-003',
    firstName: 'Olumide',
    lastName: 'Adeyemi',
    email: 'o.adeyemi@vlprs.oyo.gov.ng',
    role: 'mda_officer',
    mdaId: 'mda-001',
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-01-20T11:00:00Z',
    isSelf: false,
    lastLoginAt: '2026-02-18T09:15:00Z',
  },
  {
    id: 'usr-004',
    firstName: 'Funke',
    lastName: 'Adekunle',
    email: 'f.adekunle@vlprs.oyo.gov.ng',
    role: 'mda_officer',
    mdaId: 'mda-002',
    isActive: true,
    mustChangePassword: true,
    createdAt: '2026-02-10T08:00:00Z',
    isSelf: false,
    lastLoginAt: null,
  },
  {
    id: 'usr-005',
    firstName: 'Babatunde',
    lastName: 'Ishola',
    email: 'b.ishola@vlprs.oyo.gov.ng',
    role: 'mda_officer',
    mdaId: 'mda-003',
    isActive: false,
    mustChangePassword: false,
    createdAt: '2026-01-25T14:30:00Z',
    isSelf: false,
    lastLoginAt: '2026-02-05T16:00:00Z',
  },
  {
    id: 'usr-006',
    firstName: 'Aisha',
    lastName: 'Balogun',
    email: 'a.balogun@vlprs.oyo.gov.ng',
    role: 'mda_officer',
    mdaId: 'mda-005',
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-02-01T10:00:00Z',
    isSelf: false,
    lastLoginAt: '2026-02-20T11:45:00Z',
  },
  {
    id: 'usr-007',
    firstName: 'Emeka',
    lastName: 'Nwosu',
    email: 'e.nwosu@vlprs.oyo.gov.ng',
    role: 'mda_officer',
    mdaId: 'mda-004',
    isActive: true,
    mustChangePassword: false,
    createdAt: '2026-02-05T09:30:00Z',
    isSelf: false,
    lastLoginAt: '2026-02-19T10:20:00Z',
  },
];

export const MOCK_MDAS = OYO_MDAS.slice(0, 10).map((mda) => ({
  id: mda.mdaId,
  name: mda.mdaName,
  code: mda.mdaCode,
}));

export function getMockUsersResponse(filters?: {
  role?: string;
  mdaId?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): PaginatedResponse<UserListItem> {
  let filtered = [...MOCK_USERS];

  if (filters?.role) {
    filtered = filtered.filter((u) => u.role === filters.role);
  }
  if (filters?.mdaId) {
    filtered = filtered.filter((u) => u.mdaId === filters.mdaId);
  }
  if (filters?.status) {
    const isActive = filters.status === 'active';
    filtered = filtered.filter((u) => u.isActive === isActive);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    );
  }

  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = (page - 1) * pageSize;
  const data = filtered.slice(start, start + pageSize);

  return {
    data,
    pagination: { page, pageSize, totalItems, totalPages },
  };
}
