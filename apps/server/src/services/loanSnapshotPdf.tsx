/**
 * loanSnapshotPdf — PDF generator for Loan Snapshot Report (Story 6.4).
 * Uses landscape orientation for the 16-column table.
 */

import { renderToBuffer, Document } from '@react-pdf/renderer';
import { View, Text } from '@react-pdf/renderer';
import type { LoanSnapshotReportData, PdfReportMeta } from '@vlprs/shared';
import {
  ReportPageWrapper,
  ReportSectionTitle,
  ReportStatCard,
  reportStyles,
  formatNaira,
} from './reportPdfComponents';

export async function generateLoanSnapshotPdf(
  data: LoanSnapshotReportData,
  meta: PdfReportMeta,
): Promise<Buffer> {
  // Columns sized for landscape A4
  const cols = [
    { header: 'Staff ID', width: '6%' },
    { header: 'Name', width: '10%' },
    { header: 'Grade', width: '4%' },
    { header: 'Principal', width: '8%' },
    { header: 'Rate', width: '4%' },
    { header: 'Tenure', width: '4%' },
    { header: 'Mora.', width: '3%' },
    { header: 'Monthly', width: '7%' },
    { header: 'Paid', width: '3%' },
    { header: 'Outstanding', width: '9%' },
    { header: 'Status', width: '7%' },
    { header: 'Last Ded.', width: '7%' },
    { header: 'Next Ded.', width: '7%' },
    { header: 'Approval', width: '7%' },
    { header: 'Reference', width: '8%' },
    { header: 'MDA', width: '6%' },
  ];

  const doc = (
    <Document title={meta.reportTitle} author="VLPRS">
      <ReportPageWrapper
        title={meta.reportTitle}
        subtitle={meta.reportSubtitle}
        referenceNumber={meta.referenceNumber}
        generatedAt={meta.generatedAt}
        orientation="landscape"
      >
        {/* Summary Cards */}
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Total Loans" value={`${data.summary.totalLoans}`} />
          <ReportStatCard label="Total Outstanding" value={formatNaira(data.summary.totalOutstanding)} />
          <ReportStatCard label="Total Monthly Deduction" value={formatNaira(data.summary.totalMonthlyDeduction)} />
          <ReportStatCard label="Avg Interest Rate" value={`${data.summary.averageInterestRate}%`} />
        </View>

        <ReportSectionTitle>Loan Records ({data.pagination.totalItems} total)</ReportSectionTitle>

        {/* Table Header */}
        <View style={reportStyles.tableHeader}>
          {cols.map((c, i) => (
            <Text key={i} style={[reportStyles.tableCellHeader, { width: c.width, fontSize: 5.5 }]}>{c.header}</Text>
          ))}
        </View>

        {/* Table Rows */}
        {data.data.map((r, ri) => (
          <View key={ri} style={[reportStyles.tableRow, ri % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
            <Text style={[reportStyles.tableCell, { width: cols[0].width, fontSize: 5.5 }]}>{r.staffId}</Text>
            <Text style={[reportStyles.tableCellText, { width: cols[1].width, fontSize: 5.5 }]}>{r.staffName.length > 16 ? r.staffName.slice(0, 14) + '..' : r.staffName}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[2].width, fontSize: 5.5 }]}>{r.gradeLevel}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[3].width, fontSize: 5.5, textAlign: 'right' }]}>{formatNaira(r.principalAmount)}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[4].width, fontSize: 5.5, textAlign: 'right' }]}>{r.interestRate}%</Text>
            <Text style={[reportStyles.tableCell, { width: cols[5].width, fontSize: 5.5, textAlign: 'right' }]}>{String(r.tenureMonths)}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[6].width, fontSize: 5.5, textAlign: 'right' }]}>{String(r.moratoriumMonths)}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[7].width, fontSize: 5.5, textAlign: 'right' }]}>{formatNaira(r.monthlyDeductionAmount)}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[8].width, fontSize: 5.5, textAlign: 'right' }]}>{String(r.installmentsPaid)}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[9].width, fontSize: 5.5, textAlign: 'right' }]}>{formatNaira(r.outstandingBalance)}</Text>
            <Text style={[reportStyles.tableCellText, { width: cols[10].width, fontSize: 5.5 }]}>{r.status}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[11].width, fontSize: 5.5 }]}>{r.lastDeductionDate ?? '—'}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[12].width, fontSize: 5.5 }]}>{r.nextDeductionDate ?? '—'}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[13].width, fontSize: 5.5 }]}>{r.approvalDate}</Text>
            <Text style={[reportStyles.tableCell, { width: cols[14].width, fontSize: 5.5 }]}>{r.loanReference}</Text>
            <Text style={[reportStyles.tableCellText, { width: cols[15].width, fontSize: 5.5 }]}>{r.mdaCode}</Text>
          </View>
        ))}

        {/* Summary Footer */}
        <View style={reportStyles.summaryRow}>
          <Text style={[reportStyles.tableCellHeader, { width: '20%', fontSize: 6 }]}>TOTALS</Text>
          <Text style={[reportStyles.tableCellHeader, { width: '8%', fontSize: 6, textAlign: 'right' }]}>{formatNaira(data.summary.totalOutstanding)}</Text>
        </View>

        <Text style={{ fontSize: 6, color: '#9ca3af', marginTop: 8, textAlign: 'right' }}>
          Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalItems} records)
        </Text>
      </ReportPageWrapper>
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
