/**
 * variancePdf — PDF generator for Variance Report (Story 6.4).
 */

import { renderToBuffer, Document } from '@react-pdf/renderer';
import { View, Text } from '@react-pdf/renderer';
import type { VarianceReportData, PdfReportMeta } from '@vlprs/shared';
import {
  ReportPageWrapper,
  ReportSectionTitle,
  ReportStatCard,
  ReportTable,
  reportStyles,
  formatNaira,
  formatDateTime,
} from './reportPdfComponents';

export async function generateVariancePdf(
  data: VarianceReportData,
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
        {/* Summary Cards */}
        <View style={reportStyles.statsRow}>
          <ReportStatCard label="Aligned" value={`${data.summary.alignedCount}`} />
          <ReportStatCard label="Minor Variance" value={`${data.summary.minorVarianceCount}`} />
          <ReportStatCard label="Variance" value={`${data.summary.varianceCount}`} />
          <ReportStatCard label="Total Records" value={`${data.summary.totalRecords}`} />
        </View>

        {/* Variance Detail */}
        {data.rows.length > 0 && (
          <>
            <ReportSectionTitle>Variance Detail</ReportSectionTitle>
            <ReportTable
              headers={['Staff', 'Declared', 'Computed', 'Difference', 'Category', 'Explanation']}
              columnWidths={['18%', '14%', '14%', '14%', '12%', '28%']}
              rows={data.rows.slice(0, 50).map(r => ({
                cells: [
                  r.staffName,
                  formatNaira(r.declaredAmount),
                  formatNaira(r.computedAmount),
                  formatNaira(r.difference),
                  r.category === 'aligned' ? 'Aligned' : r.category === 'minor_variance' ? 'Minor' : 'Variance',
                  r.explanation.length > 40 ? r.explanation.slice(0, 37) + '...' : r.explanation,
                ],
                rightAlign: [false, true, true, true, false, false],
              }))}
            />
            {data.rows.length > 50 && (
              <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: 4 }}>
                Showing first 50 of {data.rows.length} records.
              </Text>
            )}
          </>
        )}
      </ReportPageWrapper>

      {/* Page 2: Enhanced classification registers */}
      {(data.overdueRegister.length > 0 || data.stalledRegister.length > 0 || data.overDeductedRegister.length > 0) && (
        <ReportPageWrapper
          title={meta.reportTitle}
          subtitle="Enhanced Classification Registers"
          referenceNumber={meta.referenceNumber}
          generatedAt={meta.generatedAt}
        >
          {/* Past Expected Completion */}
          {data.overdueRegister.length > 0 && (
            <>
              <ReportSectionTitle>Past Expected Completion ({data.overdueRegister.length})</ReportSectionTitle>
              <ReportTable
                headers={['Staff', 'Months Past', 'Outstanding', 'Severity']}
                columnWidths={['35%', '20%', '25%', '20%']}
                rows={data.overdueRegister.map(r => ({
                  cells: [r.staffName, String(r.monthsPastExpected), formatNaira(r.outstandingBalance), r.severityTier],
                  rightAlign: [false, true, true, false],
                }))}
              />
            </>
          )}

          {/* Balance Unchanged */}
          {data.stalledRegister.length > 0 && (
            <>
              <ReportSectionTitle>Balance Unchanged ({data.stalledRegister.length})</ReportSectionTitle>
              <ReportTable
                headers={['Staff', 'Consecutive Months', 'Frozen Amount']}
                columnWidths={['40%', '30%', '30%']}
                rows={data.stalledRegister.map(r => ({
                  cells: [r.staffName, String(r.consecutiveUnchangedMonths), formatNaira(r.frozenAmount)],
                  rightAlign: [false, true, true],
                }))}
              />
            </>
          )}

          {/* Balance Below Zero */}
          {data.overDeductedRegister.length > 0 && (
            <>
              <ReportSectionTitle>Balance Below Zero ({data.overDeductedRegister.length})</ReportSectionTitle>
              <ReportTable
                headers={['Staff', 'Negative Amount', 'Est. Over-Months']}
                columnWidths={['40%', '30%', '30%']}
                rows={data.overDeductedRegister.map(r => ({
                  cells: [r.staffName, formatNaira(r.negativeAmount), String(r.estimatedOverMonths)],
                  rightAlign: [false, true, true],
                }))}
              />
            </>
          )}

          <Text style={{ fontSize: 7, color: '#9ca3af', marginTop: 12, textAlign: 'right' }}>
            Generated: {formatDateTime(data.generatedAt)}
          </Text>
        </ReportPageWrapper>
      )}
    </Document>
  );

  const buffer = await renderToBuffer(doc);
  return Buffer.from(buffer);
}
