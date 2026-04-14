/**
 * MigrationUploadList — Table of migration uploads with superseded visual treatment
 * and discard action for incomplete uploads.
 *
 * Story 7.0g — Tasks 10.1 + 10.2 (AC 6)
 * Story 8.0c — Discard action for uploaded/mapped/failed uploads
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { useListMigrations, useDiscardMigration, useDeleteMigration, useApproveUpload, useRejectUpload, useBatchBaseline } from '@/hooks/useMigration';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Trash2, Check, X, Play } from 'lucide-react';
import { ROLES } from '@vlprs/shared';
import type { MigrationUploadSummary, MigrationUploadStatus } from '@vlprs/shared';

const STATUS_LABELS: Record<MigrationUploadStatus, string> = {
  uploaded: 'Uploaded',
  mapped: 'Mapped',
  processing: 'Processing',
  completed: 'Completed',
  pending_verification: 'Pending Admin Approval',
  validated: 'Validated',
  reconciled: 'Reconciled',
  failed: 'Failed',
  rejected: 'Rejected',
};

const STATUS_VARIANTS: Record<MigrationUploadStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  uploaded: 'outline',
  mapped: 'outline',
  processing: 'secondary',
  completed: 'default',
  pending_verification: 'secondary',
  validated: 'default',
  reconciled: 'default',
  failed: 'destructive',
  rejected: 'destructive',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const DISCARDABLE_STATUSES: MigrationUploadStatus[] = ['uploaded', 'mapped', 'failed'];

export function MigrationUploadList() {
  const [page, setPage] = useState(1);
  const [discardTarget, setDiscardTarget] = useState<MigrationUploadSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MigrationUploadSummary | null>(null);
  const [deleteConfirmFilename, setDeleteConfirmFilename] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<MigrationUploadSummary | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const limit = 15;

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === ROLES.SUPER_ADMIN || user?.role === ROLES.DEPT_ADMIN;
  const { data, isPending, isError } = useListMigrations({ page, limit });
  const discardMutation = useDiscardMigration();
  const deleteMutation = useDeleteMigration();
  const batchBaselineMutation = useBatchBaseline();
  const approveMutation = useApproveUpload();
  const rejectMutation = useRejectUpload();

  const uploads = data?.data ?? [];
  const pagination = data?.pagination;

  const handleDiscard = async () => {
    if (!discardTarget) return;
    try {
      await discardMutation.mutateAsync({ uploadId: discardTarget.id });
      toast.success('Upload discarded');
      setDiscardTarget(null);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to discard upload';
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || deleteConfirmFilename !== deleteTarget.filename || deleteReason.length < 10) return;
    try {
      const result = await deleteMutation.mutateAsync({
        uploadId: deleteTarget.id,
        confirmFilename: deleteConfirmFilename,
        reason: deleteReason,
      });
      toast.success(`Upload deleted — ${result.recordsAffected} records, ${result.loansRemoved} loans removed`);
      setDeleteTarget(null);
      setDeleteConfirmFilename('');
      setDeleteReason('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete upload';
      toast.error(message);
    }
  };

  const handleBaseline = async (upload: MigrationUploadSummary) => {
    try {
      const result = await batchBaselineMutation.mutateAsync({ uploadId: upload.id });
      toast.success(`Baselines established: ${result.loansCreated} loans created, ${result.flaggedForReview.count} flagged for review`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to establish baselines';
      toast.error(message);
    }
  };

  const handleApprove = async (upload: MigrationUploadSummary) => {
    try {
      await approveMutation.mutateAsync({ uploadId: upload.id });
      toast.success(`Upload "${upload.filename}" approved`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to approve upload';
      toast.error(message);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      await rejectMutation.mutateAsync({ uploadId: rejectTarget.id, reason: rejectReason });
      toast.success(`Upload "${rejectTarget.filename}" rejected`);
      setRejectTarget(null);
      setRejectReason('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reject upload';
      toast.error(message);
    }
  };

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
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Actions</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <UploadRow
                key={upload.id}
                upload={upload}
                isAdmin={isAdmin}
                onDiscard={setDiscardTarget}
                onDelete={setDeleteTarget}
                onBaseline={handleBaseline}
                isBaselining={batchBaselineMutation.isPending}
                onApprove={handleApprove}
                onReject={setRejectTarget}
              />
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

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={!!discardTarget} onOpenChange={(open) => !open && setDiscardTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Upload</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{discardTarget?.filename}</strong>{discardTarget?.totalRecords ? ` (${discardTarget.totalRecords.toLocaleString()} records)` : ''} from the migration dashboard. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDiscard}
              disabled={discardMutation.isPending}
              variant="destructive"
            >
              {discardMutation.isPending ? 'Discarding...' : 'Discard Upload'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Upload Dialog (Story 15.0f) */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Upload</AlertDialogTitle>
            <AlertDialogDescription>
              Reject <strong>{rejectTarget?.filename}</strong> uploaded by MDA officer. Please provide a reason (visible to the officer).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for rejection (min 10 characters)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[80px]"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleReject}
              disabled={rejectMutation.isPending || rejectReason.length < 10}
              variant="destructive"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Upload'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Upload Dialog — GitHub-style type-to-confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmFilename(''); setDeleteReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Upload</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will permanently delete <strong>{deleteTarget?.filename}</strong> ({deleteTarget?.totalRecords.toLocaleString()} records) and all associated loans and ledger entries. This action cannot be undone.
                </p>
                <p>
                  To confirm, type the filename below:
                </p>
                <p className="rounded bg-slate-100 px-2 py-1 font-mono text-xs select-all">
                  {deleteTarget?.filename}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Type filename to confirm..."
              value={deleteConfirmFilename}
              onChange={(e) => setDeleteConfirmFilename(e.target.value)}
              className="font-mono text-sm"
            />
            <Textarea
              placeholder="Reason for deletion (min 10 characters)..."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleDelete}
              disabled={
                deleteMutation.isPending ||
                deleteConfirmFilename !== deleteTarget?.filename ||
                deleteReason.length < 10
              }
              variant="destructive"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Upload'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadRow({ upload, isAdmin, onDiscard, onDelete, onBaseline, isBaselining, onApprove, onReject }: {
  upload: MigrationUploadSummary;
  isAdmin: boolean;
  onDiscard: (upload: MigrationUploadSummary) => void;
  onDelete: (upload: MigrationUploadSummary) => void;
  onBaseline: (upload: MigrationUploadSummary) => void;
  isBaselining: boolean;
  onApprove: (upload: MigrationUploadSummary) => void;
  onReject: (upload: MigrationUploadSummary) => void;
}) {
  const isSuperseded = !!upload.supersededBy;
  const canDiscard = DISCARDABLE_STATUSES.includes(upload.status);
  const canDelete = isAdmin && !canDiscard; // Admin can delete validated/reconciled/completed uploads
  const isPendingVerification = upload.status === 'pending_verification';
  const isRejected = upload.status === 'rejected';
  const rejectionReason = isRejected && upload.metadata?.rejectionReason ? String(upload.metadata.rejectionReason) : null;
  const isMdaOfficerUpload = upload.uploadSource === 'mda_officer';

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
          {rejectionReason && (
            <span className="text-xs text-destructive">
              Reason: {rejectionReason}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-text-secondary">
        <div className="flex flex-col gap-0.5">
          <span>{upload.mdaName}</span>
          {isMdaOfficerUpload && (
            <span className="text-xs text-text-muted">Uploaded by MDA Officer</span>
          )}
        </div>
      </td>
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
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {isAdmin && upload.status === 'validated' && (
            <button
              type="button"
              onClick={() => onBaseline(upload)}
              disabled={isBaselining}
              className="p-1.5 rounded-md text-teal hover:bg-teal/10 transition-colors disabled:opacity-50"
              title="Establish baselines"
            >
              <Play className="h-4 w-4" />
            </button>
          )}
          {canDiscard && (
            <button
              type="button"
              onClick={() => onDiscard(upload)}
              className="p-1.5 rounded-md text-text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Discard upload"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(upload)}
              className="p-1.5 rounded-md text-text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Delete upload"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {isPendingVerification && isAdmin && (
            <>
              <button
                type="button"
                onClick={() => onApprove(upload)}
                className="p-1.5 rounded-md text-teal hover:bg-teal/10 transition-colors"
                title="Approve upload"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onReject(upload)}
                className="p-1.5 rounded-md text-text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Reject upload"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
