import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useCoverageRecords, useCoverageRecordExport } from '@/hooks/useMigrationData';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, FileSpreadsheet, ArrowLeft, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { UI_COPY } from '@vlprs/shared';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { cn } from '@/lib/utils';

type SortField = 'staffName' | 'employeeNo' | 'principal' | 'totalLoan' | 'monthlyDeduction' | 'outstandingBalance' | 'varianceCategory' | 'isBaselineCreated';

const COLUMNS: { key: SortField; label: string; sortable: boolean; align: 'left' | 'right' | 'center' }[] = [
  { key: 'staffName', label: 'Staff Name', sortable: true, align: 'left' },
  { key: 'employeeNo', label: 'Staff ID', sortable: true, align: 'left' },
  { key: 'principal', label: 'Principal (₦)', sortable: true, align: 'right' },
  { key: 'totalLoan', label: 'Total Loan (₦)', sortable: true, align: 'right' },
  { key: 'monthlyDeduction', label: 'Monthly Deduction (₦)', sortable: true, align: 'right' },
  { key: 'outstandingBalance', label: 'Outstanding Balance (₦)', sortable: true, align: 'right' },
  { key: 'varianceCategory', label: 'Variance Category', sortable: true, align: 'center' },
  { key: 'isBaselineCreated', label: 'Baseline Status', sortable: true, align: 'center' },
];

const VARIANCE_BADGE_COLORS: Record<string, string> = {
  clean: 'bg-emerald-100 text-emerald-800',
  minor_variance: 'bg-amber-100 text-amber-800',
  significant_variance: 'bg-orange-100 text-orange-800',
  structural_error: 'bg-rose-100 text-rose-800',
  anomalous: 'bg-purple-100 text-purple-800',
};

export function CoverageRecordsPage() {
  const { mdaId, year, month } = useParams<{ mdaId: string; year: string; month: string }>();
  const navigate = useNavigate();

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortField>('staffName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data, isPending, isError } = useCoverageRecords(
    mdaId ?? '',
    Number(year),
    Number(month),
    page,
    sortBy,
    sortDir,
  );

  const exportMutation = useCoverageRecordExport();

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const handleExport = (format: 'csv' | 'xlsx') => {
    if (!data?.summary) return;
    exportMutation.mutate(
      {
        mdaId: mdaId!,
        year: Number(year),
        month: Number(month),
        format,
        mdaCode: data.summary.mdaCode,
      },
      { onError: () => toast.error('Export failed. Please try again.') },
    );
  };

  if (isError) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/dashboard/migration')} className="flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to Coverage Tracker
        </button>
        <p className="text-sm text-red-600 py-4">Unable to load coverage records. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <button
        onClick={() => navigate('/dashboard/migration')}
        className="flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Coverage Tracker
      </button>

      {/* Header */}
      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
      ) : data?.summary ? (
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            {data.summary.mdaName}
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            {data.summary.periodLabel} — {data.summary.total.toLocaleString()} records ({data.summary.baselinedCount.toLocaleString()} baselined)
            {' '}<MetricHelp definition={{ label: 'Coverage Records', description: 'Active migration records for this MDA in the selected period. Baselined means the record has been reviewed and accepted as the official starting point.', derivedFrom: 'migration_records filtered by MDA, period, and active status' }} />
          </p>
        </div>
      ) : null}

      {/* Download buttons */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleExport('csv')}
          disabled={exportMutation.isPending || !data?.records?.length}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
          Download CSV
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleExport('xlsx')}
          disabled={exportMutation.isPending || !data?.records?.length}
          className="gap-1.5"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
          Download Excel
        </Button>
      </div>

      {/* Records Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 font-medium text-text-secondary whitespace-nowrap',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.align === 'left' && 'text-left',
                    col.sortable && 'cursor-pointer select-none hover:text-text-primary',
                  )}
                  onClick={col.sortable ? () => handleSort(col.key as SortField) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortBy === col.key && (
                      <ArrowUpDown className="h-3 w-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {COLUMNS.map((col) => (
                      <td key={col.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.records?.map((record) => (
                  <tr key={record.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-text-primary">{record.staffName}</td>
                    <td className="px-4 py-3 text-text-secondary font-mono">{record.employeeNo ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {record.principal ? <NairaDisplay amount={record.principal} variant="table" /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.totalLoan ? <NairaDisplay amount={record.totalLoan} variant="table" /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.monthlyDeduction ? <NairaDisplay amount={record.monthlyDeduction} variant="table" /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {record.outstandingBalance ? <NairaDisplay amount={record.outstandingBalance} variant="table" /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {record.varianceCategory ? (
                        <span className={cn(
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          VARIANCE_BADGE_COLORS[record.varianceCategory] ?? 'bg-gray-100 text-gray-800',
                        )}>
                          {UI_COPY.VARIANCE_CATEGORY_LABELS[record.varianceCategory] ?? record.varianceCategory}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        record.isBaselineCreated
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-gray-100 text-gray-600',
                      )}>
                        {record.isBaselineCreated ? 'Established' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {!isPending && data?.records && data.records.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-text-secondary">
            No data for this period.
          </p>
        )}
      </div>

      {/* Pagination */}
      {data?.pagination && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalRecords.toLocaleString()} records)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= (data.pagination.totalPages ?? 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CoverageRecordsPage;
