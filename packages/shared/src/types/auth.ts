import type { Role } from '../constants/roles';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  mdaId: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  mdaId: string | null;
  mustChangePassword?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
  mustChangePassword: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  mdaId?: string | null;
}

export interface RefreshResponse {
  accessToken: string;
}

export interface UserListItem extends User {
  isSelf: boolean;
  lastLoginAt: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
