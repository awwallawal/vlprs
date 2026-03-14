import { CheckCircle2, Copy, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { formatDateTime } from '@/lib/formatters';
import { UI_COPY } from '@vlprs/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface SubmissionConfirmationProps {
  referenceNumber: string;
  recordCount: number;
  submissionDate: string;
  source: 'csv' | 'manual';
  onSubmitAnother: () => void;
}

export function SubmissionConfirmation({
  referenceNumber,
  recordCount,
  submissionDate,
  source,
  onSubmitAnother,
}: SubmissionConfirmationProps) {
  const { copied, copyToClipboard } = useCopyToClipboard();

  const sourceLabel =
    source === 'csv'
      ? UI_COPY.SUBMISSION_CONFIRMATION_SOURCE_CSV
      : UI_COPY.SUBMISSION_CONFIRMATION_SOURCE_MANUAL;

  return (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-6 space-y-4">
        {/* Success icon */}
        <div className="flex justify-center">
          <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
        </div>

        {/* Header */}
        <h2 className="text-xl font-semibold text-center">
          {UI_COPY.UPLOAD_SUCCESS_HEADER}
        </h2>

        {/* Reference number block */}
        <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
          <span className="font-mono text-lg">{referenceNumber}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(referenceNumber)}
            aria-label={copied ? "Reference number copied" : "Copy reference number"}
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-text-secondary">Records</span>
          <span className="text-text-primary">
            {UI_COPY.SUBMISSION_CONFIRMATION_RECORDS.replace('{count}', String(recordCount))}
          </span>

          <span className="text-text-secondary">Submitted at</span>
          <span className="text-text-primary">{formatDateTime(submissionDate)}</span>

          <span className="text-text-secondary">Source</span>
          <span className="text-text-primary">{sourceLabel}</span>
        </div>

        <Separator />

        {/* Submit Another action */}
        <div className="flex justify-center">
          <Button variant="outline" onClick={onSubmitAnother}>
            {UI_COPY.SUBMISSION_SUBMIT_ANOTHER}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
