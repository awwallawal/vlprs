import { useState } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UI_COPY } from '@vlprs/shared';
import { useTransferSearch, useClaimTransfer } from '@/hooks/useEmploymentEvent';

export function TransferSearch() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const search = useTransferSearch(query, page);
  const claimTransfer = useClaimTransfer();

  async function handleClaim(staffId: string) {
    try {
      await claimTransfer.mutateAsync({ staffId });
      toast.success(UI_COPY.TRANSFER_STATUS_PENDING);
    } catch (error: unknown) {
      const err = error as Error & { message?: string };
      toast.info(err.message || 'Transfer claim needs attention');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{UI_COPY.TRANSFER_SEARCH_TITLE}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={UI_COPY.TRANSFER_SEARCH_PLACEHOLDER}
            className="pl-10"
          />
        </div>

        {search.isLoading && query.length >= 2 && (
          <p className="text-sm text-muted-foreground">Searching...</p>
        )}

        {search.data && search.data.items.length === 0 && query.length >= 2 && (
          <p className="text-sm text-muted-foreground">No results found</p>
        )}

        {search.data && search.data.items.length > 0 && (
          <div className="space-y-2">
            {search.data.items.map((item) => (
              <div
                key={item.staffId}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="font-medium">{item.staffName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.staffId} — {item.mdaName}
                  </p>
                  {item.transferStatus && (
                    <Badge variant="secondary" className="mt-1">
                      {UI_COPY.TRANSFER_STATUS_PENDING}
                    </Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleClaim(item.staffId)}
                  disabled={claimTransfer.isPending || !!item.transferStatus}
                >
                  {UI_COPY.TRANSFER_CLAIM_BUTTON}
                </Button>
              </div>
            ))}

            {/* Pagination */}
            {search.data.total > 20 && (
              <div className="flex justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center text-sm text-muted-foreground">
                  Page {page} of {Math.ceil(search.data.total / 20)}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= Math.ceil(search.data.total / 20)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
