/**
 * Non-punitive vocabulary constants.
 * VLPRS uses neutral, non-punitive language throughout the system.
 */
export const VOCABULARY = {
  // Authentication
  LOGIN_UNSUCCESSFUL: 'Email or password is incorrect. Please try again.',
  ACCOUNT_TEMPORARILY_LOCKED:
    'Your account is temporarily unavailable. Please try again in 15 minutes.',
  ACCOUNT_INACTIVE:
    'Your account is currently inactive. Please contact your administrator.',
  AUTHENTICATION_REQUIRED: 'Please provide a valid access token.',
  TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action.',
  // RBAC (Story 1.4)
  MDA_ACCESS_DENIED: 'You can only access data for your assigned organisation.',
  MDA_NOT_ASSIGNED: 'Your account is not assigned to any organisation. Please contact your administrator.',
  // Registration
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists.',
  // Validation
  VALIDATION_FAILED: 'Please check your input and try again.',
  // Session Security (Story 1.3)
  TOKEN_REUSE_DETECTED: 'A security concern was detected with your session. Please log in again.',
  SESSION_INACTIVE: 'Your session has expired due to inactivity. Please log in again.',
  REFRESH_TOKEN_EXPIRED: 'Your session has expired. Please log in again.',
  REFRESH_TOKEN_INVALID: 'Your session could not be verified. Please log in again.',
  CSRF_VALIDATION_FAILED: 'Your request could not be verified. Please refresh the page and try again.',
  LOGOUT_SUCCESSFUL: 'You have been successfully logged out.',
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
} as const;
