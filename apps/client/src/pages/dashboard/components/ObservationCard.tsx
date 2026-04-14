import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Info, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { formatDateTime } from '@/lib/formatters';
import type { ObservationListItem, ObservationStatus, ObservationType } from '@vlprs/shared';

/** Mirror of server's normalizeName() for personKey construction */
function normalizeStaffName(raw: string): string {
  let name = raw.toUpperCase().trim();
  name = name.replace(/\([^)]*\)/g, '').trim();
  name = name.replace(/\s+/g, ' ');
  for (let i = 0; i < 2; i++) {
    name = name.replace(/^(MRS?\.?|MISS|DR\.?|CHIEF|ALHAJ[IA]\.?|ALH\.?|PRINCE|PRINCESS|ENGR\.?|ARC\.?|PROF\.?|BARR\.?|HON\.?|COMR?A?DE?\.?|COL\.?|GEN\.?|CAPT\.?|PASTOR|REV\.?|ELDER|DEACON(ESS)?|OTUNBA|BAALE)\s+/i, '').trim();
  }
  return name.replace(/[.,]+$/, '').trim();
}

const TYPE_LABELS: Record<ObservationType, string> = {
  rate_variance: 'Rate Variance',
  stalled_balance: 'Stalled Balance',
  negative_balance: 'Balance Below Zero',
  multi_mda: 'Multi-MDA',
  no_approval_match: 'No Approval Match',
  consecutive_loan: 'Consecutive Loan',
  period_overlap: 'Period Overlap',
  grade_tier_mismatch: 'Grade/Tier Review',
  three_way_variance: 'Three-Way Variance',
  manual_exception: 'Manual Exception',
  inactive_loan: 'Inactive Loan',
  post_completion_deduction: 'Post-Completion Deduction',
  within_file_duplicate: 'Within-File Duplicate',
};

const STATUS_VARIANT: Record<ObservationStatus, 'review' | 'info' | 'complete' | 'variance'> = {
  unreviewed: 'review',
  reviewed: 'info',
  resolved: 'complete',
  promoted: 'variance',
};

const STATUS_LABELS: Record<ObservationStatus, string> = {
  unreviewed: 'Unreviewed',
  reviewed: 'Reviewed',
  resolved: 'Resolved',
  promoted: 'Promoted',
};

interface ObservationCardProps {
  observation: ObservationListItem;
  onReview?: (id: string) => void;
  onResolve?: (id: string) => void;
  onPromote?: (id: string) => void;
  onSupersede?: (observation: ObservationListItem) => void;
}

export function ObservationCard({
  observation,
  onReview,
  onResolve,
  onPromote,
  onSupersede,
}: ObservationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const personKey = observation.mdaCode
    ? encodeURIComponent(`${observation.mdaCode}:${normalizeStaffName(observation.staffName)}`)
    : null;

  const handleDrillDown = () => {
    if (observation.loanId && observation.mdaId) {
      navigate(`/dashboard/mda/${observation.mdaId}/loan/${observation.loanId}`);
    } else if (personKey) {
      navigate(`/dashboard/migration/persons/${personKey}`);
    }
  };

  const canDrillDown = !!((observation.loanId && observation.mdaId) || personKey);

  return (
    <div className="rounded-lg bg-attention-bg p-4 transition-colors">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="pending">{TYPE_LABELS[observation.type]}</Badge>
            <Badge variant={STATUS_VARIANT[observation.status]}>
              {STATUS_LABELS[observation.status]}
            </Badge>
          </div>

          {/* Staff and MDA */}
          <div className="flex items-center gap-2 mb-1">
            {canDrillDown ? (
              <button
                type="button"
                onClick={handleDrillDown}
                className="group inline-flex items-center gap-1 text-sm font-medium text-teal hover:text-teal/80 hover:underline transition-colors"
                title={observation.loanId ? 'Open loan detail' : 'Open staff profile'}
              >
                {observation.staffName}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ) : (
              <span className="text-sm font-medium text-text-primary">{observation.staffName}</span>
            )}
            <span className="text-xs text-text-muted">{observation.mdaName}</span>
          </div>

          {/* Description */}
          <p className="text-sm text-text-secondary mb-2">{observation.description}</p>

          {/* Expandable section */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-teal hover:text-teal/80 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Hide details' : 'Show details'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-3 text-sm">
              {/* Possible explanations */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-1">Possible explanations:</p>
                <ul className="list-disc list-inside space-y-0.5 text-text-secondary text-xs">
                  {observation.context.possibleExplanations.map((exp, i) => (
                    <li key={i}>{exp}</li>
                  ))}
                </ul>
              </div>

              {/* Suggested next step */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-1">Suggested next step:</p>
                <p className="text-xs text-text-secondary">{observation.context.suggestedAction}</p>
              </div>

              {/* Data completeness */}
              <div>
                <p className="text-xs font-medium text-text-muted mb-1">
                  Data completeness: {observation.context.dataCompleteness}%
                  <MetricHelp metric="observation.dataCompleteness" />
                </p>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className="bg-teal rounded-full h-1.5 transition-all"
                    style={{ width: `${observation.context.dataCompleteness}%` }}
                  />
                </div>
                {observation.context.completenessNote && <p className="text-xs text-text-muted mt-1">{observation.context.completenessNote}</p>}
              </div>

              {/* Source reference */}
              {observation.sourceReference && (
                <p className="text-xs text-text-muted">
                  Source: {observation.sourceReference.file}
                  {observation.sourceReference.sheet && ` > ${observation.sourceReference.sheet}`}
                  {observation.sourceReference.row > 0 && ` > Row ${observation.sourceReference.row}`}
                </p>
              )}

              {/* Resolution note */}
              {observation.resolutionNote && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">Resolution:</p>
                  <p className="text-xs text-text-secondary">{observation.resolutionNote}</p>
                </div>
              )}

              {/* Reviewer note */}
              {observation.reviewerNote && (
                <div>
                  <p className="text-xs font-medium text-text-muted mb-1">Reviewer note:</p>
                  <p className="text-xs text-text-secondary">{observation.reviewerNote}</p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-3">
            {observation.type === 'period_overlap' && observation.status === 'unreviewed' && onSupersede && (
              <Button
                variant="secondary"
                size="sm"
                className="text-amber-700 border-amber-300 hover:bg-amber-50"
                onClick={() => onSupersede(observation)}
              >
                Supersede Previous Upload
              </Button>
            )}
            {observation.status === 'unreviewed' && onReview && (
              <Button variant="secondary" size="sm" onClick={() => onReview(observation.id)}>
                Mark as Reviewed
              </Button>
            )}
            {observation.status === 'reviewed' && (
              <>
                {onResolve && (
                  <Button variant="secondary" size="sm" onClick={() => onResolve(observation.id)}>
                    Mark as Resolved
                  </Button>
                )}
                {onPromote && (
                  <Button variant="secondary" size="sm" onClick={() => onPromote(observation.id)}>
                    Promote to Exception
                  </Button>
                )}
              </>
            )}
            {observation.status === 'unreviewed' && onPromote && (
              <Button variant="secondary" size="sm" onClick={() => onPromote(observation.id)}>
                Promote to Exception
              </Button>
            )}
            {observation.status === 'resolved' && (
              <span className="text-xs text-success">Resolved{observation.resolvedAt ? ` ${formatDateTime(observation.resolvedAt)}` : ''}</span>
            )}
            {observation.status === 'promoted' && (
              <span className="text-xs text-teal">Promoted to Exception</span>
            )}
          </div>

          {/* Timestamp */}
          <time className="text-xs text-text-muted mt-1 block">{formatDateTime(observation.createdAt)}</time>
        </div>
      </div>
    </div>
  );
}
