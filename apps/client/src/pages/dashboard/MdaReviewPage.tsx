/**
 * MdaReviewPage — Dedicated page for MDA officers to review flagged migration records.
 * Shows flagged records with countdown, correction actions via detail drawer.
 * UAT 2026-04-12 Finding #12
 */

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useListMigrations, useAllFlaggedRecords } from '@/hooks/useMigration';
import { useAuthStore } from '@/stores/authStore';
import { ROLES } from '@vlprs/shared';
import type { FlaggedRecordSummary } from '@vlprs/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { RecordDetailDrawer } from './components/RecordDetailDrawer';
import { countdownBadge } from './components/MdaReviewProgressTracker';
import { MdaReviewProgressTracker } from './components/MdaReviewProgressTracker';
import { CorrectionWorksheetActions } from './components/CorrectionWorksheetActions';

const VARIANCE_BADGE: Record<string, { label: string; className: string }> = {
  significant_variance: { label: 'Significant Variance', className: 'bg-gold/20 text-gold border-gold/30' },
  structural_error: { label: 'Structural Error', className: 'bg-amber-50 text-amber-600 border-amber-200' },
  anomalous: { label: 'Anomalous', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  minor_variance: { label: 'Minor Variance', className: 'bg-gold/10 text-gold border-gold/20' },
};

const STATUS_FILTER_OPTIONS = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'all', label: 'All' },
] as const;

export function MdaReviewPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mdaFilter = searchParams.get('mda') ?? undefined;
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.DEPT_ADMIN;

  const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<{ recordId: string; uploadId: string } | null>(null);
  const limit = 20;

  // Get all uploads for worksheet tools and progress tracker
  const uploads = useListMigrations({ limit: 5 });
  const latestUpload = uploads.data?.data?.find((u) => u.status === 'validated' || u.status === 'reconciled');
  const uploadId = latestUpload?.id ?? '';

  // Query ALL flagged records across all uploads for this MDA (or filtered MDA)
  const flagged = useAllFlaggedRecords({ page, limit, status: statusFilter, mda: mdaFilter });
  const records = flagged.data?.records ?? [];
  const total = flagged.data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  // Derive progress from records
  const firstRecord = records[0];
  const deadline = firstRecord?.reviewWindowDeadline ? new Date(firstRecord.reviewWindowDeadline) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 -ml-2 text-text-secondary"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">
              Migration Records — Review
            </h1>
            <p className="text-sm text-text-secondary">
              {total} record{total !== 1 ? 's' : ''} flagged for review
              {deadline && (
                <> — deadline {deadline.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</>
              )}
            </p>
          </div>
        </div>
        {firstRecord && (
          <div>
            {countdownBadge(firstRecord.daysRemaining, firstRecord.countdownStatus)}
          </div>
        )}
      </div>

      {/* Admin progress tracker (hidden when filtered to a specific MDA so the records list is visible) */}
      {isAdmin && uploadId && !mdaFilter && (
        <MdaReviewProgressTracker uploadId={uploadId} allUploads />
      )}

      {/* Active filter banner */}
      {mdaFilter && (
        <div className="rounded-lg bg-teal/5 border border-teal/20 p-3 flex items-center justify-between">
          <span className="text-sm text-text-secondary">
            Filtered to MDA: <strong className="text-text-primary">{records[0]?.mdaName ?? mdaFilter}</strong>
          </span>
          <button
            type="button"
            onClick={() => navigate('/dashboard/migration/review')}
            className="text-sm text-teal hover:text-teal/80 font-medium"
          >
            Clear filter ✕
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {STATUS_FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => { setStatusFilter(opt.value); setPage(1); }}
            className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
              statusFilter === opt.value
                ? 'bg-teal text-white border-teal'
                : 'bg-white text-text-secondary border-border hover:border-teal/50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Bulk tools for MDA officers */}
      {!isAdmin && uploadId && (
        <div className="rounded-lg border bg-white p-4">
          <h3 className="text-xs font-semibold text-text-secondary uppercase mb-2">Bulk Correction Tools</h3>
          <CorrectionWorksheetActions uploadId={uploadId} />
        </div>
      )}

      {/* Records table */}
      {flagged.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          {statusFilter === 'pending'
            ? 'All records have been reviewed. Well done!'
            : 'No records match this filter.'}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff Name</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff ID</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Period</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">Category</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Variance</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <FlaggedRecordRow
                  key={record.recordId}
                  record={record}
                  onClick={() => setSelectedRecord({ recordId: record.recordId, uploadId: record.uploadId ?? uploadId })}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-text-secondary">
          <span>Page {page} of {totalPages} ({total} records)</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border px-3 py-1 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Record Detail Drawer */}
      <RecordDetailDrawer
        uploadId={selectedRecord?.uploadId ?? uploadId}
        recordId={selectedRecord?.recordId ?? null}
        open={!!selectedRecord}
        onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}
      />
    </div>
  );
}

function FlaggedRecordRow({ record, onClick }: { record: FlaggedRecordSummary; onClick: () => void }) {
  const badge = VARIANCE_BADGE[record.varianceCategory ?? ''];
  const isReviewed = !!record.correctedAt;

  return (
    <tr
      className="border-b transition-colors hover:bg-slate-50 cursor-pointer"
      onClick={onClick}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <td className="px-4 py-3 font-medium text-text-primary">{record.staffName}</td>
      <td className="px-4 py-3 font-mono text-text-secondary">{record.staffId ?? '—'}</td>
      <td className="px-4 py-3 text-text-secondary">
        {record.periodYear && record.periodMonth
          ? new Date(record.periodYear, record.periodMonth - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          : '—'}
      </td>
      <td className="px-4 py-3 text-center">
        {badge ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${badge.className}`}>
            {badge.label}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {record.varianceAmount && Number(record.varianceAmount) > 0 ? (
          <NairaDisplay amount={record.varianceAmount} variant="table" />
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {isReviewed ? (
          <Badge variant="complete">Reviewed</Badge>
        ) : (
          <Badge variant="pending">Pending</Badge>
        )}
      </td>
    </tr>
  );
}

export { MdaReviewPage as Component };
