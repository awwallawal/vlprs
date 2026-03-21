import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requirePasswordChange } from '../middleware/requirePasswordChange.js';
import { authorise } from '../middleware/authorise.js';
import { readLimiter } from '../middleware/rateLimiter.js';
import { auditLog } from '../middleware/auditLog.js';
import { ROLES, type HealthGroup, type HealthMetric, type MetricStatus, type SystemHealthResponse } from '@vlprs/shared';
import { metricsCollector, formatUptime } from '../services/metricsCollector.js';
import { getIntegrityResults, getBusinessHealthResults } from '../services/integrityChecker.js';

const router = Router();

// ─── Threshold helpers ──────────────────────────────────────────────

function thresholdStatus(value: number, greenBelow: number, amberBelow: number): MetricStatus {
  if (value < greenBelow) return 'green';
  if (value < amberBelow) return 'amber';
  return 'grey';
}

function thresholdStatusReverse(value: number, greenAbove: number, amberAbove: number): MetricStatus {
  if (value >= greenAbove) return 'green';
  if (value >= amberAbove) return 'amber';
  return 'grey';
}

function countStatus(value: number, greenMax: number, amberMax: number): MetricStatus {
  if (value <= greenMax) return 'green';
  if (value <= amberMax) return 'amber';
  return 'grey';
}

// ─── GET /api/system-health ─────────────────────────────────────────

router.get(
  '/system-health',
  authenticate,
  requirePasswordChange,
  authorise(ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN),
  readLimiter,
  auditLog,
  async (req: Request, res: Response) => {
    const role = req.user!.role;

    // Collect all metrics
    const apiMetrics = metricsCollector.getApiPerformanceMetrics();
    const infraMetrics = role === ROLES.SUPER_ADMIN
      ? await metricsCollector.getInfrastructureMetrics()
      : null;
    const integrityData = getIntegrityResults();
    const businessData = getBusinessHealthResults();

    const now = new Date().toISOString();
    const cachedAt = integrityData.lastChecked?.toISOString() ?? now;
    const stamp = (metrics: HealthMetric[], ts: string) =>
      metrics.map((m) => ({ ...m, lastUpdated: ts }));

    const groups: HealthGroup[] = [];

    // ─── Infrastructure (SUPER_ADMIN only) ────────────────────────
    if (role === ROLES.SUPER_ADMIN) {
      const infraItems: HealthMetric[] = [
        {
          name: 'API Uptime',
          value: infraMetrics!.uptimeFormatted,
          status: 'green' as MetricStatus, // info only
        },
        {
          name: 'Database Connectivity',
          value: infraMetrics!.dbConnected ? 'Connected' : 'Unreachable',
          status: infraMetrics!.dbConnected ? 'green' : 'grey',
        },
        {
          name: 'Memory Usage',
          value: infraMetrics!.memoryUsagePercent,
          unit: '%',
          status: thresholdStatus(infraMetrics!.memoryUsagePercent, 70, 85),
          threshold: { amber: 70, grey: 85 },
        },
        {
          name: 'CPU Load',
          value: infraMetrics!.cpuLoadAvg,
          details: 'Load average (Linux only — N/A on Windows)',
          status: thresholdStatus(infraMetrics!.cpuLoadAvg, 2.0, 4.0),
          threshold: { amber: 2.0, grey: 4.0 },
        },
        {
          name: 'Disk Usage',
          value: 'N/A',
          status: 'grey' as MetricStatus,
          details: 'Placeholder — no built-in Node.js disk API',
        },
      ];
      groups.push({ name: 'Infrastructure', metrics: stamp(infraItems, now) });
    }

    // ─── API Performance ──────────────────────────────────────────
    const apiItems: HealthMetric[] = [];

    // SUPER_ADMIN gets all 4; DEPT_ADMIN gets 2 (response time + error rate)
    apiItems.push({
      name: 'Average Response Time',
      value: apiMetrics.avgResponseTime,
      unit: 'ms',
      status: thresholdStatus(apiMetrics.avgResponseTime, 200, 500),
      threshold: { amber: 200, grey: 500 },
    });

    apiItems.push({
      name: 'Error Rate (5xx)',
      value: apiMetrics.errorRate,
      unit: '%',
      status: thresholdStatus(apiMetrics.errorRate, 1, 5),
      threshold: { amber: 1, grey: 5 },
    });

    if (role === ROLES.SUPER_ADMIN) {
      apiItems.push({
        name: 'Slow Endpoint Detection',
        value: apiMetrics.slowEndpointCount,
        unit: 'count',
        status: countStatus(apiMetrics.slowEndpointCount, 0, 3),
        details: apiMetrics.slowEndpoints.length > 0
          ? `Top slow: ${apiMetrics.slowEndpoints.map((e) => `${e.path} (${(e.durationMs / 1000).toFixed(1)}s)`).join(', ')}`
          : undefined,
      });

      apiItems.push({
        name: 'Request Volume',
        value: apiMetrics.requestVolume,
        unit: 'count',
        status: 'green' as MetricStatus, // info only
        details: 'Last 5 minutes',
      });
    }

    groups.push({ name: 'API Performance', metrics: stamp(apiItems, now) });

    // ─── Data Integrity ───────────────────────────────────────────
    const integrity = integrityData.results;
    const integrityItems: HealthMetric[] = [
      {
        name: 'Ledger Immutability',
        value: integrity?.ledgerImmutability.count ?? 0,
        unit: 'count',
        status: integrity?.ledgerImmutability.status ?? 'green',
        details: integrity?.ledgerImmutability.details,
      },
      {
        name: 'Migration Record Integrity',
        value: integrity?.migrationRecordIntegrity.count ?? 0,
        unit: 'count',
        status: integrity
          ? countStatus(integrity.migrationRecordIntegrity.count, 0, 10)
          : 'grey',
      },
      {
        name: 'Pending Review',
        value: integrity?.pendingObservations.count ?? 0,
        unit: 'count',
        status: integrity
          ? countStatus(integrity.pendingObservations.count, 0, 50)
          : 'grey',
      },
    ];
    groups.push({ name: 'Data Integrity', metrics: stamp(integrityItems, cachedAt) });

    // ─── Business Health ──────────────────────────────────────────
    const business = businessData.results;
    const businessItems: HealthMetric[] = [
      {
        name: 'MDA Submission Coverage',
        value: business?.mdaSubmissionCoverage.percent ?? 0,
        unit: '%',
        status: business
          ? thresholdStatusReverse(business.mdaSubmissionCoverage.percent, 80, 50)
          : 'grey',
        details: business
          ? `${business.mdaSubmissionCoverage.coveredCount} of ${business.mdaSubmissionCoverage.totalActive} MDAs`
          : undefined,
      },
      {
        name: 'Unresolved Exceptions',
        value: business?.unresolvedExceptions.count ?? 0,
        unit: 'count',
        status: business
          ? countStatus(business.unresolvedExceptions.count, 0, 20)
          : 'grey',
      },
      {
        name: 'Stale Data Detection',
        value: business?.staleMdas.count ?? 0,
        unit: 'count',
        status: business
          ? countStatus(business.staleMdas.count, 0, 5)
          : 'grey',
        details: business && business.staleMdas.count > 0
          ? `${business.staleMdas.count} MDAs with no submission in 90 days`
          : undefined,
      },
    ];
    groups.push({ name: 'Business Health', metrics: stamp(businessItems, cachedAt) });

    const response: SystemHealthResponse = {
      groups,
      lastIntegrityCheck: integrityData.lastChecked?.toISOString() ?? new Date().toISOString(),
      serverUptime: infraMetrics?.uptimeFormatted ?? formatUptime(Math.floor(process.uptime())),
    };

    res.json({ success: true, data: response });
  },
);

export default router;
