import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useExceptionDetail, useResolveException } from '@/hooks/useExceptionData';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDateTime } from '@/lib/formatters';
import { UI_COPY } from '@vlprs/shared';
import type { ExceptionActionTaken } from '@vlprs/shared';

const priorityConfig = {
  high: { label: 'High', variant: 'outline' as const },
  medium: { label: 'Medium', variant: 'review' as const },
  low: { label: 'Low', variant: 'info' as const },
};

const ACTION_LABELS: Record<string, string> = {
  verified_correct: 'Verified Correct',
  adjusted_record: 'Adjusted Record',
  referred_to_mda: 'Referred to MDA',
  no_action_required: 'No Action Required',
};

export function ExceptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: detail, isPending } = useExceptionDetail(id!);
  const [resolveOpen, setResolveOpen] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!detail) {
    return <p className="text-text-secondary">Exception not found.</p>;
  }

  const config = priorityConfig[detail.priority];
  const isOpen = detail.status === 'open';

  return (
    <div className="space-y-8">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 -ml-2 text-text-secondary"
        onClick={() => navigate('/dashboard/exceptions')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Exception Queue
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="h-6 w-6 text-gold" />
        <h1 className="text-xl font-bold text-text-primary">Exception Detail</h1>
        <Badge variant={config.variant}>{config.label}</Badge>
        <Badge variant={isOpen ? 'review' : 'complete'}>
          {isOpen ? 'Open' : 'Resolved'}
        </Badge>
      </div>

      {/* Exception Info */}
      <section className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Exception Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-secondary">Category</p>
            <p className="font-medium">{detail.category.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-text-secondary">Staff</p>
            <p className="font-medium">{detail.staffName} {detail.staffId ? `(${detail.staffId})` : ''}</p>
          </div>
          <div>
            <p className="text-text-secondary">MDA</p>
            <p className="font-medium">{detail.mdaName}</p>
          </div>
          <div>
            <p className="text-text-secondary">Flagged By</p>
            <p className="font-medium">{detail.promotedByName}</p>
          </div>
          <div>
            <p className="text-text-secondary">Created</p>
            <p className="font-medium">{formatDateTime(detail.createdAt)}</p>
          </div>
        </div>
        {detail.flagNotes && (
          <div>
            <p className="text-text-secondary text-sm">Notes</p>
            <p className="mt-1 text-sm bg-surface rounded p-3">{detail.flagNotes}</p>
          </div>
        )}
        <div>
          <p className="text-text-secondary text-sm">Description</p>
          <p className="mt-1 text-sm">{detail.description}</p>
        </div>
      </section>

      {/* Linked Loan */}
      {detail.loan && (
        <section className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Linked Loan</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-text-secondary">Staff</p>
              <p className="font-medium">{detail.loan.staffName} {detail.loan.staffId ? `(${detail.loan.staffId})` : ''}</p>
            </div>
            <div>
              <p className="text-text-secondary">MDA</p>
              <p className="font-medium">{detail.loan.mdaName}</p>
            </div>
            <div>
              <p className="text-text-secondary">Loan Reference</p>
              <p className="font-medium font-mono">{detail.loan.loanReference ?? '—'}</p>
            </div>
            <div>
              <p className="text-text-secondary">Principal</p>
              <NairaDisplay amount={detail.loan.principal} variant="body" />
            </div>
            <div>
              <p className="text-text-secondary">Outstanding Balance</p>
              <NairaDisplay amount={detail.loan.outstandingBalance} variant="body" />
            </div>
            <div>
              <p className="text-text-secondary">Loan Status</p>
              <p className="font-medium">{detail.loan.status}</p>
            </div>
          </div>
        </section>
      )}

      {/* Originating Observation */}
      <section className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Originating Observation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-secondary">Type</p>
            <p className="font-medium">{detail.observation.type.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-text-secondary">Status</p>
            <p className="font-medium">{detail.observation.status}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-text-secondary">Description</p>
            <p className="mt-1 text-sm">{detail.observation.description}</p>
          </div>
        </div>
      </section>

      {/* Resolution (if resolved) */}
      {!isOpen && detail.resolutionNote && (
        <section className="rounded-lg border border-success/30 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h2 className="text-lg font-semibold text-text-primary">Resolution</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-text-secondary">Resolved By</p>
              <p className="font-medium">{detail.resolvedByName}</p>
            </div>
            <div>
              <p className="text-text-secondary">Resolved At</p>
              <p className="font-medium">{detail.resolvedAt ? formatDateTime(detail.resolvedAt) : '—'}</p>
            </div>
            <div>
              <p className="text-text-secondary">Action Taken</p>
              <p className="font-medium">{detail.actionTaken ? ACTION_LABELS[detail.actionTaken] || detail.actionTaken : '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-text-secondary text-sm">Resolution Note</p>
            <p className="mt-1 text-sm bg-surface rounded p-3">{detail.resolutionNote}</p>
          </div>
        </section>
      )}

      {/* Resolve Button */}
      {isOpen && (
        <div className="flex justify-end">
          <Button onClick={() => setResolveOpen(true)}>Resolve Exception</Button>
        </div>
      )}

      {/* Audit Trail */}
      {detail.auditTrail.length > 0 && (
        <section className="rounded-lg border bg-white p-6 space-y-4">
          <h2 className="text-lg font-semibold text-text-primary">Audit Trail</h2>
          <div className="space-y-2">
            {detail.auditTrail.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 text-sm border-b last:border-0 pb-2">
                <span className="font-mono text-text-muted text-xs w-40 shrink-0">{formatDateTime(entry.timestamp)}</span>
                <Badge variant="pending">{entry.action.replace(/_/g, ' ')}</Badge>
                <span className="text-text-secondary">{entry.userName}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Resolve Dialog */}
      <ResolveDialog
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        exceptionId={id!}
      />
    </div>
  );
}

function ResolveDialog({ open, onOpenChange, exceptionId }: { open: boolean; onOpenChange: (v: boolean) => void; exceptionId: string }) {
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [action, setAction] = useState<ExceptionActionTaken | ''>('');
  const resolveMutation = useResolveException();

  const isValid = note.length >= 10 && action !== '';

  function handleSubmit() {
    if (!isValid || !action) return;
    resolveMutation.mutate(
      { id: exceptionId, resolutionNote: note, actionTaken: action },
      {
        onSuccess: () => {
          toast.success('Exception resolved');
          onOpenChange(false);
          navigate('/dashboard/exceptions');
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to resolve exception');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Resolve Exception</DialogTitle>
          <DialogDescription>{UI_COPY.EXCEPTION_RESOLVE_PROMPT}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">Action Taken</label>
            <Select value={action} onValueChange={(v) => setAction(v as ExceptionActionTaken)}>
              <SelectTrigger>
                <SelectValue placeholder="Select action..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="verified_correct">Verified Correct</SelectItem>
                <SelectItem value="adjusted_record">Adjusted Record</SelectItem>
                <SelectItem value="referred_to_mda">Referred to MDA</SelectItem>
                <SelectItem value="no_action_required">No Action Required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-text-primary">
              Resolution Note <span className="text-text-muted">(min 10 characters)</span>
            </label>
            <Textarea
              placeholder="Describe the resolution..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-text-muted">{note.length}/10 characters minimum</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || resolveMutation.isPending}
          >
            {resolveMutation.isPending ? 'Resolving...' : 'Resolve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { ExceptionDetailPage as Component };
