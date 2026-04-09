/**
 * Auto-Stop Certificate Service (Story 8.2)
 *
 * Generates official Auto-Stop Certificates proving a loan is fully repaid.
 * Certificate generation is fire-and-forget from the auto-stop trigger —
 * failure does NOT roll back the loan completion.
 */

import { randomBytes } from 'node:crypto';
import { db } from '../db';
import { autoStopCertificates, loans, mdas, loanCompletions } from '../db/schema';
import { and, asc, count, desc, eq, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm';
import { generateUuidv7 } from '../lib/uuidv7';
import { withMdaScope } from '../lib/mdaScope';
import { logger } from '../lib/logger';
import { env } from '../config/env';
import { sendAutoStopNotifications } from './autoStopNotificationService';
import type {
  CertificateListItem,
  CertificateListResponse,
  CertificateNotificationStatus,
  CertificateSortBy,
} from '@vlprs/shared';

// ─── Types ──────────────────────────────────────────────────────────

export interface AutoStopCertificateData {
  certificateId: string;
  verificationToken: string;
  beneficiaryName: string;
  staffId: string;
  mdaName: string;
  loanReference: string;
  originalPrincipal: string;
  totalPaid: string;
  totalInterestPaid: string;
  completionDate: Date;
  generatedAt: Date;
  qrCodeDataUrl: string;
  verificationUrl: string;
}

// ─── Certificate ID Generator (Task 2.1) ────────────────────────────

/**
 * Generate sequential certificate ID in format: ASC-{YYYY}-{MM}-{NNNN}
 * Counter resets each month. Uses DB query to find the highest existing number.
 */
export async function generateCertificateId(year: number, month: number): Promise<string> {
  const prefix = `ASC-${year}-${String(month).padStart(2, '0')}-`;

  // Find the latest certificate in this year/month
  const [latest] = await db
    .select({ certificateId: autoStopCertificates.certificateId })
    .from(autoStopCertificates)
    .where(sql`${autoStopCertificates.certificateId} LIKE ${prefix + '%'}`)
    .orderBy(desc(autoStopCertificates.certificateId))
    .limit(1);

  let nextSeq = 1;
  if (latest) {
    const lastDigits = latest.certificateId.slice(-4);
    nextSeq = parseInt(lastDigits, 10) + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, '0')}`;
}

// ─── Verification Token Generator (Task 2.2) ────────────────────────

export function generateVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

// ─── Certificate Generation (Task 5) ────────────────────────────────

/**
 * Generate an Auto-Stop Certificate for a completed loan.
 * Idempotent: if a certificate already exists for this loanId, returns the existing one.
 */
export async function generateCertificate(loanId: string) {
  // Idempotency check — return existing certificate if one exists
  const [existing] = await db
    .select()
    .from(autoStopCertificates)
    .where(eq(autoStopCertificates.loanId, loanId))
    .limit(1);

  if (existing) {
    logger.info({ loanId, certificateId: existing.certificateId }, 'Certificate already exists — returning existing');
    return existing;
  }

  // Fetch loan details with MDA join
  const [loan] = await db
    .select({
      id: loans.id,
      staffName: loans.staffName,
      staffId: loans.staffId,
      mdaId: loans.mdaId,
      loanReference: loans.loanReference,
      principalAmount: loans.principalAmount,
    })
    .from(loans)
    .where(eq(loans.id, loanId));

  if (!loan) {
    throw new Error(`Loan not found: ${loanId}`);
  }

  // Fetch MDA name
  const [mda] = await db
    .select({ name: mdas.name })
    .from(mdas)
    .where(eq(mdas.id, loan.mdaId));

  if (!mda) {
    throw new Error(`MDA not found for loan: ${loanId}`);
  }

  // Fetch completion record
  const [completion] = await db
    .select()
    .from(loanCompletions)
    .where(eq(loanCompletions.loanId, loanId));

  if (!completion) {
    throw new Error(`No loan completion record found for loan: ${loanId}`);
  }

  // Generate certificate ID and verification token.
  // Retry on unique constraint violation (concurrent inserts — Task 2.1).
  const now = new Date();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const certificateId = await generateCertificateId(now.getFullYear(), now.getMonth() + 1);
    const verificationToken = generateVerificationToken();

    try {
      const [certificate] = await db
        .insert(autoStopCertificates)
        .values({
          id: generateUuidv7(),
          loanId,
          certificateId,
          verificationToken,
          beneficiaryName: loan.staffName,
          staffId: loan.staffId,
          mdaId: loan.mdaId,
          mdaName: mda.name,
          loanReference: loan.loanReference,
          originalPrincipal: loan.principalAmount,
          totalPaid: completion.totalPaid,
          totalInterestPaid: completion.totalInterestPaid,
          completionDate: completion.completionDate,
        })
        .returning();

      logger.info(
        { loanId, certificateId, staffName: loan.staffName },
        'Auto-Stop Certificate generated',
      );

      // Fire-and-forget notification — don't await, don't block certificate generation
      sendAutoStopNotifications(certificate.id).catch(err =>
        logger.error({ err, certificateId: certificate.id }, 'Auto-stop notification failed'),
      );

      return certificate;
    } catch (err: unknown) {
      // PostgreSQL unique_violation = 23505 (concurrent insert produced same certificate ID)
      const pgCode = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : null;
      if (pgCode === '23505' && attempt < MAX_RETRIES - 1) {
        logger.warn({ loanId, certificateId, attempt }, 'Certificate ID collision — retrying');
        continue;
      }
      throw err;
    }
  }

  // Should never reach here — MAX_RETRIES exhausted
  throw new Error(`Failed to generate certificate after ${MAX_RETRIES} attempts: ${loanId}`);
}

/**
 * Build the data object for PDF rendering from a certificate record.
 */
export async function buildCertificatePdfData(
  certificate: typeof autoStopCertificates.$inferSelect,
): Promise<AutoStopCertificateData> {
  const verificationUrl = `${env.APP_URL}/verify/${certificate.certificateId}`;

  // Dynamically import QR generator to keep this module lightweight
  const { generateQrCodeDataUrl } = await import('./autoStopCertificateQr');
  const qrCodeDataUrl = await generateQrCodeDataUrl(verificationUrl);

  return {
    certificateId: certificate.certificateId,
    verificationToken: certificate.verificationToken,
    beneficiaryName: certificate.beneficiaryName,
    staffId: certificate.staffId,
    mdaName: certificate.mdaName,
    loanReference: certificate.loanReference,
    originalPrincipal: certificate.originalPrincipal,
    totalPaid: certificate.totalPaid,
    totalInterestPaid: certificate.totalInterestPaid,
    completionDate: certificate.completionDate,
    generatedAt: certificate.generatedAt,
    qrCodeDataUrl,
    verificationUrl,
  };
}

// ─── List Certificates (Story 15.0i) ────────────────────────────────

export interface CertificateListFilters {
  mdaId?: string;
  notificationStatus?: CertificateNotificationStatus;
  page?: number;
  limit?: number;
  sortBy?: CertificateSortBy;
  sortOrder?: 'asc' | 'desc';
}

/**
 * List issued Auto-Stop Certificates with pagination, MDA scoping, and filtering.
 *
 * Notification status semantics:
 *   - 'pending'  → notifiedMdaAt IS NULL AND notifiedBeneficiaryAt IS NULL
 *   - 'notified' → notifiedMdaAt IS NOT NULL AND notifiedBeneficiaryAt IS NOT NULL
 *   - 'partial'  → exactly one of (notifiedMdaAt, notifiedBeneficiaryAt) is NULL
 *
 * Note: `verificationToken` is intentionally excluded from the response (security).
 */
export async function listCertificates(
  filters: CertificateListFilters = {},
  mdaScope?: string | null,
): Promise<CertificateListResponse> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = Math.min(Math.max(filters.limit ?? 25, 1), 100);
  const offset = (page - 1) * pageSize;

  // Build WHERE conditions. Typed as SQL[] (not ReturnType<typeof eq>[]) so we can
  // honestly push and(...) / or(...) clauses without casts.
  const conditions: SQL[] = [];

  const scopeCondition = withMdaScope(autoStopCertificates.mdaId, mdaScope);
  if (scopeCondition) conditions.push(scopeCondition);

  if (filters.mdaId) {
    conditions.push(eq(autoStopCertificates.mdaId, filters.mdaId));
  }

  if (filters.notificationStatus === 'pending') {
    conditions.push(isNull(autoStopCertificates.notifiedMdaAt));
    conditions.push(isNull(autoStopCertificates.notifiedBeneficiaryAt));
  } else if (filters.notificationStatus === 'notified') {
    conditions.push(isNotNull(autoStopCertificates.notifiedMdaAt));
    conditions.push(isNotNull(autoStopCertificates.notifiedBeneficiaryAt));
  } else if (filters.notificationStatus === 'partial') {
    // Exactly one is NULL — either MDA notified but not beneficiary, or vice versa.
    const partialClause = or(
      and(
        isNotNull(autoStopCertificates.notifiedMdaAt),
        isNull(autoStopCertificates.notifiedBeneficiaryAt),
      ),
      and(
        isNull(autoStopCertificates.notifiedMdaAt),
        isNotNull(autoStopCertificates.notifiedBeneficiaryAt),
      ),
    );
    if (partialClause) conditions.push(partialClause);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count query
  const [{ value: totalItems }] = await db
    .select({ value: count() })
    .from(autoStopCertificates)
    .where(whereClause);

  // Sort — column lookup is done lazily here (not at module load) so that
  // services that transitively import this module via generateCertificate
  // can mock ../db/schema without listing autoStopCertificates.
  const sortCol =
    (filters.sortBy ?? 'generatedAt') === 'completionDate'
      ? autoStopCertificates.completionDate
      : autoStopCertificates.generatedAt;
  const sortDirection = filters.sortOrder ?? 'desc';
  const orderExpr = sortDirection === 'asc' ? asc(sortCol) : desc(sortCol);

  // Data query — denormalised mdaName means no join needed.
  // verificationToken intentionally excluded from select for security.
  const rows = await db
    .select({
      certificateId: autoStopCertificates.certificateId,
      loanId: autoStopCertificates.loanId,
      beneficiaryName: autoStopCertificates.beneficiaryName,
      staffId: autoStopCertificates.staffId,
      mdaId: autoStopCertificates.mdaId,
      mdaName: autoStopCertificates.mdaName,
      loanReference: autoStopCertificates.loanReference,
      completionDate: autoStopCertificates.completionDate,
      generatedAt: autoStopCertificates.generatedAt,
      notifiedMdaAt: autoStopCertificates.notifiedMdaAt,
      notifiedBeneficiaryAt: autoStopCertificates.notifiedBeneficiaryAt,
      originalPrincipal: autoStopCertificates.originalPrincipal,
      totalPaid: autoStopCertificates.totalPaid,
    })
    .from(autoStopCertificates)
    .where(whereClause)
    .orderBy(orderExpr)
    .limit(pageSize)
    .offset(offset);

  const data: CertificateListItem[] = rows.map((r) => ({
    certificateId: r.certificateId,
    loanId: r.loanId,
    beneficiaryName: r.beneficiaryName,
    staffId: r.staffId,
    mdaId: r.mdaId,
    mdaName: r.mdaName,
    loanReference: r.loanReference,
    completionDate: r.completionDate.toISOString(),
    generatedAt: r.generatedAt.toISOString(),
    notifiedMdaAt: r.notifiedMdaAt ? r.notifiedMdaAt.toISOString() : null,
    notifiedBeneficiaryAt: r.notifiedBeneficiaryAt ? r.notifiedBeneficiaryAt.toISOString() : null,
    originalPrincipal: r.originalPrincipal,
    totalPaid: r.totalPaid,
  }));

  return {
    data,
    total: Number(totalItems),
    page,
    pageSize,
  };
}
