import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requirePasswordChange } from '../middleware/requirePasswordChange';
import { authorise } from '../middleware/authorise';
import { scopeToMda } from '../middleware/scopeToMda';
import { validateQuery } from '../middleware/validate';
import { auditLog } from '../middleware/auditLog';
import { ROLES, UI_COPY, beneficiaryQuerySchema, coverageQuerySchema, coverageRecordsQuerySchema, coverageRecordsExportSchema } from '@vlprs/shared';
import * as migrationDashboardService from '../services/migrationDashboardService';
import * as beneficiaryLedgerService from '../services/beneficiaryLedgerService';

const router = Router();

const dashboardAuth = [
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN, ROLES.MDA_OFFICER),
  scopeToMda,
];

// GET /api/migrations/dashboard — Migration dashboard data (all MDAs with status)
router.get(
  '/migrations/dashboard',
  ...dashboardAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await migrationDashboardService.getMigrationDashboard(req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/dashboard/metrics — Aggregate hero metrics
router.get(
  '/migrations/dashboard/metrics',
  ...dashboardAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await migrationDashboardService.getDashboardMetrics(req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/coverage — Coverage tracker matrix (Story 11.0b)
router.get(
  '/migrations/coverage',
  ...dashboardAuth,
  validateQuery(coverageQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const extended = req.query.extended === 'true';
    const data = await migrationDashboardService.getMigrationCoverage(req.mdaScope, extended);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/coverage/records — Coverage drill-down: records for a specific MDA + period (Story 8.0f)
router.get(
  '/migrations/coverage/records',
  ...dashboardAuth,
  validateQuery(coverageRecordsQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const data = await migrationDashboardService.getCoverageRecords(
      req.query.mdaId as string,
      Number(req.query.year),
      Number(req.query.month),
      { page: Number(req.query.page ?? 1), limit: Number(req.query.limit ?? 50) },
      { // Zod-validated; cast satisfies Express req.query types
        sortBy: (req.query.sortBy ?? 'staffName') as 'staffName',
        sortDir: (req.query.sortDir ?? 'asc') as 'asc' | 'desc',
      },
      req.mdaScope,
    );
    res.json({ success: true, data });
  },
);

// GET /api/migrations/coverage/records/export — CSV/Excel export for a specific MDA + period (Story 8.0f)
router.get(
  '/migrations/coverage/records/export',
  ...dashboardAuth,
  validateQuery(coverageRecordsExportSchema),
  auditLog,
  async (req: Request, res: Response) => {
    const mdaId = req.query.mdaId as string;
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const format = req.query.format as 'csv' | 'xlsx';

    const { records, mdaName, mdaCode, periodLabel } = await migrationDashboardService.getAllCoverageRecords(
      mdaId,
      year,
      month,
      req.mdaScope,
    );

    const paddedMonth = String(month).padStart(2, '0');
    const filename = `vlprs-${mdaCode}-${year}-${paddedMonth}-records.${format}`;

    if (format === 'csv') {
      const headers = ['Staff Name', 'Staff ID', 'Grade', 'Principal', 'Total Loan', 'Monthly Deduction', 'Outstanding Balance', 'Variance Category', 'Variance Amount', 'Baseline Status', 'Computed Rate', 'Sheet Name'];
      const escapeCsv = (val: string) => {
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };
      const csvRows = [headers.join(',')];
      for (const r of records) {
        csvRows.push([
          escapeCsv(r.staffName),
          escapeCsv(r.employeeNo ?? ''),
          escapeCsv(r.gradeLevel ?? ''),
          r.principal ?? '',
          r.totalLoan ?? '',
          r.monthlyDeduction ?? '',
          r.outstandingBalance ?? '',
          r.varianceCategory ? (UI_COPY.VARIANCE_CATEGORY_LABELS[r.varianceCategory] ?? r.varianceCategory) : '',
          r.varianceAmount ?? '',
          r.isBaselineCreated ? 'Established' : 'Pending',
          r.computedRate ?? '',
          escapeCsv(r.sheetName),
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send('\uFEFF' + csvRows.join('\n') + '\n');
    } else {
      // xlsx format
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const wsData = [
        [`${mdaName} — ${periodLabel} Migration Records`],
        [],
        ['Staff Name', 'Staff ID', 'Grade', 'Principal', 'Total Loan', 'Monthly Deduction', 'Outstanding Balance', 'Variance Category', 'Variance Amount', 'Baseline Status', 'Computed Rate', 'Sheet Name'],
        ...records.map((r) => [
          r.staffName,
          r.employeeNo ?? '',
          r.gradeLevel ?? '',
          r.principal ? Number(r.principal) : '',
          r.totalLoan ? Number(r.totalLoan) : '',
          r.monthlyDeduction ? Number(r.monthlyDeduction) : '',
          r.outstandingBalance ? Number(r.outstandingBalance) : '',
          r.varianceCategory ? (UI_COPY.VARIANCE_CATEGORY_LABELS[r.varianceCategory] ?? r.varianceCategory) : '',
          r.varianceAmount ? Number(r.varianceAmount) : '',
          r.isBaselineCreated ? 'Established' : 'Pending',
          r.computedRate ?? '',
          r.sheetName,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Auto-width columns
      const colWidths = wsData[2].map((header, i) => {
        let max = String(header).length;
        for (const row of wsData.slice(3)) {
          const len = String(row[i] ?? '').length;
          if (len > max) max = len;
        }
        return { wch: Math.min(max + 2, 40) };
      });
      ws['!cols'] = colWidths;

      const sheetName = `${mdaCode} - ${periodLabel}`.slice(0, 31); // Sheet name max 31 chars
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    }
  },
);

// GET /api/migrations/beneficiaries — Paginated beneficiary ledger
router.get(
  '/migrations/beneficiaries',
  ...dashboardAuth,
  validateQuery(beneficiaryQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      mdaId: req.query.mdaId as string | undefined,
      sortBy: req.query.sortBy as 'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const data = await beneficiaryLedgerService.listBeneficiaries(filters, req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/beneficiaries/metrics — Beneficiary aggregate metrics
router.get(
  '/migrations/beneficiaries/metrics',
  ...dashboardAuth,
  auditLog,
  async (req: Request, res: Response) => {
    const data = await beneficiaryLedgerService.getBeneficiaryMetrics(req.mdaScope);
    res.json({ success: true, data });
  },
);

// GET /api/migrations/beneficiaries/export — CSV export
router.get(
  '/migrations/beneficiaries/export',
  ...dashboardAuth,
  validateQuery(beneficiaryQuerySchema),
  auditLog,
  async (req: Request, res: Response) => {
    const filters = {
      search: req.query.search as string | undefined,
      mdaId: req.query.mdaId as string | undefined,
      sortBy: req.query.sortBy as 'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
    };
    const csv = await beneficiaryLedgerService.exportBeneficiariesCsv(filters, req.mdaScope);
    const date = new Date().toISOString().slice(0, 10);
    const filterDesc = filters.mdaId ? `mda-${filters.mdaId.slice(0, 8)}` : 'all';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vlprs-beneficiary-ledger-${date}-${filterDesc}.csv"`);
    res.send(csv);
  },
);

export default router;
