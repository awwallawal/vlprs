import type { ObservationType } from '../types/observation.js';
import type { AttentionItemType, DrillDownMetric } from '../types/dashboard.js';

// ─── MetricDefinition Interface ─────────────────────────────────────

export interface MetricDefinition {
  label: string;
  description: string;
  derivedFrom: string;
  guidance?: string;
}

// ─── Layer 1: Exhaustive-Typed Sections (compile-time enforced) ─────
// Adding a new value to the union type WITHOUT adding a glossary entry
// causes a TypeScript compilation error. This is the primary enforcement.

/**
 * Every ObservationType MUST have a glossary entry here.
 * Adding a new observation type without a matching entry = build failure.
 */
export const OBSERVATION_HELP: Record<ObservationType, MetricDefinition> = {
  rate_variance: {
    label: 'Rate Variance',
    description: 'The loan\'s recorded interest rate differs from the standard scheme rate.',
    derivedFrom: 'Comparison of loan terms against the scheme\'s standard 13.33% rate.',
    guidance: 'Verify against original loan approval documentation.',
  },
  stalled_balance: {
    label: 'Stalled Balance',
    description: 'The outstanding balance has not changed for 2+ consecutive months despite the loan being active.',
    derivedFrom: 'Month-over-month comparison of computed outstanding balances from ledger entries.',
    guidance: 'Check whether deductions are being recorded. May indicate a payroll processing gap.',
  },
  negative_balance: {
    label: 'Negative Balance',
    description: 'The computed outstanding balance has gone below zero, suggesting over-deduction.',
    derivedFrom: 'Running balance computation from ledger entries against original loan amount.',
    guidance: 'Review deduction history — the borrower may be owed a refund.',
  },
  multi_mda: {
    label: 'Multi-MDA',
    description: 'The same staff name appears in records from more than one MDA.',
    derivedFrom: 'Cross-MDA name matching across migration records.',
    guidance: 'Investigate whether this is the same individual or a name coincidence.',
  },
  no_approval_match: {
    label: 'No Approval Match',
    description: 'No matching loan approval record was found for this deduction record.',
    derivedFrom: 'Comparison of deduction records against the loan approval register.',
    guidance: 'Locate the original approval documentation or verify the staff identity.',
  },
  consecutive_loan: {
    label: 'Consecutive Loan',
    description: 'A new loan was initiated while a previous loan for the same borrower was still active.',
    derivedFrom: 'Timeline analysis of loan start dates and outstanding balances per borrower.',
    guidance: 'Verify whether the previous loan was settled before the new one began.',
  },
  period_overlap: {
    label: 'Period Overlap',
    description: 'Two uploads cover the same reporting period for the same MDA, creating potential duplicate records.',
    derivedFrom: 'Comparison of upload date ranges within the same MDA.',
    guidance: 'Review which upload is authoritative and consider superseding the older one.',
  },
  grade_tier_mismatch: {
    label: 'Grade–Tier Mismatch',
    description: 'The staff member\'s grade level does not match the expected loan tier for their deduction amount.',
    derivedFrom: 'Comparison of recorded grade level against the scheme\'s tier configuration.',
    guidance: 'Verify the staff member\'s current grade level with HR records.',
  },
  three_way_variance: {
    label: 'Three-Way Variance',
    description: 'The expected, declared, and actual deduction amounts do not agree across all three data sources.',
    derivedFrom: 'Comparison of payroll extract, MDA submission, and ledger records for the same period.',
    guidance: 'Review the three-way reconciliation detail and verify with the relevant department.',
  },
  manual_exception: {
    label: 'Manual Exception',
    description: 'An administrator manually flagged this record for review.',
    derivedFrom: 'Manual entry by an authorised user — no automated analysis performed.',
    guidance: 'Review the flag reason and take action as described.',
  },
  inactive_loan: {
    label: 'Inactive Loan',
    description: 'No deduction has been recorded for 60+ consecutive days on an active loan.',
    derivedFrom: 'Gap between today and the most recent ledger entry, filtered for employment events that explain the gap.',
    guidance: 'Review loan status and contact the MDA for clarification on deduction status.',
  },
  post_completion_deduction: {
    label: 'Post-Completion Deduction',
    description: 'A deduction was declared for a staff member whose loan has already been fully repaid.',
    derivedFrom: 'Cross-reference of submission rows against loans with COMPLETED status.',
    guidance: 'Notify the MDA to cease deductions immediately. Issue Auto-Stop Certificate if not already generated.',
  },
  within_file_duplicate: {
    label: 'Within-File Duplicate',
    description: 'The same staff member appears more than once in the same upload for the same reporting period.',
    derivedFrom: 'Grouping of migration records by normalised staff name and period within a single upload.',
    guidance: 'Review the affected entries to determine if records should be merged, one removed, or if they represent distinct individuals with similar names.',
  },
};

/**
 * Every AttentionItemType MUST have a glossary entry here.
 * Adding a new attention item type without a matching entry = build failure.
 */
export const ATTENTION_HELP: Record<AttentionItemType, MetricDefinition> = {
  zero_deduction: {
    label: 'Zero Deduction',
    description: 'Active loans where no deduction has been recorded for 60+ days.',
    derivedFrom: 'Comparison of last ledger entry date against today, excluding loans with active employment events.',
    guidance: 'Contact the MDA to confirm whether payroll deductions are still in place.',
  },
  post_retirement_active: {
    label: 'Post-Retirement Active',
    description: 'Loans that remain active beyond the borrower\'s computed retirement date.',
    derivedFrom: 'Comparison of loan status against the borrower\'s retirement date from their temporal profile.',
    guidance: 'Verify retirement status and determine whether gratuity recovery applies.',
  },
  missing_staff_id: {
    label: 'Missing Staff ID',
    description: 'Loan records that lack a Staff ID, limiting cross-reference capability.',
    derivedFrom: 'Scan of loan master records for null or empty staff_id fields.',
    guidance: 'Request Staff IDs from the relevant MDA during next submission cycle.',
  },
  overdue_loans: {
    label: 'Overdue Loans',
    description: 'Loans that have passed their expected completion date but still have an outstanding balance.',
    derivedFrom: 'Comparison of expected completion date (start + tenure) against today with remaining balance check.',
    guidance: 'Review whether additional deductions are expected or if recovery action is needed.',
  },
  stalled_deductions: {
    label: 'Stalled Deductions',
    description: 'Active loans where the outstanding balance has not changed for 2+ consecutive months.',
    derivedFrom: 'Month-over-month balance comparison from ledger entries.',
    guidance: 'Investigate whether deductions are being processed but not recorded.',
  },
  quick_win: {
    label: 'Quick Win',
    description: 'Loans with 3 or fewer installments remaining — close to completion.',
    derivedFrom: 'Remaining balance divided by monthly deduction amount.',
    guidance: 'Monitor to ensure final deductions are processed for timely loan completion.',
  },
  submission_variance: {
    label: 'Submission Variance',
    description: 'The MDA\'s submitted figures differ from the expected amounts based on loan records.',
    derivedFrom: 'Comparison of MDA monthly submission against computed expected deductions.',
    guidance: 'Review the comparison summary and reconcile with the MDA.',
  },
  overdue_submission: {
    label: 'Overdue Submission',
    description: 'An MDA has not submitted their monthly return by the expected deadline.',
    derivedFrom: 'Submission deadline tracking against MDA submission records.',
    guidance: 'Send a reminder to the MDA contact and escalate if past the grace period.',
  },
  pending_auto_stop: {
    label: 'Pending Auto-Stop',
    description: 'Loans that have reached zero balance and are awaiting auto-stop certificate generation.',
    derivedFrom: 'Balance computation showing zero or negative remaining amount.',
    guidance: 'Process the auto-stop certificate to formally close the loan.',
  },
  pending_early_exit: {
    label: 'Pending Early Exit',
    description: 'Borrowers who have requested early loan settlement, pending commitment payment.',
    derivedFrom: 'Early exit requests with pending status in the system.',
    guidance: 'Process the commitment payment computation and notify the borrower.',
  },
  dark_mda: {
    label: 'Dark MDA',
    description: 'An MDA with active loans that has never submitted a monthly return.',
    derivedFrom: 'Cross-reference of MDAs with active loans against submission history.',
    guidance: 'Initiate onboarding outreach to establish the submission workflow.',
  },
  onboarding_lag: {
    label: 'Onboarding Lag',
    description: 'An MDA that was recently onboarded but has not yet submitted their first return.',
    derivedFrom: 'Time elapsed since MDA registration without any submission activity.',
    guidance: 'Follow up with the MDA administrator to assist with their first submission.',
  },
  post_completion_deduction: {
    label: 'Post-Completion Deduction',
    description: 'Staff members with completed loans who still have deductions declared in recent MDA submissions.',
    derivedFrom: 'Cross-reference of submission rows against loans with COMPLETED status.',
    guidance: 'Notify the affected MDAs to cease deductions and verify auto-stop certificates have been issued.',
  },
};

/**
 * Every DrillDownMetric MUST have a glossary entry here.
 * Adding a new drill-down metric without a matching entry = build failure.
 */
export const DASHBOARD_HELP: Record<DrillDownMetric, MetricDefinition> = {
  activeLoans: {
    label: 'Active Loans',
    description: 'Loans in active repayment (ON_TRACK, OVERDUE, STALLED). Excludes COMPLETED loans.',
    derivedFrom: 'Count of loans with classification ON_TRACK, OVERDUE, or STALLED in the loan master table.',
    guidance: 'Differs from Loans in Window, which includes all loans with activity in the last 60 months regardless of current status (including COMPLETED). Seeing a smaller number here than in Loans in Window is expected.',
  },
  totalExposure: {
    label: 'Total Exposure',
    description: 'The combined outstanding balance across all active loans — includes both principal and accrued interest.',
    derivedFrom: 'Sum of computed outstanding balances for all active loans.',
    guidance: 'This represents the scheme\'s total receivable position at this point in time.',
  },
  fundAvailable: {
    label: 'Fund Available',
    description: 'The total scheme fund amount configured by the Accountant General, representing funds allocated for loan disbursement.',
    derivedFrom: 'Manually entered by the AG via the Scheme Fund configuration screen.',
    guidance: 'Shows "Awaiting Configuration" until the AG enters the fund total.',
  },
  monthlyRecovery: {
    label: 'Monthly Recovery',
    description: 'The total amount actually recovered through payroll deductions in the most recent reporting period.',
    derivedFrom: 'Sum of ledger entries for the most recent completed month.',
  },
  loansInWindow: {
    label: 'Loans in Window',
    description: 'All loans that fall within the rolling 60-month analysis window, regardless of their current status.',
    derivedFrom: 'Count of loans with activity within the last 60 months.',
  },
  outstandingReceivables: {
    label: 'Outstanding Receivables',
    description: 'Total amount still owed across active, overdue, and stalled loans.',
    derivedFrom: 'Sum of outstanding balances for loans in active, overdue, or stalled status.',
    guidance: 'Differs from Total Exposure by including overdue and stalled loans, not just active ones.',
  },
  collectionPotential: {
    label: 'Collection Potential',
    description: 'The expected monthly recovery if all active loans are deducted as scheduled.',
    derivedFrom: 'Sum of monthly deduction amounts for all active loans.',
    guidance: 'Compare against Monthly Recovery to gauge collection effectiveness.',
  },
  atRisk: {
    label: 'At-Risk Amount',
    description: 'Outstanding balance on loans classified as overdue or stalled, indicating recovery uncertainty.',
    derivedFrom: 'Sum of outstanding balances for loans with overdue or stalled status.',
    guidance: 'High at-risk amounts may warrant escalation or focused recovery efforts.',
  },
  completionRate: {
    label: 'Completion Rate (60m)',
    description: 'Percentage of loans that reached full repayment within the rolling 60-month window.',
    derivedFrom: 'Completed loans divided by total loans in the 60-month window.',
    guidance: 'Reflects recent scheme performance — compare with lifetime rate for trend.',
  },
  completionRateLifetime: {
    label: 'Completion Rate (All-Time)',
    description: 'Percentage of all loans ever disbursed that have been fully repaid.',
    derivedFrom: 'All-time completed loans divided by all-time total loans.',
    guidance: 'Provides historical context — lower than 60m rate suggests improving trend.',
  },
};

// ─── Layer 2: Plain Object Sections (review-time enforced) ──────────
// No backing union type exists for these — enforced via code review checklist.

export const EXCEPTION_HELP: Record<string, MetricDefinition> = {
  priorityHigh: {
    label: 'High Priority',
    description: 'Requires action within 48 hours. Typically involves financial exposure or compliance concerns.',
    derivedFrom: 'Priority assignment based on exception category and amount thresholds.',
    guidance: 'Address these first — they represent the highest operational risk.',
  },
  priorityMedium: {
    label: 'Medium Priority',
    description: 'Requires action within one week. Often involves data quality or process gaps.',
    derivedFrom: 'Priority assignment based on exception category and amount thresholds.',
    guidance: 'Schedule review during regular operations cycle.',
  },
  priorityLow: {
    label: 'Low Priority',
    description: 'Informational or minor — review at next convenient opportunity.',
    derivedFrom: 'Priority assignment based on exception category and amount thresholds.',
  },
  categoryExplanation: {
    label: 'Exception Category',
    description: 'Groups exceptions by root cause to help prioritise batch review.',
    derivedFrom: 'Automated categorisation based on observation type or manual classification.',
  },
};

export const RECONCILIATION_HELP: Record<string, MetricDefinition> = {
  matchRate: {
    label: 'Match Rate',
    description: 'Percentage of records where the expected, declared, and actual amounts agree across all three sources.',
    derivedFrom: 'Three-way comparison of payroll extract, MDA submission, and ledger records.',
    guidance: 'A rate below 80% suggests systemic data quality issues worth investigating.',
  },
  fullVariance: {
    label: 'Full Variance',
    description: 'Records where all three sources disagree — no two match.',
    derivedFrom: 'Three-way comparison where expected, declared, and actual all differ.',
    guidance: 'Start investigation with full variances, as they indicate the largest data gaps.',
  },
  daysDifference: {
    label: 'Days Difference',
    description: 'The number of calendar days between two dates being compared (e.g., submission date vs expected date).',
    derivedFrom: 'Calendar day calculation between the two reference dates.',
  },
};

export const MIGRATION_HELP: Record<string, MetricDefinition> = {
  coverage: {
    label: 'Coverage',
    description: 'Percentage of known MDA × period combinations that have been migrated into the system.',
    derivedFrom: 'Count of migrated MDA-period pairs divided by total expected pairs.',
    guidance: 'Gaps in coverage may indicate missing legacy files.',
  },
  stageProgress: {
    label: 'Stage Progress',
    description: 'Current position in the 6-stage migration pipeline: Upload → Map → Validate → Baseline → Review → Complete.',
    derivedFrom: 'Tracking of each upload through the migration workflow stages.',
  },
  qualityBandClean: {
    label: 'Clean',
    description: 'Records that passed all validation checks with no observations.',
    derivedFrom: 'Validation engine output — zero observations generated.',
  },
  qualityBandMinor: {
    label: 'Minor',
    description: 'Records with minor observations that do not block processing.',
    derivedFrom: 'Validation engine output — observations present but all low severity.',
  },
  qualityBandSignificant: {
    label: 'Significant',
    description: 'Records with notable observations that warrant review before finalisation.',
    derivedFrom: 'Validation engine output — medium severity observations present.',
    guidance: 'Review these records to determine if corrections are needed.',
  },
  qualityBandStructural: {
    label: 'Structural',
    description: 'Records with fundamental data issues that require correction before they can be baselined.',
    derivedFrom: 'Validation engine output — high severity observations or missing required fields.',
    guidance: 'These records cannot proceed until the underlying data issues are resolved.',
  },
  schemeExpected: {
    label: 'Scheme Expected',
    description: 'Values computed using the authoritative scheme formula: Monthly Interest = (Principal × 13.33%) ÷ 60, regardless of tenure.',
    derivedFrom: 'Authoritative scheme formula applied to the principal and detected tenure.',
  },
  reverseEngineered: {
    label: 'Reverse Engineered',
    description: 'Values computed by detecting the rate from declared Principal and Total Loan, then applying standard computation.',
    derivedFrom: 'Effective Rate = ((Total Loan − Principal) ÷ Principal) × 100, applied to repayment schedule engine.',
  },
  mdaDeclared: {
    label: 'MDA Declared',
    description: 'Raw values as submitted by the MDA in the legacy Excel file, without any system computation.',
    derivedFrom: 'Direct extraction from the uploaded spreadsheet.',
  },
  varianceCategory: {
    label: 'Variance Category',
    description: 'Classification of the record\'s overall data quality based on the magnitude and nature of differences between declared and expected values.',
    derivedFrom: 'Largest absolute difference between the scheme expected and MDA declared values for total loan, monthly deduction, and total interest.',
    guidance: 'Clean records can be baselined immediately. Records with variance should be reviewed before baseline acceptance.',
  },
  reviewWindow: {
    label: 'Review Window',
    description: 'Each MDA has a 14-day window (from the flagging date) to review records flagged during selective batch baseline. MDA officers correct values or confirm them as correct.',
    derivedFrom: 'flagged_for_review_at + 14 days. Countdown starts from the moment DEPT_ADMIN runs batch baseline.',
    guidance: 'If the window expires, DEPT_ADMIN can extend it, correct records directly, or follow up offline.',
  },
  reviewProgress: {
    label: 'Review Progress',
    description: 'Baselined records vs total flagged records for this MDA. The numerator is the count of flagged records that have reached baseline state; the denominator is the total flagged records.',
    derivedFrom: 'Count of flagged records with is_baseline_created = true divided by total flagged records per MDA.',
    guidance: 'A ratio like "4 of 6" means 4 out of 6 flagged records for this MDA have been baselined.',
  },
  totalStaffMigrated: {
    label: 'Total Staff Migrated',
    description: 'Count of unique staff members whose records have been migrated into the system.',
    derivedFrom: 'Distinct count of staff identifiers across all active migration records.',
    guidance: 'May differ from Baselines Established if staff members have more than one loan — each loan produces its own baseline record.',
  },
  baselinesEstablished: {
    label: 'Baselines Established',
    description: 'Count of individual baseline records created (one per staff-loan combination).',
    derivedFrom: 'Count of migration records flagged is_baseline_created = true.',
    guidance: 'For example, 92 unique staff may produce 171 baselines if some staff have multiple loans.',
  },
  supersedeUnchanged: {
    label: 'Unchanged',
    description: 'Records present in both the old and new uploads with identical values across all compared fields.',
    derivedFrom: 'Matched by normalized staff name + employee number; all financial fields equal.',
  },
  supersedeModified: {
    label: 'Modified',
    description: 'Records present in both uploads but with at least one field value changed between them.',
    derivedFrom: 'Matched by normalized staff name + employee number; one or more financial fields differ.',
    guidance: 'Expand to see field-level diffs showing the old and new values.',
  },
  supersedeNew: {
    label: 'New',
    description: 'Records present in the replacement upload but not found in the older upload being superseded.',
    derivedFrom: 'Staff name + employee number combination exists in the new upload but has no match in the old.',
  },
  supersedeRemoved: {
    label: 'Removed',
    description: 'Records present in the older upload but not found in the replacement. These records will no longer appear in active data after supersession.',
    derivedFrom: 'Staff name + employee number combination exists in the old upload but has no match in the new.',
  },
};

export const LOAN_HELP: Record<string, MetricDefinition> = {
  outstandingBalance: {
    label: 'Outstanding Balance',
    description: 'The remaining amount owed on this loan, computed from the original loan amount minus all recorded deductions plus accrued interest.',
    derivedFrom: 'Historical reconstruction of ledger entries using the scheme\'s standard computation model (13.33% ÷ 60).',
    guidance: 'This is a computed figure — it reflects what the system knows from recorded deductions.',
  },
  gradeLevelTier: {
    label: 'Grade Level Tier',
    description: 'The loan tier determined by the borrower\'s grade level, which sets maximum loan amount and tenure.',
    derivedFrom: 'Mapping of staff grade level to the scheme\'s tier configuration table.',
  },
};

export const SYSTEM_HEALTH_HELP: Record<string, MetricDefinition> = {
  healthMetric: {
    label: 'System Health',
    description: 'Operational health indicators for infrastructure, API performance, data integrity, and business process health.',
    derivedFrom: 'Real-time monitoring of system metrics, refreshed every 30 seconds.',
    guidance: 'Green indicates normal operation. Amber warrants monitoring. Red requires investigation.',
  },
};

// ─── Unified Lookup ─────────────────────────────────────────────────
// Flat namespace for the frontend <MetricHelp> component.
// Keys use "section.key" format for disambiguation.

function prefixKeys<T extends Record<string, MetricDefinition>>(
  prefix: string,
  obj: T,
): Record<string, MetricDefinition> {
  const result: Record<string, MetricDefinition> = {};
  for (const key of Object.keys(obj)) {
    result[`${prefix}.${key}`] = obj[key as keyof T];
  }
  return result;
}

export const METRIC_GLOSSARY: Record<string, MetricDefinition> = {
  ...prefixKeys('observation', OBSERVATION_HELP),
  'observation.dataCompleteness': {
    label: 'Data Completeness',
    description: 'Percentage of data sources available for this analysis. Higher values indicate more complete information.',
    derivedFrom: 'Count of available data sources relative to total possible sources for this observation type.',
  },
  ...prefixKeys('attention', ATTENTION_HELP),
  ...prefixKeys('dashboard', DASHBOARD_HELP),
  ...prefixKeys('exception', EXCEPTION_HELP),
  ...prefixKeys('reconciliation', RECONCILIATION_HELP),
  ...prefixKeys('migration', MIGRATION_HELP),
  ...prefixKeys('loan', LOAN_HELP),
  ...prefixKeys('systemHealth', SYSTEM_HEALTH_HELP),
};
