import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { MdaHeatmapRow } from '@vlprs/shared';

interface SubmissionHeatmapProps {
  rows: MdaHeatmapRow[];
  summary: {
    onTime: number;
    gracePeriod: number;
    awaiting: number;
  };
}

type SortKey = 'complianceRate' | 'mdaName' | 'mdaCode';

const CELL_COLORS: Record<string, string> = {
  'on-time': 'bg-teal-600',       // #0D9488
  'grace-period': 'bg-[#D4A017]', // spec amber — not Tailwind amber-500
  'missing': 'bg-gray-200',       // #E5E7EB
};

function getMonthLabels(): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.toLocaleDateString('en-GB', { month: 'short' });
    const year = d.toLocaleDateString('en-GB', { year: '2-digit' });
    labels.push(`${month} '${year}`);
  }
  return labels;
}

function getMonthKeys(): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function SubmissionHeatmap({ rows, summary }: SubmissionHeatmapProps) {
  const [sortKey, setSortKey] = useState<SortKey>('complianceRate');
  const monthLabels = useMemo(getMonthLabels, []);
  const monthKeys = useMemo(getMonthKeys, []);

  const isEmpty = rows.length === 0 || rows.every((r) => r.cells.length === 0);

  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    switch (sortKey) {
      case 'complianceRate':
        sorted.sort((a, b) => b.complianceRate - a.complianceRate);
        break;
      case 'mdaName':
        sorted.sort((a, b) => a.mdaName.localeCompare(b.mdaName));
        break;
      case 'mdaCode':
        sorted.sort((a, b) => a.mdaCode.localeCompare(b.mdaCode));
        break;
    }
    return sorted;
  }, [rows, sortKey]);

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-sm text-text-secondary">
        <span>On time: <span className="font-medium text-teal-700">{summary.onTime}</span></span>
        <span>Grace period: <span className="font-medium text-amber-700">{summary.gracePeriod}</span></span>
        <span>Awaiting: <span className="font-medium text-text-primary">{summary.awaiting}</span></span>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-text-secondary">Sort by:</span>
        {([
          ['complianceRate', 'Compliance %'],
          ['mdaName', 'Name'],
          ['mdaCode', 'Code'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            className={cn(
              'px-2 py-1 rounded text-text-secondary hover:text-text-primary transition-colors',
              sortKey === key && 'text-text-primary font-medium underline underline-offset-4',
            )}
            onClick={() => setSortKey(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="relative overflow-x-auto">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-white/80">
            <p className="text-sm text-text-secondary italic">
              Submission history will populate as monthly data is received
            </p>
          </div>
        )}

        <div
          className="grid gap-px"
          style={{
            gridTemplateColumns: `minmax(180px, 1fr) repeat(12, 20px)`,
          }}
        >
          {/* Header row */}
          <div className="sticky left-0 bg-white z-10" />
          {monthLabels.map((label, i) => (
            <div
              key={i}
              className="text-[9px] text-text-secondary text-center -rotate-45 origin-bottom-left h-10 flex items-end justify-center"
              title={label}
            >
              {label}
            </div>
          ))}

          {/* Data rows */}
          {sortedRows.map((row) => {
            const cellMap = new Map(row.cells.map((c) => [c.month, c.status]));
            return (
              <div key={row.mdaId} className="contents">
                <div
                  className="sticky left-0 bg-white z-10 text-xs text-text-primary truncate pr-2 flex items-center"
                  title={row.mdaName}
                >
                  {row.mdaName}
                </div>
                {monthKeys.map((monthKey, colIdx) => {
                  const status = cellMap.get(monthKey);
                  const isCurrentMonth = colIdx === monthKeys.length - 1;
                  const isCurrent = status === 'current-pending' || (!status && isCurrentMonth);

                  let bgClass = 'bg-gray-200'; // default: missing/empty
                  if (status && CELL_COLORS[status]) {
                    bgClass = CELL_COLORS[status];
                  }

                  const statusLabel = status
                    ? status.replace('-', ' ')
                    : isEmpty ? 'no data' : 'missing';

                  return (
                    <div
                      key={monthKey}
                      className={cn(
                        'h-[20px] w-[20px] rounded-sm',
                        isCurrent
                          ? 'bg-gradient-to-br from-teal-600/50 to-gray-200'
                          : bgClass,
                      )}
                      title={`${row.mdaName}, ${monthLabels[colIdx]}: ${statusLabel}`}
                      aria-label={`${row.mdaName}, ${monthLabels[colIdx]}: ${statusLabel}`}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-teal-600" />
          <span>On time</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-[#D4A017]" />
          <span>Grace period</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-gray-200" />
          <span>Awaiting</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-sm bg-gradient-to-br from-teal-600/50 to-gray-200" />
          <span>Current month</span>
        </div>
      </div>
    </div>
  );
}
