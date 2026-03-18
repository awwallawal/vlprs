export const EMPLOYMENT_EVENT_TYPES = [
  'RETIRED',
  'DECEASED',
  'SUSPENDED',
  'ABSCONDED',
  'TRANSFERRED_OUT',
  'TRANSFERRED_IN',
  'DISMISSED',
  'LWOP_START',
  'LWOP_END',
  'REINSTATED',
  'SERVICE_EXTENSION',
] as const;

export type EmploymentEventType = (typeof EMPLOYMENT_EVENT_TYPES)[number];

export const RECONCILIATION_STATUSES = [
  'UNCONFIRMED',
  'MATCHED',
  'DATE_DISCREPANCY',
] as const;

export type ReconciliationStatus = (typeof RECONCILIATION_STATUSES)[number];

export const TRANSFER_STATUSES = ['PENDING', 'COMPLETED'] as const;

export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

/** Event types that require a reference number. */
export const REFERENCE_REQUIRED_TYPES: EmploymentEventType[] = [
  'RETIRED',
  'TRANSFERRED_OUT',
  'DISMISSED',
  'REINSTATED',
  'SERVICE_EXTENSION',
];

/** Event types that allow future effective dates (up to 12 months). */
export const FUTURE_DATE_ALLOWED_TYPES: EmploymentEventType[] = [
  'RETIRED',
  'LWOP_START',
  'LWOP_END',
  'SERVICE_EXTENSION',
  'TRANSFERRED_OUT',
  'TRANSFERRED_IN',
];

export interface EmploymentEvent {
  id: string;
  staffId: string;
  loanId: string | null;
  mdaId: string;
  eventType: EmploymentEventType;
  effectiveDate: string;
  referenceNumber: string | null;
  notes: string | null;
  newRetirementDate: string | null;
  reconciliationStatus: ReconciliationStatus;
  filedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferRecord {
  id: string;
  staffId: string;
  loanId: string;
  outgoingMdaId: string;
  incomingMdaId: string | null;
  outgoingEventId: string | null;
  incomingEventId: string | null;
  outgoingConfirmed: boolean;
  incomingConfirmed: boolean;
  confirmedBy: string | null;
  status: TransferStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StaffLookupResult {
  staffId: string;
  staffName: string;
  mdaName: string;
  loanStatus: string;
}

export interface TransferSearchResult {
  staffId: string;
  staffName: string;
  mdaName: string;
  transferStatus?: string;
}

export interface CreateEmploymentEventRequest {
  staffId: string;
  eventType: EmploymentEventType;
  effectiveDate: string;
  referenceNumber?: string;
  notes?: string;
  newRetirementDate?: string;
  confirmDuplicate?: boolean;
}

export interface CreateEmploymentEventResponse {
  id: string;
  staffId: string;
  staffName: string;
  eventType: EmploymentEventType;
  effectiveDate: string;
  newLoanStatus: string;
  reconciliationStatus: ReconciliationStatus;
}

export interface ConfirmTransferRequest {
  transferId: string;
  side: 'outgoing' | 'incoming';
}

export interface ConfirmTransferResponse {
  transferId: string;
  outgoingConfirmed: boolean;
  incomingConfirmed: boolean;
  status: TransferStatus;
  loanStatus?: string;
}

export interface ClaimTransferRequest {
  staffId: string;
}

export interface EmploymentEventListItem {
  id: string;
  eventType: EmploymentEventType;
  staffName: string;
  staffId: string;
  effectiveDate: string;
  reconciliationStatus: ReconciliationStatus;
  filedByName: string;
  createdAt: string;
}
