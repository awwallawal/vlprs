/**
 * Auto-Stop Certificate PDF Generator (Story 8.2, Task 4)
 *
 * Premium visual treatment: gold border, green celebration panel, Oyo State crest.
 * This is the system's "emotional climax" — the guarantee that no government worker
 * will ever again be over-deducted.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToBuffer, Document } from '@react-pdf/renderer';
import { Text, View, Image, Page, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import type { AutoStopCertificateData } from './autoStopCertificateService';
import { formatNaira } from './reportPdfComponents';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Oyo State Crest (base64 embedded — reuses same asset) ──────
const crestBase64 = fs.readFileSync(
  path.resolve(__dirname, '../assets/oyo-crest.png'),
).toString('base64');
const CREST_URI = `data:image/png;base64,${crestBase64}`;

// ─── Certificate Styles ─────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    padding: 0,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a2e',
  },
  outerBorder: {
    margin: 20,
    border: '3pt solid #B8860B',
    padding: 30,
    flex: 1,
  },
  // Header
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  crest: {
    width: 60,
    height: 60,
    marginBottom: 8,
  },
  govTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#9C1E23',
    textAlign: 'center',
    marginBottom: 2,
  },
  systemTitle: {
    fontSize: 9,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 4,
  },
  // Certificate title bar
  titleBar: {
    backgroundColor: '#1a1a2e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
  },
  titleId: {
    fontSize: 9,
    color: '#a0a0a0',
  },
  // Celebration panel
  celebrationPanel: {
    backgroundColor: '#16A34A',
    borderRadius: 6,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  congratsText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  celebrationBody: {
    fontSize: 10,
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 1.5,
  },
  // Detail sections
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#B8860B',
    paddingBottom: 3,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingVertical: 2,
  },
  detailLabel: {
    width: 140,
    fontSize: 9,
    color: '#6b7280',
  },
  detailValue: {
    flex: 1,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1a1a2e',
  },
  detailSection: {
    marginBottom: 16,
  },
  // QR section
  qrSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 4,
    backgroundColor: '#f9fafb',
  },
  qrCode: {
    width: 90,
    height: 90,
    marginRight: 16,
  },
  qrText: {
    flex: 1,
  },
  qrLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#374151',
    marginBottom: 4,
  },
  qrUrl: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  // Footer
  footer: {
    marginTop: 'auto',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
  },
});

// ─── Certificate Document ───────────────────────────────────────

function AutoStopCertificateDocument({ data }: { data: AutoStopCertificateData }) {
  const completionDateStr = format(data.completionDate, 'dd MMMM yyyy');
  const generatedAtStr = format(data.generatedAt, 'dd MMMM yyyy');

  return (
    <Document title={`Auto-Stop Certificate ${data.certificateId}`} author="VLPRS">
      <Page size="A4" style={styles.page}>
        <View style={styles.outerBorder}>
          {/* Header with crest */}
          <View style={styles.headerSection}>
            <Image src={CREST_URI} style={styles.crest} />
            <Text style={styles.govTitle}>OYO STATE GOVERNMENT</Text>
            <Text style={styles.systemTitle}>
              Vehicle Loan Processing &amp; Receivables System
            </Text>
          </View>

          {/* Certificate title bar */}
          <View style={styles.titleBar}>
            <Text style={styles.titleText}>AUTO-STOP CERTIFICATE</Text>
            <Text style={styles.titleId}>{data.certificateId}</Text>
          </View>

          {/* Green celebration panel */}
          <View style={styles.celebrationPanel}>
            <Text style={styles.congratsText}>Congratulations!</Text>
            <Text style={styles.celebrationBody}>
              This certifies that the vehicle loan for the below-named staff{'\n'}
              has been fully repaid. All payroll deductions should cease immediately.
            </Text>
          </View>

          {/* Beneficiary details */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>BENEFICIARY DETAILS</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Name</Text>
              <Text style={styles.detailValue}>{data.beneficiaryName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Staff ID</Text>
              <Text style={styles.detailValue}>{data.staffId}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>MDA</Text>
              <Text style={styles.detailValue}>{data.mdaName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Loan Reference</Text>
              <Text style={styles.detailValue}>{data.loanReference}</Text>
            </View>
          </View>

          {/* Completion details */}
          <View style={styles.detailSection}>
            <Text style={styles.sectionTitle}>COMPLETION DETAILS</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Original Principal</Text>
              <Text style={styles.detailValue}>{formatNaira(data.originalPrincipal)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Interest Paid</Text>
              <Text style={styles.detailValue}>{formatNaira(data.totalInterestPaid)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Total Amount Paid</Text>
              <Text style={styles.detailValue}>{formatNaira(data.totalPaid)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Completion Date</Text>
              <Text style={styles.detailValue}>{completionDateStr}</Text>
            </View>
          </View>

          {/* QR verification section */}
          <View style={styles.qrSection}>
            <Image src={data.qrCodeDataUrl} style={styles.qrCode} />
            <View style={styles.qrText}>
              <Text style={styles.qrLabel}>Scan to verify this certificate</Text>
              <Text style={styles.qrUrl}>{data.verificationUrl}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              This certificate was automatically generated by the Vehicle Loan Processing
              &amp; Receivables System on {generatedAtStr}.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Public API ─────────────────────────────────────────────────

export async function generateAutoStopCertificatePdf(
  data: AutoStopCertificateData,
): Promise<Buffer> {
  const buffer = await renderToBuffer(<AutoStopCertificateDocument data={data} />);
  return Buffer.from(buffer);
}
