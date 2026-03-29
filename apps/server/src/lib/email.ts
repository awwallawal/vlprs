import { env } from '../config/env';
import { logger } from './logger';

// ─── Types ───────────────────────────────────────────────────────────

interface WelcomeEmailParams {
  to: string;
  firstName: string;
  temporaryPassword: string;
  role: string;
  mdaName?: string;
  loginUrl: string;
}

interface PasswordResetEmailParams {
  to: string;
  firstName: string;
  temporaryPassword: string;
  loginUrl: string;
}

// ─── HTML Templates ──────────────────────────────────────────────────

function roleDescription(role: string, mdaName?: string): string {
  switch (role) {
    case 'dept_admin':
      return 'As Department Admin, you can manage loans, process migrations, and oversee MDA submissions.';
    case 'mda_officer':
      return `As MDA Reporting Officer${mdaName ? ` for ${mdaName}` : ''}, you can submit monthly deduction reports for your assigned MDA.`;
    default:
      return 'You have been granted access to the system.';
  }
}

function welcomeEmailHtml(params: WelcomeEmailParams): string {
  const roleDesc = roleDescription(params.role, params.mdaName);
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Welcome to VLPRS</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Hello ${params.firstName},</p>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Your account has been created on the Vehicle Loan Processing &amp; Recovery System.</p>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">${roleDesc}</p>
    <div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #555; font-size: 14px;">Your temporary password:</p>
      <p style="margin: 0; font-family: monospace; font-size: 18px; color: #1a1a1a; font-weight: bold;">${params.temporaryPassword}</p>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">You will be required to change this password when you first log in.</p>
    <a href="${params.loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; margin-top: 16px;">Log In Now</a>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">If you did not expect this email, please contact your system administrator.</p>
  </div>
</body>
</html>`;
}

function passwordResetEmailHtml(params: PasswordResetEmailParams): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Password Reset — VLPRS</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Hello ${params.firstName},</p>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Your password has been reset by an administrator.</p>
    <div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #555; font-size: 14px;">Your new temporary password:</p>
      <p style="margin: 0; font-family: monospace; font-size: 18px; color: #1a1a1a; font-weight: bold;">${params.temporaryPassword}</p>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">You will be required to change this password when you next log in.</p>
    <a href="${params.loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; margin-top: 16px;">Log In Now</a>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">If you did not expect this email, please contact your system administrator.</p>
  </div>
</body>
</html>`;
}

interface EmploymentEventConfirmationParams {
  to: string;
  firstName: string;
  eventType: string;
  staffName: string;
  staffId: string;
  effectiveDate: string;
  referenceNumber?: string;
}

interface TransferNotificationParams {
  to: string;
  firstName: string;
  staffName: string;
  staffId: string;
  direction: 'incoming_claim' | 'outgoing_confirm';
}

// ─── Resend Client (lazy singleton) ─────────────────────────────────

let resendClient: { emails: { send: (opts: { from: string; to: string; subject: string; html: string; attachments?: Array<{ filename: string; content: Buffer }> }) => Promise<unknown> } } | null = null;

async function getResendClient() {
  if (!resendClient && env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

// ─── Email Configuration Check (Story 11.0a) ────────────────────────

/**
 * Check if email sending is configured (Resend API key present).
 * Used to determine whether to show credentials on screen vs. email them.
 */
export function isEmailConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

// ─── Send Functions ──────────────────────────────────────────────────

/**
 * Send welcome email with temporary password.
 * Fire-and-forget: logs errors, never throws.
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const html = welcomeEmailHtml(params);

  if (!env.RESEND_API_KEY) {
    logger.info(
      { to: params.to, subject: 'Welcome to VLPRS' },
      '[DEV EMAIL] Welcome email — temp password: %s',
      params.temporaryPassword,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: 'Welcome to VLPRS — Your Account Has Been Created',
      html,
    });
    logger.info({ to: params.to }, 'Welcome email sent');
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send welcome email');
  }
}

/**
 * Send password reset email with temporary password.
 * Fire-and-forget: logs errors, never throws.
 */
export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<void> {
  const html = passwordResetEmailHtml(params);

  if (!env.RESEND_API_KEY) {
    logger.info(
      { to: params.to, subject: 'Password Reset — VLPRS' },
      '[DEV EMAIL] Password reset email — temp password: %s',
      params.temporaryPassword,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: 'Password Reset — VLPRS',
      html,
    });
    logger.info({ to: params.to }, 'Password reset email sent');
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send password reset email');
  }
}

/**
 * Send employment event confirmation email.
 * Fire-and-forget: logs errors, never throws.
 */
export async function sendEmploymentEventConfirmation(params: EmploymentEventConfirmationParams): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Employment Event Recorded</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Hello ${params.firstName},</p>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">An employment event has been recorded successfully.</p>
    <div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Event Type:</strong> ${params.eventType}</p>
      <p style="margin: 0 0 8px 0;"><strong>Staff Name:</strong> ${params.staffName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Staff ID:</strong> ${params.staffId}</p>
      <p style="margin: 0 0 8px 0;"><strong>Effective Date:</strong> ${params.effectiveDate}</p>
      ${params.referenceNumber ? `<p style="margin: 0;"><strong>Reference:</strong> ${params.referenceNumber}</p>` : ''}
    </div>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This is an automated confirmation from VLPRS.</p>
  </div>
</body>
</html>`;

  if (!env.RESEND_API_KEY) {
    logger.info(
      { to: params.to, eventType: params.eventType, staffId: params.staffId },
      '[DEV EMAIL] Employment event confirmation — %s for %s',
      params.eventType,
      params.staffName,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: 'Employment Event Recorded — VLPRS',
      html,
    });
    logger.info({ to: params.to }, 'Employment event confirmation email sent');
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send employment event confirmation email');
  }
}

/**
 * Send transfer notification email.
 * Fire-and-forget: logs errors, never throws.
 */
export async function sendTransferNotification(params: TransferNotificationParams): Promise<void> {
  const directionText = params.direction === 'incoming_claim'
    ? 'A transfer claim has been filed for a staff member at your MDA.'
    : 'A transfer has been confirmed for a staff member.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Transfer Notification — VLPRS</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Hello ${params.firstName},</p>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">${directionText}</p>
    <div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Staff Name:</strong> ${params.staffName}</p>
      <p style="margin: 0;"><strong>Staff ID:</strong> ${params.staffId}</p>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Please log in to VLPRS to review and take action.</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This is an automated notification from VLPRS.</p>
  </div>
</body>
</html>`;

  if (!env.RESEND_API_KEY) {
    logger.info(
      { to: params.to, staffId: params.staffId, direction: params.direction },
      '[DEV EMAIL] Transfer notification — %s for %s',
      params.direction,
      params.staffName,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: 'Transfer Notification — VLPRS',
      html,
    });
    logger.info({ to: params.to }, 'Transfer notification email sent');
  } catch (err) {
    logger.error({ err, to: params.to }, 'Failed to send transfer notification email');
  }
}

// ─── Reconciliation Alert (Story 11.3) ──────────────────────────────

interface ReconciliationAlertParams {
  mdaName: string;
  referenceNumber: string;
  period: string;
  dateDiscrepancyCount: number;
  unconfirmedCount: number;
}

/**
 * Send reconciliation alert email to Department Admin.
 * Fire-and-forget: logs errors, never throws.
 * Non-punitive tone: "Items require your review" not "Errors detected".
 */
export async function sendReconciliationAlertEmail(params: ReconciliationAlertParams): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Reconciliation Summary — VLPRS</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Hello,</p>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">A monthly submission for <strong>${params.mdaName}</strong> has been processed and some items require your review.</p>
    <div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0;"><strong>MDA:</strong> ${params.mdaName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Submission Reference:</strong> ${params.referenceNumber}</p>
      <p style="margin: 0 0 8px 0;"><strong>Period:</strong> ${params.period}</p>
      ${params.dateDiscrepancyCount > 0 ? `<p style="margin: 0 0 8px 0;"><strong>Employment events with date differences:</strong> ${params.dateDiscrepancyCount}</p>` : ''}
      ${params.unconfirmedCount > 0 ? `<p style="margin: 0;"><strong>Events pending submission confirmation:</strong> ${params.unconfirmedCount}</p>` : ''}
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Please log in to VLPRS to review the reconciliation summary.</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This is an automated notification from VLPRS.</p>
  </div>
</body>
</html>`;

  if (!env.RESEND_API_KEY) {
    logger.info(
      { mdaName: params.mdaName, referenceNumber: params.referenceNumber, period: params.period, dateDiscrepancyCount: params.dateDiscrepancyCount, unconfirmedCount: params.unconfirmedCount },
      '[DEV EMAIL] Reconciliation alert — %s, ref %s, period %s, %d date discrepancies, %d unconfirmed',
      params.mdaName,
      params.referenceNumber,
      params.period,
      params.dateDiscrepancyCount,
      params.unconfirmedCount,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    // NOTE: In production, resolve Dept Admin email from MDA users table.
    // For now, sends to system admin address as a fallback.
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: env.EMAIL_FROM,
      subject: `Reconciliation Review Required — ${params.mdaName} — VLPRS`,
      html,
    });
    logger.info({ referenceNumber: params.referenceNumber, mdaName: params.mdaName }, 'Reconciliation alert email sent');
  } catch (err) {
    logger.error({ err, referenceNumber: params.referenceNumber }, 'Failed to send reconciliation alert email');
  }
}

// ─── Historical Upload Confirmation (Story 11.4) ─────────────────────

interface HistoricalUploadConfirmationParams {
  referenceNumber: string;
  period: string;
  recordCount: number;
  matchRate: number;
}

export async function sendHistoricalUploadConfirmation(params: HistoricalUploadConfirmationParams): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Historical Upload Confirmed — VLPRS</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Your historical deduction records have been uploaded and cross-validated.</p>
    <div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0;"><strong>Reference:</strong> ${params.referenceNumber}</p>
      <p style="margin: 0 0 8px 0;"><strong>Period:</strong> ${params.period}</p>
      <p style="margin: 0 0 8px 0;"><strong>Records:</strong> ${params.recordCount}</p>
      <p style="margin: 0;"><strong>Match Rate:</strong> ${params.matchRate}%</p>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Log in to VLPRS to review the reconciliation details.</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This is an automated notification from VLPRS.</p>
  </div>
</body>
</html>`;

  if (!env.RESEND_API_KEY) {
    logger.info(
      { referenceNumber: params.referenceNumber, period: params.period, recordCount: params.recordCount, matchRate: params.matchRate },
      '[DEV EMAIL] Historical upload confirmation — ref %s, period %s, %d records, %s%% match rate',
      params.referenceNumber,
      params.period,
      params.recordCount,
      params.matchRate,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: env.EMAIL_FROM,
      subject: `Historical Upload Confirmed — ${params.referenceNumber} — VLPRS`,
      html,
    });
    logger.info({ referenceNumber: params.referenceNumber }, 'Historical upload confirmation email sent');
  } catch (err) {
    logger.error({ err, referenceNumber: params.referenceNumber }, 'Failed to send historical upload confirmation email');
  }
}

// ─── Historical Variance Alert (Story 11.4) ──────────────────────────

interface HistoricalVarianceAlertParams {
  mdaName: string;
  referenceNumber: string;
  period: string;
  varianceCount: number;
  largestVarianceAmount: string;
}

export async function sendHistoricalVarianceAlert(params: HistoricalVarianceAlertParams): Promise<void> {
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Historical Upload — Review Required — VLPRS</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">A historical upload for <strong>${params.mdaName}</strong> has variances that require your review.</p>
    <div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0;"><strong>MDA:</strong> ${params.mdaName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Reference:</strong> ${params.referenceNumber}</p>
      <p style="margin: 0 0 8px 0;"><strong>Period:</strong> ${params.period}</p>
      <p style="margin: 0 0 8px 0;"><strong>Variances observed:</strong> ${params.varianceCount}</p>
      <p style="margin: 0;"><strong>Largest variance:</strong> \u20A6${Number(params.largestVarianceAmount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p>
    </div>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">Please log in to VLPRS to review the reconciliation details.</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">This is an automated notification from VLPRS.</p>
  </div>
</body>
</html>`;

  if (!env.RESEND_API_KEY) {
    logger.info(
      { mdaName: params.mdaName, referenceNumber: params.referenceNumber, period: params.period, varianceCount: params.varianceCount, largestVarianceAmount: params.largestVarianceAmount },
      '[DEV EMAIL] Historical variance alert — %s, ref %s, period %s, %d variances, largest %s',
      params.mdaName,
      params.referenceNumber,
      params.period,
      params.varianceCount,
      params.largestVarianceAmount,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: env.EMAIL_FROM,
      subject: `Historical Upload Review — ${params.mdaName} — VLPRS`,
      html,
    });
    logger.info({ referenceNumber: params.referenceNumber, mdaName: params.mdaName }, 'Historical variance alert email sent');
  } catch (err) {
    logger.error({ err, referenceNumber: params.referenceNumber }, 'Failed to send historical variance alert email');
  }
}

// ─── HTML Escape Helper ────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Report Sharing Email (Story 6.4) ──────────────────────────────

interface ReportEmailParams {
  to: string;
  reportTitle: string;
  coverMessage?: string;
  pdfBuffer: Buffer;
  pdfFilename: string;
}

function reportShareEmailHtml(params: { reportTitle: string; coverMessage?: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">VLPRS Report: ${params.reportTitle}</h1>
    <p style="color: #333; font-size: 16px; line-height: 1.5;">A report has been shared with you from the Vehicle Loan Processing &amp; Receivables System.</p>
    ${params.coverMessage ? `<div style="background: #f0f4f8; border-radius: 6px; padding: 20px; margin: 24px 0;"><p style="margin: 0; color: #333; font-size: 14px; line-height: 1.5;">${escapeHtml(params.coverMessage)}</p></div>` : ''}
    <p style="color: #333; font-size: 16px; line-height: 1.5;">The report is attached as a PDF document.</p>
    <p style="color: #999; font-size: 12px; margin-top: 32px;">For official use. Generated by VLPRS — Oyo State Car Loan Scheme.</p>
  </div>
</body>
</html>`;
}

/**
 * Send report sharing email with PDF attachment.
 * Fire-and-forget: logs errors, never throws.
 */
export async function sendReportEmail(params: ReportEmailParams): Promise<void> {
  const html = reportShareEmailHtml({ reportTitle: params.reportTitle, coverMessage: params.coverMessage });

  if (!env.RESEND_API_KEY) {
    logger.info(
      { to: params.to, reportTitle: params.reportTitle, pdfSize: params.pdfBuffer.length },
      '[DEV EMAIL] Report share — %s (%d bytes)',
      params.reportTitle,
      params.pdfBuffer.length,
    );
    return;
  }

  try {
    const resend = await getResendClient();
    await resend!.emails.send({
      from: env.EMAIL_FROM,
      to: params.to,
      subject: `VLPRS Report: ${params.reportTitle}`,
      html,
      attachments: [{
        filename: params.pdfFilename,
        content: params.pdfBuffer,
      }],
    });
    logger.info({ to: params.to, reportTitle: params.reportTitle }, 'Report share email sent');
  } catch (err) {
    logger.error({ err, to: params.to, reportTitle: params.reportTitle }, 'Failed to send report share email');
  }
}
