import { CheckCircle2 } from 'lucide-react';
import { formatDate, formatCount } from '@/lib/formatters';
import { VOCABULARY } from '@vlprs/shared';
import type { SubmissionUploadResponse } from '@vlprs/shared';

interface SubmissionConfirmationProps {
  data: SubmissionUploadResponse;
}

export function SubmissionConfirmation({ data }: SubmissionConfirmationProps) {
  return (
    <div className="rounded-lg border border-teal/30 bg-teal-50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <CheckCircle2 className="h-6 w-6 text-teal" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-text-primary">
          {VOCABULARY.SUBMISSION_CONFIRMED}
        </h3>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-text-secondary">Reference Number</dt>
          <dd className="font-mono font-medium text-text-primary">{data.referenceNumber}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Submission Date</dt>
          <dd className="text-text-primary">{formatDate(data.submissionDate)}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Records</dt>
          <dd className="text-text-primary">{formatCount(data.recordCount)}</dd>
        </div>
        <div>
          <dt className="text-text-secondary">Status</dt>
          <dd className="text-teal font-medium capitalize">{data.status}</dd>
        </div>
      </dl>
    </div>
  );
}
