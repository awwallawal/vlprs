// Story 7.0i — Three-Way Reconciliation Engine types

export type ThreeWayMatchStatus =
  | 'full_match'
  | 'partial_match'
  | 'full_variance'
  | 'expected_unknown'; // limitedComputation loans where expected = null

export type ThreeWayVarianceCategory =
  | 'ghost_deduction'
  | 'unreported_deduction'
  | 'amount_mismatch'
  | 'staff_not_in_payroll';

export interface ThreeWayReconciliationRow {
  staffId: string;
  staffName: string;
  expectedAmount: string | null; // null when limitedComputation
  declaredAmount: string;
  actualAmount: string;
  matchStatus: ThreeWayMatchStatus;
  varianceCategory?: ThreeWayVarianceCategory;
  varianceAmount?: string;
  variancePercentage?: string;
}

export interface ThreeWayReconciliationSummary {
  period: string;
  mdaId: string;
  mdaName: string;
  totalStaffCompared: number;
  fullMatchCount: number;
  fullMatchPercent: string;
  partialMatchCount: number;
  fullVarianceCount: number;
  aggregateDeclared: string;
  aggregateActual: string;
  reconciliationHealth: string; // percentage of full matches
  rows: ThreeWayReconciliationRow[];
  pendingState?: string;
}

export interface ThreeWayDashboardMetrics {
  overallMatchRate: string;
  fullVarianceCount: number;
  topVarianceMdas: Array<{ mdaName: string; varianceCount: number }>;
}
