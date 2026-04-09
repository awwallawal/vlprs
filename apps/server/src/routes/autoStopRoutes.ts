import { Router, type Request, type Response } from 'express';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { readLimiter, writeLimiter, verificationLimiter } from '../middleware/rateLimiter';
import { ROLES, certificateListQuerySchema, type CertificateListQuery } from '@vlprs/shared';
import { detectAndTriggerAutoStop } from '../services/autoStopService';
import { db } from '../db';
import { autoStopCertificates, loans } from '../db/schema';
import {
  buildCertificatePdfData,
  listCertificates,
  type CertificateListFilters,
} from '../services/autoStopCertificateService';
import { sendAutoStopNotifications } from '../services/autoStopNotificationService';
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

// GET /api/certificates — Paginated list of issued certificates (Story 15.0i)
// CRITICAL: This route MUST be declared BEFORE /certificates/:loanId so that
// Express does not match the literal "certificates" segment as a :loanId param.
router.get(
  '/certificates',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
  validateQuery(certificateListQuerySchema),
  auditLog,
  readLimiter,
  async (req: Request, res: Response) => {
    // validateQuery has already parsed, coerced, and applied defaults to req.query.
    // Cast through `unknown` to the Zod-inferred type so the call site reflects that
    // validation is complete and downstream code can rely on the typed shape.
    const query = req.query as unknown as CertificateListQuery;
    const filters: CertificateListFilters = {
      mdaId: query.mdaId,
      notificationStatus: query.notificationStatus,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };
    const data = await listCertificates(filters, req.mdaScope);
    res.json({ success: true, data });
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
        notifiedMdaAt: cert.notifiedMdaAt,
        notifiedBeneficiaryAt: cert.notifiedBeneficiaryAt,
        notificationNotes: cert.notificationNotes,
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

// POST /api/certificates/:loanId/resend — Resend notifications (SUPER_ADMIN only)
router.post(
  '/certificates/:loanId/resend',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN),
  writeLimiter,
  auditLog,
  async (req: Request, res: Response) => {
    const loanId = param(req.params.loanId);

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

    const result = await sendAutoStopNotifications(cert.id);

    res.json({
      success: true,
      data: {
        mdaOfficersNotified: result.mdaOfficersNotified,
        beneficiaryNotified: result.beneficiaryNotified,
        notes: result.notes,
      },
    });
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
