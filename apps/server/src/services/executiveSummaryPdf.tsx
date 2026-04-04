/**
 * executiveSummaryPdf — PDF generator for Executive Summary Report (Story 6.4).
 */

import { renderToBuffer, Document } from '@react-pdf/renderer';
import type { ExecutiveSummaryReportData, PdfReportMeta } from '@vlprs/shared';
import {
  ReportPageWrapper,
  ReportSectionTitle,
  ReportStatCard,
  ReportTable,
  reportStyles,
  formatNaira,
  formatPercent,
  formatNumber,
  formatDateTime,
} from './reportPdfComponents';
import { View, Text } from '@react-pdf/renderer';

function TrendLine({ label, current, changePercent }: { label: string; current: number; changePercent: number | null }) {
  const displayValue = typeof current === 'number' && current % 1 !== 0 ? current.toFixed(1) : current;
  if (changePercent === null) {
    return (
      <Text style={{ fontSize: 8, color: '#374151', marginBottom: 2 }}>
        {label}: {displayValue} — No prior data
      </Text>
    );
  }
  const arrow = changePercent > 0 ? '\u2191' : changePercent < 0 ? '\u2193' : '\u2192';
  return (
    <Text style={{ fontSize: 8, color: '#374151', marginBottom: 2 }}>
      {label}: {displayValue} {arrow} {changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%
    </Text>
  );
}

export async function generateExecutiveSummaryPdf(
  data: ExecutiveSummaryReportData,
  meta: PdfReportMeta,
): Promise<Buffer> {
  const doc = (
    <Document title={meta.reportTitle} author="VLPRS">
      <ReportPageWrapper
        title={meta.reportTitle}
        subtitle={meta.reportSubtitle}
        referenceNumber={meta.referenceNumber}
        generatedAt={meta.generatedAt}
      >
        {/* Scheme Overview Stat Cards */}
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Active Loans" value={formatNumber(data.schemeOverview.activeLoans)} />
          <ReportStatCard label="Total Exposure" value={formatNaira(data.schemeOverview.totalExposure)} />
          <ReportStatCard label="Fund Available" value={data.schemeOverview.fundAvailable ? formatNaira(data.schemeOverview.fundAvailable) : 'Not configured'} />
          <ReportStatCard label="Monthly Recovery" value={formatNaira(data.schemeOverview.monthlyRecoveryRate)} />
        </View>

        {/* Portfolio Status */}
        <ReportSectionTitle>Loan Portfolio Status</ReportSectionTitle>
        <ReportTable
          headers={['Classification', 'Count', 'Percentage']}
          columnWidths={['50%', '25%', '25%']}
          rows={data.portfolioStatus.map(r => ({
            cells: [r.classification, formatNumber(r.count), formatPercent(r.percentage)],
            rightAlign: [false, true, true],
          }))}
        />

        {/* MDA Scorecard — Top Healthy */}
        <ReportSectionTitle>MDA Scorecard — Top 10 Healthy</ReportSectionTitle>
        <ReportTable
          headers={['MDA', 'Health Score', 'Outstanding', 'Observations']}
          columnWidths={['40%', '20%', '25%', '15%']}
          rows={data.mdaScorecard.topHealthy.map(r => ({
            cells: [r.mdaName, `${r.healthScore}`, formatNaira(r.totalOutstanding), `${r.observationCount}`],
            rightAlign: [false, true, true, true],
          }))}
        />

        {/* MDA Scorecard — Bottom For Review */}
        {data.mdaScorecard.bottomForReview.length > 0 && (
          <>
            <ReportSectionTitle>MDA Scorecard — Bottom 5 For Review</ReportSectionTitle>
            <ReportTable
              headers={['MDA', 'Health Score', 'Outstanding', 'Observations']}
              columnWidths={['40%', '20%', '25%', '15%']}
              rows={data.mdaScorecard.bottomForReview.map(r => ({
                cells: [r.mdaName, `${r.healthScore}`, formatNaira(r.totalOutstanding), `${r.observationCount}`],
                rightAlign: [false, true, true, true],
              }))}
            />
          </>
        )}

        {/* Receivables Ranking */}
        <ReportSectionTitle>Outstanding Receivables — Top MDAs</ReportSectionTitle>
        <ReportTable
          headers={['MDA', 'Active Loans', 'Outstanding']}
          columnWidths={['50%', '20%', '30%']}
          rows={data.receivablesRanking.map(r => ({
            cells: [r.mdaName, `${r.activeLoans}`, formatNaira(r.totalOutstanding)],
            rightAlign: [false, true, true],
          }))}
        />
      </ReportPageWrapper>

      {/* Page 2: Recovery + Coverage + Trends */}
      <ReportPageWrapper
        title={meta.reportTitle}
        subtitle="Recovery & Coverage"
        referenceNumber={meta.referenceNumber}
        generatedAt={meta.generatedAt}
      >
        {/* Recovery Potential Tiers */}
        <ReportSectionTitle>Recovery Potential</ReportSectionTitle>
        <View style={reportStyles.statsRow}>
          {data.recoveryPotential.map((tier, i) => (
            <View key={i} style={reportStyles.statCard}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1a1a2e', marginBottom: 4 }}>{tier.tierName}</Text>
              <Text style={{ fontSize: 7, color: '#666666' }}>Loans: {formatNumber(tier.loanCount)}</Text>
              <Text style={{ fontSize: 7, color: '#666666' }}>Total: {formatNaira(tier.totalAmount)}</Text>
              <Text style={{ fontSize: 7, color: '#666666' }}>Monthly: {formatNaira(tier.monthlyProjection)}</Text>
            </View>
          ))}
        </View>

        {/* Submission Coverage */}
        <ReportSectionTitle>Submission Coverage</ReportSectionTitle>
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Active MDAs" value={`${data.submissionCoverage.activeMdas}`} />
          <ReportStatCard label="Spotty MDAs" value={`${data.submissionCoverage.spottyMdas}`} />
          <ReportStatCard label="Dark MDAs" value={`${data.submissionCoverage.darkMdas}`} />
          <ReportStatCard label="Total MDAs" value={`${data.submissionCoverage.totalMdas}`} />
        </View>

        {/* Onboarding Pipeline */}
        <ReportSectionTitle>Onboarding Pipeline</ReportSectionTitle>
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Approved, Not Collecting" value={`${data.onboardingPipeline.approvedNotCollectingCount}`} />
          <ReportStatCard label="Revenue at Risk" value={formatNaira(data.onboardingPipeline.revenueAtRisk)} />
        </View>

        {/* Exception Summary */}
        <ReportSectionTitle>Exception Summary</ReportSectionTitle>
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Open" value={`${data.exceptionSummary.openCount}`} />
          <ReportStatCard label="Resolved" value={`${data.exceptionSummary.resolvedCount}`} />
          <ReportStatCard label="Total" value={`${data.exceptionSummary.totalCount}`} />
        </View>

        {/* Top Variances */}
        {data.topVariances.length > 0 && (
          <>
            <ReportSectionTitle>Top Variances by Magnitude</ReportSectionTitle>
            <ReportTable
              headers={['Staff', 'MDA', 'Declared', 'Computed', 'Difference']}
              columnWidths={['25%', '20%', '18%', '18%', '19%']}
              rows={data.topVariances.map(v => ({
                cells: [v.staffName, v.mdaName, formatNaira(v.declaredAmount), formatNaira(v.computedAmount), formatNaira(v.difference)],
                rightAlign: [false, false, true, true, true],
              }))}
            />
          </>
        )}

        {/* Month-over-Month Trend */}
        <ReportSectionTitle>Month-over-Month Trend</ReportSectionTitle>
        <View style={{ padding: 8, backgroundColor: '#f9fafb', borderRadius: 3 }}>
          <TrendLine label="Active Loans" current={data.monthOverMonthTrend.activeLoans.current} changePercent={data.monthOverMonthTrend.activeLoans.changePercent} />
          <TrendLine label="Total Exposure" current={data.monthOverMonthTrend.totalExposure.current} changePercent={data.monthOverMonthTrend.totalExposure.changePercent} />
          <TrendLine label="Monthly Recovery" current={data.monthOverMonthTrend.monthlyRecovery.current} changePercent={data.monthOverMonthTrend.monthlyRecovery.changePercent} />
          <TrendLine label="Completion Rate" current={data.monthOverMonthTrend.completionRate.current} changePercent={data.monthOverMonthTrend.completionRate.changePercent} />
        </View>

        <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: 12, textAlign: 'right' }}>
          Generated: {formatDateTime(data.generatedAt)}
        </Text>
      </ReportPageWrapper>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
