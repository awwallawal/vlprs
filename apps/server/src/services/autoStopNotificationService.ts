/**
 * Auto-Stop Notification Service (Story 8.3)
 *
 * Orchestrates sending Auto-Stop Certificate notifications to MDA officers
 * and beneficiaries. Each email is fire-and-forget — one failure doesn't
 * prevent others.
 */

import { db } from '../db';
import { autoStopCertificates, loans, users } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { sendAutoStopMdaNotification, sendAutoStopBeneficiaryNotification, isEmailConfigured } from '../lib/email';
import { buildCertificatePdfData } from './autoStopCertificateService';

// ─── Types ───────────────────────────────────���──────────────────────

export interface NotificationResult {
  mdaOfficersNotified: number;
  beneficiaryNotified: boolean;
  notes: string[];
}

// ─── Main Orchestrator ──────────────────────────────────────────────

export async function sendAutoStopNotifications(
  certificateId: string,
): Promise<NotificationResult> {
  const result: NotificationResult = {
    mdaOfficersNotified: 0,
    beneficiaryNotified: false,
    notes: [],
  };

  // Fetch certificate record
  const [cert] = await db
    .select()
    .from(autoStopCertificates)
    .where(eq(autoStopCertificates.id, certificateId))
    .limit(1);

  if (!cert) {
    logger.error({ certificateId }, 'Certificate not found for notification');
    result.notes.push('certificate_not_found');
    return result;
  }

  // Fetch loan record for beneficiary email
  const [loan] = await db
    .select({ beneficiaryEmail: loans.beneficiaryEmail })
    .from(loans)
    .where(eq(loans.id, cert.loanId))
    .limit(1);

  // Generate PDF once, attach to all emails
  const pdfData = await buildCertificatePdfData(cert);
  const { generateAutoStopCertificatePdf } = await import('./autoStopCertificatePdf');
  const pdfBuffer = await generateAutoStopCertificatePdf(pdfData);
  const pdfFilename = `auto-stop-certificate-${cert.certificateId}.pdf`;
  const completionDateStr = cert.completionDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // AC 4: track whether emails are actually sent or only logged to console
  const emailConfigured = isEmailConfigured();
  if (!emailConfigured) {
    result.notes.push('notification_logged_only');
  }

  // ─── MDA Officers ──────────────────────────────────────────────

  const officers = await db
    .select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(
      and(
        eq(users.mdaId, cert.mdaId),
        eq(users.role, 'mda_officer'),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  if (officers.length === 0) {
    logger.warn({ mdaId: cert.mdaId, certificateId: cert.certificateId }, 'No active MDA officers found for notification');
    result.notes.push('no_active_mda_officers');
  } else {
    for (const officer of officers) {
      try {
        await sendAutoStopMdaNotification({
          to: officer.email,
          officerName: `${officer.firstName} ${officer.lastName}`,
          staffName: cert.beneficiaryName,
          staffId: cert.staffId,
          mdaName: cert.mdaName,
          loanReference: cert.loanReference,
          completionDate: completionDateStr,
          certificateId: cert.certificateId,
          pdfBuffer,
          pdfFilename,
        });
        result.mdaOfficersNotified++;
      } catch (err) {
        logger.error({ err, to: officer.email, certificateId: cert.certificateId }, 'Failed to send auto-stop MDA notification to officer');
      }
    }
  }

  // ─── Beneficiary ───────────────────────────────────────────────

  if (loan?.beneficiaryEmail) {
    try {
      const totalPaidFormatted = Number(cert.totalPaid).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
      });

      await sendAutoStopBeneficiaryNotification({
        to: loan.beneficiaryEmail,
        beneficiaryName: cert.beneficiaryName,
        loanReference: cert.loanReference,
        totalPaid: totalPaidFormatted,
        completionDate: completionDateStr,
        certificateId: cert.certificateId,
        pdfBuffer,
        pdfFilename,
      });

      result.beneficiaryNotified = true;
    } catch (err) {
      logger.error({ err, to: loan.beneficiaryEmail, certificateId: cert.certificateId }, 'Failed to send auto-stop beneficiary notification');
    }
  } else {
    result.notes.push('beneficiary: no_email_on_file');
  }

  // ─── Single atomic DB update for all notification tracking ─────

  const now = new Date();
  await db
    .update(autoStopCertificates)
    .set({
      notifiedMdaAt: result.mdaOfficersNotified > 0 ? now : undefined,
      notifiedBeneficiaryAt: result.beneficiaryNotified ? now : undefined,
      notificationNotes: result.notes.length > 0 ? result.notes.join('; ') : null,
    })
    .where(eq(autoStopCertificates.id, certificateId));

  logger.info(
    { certificateId: cert.certificateId, mdaOfficersNotified: result.mdaOfficersNotified, beneficiaryNotified: result.beneficiaryNotified },
    'Auto-stop notifications processed',
  );

  return result;
}
