import { useNavigate, useSearchParams } from 'react-router';
import { Award, Download, Filter, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  useCertificateList,
  useDownloadCertificatePdf,
  useResendNotifications,
  type CertificateListFilters,
} from '@/hooks/useCertificate';
import { useMdaList } from '@/hooks/useMigration';
import { useAuthStore } from '@/stores/authStore';
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
import { formatDateTime } from '@/lib/formatters';
import type {
  CertificateListItem,
  CertificateNotificationStatus,
  CertificateSortBy,
} from '@vlprs/shared';

const FILTER_ALL = '__all';
const PAGE_SIZE = 25;

// Render completionDate in the canonical project timezone (Africa/Lagos, UTC+1)
// rather than the browser's local TZ. The DB column is `timestamptz`, the service
// emits `toISOString()` (UTC), and "completion date" is semantically a calendar
// day in Lagos — so any rendering must be TZ-anchored. en-GB locale matches the
// dd-MMM-yyyy shape used elsewhere on the page; the `replace(/ /g, '-')` step
// turns "08 Apr 2026" → "08-Apr-2026" so visual consistency with formatDateTime
// is preserved.
const LAGOS_TZ = 'Africa/Lagos';
const lagosDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: LAGOS_TZ,
});

function formatCompletionDate(iso: string): string {
  try {
    return lagosDateFormatter.format(new Date(iso)).replace(/ /g, '-');
  } catch {
    return iso || '—';
  }
}

function NotificationBadge({ item }: { item: CertificateListItem }) {
  const mda = !!item.notifiedMdaAt;
  const beneficiary = !!item.notifiedBeneficiaryAt;

  if (mda && beneficiary) {
    return <Badge variant="complete">Notified</Badge>;
  }
  if (mda || beneficiary) {
    return <Badge variant="review">{mda ? 'MDA Only' : 'Beneficiary Only'}</Badge>;
  }
  return <Badge variant="pending">Pending</Badge>;
}

function CertificateRowActions({
  item,
  isSuperAdmin,
}: {
  item: CertificateListItem;
  isSuperAdmin: boolean;
}) {
  const download = useDownloadCertificatePdf(item.loanId);
  const resend = useResendNotifications(item.loanId);

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={download.isPending}
        onClick={(e) => {
          e.stopPropagation();
          download.mutate(undefined, {
            onError: () => toast.error('Certificate download failed'),
          });
        }}
        aria-label={`Download certificate ${item.certificateId}`}
      >
        <Download className="h-4 w-4 mr-1" />
        {download.isPending ? 'Downloading...' : 'PDF'}
      </Button>
      {isSuperAdmin && (
        <Button
          size="sm"
          variant="outline"
          disabled={resend.isPending}
          onClick={(e) => {
            e.stopPropagation();
            resend.mutate(undefined, {
              onSuccess: (result) => {
                toast.success(
                  `Notifications resent — ${result.mdaOfficersNotified} MDA officer(s)${
                    result.beneficiaryNotified ? ' + beneficiary' : ''
                  }`,
                );
              },
              onError: () => toast.error('Resend failed'),
            });
          }}
          aria-label={`Resend notifications for certificate ${item.certificateId}`}
        >
          <Send className="h-4 w-4 mr-1" />
          {resend.isPending ? 'Sending...' : 'Resend'}
        </Button>
      )}
    </div>
  );
}

export function CertificateListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const isMdaOfficer = user?.role === 'mda_officer';

  const mdaId = searchParams.get('mdaId') || '';
  const notificationStatus = (searchParams.get('notificationStatus') || '') as
    | CertificateNotificationStatus
    | '';
  const sortBy = (searchParams.get('sortBy') || 'generatedAt') as CertificateSortBy;
  const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';
  const page = Number(searchParams.get('page') || '1');

  const { data: mdas } = useMdaList();

  const filters: CertificateListFilters = {
    mdaId: mdaId || undefined,
    notificationStatus: notificationStatus || undefined,
    sortBy,
    sortOrder,
    page,
    limit: PAGE_SIZE,
  };

  const { data, isPending, isError } = useCertificateList(filters);
  const certificates = data?.data ?? [];
  const total = data?.total ?? 0;
  // Use the backend-returned pageSize so the math survives a future backend default change.
  const effectivePageSize = data?.pageSize ?? PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize));

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

  function toggleSort(column: CertificateSortBy) {
    const next = new URLSearchParams(searchParams);
    if (column === sortBy) {
      next.set('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      next.set('sortBy', column);
      next.set('sortOrder', 'desc');
    }
    next.set('page', '1');
    setSearchParams(next);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Award className="h-6 w-6 text-gold" />
          <h1 className="text-2xl font-bold text-text-primary">
            Completed Loans &amp; Certificates
          </h1>
          {!isPending && (
            <span className="text-sm text-text-muted">{total} issued</span>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-text-muted" />

        <Select
          value={notificationStatus || FILTER_ALL}
          onValueChange={(v) => setFilter('notificationStatus', v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Notification Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FILTER_ALL}>All Statuses</SelectItem>
            <SelectItem value="notified">Notified</SelectItem>
            <SelectItem value="partial">Partially Notified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>

        {/* MDA filter: visible to SUPER_ADMIN and DEPT_ADMIN. MDA officers are scoped server-side. */}
        {!isMdaOfficer && (
          <Select value={mdaId || FILTER_ALL} onValueChange={(v) => setFilter('mdaId', v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All MDAs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={FILTER_ALL}>All MDAs</SelectItem>
              {mdas?.map((mda) => (
                <SelectItem key={mda.id} value={mda.id}>
                  {mda.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Table / States */}
      {isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm text-text-secondary">
            Unable to load certificates right now. Please refresh and try again.
          </p>
        </div>
      ) : certificates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-12 text-center">
          <Award className="h-10 w-10 text-text-muted mx-auto mb-3" />
          <p className="text-base font-medium text-text-primary mb-1">
            No Auto-Stop Certificates have been issued yet
          </p>
          <p className="text-sm text-text-muted">
            Certificates are automatically generated when a loan reaches zero balance.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Certificate ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Beneficiary
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Staff ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  MDA
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary cursor-pointer select-none"
                  onClick={() => toggleSort('completionDate')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSort('completionDate');
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-sort={
                    sortBy === 'completionDate'
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  Completion Date
                  {sortBy === 'completionDate' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
                <th
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary cursor-pointer select-none"
                  onClick={() => toggleSort('generatedAt')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleSort('generatedAt');
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-sort={
                    sortBy === 'generatedAt'
                      ? sortOrder === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  Generated
                  {sortBy === 'generatedAt' && (
                    <span className="ml-1">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Notification
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {certificates.map((item) => (
                <tr
                  key={item.certificateId}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => navigate(`/dashboard/mda/${item.mdaId}/loan/${item.loanId}`)}
                >
                  <td className="px-4 py-3 text-sm font-mono text-text-primary">
                    {item.certificateId}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">{item.beneficiaryName}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{item.staffId}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{item.mdaName}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {formatCompletionDate(item.completionDate)}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {formatDateTime(item.generatedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <NotificationBadge item={item} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <CertificateRowActions item={item} isSuperAdmin={isSuperAdmin} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isPending && certificates.length > 0 && totalPages > 1 && (
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
    </div>
  );
}

export { CertificateListPage as Component };
