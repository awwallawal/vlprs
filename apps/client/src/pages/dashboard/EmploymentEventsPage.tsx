import { useState } from 'react';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { UI_COPY, ROLES } from '@vlprs/shared';
import { useEmploymentEvents } from '@/hooks/useEmploymentEvent';
import { useAuthStore } from '@/stores/authStore';
import { EmploymentEventForm } from './components/EmploymentEventForm';
import { TransferSearch } from './components/TransferSearch';

export function EmploymentEventsPage() {
  const user = useAuthStore((s) => s.user);
  const mdaId = user?.mdaId;
  const [page, setPage] = useState(1);

  const events = useEmploymentEvents(mdaId ?? undefined, page);

  const isDeptAdmin = user?.role === ROLES.DEPT_ADMIN;
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const canConfirmTransfers = isDeptAdmin || isSuperAdmin;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{UI_COPY.EMPLOYMENT_EVENT_PAGE_TITLE}</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <EmploymentEventForm />
        <TransferSearch />
      </div>

      {/* Pending Transfers for Dept Admin / Super Admin */}
      {canConfirmTransfers && (
        <Card>
          <CardHeader>
            <CardTitle>{UI_COPY.TRANSFER_PENDING_HEADING}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Pending transfers requiring confirmation will appear in the event history below.
              Use the Transfer Search to find and confirm pending handshakes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Event History */}
      <Card>
        <CardHeader>
          <CardTitle>{UI_COPY.EVENT_HISTORY_HEADING}</CardTitle>
        </CardHeader>
        <CardContent>
          {events.isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

          {events.data && events.data.items.length === 0 && (
            <p className="text-sm text-muted-foreground">{UI_COPY.EVENT_HISTORY_EMPTY}</p>
          )}

          {events.data && events.data.items.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Staff Name</TableHead>
                    <TableHead>Staff ID</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Filed By</TableHead>
                    <TableHead>Date Filed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.data.items.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        {(UI_COPY.EVENT_TYPE_LABELS as Record<string, string>)[event.eventType] ?? event.eventType}
                      </TableCell>
                      <TableCell>{event.staffName}</TableCell>
                      <TableCell>{event.staffId}</TableCell>
                      <TableCell>{event.effectiveDate}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{event.reconciliationStatus}</Badge>
                      </TableCell>
                      <TableCell>{event.filedByName}</TableCell>
                      <TableCell>
                        {format(new Date(event.createdAt), 'dd MMM yyyy')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {events.data.total > 20 && (
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(events.data.total / 20)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= Math.ceil(events.data.total / 20)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
