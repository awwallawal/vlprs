/**
 * MigrationUploadList — Table of migration uploads with superseded visual treatment.
 * Superseded uploads show reduced opacity, a "Superseded" badge, and
 * "Superseded by [filename] on [date]" text with a link.
 *
 * Story 7.0g — Tasks 10.1 + 10.2 (AC 6)
 */

import { useState } from 'react';
import { useListMigrations } from '@/hooks/useMigration';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import type { MigrationUploadSummary, MigrationUploadStatus } from '@vlprs/shared';

const STATUS_LABELS: Record<MigrationUploadStatus, string> = {
  uploaded: 'Uploaded',
  mapped: 'Mapped',
  processing: 'Processing',
  completed: 'Completed',
  validated: 'Validated',
  reconciled: 'Reconciled',
  failed: 'Failed',
};

const STATUS_VARIANTS: Record<MigrationUploadStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  uploaded: 'outline',
  mapped: 'outline',
  processing: 'secondary',
  completed: 'default',
  validated: 'default',
  reconciled: 'default',
  failed: 'destructive',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function MigrationUploadList() {
  const [page, setPage] = useState(1);
  const limit = 15;

  const { data, isPending, isError } = useListMigrations({ page, limit });

  const uploads = data?.data ?? [];
  const pagination = data?.pagination;

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-text-muted py-4">
        Unable to load upload history. Please try again.
      </p>
    );
  }

  if (uploads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileSpreadsheet className="h-12 w-12 text-text-muted mb-3" />
        <p className="text-sm text-text-muted">No uploads yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Filename</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">MDA</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Records</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Status</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Date</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <UploadRow key={upload.id} upload={upload} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} uploads)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function UploadRow({ upload }: { upload: MigrationUploadSummary }) {
  const isSuperseded = !!upload.supersededBy;

  return (
    <tr
      className={`border-b border-border last:border-b-0 transition-colors hover:bg-surface-secondary/50 ${
        isSuperseded ? 'opacity-50' : ''
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col gap-1">
          <span className="font-medium text-text-primary">{upload.filename}</span>
          {isSuperseded && upload.supersededByFilename && upload.supersededAt && (
            <span className="text-xs text-text-muted">
              Superseded by {upload.supersededByFilename} on {formatDate(upload.supersededAt)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-text-secondary">{upload.mdaName}</td>
      <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
        {upload.totalRecords.toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANTS[upload.status]}>
            {STATUS_LABELS[upload.status]}
          </Badge>
          {isSuperseded && (
            <Badge variant="secondary" className="text-text-muted">
              Superseded
            </Badge>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
        {formatDate(upload.createdAt)}
      </td>
    </tr>
  );
}
