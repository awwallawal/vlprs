import { useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { Button } from '@/components/ui/button';
import { usePayrollPreview, usePayrollConfirm } from '@/hooks/usePayrollUpload';
import { formatNaira } from '@/lib/formatters';
import { UI_COPY } from '@vlprs/shared';
import type { PayrollDelineationSummary, PayrollUploadResponse } from '@vlprs/shared';

type PageState = 'upload' | 'preview' | 'confirmed';

export function PayrollUploadPage() {
  const [pageState, setPageState] = useState<PageState>('upload');
  const [summary, setSummary] = useState<PayrollDelineationSummary | null>(null);
  const [confirmation, setConfirmation] = useState<PayrollUploadResponse | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const previewMutation = usePayrollPreview();
  const confirmMutation = usePayrollConfirm();

  const handleFileSelect = useCallback((file: File) => {
    setFileName(file.name);
    setPageState('upload');
    setSummary(null);
    setConfirmation(null);

    previewMutation.mutate(file, {
      onSuccess: (data) => {
        setSummary(data);
        setPageState('preview');
      },
    });
  }, [previewMutation]);

  const handleConfirm = useCallback(() => {
    if (!summary) return;

    confirmMutation.mutate({ period: summary.period }, {
      onSuccess: (data) => {
        setConfirmation(data);
        setPageState('confirmed');
      },
    });
  }, [summary, confirmMutation]);

  const handleReset = useCallback(() => {
    setPageState('upload');
    setSummary(null);
    setConfirmation(null);
    setFileName('');
    previewMutation.reset();
    confirmMutation.reset();
  }, [previewMutation, confirmMutation]);

  const hasUnmatched = (summary?.unmatchedCodes.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {UI_COPY.PAYROLL_UPLOAD_HEADER}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Upload the consolidated monthly payroll deduction extract (.csv or .xlsx).
          The system will identify records for each MDA and present a summary for your review.
        </p>
      </div>

      {/* Upload Zone */}
      {pageState === 'upload' && (
        <FileUploadZone
          accept=".csv,.xlsx,.xls"
          maxSizeMb={10}
          onFileSelect={handleFileSelect}
          status={
            previewMutation.isPending ? 'uploading' :
            previewMutation.isError ? 'error' : 'idle'
          }
          fileName={fileName}
          errorMessage={previewMutation.error?.message}
        />
      )}

      {/* Delineation Summary */}
      {pageState === 'preview' && summary && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-white p-6">
            <h2 className="mb-4 text-lg font-medium text-text-primary">
              {UI_COPY.PAYROLL_DELINEATION_HEADER}
            </h2>

            <div className="mb-4 flex items-center gap-4 text-sm text-text-secondary">
              <span>Period: <strong>{summary.period}</strong></span>
              <span>Total Records: <strong>{summary.totalRecords}</strong></span>
              <span>MDAs: <strong>{summary.mdaBreakdown.length}</strong></span>
            </div>

            {/* Unmatched Warning */}
            {hasUnmatched && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-gold bg-attention-bg p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <p className="text-sm text-text-primary">
                  {UI_COPY.PAYROLL_UNMATCHED_WARNING.replace('{count}', String(summary.unmatchedCodes.length))}
                </p>
              </div>
            )}

            {/* MDA Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="delineation-table">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="pb-2 pr-4">MDA Name</th>
                    <th className="pb-2 pr-4 text-right">Record Count</th>
                    <th className="pb-2 text-right">Total Deduction</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.mdaBreakdown.map((mda) => (
                    <tr
                      key={mda.mdaCode}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-2 pr-4 text-text-primary">
                        {mda.mdaName}
                        {summary.unmatchedCodes.includes(mda.mdaCode) && (
                          <span className="ml-2 text-xs text-gold">(unmatched)</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{mda.recordCount}</td>
                      <td className="py-2 text-right tabular-nums">{formatNaira(mda.totalDeduction)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleConfirm}
              disabled={hasUnmatched || confirmMutation.isPending}
              className="bg-teal text-white hover:bg-teal-dark"
            >
              {confirmMutation.isPending ? 'Confirming...' : 'Confirm Upload'}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Cancel
            </Button>
          </div>

          {confirmMutation.isError && (
            <p className="text-sm text-crimson">{confirmMutation.error?.message}</p>
          )}
        </div>
      )}

      {/* Confirmation Result */}
      {pageState === 'confirmed' && confirmation && (
        <div className="rounded-lg border border-success/30 bg-green-50 p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div className="space-y-2">
              <h2 className="text-lg font-medium text-text-primary">
                {UI_COPY.PAYROLL_UPLOAD_SUCCESS
                  .replace('{records}', String(confirmation.totalRecords))
                  .replace('{mdas}', String(confirmation.mdaCount))}
              </h2>

              <div className="text-sm text-text-secondary">
                <p>Period: <strong>{confirmation.period}</strong></p>
                <p>MDAs: <strong>{confirmation.mdaCount}</strong></p>
                <p>Total Records: <strong>{confirmation.totalRecords}</strong></p>
              </div>

              <div className="mt-3">
                <p className="mb-1 text-xs font-medium text-text-secondary">Reference Numbers:</p>
                <ul className="list-inside list-disc text-sm text-text-primary">
                  {confirmation.referenceNumbers.map((ref) => (
                    <li key={ref} className="tabular-nums">{ref}</li>
                  ))}
                </ul>
              </div>

              <Button variant="outline" onClick={handleReset} className="mt-4">
                <Upload className="mr-2 h-4 w-4" />
                Upload Another
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
