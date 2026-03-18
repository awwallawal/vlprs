// Schemas (legacy from Story 1.1)
export { emailSchema } from './schemas/emailSchema.js';

// Validators
export { loginSchema, registerSchema, changePasswordSchema } from './validators/authSchemas.js';
export { createUserSchema, updateUserSchema, deactivateUserSchema, deleteUserSchema, changePasswordFormSchema } from './validators/userSchemas.js';
export { createLoanSchema, searchLoansQuerySchema, transitionLoanSchema, updateTemporalProfileSchema, createServiceExtensionSchema } from './validators/loanSchemas.js';
export { createLedgerEntrySchema, type CreateLedgerEntryInput } from './validators/ledgerSchemas.js';
export { mdaQuerySchema } from './validators/mdaSchemas.js';
export { migrationUploadQuerySchema, confirmMappingBodySchema, validationResultQuerySchema, personListQuerySchema, createBaselineBodySchema, beneficiaryQuerySchema, coverageQuerySchema, confirmDelineationSchema, resolveDuplicateSchema, duplicateListQuerySchema } from './validators/migrationSchemas.js';
export { observationQuerySchema, reviewObservationSchema, resolveObservationSchema, promoteObservationSchema, generateObservationsSchema } from './validators/observationSchemas.js';
export { serviceStatusVerificationQuerySchema } from './validators/reportSchemas.js';
export { submissionRowSchema, submissionUploadQuerySchema, submissionListQuerySchema, manualSubmissionBodySchema, comparisonRowSchema, comparisonSummarySchema, submissionComparisonResponseSchema, EVENT_FLAG_VALUES, type ManualSubmissionBody } from './validators/submissionSchemas.js';
export { preSubmissionCheckpointSchema, retirementItemSchema, zeroDeductionItemSchema, pendingEventItemSchema, checkpointConfirmationSchema } from './validators/preSubmissionSchemas.js';
export { dashboardMetricsSchema, attentionItemSchema, attentionItemsResponseSchema, drillDownMetricSchema, breakdownQuerySchema, complianceResponseSchema, schemeFundBodySchema, type DashboardMetricsResponse, type AttentionItemsResponse, type BreakdownQuery, type ComplianceResponse, type SchemeFundBody } from './validators/dashboardSchemas.js';
export { createEmploymentEventSchema, staffLookupQuerySchema, transferSearchQuerySchema, confirmTransferSchema, claimTransferSchema, employmentEventListQuerySchema } from './validators/employmentEventSchemas.js';
export { reconciliationCountsSchema, reconciliationDetailSchema, reconciliationSummarySchema, resolveDiscrepancySchema } from './validators/reconciliationSchemas.js';

// Types
export type { ApiResponse, ApiError, ApiResult } from './types/api.js';
export type { User, JwtPayload, LoginRequest, LoginResponse, RegisterRequest, RefreshResponse, UserListItem, PaginatedResponse } from './types/auth.js';
export type { AuthenticatedUser, AuthorisedContext } from './types/rbac.js';
export type { DashboardMetrics, AttentionItem, AttentionItemType, LoanClassification, DrillDownMetric, HealthBand, StatusDistribution, MdaBreakdownRow, LoanFilterType } from './types/dashboard.js';
export type { SubmissionStatus, MigrationStage, Mda, MdaListItem, MdaAlias, MdaComplianceRow, HeatmapCell, MdaHeatmapRow, MdaSummary, MigrationMdaStatus, MigrationDashboardMetrics, CoveragePeriodData, CoverageMdaRow, CoverageMatrix, BeneficiaryListItem, BeneficiaryListMetrics, PaginatedBeneficiaries } from './types/mda.js';
export type { MigrationUploadStatus, CanonicalField, ColumnMappingSuggestion, SheetPreview, MigrationUploadPreview, MigrationUpload, MigrationRecord, MigrationExtraField, MigrationUploadSummary, MigrationUploadDetail, ConfirmedColumnMapping, VarianceCategory, ValidationSummary, MdaBoundary, ValidatedMigrationRecord, ValidationResultRecord, ValidationResult, MatchType, MatchStatus, PersonMatch, PersonListItem, PersonTimelineEntry, PersonTimeline, LoanCycle, PersonProfile, BaselineResult, BatchBaselineResult, BaselineSummary, DelineationConfidence, DelineationBoundaryRecord, DelineationSection, DelineationResult, DuplicateResolution, DuplicateMatchType, DuplicateCandidate } from './types/migration.js';
export type { LoanStatus, Loan, CreateLoanRequest, LoanSummary, LoanSearchResult, LoanDetail, LoanStateTransition, TransitionLoanRequest, TemporalProfile, TemporalCorrection, UpdateTemporalProfileRequest, ServiceExtension, CreateServiceExtensionRequest, GratuityProjectionResult } from './types/loan.js';
export type { SubmissionRecord, SubmissionRow, SubmissionUploadResponse, SubmissionDetail, SubmissionValidationError, EventFlagType, SubmissionRecordStatus, ComparisonCategory, ComparisonRow, ComparisonSummary, SubmissionComparisonResponse } from './types/submission.js';
export type { PreSubmissionCheckpoint, RetirementItem, ZeroDeductionItem, PendingEventItem } from './types/preSubmission.js';
export { EMPLOYMENT_EVENT_TYPES, RECONCILIATION_STATUSES, TRANSFER_STATUSES, REFERENCE_REQUIRED_TYPES, FUTURE_DATE_ALLOWED_TYPES } from './types/employmentEvent.js';
export type { EmploymentEventType, ReconciliationStatus, TransferStatus, EmploymentEvent, TransferRecord, StaffLookupResult, TransferSearchResult, CreateEmploymentEventRequest, CreateEmploymentEventResponse, ConfirmTransferRequest, ConfirmTransferResponse, ClaimTransferRequest, EmploymentEventListItem } from './types/employmentEvent.js';
export type { ReconciliationOutcome, ReconciliationDetail, ReconciliationCounts, ReconciliationSummary, EventTypeMapping, ResolveDiscrepancyRequest } from './types/reconciliation.js';
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
export { EVENT_FLAG_TO_EMPLOYMENT_EVENT_MAP } from './constants/eventTypeMapping.js';
