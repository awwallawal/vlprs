export type MetricStatus = 'green' | 'amber' | 'grey';

export type HealthGroupName =
  | 'Infrastructure'
  | 'API Performance'
  | 'Data Integrity'
  | 'Business Health';

export interface HealthMetric {
  name: string;
  value: string | number;
  unit?: string; // 'ms', '%', 'count', 'days'
  status: MetricStatus;
  threshold?: { amber: number; grey: number };
  details?: string; // e.g., "Top slow: GET /api/loans (1.2s)"
  lastUpdated?: string; // ISO timestamp
}

export interface HealthGroup {
  name: HealthGroupName;
  metrics: HealthMetric[];
}

export interface SystemHealthResponse {
  groups: HealthGroup[];
  lastIntegrityCheck: string; // ISO timestamp
  serverUptime: string; // formatted "2d 5h 30m"
}
