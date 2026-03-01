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
  // Loan & MDA (Story 2.1)
  LOAN_NOT_FOUND: 'The requested loan record could not be found.',
  MDA_NOT_FOUND: 'The requested MDA could not be found.',
  LOAN_REFERENCE_GENERATED: 'Loan reference number generated successfully.',
  DUPLICATE_LOAN_REFERENCE: 'A loan with this reference number already exists. Please retry.',
  // Schedule (Story 2.3) — forward reference for schedule-related UI/API messages
  SCHEDULE_COMPUTED: 'Repayment schedule computed successfully.',
  // Ledger (Story 2.2)
  LEDGER_IMMUTABLE: 'Financial records cannot be modified or deleted.',
  LEDGER_METHOD_NOT_ALLOWED: 'This operation is not permitted on financial records.',
  LEDGER_ENTRY_CREATED: 'Ledger entry recorded successfully.',
  // Balance (Story 2.5)
  BALANCE_COMPUTED: 'Balance computed from ledger entries.',
  INVALID_AS_OF_DATE: 'The provided date is not valid. Use YYYY-MM-DD format.',
  // Search (Story 2.6)
  SEARCH_TOO_SHORT: 'Search term must be at least 2 characters.',
  // Loan Transitions (Story 2.7)
  INVALID_TRANSITION: 'This status change is not permitted. Allowed transitions from the current status: {allowed}.',
  TRANSITION_RECORDED: 'Loan status updated successfully.',
  LOAN_ALREADY_IN_STATUS: 'The loan is already in the requested status.',
  TERMINAL_STATUS: 'No further status changes are permitted for this loan.',
  // Temporal Profile (Story 10.1)
  TEMPORAL_PROFILE_INCOMPLETE: 'Profile Incomplete — DOB/appointment date required',
  TEMPORAL_PROFILE_UPDATED: 'Temporal profile updated and retirement date recomputed.',
  TEMPORAL_DOB_FUTURE: 'Date of birth cannot be in the future.',
  TEMPORAL_APPT_BEFORE_DOB: 'Date of first appointment cannot precede date of birth.',
  TEMPORAL_CORRECTION_RECORDED: 'Date correction recorded with full audit trail.',
  // Service Extensions (Story 10.2)
  SERVICE_EXTENSION_RECORDED: 'Service extension recorded successfully.',
  SERVICE_EXTENSION_INCOMPLETE_PROFILE: 'Service extension cannot be recorded — temporal profile is incomplete. Please provide date of birth and appointment date first.',
  SERVICE_EXTENSION_DATE_NOT_AFTER: 'Extension date must be after the current retirement date ({currentDate}).',
  SERVICE_EXTENSION_MAX_EXCEEDED: 'Extension exceeds maximum allowed period. Please verify the extension date.',
  // Reports (Story 10.4)
  NO_POST_RETIREMENT_ACTIVITY: 'No post-retirement activity detected',
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
  // User Administration UI (Story 1.9b)
  INVITE_USER: 'Invite User',
  INVITATION_SENT_TO: 'Invitation sent to',
  PASSWORD_RESET_SENT_TO: 'Password reset email sent to',
  DEACTIVATE_CONFIRM: "Deactivate {name}'s account? They will be logged out immediately and unable to sign in until reactivated.",
  DELETE_CONFIRM: "Permanently remove {name}'s account? This action cannot be undone.",
  DELETE_TYPE_EMAIL: 'Type their email to confirm:',
  RESET_PASSWORD_CONFIRM: 'Send a temporary password to {email}? Their current sessions will be terminated.',
  REASSIGN_MDA_NOTE: "The officer's data access will immediately switch to the new MDA.",
  SUPER_ADMIN_TOOLTIP: 'Super Admin accounts are managed via system administration',
  ADMIN_FIELD_LOCKED: 'Contact your administrator to update',
  NO_USERS_MATCHING: 'No users found matching your filters',
  NO_USERS_YET: "No users yet. Click 'Invite User' to get started.",
  PASSWORD_UPDATED_WELCOME: 'Password updated. Welcome to VLPRS.',
  PASSWORD_UPDATED: 'Password updated successfully',
} as const;
