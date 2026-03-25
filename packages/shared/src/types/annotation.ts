import type { EventFlagType } from './submission.js';

export interface LoanAnnotation {
  id: string;
  loanId: string;
  content: string;
  createdBy: { userId: string; name: string };
  createdAt: string;
}

export interface AddAnnotationRequest {
  loanId: string;
  content: string;
}

export interface EventFlagCorrection {
  id: string;
  loanId: string;
  staffId: string;
  submissionRowId: string | null;
  originalEventFlag: EventFlagType;
  newEventFlag: EventFlagType;
  correctionReason: string;
  correctedBy: { userId: string; name: string };
  createdAt: string;
}

export interface CorrectEventFlagRequest {
  loanId: string;
  originalEventFlag: EventFlagType;
  newEventFlag: EventFlagType;
  correctionReason: string;
  submissionRowId?: string;
}

export interface EventFlagCorrectionResponse extends EventFlagCorrection {
  suggestCreateEvent?: boolean;
  suggestedEventType?: string;
}
