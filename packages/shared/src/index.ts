// Schemas (legacy from Story 1.1)
export { emailSchema } from './schemas/emailSchema.js';

// Validators
export { loginSchema, registerSchema } from './validators/authSchemas.js';

// Types
export type { ApiResponse, ApiError, ApiResult } from './types/api.js';
export type { User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest, RefreshResponse } from './types/auth.js';
export type { AuthenticatedUser, AuthorisedContext } from './types/rbac.js';

// Constants
export { ROLES, ALL_ROLES, type Role } from './constants/roles.js';
export { VOCABULARY } from './constants/vocabulary.js';
export { PERMISSION_MATRIX, hasPermission } from './constants/permissions.js';
