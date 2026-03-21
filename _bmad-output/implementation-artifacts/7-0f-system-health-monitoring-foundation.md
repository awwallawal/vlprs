# Story 7.0f: System Health Monitoring Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **Department Admin / AG (SUPER_ADMIN)**,
I want a dedicated System Health page showing 15 operational metrics across 4 groups,
So that I can assess system health at a glance without external monitoring tools.

## Acceptance Criteria

### AC 1: System Health Sidebar Navigation

**Given** the sidebar navigation
**When** a SUPER_ADMIN or DEPT_ADMIN views the dashboard
**Then** a "System Health" item is visible (icon: Activity from Lucide), navigating to `/dashboard/system-health`
**And** the item is positioned after "User Management" in the sidebar order

### AC 2: SUPER_ADMIN Sees All 15 Metrics

**Given** the System Health page
**When** a SUPER_ADMIN views it
**Then** all 15 metrics are displayed across 4 groups:
- **Infrastructure (5):** API Uptime, Database Connectivity, Memory Usage, CPU Load, Disk Usage
- **API Performance (4):** Average Response Time, Error Rate (5xx), Slow Endpoint Detection, Request Volume
- **Data Integrity (3):** Ledger Immutability Check, Migration Record Integrity, Pending Observations
- **Business Health (3):** MDA Submission Coverage, Unresolved Exceptions, Stale Data Detection

### AC 3: DEPT_ADMIN Sees 8 Metrics

**Given** the System Health page
**When** a DEPT_ADMIN views it
**Then** 8 metrics are displayed: Business Health (3) + API Performance summary (2: response time, error rate) + Data Integrity (3)
**And** Infrastructure metrics are NOT visible

### AC 4: Metric Display Format

**Given** the metrics
**When** displayed
**Then** each metric shows: current value, status indicator (green/amber/grey per threshold), metric name, and last-updated timestamp
**And** the page auto-refreshes on a 30-second interval

### AC 5: Infrastructure Metrics Collection

**Given** the server is running
**When** the System Health API is called
**Then** infrastructure metrics are collected in real-time:
- API Uptime: `process.uptime()` formatted as hours/days
- Database Connectivity: successful `SELECT 1` ping within 2s
- Memory Usage: `process.memoryUsage().heapUsed / heapTotal` as percentage
- CPU Load: `os.loadavg()[0]` (1-minute average)
- Disk Usage: placeholder (Node.js has no built-in disk API — return "N/A" with grey status)

### AC 6: API Performance Metrics from Rolling Window

**Given** the request logger middleware is capturing request data
**When** the System Health API is called
**Then** API performance metrics are computed from an in-memory rolling window (last 5 minutes):
- Average Response Time: mean of all request durations
- Error Rate (5xx): count of 5xx / total requests as percentage
- Slow Endpoint Detection: count of requests > 1000ms, with top 3 slowest endpoint paths
- Request Volume: total requests in the window

### AC 7: Data Integrity Metrics (Cached, 15-Minute Interval)

**Given** the periodic background integrity checks run every ~15 minutes
**When** the System Health API is called
**Then** cached integrity results are returned:
- Ledger Immutability: count of `ledger_entries` with unexpected `updated_at` values (should be 0)
- Migration Record Integrity: count of records with null `staffName` or orphaned `uploadId`
- Pending Observations: count of observations with `status = 'unreviewed'`

### AC 8: Business Health Metrics

**Given** the System Health API is called
**When** business metrics are computed
**Then**:
- MDA Submission Coverage: percentage of active MDAs with a confirmed submission in the current period
- Unresolved Exceptions: count of observations with `status = 'unreviewed'` or `status = 'reviewed'` (not yet resolved)
- Stale Data Detection: count of MDAs with no submission activity in the last 90 days

## Dependencies

- **Depends on:** Story 7.0d (Observation Engine Completion) — 7.0d adds `period_overlap` and `grade_tier_mismatch` observation types that affect the Pending Observations count in the Data Integrity metrics group
- **Parallel with:** Story 7.0e — per the prep story sequence, 7.0e and 7.0f run concurrently after 7.0d completes. Both stories are independent (7.0e is frontend UX, 7.0f is backend health + new page). Both modify `navItems.ts` but at different lines (no conflict)
- **Blocks:** Story 7.0g (both 7.0e and 7.0f must complete before 7.0g starts)
- **Sequence:** 7.0a → 7.0b → 7.0c → 7.0d → **7.0e + 7.0f (parallel)** → 7.0g → 7.1 → 7.2 → 7.3

## Tasks / Subtasks

- [x] Task 1: In-Memory Metrics Collector (AC: 5, 6)
  - [x] 1.1 Create `apps/server/src/services/metricsCollector.ts` — singleton service with:
    - Rolling window array of request records: `{ timestamp, durationMs, statusCode, method, url }`
    - Window size: 5 minutes (configurable)
    - `recordRequest(durationMs, statusCode, method, url)` — called from requestLogger middleware
    - `getApiPerformanceMetrics()` — computes avg response time, error rate, slow endpoints, request volume from window
    - `getInfrastructureMetrics()` — collects uptime, memory, CPU in real-time
    - Auto-prune: entries older than window size removed on each `recordRequest` call
  - [x] 1.2 Integrate with `requestLogger.ts` — in the `res.on('finish')` callback, call `metricsCollector.recordRequest(durationMs, statusCode, method, url)` after logging
  - [x] 1.3 Infrastructure metric collection:
    - Uptime: `process.uptime()` → format as "Xd Yh Zm" or "Xh Ym"
    - DB connectivity: `db.execute(sql\`SELECT 1\`)` with 2s timeout → pass/fail
    - Memory: `process.memoryUsage()` → `heapUsed / heapTotal * 100` as percentage
    - CPU: `os.loadavg()[0]` → 1-minute load average (value, not percentage)
    - Disk: Return `{ value: 'N/A', status: 'grey' }` — no built-in Node.js disk API without external deps
  - [x] 1.4 Add test: verify rolling window prunes correctly; verify metrics computation from sample data

- [x] Task 2: Background Integrity Checker (AC: 7)
  - [x] 2.1 Create `apps/server/src/services/integrityChecker.ts` — runs queries every 15 minutes, caches results:
    - Ledger immutability: **Do NOT query `updated_at`** — the `ledger_entries` table has no `updated_at` column (intentionally append-only, confirmed in `schema.ts` line 142). The SQL `WHERE updated_at IS NOT NULL` would throw a PostgreSQL error. Instead, return a structural assertion: `{ value: 0, status: 'green', details: 'Append-only by design — no update column exists on ledger_entries' }`. This metric serves as a canary — if anyone ever adds an `updated_at` column to `ledger_entries`, update this check to query it. For now, it confirms the immutability invariant holds at the schema level
    - Migration record integrity: `SELECT count(*) FROM migration_records WHERE staff_name IS NULL OR upload_id NOT IN (SELECT id FROM migration_uploads)`
    - Pending observations: `SELECT count(*) FROM observations WHERE status = 'unreviewed'`
  - [x] 2.2 Use `setInterval(checkIntegrity, 15 * 60 * 1000)` — runs in the server process, no external scheduler needed
  - [x] 2.3 Cache results in memory: `{ lastChecked: Date, results: IntegrityResults }`
  - [x] 2.4 First run on server startup (after 30s delay to avoid startup load spike)
  - [x] 2.5 Export `getIntegrityResults()` — returns cached results (never blocks on DB)
  - [x] 2.6 Add test: verify queries return expected shape; verify cache is updated after check

- [x] Task 3: Business Health Metrics (AC: 8)
  - [x] 3.1 Add `getBusinessHealthMetrics()` to `integrityChecker.ts` or create separate `businessHealthService.ts`:
    - MDA Submission Coverage: `SELECT count(DISTINCT mda_id) FROM mda_submissions WHERE status = 'confirmed' AND period = :currentPeriod` / total active MDAs × 100
    - Unresolved Exceptions: `SELECT count(*) FROM observations WHERE status IN ('unreviewed', 'reviewed')`
    - Stale Data Detection: count of MDAs with no `mda_submissions` row in the last 90 days
  - [x] 3.2 Cache alongside integrity results (same 15-minute interval)
  - [x] 3.3 Add test: verify coverage percentage calculation; verify stale detection with seed data

- [x] Task 4: System Health API Endpoint (AC: 2, 3, 5, 6, 7, 8)
  - [x] 4.1 Create `apps/server/src/routes/systemHealthRoutes.ts` with `GET /api/system-health` endpoint. Use a dedicated route file — System Health is a distinct vertical feature with its own services and types, not an extension of the executive dashboard. Keeps separation of concerns clean and avoids overloading `dashboardRoutes.ts` (already 5 endpoints)
  - [x] 4.2 Middleware: `authenticate → requirePasswordChange → authorise(SUPER_ADMIN, DEPT_ADMIN) → readLimiter → auditLog`
  - [x] 4.3 Handler: collect all metrics from metricsCollector + integrityChecker
  - [x] 4.4 Role-based filtering: if `req.user.role === 'dept_admin'`, exclude Infrastructure group and return only 8 metrics
  - [x] 4.5 Response shape:
    ```typescript
    interface SystemHealthResponse {
      groups: Array<{
        name: 'Infrastructure' | 'API Performance' | 'Data Integrity' | 'Business Health';
        metrics: Array<{
          name: string;
          value: string | number;
          unit?: string;           // 'ms', '%', 'count', 'days'
          status: 'green' | 'amber' | 'grey';
          threshold?: { amber: number; red: number };
          details?: string;        // e.g., "Top slow: GET /api/loans (1.2s)"
        }>;
      }>;
      lastIntegrityCheck: string;  // ISO timestamp
      serverUptime: string;        // formatted "2d 5h 30m"
    }
    ```
  - [x] 4.6 Apply threshold logic per metric:
    - Response Time: green < 200ms, amber < 500ms, grey ≥ 500ms
    - Error Rate: green < 1%, amber < 5%, grey ≥ 5%
    - Memory: green < 70%, amber < 85%, grey ≥ 85%
    - CPU Load: green < 2.0, amber < 4.0, grey ≥ 4.0
    - Pending Observations: green = 0, amber ≤ 50, grey > 50
    - Submission Coverage: green ≥ 80%, amber ≥ 50%, grey < 50%
    - Unresolved Exceptions: green = 0, amber ≤ 20, grey > 20
    - Stale MDAs: green = 0, amber ≤ 5, grey > 5
  - [x] 4.7 Register route in app.ts
  - [x] 4.8 Add test: verify SUPER_ADMIN gets 15 metrics; DEPT_ADMIN gets 8; MDA_OFFICER gets 403

- [x] Task 5: Shared Types (AC: 2, 3, 4)
  - [x] 5.1 Create `packages/shared/src/types/systemHealth.ts` — `SystemHealthResponse`, `HealthMetric`, `HealthGroup`, `MetricStatus`
  - [x] 5.2 Export from `packages/shared/src/index.ts`

- [x] Task 6: Frontend — System Health Page (AC: 1, 2, 3, 4)
  - [x] 6.1 Create `apps/client/src/pages/dashboard/SystemHealthPage.tsx`:
    - 4 group sections (or 3 for DEPT_ADMIN) using Card components
    - Each group is a titled section with a grid of metric cards
    - Each metric card shows: name, value (large), unit, status indicator (colored dot or badge), details if present
  - [x] 6.2 Status indicator colors: green → `bg-emerald-500`, amber → `bg-amber-500`, grey → `bg-slate-400`. Use small circle dot (8px) next to metric name. NO RED — use grey for concerning values (non-punitive)
  - [x] 6.3 Layout: responsive grid — 4 cols on XL, 2 on MD, 1 on mobile per group
  - [x] 6.4 Last updated timestamp: display `lastIntegrityCheck` at page top with "Last integrity check: X minutes ago"
  - [x] 6.5 Loading state: skeleton cards matching the metric card layout
  - [x] 6.6 Error state: "Unable to load system health data" with retry button

- [x] Task 7: Frontend — TanStack Query Hook (AC: 4)
  - [x] 7.1 Create `apps/client/src/hooks/useSystemHealth.ts`:
    - `useSystemHealth()` — `useQuery` with `queryKey: ['system-health']`, `staleTime: 30_000`, `refetchInterval: 30_000` (auto-refresh every 30s)
    - `enabled: !!user` (requires authentication)
  - [x] 7.2 The `refetchInterval: 30_000` provides the auto-refresh behavior specified in AC 4

- [x] Task 8: Frontend — Sidebar & Route Registration (AC: 1)
  - [x] 8.1 Add to `navItems.ts`: `{ label: 'System Health', path: '/dashboard/system-health', icon: Activity, roles: [ROLES.SUPER_ADMIN, ROLES.DEPT_ADMIN] }` — position after User Management
  - [x] 8.2 Add lazy route to `router.tsx`: `/dashboard/system-health` → lazy-loaded `SystemHealthPage`
  - [x] 8.3 Import `Activity` icon from `lucide-react`

- [x] Task 9: Full Test Suite Verification (AC: all)
  - [x] 9.1 Run `pnpm typecheck` — zero type errors
  - [x] 9.2 Run `pnpm lint` — zero lint errors
  - [x] 9.3 Run server tests — all pass (86 files, 1264 tests)
  - [x] 9.4 Run client tests — all pass with zero regressions (76 files, 594 tests)

## Dev Notes

### Technical Requirements

#### In-Memory Metrics Collector

**Purpose:** Capture request-level metrics without external dependencies (no Prometheus, no StatsD, no Redis).

**Design:**
```typescript
// apps/server/src/services/metricsCollector.ts
interface RequestRecord {
  timestamp: number;     // Date.now()
  durationMs: number;
  statusCode: number;
  method: string;
  url: string;
}

class MetricsCollector {
  private requests: RequestRecord[] = [];
  private windowMs = 5 * 60 * 1000; // 5 minutes

  recordRequest(durationMs: number, statusCode: number, method: string, url: string) {
    const now = Date.now();
    this.requests.push({ timestamp: now, durationMs, statusCode, method, url });
    // Prune expired entries
    this.requests = this.requests.filter(r => now - r.timestamp < this.windowMs);
  }

  getApiPerformanceMetrics() {
    const now = Date.now();
    const window = this.requests.filter(r => now - r.timestamp < this.windowMs);
    const total = window.length;
    if (total === 0) return { avgResponseTime: 0, errorRate: 0, slowEndpoints: [], requestVolume: 0 };

    const avgResponseTime = window.reduce((sum, r) => sum + r.durationMs, 0) / total;
    const errors = window.filter(r => r.statusCode >= 500).length;
    const errorRate = (errors / total) * 100;
    const slow = window.filter(r => r.durationMs > 1000)
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 3)
      .map(r => ({ path: `${r.method} ${r.url}`, durationMs: r.durationMs }));

    return { avgResponseTime: Math.round(avgResponseTime), errorRate: +errorRate.toFixed(2), slowEndpoints: slow, requestVolume: total };
  }
}

export const metricsCollector = new MetricsCollector();
```

**Integration with requestLogger.ts:** Add one line in the `res.on('finish')` callback after logging:
```typescript
metricsCollector.recordRequest(durationMs, res.statusCode, req.method, req.originalUrl);
```

**Memory impact:** At 120 requests/min (read limiter), 5-minute window = ~600 records × ~100 bytes = ~60KB. Negligible.

#### Background Integrity Checker

**Design:** `setInterval` in the server process. No external job queue.

```typescript
// apps/server/src/services/integrityChecker.ts
let cachedResults: IntegrityResults | null = null;
let lastChecked: Date | null = null;

async function checkIntegrity() {
  // Ledger immutability: structural assertion (no updated_at column exists — append-only by design)
  const ledgerIssues = { count: 0, status: 'green' as const, details: 'Append-only by design' };
  const migrationIssues = await db.execute(sql`...`);
  const pendingObs = await db.execute(sql`...`);
  const coverage = await db.execute(sql`...`);
  const unresolved = await db.execute(sql`...`);
  const staleMdas = await db.execute(sql`...`);

  cachedResults = { ledgerIssues, migrationIssues, pendingObs, coverage, unresolved, staleMdas };
  lastChecked = new Date();
}

// Start 30s after server boot
setTimeout(() => {
  checkIntegrity();
  setInterval(checkIntegrity, 15 * 60 * 1000);
}, 30_000);

export function getIntegrityResults() { return { results: cachedResults, lastChecked }; }
```

**Initialization:** Call from `apps/server/src/index.ts` after the server starts listening, or self-initialize via module-level `setTimeout`. The latter is simpler but less testable. Prefer explicit initialization from `index.ts`.

**Guard for test mode:** Do NOT start the interval when `NODE_ENV === 'test'` — it would interfere with test cleanup.

#### Threshold Configuration

All thresholds are defined in the service layer (not configurable via DB or env vars for this foundation story). Future enhancement can move them to a config table.

| Metric | Green | Amber | Grey |
|--------|-------|-------|------|
| Avg Response Time | < 200ms | < 500ms | ≥ 500ms |
| Error Rate (5xx) | < 1% | < 5% | ≥ 5% |
| Memory Usage | < 70% | < 85% | ≥ 85% |
| CPU Load (1m avg) | < 2.0 | < 4.0 | ≥ 4.0 |
| Pending Observations | 0 | ≤ 50 | > 50 |
| MDA Submission Coverage | ≥ 80% | ≥ 50% | < 50% |
| Unresolved Exceptions | 0 | ≤ 20 | > 20 |
| Stale MDAs (90d) | 0 | ≤ 5 | > 5 |
| DB Connectivity | pass | — | fail |
| Ledger Immutability | 0 issues | — | > 0 issues |
| Migration Integrity | 0 issues | ≤ 10 | > 10 |
| Slow Endpoints | 0 | ≤ 3 | > 3 |
| Request Volume | — | — | — (info only) |
| API Uptime | — | — | — (info only) |
| Disk Usage | N/A | — | — (placeholder) |

#### Role-Based Filtering

**SUPER_ADMIN (15 metrics):** All 4 groups visible.

**DEPT_ADMIN (8 metrics):**
- Business Health (3): MDA Submission Coverage, Unresolved Exceptions, Stale Data Detection
- API Performance summary (2): Average Response Time, Error Rate
- Data Integrity (3): Ledger Immutability, Migration Record Integrity, Pending Observations

**Infrastructure group hidden for DEPT_ADMIN** — these are system internals not relevant to departmental oversight.

#### Non-Punitive Display

- Status indicators use **green/amber/grey** — never red
- Grey means "requires attention" not "failure" or "error"
- Metric descriptions use neutral language: "X items pending review" not "X unresolved errors"
- Pending Observations label: "Pending Review" not "Unreviewed Issues"

### Architecture Compliance

- **No external dependencies:** Pino + Node.js built-ins + existing DB only. No Grafana, Prometheus, or APM
- **No new tables:** In-memory rolling window for API metrics, cached DB query results for integrity
- **Scope guardrail:** No trend charts, no alerting, no historical comparison. Foundation only
- **API envelope:** `{ success: true, data: SystemHealthResponse }`
- **Middleware chain:** Standard `authenticate → authorise → readLimiter → auditLog`
- **Auto-refresh:** TanStack Query `refetchInterval: 30_000` (30s)

### Library & Framework Requirements

- **No new dependencies**
- **Node.js built-ins:** `os` (loadavg), `process` (uptime, memoryUsage)
- **Drizzle ORM:** Raw `sql` queries for integrity checks
- **Lucide React:** `Activity` icon for sidebar
- **shadcn/ui:** Card, Badge components for metric display
- **TanStack Query v5:** `useQuery` with `refetchInterval`

### File Structure Requirements

#### New Files

```
packages/shared/src/
└── types/systemHealth.ts                              ← NEW: SystemHealthResponse, HealthMetric, HealthGroup types

apps/server/src/
├── services/metricsCollector.ts                       ← NEW: in-memory rolling window for request metrics
├── services/metricsCollector.test.ts                  ← NEW: unit tests
├── services/integrityChecker.ts                       ← NEW: background DB integrity checks (15-min cache)
└── services/integrityChecker.test.ts                  ← NEW: unit tests

apps/client/src/
├── pages/dashboard/SystemHealthPage.tsx                ← NEW: System Health page with 4 metric groups
└── hooks/useSystemHealth.ts                           ← NEW: TanStack Query hook with 30s auto-refresh
```

#### Modified Files

```
packages/shared/src/
└── index.ts                                           ← MODIFY: export system health types

apps/server/src/
├── middleware/requestLogger.ts                        ← MODIFY: add metricsCollector.recordRequest() call
├── routes/systemHealthRoutes.ts                        ← NEW: GET /api/system-health endpoint (dedicated route file)
├── app.ts                                             ← MODIFY: register system health route + initialize integrityChecker
└── index.ts                                           ← MODIFY: start integrity checker interval after server listen

apps/client/src/
├── components/layout/navItems.ts                      ← MODIFY: add "System Health" sidebar item
└── router.tsx                                         ← MODIFY: add lazy route for /dashboard/system-health
```

### Testing Requirements

- **metricsCollector.test.ts:** Test rolling window pruning, avg response time calculation, error rate, slow endpoint detection, empty window edge case
- **integrityChecker.test.ts:** Test query result shapes, cache behavior, test-mode guard (interval not started)
- **API endpoint test:** SUPER_ADMIN gets 15 metrics, DEPT_ADMIN gets 8, MDA_OFFICER gets 403
- **No integration tests against live DB for integrity queries** — mock the DB for unit tests. Integrity queries are simple counts that don't need integration testing
- **Full suite:** All server + client tests pass with zero regressions

### Previous Story Intelligence

#### From Story 7.0d (Observation Engine Completion — Previous in Sequence)

- **Status:** ready-for-dev (as of 2026-03-20)
- **New observation types:** 7.0d adds `period_overlap` and `grade_tier_mismatch` to the observation engine. The Pending Observations count in Data Integrity metrics (AC 7) and the Unresolved Exceptions count in Business Health (AC 8) will include these new types automatically — the queries use `status = 'unreviewed'` which is type-agnostic

#### From Story 7.0c (Test Suite Integrity)

- **Query counter middleware:** 7.0c adds N+1 detection. The System Health API endpoint should stay under 10 queries — integrity results are CACHED (0 queries), API metrics are IN-MEMORY (0 queries), only infrastructure metrics need 1 DB query (SELECT 1 ping). Total: 1 query per request
- **metricsCollector integration with requestLogger:** The query counter middleware (if active) will count the requestLogger's `metricsCollector.recordRequest()` as a function call, not a DB query — no impact

#### From Story 7.0e (UX Polish — Parallel)

- **navItems.ts modification:** Both 7.0e and 7.0f modify `navItems.ts`. 7.0e adds `ROLES.SUPER_ADMIN` to Migration (line 29). 7.0f adds "System Health" as a new item (after User Management). No conflict — different lines, different items. Coordinate merge order if both in development simultaneously

#### From Mega-Retro

- **Origin:** Tech debt item #3 (System Health Monitoring Dashboard) — carried from Epic 10 retro, addressed here as a prep story
- **Awwal's prior experience:** 15-metric health pages from previous projects. Foundation only — no trend charts, alerting, or historical comparison

### Git Intelligence

**Expected commit:** `feat: Story 7.0f — System Health Monitoring Foundation with code review fixes`

### Critical Warnings

1. **No setInterval in test mode:** Guard the integrity checker: `if (env.NODE_ENV !== 'test') { setInterval(...) }`. Otherwise test cleanup will fail with dangling timers
2. **metricsCollector is a singleton module** — imported by both requestLogger (writes) and healthRoutes (reads). Ensure no circular dependency
3. **DB connectivity check uses raw SQL** — `db.execute(sql\`SELECT 1\`)` with a 2-second timeout. Use `Promise.race()` with a timeout promise to avoid hanging on DB connection issues
4. **Disk usage is a placeholder** — Node.js has no built-in disk stats API. `fs.statfs` exists in Node 18+ but may not be available in all environments. Return "N/A" with grey status. Future enhancement can use `check-disk-space` package
5. **CPU load average on Windows returns [0,0,0]** — `os.loadavg()` returns zeros on Windows. Since the development environment is Windows but production will be Linux, add a note in the metric: "Load average (Linux only — N/A on Windows)"
6. **Do NOT use pino for metricsCollector internal logging** — the metricsCollector is called FROM the requestLogger. Using pino inside would create a circular logging loop. Use plain `console.error` for collector errors only
7. **Scope guardrail is firm:** No trend charts, no alerting rules, no historical comparison, no email notifications, no Slack integration. This is FOUNDATION only — a single page with 15 current-state metrics
8. **Memory impact of rolling window:** At peak load (120 req/min × 5 min = 600 records), memory usage is ~60KB. Acceptable. If volume exceeds expectations, reduce window to 2 minutes

### Project Structure Notes

- This story adds a new vertical slice: backend service (metricsCollector + integrityChecker) → API endpoint → shared types → frontend page + hook
- The metricsCollector pattern is novel for this codebase — it's the first in-memory metrics store. Document the pattern clearly for future developers
- The integrityChecker's `setInterval` approach is simple but effective for a single-server deployment. If VLPRS scales to multiple servers, the interval would need coordination (not in scope for foundation)
- The auto-refresh uses TanStack Query's `refetchInterval` — no custom polling logic needed on the client

### References

- [Source: _bmad-output/planning-artifacts/epics.md § Story 7.0f] — Full BDD acceptance criteria, implementation constraints
- [Source: _bmad-output/implementation-artifacts/epic-3-4-5-11-retro-2026-03-20.md § Tech Debt Item #3] — System health monitoring dashboard (carried from E10)
- [Source: apps/server/src/lib/logger.ts] — Pino configuration (silent in test, pretty in dev)
- [Source: apps/server/src/middleware/requestLogger.ts] — Request timing with hrtime, status logging
- [Source: apps/server/src/routes/healthRoutes.ts] — Existing minimal health endpoint
- [Source: apps/server/src/app.ts] — Middleware chain order
- [Source: apps/server/src/config/env.ts] — Environment configuration
- [Source: apps/server/src/routes/dashboardRoutes.ts] — Existing dashboard metrics pattern (Promise.all for parallel queries)
- [Source: apps/server/src/services/attentionItemService.ts] — 12 attention item detectors (6 active, 6 stubs)
- [Source: apps/server/src/services/mdaAggregationService.ts] — MDA health scoring (FR36 formula)
- [Source: apps/server/src/middleware/rateLimiter.ts] — 3-tier rate limiting (auth/write/read)
- [Source: apps/server/src/middleware/auditLog.ts] — Fire-and-forget audit pattern
- [Source: apps/server/src/db/index.ts] — Drizzle db singleton (logger option, connection URL)
- [Source: apps/client/src/components/layout/navItems.ts] — Sidebar navigation items
- [Source: apps/client/src/pages/dashboard/DashboardPage.tsx] — Card grid layout pattern
- [Source: apps/client/src/components/shared/HeroMetricCard.tsx] — Metric card component (reuse pattern)
- [Source: apps/client/src/hooks/useDashboardData.ts] — TanStack Query hook pattern (staleTime: 30s)

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] H1: Rename `threshold.red` to `threshold.grey` — non-punitive vocabulary violation [types/systemHealth.ts:14, systemHealthRoutes.ts:71,78,99,107]
- [x] [AI-Review][MEDIUM] M1: Add per-metric `lastUpdated` timestamp to satisfy AC4 [types/systemHealth.ts, systemHealthRoutes.ts, SystemHealthPage.tsx]
- [x] [AI-Review][MEDIUM] M2: Store setTimeout ref in `startIntegrityChecker()` to fix early-shutdown race condition [integrityChecker.ts:131-134]
- [x] [AI-Review][MEDIUM] M3: Add unit tests for `getInfrastructureMetrics()` — DB ping, memory, CPU [metricsCollector.test.ts]
- [x] [AI-Review][MEDIUM] M4: Strengthen integrityChecker tests — specific value assertions, zero-division edge case [integrityChecker.test.ts]
- [x] [AI-Review][LOW] L1: Enhance `formatTimeAgo` to handle hours and days [SystemHealthPage.tsx:15-21]
- [x] [AI-Review][LOW] L2: Skip unnecessary DB ping for DEPT_ADMIN — only SUPER_ADMIN needs full infrastructure metrics [systemHealthRoutes.ts:47]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

No debug issues encountered.

### Completion Notes List

- Implemented full vertical slice: shared types → backend services → API endpoint → frontend page + hook + sidebar
- **metricsCollector.ts**: Singleton class with 5-minute rolling window for request metrics. Records are auto-pruned on each `recordRequest()` call. Infrastructure metrics use Node.js built-ins (process.uptime, process.memoryUsage, os.loadavg) + DB ping with 2s timeout via Promise.race
- **integrityChecker.ts**: Combined integrity + business health checks on 15-minute interval. Ledger immutability uses structural assertion (no updated_at column exists). Test-mode guard prevents dangling timers. Explicit start/stop lifecycle from index.ts
- **Business health metrics** integrated into integrityChecker.ts (same cache interval): MDA submission coverage, unresolved exceptions, stale data detection (90-day window)
- **systemHealthRoutes.ts**: Dedicated route file with full middleware chain. Role-based filtering: SUPER_ADMIN gets 15 metrics (4 groups), DEPT_ADMIN gets 8 metrics (3 groups, no Infrastructure). All thresholds use green/amber/grey (non-punitive — no red)
- **SystemHealthPage.tsx**: Responsive grid layout (4/2/1 cols), skeleton loading state, error state with retry, "Last integrity check: X minutes ago" header. Status dots use 8px emerald/amber/slate circles
- **useSystemHealth.ts**: TanStack Query hook with 30s staleTime + 30s refetchInterval for auto-refresh
- **CPU load note**: os.loadavg() returns [0,0,0] on Windows — added details string noting "Linux only"
- **Disk usage**: Placeholder returning 'N/A' with grey status per story spec
- 12 unit tests for metricsCollector (rolling window pruning, avg response time, error rate, slow endpoint detection, formatUptime)
- 6 unit tests for integrityChecker (cache behavior, test-mode guard, result shapes)
- 5 integration tests for API endpoint (401 unauth, 403 MDA_OFFICER, 15 metrics SUPER_ADMIN, 8 metrics DEPT_ADMIN, metric field validation)
- All 86 server test files pass (1264 tests), all 76 client test files pass (594 tests), zero type errors, zero lint errors

### File List

**New Files:**
- `packages/shared/src/types/systemHealth.ts` — SystemHealthResponse, HealthMetric, HealthGroup, MetricStatus types
- `apps/server/src/services/metricsCollector.ts` — In-memory rolling window metrics collector
- `apps/server/src/services/metricsCollector.test.ts` — 12 unit tests
- `apps/server/src/services/integrityChecker.ts` — Background integrity + business health checker (15-min cache)
- `apps/server/src/services/integrityChecker.test.ts` — 6 unit tests
- `apps/server/src/routes/systemHealthRoutes.ts` — GET /api/system-health endpoint
- `apps/server/src/routes/systemHealthRoutes.test.ts` — 5 integration tests
- `apps/client/src/pages/dashboard/SystemHealthPage.tsx` — System Health page with 4 metric groups
- `apps/client/src/hooks/useSystemHealth.ts` — TanStack Query hook with 30s auto-refresh

**Modified Files:**
- `packages/shared/src/index.ts` — Added system health type exports
- `apps/server/src/middleware/requestLogger.ts` — Added metricsCollector.recordRequest() call in res.on('finish')
- `apps/server/src/app.ts` — Registered systemHealthRoutes
- `apps/server/src/index.ts` — Added startIntegrityChecker() on server listen, stopIntegrityChecker() on shutdown
- `apps/client/src/components/layout/navItems.ts` — Added "System Health" nav item with Activity icon
- `apps/client/src/router.tsx` — Added lazy route for /dashboard/system-health

### Change Log

- **2026-03-21**: Story 7.0f — System Health Monitoring Foundation implemented. Full vertical slice: 15 operational metrics across 4 groups (Infrastructure, API Performance, Data Integrity, Business Health), role-scoped (SUPER_ADMIN=15, DEPT_ADMIN=8), dedicated page with auto-refresh, non-punitive green/amber/grey indicators.
- **2026-03-21**: Code review fixes applied (7 issues: 1 HIGH, 4 MEDIUM, 2 LOW). H1: `threshold.red` → `threshold.grey` (non-punitive vocabulary). M1: Added per-metric `lastUpdated` timestamps (AC4). M2: Stored setTimeout ref for cancellable early shutdown. M3: Added 3 unit tests for `getInfrastructureMetrics()`. M4: Added 2 stronger assertion tests for integrityChecker (specific values + zero-division). L1: Enhanced `formatTimeAgo` for hours/days. L2: Skipped DB ping for DEPT_ADMIN. Test counts: server 86 files/1269 tests, client 76 files/594 tests — all pass, zero type errors.
