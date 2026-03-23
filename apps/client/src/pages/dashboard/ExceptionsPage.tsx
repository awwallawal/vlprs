import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AlertTriangle, Filter, Plus } from 'lucide-react';
import { useExceptions, useExceptionCounts } from '@/hooks/useExceptionData';
import { useMdaList } from '@/hooks/useMigration';
import { useAuthStore } from '@/stores/authStore';
import { ExceptionQueueRow, ExceptionEmptyState } from '@/components/shared/ExceptionQueueRow';
import { FlagExceptionDialog } from './components/FlagExceptionDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UI_COPY } from '@vlprs/shared';

const FILTER_ALL = '__all';

export function ExceptionsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';

  // Read filters from URL
  const category = searchParams.get('category') || '';
  const mdaId = searchParams.get('mdaId') || '';
  const priority = searchParams.get('priority') || '';
  const status = searchParams.get('status') || 'open';
  const page = Number(searchParams.get('page') || '1');

  const canFlag = user?.role === 'super_admin' || user?.role === 'dept_admin';
  const [flagOpen, setFlagOpen] = useState(false);

  const { data: counts } = useExceptionCounts();
  const { data: mdas } = useMdaList();

  const { data: result, isPending } = useExceptions({
    category: category || undefined,
    mdaId: mdaId || undefined,
    priority: priority || undefined,
    status: status === FILTER_ALL ? undefined : (status || undefined),
    page,
    limit: 25,
  });

  const exceptions = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / 25);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (!value || value === FILTER_ALL) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    next.set('page', '1');
    setSearchParams(next);
  }

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(p));
    setSearchParams(next);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-gold" />
          <h1 className="text-2xl font-bold text-text-primary">{UI_COPY.EXCEPTION_QUEUE_HEADER}</h1>
        </div>
        <div className="flex items-center gap-3">
          {counts && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">{counts.high} High</Badge>
              <Badge variant="review">{counts.medium} Medium</Badge>
              <Badge variant="info">{counts.low} Low</Badge>
              <span className="text-sm text-text-muted ml-2">{counts.total} open</span>
            </div>
          )}
          {canFlag && (
            <Button size="sm" onClick={() => setFlagOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Flag Exception
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-text-muted" />
        <Select value={status || FILTER_ALL} onValueChange={(v) => setFilter('status', v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value={FILTER_ALL}>All</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority || FILTER_ALL} onValueChange={(v) => setFilter('priority', v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={category || FILTER_ALL} onValueChange={(v) => setFilter('category', v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>All Categories</SelectItem>
            {/* Manual flag presets */}
            <SelectItem value="over_deduction">Over-deduction</SelectItem>
            <SelectItem value="under_deduction">Under-deduction</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="data_mismatch">Data Mismatch</SelectItem>
            <SelectItem value="post_retirement">Post-retirement</SelectItem>
            <SelectItem value="duplicate_staff_id">Duplicate Staff ID</SelectItem>
            {/* Auto-promoted categories */}
            <SelectItem value="ghost_deduction">Ghost Deduction</SelectItem>
            <SelectItem value="unreported_deduction">Unreported Deduction</SelectItem>
            <SelectItem value="amount_mismatch">Amount Mismatch</SelectItem>
            <SelectItem value="staff_not_in_payroll">Staff Not in Payroll</SelectItem>
          </SelectContent>
        </Select>

        {isSuperAdmin && (
          <Select value={mdaId || FILTER_ALL} onValueChange={(v) => setFilter('mdaId', v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All MDAs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All MDAs</SelectItem>
              {mdas?.map((mda) => (
                <SelectItem key={mda.id} value={mda.id}>{mda.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Exception List */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : exceptions.length === 0 ? (
        <ExceptionEmptyState />
      ) : (
        <div className="space-y-2">
          {exceptions.map((item) => (
            <ExceptionQueueRow
              key={item.id}
              priority={item.priority}
              category={item.category}
              staffId={item.staffId ?? undefined}
              staffName={item.staffName}
              mdaName={item.mdaName}
              description={item.description}
              createdAt={item.createdAt}
              status={item.status}
              onClick={() => navigate(`/dashboard/exceptions/${item.id}`)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-text-muted">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
      {/* Flag Exception Dialog (no preselected loan — shows search) */}
      <FlagExceptionDialog open={flagOpen} onOpenChange={setFlagOpen} />
    </div>
  );
}

export { ExceptionsPage as Component };
