interface MigrationProgressBarProps {
  mdasComplete: number;
  mdasWithData: number;
  totalMdas: number;
}

export function MigrationProgressBar({ mdasComplete, mdasWithData, totalMdas }: MigrationProgressBarProps) {
  const completePct = totalMdas > 0 ? Math.round((mdasComplete / totalMdas) * 100) : 0;
  const dataPct = totalMdas > 0 ? Math.round((mdasWithData / totalMdas) * 100) : 0;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-text-primary">
          {mdasComplete} of {totalMdas} MDAs complete
        </span>
        <span className="text-xs text-text-muted">
          {mdasWithData} with data
        </span>
      </div>
      <div
        className="h-3 w-full rounded-full bg-slate-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={completePct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${mdasComplete} of ${totalMdas} MDAs complete (${completePct}%)`}
      >
        <div className="h-full flex">
          <div
            className="bg-teal transition-all duration-500"
            style={{ width: `${completePct}%` }}
          />
          <div
            className="bg-teal/30 transition-all duration-500"
            style={{ width: `${Math.max(0, dataPct - completePct)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
