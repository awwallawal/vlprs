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
  // Migration (Story 3.1)
  MIGRATION_FILE_TOO_LARGE: 'File exceeds the 10MB size limit. Please upload a smaller file.',
  MIGRATION_FILE_PARSE_ERROR: 'Unable to read the uploaded file. Please ensure it is a valid .xlsx or .csv file.',
  MIGRATION_FILE_NO_SHEETS: 'No readable sheets found in the uploaded file.',
  MIGRATION_FILE_NO_DATA: 'No data could be detected in the uploaded file. Please check the file contents.',
  MIGRATION_TOO_MANY_ROWS: 'Sheet exceeds the 500 row limit. Please split the file into smaller batches.',
  MIGRATION_UPLOAD_NOT_FOUND: 'The requested upload could not be found.',
  MIGRATION_UPLOAD_ALREADY_PROCESSED: 'This upload has already been processed.',
  MIGRATION_FILE_MISMATCH: 'The re-uploaded file does not match the original. Please upload the same file.',
  MIGRATION_UPLOAD_COMPLETE: 'Upload processed successfully.',
  // Migration Validation (Story 3.2)
  MIGRATION_UPLOAD_NOT_VALIDATED: 'This upload must be in completed status before validation.',
  MIGRATION_ALREADY_VALIDATED: 'This upload has already been validated.',
  MIGRATION_VALIDATION_COMPLETE: 'Validation completed successfully.',
  VARIANCE_CLEAN: 'Clean — values match computed schedule',
  VARIANCE_MINOR: 'Minor Variance — small difference within tolerance',
  VARIANCE_SIGNIFICANT: 'Significant Variance — requires review',
  VARIANCE_STRUCTURAL: 'Rate Variance — rate differs from standard',
  VARIANCE_ANOMALOUS: 'Requires clarification — no matching pattern found',
  RATE_DIFFERS: 'Rate differs from the standard 13.33% — this is an observation for review, not an error',
  MULTI_MDA_DETECTED: 'This file contains records for multiple MDAs — review recommended before proceeding',
  INSUFFICIENT_DATA: 'Insufficient data for full validation — available fields compared',
  // Person Matching (Story 3.3)
  CROSS_MDA_DETECTED: 'Records found in multiple MDAs — unified view available',
  MATCH_AUTO_CONFIRMED: 'Exact match confirmed automatically',
  MATCH_PENDING_REVIEW: 'Suggested match — requires confirmation',
  PROFILE_COMPLETE: 'Temporal profile complete',
  PERSON_NOT_FOUND: 'No records found for this person.',
  MATCH_NOT_FOUND: 'The requested match could not be found.',
  MATCH_NOT_PENDING: 'Only pending matches can be updated.',
  // Baseline Acknowledgment (Story 3.4)
  BASELINE_CREATED: 'Baseline established — legacy position recorded as declared',
  BASELINE_BATCH_COMPLETE: 'All baselines established — loan records created',
  BASELINE_ANNOTATION: 'Migrated from legacy system — baseline as declared',
  BASELINE_ALREADY_EXISTS: 'Baseline already established for this record',
  BASELINE_VARIANCE_NOTE: 'Variance acknowledged and recorded for audit',
  BASELINE_UPLOAD_NOT_VALIDATED: 'This upload must be validated before baselines can be created.',
  BASELINE_RECORD_NOT_FOUND: 'The requested migration record could not be found.',
  BASELINE_MISSING_BALANCE: 'Cannot establish baseline — declared outstanding balance is not available for this record.',
  // Migration Dashboard (Story 3.5)
  MIGRATION_DASHBOARD_TITLE: 'Migration Progress',
  DATA_PENDING_NEUTRAL: 'Data not yet received — archive recovery in progress',
  BENEFICIARY_LEDGER_TITLE: 'Master Beneficiary Ledger',
  // Observation Engine (Story 3.6)
  OBSERVATION_GENERATED: 'Observations generated for review',
  OBSERVATION_REVIEWED: 'Observation marked as reviewed',
  OBSERVATION_RESOLVED: 'Observation resolved',
  OBSERVATION_PROMOTED: 'Observation promoted to exception for follow-up',
  OBSERVATION_ALREADY_REVIEWED: 'This observation has already been reviewed',
  OBSERVATION_REQUIRES_REVIEW: 'Observation must be reviewed before it can be resolved',
  OBSERVATION_NOT_FOUND: 'The requested observation could not be found',
  NO_APPROVAL_MATCH: 'No matching approval record found',
  BALANCE_BELOW_ZERO: 'Balance below zero',
  // Trace Report (Story 3.7)
  TRACE_REPORT_TITLE: 'Individual Loan Trace Report',
  TRACE_DATA_SOURCE: 'Generated from legacy data migration records',
  TRACE_NO_OBSERVATIONS: 'No observations — all records are clear',
  TRACE_DATA_GAP: 'No records available for this period',
  TRACE_INFERRED_LOAN: 'Loan inferred from available data — source records not available',
  TRACE_NOT_FOUND: 'No trace data found for this person.',
  // Delineation & Deduplication (Story 3.8)
  DELINEATION_DETECTED: 'Multiple MDAs detected in this file',
  DELINEATION_SINGLE_MDA: 'Single MDA file — no delineation needed',
  DELINEATION_CONFIRMED: 'MDA boundaries confirmed',
  DELINEATION_AMBIGUOUS: 'MDA boundary unclear — requires confirmation',
  DELINEATION_NOT_RUN: 'Delineation has not been run for this upload.',
  DELINEATION_ALREADY_CONFIRMED: 'Delineation boundaries have already been confirmed.',
  DUPLICATE_DETECTED: 'Potential duplicate found across parent and sub-agency files',
  DUPLICATE_RESOLVED: 'Duplicate resolved',
  DUPLICATE_MULTI_MDA: 'Confirmed as legitimate multi-MDA staff',
  DUPLICATE_REASSIGNED: 'Records reassigned to correct MDA',
  DUPLICATE_NOT_FOUND: 'The requested duplicate candidate could not be found.',
  DUPLICATE_ALREADY_RESOLVED: 'This duplicate has already been resolved.',
  // Submissions (Story 5.1)
  SUBMISSION_CONFIRMED: 'Submission confirmed and recorded',
  SUBMISSION_NEEDS_ATTENTION: 'Upload needs attention — please review the items below',
  SUBMISSION_DUPLICATE_ROW: 'Row {row}: Staff ID {staffId} already has a submission for {month}',
  SUBMISSION_AMOUNT_FORMAT: "Row {row}: Amount '{value}' is not a valid number",
  SUBMISSION_PERIOD_CLOSED: 'Submission period {period} is not currently open',
  SUBMISSION_EVENT_DATE_REQUIRED: 'Row {row}: Event Date is required when Event Flag is not NONE',
  SUBMISSION_CESSATION_REQUIRED: 'Row {row}: Cessation Reason is required when Amount is ₦0 and Event Flag is NONE',
  SUBMISSION_MDA_MISMATCH: "Row {row}: MDA Code '{code}' does not match your assigned MDA",
  SUBMISSION_STAFF_NOT_FOUND: "Row {row}: Staff ID '{staffId}' not found in your MDA",
  SUBMISSION_MONTH_FORMAT: "Row {row}: Month '{value}' is not a valid YYYY-MM format",
  SUBMISSION_FILE_TOO_LARGE: 'File exceeds the 5MB size limit',
  SUBMISSION_FILE_TYPE: 'Only CSV files are accepted',
  SUBMISSION_EMPTY_FILE: 'CSV file contains no data rows',
  // Manual Entry (Story 5.2)
  SUBMISSION_MANUAL_MAX_ROWS: 'Maximum of 50 rows reached',
  SUBMISSION_MANUAL_MIN_ROWS: 'At least one row is required',
  SUBMISSION_ITEMS_NEED_ATTENTION: '{count} items need your attention',
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
  // Variance Category Labels (Story 3.2)
  VARIANCE_CATEGORY_LABELS: {
    clean: 'Clean',
    minor_variance: 'Minor Variance',
    significant_variance: 'Significant Variance',
    structural_error: 'Rate Variance',
    anomalous: 'Requires Clarification',
  } as Record<string, string>,
  RATE_VARIANCE_DESCRIPTION: 'Rate differs from standard — for review',
  MULTI_MDA_BANNER: 'This file contains records for multiple MDAs — review recommended',
  // Observation UI (Story 3.6)
  OBSERVATION_EMPTY: 'No observations — all records are clear',
  OBSERVATION_CARD_ICON: 'info',
  // Delineation & Deduplication UI (Story 3.8)
  DELINEATION_EMPTY: 'No MDA boundaries detected — all records belong to the selected MDA',
  DUPLICATE_EMPTY: 'No duplicates found — all records are unique',
} as const;
