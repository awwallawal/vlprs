/**
 * pdfGenerator — Server-side PDF generation using @react-pdf/renderer.
 *
 * Renders TraceReportData into an A4 PDF document.
 */

import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { TraceReportData } from '@vlprs/shared';

// ─── Styles ────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: '14mm',
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a2e',
  },
  // Header
  header: {
    backgroundColor: '#1a1a2e',
    padding: 16,
    marginBottom: 12,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerName: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#e0e0e0',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 8,
    color: '#a0a0a0',
  },
  headerRight: {
    position: 'absolute',
    top: 16,
    right: 16,
    textAlign: 'right',
  },
  headerBranding: {
    fontSize: 7,
    color: '#a0a0a0',
    marginBottom: 2,
  },
  // Stat cards
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 6,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 3,
    padding: 8,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
  },
  statLabel: {
    fontSize: 7,
    color: '#666666',
    marginTop: 2,
  },
  // Sections
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
    marginBottom: 6,
    marginTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 3,
  },
  // Observations
  observationBox: {
    borderLeftWidth: 3,
    borderLeftColor: '#0d9488',
    backgroundColor: '#f0fdfa',
    padding: 8,
    marginBottom: 6,
    borderRadius: 2,
  },
  observationAmber: {
    borderLeftColor: '#d97706',
    backgroundColor: '#fffbeb',
  },
  observationType: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#0d9488',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  observationText: {
    fontSize: 8,
    color: '#374151',
  },
  // Profile table
  profileRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 3,
  },
  profileLabel: {
    width: 120,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#666666',
  },
  profileValue: {
    flex: 1,
    fontSize: 8,
    color: '#1a1a2e',
  },
  // Loan panels
  loanPanel: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 3,
  },
  loanHeaderActive: {
    backgroundColor: '#3b82f6',
    padding: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  loanHeaderLiquidated: {
    backgroundColor: '#10b981',
    padding: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  loanHeaderCleared: {
    backgroundColor: '#059669',
    padding: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  loanHeaderInferred: {
    backgroundColor: '#f59e0b',
    padding: 8,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  loanHeaderText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
  },
  loanHeaderSub: {
    fontSize: 7,
    color: '#ffffffcc',
  },
  loanBody: {
    padding: 10,
  },
  // Field grid
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  fieldItem: {
    width: '30%',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 7,
    color: '#666666',
  },
  fieldValue: {
    fontSize: 9,
    fontFamily: 'Courier',
    color: '#1a1a2e',
  },
  // Math box
  mathBox: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 3,
    marginBottom: 8,
  },
  mathTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 4,
  },
  mathLine: {
    fontSize: 8,
    fontFamily: 'Courier',
    color: '#1a1a2e',
    marginBottom: 1,
  },
  mathConclusion: {
    fontSize: 8,
    color: '#374151',
    marginTop: 4,
    fontStyle: 'italic',
  },
  // Balance table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  tableRowGap: { backgroundColor: '#fffbeb' },
  tableRowStalled: { backgroundColor: '#fef2f2' },
  tableRowCleared: { backgroundColor: '#f0fdf4' },
  tableCell: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: '#374151',
  },
  tableCellHeader: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
  },
  colPeriod: { width: '18%' },
  colBalance: { width: '22%', textAlign: 'right' },
  colDeduction: { width: '20%', textAlign: 'right' },
  colInstPaid: { width: '15%', textAlign: 'right' },
  colSource: { width: '25%' },
  // Footer
  footer: {
    position: 'absolute',
    bottom: '14mm',
    left: '14mm',
    right: '14mm',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 7,
    color: '#9ca3af',
  },
  // Data completeness
  completenessBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginVertical: 3,
  },
  completenessFill: {
    height: 8,
    backgroundColor: '#0d9488',
    borderRadius: 4,
  },
});

// ─── Helper Components ─────────────────────────────────────────────

function formatNaira(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return value;
  return `₦${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getLoanHeaderStyle(status: string) {
  switch (status) {
    case 'liquidated':
      return styles.loanHeaderLiquidated;
    case 'cleared':
      return styles.loanHeaderCleared;
    case 'inferred':
      return styles.loanHeaderInferred;
    default:
      return styles.loanHeaderActive;
  }
}

function getObservationColor(type: string) {
  if (type === 'stalled_balance' || type === 'no_approval_match') {
    return styles.observationAmber;
  }
  return {};
}

// ─── PDF Document Component ────────────────────────────────────────

function TraceReportPdf({ data }: { data: TraceReportData }) {
  return (
    <Document title={`Trace Report — ${data.summary.staffName}`} author="VLPRS">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Individual Loan Trace Report</Text>
          <Text style={styles.headerName}>{data.summary.staffName}</Text>
          <Text style={styles.headerSubtitle}>
            {data.summary.mdas.map((m) => m.name).join(', ')} | {data.summary.totalLoanCycles} loan cycle(s) | {data.summary.dateRange.from} to {data.summary.dateRange.to}
          </Text>
          <View style={styles.headerRight}>
            <Text style={styles.headerBranding}>Oyo State Car Loan Scheme — VLPRS</Text>
            <Text style={styles.headerBranding}>{data.metadata.generatedAt.slice(0, 10)}</Text>
            <Text style={styles.headerBranding}>Ref: {data.metadata.referenceNumber}</Text>
          </View>
        </View>

        {/* Stat Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.summary.totalLoanCycles}</Text>
            <Text style={styles.statLabel}>Loan Cycles</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.summary.mdas.length}</Text>
            <Text style={styles.statLabel}>MDAs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.summary.totalMonthsOfRecords}</Text>
            <Text style={styles.statLabel}>Months of Records</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.dataCompleteness.overallPercent}%</Text>
            <Text style={styles.statLabel}>Data Completeness</Text>
          </View>
        </View>

        {/* Observations */}
        {data.observations.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Key Observations</Text>
            {data.observations.map((obs, i) => (
              <View key={i} style={[styles.observationBox, getObservationColor(obs.type)]}>
                <Text style={styles.observationType}>{obs.type.replace(/_/g, ' ')}</Text>
                <Text style={styles.observationText}>{obs.description}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Beneficiary Profile */}
        <Text style={styles.sectionTitle}>Beneficiary Profile</Text>
        <View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Full Name</Text>
            <Text style={styles.profileValue}>{data.beneficiaryProfile.fullName}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Staff ID</Text>
            <Text style={styles.profileValue}>{data.beneficiaryProfile.staffId ?? 'Not available'}</Text>
          </View>
          <View style={styles.profileRow}>
            <Text style={styles.profileLabel}>Current MDA</Text>
            <Text style={styles.profileValue}>{data.beneficiaryProfile.currentMda.name}</Text>
          </View>
          {data.beneficiaryProfile.previousMdas.length > 0 && (
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Previous MDA(s)</Text>
              <Text style={styles.profileValue}>
                {data.beneficiaryProfile.previousMdas.map((m) => `${m.name} (until ${m.lastSeen})`).join(', ')}
              </Text>
            </View>
          )}
        </View>
      </Page>

      {/* Per-loan panels on subsequent pages if needed */}
      {data.loanCycles.map((cycle, ci) => {
        const analysis = data.rateAnalyses[ci];
        return (
          <Page key={ci} size="A4" style={styles.page}>
            <View style={styles.loanPanel}>
              <View style={getLoanHeaderStyle(cycle.status)}>
                <Text style={styles.loanHeaderText}>
                  Loan Cycle {cycle.cycleNumber}: {cycle.mdaName}
                </Text>
                <Text style={styles.loanHeaderSub}>
                  {cycle.startPeriod} to {cycle.endPeriod ?? 'Present'} | Status: {cycle.status}
                </Text>
              </View>

              <View style={styles.loanBody}>
                {/* Loan field grid */}
                <View style={styles.fieldGrid}>
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>Principal</Text>
                    <Text style={styles.fieldValue}>{formatNaira(cycle.principal)}</Text>
                  </View>
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>Total Loan</Text>
                    <Text style={styles.fieldValue}>{formatNaira(cycle.totalLoan)}</Text>
                  </View>
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>Interest Amount</Text>
                    <Text style={styles.fieldValue}>{formatNaira(cycle.interestAmount)}</Text>
                  </View>
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>Effective Rate</Text>
                    <Text style={styles.fieldValue}>{cycle.effectiveRate}%</Text>
                  </View>
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>Monthly Deduction</Text>
                    <Text style={styles.fieldValue}>{formatNaira(cycle.monthlyDeduction)}</Text>
                  </View>
                  <View style={styles.fieldItem}>
                    <Text style={styles.fieldLabel}>Months of Data</Text>
                    <Text style={styles.fieldValue}>{cycle.monthsOfData} ({cycle.gapMonths} gaps)</Text>
                  </View>
                </View>

                {/* Math verification box */}
                {analysis && (
                  <View style={styles.mathBox}>
                    <Text style={styles.mathTitle}>Interest Rate Verification</Text>
                    <Text style={styles.mathLine}>
                      Principal: {formatNaira(analysis.principal)}
                    </Text>
                    <Text style={styles.mathLine}>
                      Actual Interest: {formatNaira(analysis.actualInterest)}
                    </Text>
                    <Text style={styles.mathLine}>
                      Standard Test (13.33% × 60mo): {formatNaira(analysis.standardTest.expectedInterest)} — {analysis.standardTest.match ? 'MATCH' : 'No match'}
                    </Text>
                    {analysis.acceleratedTest && (
                      <Text style={styles.mathLine}>
                        Accelerated Test ({analysis.acceleratedTest.tenure}mo): {formatNaira(analysis.acceleratedTest.expectedInterest)} — MATCH
                      </Text>
                    )}
                    <Text style={styles.mathConclusion}>{analysis.conclusion}</Text>
                  </View>
                )}

                {/* Balance trajectory table */}
                {cycle.balanceTrajectory.length > 0 && (
                  <View>
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableCellHeader, styles.colPeriod]}>Period</Text>
                      <Text style={[styles.tableCellHeader, styles.colBalance]}>Balance</Text>
                      <Text style={[styles.tableCellHeader, styles.colDeduction]}>Deduction</Text>
                      <Text style={[styles.tableCellHeader, styles.colInstPaid]}>#Paid</Text>
                      <Text style={[styles.tableCellHeader, styles.colSource]}>Source</Text>
                    </View>
                    {cycle.balanceTrajectory.map((entry, ei) => {
                      const rowStyle = entry.isGap
                        ? styles.tableRowGap
                        : entry.isStalled
                          ? styles.tableRowStalled
                          : (entry.balance === '0' || entry.balance === '0.00')
                            ? styles.tableRowCleared
                            : {};
                      return (
                        <View key={ei} style={[styles.tableRow, rowStyle]}>
                          <Text style={[styles.tableCell, styles.colPeriod]}>{entry.period}</Text>
                          <Text style={[styles.tableCell, styles.colBalance]}>
                            {entry.balance === 'N/A' ? 'N/A' : formatNaira(entry.balance)}
                          </Text>
                          <Text style={[styles.tableCell, styles.colDeduction]}>
                            {entry.deduction === 'N/A' ? 'N/A' : formatNaira(entry.deduction)}
                          </Text>
                          <Text style={[styles.tableCell, styles.colInstPaid]}>{entry.installmentsPaid}</Text>
                          <Text style={[styles.tableCell, styles.colSource]}>
                            {entry.sourceFile.length > 30 ? entry.sourceFile.slice(-30) : entry.sourceFile}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {data.metadata.dataSourceNote} | {data.metadata.dataFreshness}
              </Text>
              <Text style={styles.footerText}>
                Ref: {data.metadata.referenceNumber} | Generated by {data.metadata.generatedBy.name}
              </Text>
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

// ─── Public API ────────────────────────────────────────────────────

export async function generateTraceReportPdf(data: TraceReportData): Promise<Buffer> {
  const buffer = await renderToBuffer(<TraceReportPdf data={data} />);
  return Buffer.from(buffer);
}
