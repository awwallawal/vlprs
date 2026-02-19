export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'dept_admin' | 'mda_officer';
  mdaId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'dept_admin' | 'mda_officer';
  mdaId: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'dept_admin' | 'mda_officer';
  mdaId?: string | null;
}

export interface RefreshResponse {
  accessToken: string;
}
