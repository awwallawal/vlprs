import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, HelpCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useMdaResolve, useCreateMdaAlias, type ResolveResult } from '@/hooks/useMda';
import { useMdaList } from '@/hooks/useMigration';
import type { MdaListItem } from '@vlprs/shared';

interface MdaAliasReviewPanelProps {
  rawMdaStrings: string[];
  onConfirm: (mappings: Map<string, string>) => void; // raw string -> mdaId
  onCancel: () => void;
}

export function MdaAliasReviewPanel({
  rawMdaStrings,
  onConfirm,
  onCancel,
}: MdaAliasReviewPanelProps) {
  const resolveMutation = useMdaResolve();
  const createAliasMutation = useCreateMdaAlias();
  const { data: mdaList } = useMdaList();

  // Track user selections for needs_review + unknown items
  const [selections, setSelections] = useState<Map<string, string>>(new Map());
  const [results, setResults] = useState<ResolveResult[]>([]);
  const [confirming, setConfirming] = useState(false);

  // Resolve on mount — resolveMutation.mutate is stable (from useMutation)
  const resolveMutate = resolveMutation.mutate;
  useEffect(() => {
    if (rawMdaStrings.length > 0) {
      resolveMutate(rawMdaStrings, {
        onSuccess: (data) => setResults(data.results),
      });
    }
  }, [rawMdaStrings, resolveMutate]);

  const autoMatched = results.filter((r) => r.status === 'auto_matched');
  const needsReview = results.filter((r) => r.status === 'needs_review');
  const unknown = results.filter((r) => r.status === 'unknown');

  // Pre-select top candidate for needs_review items
  useEffect(() => {
    const initial = new Map<string, string>();
    for (const r of results) {
      if (r.status === 'needs_review' && r.candidates.length > 0) {
        initial.set(r.input, r.candidates[0].mda.id);
      }
    }
    setSelections(initial);
  }, [results]);

  const allResolved =
    needsReview.every((r) => selections.has(r.input)) &&
    unknown.every((r) => selections.has(r.input));

  async function handleConfirm() {
    setConfirming(true);
    try {
      // Build the full mappings: auto-matched + user selections
      const mappings = new Map<string, string>();

      for (const r of autoMatched) {
        if (r.resolved) mappings.set(r.input, r.resolved.id);
      }

      // Save aliases for needs_review + unknown items, then add to mappings
      for (const r of [...needsReview, ...unknown]) {
        const mdaId = selections.get(r.input);
        if (!mdaId) continue;
        mappings.set(r.input, mdaId);

        // Create alias so future uploads auto-resolve
        try {
          await createAliasMutation.mutateAsync({ alias: r.input, mdaId });
        } catch {
          // Alias may already exist — that's fine
        }
      }

      onConfirm(mappings);
    } finally {
      setConfirming(false);
    }
  }

  if (resolveMutation.isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Resolving MDA names...</span>
      </div>
    );
  }

  if (resolveMutation.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        <p className="font-medium">Failed to resolve MDA names</p>
        <p className="mt-1 text-sm">{resolveMutation.error.message}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-Matched */}
      {autoMatched.length > 0 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
            Auto-Matched ({autoMatched.length})
          </h4>
          <div className="space-y-1">
            {autoMatched.map((r) => (
              <div
                key={r.input}
                className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate font-medium text-text-primary">
                  {r.input}
                </span>
                <span className="text-text-muted">&rarr;</span>
                <span className="text-green-700">
                  {r.resolved?.name} ({r.resolved?.code})
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Needs Review */}
      {needsReview.length > 0 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <AlertCircle className="h-4 w-4 text-amber-500" aria-hidden="true" />
            Needs Review ({needsReview.length})
          </h4>
          <div className="space-y-2">
            {needsReview.map((r) => (
              <ReviewRow
                key={r.input}
                result={r}
                mdaList={mdaList ?? []}
                selectedMdaId={selections.get(r.input)}
                onSelect={(mdaId) =>
                  setSelections((prev) => new Map(prev).set(r.input, mdaId))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Unknown */}
      {unknown.length > 0 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text-secondary">
            <HelpCircle className="h-4 w-4 text-red-500" aria-hidden="true" />
            Unknown ({unknown.length})
          </h4>
          <div className="space-y-2">
            {unknown.map((r) => (
              <ReviewRow
                key={r.input}
                result={r}
                mdaList={mdaList ?? []}
                selectedMdaId={selections.get(r.input)}
                onSelect={(mdaId) =>
                  setSelections((prev) => new Map(prev).set(r.input, mdaId))
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Info notice */}
      <p className="text-xs text-text-muted">
        Confirmed mappings are saved permanently. Future uploads with the same MDA
        names will resolve automatically.
      </p>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleConfirm} disabled={!allResolved || confirming}>
          {confirming ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confirming...
            </>
          ) : (
            'Confirm All Mappings'
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={confirming}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Review Row ──────────────────────────────────────────────────────

interface ReviewRowProps {
  result: ResolveResult;
  mdaList: MdaListItem[];
  selectedMdaId: string | undefined;
  onSelect: (mdaId: string) => void;
}

function ReviewRow({ result, mdaList, selectedMdaId, onSelect }: ReviewRowProps) {
  const isNeedsReview = result.status === 'needs_review';

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        isNeedsReview ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50',
      )}
    >
      <div className="flex items-center gap-2 text-sm">
        <span className="min-w-0 shrink-0 truncate font-medium text-text-primary">
          {result.input}
        </span>
        <span className="text-text-muted">&rarr;</span>
        <select
          value={selectedMdaId ?? ''}
          onChange={(e) => onSelect(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        >
          <option value="" disabled>
            Select MDA...
          </option>
          {/* Show candidates first if available */}
          {result.candidates.length > 0 && (
            <optgroup label="Suggested">
              {result.candidates.map((c) => (
                <option key={c.mda.id} value={c.mda.id}>
                  {c.mda.name} ({c.mda.code}) — {c.reason}, score {c.score}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="All MDAs">
            {mdaList.map((mda) => (
              <option key={mda.id} value={mda.id}>
                {mda.name} ({mda.code})
              </option>
            ))}
          </optgroup>
        </select>
      </div>
    </div>
  );
}
