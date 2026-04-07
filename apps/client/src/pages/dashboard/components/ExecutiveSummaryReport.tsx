import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { useExecutiveSummaryReport } from '@/hooks/useReportData';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { ReportActions } from './ReportActions';
import type { TrendMetric, MdaScorecardRow, RecoveryTierKey } from '@vlprs/shared';

// Recovery tier → filter route on FilteredLoanListPage.
// Keyed by the stable RecoveryTierKey (set by the server) so display label
// changes never silently break navigation. FilteredLoanListPage reads
// ?filter= (not ?classification=) and maps the value internally.
const TIER_ROUTES: Record<RecoveryTierKey, string> = {
  QUICK: '/dashboard/loans?filter=quick-win',
  INTERVENTION: '/dashboard/loans?filter=overdue',
  EXTENDED: '/dashboard/loans?filter=stalled',
};

function healthBadge(band: string) {
  switch (band) {
    case 'healthy': return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Healthy</Badge>;
    case 'attention': return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Needs Attention</Badge>;
    default: return <Badge variant="outline" className="text-gray-600 border-gray-300">For Review</Badge>;
  }
}

function TrendIndicator({ metric, label }: { metric: TrendMetric; label: string }) {
  const cp = metric.changePercent;
  const hasData = cp !== null;
  const isUp = cp !== null && cp > 0;
  const isDown = cp !== null && cp < 0;
  const isFlat = cp !== null && cp === 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="font-semibold">
        {typeof metric.current === 'number' && metric.current % 1 !== 0
          ? metric.current.toFixed(1)
          : metric.current}
      </span>
      {!hasData && <span className="text-xs text-text-muted">No prior data</span>}
      {isFlat && <Minus className="h-4 w-4 text-gray-400" />}
      {isUp && <TrendingUp className="h-4 w-4 text-teal-600" />}
      {isDown && <TrendingDown className="h-4 w-4 text-amber-600" />}
      {hasData && !isFlat && (
        <span className={`text-xs ${isUp ? 'text-teal-600' : 'text-amber-600'}`}>
          {isUp ? '+' : ''}{metric.changePercent!.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

function ScorecardTable({ title, rows }: { title: string; rows: MdaScorecardRow[] }) {
  const navigate = useNavigate();
  if (rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-text-secondary mb-2">{title}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>MDA</TableHead>
            <TableHead>Health</TableHead>
            <TableHead className="text-right">Outstanding</TableHead>
            <TableHead className="text-right">Observations</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow
              key={r.mdaId}
              role="link"
              tabIndex={0}
              aria-label={`View ${r.mdaName} details`}
              data-testid={`scorecard-row-${r.mdaId}`}
              onClick={() => navigate(`/dashboard/mda/${r.mdaId}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/dashboard/mda/${r.mdaId}`);
                }
              }}
              className="cursor-pointer transition-colors hover:bg-slate-50"
            >
              <TableCell className="font-medium">{r.mdaName}</TableCell>
              <TableCell>{healthBadge(r.healthBand)}</TableCell>
              <TableCell className="text-right"><NairaDisplay amount={r.totalOutstanding} /></TableCell>
              <TableCell className="text-right">{r.observationCount}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ExecutiveSummaryReport() {
  const { data, isLoading, error } = useExecutiveSummaryReport();
  const navigate = useNavigate();

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
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
          <p className="text-text-secondary">Unable to load report. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Executive Summary Report</h2>
        <ReportActions reportType="executive-summary" queryParams={{}} reportTitle="Executive Summary Report" />
      </div>

      {/* Scheme Overview Hero Row */}
      <Card>
        <CardHeader><CardTitle>Scheme Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-text-secondary">
                Active Loans <MetricHelp definition={{ label: 'Active Loans', description: 'Loans currently being serviced through monthly deductions.', derivedFrom: 'Loan classification service' }} />
              </p>
              <p className="text-2xl font-bold">{data.schemeOverview.activeLoans.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">
                Total Exposure <MetricHelp metric="dashboard.totalExposure" />
              </p>
              <p className="text-2xl font-bold"><NairaDisplay amount={data.schemeOverview.totalExposure} variant="hero" /></p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">Fund Available</p>
              <p className="text-2xl font-bold">
                {data.schemeOverview.fundAvailable
                  ? <NairaDisplay amount={data.schemeOverview.fundAvailable} variant="hero" />
                  : <span className="text-gray-400">Not configured</span>}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-secondary">
                Monthly Recovery <MetricHelp metric="dashboard.monthlyRecovery" />
              </p>
              <p className="text-2xl font-bold"><NairaDisplay amount={data.schemeOverview.monthlyRecoveryRate} variant="hero" /></p>
              {data.schemeOverview.recoveryPeriod && (
                <p className="text-xs text-text-secondary">{data.schemeOverview.recoveryPeriod}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio Status */}
      <Card>
        <CardHeader><CardTitle>Loan Portfolio Status</CardTitle></CardHeader>
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
              {data.portfolioStatus.map(row => (
                <TableRow key={row.classification}>
                  <TableCell className="font-medium">{row.classification}</TableCell>
                  <TableCell className="text-right">{row.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MDA Scorecard */}
      <Card>
        <CardHeader><CardTitle>MDA Scorecard</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <ScorecardTable title="Top 10 — Healthy" rows={data.mdaScorecard.topHealthy} />
          <ScorecardTable title="Bottom 5 — For Review" rows={data.mdaScorecard.bottomForReview} />
        </CardContent>
      </Card>

      {/* Outstanding Receivables Ranking */}
      <Card>
        <CardHeader><CardTitle>Outstanding Receivables — Top 10 MDAs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MDA</TableHead>
                <TableHead className="text-right">Active Loans</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.receivablesRanking.map(r => (
                <TableRow key={r.mdaId}>
                  <TableCell className="font-medium">{r.mdaName}</TableCell>
                  <TableCell className="text-right">{r.activeLoans}</TableCell>
                  <TableCell className="text-right"><NairaDisplay amount={r.totalOutstanding} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recovery Potential */}
      <Card>
        <CardHeader><CardTitle>Recovery Potential Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.recoveryPotential.map(tier => {
              const route = TIER_ROUTES[tier.tierKey];
              return (
                <Card
                  key={tier.tierKey}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${tier.tierName} loans`}
                  data-testid={`recovery-tier-card-${tier.tierKey}`}
                  onClick={() => navigate(route)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(route);
                    }
                  }}
                  className="border cursor-pointer hover:shadow-md transition-shadow"
                >
                  <CardContent className="pt-4">
                    <h4 className="font-semibold mb-2">{tier.tierName}</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-text-secondary">Loans:</span> {tier.loanCount.toLocaleString()}</p>
                      <p><span className="text-text-secondary">Total:</span> <NairaDisplay amount={tier.totalAmount} /></p>
                      <p><span className="text-text-secondary">Monthly Projection:</span> <NairaDisplay amount={tier.monthlyProjection} /></p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Submission Coverage + Onboarding Pipeline + Exception Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Submission Coverage</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-text-secondary">Active:</span> {data.submissionCoverage.activeMdas}</p>
            <p><span className="text-text-secondary">Spotty:</span> {data.submissionCoverage.spottyMdas}</p>
            <p><span className="text-text-secondary">Dark:</span> {data.submissionCoverage.darkMdas}</p>
            <p className="text-xs text-text-secondary pt-1">Total: {data.submissionCoverage.totalMdas} MDAs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Onboarding Pipeline</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-text-secondary">Approved, Not Collecting:</span> {data.onboardingPipeline.approvedNotCollectingCount}</p>
            <p><span className="text-text-secondary">Revenue at Risk:</span> <NairaDisplay amount={data.onboardingPipeline.revenueAtRisk} /></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Exception Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-text-secondary">Open:</span> {data.exceptionSummary.openCount}</p>
            <p><span className="text-text-secondary">Resolved:</span> {data.exceptionSummary.resolvedCount}</p>
            <p className="text-xs text-text-secondary pt-1">Total: {data.exceptionSummary.totalCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 5 Variances */}
      {data.topVariances.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Top Variances by Magnitude</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>MDA</TableHead>
                  <TableHead className="text-right">Declared</TableHead>
                  <TableHead className="text-right">Computed</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topVariances.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{v.staffName}</TableCell>
                    <TableCell>{v.mdaName}</TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={v.declaredAmount} /></TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={v.computedAmount} /></TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={v.difference} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Month-over-Month Trend */}
      <Card>
        <CardHeader><CardTitle>Month-over-Month Trend</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TrendIndicator metric={data.monthOverMonthTrend.activeLoans} label="Active Loans" />
            <TrendIndicator metric={data.monthOverMonthTrend.totalExposure} label="Total Exposure" />
            <TrendIndicator metric={data.monthOverMonthTrend.monthlyRecovery} label="Monthly Recovery" />
            <TrendIndicator metric={data.monthOverMonthTrend.completionRate} label="Completion Rate" />
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-text-secondary text-right">
        Generated: {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
