import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Info, FileText } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSubmissionHistory } from '@/hooks/useSubmissionData';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { WelcomeGreeting } from '@/components/shared/WelcomeGreeting';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatCount } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { UI_COPY } from '@vlprs/shared';

/** Map known mock mdaIds to display names. */
const MDA_NAME_MAP: Record<string, string> = {
  'mda-001': 'Ministry of Finance',
  'mda-002': 'Ministry of Education',
  'mda-003': 'Ministry of Health',
};

/** Fallback mdaId when user's MDA has no mock data. */
const FALLBACK_MDA_ID = 'mda-003';

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
  const navigate = useNavigate();

  const userMdaId = user?.mdaId ?? null;
  const mdaName = userMdaId ? (MDA_NAME_MAP[userMdaId] ?? 'Your MDA') : 'All MDAs';
  const effectiveMdaId =
    userMdaId && MDA_NAME_MAP[userMdaId] ? userMdaId : FALLBACK_MDA_ID;

  const { data: submissions, isPending } = useSubmissionHistory(effectiveMdaId);

  const [checkpointConfirmed, setCheckpointConfirmed] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string | undefined>();

  const mostRecent = submissions?.[0] ?? null;

  const handleFileSelect = (file: File) => {
    setUploadedFileName(file.name);
    setUploadStatus('success');
  };

  const handleFileRemove = () => {
    setUploadedFileName(undefined);
    setUploadStatus('idle');
  };

  return (
    <div className="space-y-8">
      {/* Welcome greeting + page heading */}
      <div className="space-y-3">
        <WelcomeGreeting subtitle="Manage your MDA submissions" />
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Monthly Submissions</h1>
          <p className="mt-1 text-sm text-text-secondary">
            You are viewing data for: <span className="font-medium">{mdaName}</span>
          </p>
        </div>
      </div>

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

      {/* File upload section */}
      <section aria-labelledby="upload-heading">
        <h2 id="upload-heading" className="text-lg font-semibold text-text-primary mb-3">
          Upload Deduction File
        </h2>

        <p className="text-sm text-text-secondary mb-3">
          Upload your monthly 8-field CSV deduction file.{' '}
          <a
            href="/templates/submission-template.csv"
            className="text-teal underline hover:text-teal-hover"
          >
            Download CSV Template
          </a>
        </p>

        <div
          className={cn(
            'transition-opacity',
            !checkpointConfirmed && 'opacity-50 pointer-events-none',
          )}
          aria-disabled={!checkpointConfirmed}
        >
          <FileUploadZone
            accept=".csv"
            maxSizeMb={5}
            onFileSelect={handleFileSelect}
            onFileRemove={handleFileRemove}
            templateDownloadUrl="/templates/submission-template.csv"
            status={uploadStatus}
            fileName={uploadedFileName}
          />

          <div className="mt-4 flex items-center gap-3">
            <span className="text-sm text-text-muted">or</span>
            <Button
              variant="outline"
              disabled={!checkpointConfirmed}
              onClick={() => navigate('/dashboard/placeholder/manual-entry')}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Manual Entry
            </Button>
          </div>
        </div>
      </section>

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
        ) : !submissions || submissions.length === 0 ? (
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
