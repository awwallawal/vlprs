import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Copy, Check, FileSpreadsheet, PenLine } from 'lucide-react';
import { parse, format } from 'date-fns';
import { useSubmissionDetail } from '@/hooks/useSubmissionData';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { ComparisonSummary } from './components/ComparisonSummary';
import { ReconciliationSummary } from './components/ReconciliationSummary';
import { HistoricalReconciliation } from './components/HistoricalReconciliation';
import { useAuthStore } from '@/stores/authStore';
import { ROLES } from '@vlprs/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatDateTime, formatNaira, formatCount } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { UI_COPY } from '@vlprs/shared';
import type { EventFlagType } from '@vlprs/shared';

const EVENT_FLAG_LABELS = UI_COPY.EVENT_FLAG_LABELS as Record<string, string>;

const STATUS_BADGE_VARIANT: Record<string, 'complete' | 'info' | 'review'> = {
  confirmed: 'complete',
  processing: 'info',
  rejected: 'review',
};

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  processing: 'Processing',
  rejected: 'Rejected',
};

function formatPeriod(period: string): string {
  try {
    return format(parse(period, 'yyyy-MM', new Date()), 'MMMM yyyy');
  } catch {
    return period;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function SubmissionDetailPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const navigate = useNavigate();
  const { data, isPending, isError, error, refetch } = useSubmissionDetail(submissionId ?? '');
  const { copied, copyToClipboard } = useCopyToClipboard();
  const user = useAuthStore((s) => s.user);
  const userRole = user?.role ?? ROLES.MDA_OFFICER;

  // Set document title
  useEffect(() => {
    if (data?.referenceNumber) {
      document.title = `Submission ${data.referenceNumber} — VLPRS`;
    }
    return () => {
      document.title = 'VLPRS';
    };
  }, [data?.referenceNumber]);

  // Loading state
  if (isPending) {
    return (
      <div className="space-y-8">
        {/* Back button skeleton */}
        <Skeleton className="h-8 w-24" />
        {/* Header skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        {/* Table skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-md" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (isError) {
    const status = (error as { status?: number })?.status;
    const message =
      status === 404
        ? 'Submission not found'
        : status === 403
          ? "You don't have access to this submission"
          : 'Unable to load submission details — please try again';

    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 -ml-2 text-text-secondary"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Submissions
        </Button>
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-text-secondary">{message}</p>
            <Button variant="outline" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-text-secondary">
        <ol className="flex items-center gap-1.5">
          <li>
            <Link
              to="/dashboard/submissions"
              className="hover:text-text-primary transition-colors"
            >
              Submissions
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-text-primary font-medium">{data.referenceNumber}</li>
        </ol>
      </nav>

      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2 text-text-secondary"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Submissions
      </Button>

      {/* Header section */}
      <div className="space-y-4">
        {/* Reference number with copy */}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold font-mono text-text-primary">
            {data.referenceNumber}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(data.referenceNumber)}
            aria-label={copied ? 'Reference number copied' : 'Copy reference number'}
          >
            {copied ? (
              <Check className="h-4 w-4 text-success" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Badge variant={STATUS_BADGE_VARIANT[data.status] ?? 'pending'}>
            {STATUS_LABEL[data.status] ?? data.status}
          </Badge>
        </div>

        {/* Metadata grid */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
          <span>
            Period: <strong className="text-text-primary">{formatPeriod(data.period)}</strong>
          </span>
          <span>
            Submitted: <strong className="text-text-primary">{formatDateTime(data.createdAt)}</strong>
          </span>
          <span>
            Records: <strong className="text-text-primary">{formatCount(data.recordCount)} rows</strong>
          </span>
          <span>
            MDA: <strong className="text-text-primary">{data.mdaName}</strong>
          </span>
        </div>

        {/* Source indicator */}
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          {data.source === 'historical' ? (
            <>
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                Historical Upload
                {data.filename && (
                  <> — {data.filename}{data.fileSizeBytes != null && ` (${formatFileSize(data.fileSizeBytes)})`}</>
                )}
              </span>
            </>
          ) : data.source === 'csv' ? (
            <>
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                CSV Upload
                {data.filename && (
                  <> — {data.filename}{data.fileSizeBytes != null && ` (${formatFileSize(data.fileSizeBytes)})`}</>
                )}
              </span>
            </>
          ) : (
            <>
              <PenLine className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Manual Entry — {formatCount(data.recordCount)} rows</span>
            </>
          )}
        </div>
      </div>

      {/* Submission rows table */}
      <section aria-labelledby="rows-heading">
        <h2 id="rows-heading" className="text-lg font-semibold text-text-primary mb-3">
          Submission Rows
        </h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Row #</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff ID</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Month</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Amount Deducted</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Payroll Batch Ref</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">MDA Code</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Event Flag</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Event Date</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, idx) => {
                const hasEventFlag = row.eventFlag !== 'NONE';
                return (
                  <tr
                    key={idx}
                    className={cn(
                      'border-b last:border-b-0',
                      hasEventFlag && 'border-l-2 border-l-teal-500',
                    )}
                  >
                    <td className="px-4 py-3 text-text-secondary">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-text-primary">{row.staffId}</td>
                    <td className="px-4 py-3 text-text-secondary">{row.month}</td>
                    <td className="px-4 py-3 text-right font-mono text-text-primary">
                      {formatNaira(row.amountDeducted)}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{row.payrollBatchReference}</td>
                    <td className="px-4 py-3 font-mono text-text-secondary">{row.mdaCode}</td>
                    <td className="px-4 py-3">
                      {hasEventFlag ? (
                        <Badge variant="info">
                          {EVENT_FLAG_LABELS[row.eventFlag as EventFlagType] ?? row.eventFlag}
                        </Badge>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {row.eventDate ? formatDate(row.eventDate) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Historical submissions: show HistoricalReconciliation */}
      {data.status === 'confirmed' && data.source === 'historical' && (
        <HistoricalReconciliation submissionId={data.id} />
      )}

      {/* Non-historical: Comparison Summary + Reconciliation Summary */}
      {data.status === 'confirmed' && data.source !== 'historical' && (
        <ComparisonSummary submissionId={data.id} />
      )}
      {data.status === 'confirmed' && data.source !== 'historical' && (
        <ReconciliationSummary
          submissionId={data.id}
          userRole={userRole}
          mdaId={data.mdaId}
        />
      )}
    </div>
  );
}

export { SubmissionDetailPage as Component };
