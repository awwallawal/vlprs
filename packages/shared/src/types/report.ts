export interface ServiceStatusVerificationRow {
  loanId: string;
  staffName: string;
  staffId: string | null;
  mdaName: string;
  mdaId: string;
  loanReference: string;
  computedRetirementDate: string;
  monthsPastRetirement: number;
  outstandingBalance: string;
  hasExpiredExtension: boolean;
  expiredExtensionReference: string | null;
  availableActions: string[];
}

export interface ServiceStatusVerificationSummary {
  totalFlagged: number;
  totalOutstandingExposure: string;
  totalWithExpiredExtensions: number;
  totalWithoutExtensions: number;
  mdaBreakdown: Array<{ mdaName: string; mdaId: string; count: number; outstandingExposure: string }>;
  message: string | null;
}

export interface ServiceStatusVerificationReport {
  data: ServiceStatusVerificationRow[];
  summary: ServiceStatusVerificationSummary;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
