import { useState } from 'react';
import { Loader2, ClipboardList, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommitteeListBatches } from '@/hooks/useCommitteeList';
import { CommitteeUploadWizard } from './components/CommitteeUploadWizard';

export function CommitteeListsPage() {
  const { data: batches, isPending } = useCommitteeListBatches();
  const [showWizard, setShowWizard] = useState(false);
  const [wizardListType, setWizardListType] = useState<'APPROVAL' | 'RETIREE'>('APPROVAL');

  const approvalBatches = batches?.filter((b) => b.listType === 'APPROVAL') ?? [];
  const retireeBatches = batches?.filter((b) => b.listType === 'RETIREE') ?? [];

  if (showWizard) {
    return (
      <CommitteeUploadWizard
        defaultListType={wizardListType}
        onComplete={() => setShowWizard(false)}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-6 w-6 text-teal" aria-hidden="true" />
        <h1 className="text-xl font-semibold text-text-primary">Committee Lists</h1>
      </div>

      {/* Approval Lists Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-text-primary">Approval Lists</h2>
          <Button
            size="sm"
            onClick={() => {
              setWizardListType('APPROVAL');
              setShowWizard(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Upload New List
          </Button>
        </div>
        {isPending ? (
          <div className="flex items-center gap-2 py-4 text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : approvalBatches.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">No approval lists uploaded yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {approvalBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} />
            ))}
          </div>
        )}
      </section>

      {/* Retiree/Deceased Lists Section */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium text-text-primary">Retiree / Deceased Lists</h2>
          <Button
            size="sm"
            onClick={() => {
              setWizardListType('RETIREE');
              setShowWizard(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Upload New List
          </Button>
        </div>
        {isPending ? (
          <div className="flex items-center gap-2 py-4 text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : retireeBatches.length === 0 ? (
          <p className="py-4 text-sm text-text-muted">No retiree/deceased lists uploaded yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {retireeBatches.map((batch) => (
              <BatchCard key={batch.id} batch={batch} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function BatchCard({ batch }: { batch: { id: string; label: string; year: number | null; listType: string; recordCount: number; createdAt: string } }) {
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h3 className="font-medium text-text-primary">{batch.label}</h3>
      <div className="mt-1 space-y-0.5 text-sm text-text-muted">
        {batch.year && <p>Year: {batch.year}</p>}
        <p>Type: {batch.listType === 'APPROVAL' ? 'Approval' : 'Retiree / Deceased'}</p>
        <p>Records: {batch.recordCount}</p>
        <p>Uploaded: {new Date(batch.createdAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}
