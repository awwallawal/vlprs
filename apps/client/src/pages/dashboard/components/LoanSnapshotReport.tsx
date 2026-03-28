import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { useLoanSnapshotReport } from '@/hooks/useReportData';
import { useMdaList } from '@/hooks/useMigration';
import { useAuthStore } from '@/stores/authStore';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { AlertTriangle, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LoanSnapshotRow } from '@vlprs/shared';

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const FILTER_ALL = '__all';

type SortField = 'staffName' | 'staffId' | 'principalAmount' | 'outstandingBalance' | 'status' | 'approvalDate' | 'monthlyDeductionAmount' | 'tenureMonths' | 'gradeLevel';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'APPLIED', label: 'Applied' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'TRANSFERRED', label: 'Transferred' },
  { value: 'WRITTEN_OFF', label: 'Written Off' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'DECEASED', label: 'Deceased' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'LWOP', label: 'Leave Without Pay' },
];

export function LoanSnapshotReport() {
  const user = useAuthStore((s) => s.user);
  const canSelectMda = user?.role === 'super_admin' || user?.role === 'dept_admin';
  const { data: mdas } = useMdaList();

  const [mdaId, setMdaId] = useState<string | undefined>(
    canSelectMda ? undefined : user?.mdaId ?? undefined,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [sortBy, setSortBy] = useState<SortField>('staffName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useLoanSnapshotReport(mdaId, {
    page,
    pageSize,
    sortBy,
    sortOrder,
    statusFilter,
  });

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder(field === 'staffName' ? 'asc' : 'desc');
    }
    setPage(1);
  }

  const SortableHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead
      className={`cursor-pointer select-none ${className ?? ''}`}
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-text-secondary" />
      </div>
    </TableHead>
  );

  if (!mdaId) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <Select value={FILTER_ALL} onValueChange={(v) => { setMdaId(v === FILTER_ALL ? undefined : v); setPage(1); }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select an MDA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL} disabled>Select an MDA</SelectItem>
              {mdas?.map((mda) => (
                <SelectItem key={mda.id} value={mda.id}>{mda.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-text-secondary">Select an MDA to view the Loan Snapshot report.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
          <p className="text-text-secondary">Unable to load loan snapshot report. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {canSelectMda && (
          <Select value={mdaId} onValueChange={(v) => { setMdaId(v); setPage(1); }}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select MDA" />
            </SelectTrigger>
            <SelectContent>
              {mdas?.map((mda) => (
                <SelectItem key={mda.id} value={mda.id}>{mda.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={statusFilter || FILTER_ALL} onValueChange={(v) => { setStatusFilter(v === FILTER_ALL ? undefined : v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>All Statuses</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <SelectItem key={size} value={String(size)}>{size} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Total Loans <MetricHelp definition={{ label: 'Total Loans', description: 'Count of all loan records for this MDA matching the current status filter.', derivedFrom: 'Loans table' }} /></p>
              <p className="text-2xl font-bold">{data.summary.totalLoans}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Total Outstanding <MetricHelp definition={{ label: 'Total Outstanding', description: 'Sum of computed outstanding balances across all matching loans (principal + interest minus total paid).', derivedFrom: 'Computation engine via ledger entries' }} /></p>
              <p className="text-xl font-bold"><NairaDisplay amount={data.summary.totalOutstanding} /></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Monthly Deduction <MetricHelp definition={{ label: 'Monthly Deduction', description: 'Sum of scheduled monthly deduction amounts for all matching loans.', derivedFrom: 'Loans table monthly_deduction_amount' }} /></p>
              <p className="text-xl font-bold"><NairaDisplay amount={data.summary.totalMonthlyDeduction} /></p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Avg Interest Rate <MetricHelp definition={{ label: 'Average Interest Rate', description: 'Mean interest rate across all matching loans for this MDA.', derivedFrom: 'Loans table interest_rate' }} /></p>
              <p className="text-2xl font-bold">{data.summary.averageInterestRate}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 16-Column Snapshot Table */}
      {data && data.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Loan Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="staffId">Staff ID</SortableHeader>
                  <SortableHeader field="staffName">Name</SortableHeader>
                  <SortableHeader field="gradeLevel">Grade</SortableHeader>
                  <SortableHeader field="principalAmount" className="text-right">Principal</SortableHeader>
                  <TableHead className="text-right">Rate</TableHead>
                  <SortableHeader field="tenureMonths" className="text-right">Tenure</SortableHeader>
                  <TableHead className="text-right">Moratorium</TableHead>
                  <SortableHeader field="monthlyDeductionAmount" className="text-right">Monthly Deduction</SortableHeader>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <SortableHeader field="status">Status</SortableHeader>
                  <TableHead>Last Deduction</TableHead>
                  <TableHead>Next Deduction</TableHead>
                  <SortableHeader field="approvalDate">Approval</SortableHeader>
                  <TableHead>Reference</TableHead>
                  <TableHead>MDA Code</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((row: LoanSnapshotRow) => (
                  <TableRow key={row.loanReference}>
                    <TableCell className="font-mono text-xs">{row.staffId}</TableCell>
                    <TableCell className="whitespace-nowrap">{row.staffName}</TableCell>
                    <TableCell>{row.gradeLevel}</TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={row.principalAmount} /></TableCell>
                    <TableCell className="text-right">{row.interestRate}%</TableCell>
                    <TableCell className="text-right">{row.tenureMonths}</TableCell>
                    <TableCell className="text-right">{row.moratoriumMonths}</TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={row.monthlyDeductionAmount} /></TableCell>
                    <TableCell className="text-right">{row.installmentsPaid}</TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={row.outstandingBalance} /></TableCell>
                    <TableCell><Badge variant="outline">{row.status}</Badge></TableCell>
                    <TableCell className="text-xs">{row.lastDeductionDate ?? '—'}</TableCell>
                    <TableCell className="text-xs">{row.nextDeductionDate ?? '—'}</TableCell>
                    <TableCell className="text-xs">{row.approvalDate ? new Date(row.approvalDate).toLocaleDateString() : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.loanReference}</TableCell>
                    <TableCell>{row.mdaCode}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-text-secondary">No loan records found for this MDA{statusFilter ? ` with status ${statusFilter}` : ''}.</p>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.totalItems} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
