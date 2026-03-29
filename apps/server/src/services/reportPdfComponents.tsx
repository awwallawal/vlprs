/**
 * reportPdfComponents — Reusable branded PDF building blocks for report PDF generation.
 *
 * Used by all 5 report PDF generators (Executive Summary, MDA Compliance, Variance, Loan Snapshot, Weekly AG).
 * Follows patterns established in pdfGenerator.tsx (Trace Report).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Text, View, Image, Page, StyleSheet } from '@react-pdf/renderer';
import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Oyo State Crest (base64 embedded) ──────────────────────────

const crestBase64 = fs.readFileSync(
  path.resolve(__dirname, '../assets/oyo-crest.png'),
).toString('base64');

const CREST_URI = `data:image/png;base64,${crestBase64}`;

// ─── Reference Number ───────────────────────────────────────────

export function generateReferenceNumber(prefix = 'RPT'): string {
  const year = new Date().getFullYear();
  const uid = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `VLPRS-${prefix}-${year}-${uid}`;
}

// ─── Shared Styles ──────────────────────────────────────────────

export const reportStyles = StyleSheet.create({
  page: {
    padding: '14mm',
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1a1a2e',
  },
  // Header
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    padding: 16,
    marginBottom: 12,
    borderRadius: 4,
  },
  headerCrest: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  headerTextBlock: {
    flex: 1,
  },
  headerBranding: {
    fontSize: 7,
    color: '#a0a0a0',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 8,
    color: '#a0a0a0',
  },
  headerRight: {
    textAlign: 'right',
  },
  headerRef: {
    fontSize: 7,
    color: '#a0a0a0',
  },
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
  // Section titles
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
  // Table
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
  tableRowAlt: {
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 7,
    fontFamily: 'Courier',
    color: '#374151',
  },
  tableCellText: {
    fontSize: 7,
    color: '#374151',
  },
  tableCellHeader: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#6b7280',
  },
  tableCellRight: {
    textAlign: 'right',
  },
  // Badge
  badgeHealthy: {
    backgroundColor: '#ccfbf1',
    color: '#0d9488',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  badgeAttention: {
    backgroundColor: '#fef3c7',
    color: '#d97706',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  badgeForReview: {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  // Summary row
  summaryRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f4f8',
    borderTopWidth: 2,
    borderTopColor: '#e0e0e0',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
});

// ─── Format Helpers ─────────────────────────────────────────────

export function formatNaira(value: string): string {
  let d: Decimal;
  try {
    d = new Decimal(value);
  } catch {
    return value;
  }

  const isNegative = d.lt(0);
  const abs = d.abs();
  const [whole, frac = '00'] = abs.toFixed(2).split('.');
  const formatted = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return isNegative ? `-\u20A6${formatted}.${frac}` : `\u20A6${formatted}.${frac}`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatNumber(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

// ─── Reusable Components ────────────────────────────────────────

export function ReportHeader({ title, subtitle, referenceNumber, generatedAt }: {
  title: string;
  subtitle: string;
  referenceNumber: string;
  generatedAt: string;
}) {
  return (
    <View style={reportStyles.headerContainer}>
      <Image src={CREST_URI} style={reportStyles.headerCrest} />
      <View style={reportStyles.headerTextBlock}>
        <Text style={reportStyles.headerBranding}>Vehicle Loan Processing &amp; Receivables System</Text>
        <Text style={reportStyles.headerTitle}>{title}</Text>
        <Text style={reportStyles.headerSubtitle}>{subtitle}</Text>
      </View>
      <View style={reportStyles.headerRight}>
        <Text style={reportStyles.headerRef}>{generatedAt.slice(0, 10)}</Text>
        <Text style={reportStyles.headerRef}>Ref: {referenceNumber}</Text>
      </View>
    </View>
  );
}

export function ReportFooter({ referenceNumber, pageLabel }: {
  referenceNumber: string;
  pageLabel?: string;
}) {
  return (
    <View style={reportStyles.footer} fixed>
      <Text style={reportStyles.footerText}>Generated by VLPRS | Ref: {referenceNumber}</Text>
      <Text style={reportStyles.footerText}>For official use | {pageLabel ?? ''}</Text>
    </View>
  );
}

export function ReportPageWrapper({ children, title, subtitle, referenceNumber, generatedAt, orientation }: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  referenceNumber: string;
  generatedAt: string;
  orientation?: 'portrait' | 'landscape';
}) {
  return (
    <Page size="A4" orientation={orientation ?? 'portrait'} style={reportStyles.page}>
      <ReportHeader title={title} subtitle={subtitle} referenceNumber={referenceNumber} generatedAt={generatedAt} />
      {children}
      <ReportFooter referenceNumber={referenceNumber} />
    </Page>
  );
}

export function ReportSectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={reportStyles.sectionTitle}>{children}</Text>;
}

export function ReportStatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={reportStyles.statCard}>
      <Text style={reportStyles.statValue}>{value}</Text>
      <Text style={reportStyles.statLabel}>{label}</Text>
    </View>
  );
}

export function ReportTable({ headers, rows, columnWidths }: {
  headers: string[];
  rows: Array<{ cells: string[]; rightAlign?: boolean[] }>;
  columnWidths: string[];
}) {
  return (
    <View>
      <View style={reportStyles.tableHeader}>
        {headers.map((h, i) => (
          <Text key={i} style={[reportStyles.tableCellHeader, { width: columnWidths[i] }]}>{h}</Text>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={[reportStyles.tableRow, ri % 2 === 1 ? reportStyles.tableRowAlt : {}]}>
          {row.cells.map((cell, ci) => (
            <Text
              key={ci}
              style={[
                reportStyles.tableCellText,
                { width: columnWidths[ci] },
                row.rightAlign?.[ci] ? reportStyles.tableCellRight : {},
              ]}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export function ReportBadge({ band }: { band: 'healthy' | 'attention' | 'for-review' | string }) {
  const label = band === 'healthy' ? 'Healthy' : band === 'attention' ? 'Needs Attention' : 'For Review';
  const style = band === 'healthy' ? reportStyles.badgeHealthy : band === 'attention' ? reportStyles.badgeAttention : reportStyles.badgeForReview;
  return <Text style={style}>{label}</Text>;
}

export function ReportSeverityBadge({ tier }: { tier: 'Mild' | 'Moderate' | 'Elevated' | string }) {
  const style = tier === 'Mild' ? reportStyles.badgeHealthy : tier === 'Moderate' ? reportStyles.badgeAttention : reportStyles.badgeForReview;
  return <Text style={style}>{tier}</Text>;
}
