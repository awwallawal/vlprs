import { useState } from 'react';
import { Edit3, ArrowRight } from 'lucide-react';
import { useEventFlagCorrections } from '@/hooks/useAnnotations';
import { useAuthStore } from '@/stores/authStore';
import { UI_COPY } from '@vlprs/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { timeAgo } from '@/lib/formatters';
import { CorrectEventFlagDialog } from './CorrectEventFlagDialog';

const flagLabels: Record<string, string> = UI_COPY.EVENT_FLAG_LABELS;

interface Props {
  loanId: string;
  currentEventFlag?: string;
}

export function EventFlagCorrections({ loanId, currentEventFlag }: Props) {
  const { data: corrections, isLoading, isError } = useEventFlagCorrections(loanId);
  const user = useAuthStore((s) => s.user);
  const canCorrect = user?.role === 'super_admin' || user?.role === 'dept_admin';
  const [showDialog, setShowDialog] = useState(false);

  // Derive the effective current flag: latest correction's newEventFlag → prop → 'NONE'
  const effectiveFlag = corrections?.[0]?.newEventFlag ?? currentEventFlag ?? 'NONE';

  return (
    <section aria-label="Event Flag Corrections" className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Edit3 className="h-4 w-4 text-text-secondary" />
          <h3 className="text-sm font-semibold text-text-primary">{UI_COPY.CORRECTIONS_HEADER}</h3>
        </div>
        {canCorrect && (
          <Button variant="outline" size="sm" onClick={() => setShowDialog(true)}>
            Correct Event Flag
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-text-muted">Unable to load corrections.</p>
      )}

      {!isLoading && !isError && corrections?.length === 0 && (
        <p className="text-sm text-text-muted">{UI_COPY.NO_CORRECTIONS_YET}</p>
      )}

      {corrections && corrections.length > 0 && (
        <div className="space-y-3">
          {corrections.map((c) => (
            <div key={c.id} className="border-l-2 border-border pl-3">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">{flagLabels[c.originalEventFlag] ?? c.originalEventFlag}</Badge>
                <ArrowRight className="h-3 w-3 text-text-muted" />
                <Badge variant="info">{flagLabels[c.newEventFlag] ?? c.newEventFlag}</Badge>
              </div>
              <p className="text-sm text-text-primary">{c.correctionReason}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                <span className="font-medium text-text-secondary">{c.correctedBy.name}</span>
                <span title={new Date(c.createdAt).toLocaleString()}>{timeAgo(c.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CorrectEventFlagDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        loanId={loanId}
        currentFlag={effectiveFlag}
      />
    </section>
  );
}
