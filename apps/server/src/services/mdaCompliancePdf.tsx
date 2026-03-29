/**
 * mdaCompliancePdf — PDF generator for MDA Compliance Report (Story 6.4).
 */

import { renderToBuffer, Document } from '@react-pdf/renderer';
import { View, Text } from '@react-pdf/renderer';
import type { MdaComplianceReportData, PdfReportMeta } from '@vlprs/shared';
import {
  ReportPageWrapper,
  ReportSectionTitle,
  ReportStatCard,
  reportStyles,
  formatNaira,
  formatPercent,
  formatDateTime,
} from './reportPdfComponents';

export async function generateMdaCompliancePdf(
  data: MdaComplianceReportData,
  meta: PdfReportMeta,
): Promise<Buffer> {
  const colWidths = ['22%', '10%', '10%', '10%', '10%', '10%', '15%', '13%'];

  const doc = (
    <Document title={meta.reportTitle} author="VLPRS">
      <ReportPageWrapper
        title={meta.reportTitle}
        subtitle={meta.reportSubtitle}
        referenceNumber={meta.referenceNumber}
        generatedAt={meta.generatedAt}
      >
        {/* Summary Cards */}
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Total MDAs" value={`${data.summary.totalMdas}`} />
          <ReportStatCard label="Avg Health Score" value={`${data.summary.averageHealthScore}`} />
          <ReportStatCard label="Total Outstanding" value={formatNaira(data.summary.totalOutstanding)} />
          <ReportStatCard label="Total Observations" value={`${data.summary.totalObservations}`} />
        </View>

        {/* MDA Table */}
        <ReportSectionTitle>MDA Compliance Detail</ReportSectionTitle>
        <View>
          {/* Header */}
          <View style={reportStyles.tableHeader}>
            {['MDA', 'Health', 'Coverage', 'Compliance', 'Records', 'Observations', 'Outstanding', 'Status'].map((h, i) => (
              <Text key={i} style={[reportStyles.tableCellHeader, { width: colWidths[i] }]}>{h}</Text>
            ))}
          </View>
          {/* Rows */}
          {data.rows.map((r, ri) => {
            const bandLabel = r.healthBand === 'healthy' ? 'Healthy' : r.healthBand === 'attention' ? 'Attention' : 'For Review';
            return (
              <View key={ri} style={[reportStyles.tableRow, ri % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
                <Text style={[reportStyles.tableCellText, { width: colWidths[0] }]}>{r.mdaName}</Text>
                <Text style={[reportStyles.tableCellText, { width: colWidths[1] }]}>{r.healthScore} ({bandLabel})</Text>
                <Text style={[reportStyles.tableCellText, { width: colWidths[2], textAlign: 'right' }]}>{r.coveragePercent != null ? formatPercent(r.coveragePercent) : '—'}</Text>
                <Text style={[reportStyles.tableCellText, { width: colWidths[3], textAlign: 'right' }]}>{formatPercent(r.compliancePercent)}</Text>
                <Text style={[reportStyles.tableCellText, { width: colWidths[4], textAlign: 'right' }]}>{r.recordCount}</Text>
                <Text style={[reportStyles.tableCellText, { width: colWidths[5], textAlign: 'right' }]}>{r.unresolvedObservationCount}</Text>
                <Text style={[reportStyles.tableCellText, { width: colWidths[6], textAlign: 'right' }]}>{formatNaira(r.totalOutstanding)}</Text>
                <Text style={[reportStyles.tableCellText, { width: colWidths[7] }]}>{r.submissionStatus}</Text>
              </View>
            );
          })}
          {/* Summary Row */}
          <View style={reportStyles.summaryRow}>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[0] }]}>TOTAL ({data.summary.totalMdas} MDAs)</Text>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[1] }]}>{data.summary.averageHealthScore} avg</Text>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[2] }]}></Text>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[3] }]}></Text>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[4] }]}></Text>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[5], textAlign: 'right' }]}>{data.summary.totalObservations}</Text>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[6], textAlign: 'right' }]}>{formatNaira(data.summary.totalOutstanding)}</Text>
            <Text style={[reportStyles.tableCellHeader, { width: colWidths[7] }]}></Text>
          </View>
        </View>

        <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: 12, textAlign: 'right' }}>
          Period: {data.periodYear}-{String(data.periodMonth).padStart(2, '0')} | Generated: {formatDateTime(data.generatedAt)}
        </Text>
      </ReportPageWrapper>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
