import { useState } from 'react';
import { CheckCircle2, Info, Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { HistoricalReconciliation } from './components/HistoricalReconciliation';
import { useHistoricalUpload } from '@/hooks/useHistoricalSubmission';
import { UI_COPY, VOCABULARY } from '@vlprs/shared';
import type { HistoricalUploadResponse, SubmissionValidationError } from '@vlprs/shared';
import { toast } from 'sonner';

export function HistoricalUploadPage() {
  const uploadMutation = useHistoricalUpload();
  const [confirmationData, setConfirmationData] = useState<HistoricalUploadResponse | null>(null);
  const [persistedErrors, setPersistedErrors] = useState<SubmissionValidationError[]>([]);
  const uploadStatus = uploadMutation.isPending
    ? 'uploading' as const
    : uploadMutation.isError
      ? 'error' as const
      : 'idle' as const;

  const mutationErrors: SubmissionValidationError[] =
    uploadMutation.error && 'details' in uploadMutation.error
      ? (uploadMutation.error.details as SubmissionValidationError[]) ?? []
      : [];
  const displayErrors = mutationErrors.length > 0 ? mutationErrors : persistedErrors;

  function handleFileSelect(file: File) {
    uploadMutation.mutate(file, {
      onSuccess: (data) => {
        setPersistedErrors([]);
        setConfirmationData(data);
      },
      onError: (error) => {
        const errors = error && 'details' in error
          ? (error.details as SubmissionValidationError[]) ?? []
          : [];
        setPersistedErrors(errors);
      },
    });
  }

  function handleFileRemove() {
    uploadMutation.reset();
    setPersistedErrors([]);
  }

  function handleUploadAnother() {
    setConfirmationData(null);
    uploadMutation.reset();
    setPersistedErrors([]);
  }

  function copyReference(ref: string) {
    navigator.clipboard.writeText(ref);
    toast.success(UI_COPY.SUBMISSION_REFERENCE_COPIED);
  }

  // Confirmation view
  if (confirmationData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">
          {UI_COPY.HISTORICAL_UPLOAD_HEADER}
        </h1>

        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-center">Upload Complete</h2>

            {/* Reference number */}
            <div className="flex items-center justify-center gap-2">
              <span className="font-mono text-sm bg-slate-100 px-3 py-1 rounded">
                {confirmationData.referenceNumber}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyReference(confirmationData.referenceNumber)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            {/* Summary grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-text-secondary">Records</div>
              <div className="text-right font-medium">{confirmationData.recordCount}</div>
              <div className="text-text-secondary">Matched</div>
              <div className="text-right font-medium">{confirmationData.matchedCount}</div>
              <div className="text-text-secondary">Variances</div>
              <div className="text-right font-medium">{confirmationData.varianceCount}</div>
              <div className="text-text-secondary">Match Rate</div>
              <div className="text-right font-medium">{confirmationData.matchRate}%</div>
            </div>

            {/* No baseline banner */}
            {confirmationData.noBaseline && (
              <div className="flex items-start gap-2 rounded-md bg-slate-100 p-3">
                <Info className="h-4 w-4 text-[#0D7377] mt-0.5 shrink-0" />
                <p className="text-xs text-text-secondary">
                  {VOCABULARY.HISTORICAL_NO_BASELINE}
                </p>
              </div>
            )}

            <Button variant="outline" className="w-full" onClick={handleUploadAnother}>
              Upload Another Period
            </Button>
          </CardContent>
        </Card>

        {/* Reconciliation view for the just-uploaded submission */}
        {!confirmationData.noBaseline && (
          <HistoricalReconciliation submissionId={confirmationData.id} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">
        {UI_COPY.HISTORICAL_UPLOAD_HEADER}
      </h1>

      {/* Info panel */}
      <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-4">
        <Info className="h-5 w-5 text-[#0D7377] mt-0.5 shrink-0" />
        <p className="text-sm text-text-secondary">
          Upload prior-period monthly deduction data (YYYY-MM format, max 100 rows per file).
          The system will cross-reference against migration baseline data for your MDA.
          You can re-upload for the same period to correct or add records.
        </p>
      </div>

      {/* Upload zone */}
      <section>
        <FileUploadZone
          accept=".csv"
          maxSizeMb={5}
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
          status={uploadStatus}
          errorMessage={uploadMutation.isError ? uploadMutation.error.message : undefined}
        />
      </section>

      {/* Validation errors */}
      {displayErrors.length > 0 && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-gold" />
              <span className="text-sm font-medium text-text-primary">
                {UI_COPY.UPLOAD_ERROR_HEADER}
              </span>
            </div>
            <ul className="space-y-1 text-sm text-text-secondary">
              {displayErrors.map((err, idx) => (
                <li key={idx} className="flex items-start gap-1">
                  <span className="text-gold shrink-0">•</span>
                  <span>{err.message}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-text-muted pt-2">
              Fix the items above in your CSV and re-upload.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
