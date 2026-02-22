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

// ─── Resend Client (lazy singleton) ─────────────────────────────────

let resendClient: { emails: { send: (opts: { from: string; to: string; subject: string; html: string }) => Promise<unknown> } } | null = null;

async function getResendClient() {
  if (!resendClient && env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
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
