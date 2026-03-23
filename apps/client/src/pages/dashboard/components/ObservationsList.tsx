import { useState, useEffect } from 'react';
import { useObservationList, useReviewObservation, useResolveObservation, usePromoteObservation } from '@/hooks/useObservationData';
import { useMigrationStatus, useSupersede } from '@/hooks/useMigrationData';
import { ObservationCard } from './ObservationCard';
import { ReviewDialog } from './ReviewDialog';
import { ResolveDialog } from './ResolveDialog';
import { PromoteDialog } from './PromoteDialog';
import { SupersedeDialog } from './SupersedeDialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCount } from '@/lib/formatters';
import { UI_COPY } from '@vlprs/shared';
import type { ObservationType, ObservationStatus, ObservationListItem } from '@vlprs/shared';

const TYPE_OPTIONS: { value: ObservationType; label: string }[] = [
  { value: 'rate_variance', label: 'Rate Variance' },
  { value: 'stalled_balance', label: 'Stalled Balance' },
  { value: 'negative_balance', label: 'Balance Below Zero' },
  { value: 'multi_mda', label: 'Multi-MDA' },
  { value: 'no_approval_match', label: 'No Approval Match' },
  { value: 'consecutive_loan', label: 'Consecutive Loan' },
  { value: 'period_overlap', label: 'Period Overlap' },
  { value: 'grade_tier_mismatch', label: 'Grade/Tier Review' },
  { value: 'three_way_variance', label: 'Three-Way Variance' },
  { value: 'manual_exception', label: 'Manual Exception' },
];

const STATUS_OPTIONS: { value: ObservationStatus; label: string }[] = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'promoted', label: 'Promoted' },
];

export function ObservationsList() {
  const [type, setType] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [mdaId, setMdaId] = useState<string>('');
  const [staffSearch, setStaffSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  // Dialogs
  const [reviewTarget, setReviewTarget] = useState<string | null>(null);
  const [resolveTarget, setResolveTarget] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<string | null>(null);
  const [supersedeTarget, setSupersedeTarget] = useState<ObservationListItem | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(staffSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [staffSearch]);

  const filters = {
    page,
    pageSize: 25,
    type: type || undefined,
    status: status || undefined,
    mdaId: mdaId || undefined,
    staffName: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
  };

  const { data, isPending } = useObservationList(filters);
  const { data: mdaList } = useMigrationStatus();
  const reviewMutation = useReviewObservation();
  const resolveMutation = useResolveObservation();
  const promoteMutation = usePromoteObservation();
  const supersedeMutation = useSupersede();

  const counts = data?.counts;
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))
        ) : counts ? (
          <>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Total</p>
              <p className="text-lg font-bold font-mono">{formatCount(counts.total)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Unreviewed</p>
              <p className="text-lg font-bold font-mono text-gold-dark">
                {formatCount(counts.byStatus.unreviewed)}
              </p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Reviewed</p>
              <p className="text-lg font-bold font-mono text-teal">
                {formatCount(counts.byStatus.reviewed)}
              </p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Resolved</p>
              <p className="text-lg font-bold font-mono text-success">
                {formatCount(counts.byStatus.resolved)}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Type breakdown badges */}
      {counts && (
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((t) => (
            <Badge
              key={t.value}
              variant="pending"
              className="cursor-pointer"
              onClick={() => {
                setType(type === t.value ? '' : t.value);
                setPage(1);
              }}
            >
              {t.label}: {counts.byType[t.value]}
            </Badge>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by staff name..."
          value={staffSearch}
          onChange={(e) => setStaffSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Types</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={mdaId}
          onChange={(e) => { setMdaId(e.target.value); setPage(1); }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All MDAs</option>
          {mdaList
            ?.filter((m) => m.stage !== 'pending')
            .map((m) => (
              <option key={m.mdaId} value={m.mdaId}>{m.mdaName}</option>
            ))}
        </select>
      </div>

      {/* Observation cards */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : data && data.data.length > 0 ? (
        <div className="space-y-3">
          {data.data.map((obs) => (
            <ObservationCard
              key={obs.id}
              observation={obs}
              onReview={(id) => setReviewTarget(id)}
              onResolve={(id) => setResolveTarget(id)}
              onPromote={(id) => setPromoteTarget(id)}
              onSupersede={(obs) => setSupersedeTarget(obs)}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted py-8 text-center">{UI_COPY.OBSERVATION_EMPTY}</p>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {formatCount(pagination.totalItems)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ReviewDialog
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        onConfirm={(note) => {
          if (reviewTarget) {
            reviewMutation.mutate({ id: reviewTarget, note }, {
              onSuccess: () => setReviewTarget(null),
            });
          }
        }}
        isPending={reviewMutation.isPending}
      />
      <ResolveDialog
        open={!!resolveTarget}
        onClose={() => setResolveTarget(null)}
        onConfirm={(resolutionNote) => {
          if (resolveTarget) {
            resolveMutation.mutate({ id: resolveTarget, resolutionNote }, {
              onSuccess: () => setResolveTarget(null),
            });
          }
        }}
        isPending={resolveMutation.isPending}
      />
      <PromoteDialog
        open={!!promoteTarget}
        onClose={() => setPromoteTarget(null)}
        onConfirm={(priority) => {
          if (promoteTarget) {
            promoteMutation.mutate({ id: promoteTarget, priority }, {
              onSuccess: () => setPromoteTarget(null),
            });
          }
        }}
        isPending={promoteMutation.isPending}
      />
      <SupersedeDialog
        open={!!supersedeTarget}
        observation={supersedeTarget}
        onClose={() => setSupersedeTarget(null)}
        onConfirm={(supersededUploadId, replacementUploadId, reason) => {
          supersedeMutation.mutate({ supersededUploadId, replacementUploadId, reason }, {
            onSuccess: () => setSupersedeTarget(null),
          });
        }}
        isPending={supersedeMutation.isPending}
      />
    </div>
  );
}
