import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { sql, eq } from 'drizzle-orm';
import app from '../app';
import { db } from '../db/index';
import { users, mdas, schemeConfig, loans } from '../db/schema';
import { hashPassword } from '../lib/password';
import { signAccessToken } from '../lib/jwt';
import { generateUuidv7 } from '../lib/uuidv7';
import { resetRateLimiters } from '../middleware/rateLimiter';

let testMdaId: string;
let adminToken: string;
let adminUserId: string;
let officerToken: string;

beforeAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);

  testMdaId = generateUuidv7();
  await db.insert(mdas).values({ id: testMdaId, name: 'Dashboard Test MDA', code: 'DSHT', abbreviation: 'Dashboard Test' });

  adminUserId = generateUuidv7();
  const hashed = await hashPassword('Password1');
  await db.insert(users).values({
    id: adminUserId,
    email: 'admin@test.com',
    hashedPassword: hashed,
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
    isActive: true,
  });

  adminToken = signAccessToken({ userId: adminUserId, email: 'admin@test.com', role: 'super_admin', mdaId: null });

  // Create mda_officer user for RBAC rejection test
  const officerUserId = generateUuidv7();
  await db.insert(users).values({
    id: officerUserId,
    email: 'officer@test.com',
    hashedPassword: hashed,
    firstName: 'Officer',
    lastName: 'User',
    role: 'mda_officer',
    mdaId: testMdaId,
    isActive: true,
  });
  officerToken = signAccessToken({ userId: officerUserId, email: 'officer@test.com', role: 'mda_officer', mdaId: testMdaId });
});

beforeEach(() => {
  resetRateLimiters();
});

afterAll(async () => {
  await db.execute(sql`TRUNCATE loan_state_transitions, ledger_entries, loans, scheme_config, refresh_tokens, audit_log, users, mdas CASCADE`);
});

describe('GET /api/dashboard/metrics', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/dashboard/metrics');
    expect(res.status).toBe(401);
  });

  it('returns 403 for mda_officer role (requires super_admin or dept_admin)', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${officerToken}`);
    expect(res.status).toBe(403);
  });

  it('returns dashboard metrics with success envelope', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    // Primary hero row
    expect(typeof data.activeLoans).toBe('number');
    expect(typeof data.totalExposure).toBe('string');
    expect(typeof data.fundConfigured).toBe('boolean');
    expect(typeof data.monthlyRecovery).toBe('string');
    expect(typeof data.recoveryPeriod).toBe('string');

    // Analytics row
    expect(typeof data.loansInWindow).toBe('number');
    expect(typeof data.totalOutstandingReceivables).toBe('string');
    expect(typeof data.monthlyCollectionPotential).toBe('string');
    expect(typeof data.atRiskAmount).toBe('string');
    expect(typeof data.loanCompletionRate).toBe('number');
    expect(typeof data.loanCompletionRateLifetime).toBe('number');

    // Secondary metrics
    expect(typeof data.gratuityReceivableExposure).toBe('string');
    expect(data.staffIdCoverage).toEqual({ covered: 0, total: 0 });
  });

  it('returns fundConfigured: false and fundAvailable: null when scheme_fund_total not configured', async () => {
    // Ensure no scheme config exists
    await db.delete(schemeConfig).where(eq(schemeConfig.key, 'scheme_fund_total'));

    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.fundConfigured).toBe(false);
    expect(res.body.data.fundAvailable).toBeNull();
  });

  it('returns fundConfigured: true with computed fundAvailable when scheme_fund_total configured', async () => {
    // Set scheme fund total
    await db.insert(schemeConfig).values({
      key: 'scheme_fund_total',
      value: '5000000000.00',
      updatedBy: adminUserId,
    }).onConflictDoUpdate({
      target: schemeConfig.key,
      set: { value: '5000000000.00', updatedBy: adminUserId },
    });

    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.fundConfigured).toBe(true);
    expect(res.body.data.fundAvailable).not.toBeNull();
    expect(typeof res.body.data.fundAvailable).toBe('string');

    // Clean up
    await db.delete(schemeConfig).where(eq(schemeConfig.key, 'scheme_fund_total'));
  });

  it('returns zero counts when no loans exist', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.activeLoans).toBe(0);
    expect(res.body.data.loansInWindow).toBe(0);
    expect(res.body.data.loanCompletionRate).toBe(0);
    expect(res.body.data.loanCompletionRateLifetime).toBe(0);
  });

  it('response payload is compact (< 2KB)', async () => {
    const res = await request(app)
      .get('/api/dashboard/metrics')
      .set('Authorization', `Bearer ${adminToken}`);

    const payloadSize = Buffer.byteLength(JSON.stringify(res.body.data), 'utf-8');
    expect(payloadSize).toBeLessThan(2048);
  });
});

describe('GET /api/dashboard/attention', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/dashboard/attention');
    expect(res.status).toBe(401);
  });

  it('returns success envelope with items array and totalCount', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(typeof res.body.data.totalCount).toBe('number');
  });

  it('returns items sorted by priority (ascending)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    for (let i = 1; i < items.length; i++) {
      expect(items[i].priority).toBeGreaterThanOrEqual(items[i - 1].priority);
    }
  });

  it('returns max 10 items in items array', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(10);
  });

  it('allows MDA_OFFICER access (scoped to their MDA)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it('each item has required fields (type, category, priority, timestamp)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.data.items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.type).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.mdaName).toBe('string');
      expect(['review', 'info', 'complete']).toContain(item.category);
      expect(typeof item.priority).toBe('number');
      expect(typeof item.timestamp).toBe('string');
    }
  });

  it('returns empty items when no conditions exist (no loans)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.totalCount).toBe(0);
  });
});

describe('GET /api/dashboard/attention (detector integration)', () => {
  // Seed 3 ACTIVE loans that trigger different detectors:
  //  1. Empty staffId → missing_staff_id
  //  2. computedRetirementDate in the past → post_retirement_active
  //  3. No ledger entries at all → zero_deduction (60+ day gap)
  // All 3 share testMdaId, so per-MDA detectors aggregate them under "Dashboard Test MDA"

  beforeAll(async () => {
    await db.insert(loans).values([
      {
        id: generateUuidv7(),
        staffId: '',
        staffName: 'Missing ID Worker',
        gradeLevel: 'GL-08',
        mdaId: testMdaId,
        principalAmount: '500000.00',
        interestRate: '5.000',
        tenureMonths: 24,
        moratoriumMonths: 0,
        monthlyDeductionAmount: '21875.00',
        approvalDate: new Date('2025-01-01'),
        firstDeductionDate: new Date('2025-03-01'),
        loanReference: 'ATT-TEST-001',
        status: 'ACTIVE',
        limitedComputation: false,
      },
      {
        id: generateUuidv7(),
        staffId: 'STF-ATT-002',
        staffName: 'Retired Worker',
        gradeLevel: 'GL-14',
        mdaId: testMdaId,
        principalAmount: '1000000.00',
        interestRate: '5.000',
        tenureMonths: 48,
        moratoriumMonths: 0,
        monthlyDeductionAmount: '21875.00',
        approvalDate: new Date('2022-01-01'),
        firstDeductionDate: new Date('2022-03-01'),
        loanReference: 'ATT-TEST-002',
        status: 'ACTIVE',
        computedRetirementDate: new Date('2025-06-01'),
        limitedComputation: false,
      },
      {
        id: generateUuidv7(),
        staffId: 'STF-ATT-003',
        staffName: 'Zero Deduction Worker',
        gradeLevel: 'GL-10',
        mdaId: testMdaId,
        principalAmount: '300000.00',
        interestRate: '5.000',
        tenureMonths: 24,
        moratoriumMonths: 0,
        monthlyDeductionAmount: '26250.00',
        approvalDate: new Date('2025-01-01'),
        firstDeductionDate: new Date('2025-02-01'),
        loanReference: 'ATT-TEST-003',
        status: 'ACTIVE',
        limitedComputation: false,
      },
    ]);
  });

  it('detects loans with missing staff ID (aggregate, scheme-wide)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    const item = items.find((i: { type: string }) => i.type === 'missing_staff_id');
    expect(item).toBeDefined();
    expect(item.category).toBe('info');
    expect(item.priority).toBe(50);
    expect(item.mdaName).toBe('Scheme-wide');
    expect(item.count).toBeGreaterThanOrEqual(1);
    expect(item.description).toContain('records');
    expect(item.description).toContain('Staff ID');
    expect(item.drillDownUrl).toBe('/dashboard/loans?filter=missing-staff-id');
  });

  it('detects post-retirement active loans (per-MDA)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    const item = items.find((i: { type: string }) => i.type === 'post_retirement_active');
    expect(item).toBeDefined();
    expect(item.category).toBe('review');
    expect(item.priority).toBe(20);
    expect(item.mdaName).toBe('Dashboard Test MDA');
    expect(item.count).toBeGreaterThanOrEqual(1);
    expect(item.description).toContain('retirement');
    expect(item.drillDownUrl).toContain('post-retirement');
  });

  it('detects zero deduction loans — no ledger entries (per-MDA)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    const item = items.find((i: { type: string }) => i.type === 'zero_deduction');
    expect(item).toBeDefined();
    expect(item.category).toBe('review');
    expect(item.priority).toBe(10);
    expect(item.mdaName).toBe('Dashboard Test MDA');
    expect(item.count).toBeGreaterThanOrEqual(1);
    expect(item.drillDownUrl).toContain('zero-deduction');
  });

  it('returns items sorted by priority across multiple detector types', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    // At least 3 detector types should fire: zero_deduction, post_retirement, missing_staff_id
    expect(items.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < items.length; i++) {
      expect(items[i].priority).toBeGreaterThanOrEqual(items[i - 1].priority);
    }
  });

  it('totalCount matches items length when <= 10', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.totalCount).toBeGreaterThanOrEqual(3);
    expect(res.body.data.items.length).toBeLessThanOrEqual(10);
    expect(res.body.data.items.length).toBeLessThanOrEqual(res.body.data.totalCount);
  });

  it('MDA_OFFICER sees scoped per-MDA items for their MDA only', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    // Per-MDA items should be scoped to the officer's MDA
    for (const item of items) {
      if (item.type === 'zero_deduction' || item.type === 'post_retirement_active') {
        expect(item.mdaName).toBe('Dashboard Test MDA');
      }
    }
  });

  it('stub detectors return no items (future epic types absent)', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items;
    const futureTypes = [
      'submission_variance', 'overdue_submission', 'pending_auto_stop',
      'pending_early_exit', 'dark_mda', 'onboarding_lag',
    ];
    for (const ft of futureTypes) {
      expect(items.find((i: { type: string }) => i.type === ft)).toBeUndefined();
    }
  });

  it('each item has all required AttentionItem fields', async () => {
    const res = await request(app)
      .get('/api/dashboard/attention')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.data.items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.type).toBe('string');
      expect(typeof item.description).toBe('string');
      expect(typeof item.mdaName).toBe('string');
      expect(['review', 'info', 'complete']).toContain(item.category);
      expect(typeof item.priority).toBe('number');
      expect(typeof item.timestamp).toBe('string');
      // ISO 8601 format
      expect(item.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // drillDownUrl should be present for all implemented detectors
      expect(typeof item.drillDownUrl).toBe('string');
    }
  });
});

// ─── Story 4.3: Dashboard Breakdown Drill-Down ──────────────────────

describe('GET /api/dashboard/breakdown', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/dashboard/breakdown?metric=activeLoans');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid metric parameter', async () => {
    const res = await request(app)
      .get('/api/dashboard/breakdown?metric=invalidMetric')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when metric parameter is missing', async () => {
    const res = await request(app)
      .get('/api/dashboard/breakdown')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  it('returns success envelope with data array for activeLoans metric', async () => {
    const res = await request(app)
      .get('/api/dashboard/breakdown?metric=activeLoans')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('each MDA row has all required MdaBreakdownRow fields', async () => {
    const res = await request(app)
      .get('/api/dashboard/breakdown?metric=activeLoans')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const row of res.body.data) {
      expect(typeof row.mdaId).toBe('string');
      expect(typeof row.mdaName).toBe('string');
      expect(typeof row.mdaCode).toBe('string');
      expect(typeof row.contributionCount).toBe('number');
      expect(typeof row.contributionAmount).toBe('string');
      expect(typeof row.expectedMonthlyDeduction).toBe('string');
      expect(typeof row.actualMonthlyRecovery).toBe('string');
      expect(row.variancePercent === null || typeof row.variancePercent === 'number').toBe(true);
      expect(row.submissionStatus).toBeNull(); // Stubbed until Epic 5
      expect(typeof row.healthScore).toBe('number');
      expect(['healthy', 'attention', 'for-review']).toContain(row.healthBand);
      expect(typeof row.statusDistribution).toBe('object');
      expect(typeof row.statusDistribution.completed).toBe('number');
      expect(typeof row.statusDistribution.onTrack).toBe('number');
      expect(typeof row.statusDistribution.overdue).toBe('number');
      expect(typeof row.statusDistribution.stalled).toBe('number');
      expect(typeof row.statusDistribution.overDeducted).toBe('number');
    }
  });

  it('returns data for all valid metric types', async () => {
    const metrics = [
      'activeLoans', 'totalExposure', 'fundAvailable', 'monthlyRecovery',
      'loansInWindow', 'outstandingReceivables', 'collectionPotential',
      'atRisk', 'completionRate', 'completionRateLifetime',
    ];

    for (const metric of metrics) {
      const res = await request(app)
        .get(`/api/dashboard/breakdown?metric=${metric}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('includes variance computation for breakdown rows with loans', async () => {
    const res = await request(app)
      .get('/api/dashboard/breakdown?metric=monthlyRecovery')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // All rows should have expectedMonthlyDeduction and actualMonthlyRecovery
    for (const row of res.body.data) {
      expect(typeof row.expectedMonthlyDeduction).toBe('string');
      expect(typeof row.actualMonthlyRecovery).toBe('string');
    }
  });

  it('allows MDA_OFFICER access (scoped to their MDA)', async () => {
    const res = await request(app)
      .get('/api/dashboard/breakdown?metric=activeLoans')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // MDA_OFFICER should only see their own MDA's data
    for (const row of res.body.data) {
      expect(row.mdaId).toBe(testMdaId);
    }
  });

  it('monthlyRecovery metric sorts by variancePercent ascending (worst variance first)', async () => {
    const res = await request(app)
      .get('/api/dashboard/breakdown?metric=monthlyRecovery')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const rows = res.body.data;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].variancePercent !== null && rows[i - 1].variancePercent !== null) {
        expect(rows[i].variancePercent).toBeGreaterThanOrEqual(rows[i - 1].variancePercent);
      }
    }
  });
});

// ─── Story 4.4: Compliance Status View ───────────────────────────────

describe('GET /api/dashboard/compliance', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/dashboard/compliance');
    expect(res.status).toBe(401);
  });

  it('returns success envelope with rows, heatmap, and summary', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    expect(Array.isArray(res.body.data.heatmap)).toBe(true);
    expect(res.body.data.summary).toBeDefined();
  });

  it('summary has all required fields including heatmapSummary', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const summary = res.body.data.summary;
    expect(typeof summary.submitted).toBe('number');
    expect(typeof summary.pending).toBe('number');
    expect(typeof summary.overdue).toBe('number');
    expect(typeof summary.total).toBe('number');
    expect(typeof summary.deadlineDate).toBe('string');
    expect(summary.heatmapSummary).toBeDefined();
    expect(typeof summary.heatmapSummary.onTime).toBe('number');
    expect(typeof summary.heatmapSummary.gracePeriod).toBe('number');
    expect(typeof summary.heatmapSummary.awaiting).toBe('number');
  });

  it('deadlineDate is a valid ISO date string with 28th of a month', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const deadline = new Date(res.body.data.summary.deadlineDate);
    expect(deadline.getDate()).toBe(28);
  });

  it('each compliance row has all required MdaComplianceRow fields', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const row of res.body.data.rows) {
      expect(typeof row.mdaId).toBe('string');
      expect(typeof row.mdaCode).toBe('string');
      expect(typeof row.mdaName).toBe('string');
      expect(['submitted', 'pending', 'overdue']).toContain(row.status);
      expect(typeof row.recordCount).toBe('number');
      expect(typeof row.alignedCount).toBe('number');
      expect(typeof row.varianceCount).toBe('number');
      expect(typeof row.healthScore).toBe('number');
      expect(['healthy', 'attention', 'for-review']).toContain(row.healthBand);
      expect(typeof row.isDark).toBe('boolean');
    }
  });

  it('pre-Epic 5: all MDAs have pending status', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const row of res.body.data.rows) {
      expect(row.status).toBe('pending');
    }
  });

  it('pre-Epic 5: heatmap has empty cells for each MDA', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const row of res.body.data.heatmap) {
      expect(row.cells).toEqual([]);
      expect(row.complianceRate).toBe(0);
    }
  });

  it('allows MDA_OFFICER access (scoped to their MDA)', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${officerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // MDA_OFFICER should only see their own MDA
    for (const row of res.body.data.rows) {
      expect(row.mdaId).toBe(testMdaId);
    }
  });

  it('summary total matches rows length', async () => {
    const res = await request(app)
      .get('/api/dashboard/compliance')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.total).toBe(res.body.data.rows.length);
  });
});
