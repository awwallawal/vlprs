import { useState, useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useSubmissionHistory, useSubmissionUpload } from '@/hooks/useSubmissionData';
import { usePreSubmissionCheckpoint } from '@/hooks/usePreSubmissionCheckpoint';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { SubmissionConfirmation } from './components/SubmissionConfirmation';
import { ComparisonSummary } from './components/ComparisonSummary';
import { ManualEntryForm } from './components/ManualEntryForm';
import { ValidationErrorDisplay } from './components/ValidationErrorDisplay';
import { PreSubmissionCheckpoint } from './components/PreSubmissionCheckpoint';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDate, formatCount } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/apiClient';
import { ROLES } from '@vlprs/shared';
import type { SubmissionUploadResponse, SubmissionValidationError } from '@vlprs/shared';

type ConfirmationData = SubmissionUploadResponse & { source: 'csv' | 'manual' };

interface MdaOption {
  id: string;
  name: string;
  code: string;
}

const STATUS_BADGE_VARIANT: Record<string, 'complete' | 'info' | 'review'> = {
  confirmed: 'complete',
  processing: 'info',
  rejected: 'review',
};

export function SubmissionsPage() {
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? ROLES.MDA_OFFICER;
  const isSuperAdmin = userRole === ROLES.SUPER_ADMIN;

  const userMdaId = user?.mdaId ?? '';

  const { data: historyData, isPending } = useSubmissionHistory(userMdaId || undefined);
  const submissions = historyData?.items ?? [];

  const uploadMutation = useSubmissionUpload();

  // MDA name resolution
  const { data: mdas } = useQuery<MdaOption[]>({
    queryKey: ['mdas'],
    queryFn: () => apiClient('/mdas'),
    staleTime: 5 * 60_000,
    enabled: !!userMdaId,
  });
  const resolvedMdaName =
    userMdaId && mdas ? mdas.find((m) => m.id === userMdaId)?.name ?? 'Your MDA' : 'Your MDA';

  // Pre-submission checkpoint data
  const { data: checkpointData, isPending: checkpointLoading, isError: checkpointError } =
    usePreSubmissionCheckpoint(userMdaId || undefined);

  // Checkpoint state — lifted above Tabs to preserve across tab switches
  const [checkpointConfirmed, setCheckpointConfirmed] = useState(false);

  // Confirmation state — shared between CSV and manual flows
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);

  // Active tab state for reset
  const [activeTab, setActiveTab] = useState('csv');

  // Persisted validation errors — survive mutation reset during re-upload
  const [persistedErrors, setPersistedErrors] = useState<SubmissionValidationError[]>([]);

  // Ref for scrolling to upload section
  const uploadSectionRef = useRef<HTMLElement>(null);

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
      onSuccess: (data) => {
        setPersistedErrors([]);
        setConfirmationData({ ...data, source: 'csv' });
      },
      onError: (error) => {
        const errors =
          error && 'details' in error
            ? (error.details as SubmissionValidationError[]) ?? []
            : [];
        setPersistedErrors(errors);
      },
    });
  };

  const handleFileRemove = () => {
    uploadMutation.reset();
    setPersistedErrors([]);
  };

  const handleManualSuccess = (data: SubmissionUploadResponse) => {
    setConfirmationData({ ...data, source: 'manual' });
  };

  const handleSubmitAnother = () => {
    setConfirmationData(null);
    setCheckpointConfirmed(false);
    setActiveTab('csv');
    setPersistedErrors([]);
    uploadMutation.reset();
  };

  const handleHeroClick = () => {
    if (checkpointConfirmed) {
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Derive validation errors: prefer fresh mutation errors, fall back to persisted
  const mutationErrors: SubmissionValidationError[] =
    uploadMutation.error && 'details' in uploadMutation.error
      ? (uploadMutation.error.details as SubmissionValidationError[]) ?? []
      : [];
  const displayErrors = mutationErrors.length > 0 ? mutationErrors : persistedErrors;

  // Period display with grace period
  const now = new Date();
  const currentPeriod = format(now, 'MMMM yyyy');
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevPeriod = format(prevMonthDate, 'MMMM yyyy');

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

      {/* Period & MDA context */}
      {!isSuperAdmin && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
          <span>
            Submitting for: <strong className="text-text-primary">{currentPeriod}</strong>
            {' '}
            <span className="text-text-muted">({prevPeriod} also open)</span>
          </span>
          <span>
            Organisation:{' '}
            <strong className="text-text-primary">
              {userRole === ROLES.DEPT_ADMIN ? 'All MDAs' : resolvedMdaName}
            </strong>
          </span>
        </div>
      )}

      {/* View state: Confirmation, Error, or Upload */}
      {confirmationData !== null ? (
        /* CONFIRMATION VIEW — Confirm-Then-Compare principle */
        <>
          <SubmissionConfirmation
            referenceNumber={confirmationData.referenceNumber}
            recordCount={confirmationData.recordCount}
            submissionDate={confirmationData.submissionDate}
            source={confirmationData.source}
            onSubmitAnother={handleSubmitAnother}
          />
          <ComparisonSummary submissionId={confirmationData.id} />
        </>
      ) : displayErrors.length > 0 ? (
        /* ERROR VIEW — persists during re-upload (no navigation flicker) */
        <>
          <ValidationErrorDisplay errors={displayErrors} />
          <section aria-labelledby="reupload-heading">
            <h2 id="reupload-heading" className="sr-only">
              Re-upload corrected file
            </h2>
            <FileUploadZone
              accept=".csv"
              maxSizeMb={5}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              status={uploadMutation.isPending ? 'uploading' : 'idle'}
              aria-label="Upload corrected CSV file. Drag and drop or click to browse."
            />
          </section>
        </>
      ) : !isSuperAdmin ? (
        /* UPLOAD VIEW — only for MDA_OFFICER and DEPT_ADMIN */
        <>
          {/* "Submit Monthly Data" hero button */}
          <div className="flex justify-center">
            <Button
              onClick={handleHeroClick}
              disabled={!checkpointConfirmed}
              aria-disabled={!checkpointConfirmed}
              className={cn(
                'h-12 md:h-10 min-w-[220px] min-h-[44px] text-base font-semibold',
                'bg-[#9C1E23] hover:bg-[#9C1E23]/90 text-white',
                'focus:ring-2 focus:ring-[#0D7377]',
                !checkpointConfirmed && 'opacity-40',
              )}
              title={
                !checkpointConfirmed
                  ? 'Complete the pre-submission checkpoint first'
                  : undefined
              }
            >
              <Upload className="h-5 w-5" aria-hidden="true" />
              Submit Monthly Data
            </Button>
          </div>

          {/* Pre-Submission Checkpoint */}
          <PreSubmissionCheckpoint
            data={checkpointData}
            isLoading={checkpointLoading}
            isError={checkpointError}
            onConfirm={setCheckpointConfirmed}
            confirmed={checkpointConfirmed}
          />

          {/* Submission entry — Tabs: CSV Upload / Manual Entry */}
          <section ref={uploadSectionRef} aria-labelledby="submission-heading">
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
                    Upload your monthly 8-field CSV deduction file.
                  </p>

                  {/* Template download — prominent secondary action */}
                  <div className="mb-4">
                    <a
                      href="/templates/submission-template.csv"
                      download="submission-template.csv"
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium',
                        'border border-[#0D7377] text-[#0D7377] hover:bg-teal-50',
                        'w-full justify-center md:w-auto',
                        'focus:ring-2 focus:ring-[#0D7377]',
                      )}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Download CSV Template
                    </a>
                  </div>

                  <FileUploadZone
                    accept=".csv"
                    maxSizeMb={5}
                    onFileSelect={handleFileSelect}
                    onFileRemove={handleFileRemove}
                    status={uploadStatus}
                    errorMessage={
                      uploadMutation.isError ? uploadMutation.error.message : undefined
                    }
                  />
                </div>
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
      ) : null}

      {/* Submission history table — always visible */}
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
