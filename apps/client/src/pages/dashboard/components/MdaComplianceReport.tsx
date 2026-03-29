import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { useMdaComplianceReport } from '@/hooks/useReportData';
import { AlertTriangle, ArrowUpDown } from 'lucide-react';
import { ReportActions } from './ReportActions';
import type { MdaComplianceReportRow } from '@vlprs/shared';

type SortField = 'mdaName' | 'healthScore' | 'compliancePercent' | 'totalOutstanding' | 'unresolvedObservationCount';

function healthBadge(band: string) {
  switch (band) {
    case 'healthy': return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Healthy</Badge>;
    case 'attention': return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Needs Attention</Badge>;
    default: return <Badge variant="outline" className="text-gray-600 border-gray-300">For Review</Badge>;
  }
}

export function MdaComplianceReport() {
  const now = new Date();
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [sortField, setSortField] = useState<SortField>('mdaName');
  const [sortAsc, setSortAsc] = useState(true);

  const { data, isLoading, error } = useMdaComplianceReport({ periodYear, periodMonth });

  const sortedRows = useMemo(() => {
    if (!data) return [];
    const rows = [...data.rows];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'mdaName':
          cmp = a.mdaName.localeCompare(b.mdaName);
          break;
        case 'healthScore':
          cmp = a.healthScore - b.healthScore;
          break;
        case 'compliancePercent':
          cmp = a.compliancePercent - b.compliancePercent;
          break;
        case 'totalOutstanding':
          cmp = a.totalOutstanding.localeCompare(b.totalOutstanding, undefined, { numeric: true });
          break;
        case 'unresolvedObservationCount':
          cmp = a.unresolvedObservationCount - b.unresolvedObservationCount;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return rows;
  }, [data, sortField, sortAsc]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'mdaName');
    }
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer select-none"
      onClick={() => toggleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-text-secondary" />
      </div>
    </TableHead>
  );

  // Generate year options (current year and 2 years back)
  const yearOptions = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
          <p className="text-text-secondary">Unable to load compliance report. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with Period Selector + Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-text-secondary">Period:</label>
        <select
          value={periodYear}
          onChange={e => setPeriodYear(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select
          value={periodMonth}
          onChange={e => setPeriodMonth(Number(e.target.value))}
          className="border rounded px-2 py-1 text-sm"
        >
          {monthNames.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </select>
        </div>
        <ReportActions
          reportType="mda-compliance"
          queryParams={{ periodYear: String(periodYear), periodMonth: String(periodMonth) }}
          reportTitle="MDA Compliance Report"
        />
      </div>

      {/* Compliance Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            MDA Compliance — {monthNames[periodMonth - 1]} {periodYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="mdaName">MDA</SortableHeader>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Submission</TableHead>
                  <TableHead className="text-right">Records</TableHead>
                  <SortableHeader field="compliancePercent">Compliance %</SortableHeader>
                  <SortableHeader field="healthScore">Health</SortableHeader>
                  <TableHead className="text-right">Coverage %</TableHead>
                  <SortableHeader field="totalOutstanding">Outstanding</SortableHeader>
                  <SortableHeader field="unresolvedObservationCount">Observations</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.map((row: MdaComplianceReportRow) => (
                  <TableRow key={row.mdaId}>
                    <TableCell className="font-medium">{row.mdaName}</TableCell>
                    <TableCell className="text-text-secondary">{row.mdaCode}</TableCell>
                    <TableCell>
                      <Badge variant={row.submissionStatus === 'Submitted' ? 'default' : 'secondary'}>
                        {row.submissionStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-secondary">
                      {row.lastSubmissionDate
                        ? new Date(row.lastSubmissionDate).toLocaleDateString()
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">{row.recordCount}</TableCell>
                    <TableCell className="text-right">{row.compliancePercent.toFixed(1)}%</TableCell>
                    <TableCell>{healthBadge(row.healthBand)}</TableCell>
                    <TableCell className="text-right">
                      {row.coveragePercent !== null ? `${row.coveragePercent.toFixed(0)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={row.totalOutstanding} /></TableCell>
                    <TableCell className="text-right">{row.unresolvedObservationCount}</TableCell>
                  </TableRow>
                ))}
                {sortedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-text-secondary py-8">
                      No MDA data available for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary Row */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-text-secondary">Total MDAs</p>
              <p className="text-lg font-semibold">{data.summary.totalMdas}</p>
            </div>
            <div>
              <p className="text-text-secondary">Average Health Score</p>
              <p className="text-lg font-semibold">{data.summary.averageHealthScore.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-text-secondary">Total Outstanding</p>
              <p className="text-lg font-semibold"><NairaDisplay amount={data.summary.totalOutstanding} /></p>
            </div>
            <div>
              <p className="text-text-secondary">Total Observations</p>
              <p className="text-lg font-semibold">{data.summary.totalObservations}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-text-secondary text-right">
        Generated: {new Date(data.generatedAt).toLocaleString()}
      </p>
    </div>
  );
}
