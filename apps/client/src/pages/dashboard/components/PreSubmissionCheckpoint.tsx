import { Info, CheckCircle2, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { UI_COPY, VOCABULARY } from '@vlprs/shared';
import type { PreSubmissionCheckpoint as CheckpointData, RetirementItem, ZeroDeductionItem, PendingEventItem } from '@vlprs/shared';

const MAX_ITEMS_PER_SECTION = 50;

interface PreSubmissionCheckpointProps {
  data: CheckpointData | undefined;
  isLoading: boolean;
  isError: boolean;
  onConfirm: (checked: boolean) => void;
  confirmed: boolean;
}

export function PreSubmissionCheckpoint({
  data,
  isLoading,
  isError,
  onConfirm,
  confirmed,
}: PreSubmissionCheckpointProps) {
  if (isLoading) {
    return <CheckpointSkeleton />;
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-sm text-text-secondary" role="alert">
        {VOCABULARY.CHECKPOINT_LOAD_FAILED}
      </div>
    );
  }

  if (!data) return null;

  const retirementCount = data.approachingRetirement.length;
  const zeroDeductionCount = data.zeroDeduction.length;
  const pendingEventsCount = data.pendingEvents.length;

  return (
    <section aria-labelledby="checkpoint-heading">
      <h2 id="checkpoint-heading" className="text-lg font-semibold text-text-primary mb-3">
        {UI_COPY.CHECKPOINT_HEADING}
      </h2>

      <div className="space-y-3">
        {/* Approaching Retirement */}
        <CheckpointSection
          heading={UI_COPY.CHECKPOINT_RETIREMENT_HEADING}
          count={retirementCount}
          iconColor="text-[#0D7377]"
          bgColor="bg-teal-50"
          isEmpty={retirementCount === 0}
        >
          {data.approachingRetirement.slice(0, MAX_ITEMS_PER_SECTION).map((item) => (
            <RetirementRow key={item.staffId} item={item} />
          ))}
          {retirementCount > MAX_ITEMS_PER_SECTION && (
            <OverflowFooter total={retirementCount} shown={MAX_ITEMS_PER_SECTION} />
          )}
        </CheckpointSection>

        {/* Zero Deduction Review */}
        <CheckpointSection
          heading={UI_COPY.CHECKPOINT_ZERO_DEDUCTION_HEADING}
          count={zeroDeductionCount}
          iconColor="text-[#D4A017]"
          bgColor="bg-amber-50"
          isEmpty={zeroDeductionCount === 0}
        >
          {data.zeroDeduction.slice(0, MAX_ITEMS_PER_SECTION).map((item) => (
            <ZeroDeductionRow key={item.staffId} item={item} />
          ))}
          {zeroDeductionCount > MAX_ITEMS_PER_SECTION && (
            <OverflowFooter total={zeroDeductionCount} shown={MAX_ITEMS_PER_SECTION} />
          )}
        </CheckpointSection>

        {/* Pending Events */}
        <CheckpointSection
          heading={UI_COPY.CHECKPOINT_PENDING_EVENTS_HEADING}
          count={pendingEventsCount}
          iconColor="text-[#0D7377]"
          bgColor="bg-teal-50"
          isEmpty={pendingEventsCount === 0}
        >
          {data.pendingEvents.slice(0, MAX_ITEMS_PER_SECTION).map((item, i) => (
            <PendingEventRow key={`${item.staffName}-${item.effectiveDate}-${i}`} item={item} />
          ))}
          {pendingEventsCount > MAX_ITEMS_PER_SECTION && (
            <OverflowFooter total={pendingEventsCount} shown={MAX_ITEMS_PER_SECTION} />
          )}
        </CheckpointSection>
      </div>

      {/* Confirmation checkbox */}
      <label className="mt-4 flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => onConfirm(e.target.checked)}
          className="h-4 w-4 rounded border-border text-teal accent-teal focus:ring-teal"
        />
        <span className="text-sm text-text-primary">
          {UI_COPY.CHECKPOINT_CONFIRMATION_LABEL}
        </span>
      </label>
    </section>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────

interface CheckpointSectionProps {
  heading: string;
  count: number;
  iconColor: string;
  bgColor: string;
  isEmpty: boolean;
  children: React.ReactNode;
}

function CheckpointSection({ heading, count, iconColor, bgColor, isEmpty, children }: CheckpointSectionProps) {
  return (
    <Collapsible defaultOpen>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Info className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
            <h3 className="text-sm font-semibold text-text-primary">{heading}</h3>
          </div>
          <div className="flex items-center gap-2">
            {!isEmpty && (
              <span className="text-xs text-text-secondary">{count} item{count !== 1 ? 's' : ''}</span>
            )}
            <ChevronDown className="h-4 w-4 text-text-secondary transition-transform [[data-state=closed]_&]:-rotate-90" aria-hidden="true" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">
            {isEmpty ? (
              <div className="flex items-center gap-2 rounded-md bg-green-50 p-3">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" aria-hidden="true" />
                <span className="text-sm text-text-secondary">{UI_COPY.CHECKPOINT_EMPTY_SECTION}</span>
              </div>
            ) : (
              <div className={`rounded-md ${bgColor} p-3 space-y-2`}>
                {children}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Row renderers ────────────────────────────────────────────────

function RetirementRow({ item }: { item: RetirementItem }) {
  return (
    <div className="flex items-start gap-3">
      <Info className="h-4 w-4 shrink-0 text-[#0D7377] mt-0.5" aria-hidden="true" />
      <div className="text-sm text-text-primary">
        <span className="font-medium">{item.staffName}</span>
        <span className="text-text-secondary"> ({item.staffId})</span>
        <span className="text-text-secondary"> — Retirement: {item.retirementDate}</span>
        <span className="text-text-muted"> ({item.daysUntilRetirement} days)</span>
      </div>
    </div>
  );
}

function ZeroDeductionRow({ item }: { item: ZeroDeductionItem }) {
  return (
    <div className="flex items-start gap-3">
      <Info className="h-4 w-4 shrink-0 text-[#D4A017] mt-0.5" aria-hidden="true" />
      <div className="text-sm text-text-primary">
        <span className="font-medium">{item.staffName}</span>
        <span className="text-text-secondary"> ({item.staffId})</span>
        <span className="text-text-secondary"> — Last deduction: {item.lastDeductionDate}</span>
        {item.daysSinceLastDeduction !== null && (
          <span className="text-text-muted"> ({item.daysSinceLastDeduction} days ago)</span>
        )}
      </div>
    </div>
  );
}

function PendingEventRow({ item }: { item: PendingEventItem }) {
  return (
    <div className="flex items-start gap-3">
      <Info className="h-4 w-4 shrink-0 text-[#0D7377] mt-0.5" aria-hidden="true" />
      <div className="text-sm text-text-primary">
        <span className="font-medium">{item.eventType}</span>
        <span className="text-text-secondary"> — {item.staffName}</span>
        <span className="text-text-secondary"> ({item.effectiveDate})</span>
      </div>
    </div>
  );
}

// ─── Overflow footer ──────────────────────────────────────────────

function OverflowFooter({ total, shown }: { total: number; shown: number }) {
  return (
    <p className="text-xs text-text-muted pt-1">
      ...and {total - shown} more
    </p>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────

function CheckpointSkeleton() {
  return (
    <div className="space-y-3" data-testid="checkpoint-skeleton">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <div className="p-4 pb-2">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="px-4 pb-4">
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}
