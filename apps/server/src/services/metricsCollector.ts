import os from 'node:os';
import { db } from '../db/index.js';
import { sql } from 'drizzle-orm';

interface RequestRecord {
  timestamp: number; // Date.now()
  durationMs: number;
  statusCode: number;
  method: string;
  url: string;
}

interface SlowEndpoint {
  path: string;
  durationMs: number;
}

export interface ApiPerformanceMetrics {
  avgResponseTime: number;
  errorRate: number;
  slowEndpoints: SlowEndpoint[];
  requestVolume: number;
  slowEndpointCount: number;
}

export interface InfrastructureMetrics {
  uptimeSeconds: number;
  uptimeFormatted: string;
  dbConnected: boolean;
  memoryUsagePercent: number;
  cpuLoadAvg: number;
  diskUsage: string;
}

class MetricsCollector {
  private requests: RequestRecord[] = [];
  private windowMs = 5 * 60 * 1000; // 5 minutes

  recordRequest(durationMs: number, statusCode: number, method: string, url: string): void {
    const now = Date.now();
    this.requests.push({ timestamp: now, durationMs, statusCode, method, url });
    // Prune expired entries
    this.requests = this.requests.filter((r) => now - r.timestamp < this.windowMs);
  }

  getApiPerformanceMetrics(): ApiPerformanceMetrics {
    const now = Date.now();
    const window = this.requests.filter((r) => now - r.timestamp < this.windowMs);
    const total = window.length;

    if (total === 0) {
      return { avgResponseTime: 0, errorRate: 0, slowEndpoints: [], requestVolume: 0, slowEndpointCount: 0 };
    }

    const avgResponseTime = Math.round(
      window.reduce((sum, r) => sum + r.durationMs, 0) / total,
    );
    const errors = window.filter((r) => r.statusCode >= 500).length;
    const errorRate = +((errors / total) * 100).toFixed(2);

    const slowRequests = window.filter((r) => r.durationMs > 1000);
    const slowEndpoints: SlowEndpoint[] = slowRequests
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 3)
      .map((r) => ({ path: `${r.method} ${r.url}`, durationMs: Math.round(r.durationMs) }));

    return {
      avgResponseTime,
      errorRate,
      slowEndpoints,
      requestVolume: total,
      slowEndpointCount: slowRequests.length,
    };
  }

  async getInfrastructureMetrics(): Promise<InfrastructureMetrics> {
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeFormatted = formatUptime(uptimeSeconds);

    // DB connectivity: SELECT 1 with 2s timeout
    let dbConnected = false;
    try {
      const result = await Promise.race([
        db.execute(sql`SELECT 1`),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DB ping timeout')), 2000),
        ),
      ]);
      dbConnected = !!result;
    } catch {
      // DB unreachable or timed out
    }

    // Memory usage
    const mem = process.memoryUsage();
    const memoryUsagePercent = +((mem.heapUsed / mem.heapTotal) * 100).toFixed(1);

    // CPU load average (1-minute) — returns [0,0,0] on Windows
    const cpuLoadAvg = +os.loadavg()[0].toFixed(2);

    return {
      uptimeSeconds,
      uptimeFormatted,
      dbConnected,
      memoryUsagePercent,
      cpuLoadAvg,
      diskUsage: 'N/A',
    };
  }

  /** Visible for testing — get current window size */
  getWindowSize(): number {
    return this.requests.length;
  }

  /** Visible for testing — clear all records */
  reset(): void {
    this.requests = [];
  }
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export const metricsCollector = new MetricsCollector();
