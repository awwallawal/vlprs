import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { auditLog } from '../middleware/auditLog';
import { readLimiter, verificationLimiter } from '../middleware/rateLimiter';
import { ROLES } from '@vlprs/shared';
import { detectAndTriggerAutoStop } from '../services/autoStopService';
import { db } from '../db';
import { autoStopCertificates, loans } from '../db/schema';
import { buildCertificatePdfData } from '../services/autoStopCertificateService';
import { param } from '../lib/params';

const router = Router();

// ─── Shared Helpers ──────────────────────────────────────────────────

/**
 * Verify MDA scope access for a loan. Returns the loanId on success, or sends 404 and returns null.
 */
async function verifyMdaScopeForLoan(req: Request, res: Response, loanId: string): Promise<boolean> {
  if (!req.mdaScope) return true; // super_admin / dept_admin — no scope restriction

  const [loan] = await db
    .select({ mdaId: loans.mdaId })
    .from(loans)
    .where(eq(loans.id, loanId))
    .limit(1);

  if (!loan || loan.mdaId !== req.mdaScope) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Certificate not found' },
    });
    return false;
  }

  return true;
}

// POST /api/auto-stop/scan — Manually trigger auto-stop detection (SUPER_ADMIN only)
router.post(
  '/auto-stop/scan',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN),
  auditLog,
  async (_req: Request, res: Response) => {
    const results = await detectAndTriggerAutoStop({ triggerSource: 'manual' });
    res.json({
      success: true,
      data: {
        completedCount: results.length,
        completions: results,
      },
    });
  },
);

// GET /api/certificates/:loanId — Certificate metadata (authenticated)
router.get(
  '/certificates/:loanId',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
  readLimiter,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);

    if (!(await verifyMdaScopeForLoan(req, res, loanId))) return;

    const [cert] = await db
      .select()
      .from(autoStopCertificates)
      .where(eq(autoStopCertificates.loanId, loanId))
      .limit(1);

    if (!cert) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Certificate not found' },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        certificateId: cert.certificateId,
        loanId: cert.loanId,
        verificationToken: cert.verificationToken,
        beneficiaryName: cert.beneficiaryName,
        staffId: cert.staffId,
        mdaName: cert.mdaName,
        loanReference: cert.loanReference,
        completionDate: cert.completionDate,
        generatedAt: cert.generatedAt,
      },
    });
  },
);

// GET /api/certificates/:loanId/pdf — Certificate PDF download (authenticated)
router.get(
  '/certificates/:loanId/pdf',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  auditLog,
  readLimiter,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);

    if (!(await verifyMdaScopeForLoan(req, res, loanId))) return;

    const [cert] = await db
      .select()
      .from(autoStopCertificates)
      .where(eq(autoStopCertificates.loanId, loanId))
      .limit(1);

    if (!cert) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Certificate not found' },
      });
      return;
    }

    // Build PDF data and generate on demand (don't store blobs)
    const pdfData = await buildCertificatePdfData(cert);
    const { generateAutoStopCertificatePdf } = await import('../services/autoStopCertificatePdf');
    const pdfBuffer = await generateAutoStopCertificatePdf(pdfData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="auto-stop-certificate-${cert.certificateId}.pdf"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.send(pdfBuffer);
  },
);

// GET /api/public/verify/:certificateId — Public verification (NO authentication)
router.get(
  '/public/verify/:certificateId',
  verificationLimiter,
  async (req: Request, res: Response) => {
    const certificateId = param(req.params.certificateId);

    const [cert] = await db
      .select()
      .from(autoStopCertificates)
      .where(eq(autoStopCertificates.certificateId, certificateId))
      .limit(1);

    if (!cert) {
      res.json({
        success: true,
        data: {
          valid: false,
          message: 'Certificate not found',
        },
      });
      return;
    }

    // AC: 4 — Only return name, MDA, date, and authenticity. NO financial details.
    res.json({
      success: true,
      data: {
        valid: true,
        message: `Verified — Certificate ${cert.certificateId} is authentic`,
        beneficiaryName: cert.beneficiaryName,
        mdaName: cert.mdaName,
        completionDate: cert.completionDate,
        generatedAt: cert.generatedAt,
      },
    });
  },
);

export default router;
