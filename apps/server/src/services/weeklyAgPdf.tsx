/**
 * weeklyAgPdf — PDF generator for Weekly AG Report (Story 6.4).
 */

import { renderToBuffer, Document } from '@react-pdf/renderer';
import { View, Text } from '@react-pdf/renderer';
import type { WeeklyAgReportData, PdfReportMeta } from '@vlprs/shared';
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

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function generateWeeklyAgPdf(
  data: WeeklyAgReportData,
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
        {/* Executive Summary Cards */}
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Active Loans" value={formatNumber(data.executiveSummary.activeLoans)} />
          <ReportStatCard label="Total Exposure" value={formatNaira(data.executiveSummary.totalExposure)} />
          <ReportStatCard label="Fund Available" value={data.executiveSummary.fundAvailable ? formatNaira(data.executiveSummary.fundAvailable) : '—'} />
          <ReportStatCard label="Monthly Recovery" value={formatNaira(data.executiveSummary.monthlyRecoveryRate)} />
        </View>

        {/* Compliance Status */}
        {data.complianceStatus.submissionsThisWeek.length > 0 && (
          <>
            <ReportSectionTitle>Compliance Status ({data.complianceStatus.totalSubmissions} submissions)</ReportSectionTitle>
            <ReportTable
              headers={['MDA', 'Code', 'Date', 'Records', 'Status']}
              columnWidths={['30%', '12%', '18%', '15%', '25%']}
              rows={data.complianceStatus.submissionsThisWeek.map(s => ({
                cells: [s.mdaName, s.mdaCode, formatDateShort(s.submissionDate), String(s.recordCount), s.status],
                rightAlign: [false, false, false, true, false],
              }))}
            />
          </>
        )}

        {/* Observations Resolved */}
        {data.exceptionsResolved.length > 0 && (
          <>
            <ReportSectionTitle>Observations Resolved ({data.exceptionsResolved.length})</ReportSectionTitle>
            <ReportTable
              headers={['Staff', 'Type', 'Resolution', 'Date', 'MDA']}
              columnWidths={['20%', '15%', '30%', '15%', '20%']}
              rows={data.exceptionsResolved.map(r => ({
                cells: [
                  r.staffName,
                  r.type.replace(/_/g, ' '),
                  (r.resolutionNote ?? '—').length > 35 ? (r.resolutionNote ?? '—').slice(0, 32) + '...' : (r.resolutionNote ?? '—'),
                  formatDateShort(r.resolvedAt),
                  r.mdaName,
                ],
              }))}
            />
          </>
        )}

        {/* Outstanding Attention Items */}
        {data.outstandingAttentionItems.length > 0 && (
          <>
            <ReportSectionTitle>Outstanding Attention Items ({data.outstandingAttentionItems.length})</ReportSectionTitle>
            <ReportTable
              headers={['Description', 'MDA', 'Category', 'Amount']}
              columnWidths={['40%', '25%', '15%', '20%']}
              rows={data.outstandingAttentionItems.map(item => ({
                cells: [
                  item.description.length > 50 ? item.description.slice(0, 47) + '...' : item.description,
                  item.mdaName,
                  item.category === 'review' ? 'Review' : item.category === 'info' ? 'Info' : 'Complete',
                  item.amount ? formatNaira(item.amount) : '—',
                ],
                rightAlign: [false, false, false, true],
              }))}
            />
          </>
        )}
      </ReportPageWrapper>

      {/* Page 2: Quick Recovery + Activity + Portfolio */}
      <ReportPageWrapper
        title={meta.reportTitle}
        subtitle="Recovery & Portfolio"
        referenceNumber={meta.referenceNumber}
        generatedAt={meta.generatedAt}
      >
        {/* Quick Recovery Opportunities */}
        {data.quickRecoveryOpportunities.length > 0 && (
          <>
            <ReportSectionTitle>Quick Recovery Opportunities ({data.quickRecoveryOpportunities.length})</ReportSectionTitle>
            <ReportTable
              headers={['Staff', 'MDA', 'Outstanding', 'Remaining']}
              columnWidths={['30%', '25%', '25%', '20%']}
              rows={data.quickRecoveryOpportunities.map(r => ({
                cells: [r.staffName, r.mdaName, formatNaira(r.outstandingBalance), `${String(r.estimatedRemainingInstallments)} inst.`],
                rightAlign: [false, false, true, true],
              }))}
            />
          </>
        )}

        {/* Observation Activity */}
        <ReportSectionTitle>Observation Activity</ReportSectionTitle>
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="New" value={`${data.observationActivity.newCount}`} />
          <ReportStatCard label="Reviewed" value={`${data.observationActivity.reviewedCount}`} />
          <ReportStatCard label="Resolved" value={`${data.observationActivity.resolvedCount}`} />
        </View>

        {/* Portfolio Snapshot */}
        <ReportSectionTitle>Portfolio Snapshot</ReportSectionTitle>
        <ReportTable
          headers={['Classification', 'Count', 'Percentage']}
          columnWidths={['50%', '25%', '25%']}
          rows={data.portfolioSnapshot.map(r => ({
            cells: [r.classification, `${r.count}`, formatPercent(r.percentage)],
            rightAlign: [false, true, true],
          }))}
        />

        <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: 12, textAlign: 'right' }}>
          Generated: {formatDateTime(data.generatedAt)}
        </Text>
      </ReportPageWrapper>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
