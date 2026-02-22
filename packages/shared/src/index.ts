// Schemas (legacy from Story 1.1)
export { emailSchema } from './schemas/emailSchema.js';

// Validators
export { loginSchema, registerSchema } from './validators/authSchemas.js';

// Types
export type { ApiResponse, ApiError, ApiResult } from './types/api.js';
export type { User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest, RefreshResponse } from './types/auth.js';
export type { AuthenticatedUser, AuthorisedContext } from './types/rbac.js';
export type { DashboardMetrics, AttentionItem } from './types/dashboard.js';
export type { SubmissionStatus, MigrationStage, MdaComplianceRow, MdaSummary, MigrationMdaStatus } from './types/mda.js';
export type { LoanStatus, LoanSummary, LoanSearchResult } from './types/loan.js';
export type { SubmissionRecord } from './types/submission.js';
export type { ExceptionPriority, ExceptionCategory, ExceptionItem } from './types/exception.js';

// Constants
export { ROLES, ALL_ROLES, type Role } from './constants/roles.js';
export { VOCABULARY, UI_COPY } from './constants/vocabulary.js';
export { PERMISSION_MATRIX, hasPermission } from './constants/permissions.js';
