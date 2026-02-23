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
  TOKEN_INVALID: 'Invalid or malformed token. Please log in again.',
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
  // User Account Management (Story 1.9a)
  USER_NOT_FOUND: 'The requested user account could not be found.',
  PASSWORD_CHANGE_REQUIRED: 'You must change your password before continuing.',
  HIERARCHY_INSUFFICIENT: 'Insufficient permissions to manage this account level.',
  SELF_MANAGEMENT_DENIED: 'Cannot modify own account through this endpoint.',
  SUPER_ADMIN_CLI_ONLY: 'Super Admin accounts can only be managed via system administration.',
  MDA_REQUIRED_FOR_OFFICER: 'MDA assignment required for MDA Reporting Officer accounts.',
  MDA_ONLY_FOR_OFFICER: 'MDA assignment is only applicable to MDA Reporting Officer accounts.',
  DELETED_CANNOT_REACTIVATE: 'Deleted accounts cannot be reactivated — create a new account instead.',
  DELETE_CONFIRM_MISMATCH: 'Confirmation email does not match — deletion aborted.',
  LAST_SUPER_ADMIN: 'Cannot deactivate — this is the last active Super Admin. Create a replacement first.',
  INVITATION_SENT: 'Invitation sent successfully.',
  PASSWORD_RESET_SENT: 'Password reset email sent successfully.',
} as const;

export const UI_COPY = {
  UPLOAD_ERROR_HEADER: 'Upload needs attention',
  UPLOAD_SUCCESS_HEADER: 'Upload Complete',
  COMPARISON_COMPLETE: 'Comparison Complete',
  VARIANCE_LABEL: 'Variance',
  ATTENTION_LABEL: 'Review',
  EMPTY_ATTENTION: 'No attention items — all systems normal',
  EMPTY_EXCEPTIONS: 'No exceptions — all issues resolved',
  EMPTY_MIGRATION: 'No MDAs in migration pipeline',
} as const;
