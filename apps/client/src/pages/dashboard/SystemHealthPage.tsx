import { RefreshCw, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSystemHealth } from '@/hooks/useSystemHealth';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { HealthGroup, HealthMetric, MetricStatus } from '@vlprs/shared';

const STATUS_COLORS: Record<MetricStatus, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  grey: 'bg-slate-400',
};

function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function MetricCard({ metric }: { metric: HealthMetric }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={cn('inline-block h-2 w-2 rounded-full', STATUS_COLORS[metric.status])} />
          <span className="text-sm font-medium text-text-secondary">{metric.name}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold text-text-primary">
            {metric.value}
          </span>
          {metric.unit && (
            <span className="text-sm text-text-secondary">{metric.unit}</span>
          )}
        </div>
        {metric.details && (
          <p className="mt-1 text-xs text-text-secondary truncate" title={metric.details}>
            {metric.details}
          </p>
        )}
        {metric.lastUpdated && (
          <p className="mt-1 text-xs text-text-secondary/70">
            {formatTimeAgo(metric.lastUpdated)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricGroupSection({ group }: { group: HealthGroup }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-text-primary">{group.name}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {group.metrics.map((metric) => (
          <MetricCard key={metric.name} metric={metric} />
        ))}
      </div>
    </section>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3, 4].map((group) => (
        <section key={group}>
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3].map((card) => (
              <Card key={card}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function SystemHealthPage() {
  const { data, isLoading, isError, refetch } = useSystemHealth();

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-text-secondary" />
          <h1 className="text-2xl font-bold text-text-primary">System Health</h1>
        </div>
        {data && (
          <p className="text-sm text-text-secondary">
            Last integrity check: {formatTimeAgo(data.lastIntegrityCheck)}
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && <LoadingSkeleton />}

      {/* Error State */}
      {isError && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <p className="mb-4 text-text-secondary">Unable to load system health data</p>
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Data Display */}
      {data && (
        <>
          {data.groups.map((group) => (
            <MetricGroupSection key={group.name} group={group} />
          ))}
        </>
      )}
    </div>
  );
}
