# VLPRS Wiring Map

> Maps mock data hooks to their target API endpoints and delivery sprint.
> When wiring, change **only the `queryFn`** inside the hook. Zero UI component modifications.

## Hook → API Mapping

| Hook | Target Endpoint | Wire Sprint | Status |
|---|---|---|---|
| `useDashboardMetrics()` | `GET /api/dashboard/metrics` | Sprint 5 (Epic 4) | Mock |
| `useMdaComplianceGrid()` | `GET /api/dashboard/compliance` | Sprint 5 (Epic 4) | Mock |
| `useAttentionItems()` | `GET /api/dashboard/attention` | Sprint 5 (Epic 4) | Mock |
| `useMdaDetail(mdaId)` | `GET /api/mdas/:id/summary` | Sprint 5 (Epic 4) | Mock |
| `useLoanDetail(loanId)` | `GET /api/loans/:id` | Sprint 2 (Epic 2) | Mock |
| `useLoanSearch(query)` | `GET /api/loans/search` | Sprint 2 (Epic 2) | Mock |
| `useSubmissionHistory(mdaId)` | `GET /api/submissions?mdaId=` | Sprint 7 (Epic 5) | Mock |
| `useMigrationStatus()` | `GET /api/migration/status` | Sprint 4 (Epic 3) | Mock |
| `useExceptionQueue()` | `GET /api/exceptions` | Sprint 9 (Epic 7) | Mock |

## Wiring Instructions

Each hook follows the same pattern. To wire a hook to its real API:

### Before (Mock)

```typescript
// hooks/useDashboardData.ts
import { MOCK_DASHBOARD_METRICS } from '@/mocks/dashboardMetrics';

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => MOCK_DASHBOARD_METRICS,
    staleTime: 30_000,
  });
}
```

### After (API)

```typescript
// hooks/useDashboardData.ts
import { apiClient } from '@/lib/apiClient';

export function useDashboardMetrics() {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics'],
    queryFn: async () => {
      const res = await apiClient('/dashboard/metrics');
      return res.data;
    },
    staleTime: 30_000,
  });
}
```

### Rules

1. Change **only** the `queryFn` — the import of mock data becomes an import of `apiClient`
2. The `queryKey` stays the same
3. The return type stays the same
4. **Zero UI component modifications** — components consume the hook the same way
5. Delete the corresponding mock file import once wired
6. API responses follow the envelope: `{ success: true, data: { ... } }`

## Query Key Convention

```typescript
['dashboard', 'metrics']           // hero metrics (useDashboardData.ts)
['mda', 'compliance']              // MDA compliance grid (useMdaData.ts)
['dashboard', 'attention']         // attention items (useAttentionItems.ts)
['mda', mdaId]                     // single MDA detail (useMdaData.ts)
['mda', mdaId, 'loans']           // MDA loan list (MdaDetailPage inline)
['loan', loanId]                   // single loan detail (useLoanData.ts)
['loan', 'search', query]          // loan search (useLoanData.ts)
['submissions', mdaId]             // submission history (useSubmissionData.ts)
['migration', 'status']            // migration dashboard (useMigrationData.ts)
['exceptions']                     // exception queue (useExceptionData.ts)
```
