import type { PersonTimeline, LoanCycle } from '@vlprs/shared';

const MDA_PALETTE = [
  'bg-blue-400', 'bg-green-500', 'bg-purple-400', 'bg-amber-500',
  'bg-orange-400', 'bg-emerald-500', 'bg-cyan-400', 'bg-pink-500',
  'bg-indigo-400', 'bg-lime-500', 'bg-rose-400', 'bg-violet-500',
  'bg-sky-400', 'bg-fuchsia-500', 'bg-yellow-400', 'bg-teal-500',
  'bg-blue-600', 'bg-green-400', 'bg-purple-600', 'bg-amber-400',
  'bg-orange-600', 'bg-emerald-400', 'bg-cyan-600', 'bg-pink-400',
  'bg-indigo-600', 'bg-lime-400', 'bg-rose-600', 'bg-violet-400',
  'bg-sky-600', 'bg-fuchsia-400', 'bg-yellow-600', 'bg-teal-400',
  'bg-red-400', 'bg-slate-500', 'bg-stone-500', 'bg-zinc-400',
];

function buildMdaColorMap(mdaCodes: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  const sorted = [...new Set(mdaCodes)].sort();
  for (let i = 0; i < sorted.length; i++) {
    map[sorted[i]] = MDA_PALETTE[i % MDA_PALETTE.length];
  }
  return map;
}

interface LoanTimelineProps {
  timelines: PersonTimeline[];
  cycles: LoanCycle[];
}

export function LoanTimeline({ timelines, cycles }: LoanTimelineProps) {
  if (timelines.length === 0) {
    return (
      <div className="text-sm text-text-muted py-4">No timeline data available</div>
    );
  }

  // Find global date range
  let globalMin = Infinity;
  let globalMax = -Infinity;
  for (const tl of timelines) {
    const first = tl.firstSeen.year * 12 + tl.firstSeen.month;
    const last = tl.lastSeen.year * 12 + tl.lastSeen.month;
    if (first < globalMin) globalMin = first;
    if (last > globalMax) globalMax = last;
  }

  const totalSpan = globalMax - globalMin + 1;
  if (totalSpan <= 0) return null;

  const mdaColors = buildMdaColorMap(timelines.map((tl) => tl.mdaCode));

  // Build aria label
  const ariaLabel = timelines
    .map((tl) => `${tl.mdaCode}: ${tl.firstSeen.year}/${tl.firstSeen.month} to ${tl.lastSeen.year}/${tl.lastSeen.month}, ${tl.totalMonthsPresent} months present, ${tl.gapMonths} gap months`)
    .join('. ');

  // Generate year markers
  const firstYear = Math.floor(globalMin / 12);
  const lastYear = Math.floor(globalMax / 12);
  const yearMarkers: Array<{ year: number; offset: number }> = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const monthVal = y * 12 + 1;
    const offset = ((monthVal - globalMin) / totalSpan) * 100;
    if (offset >= 0 && offset <= 100) {
      yearMarkers.push({ year: y, offset });
    }
  }

  return (
    <div role="img" aria-label={ariaLabel} className="space-y-3">
      {/* Year axis */}
      <div className="relative h-5 text-[10px] text-text-muted">
        {yearMarkers.map((ym) => (
          <span
            key={ym.year}
            className="absolute -translate-x-1/2"
            style={{ left: `${ym.offset}%` }}
          >
            {ym.year}
          </span>
        ))}
      </div>

      {/* Timeline bars */}
      {timelines.map((tl) => {
        const first = tl.firstSeen.year * 12 + tl.firstSeen.month;
        const last = tl.lastSeen.year * 12 + tl.lastSeen.month;
        const left = ((first - globalMin) / totalSpan) * 100;
        const width = ((last - first + 1) / totalSpan) * 100;

        return (
          <div key={tl.mdaCode} className="flex items-center gap-2">
            <span className="text-xs text-text-secondary w-24 truncate flex-shrink-0">
              {tl.mdaCode}
            </span>
            <div className="relative flex-1 h-5 bg-gray-100 rounded">
              {/* Main bar background */}
              <div
                className={`absolute h-full rounded opacity-30 ${mdaColors[tl.mdaCode]}`}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
              {/* Presence segments */}
              {tl.months.map((m) => {
                const mVal = m.year * 12 + m.month;
                const mLeft = ((mVal - globalMin) / totalSpan) * 100;
                const mWidth = (1 / totalSpan) * 100;
                return (
                  <div
                    key={`${m.year}-${m.month}`}
                    className={`absolute h-full ${mdaColors[tl.mdaCode]} rounded-sm`}
                    style={{ left: `${mLeft}%`, width: `${Math.max(mWidth, 0.5)}%` }}
                  />
                );
              })}
              {/* Cycle markers */}
              {cycles
                .filter((c) => c.mdaCode === tl.mdaCode)
                .map((c, i) => {
                  const startVal = c.startPeriod.year * 12 + c.startPeriod.month;
                  const cLeft = ((startVal - globalMin) / totalSpan) * 100;
                  return (
                    <div
                      key={i}
                      className="absolute top-0 w-1.5 h-1.5 bg-text-primary rounded-full -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${cLeft}%`, top: '50%' }}
                      title={`Cycle start: ${c.startPeriod.year}/${c.startPeriod.month}`}
                    />
                  );
                })}
            </div>
            <span className="text-[10px] text-text-muted w-16 text-right flex-shrink-0">
              {tl.totalMonthsPresent}mo / {tl.gapMonths}gap
            </span>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {timelines.map((tl) => (
          <div key={tl.mdaCode} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${mdaColors[tl.mdaCode]}`} />
            <span className="text-[10px] text-text-muted">{tl.mdaCode}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
