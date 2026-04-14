import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Info, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { UI_COPY, VOCABULARY } from '@vlprs/shared';
import type { PreSubmissionCheckpoint as CheckpointData, RetirementItem, ZeroDeductionItem, PendingEventItem } from '@vlprs/shared';

const PAGE_SIZE = 25;

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
          emptyMessage={UI_COPY.CHECKPOINT_EMPTY_RETIREMENT}
        >
          <RetirementTable items={data.approachingRetirement} />
        </CheckpointSection>

        {/* Zero Deduction Review */}
        <CheckpointSection
          heading={UI_COPY.CHECKPOINT_ZERO_DEDUCTION_HEADING}
          count={zeroDeductionCount}
          iconColor="text-[#D4A017]"
          bgColor="bg-amber-50"
          isEmpty={zeroDeductionCount === 0}
          emptyMessage={UI_COPY.CHECKPOINT_EMPTY_ZERO_DEDUCTION}
        >
          <ZeroDeductionTable items={data.zeroDeduction} />
        </CheckpointSection>

        {/* Pending Events */}
        <CheckpointSection
          heading={UI_COPY.CHECKPOINT_PENDING_EVENTS_HEADING}
          count={pendingEventsCount}
          iconColor="text-[#0D7377]"
          bgColor="bg-teal-50"
          isEmpty={pendingEventsCount === 0}
          emptyMessage={UI_COPY.CHECKPOINT_EMPTY_PENDING_EVENTS}
        >
          <PendingEventsTable items={data.pendingEvents} />
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
  emptyMessage: string;
  children: React.ReactNode;
}

function CheckpointSection({ heading, count, iconColor, bgColor, isEmpty, emptyMessage, children }: CheckpointSectionProps) {
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
                <span className="text-sm text-text-secondary">{emptyMessage}</span>
              </div>
            ) : (
              <div className={`rounded-md ${bgColor} p-3`}>
                {children}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Generic sort / pagination helpers ───────────────────────────

type SortOrder = 'asc' | 'desc';

function useSortedPaginated<T>(items: T[], defaultSortKey: string & keyof T) {
  const [sortBy, setSortBy] = useState<string>(defaultSortKey as string);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [page, setPage] = useState(1);

  // Reset to page 1 when items change (e.g., re-fetch returns fewer items)
  useEffect(() => { setPage(1); }, [items.length]);

  const sorted = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const aVal = a[sortBy as keyof T];
      const bVal = b[sortBy as keyof T];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
    return copy;
  }, [items, sortBy, sortOrder]);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setPage(1);
  }

  function sortIcon(key: string) {
    if (sortBy !== key) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-text-secondary/50" />;
    return sortOrder === 'asc'
      ? <ArrowUp className="ml-1 inline h-3 w-3 text-text-primary" />
      : <ArrowDown className="ml-1 inline h-3 w-3 text-text-primary" />;
  }

  return { paginated, page, setPage, totalPages, handleSort, sortIcon, showPagination: totalPages > 1 };
}

function PaginationControls({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  return (
    <div className="flex items-center justify-between pt-2">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={page <= 1}
        onClick={() => setPage(page - 1)}
      >
        <ChevronLeft className="h-3 w-3" /> Previous
      </button>
      <span className="text-xs text-text-secondary">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={page >= totalPages}
        onClick={() => setPage(page + 1)}
      >
        Next <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── Retirement table ────────────────────────────────────────────

function RetirementTable({ items }: { items: RetirementItem[] }) {
  const { paginated, page, setPage, totalPages, handleSort, sortIcon, showPagination } = useSortedPaginated(items, 'daysUntilRetirement');

  return (
    <>
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b bg-white/50">
            <th className="px-3 py-2 text-left font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('staffName')}>
              Staff Name {sortIcon('staffName')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('staffId')}>
              Staff ID {sortIcon('staffId')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('retirementDate')}>
              Retirement Date {sortIcon('retirementDate')}
            </th>
            <th className="px-3 py-2 text-right font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('daysUntilRetirement')}>
              Days Until {sortIcon('daysUntilRetirement')}
            </th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((item) => (
            <tr key={item.staffId} className="border-b last:border-b-0 hover:bg-white/30">
              <td className="px-3 py-2 font-medium">{item.staffName}</td>
              <td className="px-3 py-2 font-mono text-text-secondary">{item.staffId}</td>
              <td className="px-3 py-2 text-text-secondary">{item.retirementDate}</td>
              <td className="px-3 py-2 text-right font-mono">{item.daysUntilRetirement}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showPagination && <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />}
    </>
  );
}

// ─── Zero Deduction table ────────────────────────────────────────

function ZeroDeductionTable({ items }: { items: ZeroDeductionItem[] }) {
  const { paginated, page, setPage, totalPages, handleSort, sortIcon, showPagination } = useSortedPaginated(items, 'daysSinceLastDeduction');

  return (
    <>
      <table className="w-full text-sm" role="table">
        <thead>
          <tr className="border-b bg-white/50">
            <th className="px-3 py-2 text-left font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('staffName')}>
              Staff Name {sortIcon('staffName')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('staffId')}>
              Staff ID {sortIcon('staffId')}
            </th>
            <th className="px-3 py-2 text-left font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('lastDeductionDate')}>
              Last Deduction {sortIcon('lastDeductionDate')}
            </th>
            <th className="px-3 py-2 text-right font-medium text-text-secondary cursor-pointer select-none" onClick={() => handleSort('daysSinceLastDeduction')}>
              Days Since {sortIcon('daysSinceLastDeduction')}
            </th>
          </tr>
        </thead>
        <tbody>
          {paginated.map((item) => (
            <tr key={item.staffId} className="border-b last:border-b-0 hover:bg-white/30">
              <td className="px-3 py-2 font-medium">{item.staffName}</td>
              <td className="px-3 py-2 font-mono text-text-secondary">{item.staffId}</td>
              <td className="px-3 py-2 text-text-secondary">
                {item.lastDeductionDate === 'N/A' ? '—' : new Date(item.lastDeductionDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </td>
              <td className="px-3 py-2 text-right font-mono">{item.daysSinceLastDeduction != null ? `${item.daysSinceLastDeduction}d` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {showPagination && <PaginationControls page={page} totalPages={totalPages} setPage={setPage} />}
    </>
  );
}

// ─── Pending Events table ────────────────────────────────────────

function PendingEventsTable({ items }: { items: PendingEventItem[] }) {
  const navigate = useNavigate();

  const STATUS_STYLE: Record<string, string> = {
    OVERDUE: 'bg-amber-100 text-amber-800',
    PENDING: 'bg-gold/10 text-gold',
    UNCONFIRMED: 'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={`${item.eventType}-${i}`}
          className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${item.actionUrl ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
          role={item.actionUrl ? 'link' : undefined}
          tabIndex={item.actionUrl ? 0 : undefined}
          onClick={() => item.actionUrl && navigate(item.actionUrl)}
          onKeyDown={(e) => { if (item.actionUrl && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); navigate(item.actionUrl!); } }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${item.reconciliationStatus === 'OVERDUE' ? 'text-amber-600' : 'text-gold'}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">{item.description ?? item.eventType}</p>
              <p className="text-xs text-text-muted mt-0.5">{item.staffName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[item.reconciliationStatus] ?? STATUS_STYLE.PENDING}`}>
              {item.reconciliationStatus === 'OVERDUE' ? 'Overdue' : item.reconciliationStatus === 'UNCONFIRMED' ? 'Unconfirmed' : 'Pending'}
            </span>
            {item.actionUrl && <ArrowRight className="h-4 w-4 text-text-muted" />}
          </div>
        </div>
      ))}
    </div>
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
