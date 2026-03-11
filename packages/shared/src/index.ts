// Schemas (legacy from Story 1.1)
export { emailSchema } from './schemas/emailSchema.js';

// Validators
export { loginSchema, registerSchema, changePasswordSchema } from './validators/authSchemas.js';
export { createUserSchema, updateUserSchema, deactivateUserSchema, deleteUserSchema, changePasswordFormSchema } from './validators/userSchemas.js';
export { createLoanSchema, searchLoansQuerySchema, transitionLoanSchema, updateTemporalProfileSchema, createServiceExtensionSchema } from './validators/loanSchemas.js';
export { createLedgerEntrySchema, type CreateLedgerEntryInput } from './validators/ledgerSchemas.js';
export { mdaQuerySchema } from './validators/mdaSchemas.js';
export { migrationUploadQuerySchema, confirmMappingBodySchema, validationResultQuerySchema, personListQuerySchema, createBaselineBodySchema, beneficiaryQuerySchema, confirmDelineationSchema, resolveDuplicateSchema, duplicateListQuerySchema } from './validators/migrationSchemas.js';
export { observationQuerySchema, reviewObservationSchema, resolveObservationSchema, promoteObservationSchema, generateObservationsSchema } from './validators/observationSchemas.js';
export { serviceStatusVerificationQuerySchema } from './validators/reportSchemas.js';
export { dashboardMetricsSchema, attentionItemSchema, attentionItemsResponseSchema, drillDownMetricSchema, breakdownQuerySchema, type DashboardMetricsResponse, type AttentionItemsResponse, type BreakdownQuery } from './validators/dashboardSchemas.js';

// Types
export type { ApiResponse, ApiError, ApiResult } from './types/api.js';
export type { User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest, RefreshResponse, UserListItem, PaginatedResponse } from './types/auth.js';
export type { AuthenticatedUser, AuthorisedContext } from './types/rbac.js';
export type { DashboardMetrics, AttentionItem, AttentionItemType, LoanClassification, DrillDownMetric, HealthBand, StatusDistribution, MdaBreakdownRow, LoanFilterType } from './types/dashboard.js';
export type { SubmissionStatus, MigrationStage, Mda, MdaListItem, MdaAlias, MdaComplianceRow, MdaSummary, MigrationMdaStatus, MigrationDashboardMetrics, BeneficiaryListItem, BeneficiaryListMetrics, PaginatedBeneficiaries } from './types/mda.js';
export type { MigrationUploadStatus, CanonicalField, ColumnMappingSuggestion, SheetPreview, MigrationUploadPreview, MigrationUpload, MigrationRecord, MigrationExtraField, MigrationUploadSummary, MigrationUploadDetail, ConfirmedColumnMapping, VarianceCategory, ValidationSummary, MdaBoundary, ValidatedMigrationRecord, ValidationResultRecord, ValidationResult, MatchType, MatchStatus, PersonMatch, PersonListItem, PersonTimelineEntry, PersonTimeline, LoanCycle, PersonProfile, BaselineResult, BatchBaselineResult, BaselineSummary, DelineationConfidence, DelineationBoundaryRecord, DelineationSection, DelineationResult, DuplicateResolution, DuplicateMatchType, DuplicateCandidate } from './types/migration.js';
export type { LoanStatus, Loan, CreateLoanRequest, LoanSummary, LoanSearchResult, LoanDetail, LoanStateTransition, TransitionLoanRequest, TemporalProfile, TemporalCorrection, UpdateTemporalProfileRequest, ServiceExtension, CreateServiceExtensionRequest, GratuityProjectionResult } from './types/loan.js';
export type { SubmissionRecord } from './types/submission.js';
export type { ExceptionPriority, ExceptionCategory, ExceptionItem } from './types/exception.js';
export type { ObservationType, ObservationStatus, ObservationContext, SourceReference, Observation, ObservationListItem, ObservationCounts, PaginatedObservations, ExceptionRecord } from './types/observation.js';
export type { LedgerEntryType, LedgerEntry } from './types/ledger.js';
export type { ComputationParams, ScheduleRow, RepaymentSchedule, AutoSplitResult } from './types/computation.js';
export type { BalanceResult, LedgerEntryForBalance } from './types/balance.js';
export type { ServiceStatusVerificationRow, ServiceStatusVerificationSummary, ServiceStatusVerificationReport } from './types/report.js';
export type { TraceReportData, TraceLoanCycle, BalanceEntry, RateAnalysis, TraceReportMetadata, TraceReportSummary, DataCompletenessScore } from './types/traceReport.js';

// Constants
export { ROLES, ALL_ROLES, ROLE_HIERARCHY, getManageableRoles, canManageRole, type Role } from './constants/roles.js';
export { VOCABULARY, UI_COPY } from './constants/vocabulary.js';
export { PERMISSION_MATRIX, hasPermission } from './constants/permissions.js';
export { LOAN_TIERS, getTierForGradeLevel, type LoanTierConfig } from './constants/tiers.js';
export { VALID_TRANSITIONS, TERMINAL_STATUSES, isValidTransition } from './constants/loanTransitions.js';
