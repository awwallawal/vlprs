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
  // Registration
  EMAIL_ALREADY_EXISTS: 'An account with this email address already exists.',
  // Validation
  VALIDATION_FAILED: 'Please check your input and try again.',
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
} as const;
