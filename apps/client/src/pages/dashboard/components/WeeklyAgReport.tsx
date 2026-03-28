import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { useWeeklyAgReport } from '@/hooks/useReportData';
import { AlertTriangle, CalendarDays, CheckCircle2, Eye, FileText, Sparkles, PieChart } from 'lucide-react';
import { OBSERVATION_HELP } from '@vlprs/shared';
import type { AttentionItem } from '@vlprs/shared';

function statusBadge(status: string) {
  switch (status) {
    case 'confirmed':
      return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Confirmed</Badge>;
    case 'processing':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Processing</Badge>;
    case 'rejected':
      return <Badge variant="outline" className="text-gray-600 border-gray-300">Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function categoryBadge(item: AttentionItem) {
  switch (item.category) {
    case 'review':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Review</Badge>;
    case 'info':
      return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Info</Badge>;
    case 'complete':
      return <Badge variant="outline" className="text-gray-600 border-gray-300">Complete</Badge>;
    default:
      return <Badge variant="outline">{item.category}</Badge>;
  }
}

export function WeeklyAgReport() {
  const [asOfDate, setAsOfDate] = useState<string>('');
  const { data, isLoading, error } = useWeeklyAgReport(asOfDate || undefined);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
          <p className="text-text-secondary">Unable to load the Weekly AG Report. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const periodLabel = data.periodStart && data.periodEnd
    ? `${formatDateShort(data.periodStart)} — ${formatDateShort(data.periodEnd)}`
    : '';

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Weekly AG Report</h2>
              <p className="text-sm text-text-secondary">{periodLabel}</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="asOfDate" className="text-sm text-text-secondary">As of:</label>
              <input
                id="asOfDate"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Active Loans"
              helpKey="dashboard.activeLoans"
              value={String(data.executiveSummary.activeLoans)}
            />
            <MetricCard
              label="Total Exposure"
              helpKey="dashboard.totalExposure"
              value={data.executiveSummary.totalExposure}
              isNaira
            />
            <MetricCard
              label="Fund Available"
              helpKey="dashboard.fundAvailable"
              value={data.executiveSummary.fundAvailable ?? '—'}
              isNaira={!!data.executiveSummary.fundAvailable}
            />
            <MetricCard
              label="Monthly Recovery"
              helpKey="dashboard.monthlyRecovery"
              value={data.executiveSummary.monthlyRecoveryRate}
              isNaira
            />
          </div>
        </CardContent>
      </Card>

      {/* Compliance Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4" />
            Compliance Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.complianceStatus.submissionsThisWeek.length === 0 ? (
            <p className="text-sm text-text-secondary py-4 text-center">No submissions received this week.</p>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-3">
                {data.complianceStatus.totalSubmissions} submission{data.complianceStatus.totalSubmissions !== 1 ? 's' : ''} received from{' '}
                {new Set(data.complianceStatus.submissionsThisWeek.map(s => s.mdaCode)).size} MDA{new Set(data.complianceStatus.submissionsThisWeek.map(s => s.mdaCode)).size !== 1 ? 's' : ''} this week.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MDA</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.complianceStatus.submissionsThisWeek.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.mdaName}</TableCell>
                      <TableCell>{s.mdaCode}</TableCell>
                      <TableCell>{formatDateShort(s.submissionDate)}</TableCell>
                      <TableCell className="text-right">{s.recordCount}</TableCell>
                      <TableCell>{statusBadge(s.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Exceptions Resolved */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" />
            Observations Resolved
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.exceptionsResolved.length === 0 ? (
            <p className="text-sm text-text-secondary py-4 text-center">No observations resolved this week.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Resolution Note</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead>MDA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.exceptionsResolved.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.staffName}</TableCell>
                    <TableCell>{formatObservationType(r.type)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={r.resolutionNote ?? ''}>
                      {r.resolutionNote ?? '—'}
                    </TableCell>
                    <TableCell>{formatDateShort(r.resolvedAt)}</TableCell>
                    <TableCell>{r.mdaName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Outstanding Attention Items */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            Outstanding Attention Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.outstandingAttentionItems.length === 0 ? (
            <p className="text-sm text-text-secondary py-4 text-center">No outstanding attention items.</p>
          ) : (
            <div className="space-y-3">
              {data.outstandingAttentionItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-secondary">{item.mdaName}</span>
                      {categoryBadge(item)}
                    </div>
                  </div>
                  {item.amount && (
                    <span className="text-sm font-medium whitespace-nowrap">
                      <NairaDisplay amount={item.amount} />
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Recovery Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            Quick Recovery Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.quickRecoveryOpportunities.length === 0 ? (
            <p className="text-sm text-text-secondary py-4 text-center">No quick recovery opportunities at this time.</p>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-3">
                {data.quickRecoveryOpportunities.length} loan{data.quickRecoveryOpportunities.length !== 1 ? 's' : ''} recoverable within 3 months, totaling{' '}
                <NairaDisplay
                  amount={sumMonetary(data.quickRecoveryOpportunities.map(r => r.outstandingBalance))}
                />
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>MDA</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.quickRecoveryOpportunities.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.staffName}</TableCell>
                      <TableCell>{r.mdaName}</TableCell>
                      <TableCell className="text-right"><NairaDisplay amount={r.outstandingBalance} /></TableCell>
                      <TableCell className="text-right">{r.estimatedRemainingInstallments} installment{r.estimatedRemainingInstallments !== 1 ? 's' : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Observation Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4" />
            Observation Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold text-text-primary">{data.observationActivity.newCount}</p>
              <p className="text-sm text-text-secondary">New</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold text-text-primary">{data.observationActivity.reviewedCount}</p>
              <p className="text-sm text-text-secondary">Reviewed</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <p className="text-2xl font-bold text-text-primary">{data.observationActivity.resolvedCount}</p>
              <p className="text-sm text-text-secondary">Resolved</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Snapshot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChart className="h-4 w-4" />
            Portfolio Snapshot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Classification</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.portfolioSnapshot.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.classification}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function MetricCard({
  label,
  helpKey,
  value,
  isNaira = false,
}: {
  label: string;
  helpKey?: string;
  value: string;
  isNaira?: boolean;
}) {
  return (
    <div className="p-4 border rounded-lg">
      <p className="text-sm text-text-secondary mb-1">
        {label}
        {helpKey && <MetricHelp metric={helpKey} />}
      </p>
      <p className="text-xl font-bold text-text-primary">
        {isNaira ? <NairaDisplay amount={value} /> : value}
      </p>
    </div>
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatObservationType(type: string): string {
  const entry = OBSERVATION_HELP[type as keyof typeof OBSERVATION_HELP];
  if (entry) return entry.label;
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sumMonetary(values: string[]): string {
  const totalCents = values.reduce(
    (sum, v) => sum + Math.round(Number(v) * 100),
    0,
  );
  return (totalCents / 100).toFixed(2);
}
