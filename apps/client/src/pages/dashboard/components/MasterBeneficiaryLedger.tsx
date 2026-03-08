import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useBeneficiaryList, useExportBeneficiaries } from '@/hooks/useBeneficiaryData';
import { useMigrationStatus } from '@/hooks/useMigrationData';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCount, formatDate } from '@/lib/formatters';
import { Download } from 'lucide-react';

export function MasterBeneficiaryLedger() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [mdaId, setMdaId] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'staffName' | 'totalExposure' | 'loanCount' | 'lastActivityDate'>('staffName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const filters = {
    page,
    pageSize: 25,
    mdaId,
    search: debouncedSearch.length >= 2 ? debouncedSearch : undefined,
    sortBy,
    sortOrder,
  };

  const { data, isPending } = useBeneficiaryList(filters);
  const { data: mdaList } = useMigrationStatus();
  const exportCsv = useExportBeneficiaries();
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'staffName' ? 'asc' : 'desc');
    }
    setPage(1);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportCsv(filters);
    } catch {
      setExportError('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const sortArrow = (col: string) => {
    if (sortBy !== col) return '';
    return sortOrder === 'asc' ? ' \u2191' : ' \u2193';
  };

  const metrics = data?.metrics;
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isPending ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))
        ) : metrics ? (
          <>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Total Staff</p>
              <p className="text-lg font-bold font-mono">{formatCount(metrics.totalStaff)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Total Loans</p>
              <p className="text-lg font-bold font-mono">{formatCount(metrics.totalLoans)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Observations</p>
              <p className="text-lg font-bold font-mono">{formatCount(metrics.totalObservationsUnreviewed)}</p>
            </div>
            <div className="rounded-lg border bg-white px-4 py-3">
              <p className="text-xs text-text-muted">Total Exposure</p>
              <NairaDisplay amount={metrics.totalExposure} variant="body" />
            </div>
          </>
        ) : null}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or Staff ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={mdaId ?? ''}
          onChange={(e) => {
            setMdaId(e.target.value || undefined);
            setPage(1);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All MDAs</option>
          {mdaList
            ?.filter((m) => m.stage !== 'pending')
            .map((m) => (
              <option key={m.mdaId} value={m.mdaId}>{m.mdaName}</option>
            ))}
        </select>
        <Button variant="secondary" onClick={handleExport} disabled={isExporting}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {isExporting ? 'Exporting...' : 'Export CSV'}
        </Button>
      </div>

      {exportError && (
        <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {exportError}
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th
                  className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-left cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('staffName')}
                >
                  Staff Name{sortArrow('staffName')}
                </th>
                <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-left">
                  Staff ID
                </th>
                <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-left">
                  MDA(s)
                </th>
                <th
                  className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('loanCount')}
                >
                  Active Loans{sortArrow('loanCount')}
                </th>
                <th
                  className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('totalExposure')}
                >
                  Total Exposure{sortArrow('totalExposure')}
                </th>
                <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">
                  Observations
                </th>
                <th
                  className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right cursor-pointer hover:text-text-primary"
                  onClick={() => handleSort('lastActivityDate')}
                >
                  Last Activity{sortArrow('lastActivityDate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td colSpan={7} className="py-2 px-3">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : data && data.data.length > 0 ? (
                data.data.map((person) => (
                  <tr
                    key={`${person.staffName}-${person.staffId}`}
                    className="border-b border-border/50 hover:bg-slate-50 cursor-pointer transition-colors"
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/dashboard/migration/persons/${encodeURIComponent(person.staffName)}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/dashboard/migration/persons/${encodeURIComponent(person.staffName)}`);
                      }
                    }}
                  >
                    <td className="py-2 px-3 text-text-primary font-medium">{person.staffName}</td>
                    <td className="py-2 px-3 font-mono text-text-muted text-xs">{person.staffId}</td>
                    <td className="py-2 px-3">
                      <span className="text-sm">{person.primaryMdaName}</span>
                      {person.isMultiMda && (
                        <Badge variant="info" className="ml-2 text-[10px]">Multi-MDA</Badge>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{person.loanCount}</td>
                    <td className="py-2 px-3 text-right">
                      <NairaDisplay amount={person.totalExposure} variant="table" />
                    </td>
                    <td className="py-2 px-3 text-right">
                      <Badge className="bg-slate-100 text-teal border-slate-200 text-xs">
                        {person.observationCount}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-right text-text-muted text-xs">
                      {person.lastActivityDate ? formatDate(person.lastActivityDate) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-sm text-text-muted">
                    No beneficiaries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-text-muted">
              Showing {((pagination.page - 1) * pagination.pageSize) + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of {formatCount(pagination.totalItems)}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
