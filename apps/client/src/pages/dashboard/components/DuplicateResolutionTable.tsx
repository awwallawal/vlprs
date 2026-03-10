/**
 * DuplicateResolutionTable — Displays pending duplicate candidates with resolution actions.
 *
 * Story 3.8: Multi-MDA File Delineation & Deduplication
 */

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDuplicateList, useResolveDuplicate, useTriggerDeduplication } from '@/hooks/useDeduplication';
import { UI_COPY } from '@vlprs/shared';
import type { DuplicateResolution } from '@vlprs/shared';

export function DuplicateResolutionTable() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>('pending');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [noteDialogId, setNoteDialogId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const { data, isPending, isError } = useDuplicateList({
    page,
    pageSize: 20,
    status: statusFilter,
  });
  const resolveMutation = useResolveDuplicate();
  const deduplicateMutation = useTriggerDeduplication();

  const handleResolve = async (
    candidateId: string,
    resolution: DuplicateResolution,
    note?: string,
  ) => {
    setResolvingId(candidateId);
    try {
      await resolveMutation.mutateAsync({ candidateId, resolution, note });
    } finally {
      setResolvingId(null);
      setNoteDialogId(null);
      setNoteText('');
    }
  };

  const handleFlagWithNote = (candidateId: string) => {
    setNoteDialogId(candidateId);
  };

  const confidenceBadge = (confidence: string) => {
    const num = parseFloat(confidence);
    if (num >= 0.9) return <Badge variant="complete" className="text-[10px]">High</Badge>;
    if (num >= 0.7) return <Badge variant="info" className="text-[10px]">Medium</Badge>;
    return <Badge variant="review" className="text-[10px]">Low</Badge>;
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="pending" className="text-[10px]">Pending</Badge>;
      case 'confirmed_multi_mda':
        return <Badge variant="complete" className="text-[10px]">Multi-MDA</Badge>;
      case 'reassigned':
        return <Badge variant="info" className="text-[10px]">Reassigned</Badge>;
      case 'flagged':
        return <Badge variant="review" className="text-[10px]">Flagged</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Potential Duplicates</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Staff appearing in both parent MDA and sub-agency files
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter ?? ''}
            onChange={(e) => {
              setStatusFilter(e.target.value || undefined);
              setPage(1);
            }}
            className="text-xs border border-border rounded px-2 py-1 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed_multi_mda">Confirmed Multi-MDA</option>
            <option value="reassigned">Reassigned</option>
            <option value="flagged">Flagged</option>
          </select>
          <button
            type="button"
            onClick={() => deduplicateMutation.mutate()}
            disabled={deduplicateMutation.isPending}
            className="px-3 py-1 text-xs bg-teal text-white rounded-lg hover:bg-teal-hover disabled:opacity-50"
          >
            {deduplicateMutation.isPending ? 'Scanning...' : 'Run Deduplication'}
          </button>
        </div>
      </div>

      {deduplicateMutation.isSuccess && deduplicateMutation.data && (
        <div className="bg-teal/5 border border-teal/20 rounded-lg p-3 text-xs text-teal">
          Scan complete: {deduplicateMutation.data.detected} new duplicates detected across {deduplicateMutation.data.pairs} parent/agency pair(s).
        </div>
      )}

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : isError ? (
        <p className="text-sm text-text-muted py-4">Failed to load duplicates.</p>
      ) : !data || data.data.length === 0 ? (
        <p className="text-sm text-text-muted py-4">{UI_COPY.DUPLICATE_EMPTY}</p>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Staff Name</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Parent MDA</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Sub-Agency</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Parent Records</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Sub-Agency Records</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Confidence</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Status</th>
                    {statusFilter === 'pending' && (
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((candidate) => (
                    <tr key={candidate.id} className="border-b border-border/50 hover:bg-gray-50">
                      <td className="py-2 px-3 text-sm text-text-primary">{candidate.staffName}</td>
                      <td className="py-2 px-3 text-xs text-text-secondary">{candidate.parentMdaName}</td>
                      <td className="py-2 px-3 text-xs text-text-secondary">{candidate.childMdaName}</td>
                      <td className="py-2 px-3 text-sm text-right">{candidate.parentRecordCount}</td>
                      <td className="py-2 px-3 text-sm text-right">{candidate.childRecordCount}</td>
                      <td className="py-2 px-3">{confidenceBadge(candidate.matchConfidence)}</td>
                      <td className="py-2 px-3">{statusBadge(candidate.status)}</td>
                      {statusFilter === 'pending' && candidate.status === 'pending' && (
                        <td className="py-2 px-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleResolve(candidate.id, 'confirmed_multi_mda')}
                              disabled={resolvingId === candidate.id}
                              className="px-2 py-1 text-[10px] bg-teal/10 text-teal rounded hover:bg-teal/20 disabled:opacity-50"
                              title="Confirm as legitimate multi-MDA staff"
                            >
                              Multi-MDA
                            </button>
                            <button
                              type="button"
                              onClick={() => handleResolve(candidate.id, 'reassigned')}
                              disabled={resolvingId === candidate.id}
                              className="px-2 py-1 text-[10px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                              title="Reassign parent records to sub-agency"
                            >
                              Reassign
                            </button>
                            <button
                              type="button"
                              onClick={() => handleFlagWithNote(candidate.id)}
                              disabled={resolvingId === candidate.id}
                              className="px-2 py-1 text-[10px] bg-gold-50 text-gold-dark rounded hover:bg-gold/20 disabled:opacity-50"
                              title="Flag for further investigation"
                            >
                              Flag
                            </button>
                          </div>
                        </td>
                      )}
                      {statusFilter === 'pending' && candidate.status !== 'pending' && (
                        <td className="py-2 px-3 text-xs text-text-muted">—</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-text-muted">
                  Page {data.pagination.page} of {data.pagination.totalPages}
                  {' '}({data.pagination.total} candidates)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={data.pagination.page <= 1}
                    className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={data.pagination.page >= data.pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Note Dialog for Flag resolution */}
          {noteDialogId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg border border-border p-6 w-full max-w-md">
                <h4 className="text-sm font-semibold text-text-primary mb-3">Flag for Investigation</h4>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Add a note about why this needs investigation..."
                  className="w-full border border-border rounded-lg p-3 text-sm h-24 resize-none"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => { setNoteDialogId(null); setNoteText(''); }}
                    className="px-4 py-2 text-sm text-text-secondary border border-border rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolve(noteDialogId, 'flagged', noteText || undefined)}
                    disabled={resolveMutation.isPending}
                    className="px-4 py-2 text-sm bg-gold text-white rounded-lg hover:bg-gold-dark disabled:opacity-50"
                  >
                    {resolveMutation.isPending ? 'Flagging...' : 'Flag'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
