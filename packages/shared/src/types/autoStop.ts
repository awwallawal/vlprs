// ─── Auto-Stop Certificates (Story 8.2 + 15.0i) ────────────────────

export type CertificateNotificationStatus = 'pending' | 'notified' | 'partial';

export type CertificateSortBy = 'generatedAt' | 'completionDate';

export interface CertificateListItem {
  certificateId: string;
  loanId: string;
  beneficiaryName: string;
  staffId: string;
  mdaId: string;
  mdaName: string;
  loanReference: string;
  completionDate: string;
  generatedAt: string;
  notifiedMdaAt: string | null;
  notifiedBeneficiaryAt: string | null;
  originalPrincipal: string;
  totalPaid: string;
}

export interface CertificateListResponse {
  data: CertificateListItem[];
  total: number;
  page: number;
  pageSize: number;
}
