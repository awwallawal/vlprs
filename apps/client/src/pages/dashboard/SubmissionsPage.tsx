import { useState } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSubmissionHistory, useSubmissionUpload } from '@/hooks/useSubmissionData';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { SubmissionConfirmation } from './components/SubmissionConfirmation';
import { ManualEntryForm } from './components/ManualEntryForm';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDate, formatCount } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { UI_COPY, VOCABULARY } from '@vlprs/shared';
import type { SubmissionUploadResponse, SubmissionValidationError } from '@vlprs/shared';

type ConfirmationData = SubmissionUploadResponse & { source: 'csv' | 'manual' };

const STATUS_BADGE_VARIANT: Record<string, 'complete' | 'info' | 'review'> = {
  confirmed: 'complete',
  processing: 'info',
  rejected: 'review',
};

const CHECKPOINT_ITEMS = [
  '2 staff approaching retirement within 12 months',
  '1 staff with zero deduction last month and no event filed',
];

export function SubmissionsPage() {
  const user = useAuthStore((s) => s.user);

  const userMdaId = user?.mdaId ?? '';

  const { data: historyData, isPending } = useSubmissionHistory(userMdaId);
  const submissions = historyData?.items ?? [];

  const uploadMutation = useSubmissionUpload();

  // Checkpoint state — lifted above Tabs to preserve across tab switches
  const [checkpointConfirmed, setCheckpointConfirmed] = useState(false);

  // Confirmation state — shared between CSV and manual flows
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);

  // Active tab state for reset
  const [activeTab, setActiveTab] = useState('csv');

  // Derive upload status from mutation state
  const uploadStatus: 'idle' | 'uploading' | 'success' | 'error' = uploadMutation.isPending
    ? 'uploading'
    : uploadMutation.isSuccess
      ? 'success'
      : uploadMutation.isError
        ? 'error'
        : 'idle';

  const handleFileSelect = (file: File) => {
    uploadMutation.mutate(file, {
      onSuccess: (data) => setConfirmationData({ ...data, source: 'csv' }),
    });
  };

  const handleFileRemove = () => {
    uploadMutation.reset();
  };

  const handleManualSuccess = (data: SubmissionUploadResponse) => {
    setConfirmationData({ ...data, source: 'manual' });
  };

  const handleSubmitAnother = () => {
    setConfirmationData(null);
    setCheckpointConfirmed(false);
    setActiveTab('csv');
    uploadMutation.reset();
  };

  // Extract validation errors from mutation error
  const validationErrors: SubmissionValidationError[] =
    uploadMutation.error && 'details' in uploadMutation.error
      ? (uploadMutation.error.details as SubmissionValidationError[]) ?? []
      : [];

  const mostRecent = submissions[0] ?? null;

  return (
    <div className="space-y-8">
      {/* Welcome greeting + page heading */}
      <div className="space-y-3">
        <WelcomeGreeting subtitle="Manage your MDA submissions" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Monthly Submissions</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Upload your monthly deduction data or enter records manually.
          </p>
        </div>
      </div>

      {/* View state: Confirmation or Upload */}
      {confirmationData !== null ? (
        /* CONFIRMATION VIEW */
        <SubmissionConfirmation
          referenceNumber={confirmationData.referenceNumber}
          recordCount={confirmationData.recordCount}
          submissionDate={confirmationData.submissionDate}
          source={confirmationData.source}
          onSubmitAnother={handleSubmitAnother}
        />
      ) : (
        /* UPLOAD VIEW */
        <>
          {/* Pre-Submission Checkpoint */}
          <section aria-labelledby="checkpoint-heading">
            <h2 id="checkpoint-heading" className="text-lg font-semibold text-text-primary mb-3">
              Pre-Submission Checkpoint
            </h2>

            <div className="rounded-lg bg-teal-50 p-4 space-y-3">
              {CHECKPOINT_ITEMS.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <Info className="h-5 w-5 shrink-0 text-teal mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-text-primary">{item}</p>
                </div>
              ))}
            </div>

            <label className="mt-4 flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={checkpointConfirmed}
                onChange={(e) => setCheckpointConfirmed(e.target.checked)}
                className="h-4 w-4 rounded border-border text-teal accent-teal focus:ring-teal"
              />
              <span className="text-sm text-text-primary">
                I have reviewed the above items and confirm I am ready to submit
              </span>
            </label>
          </section>

          {/* Submission entry — Tabs: CSV Upload / Manual Entry */}
          <section aria-labelledby="submission-heading">
            <h2 id="submission-heading" className="text-lg font-semibold text-text-primary mb-3">
              Submit Deduction Data
            </h2>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>

              {/* CSV Upload Tab */}
              <TabsContent value="csv">
                <div
                  className={cn(
                    'transition-opacity',
                    !checkpointConfirmed && 'opacity-50 pointer-events-none',
                  )}
                  aria-disabled={!checkpointConfirmed}
                >
                  <p className="text-sm text-text-secondary mb-3">
                    Upload your monthly 8-field CSV deduction file.{' '}
                    <a
                      href="/templates/submission-template.csv"
                      className="text-teal underline hover:text-teal-hover"
                    >
                      Download CSV Template
                    </a>
                  </p>

                  <FileUploadZone
                    accept=".csv"
                    maxSizeMb={5}
                    onFileSelect={handleFileSelect}
                    onFileRemove={handleFileRemove}
                    templateDownloadUrl="/templates/submission-template.csv"
                    status={uploadStatus}
                    errorMessage={
                      uploadMutation.isError
                        ? uploadMutation.error.message
                        : undefined
                    }
                  />
                </div>

                {/* Error display — row-level validation errors with non-punitive language */}
                {uploadMutation.isError && validationErrors.length > 0 && (
                  <section
                    aria-labelledby="validation-errors-heading"
                    className="mt-4 rounded-lg border border-gold/30 bg-gold-50 p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-gold" aria-hidden="true" />
                      <h3
                        id="validation-errors-heading"
                        className="text-base font-semibold text-text-primary"
                      >
                        {VOCABULARY.SUBMISSION_NEEDS_ATTENTION}
                      </h3>
                    </div>
                    <ul className="space-y-1.5 text-sm text-text-secondary">
                      {validationErrors.map((err, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-gold mt-0.5">&#8226;</span>
                          <span>{err.message}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </TabsContent>

              {/* Manual Entry Tab — forceMount preserves form data on tab switch */}
              <TabsContent value="manual" forceMount className="data-[state=inactive]:hidden">
                <div
                  className={cn(
                    'transition-opacity',
                    !checkpointConfirmed && 'opacity-50 pointer-events-none',
                  )}
                  aria-disabled={!checkpointConfirmed}
                >
                  <ManualEntryForm
                    disabled={!checkpointConfirmed}
                    onSuccess={handleManualSuccess}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </section>
        </>
      )}

      {/* Comparison summary for most recent submission */}
      {mostRecent && mostRecent.varianceCount > 0 && (
        <section aria-labelledby="comparison-heading">
          <div className="rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-5 w-5 text-teal" aria-hidden="true" />
              <h2 id="comparison-heading" className="text-base font-semibold text-text-primary">
                {UI_COPY.COMPARISON_COMPLETE}
              </h2>
            </div>

            <div className="space-y-2 text-sm text-text-secondary">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-teal shrink-0" aria-hidden="true" />
                <span>
                  {formatCount(mostRecent.varianceCount)}{' '}
                  {mostRecent.varianceCount === 1 ? 'record' : 'records'} with variance
                  detected in submission {mostRecent.referenceNumber}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-teal shrink-0" aria-hidden="true" />
                <span>
                  {formatCount(mostRecent.alignedCount)} of{' '}
                  {formatCount(mostRecent.recordCount)} records aligned with prior month
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Submission history table */}
      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold text-text-primary mb-3">
          Submission History
        </h2>

        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-text-muted py-4">No submissions on record.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Reference Number
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Submission Date
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">
                    Row Count
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((sub) => (
                  <tr key={sub.id} className="border-b last:border-b-0 hover:bg-surface">
                    <td className="px-4 py-3 font-mono text-text-primary">
                      {sub.referenceNumber}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDate(sub.submissionDate)}
                    </td>
                    <td className="px-4 py-3 text-right text-text-primary">
                      {formatCount(sub.recordCount)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE_VARIANT[sub.status] ?? 'pending'}>
                        {sub.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export { SubmissionsPage as Component };
