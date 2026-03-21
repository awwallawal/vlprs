import { describe, it, expect, beforeEach, vi } from 'vitest';
import { metricsCollector, formatUptime } from './metricsCollector';

// Mock the database for getInfrastructureMetrics tests
vi.mock('../db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  },
}));

describe('metricsCollector', () => {
  beforeEach(() => {
    metricsCollector.reset();
  });

  describe('recordRequest', () => {
    it('records a request and increments window size', () => {
      metricsCollector.recordRequest(50, 200, 'GET', '/api/health');
      expect(metricsCollector.getWindowSize()).toBe(1);
    });

    it('prunes expired entries on record', () => {
      // Record a request with a timestamp in the past by manipulating Date.now
      const realNow = Date.now;
      const fiveMinutesAgo = Date.now() - 6 * 60 * 1000;

      // Record request with old timestamp
      Date.now = () => fiveMinutesAgo;
      metricsCollector.recordRequest(50, 200, 'GET', '/api/old');

      // Record with current time — should prune the old one
      Date.now = realNow;
      metricsCollector.recordRequest(50, 200, 'GET', '/api/new');

      expect(metricsCollector.getWindowSize()).toBe(1);
    });
  });

  describe('getApiPerformanceMetrics', () => {
    it('returns zeros for empty window', () => {
      const metrics = metricsCollector.getApiPerformanceMetrics();
      expect(metrics.avgResponseTime).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.slowEndpoints).toEqual([]);
      expect(metrics.requestVolume).toBe(0);
      expect(metrics.slowEndpointCount).toBe(0);
    });

    it('computes average response time correctly', () => {
      metricsCollector.recordRequest(100, 200, 'GET', '/api/a');
      metricsCollector.recordRequest(200, 200, 'GET', '/api/b');
      metricsCollector.recordRequest(300, 200, 'GET', '/api/c');

      const metrics = metricsCollector.getApiPerformanceMetrics();
      expect(metrics.avgResponseTime).toBe(200);
      expect(metrics.requestVolume).toBe(3);
    });

    it('computes error rate from 5xx responses', () => {
      metricsCollector.recordRequest(50, 200, 'GET', '/api/ok');
      metricsCollector.recordRequest(50, 201, 'POST', '/api/ok');
      metricsCollector.recordRequest(50, 404, 'GET', '/api/notfound');
      metricsCollector.recordRequest(50, 500, 'GET', '/api/fail');

      const metrics = metricsCollector.getApiPerformanceMetrics();
      expect(metrics.errorRate).toBe(25); // 1 of 4
    });

    it('does not count 4xx as errors', () => {
      metricsCollector.recordRequest(50, 400, 'GET', '/api/bad');
      metricsCollector.recordRequest(50, 403, 'GET', '/api/forbidden');
      metricsCollector.recordRequest(50, 200, 'GET', '/api/ok');

      const metrics = metricsCollector.getApiPerformanceMetrics();
      expect(metrics.errorRate).toBe(0);
    });

    it('detects slow endpoints (>1000ms) and returns top 3', () => {
      metricsCollector.recordRequest(50, 200, 'GET', '/api/fast');
      metricsCollector.recordRequest(1500, 200, 'GET', '/api/slow1');
      metricsCollector.recordRequest(2000, 200, 'POST', '/api/slow2');
      metricsCollector.recordRequest(1200, 200, 'GET', '/api/slow3');
      metricsCollector.recordRequest(3000, 200, 'GET', '/api/slow4');

      const metrics = metricsCollector.getApiPerformanceMetrics();
      expect(metrics.slowEndpointCount).toBe(4);
      expect(metrics.slowEndpoints).toHaveLength(3);
      // Should be sorted by duration descending
      expect(metrics.slowEndpoints[0].path).toBe('GET /api/slow4');
      expect(metrics.slowEndpoints[0].durationMs).toBe(3000);
      expect(metrics.slowEndpoints[1].path).toBe('POST /api/slow2');
      expect(metrics.slowEndpoints[2].path).toBe('GET /api/slow1');
    });
  });
});

describe('getInfrastructureMetrics', () => {
  it('returns infrastructure metrics with expected shape', async () => {
    const metrics = await metricsCollector.getInfrastructureMetrics();
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(metrics.uptimeFormatted).toBeDefined();
    expect(typeof metrics.dbConnected).toBe('boolean');
    expect(metrics.dbConnected).toBe(true);
    expect(typeof metrics.memoryUsagePercent).toBe('number');
    expect(metrics.memoryUsagePercent).toBeGreaterThan(0);
    expect(metrics.memoryUsagePercent).toBeLessThan(100);
    expect(typeof metrics.cpuLoadAvg).toBe('number');
    expect(metrics.diskUsage).toBe('N/A');
  });

  it('reports dbConnected=false when DB ping fails', async () => {
    const { db } = await import('../db/index.js');
    (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('connection refused'));

    const metrics = await metricsCollector.getInfrastructureMetrics();
    expect(metrics.dbConnected).toBe(false);
    // Other metrics should still be populated
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof metrics.memoryUsagePercent).toBe('number');
  });

  it('formats uptime in the result', async () => {
    const metrics = await metricsCollector.getInfrastructureMetrics();
    // uptimeFormatted should match formatUptime(uptimeSeconds)
    expect(metrics.uptimeFormatted).toBe(formatUptime(metrics.uptimeSeconds));
  });
});

describe('formatUptime', () => {
  it('formats seconds only as minutes', () => {
    expect(formatUptime(45)).toBe('0m');
  });

  it('formats minutes correctly', () => {
    expect(formatUptime(300)).toBe('5m');
  });

  it('formats hours and minutes', () => {
    expect(formatUptime(3720)).toBe('1h 2m');
  });

  it('formats days, hours and minutes', () => {
    expect(formatUptime(90060)).toBe('1d 1h 1m');
  });

  it('formats large values', () => {
    expect(formatUptime(172800)).toBe('2d 0h 0m');
  });
});
