import XLSX from 'xlsx';
import Decimal from 'decimal.js';
import { eq, and, desc, ilike, count } from 'drizzle-orm';
import { db } from '../db/index';
import { approvalBatches, approvedBeneficiaries, loans } from '../db/schema';
import { generateUuidv7 } from '../lib/uuidv7';
import { AppError } from '../lib/appError';
import { computeSchemeExpected } from './computationEngine';

// ─── Types ───────────────────────────────────────────────────────────

export type CommitteeSchemaType = 'approval' | 'retiree';

export interface DataQualityFlag {
  row: number;
  field: string;
  issue: string;
}

export interface ParsedRecord {
  sourceRow: number;
  sourceSheet: string;
  name: string;
  mdaRaw: string | null;
  gradeLevel: string | null;
  approvedAmount: string | null;
  listType: 'APPROVAL' | 'ADDENDUM' | 'RETIREE' | 'DECEASED';
  // 17-column retiree financial fields (null for 5-column)
  principal: string | null;
  interest: string | null;
  totalLoan: string | null;
  monthlyDeduction: string | null;
  installmentsPaid: number | null;
  totalPrincipalPaid: string | null;
  totalInterestPaid: string | null;
  totalLoanPaid: string | null;
  outstandingPrincipal: string | null;
  outstandingInterest: string | null;
  outstandingBalance: string | null;
  installmentsOutstanding: number | null;
  collectionDate: string | null;
  commencementDate: string | null;
}

export interface SheetPreview {
  sheetName: string;
  recordCount: number;
  skipped: boolean;
  skipReason?: string;
}

export interface CommitteeFilePreview {
  schemaType: CommitteeSchemaType;
  sheets: SheetPreview[];
  records: ParsedRecord[];
  dataQualityFlags: DataQualityFlag[];
}

// ─── Header Detection ─────────────────────────────────────────────────

const APPROVAL_HEADERS = ['s/n', 'name', 'mda', 'gl', 'amount'];
const RETIREE_HEADERS = ['name', 'mda', 'principal', 'interest', 'total loan', 'monthly deduction'];

function isHeaderRow(row: unknown[]): boolean {
  const values = row.map((c) => String(c ?? '').toLowerCase().trim());
  const matchCount = values.filter(
    (v) => APPROVAL_HEADERS.includes(v) || RETIREE_HEADERS.includes(v),
  ).length;
  return matchCount >= 3;
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (isHeaderRow(rows[i])) return i;
  }
  return -1; // No header found — treat row 0 as data
}

// ─── Schema Detection ─────────────────────────────────────────────────

function detectSchema(firstDataRow: unknown[]): CommitteeSchemaType {
  const nonEmpty = firstDataRow.filter((c) => c !== null && c !== undefined && String(c).trim() !== '');
  const columnCount = nonEmpty.length;
  if (columnCount >= 15) return 'retiree';
  if (columnCount <= 7) return 'approval';
  throw new AppError(422, 'UNKNOWN_SCHEMA', 'File does not match expected approval (5-col) or retiree (17-col) format');
}

// ─── Parsing ──────────────────────────────────────────────────────────

function toStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  return String(val).trim() || null;
}

function toNumStr(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/,/g, '').trim();
  if (!s || isNaN(Number(s))) return null;
  return s;
}

function toInt(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(String(val).replace(/,/g, '').trim());
  return isNaN(n) ? null : Math.round(n);
}

function parseApprovalRow(row: unknown[], sourceRow: number, sheetName: string): ParsedRecord | null {
  // 5-column: S/N, Name, MDA, GL, Amount (S/N may be absent)
  const offset = typeof row[0] === 'number' || /^\d+$/.test(String(row[0] ?? '').trim()) ? 1 : 0;
  const name = toStr(row[offset]);
  if (!name) return null;

  return {
    sourceRow,
    sourceSheet: sheetName,
    name,
    mdaRaw: toStr(row[offset + 1]),
    gradeLevel: toStr(row[offset + 2]),
    approvedAmount: toNumStr(row[offset + 3]),
    listType: 'APPROVAL',
    principal: null, interest: null, totalLoan: null, monthlyDeduction: null,
    installmentsPaid: null, totalPrincipalPaid: null, totalInterestPaid: null,
    totalLoanPaid: null, outstandingPrincipal: null, outstandingInterest: null,
    outstandingBalance: null, installmentsOutstanding: null,
    collectionDate: null, commencementDate: null,
  };
}

function parseRetireeRow(row: unknown[], sourceRow: number, sheetName: string): ParsedRecord | null {
  // 17-column: S/N, Name, MDA, GL, Principal, Interest, Total Loan, Monthly Deduction,
  // Installments Paid, Total Principal Paid, Total Interest Paid, Total Loan Paid,
  // Outstanding Principal, Outstanding Interest, Outstanding Balance, Installments Outstanding,
  // Collection Date / Commencement Date
  const offset = typeof row[0] === 'number' || /^\d+$/.test(String(row[0] ?? '').trim()) ? 1 : 0;
  const rawName = toStr(row[offset]);
  if (!rawName) return null;

  // "LATE" prefix detection for deceased
  const isDeceased = rawName.toUpperCase().startsWith('LATE ');
  const cleanName = isDeceased ? rawName.replace(/^LATE\s+/i, '') : rawName;
  const listType = isDeceased ? 'DECEASED' as const : 'RETIREE' as const;

  return {
    sourceRow,
    sourceSheet: sheetName,
    name: cleanName,
    mdaRaw: toStr(row[offset + 1]),
    gradeLevel: toStr(row[offset + 2]),
    approvedAmount: null, // Retiree records don't have a separate "approved amount" — principal is the loan value
    listType,
    principal: toNumStr(row[offset + 3]),
    interest: toNumStr(row[offset + 4]),
    totalLoan: toNumStr(row[offset + 5]),
    monthlyDeduction: toNumStr(row[offset + 6]),
    installmentsPaid: toInt(row[offset + 7]),
    totalPrincipalPaid: toNumStr(row[offset + 8]),
    totalInterestPaid: toNumStr(row[offset + 9]),
    totalLoanPaid: toNumStr(row[offset + 10]),
    outstandingPrincipal: toNumStr(row[offset + 11]),
    outstandingInterest: toNumStr(row[offset + 12]),
    outstandingBalance: toNumStr(row[offset + 13]),
    installmentsOutstanding: toInt(row[offset + 14]),
    collectionDate: toStr(row[offset + 15]),
    commencementDate: toStr(row[offset + 16]),
  };
}

// ─── Main Parse Function ──────────────────────────────────────────────

export async function parseCommitteeFile(
  buffer: Buffer,
  _filename: string,
): Promise<CommitteeFilePreview> {
  const workbook = XLSX.read(buffer, { cellDates: true });

  const allRecords: ParsedRecord[] = [];
  const allFlags: DataQualityFlag[] = [];
  const sheets: SheetPreview[] = [];
  let detectedSchema: CommitteeSchemaType | null = null;

  for (const sheetName of workbook.SheetNames) {
    // Skip "PAYMENT" sheets for retiree files
    if (/PAYMENT/i.test(sheetName)) {
      sheets.push({ sheetName, recordCount: 0, skipped: true, skipReason: 'Payment sheet' });
      continue;
    }

    const ws = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    if (rows.length === 0) {
      sheets.push({ sheetName, recordCount: 0, skipped: true, skipReason: 'Empty sheet' });
      continue;
    }

    // Find header row
    const headerIdx = findHeaderRow(rows);
    const dataStartIdx = headerIdx >= 0 ? headerIdx + 1 : 0;

    // Detect schema from first data row
    if (!detectedSchema && rows[dataStartIdx]) {
      detectedSchema = detectSchema(rows[dataStartIdx]);
    }

    const parser = detectedSchema === 'retiree' ? parseRetireeRow : parseApprovalRow;
    let sheetRecordCount = 0;

    for (let i = dataStartIdx; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) continue;

      const record = parser(row, i + 1, sheetName); // 1-indexed row numbers
      if (!record) continue;

      allRecords.push(record);
      sheetRecordCount++;

      // Data quality flags
      if (detectedSchema === 'approval') {
        if (!record.gradeLevel) {
          allFlags.push({ row: i + 1, field: 'gradeLevel', issue: 'Null GL' });
        }
        if (record.approvedAmount && Number(record.approvedAmount) <= 0) {
          allFlags.push({ row: i + 1, field: 'approvedAmount', issue: 'Zero or negative amount' });
        }
      }
    }

    sheets.push({ sheetName, recordCount: sheetRecordCount, skipped: false });
  }

  if (!detectedSchema) {
    throw new AppError(422, 'EMPTY_FILE', 'No data rows found in file');
  }

  // Check for duplicate names within file
  const nameCount = new Map<string, number>();
  for (const r of allRecords) {
    const key = r.name.toUpperCase();
    nameCount.set(key, (nameCount.get(key) ?? 0) + 1);
  }
  for (const [name, count] of nameCount) {
    if (count > 1) {
      allFlags.push({ row: 0, field: 'name', issue: `Duplicate name: "${name}" appears ${count} times` });
    }
  }

  return {
    schemaType: detectedSchema,
    sheets,
    records: allRecords,
    dataQualityFlags: allFlags,
  };
}

// ─── Batch CRUD ──────────────────────────────────────────────────────

export async function createBatch(
  label: string,
  listType: string,
  uploadedBy: string,
  year?: number | null,
  notes?: string | null,
) {
  const id = generateUuidv7();
  const [batch] = await db.insert(approvalBatches).values({
    id,
    label,
    listType,
    year: year ?? undefined,
    notes: notes ?? undefined,
    uploadedBy,
  }).returning();
  return batch;
}

export async function listBatches() {
  const rows = await db
    .select({
      id: approvalBatches.id,
      label: approvalBatches.label,
      year: approvalBatches.year,
      listType: approvalBatches.listType,
      notes: approvalBatches.notes,
      uploadedBy: approvalBatches.uploadedBy,
      uploadedAt: approvalBatches.uploadedAt,
      createdAt: approvalBatches.createdAt,
      recordCount: count(approvedBeneficiaries.id),
    })
    .from(approvalBatches)
    .leftJoin(approvedBeneficiaries, eq(approvedBeneficiaries.batchId, approvalBatches.id))
    .groupBy(approvalBatches.id)
    .orderBy(desc(approvalBatches.createdAt));

  return rows.map((r) => ({ ...r, recordCount: Number(r.recordCount) }));
}

export async function getBatchDetail(batchId: string) {
  const [batch] = await db
    .select()
    .from(approvalBatches)
    .where(eq(approvalBatches.id, batchId));

  if (!batch) {
    throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  }

  const beneficiaries = await db
    .select()
    .from(approvedBeneficiaries)
    .where(eq(approvedBeneficiaries.batchId, batchId));

  return { ...batch, beneficiaries };
}

// ─── Confirm Upload ──────────────────────────────────────────────────

export async function confirmUpload(
  records: ParsedRecord[],
  mdaMappings: Record<string, string>, // raw string → mdaId
  batchId: string,
  uploadReference?: string,
) {
  // Verify batch exists before inserting records
  const [batch] = await db
    .select({ id: approvalBatches.id })
    .from(approvalBatches)
    .where(eq(approvalBatches.id, batchId));
  if (!batch) {
    throw new AppError(404, 'BATCH_NOT_FOUND', 'Batch not found');
  }

  const values = records.map((r) => ({
    id: generateUuidv7(),
    batchId,
    name: r.name,
    mdaRaw: r.mdaRaw,
    mdaCanonicalId: r.mdaRaw ? (mdaMappings[r.mdaRaw] ?? null) : null,
    gradeLevel: r.gradeLevel,
    approvedAmount: r.approvedAmount,
    listType: r.listType,
    principal: r.principal,
    interest: r.interest,
    totalLoan: r.totalLoan,
    monthlyDeduction: r.monthlyDeduction,
    installmentsPaid: r.installmentsPaid,
    totalPrincipalPaid: r.totalPrincipalPaid,
    totalInterestPaid: r.totalInterestPaid,
    totalLoanPaid: r.totalLoanPaid,
    outstandingPrincipal: r.outstandingPrincipal,
    outstandingInterest: r.outstandingInterest,
    outstandingBalance: r.outstandingBalance,
    installmentsOutstanding: r.installmentsOutstanding,
    collectionDate: r.collectionDate,
    commencementDate: r.commencementDate,
    uploadReference: uploadReference ?? undefined,
    sourceRow: r.sourceRow,
    sourceSheet: r.sourceSheet,
  }));

  if (values.length > 0) {
    await db.insert(approvedBeneficiaries).values(values);
  }

  return { count: values.length };
}

// ─── Track 2: Three-Vector Validation (F2) ──────────────────────────

export interface ThreeVectorResult {
  sourceRow: number;
  name: string;
  category: 'clean' | 'variance' | 'requires_verification';
  schemeExpected: { totalLoan: string; monthlyDeduction: string; totalInterest: string } | null;
  reverseEngineered: { totalLoan: string | null; monthlyDeduction: string | null } | null;
  committeeDeclared: { totalLoan: string | null; monthlyDeduction: string | null };
}

const VARIANCE_THRESHOLD = '50'; // ₦50

export function threeVectorValidation(records: ParsedRecord[]): ThreeVectorResult[] {
  return records
    .filter((r) => r.listType === 'RETIREE' || r.listType === 'DECEASED')
    .map((r) => {
      const principal = r.principal;
      const declared = {
        totalLoan: r.totalLoan,
        monthlyDeduction: r.monthlyDeduction,
      };

      // Scheme expected: P × 13.33% ÷ 60 (standard 60-month tenure)
      let schemeExpected: ThreeVectorResult['schemeExpected'] = null;
      if (principal) {
        const result = computeSchemeExpected(principal, 60);
        schemeExpected = {
          totalLoan: result.totalLoan,
          monthlyDeduction: result.monthlyDeduction,
          totalInterest: result.totalInterest,
        };
      }

      // Reverse engineered from file data
      const reverseEngineered: ThreeVectorResult['reverseEngineered'] =
        r.totalLoan && r.monthlyDeduction
          ? { totalLoan: r.totalLoan, monthlyDeduction: r.monthlyDeduction }
          : null;

      // Categorize
      let category: ThreeVectorResult['category'] = 'requires_verification';
      if (schemeExpected && declared.totalLoan) {
        const diff = new Decimal(schemeExpected.totalLoan).minus(declared.totalLoan).abs();
        if (diff.lte(VARIANCE_THRESHOLD)) {
          category = 'clean';
        } else {
          category = 'variance';
        }
      }

      return {
        sourceRow: r.sourceRow,
        name: r.name,
        category,
        schemeExpected,
        reverseEngineered,
        committeeDeclared: declared,
      };
    });
}

// ─── Track 2: Match Stub (F3) ────────────────────────────────────────

export interface MatchResult {
  sourceRow: number;
  name: string;
  status: 'matched' | 'pending';
  matchedLoanId: string | null;
  matchedLoanRef: string | null;
}

export async function matchAndClassify(
  records: ParsedRecord[],
  mdaMappings: Record<string, string>,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  for (const r of records) {
    if (r.listType !== 'RETIREE' && r.listType !== 'DECEASED') continue;

    const mdaId = r.mdaRaw ? mdaMappings[r.mdaRaw] : null;
    if (!mdaId) {
      results.push({ sourceRow: r.sourceRow, name: r.name, status: 'pending', matchedLoanId: null, matchedLoanRef: null });
      continue;
    }

    // Exact name + MDA match against loans table
    const [match] = await db
      .select({ id: loans.id, loanReference: loans.loanReference })
      .from(loans)
      .where(and(
        ilike(loans.staffName, r.name),
        eq(loans.mdaId, mdaId),
      ))
      .limit(1);

    if (match) {
      results.push({
        sourceRow: r.sourceRow,
        name: r.name,
        status: 'matched',
        matchedLoanId: match.id,
        matchedLoanRef: match.loanReference,
      });
    } else {
      results.push({
        sourceRow: r.sourceRow,
        name: r.name,
        status: 'pending',
        matchedLoanId: null,
        matchedLoanRef: null,
      });
    }
  }

  return results;
}

// ─── Track 2: Process Step (F4) ──────────────────────────────────────

export async function processRetireeRecords(
  records: ParsedRecord[],
  mdaMappings: Record<string, string>,
  batchId: string,
  uploadReference?: string,
): Promise<{ processed: number; errors: string[] }> {
  let processed = 0;
  const errors: string[] = [];

  for (const r of records) {
    if (r.listType !== 'RETIREE' && r.listType !== 'DECEASED') continue;

    try {
      // Process each record in its own transaction for partial success
      await db.transaction(async (tx) => {
        const mdaCanonicalId = r.mdaRaw ? (mdaMappings[r.mdaRaw] ?? null) : null;

        await tx.insert(approvedBeneficiaries).values({
          id: generateUuidv7(),
          batchId,
          name: r.name,
          mdaRaw: r.mdaRaw,
          mdaCanonicalId,
          gradeLevel: r.gradeLevel,
          approvedAmount: r.approvedAmount,
          listType: r.listType,
          principal: r.principal,
          interest: r.interest,
          totalLoan: r.totalLoan,
          monthlyDeduction: r.monthlyDeduction,
          installmentsPaid: r.installmentsPaid,
          totalPrincipalPaid: r.totalPrincipalPaid,
          totalInterestPaid: r.totalInterestPaid,
          totalLoanPaid: r.totalLoanPaid,
          outstandingPrincipal: r.outstandingPrincipal,
          outstandingInterest: r.outstandingInterest,
          outstandingBalance: r.outstandingBalance,
          installmentsOutstanding: r.installmentsOutstanding,
          collectionDate: r.collectionDate,
          commencementDate: r.commencementDate,
          uploadReference: uploadReference ?? undefined,
          sourceRow: r.sourceRow,
          sourceSheet: r.sourceSheet,
        });
      });
      processed++;
    } catch (err) {
      errors.push(`Row ${r.sourceRow} (${r.name}): ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { processed, errors };
}
