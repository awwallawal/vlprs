export interface DashboardMetrics {
  activeLoans: number;
  totalExposure: string;
  fundAvailable: string;
  monthlyRecovery: string;
  pendingEarlyExits: number;
  earlyExitRecoveryAmount: string;
  gratuityReceivableExposure: string;
  staffIdCoverage: { covered: number; total: number };
}

export interface AttentionItem {
  id: string;
  description: string;
  mdaName: string;
  category: 'review' | 'info' | 'complete';
  timestamp: string;
}
