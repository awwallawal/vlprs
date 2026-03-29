import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { useVarianceReport } from '@/hooks/useReportData';
import { useMdaList } from '@/hooks/useMigration';
import { useAuthStore } from '@/stores/authStore';
import { MetricHelp } from '@/components/shared/MetricHelp';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { ReportActions } from './ReportActions';
import type { VarianceReportRow, OverdueRegisterRow, StalledRegisterRow, OverDeductedRegisterRow } from '@vlprs/shared';

const FILTER_ALL = '__all';

function categoryBadge(category: string) {
  switch (category) {
    case 'aligned':
      return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Aligned</Badge>;
    case 'minor_variance':
      return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Minor Variance</Badge>;
    case 'variance':
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Variance</Badge>;
    default:
      return <Badge variant="outline">{category}</Badge>;
  }
}

function severityBadge(tier: string) {
  switch (tier) {
    case 'Mild':
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200">Mild</Badge>;
    case 'Moderate':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Moderate</Badge>;
    case 'Elevated':
      return <Badge className="bg-amber-200 text-amber-900 border-amber-300">Elevated</Badge>;
    default:
      return <Badge variant="outline">{tier}</Badge>;
  }
}

export function VarianceReport() {
  const now = new Date();
  const user = useAuthStore((s) => s.user);
  const canSelectMda = user?.role === 'super_admin' || user?.role === 'dept_admin';
  const { data: mdas } = useMdaList();

  const [mdaId, setMdaId] = useState<string | undefined>(
    canSelectMda ? undefined : user?.mdaId ?? undefined,
  );
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);

  const { data, isLoading, error } = useVarianceReport({ mdaId, periodYear, periodMonth });

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
          <p className="text-text-secondary">Unable to load variance report. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3">
        {canSelectMda && (
          <Select value={mdaId || FILTER_ALL} onValueChange={(v) => setMdaId(v === FILTER_ALL ? undefined : v)}>
            <SelectTrigger className="w-64">
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
        <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(Number(v))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((name, idx) => (
              <SelectItem key={idx + 1} value={String(idx + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        </div>
        <ReportActions
          reportType="variance"
          queryParams={{ ...(mdaId ? { mdaId } : {}), periodYear: String(periodYear), periodMonth: String(periodMonth) }}
          reportTitle="Variance Report"
        />
      </div>

      {/* Summary */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Total Records <MetricHelp definition={{ label: 'Total Records', description: 'Number of submission rows compared in this period across all selected MDAs.', derivedFrom: 'Submission comparison engine' }} /></p>
              <p className="text-2xl font-bold">{data.summary.totalRecords}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Aligned <MetricHelp definition={{ label: 'Aligned', description: 'Records where declared and computed deduction amounts match exactly (difference = 0).', derivedFrom: 'Comparison engine category' }} /></p>
              <p className="text-2xl font-bold text-teal-700">{data.summary.alignedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Minor Variance <MetricHelp definition={{ label: 'Minor Variance', description: 'Records where the absolute difference between declared and computed amounts is under \u20A6500.', derivedFrom: 'Comparison engine threshold' }} /></p>
              <p className="text-2xl font-bold text-gray-600">{data.summary.minorVarianceCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-text-secondary">Variance <MetricHelp definition={{ label: 'Variance', description: 'Records where the absolute difference between declared and computed amounts is \u20A6500 or more.', derivedFrom: 'Comparison engine threshold' }} /></p>
              <p className="text-2xl font-bold text-amber-700">{data.summary.varianceCount}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Variance Detail Table */}
      {data && data.rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Variance Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Declared</TableHead>
                  <TableHead className="text-right">Computed</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Explanation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row: VarianceReportRow, idx: number) => (
                  <TableRow key={`${row.staffId}-${idx}`}>
                    <TableCell className="font-mono">{row.staffId}</TableCell>
                    <TableCell>{row.staffName}</TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={row.declaredAmount} /></TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={row.computedAmount} /></TableCell>
                    <TableCell className="text-right"><NairaDisplay amount={row.difference} /></TableCell>
                    <TableCell>{categoryBadge(row.category)}</TableCell>
                    <TableCell className="text-sm text-text-secondary max-w-xs truncate">{row.explanation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.rows.length === 0 && data.summary.totalRecords > 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-text-secondary">All records aligned — no variances detected.</p>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Classification Sections */}
      {data && (
        <div className="space-y-3">
          <EnhancedSection
            title="Loans Past Expected Completion"
            count={data.overdueRegister.length}
          >
            {data.overdueRegister.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead className="text-right">Months Past</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Severity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overdueRegister.map((row: OverdueRegisterRow) => (
                    <TableRow key={row.loanId}>
                      <TableCell>{row.staffName}</TableCell>
                      <TableCell className="font-mono">{row.staffId}</TableCell>
                      <TableCell className="text-right">{row.monthsPastExpected}</TableCell>
                      <TableCell className="text-right"><NairaDisplay amount={row.outstandingBalance} /></TableCell>
                      <TableCell>{severityBadge(row.severityTier)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </EnhancedSection>

          <EnhancedSection
            title="Balance Unchanged"
            count={data.stalledRegister.length}
          >
            {data.stalledRegister.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead className="text-right">Unchanged Months</TableHead>
                    <TableHead className="text-right">Frozen Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stalledRegister.map((row: StalledRegisterRow) => (
                    <TableRow key={row.loanId}>
                      <TableCell>{row.staffName}</TableCell>
                      <TableCell className="font-mono">{row.staffId}</TableCell>
                      <TableCell className="text-right">{row.consecutiveUnchangedMonths}</TableCell>
                      <TableCell className="text-right"><NairaDisplay amount={row.frozenAmount} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </EnhancedSection>

          <EnhancedSection
            title="Balance Below Zero"
            count={data.overDeductedRegister.length}
          >
            {data.overDeductedRegister.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead className="text-right">Negative Amount</TableHead>
                    <TableHead className="text-right">Est. Over-Months</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.overDeductedRegister.map((row: OverDeductedRegisterRow) => (
                    <TableRow key={row.loanId}>
                      <TableCell>{row.staffName}</TableCell>
                      <TableCell className="font-mono">{row.staffId}</TableCell>
                      <TableCell className="text-right"><NairaDisplay amount={row.negativeAmount} /></TableCell>
                      <TableCell className="text-right">{row.estimatedOverMonths}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </EnhancedSection>
        </div>
      )}
    </div>
  );
}

function EnhancedSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer select-none">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {title}
              </CardTitle>
              <Badge variant="outline" className="text-text-secondary">
                {count} {count === 1 ? 'record' : 'records'}
              </Badge>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {count === 0 ? (
              <p className="text-sm text-text-muted py-2">No records in this category.</p>
            ) : (
              children
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
