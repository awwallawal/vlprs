import type { ObservationListItem } from './observation.js';

// ─── Trace Report Types (Story 3.7) ────────────────────────────────

export interface BalanceEntry {
  period: string;                    // "YYYY-MM"
  balance: string;                   // decimal string
  deduction: string;
  installmentsPaid: number;
  installmentsRemaining: number | null;
  sourceFile: string;
  isGap?: boolean;                   // true = no data for this month
  isStalled?: boolean;               // true = balance unchanged from prior month
  isNewLoan?: boolean;               // true = new principal detected
}

export interface TraceLoanCycle {
  cycleNumber: number;
  mdaCode: string;
  mdaName: string;
  startPeriod: string;               // "YYYY-MM"
  endPeriod: string | null;          // null = still active
  principal: string;                 // decimal string
  totalLoan: string;
  interestAmount: string;
  effectiveRate: string;
  monthlyDeduction: string;
  installments: number;
  monthsOfData: number;              // actual records found
  gapMonths: number;                 // months with no data within cycle
  status: 'active' | 'liquidated' | 'cleared' | 'inferred';
  balanceTrajectory: BalanceEntry[];
}

export interface RateAnalysis {
  principal: string;
  actualTotalLoan: string;
  actualInterest: string;
  apparentRate: string;
  standardTest: {                    // Test A: 13.33% at 60 months
    expectedInterest: string;
    match: boolean;
  };
  acceleratedTest?: {               // Test B: 13.33% at shorter tenure
    tenure: number;
    expectedInterest: string;
    match: boolean;
  };
  conclusion: string;               // Non-punitive explanation
}

export interface TraceReportMetadata {
  referenceNumber: string;           // VLPRS-TRACE-{YYYY}-{seq}
  generatedAt: string;               // ISO timestamp
  generatedBy: { name: string; role: string };
  dataSourceNote: string;
  dataFreshness: string;
}

export interface TraceReportSummary {
  staffName: string;
  staffId: string | null;
  mdas: { name: string; code: string }[];
  totalLoanCycles: number;
  totalMonthsOfRecords: number;
  dateRange: { from: string; to: string }; // "YYYY-MM" format
  currentStatus: string;
}

export interface DataCompletenessScore {
  overallPercent: number;
  perCycle: { cycleNumber: number; percent: number }[];
}

export interface TraceReportData {
  metadata: TraceReportMetadata;
  summary: TraceReportSummary;
  beneficiaryProfile: {
    fullName: string;
    staffId: string | null;
    currentMda: { name: string; code: string };
    previousMdas: { name: string; code: string; lastSeen: string }[];
    approvalListEntries: { listName: string; serialNumber?: string; gradeLevel?: string; amount?: string }[];
  };
  loanCycles: TraceLoanCycle[];
  rateAnalyses: RateAnalysis[];
  observations: ObservationListItem[];
  crossMdaTimeline: { mdaCode: string; mdaName: string; firstSeen: string; lastSeen: string }[];
  dataCompleteness: DataCompletenessScore;
}
