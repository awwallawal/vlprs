import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Printer, Link as LinkIcon, Check } from 'lucide-react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { UI_COPY } from '@vlprs/shared';
import type {
  TraceReportData,
  TraceLoanCycle,
  RateAnalysis,
  BalanceEntry,
} from '@vlprs/shared';
import { formatNaira } from '@/lib/formatters';

// ─── Helpers ───────────────────────────────────────────────────────

function statusColor(status: string): string {
  switch (status) {
    case 'liquidated':
    case 'cleared':
      return 'bg-green-600';
    case 'inferred':
      return 'bg-amber-500';
    default:
      return 'bg-blue-600';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'liquidated': return 'Liquidated';
    case 'cleared': return 'Cleared';
    case 'inferred': return 'Inferred';
    default: return 'Active';
  }
}

function observationBorder(type: string): string {
  if (type === 'stalled_balance' || type === 'no_approval_match' || type === 'beyond_tenure') {
    return 'border-l-amber-500 bg-amber-50';
  }
  if (type === 'multi_mda' || type === 'cross_mda_continuity') {
    return 'border-l-blue-500 bg-blue-50';
  }
  return 'border-l-teal bg-teal-50';
}

function observationTypeColor(type: string): string {
  if (type === 'stalled_balance' || type === 'no_approval_match' || type === 'beyond_tenure') {
    return 'text-amber-700';
  }
  if (type === 'multi_mda' || type === 'cross_mda_continuity') {
    return 'text-blue-700';
  }
  return 'text-teal';
}

function observationStatusBadge(status: string) {
  switch (status) {
    case 'reviewed':
      return <Badge className="text-[10px] bg-teal/10 text-teal border-teal/20">Reviewed</Badge>;
    case 'resolved':
      return <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200">Resolved</Badge>;
    default:
      return <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Unreviewed</Badge>;
  }
}

function trajectoryRowClass(entry: BalanceEntry): string {
  if (entry.isGap) return 'bg-amber-50';
  if (entry.isNewLoan) return 'bg-orange-50';
  if (entry.isStalled) return 'bg-red-50';
  if (entry.balance === '0' || entry.balance === '0.00') return 'bg-green-50';
  return '';
}

// ─── Sub-components ────────────────────────────────────────────────

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3 text-center print:border-gray-300">
      <p className="text-lg font-bold font-mono text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </div>
  );
}

function MathBox({ analysis }: { analysis: RateAnalysis }) {
  // Compute scheme expected values for display
  const principal = Number(analysis.principal);
  const standardInterest = principal * 0.1333;
  const monthlyInterest = standardInterest / 60;
  // Determine tenure: standard match → 60, accelerated match → its tenure, otherwise unknown.
  // MUST NOT silently default to 60 (AC7).
  const tenure: number | null = analysis.standardTest.match
    ? 60
    : analysis.acceleratedTest?.tenure ?? null;
  const schemeExpectedTotalInterest = tenure !== null ? monthlyInterest * tenure : null;
  const schemeExpectedTotalLoan = schemeExpectedTotalInterest !== null ? principal + schemeExpectedTotalInterest : null;

  return (
    <div className="bg-gray-100 rounded p-4 mb-4 font-mono text-xs print:bg-gray-50 print:border print:border-gray-200">
      <p className="font-bold text-sm mb-2 font-sans">Interest Rate Verification</p>
      <p>Principal: {formatNaira(analysis.principal)}</p>
      <p>Actual Total Loan: {formatNaira(analysis.actualTotalLoan)}</p>
      <p>Actual Interest: {formatNaira(analysis.actualInterest)}</p>
      <p>Apparent Rate: {analysis.apparentRate}%</p>

      {/* Scheme Expected vector — only shown when tenure is determinable */}
      {tenure !== null && schemeExpectedTotalInterest !== null && schemeExpectedTotalLoan !== null && (
        <div className="mt-3 pt-2 border-t border-gray-300">
          <p className="font-bold text-[11px] font-sans text-text-primary mb-1">Scheme Expected (Authoritative)</p>
          <p>Standard Interest = {formatNaira(analysis.principal)} &times; 13.33% = {formatNaira(standardInterest.toFixed(2))}</p>
          <p>Monthly Interest = {formatNaira(standardInterest.toFixed(2))} &divide; 60 = {formatNaira(monthlyInterest.toFixed(2))}</p>
          <p>Total Interest ({tenure}mo) = {formatNaira(monthlyInterest.toFixed(2))} &times; {tenure} = {formatNaira(schemeExpectedTotalInterest.toFixed(2))}</p>
          <p>Total Loan = {formatNaira(analysis.principal)} + {formatNaira(schemeExpectedTotalInterest.toFixed(2))} = {formatNaira(schemeExpectedTotalLoan.toFixed(2))}</p>
        </div>
      )}

      <p className="mt-2">
        Standard Test (13.33% &times; 60mo): {formatNaira(analysis.standardTest.expectedInterest)}
        {' — '}
        <span className={analysis.standardTest.match ? 'text-green-700' : 'text-text-muted'}>
          {analysis.standardTest.match ? 'MATCH' : 'No match'}
        </span>
      </p>
      {analysis.acceleratedTest && (
        <p>
          Accelerated Test ({analysis.acceleratedTest.tenure}mo): {formatNaira(analysis.acceleratedTest.expectedInterest)}
          {' — '}
          <span className="text-green-700">MATCH</span>
        </p>
      )}
      <p className="mt-2 italic font-sans text-text-secondary">
        {analysis.conclusion} Variance is measured against the authoritative scheme formula as the primary reference.
      </p>
    </div>
  );
}

function BalanceTrajectoryTable({ entries }: { entries: BalanceEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="py-1.5 px-2 text-left font-semibold text-text-muted">Period</th>
            <th className="py-1.5 px-2 text-right font-semibold text-text-muted">Balance</th>
            <th className="py-1.5 px-2 text-right font-semibold text-text-muted">Deduction</th>
            <th className="py-1.5 px-2 text-right font-semibold text-text-muted">#Paid</th>
            <th className="py-1.5 px-2 text-left font-semibold text-text-muted">Source File</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) => (
            <tr key={i} className={`border-b border-border/30 ${trajectoryRowClass(entry)}`}>
              <td className="py-1 px-2 font-mono">{entry.period}</td>
              <td className="py-1 px-2 text-right font-mono">
                {entry.balance === 'N/A' ? 'N/A' : formatNaira(entry.balance)}
              </td>
              <td className="py-1 px-2 text-right font-mono">
                {entry.deduction === 'N/A' ? 'N/A' : formatNaira(entry.deduction)}
              </td>
              <td className="py-1 px-2 text-right font-mono">{entry.installmentsPaid}</td>
              <td className="py-1 px-2 text-text-muted truncate max-w-[200px]">{entry.sourceFile}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoanPanel({ cycle, analysis }: { cycle: TraceLoanCycle; analysis?: RateAnalysis }) {
  return (
    <div className="rounded-lg border overflow-hidden mb-4 print:break-inside-avoid print:border-gray-300">
      {/* Coloured header */}
      <div className={`${statusColor(cycle.status)} px-4 py-3 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Loan Cycle {cycle.cycleNumber}: {cycle.mdaName}</p>
            <p className="text-xs opacity-80">
              {cycle.startPeriod} to {cycle.endPeriod ?? 'Present'}
            </p>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 text-xs">
            {statusLabel(cycle.status)}
          </Badge>
        </div>
      </div>

      {/* Loan details */}
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <p className="text-xs text-text-muted">Principal</p>
            <p className="font-mono font-medium">{formatNaira(cycle.principal)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Total Loan</p>
            <p className="font-mono font-medium">{formatNaira(cycle.totalLoan)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Interest Amount</p>
            <p className="font-mono font-medium">{formatNaira(cycle.interestAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Effective Rate</p>
            <p className="font-mono font-medium">{cycle.effectiveRate}%</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Monthly Deduction</p>
            <p className="font-mono font-medium">{formatNaira(cycle.monthlyDeduction)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Months of Data</p>
            <p className="font-mono font-medium">
              {cycle.monthsOfData} <span className="text-text-muted">({cycle.gapMonths} gaps)</span>
            </p>
          </div>
        </div>

        {/* Math verification */}
        {analysis && <MathBox analysis={analysis} />}

        {/* Balance trajectory */}
        {cycle.balanceTrajectory.length > 0 && (
          <BalanceTrajectoryTable entries={cycle.balanceTrajectory} />
        )}
      </div>
    </div>
  );
}

// ─── Action Bar ────────────────────────────────────────────────────

interface ActionBarProps {
  onDownloadPdf: () => void;
  isPdfLoading: boolean;
  isPdfSuccess: boolean;
}

function ActionBar({ onDownloadPdf, isPdfLoading, isPdfSuccess }: ActionBarProps) {
  const { copied, copyToClipboard } = useCopyToClipboard(2000, 'Link copied to clipboard');
  const handlePrint = () => window.print();

  return (
    <div className="flex items-center gap-2 no-print">
      <Button variant="default" onClick={onDownloadPdf} disabled={isPdfLoading}>
        {isPdfSuccess ? (
          <Check className="h-4 w-4 mr-1 text-green-200" />
        ) : (
          <Download className="h-4 w-4 mr-1" />
        )}
        {isPdfLoading ? 'Generating...' : isPdfSuccess ? 'PDF Downloaded' : 'Download PDF'}
      </Button>
      <Button variant="secondary" onClick={handlePrint}>
        <Printer className="h-4 w-4 mr-1" />
        Print
      </Button>
      <Button variant="outline" onClick={() => copyToClipboard(window.location.href)}>
        {copied ? (
          <Check className="h-4 w-4 mr-1 text-green-600" />
        ) : (
          <LinkIcon className="h-4 w-4 mr-1" />
        )}
        {copied ? 'Copied!' : 'Copy Link'}
      </Button>
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────────

export function TraceReportSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

interface IndividualTraceReportProps {
  data: TraceReportData;
  onDownloadPdf: () => void;
  isPdfLoading: boolean;
  isPdfSuccess?: boolean;
}

export function IndividualTraceReport({ data, onDownloadPdf, isPdfLoading, isPdfSuccess }: IndividualTraceReportProps) {
  return (
    <div className="max-w-[210mm] mx-auto space-y-4">
      {/* Print CSS */}
      <style>{`
        @media print {
          body { background: white; padding: 0; }
          .no-print { display: none !important; }
          .panel { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }
          tr { break-inside: avoid; }
        }
        @page { size: A4 portrait; margin: 14mm; }
        .page-break { page-break-before: always; }
      `}</style>

      {/* Action Bar */}
      <ActionBar onDownloadPdf={onDownloadPdf} isPdfLoading={isPdfLoading} isPdfSuccess={!!isPdfSuccess} />

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] rounded-lg p-6 text-white print:rounded-none">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-gray-300 mb-1">Individual Loan Trace Report</p>
            <h1 className="text-xl font-bold mb-1">{data.summary.staffName}</h1>
            <p className="text-sm text-gray-300">
              {data.summary.mdas.map((m) => m.name).join(', ')} | {data.summary.totalLoanCycles} loan cycle(s) | {data.summary.dateRange.from} to {data.summary.dateRange.to}
            </p>
          </div>
          <div className="text-right text-xs text-gray-300 space-y-0.5">
            <p className="font-medium text-gray-200">Oyo State Car Loan Scheme — VLPRS</p>
            <p>{data.metadata.generatedAt.slice(0, 10)}</p>
            <p>Ref: {data.metadata.referenceNumber}</p>
          </div>
        </div>
      </div>

      {/* Stat Cards — 6 metrics matching V2 prototype (M3 code review fix) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard value={data.summary.totalLoanCycles} label="Loan Cycles" />
        <StatCard value={data.summary.mdas.length} label="MDAs" />
        <StatCard value={data.summary.totalMonthsOfRecords} label="Months of Records" />
        <StatCard
          value={data.loanCycles.length > 0 ? formatNaira(data.loanCycles[data.loanCycles.length - 1].principal) : '—'}
          label="Current Principal"
        />
        <StatCard
          value={data.loanCycles.length > 0 ? `${data.loanCycles[data.loanCycles.length - 1].effectiveRate}%` : '—'}
          label="Effective Rate"
        />
        <StatCard value={`${data.dataCompleteness.overallPercent}%`} label="Data Completeness" />
      </div>

      {/* Key Observations */}
      {data.observations.length > 0 ? (
        <div className="bg-white rounded-lg border p-4 print:border-gray-300">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Key Observations</h2>
          <div className="space-y-2">
            {data.observations.map((obs) => (
              <div key={obs.id} className={`border-l-4 rounded p-3 ${observationBorder(obs.type)}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase ${observationTypeColor(obs.type)}`}>
                    {obs.type.replace(/_/g, ' ')}
                  </span>
                  {observationStatusBadge(obs.status)}
                </div>
                <p className="text-xs text-text-secondary">{obs.description}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border p-4 print:border-gray-300">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Key Observations</h2>
          <p className="text-xs text-text-muted">{UI_COPY.OBSERVATION_EMPTY}</p>
        </div>
      )}

      {/* Beneficiary Profile */}
      <div className="bg-white rounded-lg border p-4 print:border-gray-300">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Beneficiary Profile</h2>
        <div className="space-y-2 text-sm">
          <div className="flex gap-4 border-b border-border/30 pb-1">
            <span className="w-32 text-text-muted text-xs font-medium">Full Name</span>
            <span className="text-text-primary">{data.beneficiaryProfile.fullName}</span>
          </div>
          <div className="flex gap-4 border-b border-border/30 pb-1">
            <span className="w-32 text-text-muted text-xs font-medium">Staff ID</span>
            <span className="text-text-primary">{data.beneficiaryProfile.staffId ?? 'Not available'}</span>
          </div>
          <div className="flex gap-4 border-b border-border/30 pb-1">
            <span className="w-32 text-text-muted text-xs font-medium">Current MDA</span>
            <span className="text-text-primary">{data.beneficiaryProfile.currentMda.name}</span>
          </div>
          {data.beneficiaryProfile.previousMdas.length > 0 && (
            <div className="flex gap-4 border-b border-border/30 pb-1">
              <span className="w-32 text-text-muted text-xs font-medium">Previous MDA(s)</span>
              <span className="text-text-primary">
                {data.beneficiaryProfile.previousMdas.map((m) => `${m.name} (until ${m.lastSeen})`).join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Cross-MDA Timeline */}
      {data.crossMdaTimeline.length > 1 && (
        <div className="bg-white rounded-lg border p-4 print:border-gray-300">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Cross-MDA Transfer Timeline</h2>
          <div className="space-y-1">
            {data.crossMdaTimeline.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <Badge className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  {entry.mdaCode}
                </Badge>
                <span className="text-text-primary">{entry.mdaName}</span>
                <span className="text-text-muted">{entry.firstSeen} — {entry.lastSeen}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-Loan Panels */}
      <div className="page-break" />
      {data.loanCycles.map((cycle, i) => (
        <LoanPanel key={i} cycle={cycle} analysis={data.rateAnalyses[i]} />
      ))}

      {/* Data Completeness */}
      <div className="bg-white rounded-lg border p-4 print:border-gray-300">
        <h2 className="text-sm font-semibold text-text-primary mb-3">Data Completeness Summary</h2>
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-text-muted">Overall</span>
            <span className="font-mono font-medium">{data.dataCompleteness.overallPercent}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full">
            <div
              className="h-2 bg-teal rounded-full transition-all"
              style={{ width: `${data.dataCompleteness.overallPercent}%` }}
            />
          </div>
        </div>
        {data.dataCompleteness.perCycle.map((c) => (
          <div key={c.cycleNumber} className="mb-2">
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-text-muted">Cycle {c.cycleNumber}</span>
              <span className="font-mono">{c.percent}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full">
              <div
                className="h-1.5 bg-teal/70 rounded-full"
                style={{ width: `${c.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t pt-3 flex flex-col sm:flex-row justify-between text-xs text-text-muted">
        <p>{data.metadata.dataSourceNote} | {data.metadata.dataFreshness}</p>
        <p>Generated by {data.metadata.generatedBy.name} ({data.metadata.generatedBy.role})</p>
      </div>
    </div>
  );
}
