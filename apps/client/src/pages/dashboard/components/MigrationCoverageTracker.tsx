import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useMigrationCoverage } from '@/hooks/useMigrationData';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCount } from '@/lib/formatters';
import { Download, FileText } from 'lucide-react';
import { MetricHelp } from '@/components/shared/MetricHelp';
import type { CoverageMdaRow, CoverageMatrix } from '@vlprs/shared';

/** Generate an array of 'YYYY-MM' strings between start and end inclusive */
function generateMonthRange(start: string, end: string): string[] {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const months: string[] = [];
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

function cellStatus(mda: CoverageMdaRow, period: string): 'complete' | 'partial' | 'gap' {
  const data = mda.periods[period];
  if (!data || data.recordCount === 0) return 'gap';
  if (data.baselinedCount >= data.recordCount) return 'complete';
  return 'partial';
}

const CELL_COLORS = {
  complete: 'bg-emerald-500',
  partial: 'bg-amber-400',
  gap: 'bg-gray-100',
} as const;

// ─── CSV Export ──────────────────────────────────────────────────────

function generateCsv(data: CoverageMatrix, months: string[], mdaSummaries: Map<string, { covered: number; gaps: number }>): string {
  const headers = ['MDA Name', ...months, 'Months Covered', 'Gaps'];
  const rows = data.mdas.map((mda) => {
    const summary = mdaSummaries.get(mda.mdaId);
    return [
      mda.mdaName,
      ...months.map((m) => String(mda.periods[m]?.recordCount ?? 0)),
      String(summary?.covered ?? 0),
      String(summary?.gaps ?? 0),
    ];
  });

  // Summary row
  const summaryRow = [
    'Total MDAs with data',
    ...months.map((m) => {
      let count = 0;
      for (const mda of data.mdas) {
        if (mda.periods[m] && mda.periods[m].recordCount > 0) count++;
      }
      return String(count);
    }),
    '',
    '',
  ];
  rows.push(summaryRow);

  return [headers, ...rows].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// ─── PDF Export (print-based) ────────────────────────────────────────

function generatePdfHtml(
  data: CoverageMatrix,
  months: string[],
  mdaSummaries: Map<string, { covered: number; gaps: number }>,
  roleName: string,
): string {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const totalMdas = data.mdas.length;
  const totalGaps = Array.from(mdaSummaries.values()).reduce((sum, s) => sum + s.gaps, 0);

  const headerRow = `<tr style="background:#f9fafb;">
    <th style="text-align:left;padding:4px 8px;font-size:10px;position:sticky;left:0;background:#f9fafb;min-width:160px;">MDA</th>
    ${months.map((m) => `<th style="font-size:8px;padding:2px;text-align:center;writing-mode:vertical-lr;height:50px;">${m}</th>`).join('')}
    <th style="font-size:10px;padding:4px;text-align:center;min-width:60px;">Coverage</th>
  </tr>`;

  const dataRows = data.mdas.map((mda) => {
    const summary = mdaSummaries.get(mda.mdaId);
    const cells = months.map((m) => {
      const d = mda.periods[m];
      if (!d || d.recordCount === 0) return `<td style="padding:2px;text-align:center;"><div style="width:14px;height:12px;background:#e5e7eb;border-radius:2px;margin:auto;"></div></td>`;
      if (d.baselinedCount >= d.recordCount) return `<td style="padding:2px;text-align:center;"><div style="width:14px;height:12px;background:#10b981;border-radius:2px;margin:auto;"></div></td>`;
      return `<td style="padding:2px;text-align:center;"><div style="width:14px;height:12px;background:#f59e0b;border-radius:2px;margin:auto;"></div></td>`;
    }).join('');
    return `<tr>
      <td style="padding:4px 8px;font-size:10px;white-space:nowrap;"><strong>${mda.mdaCode}</strong> ${mda.mdaName}</td>
      ${cells}
      <td style="text-align:center;font-size:10px;font-family:monospace;">${summary?.covered ?? 0}/${months.length}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html><head><title>VLPRS Migration Coverage Tracker</title>
<style>
  @page { size: landscape; margin: 15mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #1a1a2e; }
  h1 { font-size: 18px; color: #0d9488; margin: 0; }
  .meta { font-size: 10px; color: #666; margin: 4px 0; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #e5e7eb; }
  .legend { display: flex; gap: 16px; font-size: 10px; margin: 8px 0; }
  .legend span { display: flex; align-items: center; gap: 4px; }
  .legend-dot { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .stats { font-size: 10px; color: #666; margin-top: 8px; }
</style>
</head><body onload="window.print()">
  <h1>VLPRS — Migration Coverage Tracker</h1>
  <p class="meta">Oyo State Vehicle Loan Processing & Receivables System</p>
  <p class="meta">Generated: ${date} | Role: ${roleName} | Period: ${data.periodRange.start} to ${data.periodRange.end}</p>
  <div class="legend">
    <span><span class="legend-dot" style="background:#10b981;"></span> Baselined</span>
    <span><span class="legend-dot" style="background:#f59e0b;"></span> Partial</span>
    <span><span class="legend-dot" style="background:#e5e7eb;"></span> Gap</span>
  </div>
  <table>${headerRow}${dataRows}</table>
  <p class="stats">${totalMdas} MDAs | ${months.length} months | ${totalGaps} total gap-months</p>
</body></html>`;
}

export function MigrationCoverageTracker() {
  const [extended, setExtended] = useState(false);
  const { data, isPending, isError } = useMigrationCoverage(extended);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const months = useMemo(() => {
    if (!data) return [];
    return generateMonthRange(data.periodRange.start, data.periodRange.end);
  }, [data]);

  // Compute summary stats
  const summaryPerMonth = useMemo(() => {
    if (!data) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const month of months) {
      let count = 0;
      for (const mda of data.mdas) {
        const d = mda.periods[month];
        if (d && d.recordCount > 0) count++;
      }
      map.set(month, count);
    }
    return map;
  }, [data, months]);

  const mdaSummaries = useMemo(() => {
    if (!data) return new Map<string, { covered: number; gaps: number }>();
    const map = new Map<string, { covered: number; gaps: number }>();
    for (const mda of data.mdas) {
      let covered = 0;
      let gaps = 0;
      for (const month of months) {
        const d = mda.periods[month];
        if (d && d.recordCount > 0) covered++;
        else gaps++;
      }
      map.set(mda.mdaId, { covered, gaps });
    }
    return map;
  }, [data, months]);

  const handleCsvExport = useCallback(() => {
    if (!data) return;
    const csv = generateCsv(data, months, mdaSummaries);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `vlprs-coverage-tracker-${date}.csv`);
  }, [data, months, mdaSummaries]);

  const handlePdfExport = useCallback(() => {
    if (!data) return;
    const roleName = user?.role?.replaceAll('_', ' ').toUpperCase() ?? 'USER';
    const html = generatePdfHtml(data, months, mdaSummaries, roleName);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      // Popup blocked — fall back to Blob download
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'migration-coverage-report.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.success('PDF generated — check your downloads folder');
    }
  }, [data, months, mdaSummaries, user]);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-red-600 py-4">Unable to load coverage data. Please try again later.</p>
    );
  }

  if (!data || data.mdas.length === 0) {
    return (
      <p className="text-sm text-text-muted py-4">No migration data available.</p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={extended}
            onChange={(e) => setExtended(e.target.checked)}
            className="rounded border-gray-300"
          />
          Extended View (include 2017/2018)
        </label>

        {/* Export Buttons */}
        <Button variant="secondary" size="sm" onClick={handleCsvExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={handlePdfExport} className="gap-1.5">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          Download PDF
        </Button>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" /> Baselined
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" /> Partial
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-gray-100 border border-gray-200" /> Gap
          </span>
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse" style={{ minWidth: `${months.length * 28 + 200 + 100}px` }}>
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                <th
                  className="py-2 px-3 text-left font-semibold text-text-muted uppercase sticky left-0 bg-gray-50 z-10 min-w-[180px]"
                >
                  MDA
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className="py-1 px-0.5 text-center font-normal text-text-muted whitespace-nowrap"
                    style={{ writingMode: 'vertical-lr', height: '60px', fontSize: '9px' }}
                  >
                    {m}
                  </th>
                ))}
                <th className="py-2 px-2 text-center font-semibold text-text-muted uppercase min-w-[80px]">
                  Coverage <MetricHelp metric="migration.coverage" />
                </th>
              </tr>
            </thead>
            <tbody>
              {data.mdas.map((mda) => {
                const summary = mdaSummaries.get(mda.mdaId);
                return (
                  <tr key={mda.mdaId} className="border-b border-border/50 hover:bg-slate-50/50">
                    <td
                      className="py-1.5 px-3 font-medium text-text-primary sticky left-0 bg-white z-10 whitespace-nowrap"
                      title={`${mda.mdaCode} — ${mda.mdaName}`}
                    >
                      <span className="font-mono text-text-muted mr-1">{mda.mdaCode}</span>
                      {mda.mdaName}
                    </td>
                    {months.map((month) => {
                      const status = cellStatus(mda, month);
                      const periodData = mda.periods[month];
                      const hasData = periodData && periodData.recordCount > 0;
                      const isOfficerUpload = periodData?.uploadSource === 'mda_officer';
                      const isMixedSource = periodData?.uploadSource === 'mixed';
                      const sourceLabel = isMixedSource ? ' (mixed sources: admin + MDA officer)' : isOfficerUpload ? ' (MDA officer upload)' : '';
                      const tooltip = hasData
                        ? `${month}: ${periodData.recordCount} records (${periodData.baselinedCount} baselined)${sourceLabel} — click to view`
                        : `${month}: No data for this period`;
                      const [cellYear, cellMonth] = month.split('-');
                      return (
                        <td key={month} className="px-0.5 py-0.5 text-center">
                          <div
                            className={`relative w-5 h-4 rounded-sm mx-auto ${CELL_COLORS[status]} ${status === 'gap' ? 'border border-gray-200' : ''} ${hasData ? 'cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all' : 'cursor-default'}`}
                            title={tooltip}
                            role={hasData ? 'button' : 'img'}
                            tabIndex={hasData ? 0 : undefined}
                            aria-label={tooltip}
                            onClick={hasData ? () => navigate(`/dashboard/migrations/coverage/${mda.mdaId}/${cellYear}/${cellMonth}`) : undefined}
                            onKeyDown={hasData ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                navigate(`/dashboard/migrations/coverage/${mda.mdaId}/${cellYear}/${cellMonth}`);
                              }
                            } : undefined}
                          >
                            {(isOfficerUpload || isMixedSource) && (
                              <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${isMixedSource ? 'bg-purple-500' : 'bg-blue-500'}`} />
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-1.5 px-2 text-center font-mono">
                      {summary ? (
                        <span title={`${summary.covered} months covered, ${summary.gaps} gaps`}>
                          {summary.covered}/{months.length}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                );
              })}

              {/* Summary Row */}
              <tr className="bg-gray-50 border-t-2 border-border font-semibold">
                <td className="py-1.5 px-3 sticky left-0 bg-gray-50 z-10 text-text-muted uppercase">
                  MDAs with data
                </td>
                {months.map((month) => {
                  const count = summaryPerMonth.get(month) ?? 0;
                  return (
                    <td key={month} className="px-0.5 py-0.5 text-center">
                      <span
                        className={`text-[9px] font-mono ${count > 0 ? 'text-emerald-700' : 'text-gray-300'}`}
                        title={`${month}: ${count} MDAs with data`}
                      >
                        {count > 0 ? count : '-'}
                      </span>
                    </td>
                  );
                })}
                <td className="py-1.5 px-2 text-center font-mono text-text-muted">
                  {formatCount(data.mdas.length)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
