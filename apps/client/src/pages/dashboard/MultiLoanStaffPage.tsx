/**
 * MultiLoanStaffPage — Surfaces staff with multiple loans across MDAs.
 * UAT 2026-04-14: AG/Dept Admin needs visibility into concentration risk
 * (e.g., ALATISE BOSEDE SUSAINAH with two distinct loans).
 */

import { useNavigate } from 'react-router';
import { Users, Building2, AlertCircle } from 'lucide-react';
import { useMultiLoanStaff } from '@/hooks/useMultiLoanStaff';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { NairaDisplay } from '@/components/shared/NairaDisplay';
import { HeroMetricCard } from '@/components/shared/HeroMetricCard';

/** Mirror of server's normalizeName() for personKey construction */
function normalizeStaffName(raw: string): string {
  let name = raw.toUpperCase().trim();
  name = name.replace(/\([^)]*\)/g, '').trim();
  name = name.replace(/\s+/g, ' ');
  for (let i = 0; i < 2; i++) {
    name = name.replace(/^(MRS?\.?|MISS|DR\.?|CHIEF|ALHAJ[IA]\.?|ALH\.?|PRINCE|PRINCESS|ENGR\.?|ARC\.?|PROF\.?|BARR\.?|HON\.?|COMR?A?DE?\.?|COL\.?|GEN\.?|CAPT\.?|PASTOR|REV\.?|ELDER|DEACON(ESS)?|OTUNBA|BAALE)\s+/i, '').trim();
  }
  return name.replace(/[.,]+$/, '').trim();
}

export function MultiLoanStaffPage() {
  const navigate = useNavigate();
  const { data, isPending } = useMultiLoanStaff();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Multi-Loan Beneficiaries</h1>
        <p className="text-sm text-text-secondary mt-1">
          Staff who appear with 2 or more loans in the system. This may indicate consecutive loans, cross-MDA transfers, or concentration concerns requiring AG attention.
        </p>
      </div>

      {/* Summary metrics */}
      <section aria-label="Summary">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <HeroMetricCard
            label="Multi-Loan Staff"
            value={data?.summary.multiLoanStaff ?? 0}
            format="count"
            isPending={isPending}
          />
          <HeroMetricCard
            label="Three or More Loans"
            value={data?.summary.triplePlus ?? 0}
            format="count"
            isPending={isPending}
          />
          <HeroMetricCard
            label="Cross-MDA Beneficiaries"
            value={data?.summary.crossMda ?? 0}
            format="count"
            isPending={isPending}
          />
          <HeroMetricCard
            label="Concentrated Exposure"
            value={data?.summary.concentratedExposure ?? '0'}
            format="currency"
            isPending={isPending}
          />
        </div>
      </section>

      {/* Context banner */}
      {!isPending && data && data.summary.crossMda > 0 && (
        <section className="rounded-lg border bg-blue-50 border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-700 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-900">
              <p className="font-medium">{data.summary.crossMda.toLocaleString()} staff have loans across multiple MDAs.</p>
              <p className="mt-1 text-blue-800">
                This typically indicates consecutive loans (one completed, another taken at a new MDA after transfer) or in rare cases, concurrent loans that warrant investigation.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Staff list */}
      <section aria-label="Multi-loan staff">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Staff Name</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">Loans</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">MDAs</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">MDA Codes</th>
                <th className="px-4 py-3 text-right font-medium text-text-secondary">Total Principal</th>
                <th className="px-4 py-3 text-center font-medium text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left font-medium text-text-secondary">Action</th>
              </tr>
            </thead>
            <tbody>
              {isPending ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-4 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                    <td className="px-4 py-3"><Skeleton className="mx-auto h-4 w-8" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-24" /></td>
                    <td className="px-4 py-3"><Skeleton className="mx-auto h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : data?.staff?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-text-secondary">
                    No staff with multiple loans detected.
                  </td>
                </tr>
              ) : (
                data?.staff?.map((row) => {
                  const personKey = encodeURIComponent(`${row.sampleMdaCode}:${normalizeStaffName(row.staffName)}`);
                  return (
                  <tr
                    key={row.staffName}
                    className="border-b hover:bg-slate-50 cursor-pointer"
                    onClick={() => navigate(`/dashboard/migration/persons/${personKey}`)}
                  >
                    <td className="px-4 py-3 font-medium text-text-primary flex items-center gap-2">
                      <Users className="h-4 w-4 text-text-muted" />
                      {row.staffName}
                    </td>
                    <td className="px-4 py-3 text-center font-mono">
                      <Badge variant={row.loanCount >= 3 ? 'review' : 'pending'}>{row.loanCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {row.mdaCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-xs">{row.mdaCodes}</td>
                    <td className="px-4 py-3 text-right">
                      <NairaDisplay amount={row.totalPrincipal} variant="table" />
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      <span className="text-text-secondary">
                        {row.activeCount > 0 && `${row.activeCount} active`}
                        {row.activeCount > 0 && row.completedCount > 0 && ' • '}
                        {row.completedCount > 0 && `${row.completedCount} done`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-teal font-medium">View History →</span>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export { MultiLoanStaffPage as Component };
