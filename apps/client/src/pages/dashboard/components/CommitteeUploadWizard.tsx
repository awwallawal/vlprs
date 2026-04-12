import { useState, useCallback } from 'react';
import { Upload, CheckCircle2, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MdaAliasReviewPanel } from '@/components/shared/MdaAliasReviewPanel';
import {
  useUploadCommitteeFile,
  useConfirmCommitteeUpload,
  useCreateBatch,
  useCommitteeListBatches,
  useThreeVectorValidation,
  useMatchAndClassify,
  useProcessRetiree,
} from '@/hooks/useCommitteeList';

interface CommitteeUploadWizardProps {
  defaultListType: 'APPROVAL' | 'RETIREE';
  onComplete: () => void;
  onCancel: () => void;
}

type WizardStep =
  | 'batch'
  | 'upload'
  | 'preview'
  | 'mda-review'
  | 'three-vector'
  | 'match'
  | 'confirm'
  | 'success';

interface ParsedPreview {
  schemaType: 'approval' | 'retiree';
  sheets: Array<{ sheetName: string; recordCount: number; skipped: boolean; skipReason?: string }>;
  records: Array<Record<string, unknown>>;
  dataQualityFlags: Array<{ row: number; field: string; issue: string }>;
}

export function CommitteeUploadWizard({
  defaultListType,
  onComplete,
  onCancel,
}: CommitteeUploadWizardProps) {
  const [step, setStep] = useState<WizardStep>('batch');
  const [batchMode, setBatchMode] = useState<'create' | 'existing'>('create');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchLabel, setBatchLabel] = useState('');
  const [batchYear, setBatchYear] = useState<string>('');
  const [batchNotes, setBatchNotes] = useState('');
  const [preview, setPreview] = useState<ParsedPreview | null>(null);
  const [mdaMappings, setMdaMappings] = useState<Map<string, string>>(new Map());
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [perMdaCounts, setPerMdaCounts] = useState<Array<{ mda: string; count: number }>>([]);

  // Track 2 state
  const [validationResults, setValidationResults] = useState<Array<{
    sourceRow: number; name: string; category: string;
    schemeExpected: Record<string, string> | null;
    committeeDeclared: Record<string, string | null>;
  }>>([]);
  const [matchResults, setMatchResults] = useState<Array<{
    sourceRow: number; name: string; status: string;
    matchedLoanId: string | null; matchedLoanRef: string | null;
  }>>([]);

  const uploadMutation = useUploadCommitteeFile();
  const confirmMutation = useConfirmCommitteeUpload();
  const createBatchMutation = useCreateBatch();
  const { data: existingBatches } = useCommitteeListBatches();
  const threeVectorMutation = useThreeVectorValidation();
  const matchMutation = useMatchAndClassify();
  const processMutation = useProcessRetiree();

  const isTrack2 = preview?.schemaType === 'retiree';

  // ─── Batch Step ────────────────────────────────────────────────────

  const handleCreateBatch = async () => {
    const batch = await createBatchMutation.mutateAsync({
      label: batchLabel,
      listType: defaultListType,
      year: batchYear ? Number(batchYear) : undefined,
      notes: batchNotes || undefined,
    });
    setBatchId(batch.id);
    setBatchLabel(batch.label);
    setStep('upload');
  };

  const handleSelectExistingBatch = (selectedId: string) => {
    setBatchId(selectedId);
    const selected = filteredExistingBatches.find((b) => b.id === selectedId);
    if (selected) setBatchLabel(selected.label);
    setStep('upload');
  };

  // ─── Upload Step ───────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      const result = await uploadMutation.mutateAsync(file);
      setPreview(result as unknown as ParsedPreview);
      setStep('preview');
    },
    [uploadMutation],
  );

  // ─── Preview → MDA Review ─────────────────────────────────────────

  const handlePreviewContinue = () => {
    const records = preview?.records ?? [];
    const mdaStrings = [...new Set(
      records.map((r) => r.mdaRaw as string | null).filter(Boolean),
    )] as string[];

    if (mdaStrings.length > 0) {
      setStep('mda-review');
    } else if (isTrack2) {
      setStep('three-vector');
    } else {
      setStep('confirm');
    }
  };

  // ─── MDA Review → next step ────────────────────────────────────────

  const handleMdaConfirm = (mappings: Map<string, string>) => {
    setMdaMappings(mappings);
    if (isTrack2) {
      setStep('three-vector');
    } else {
      setStep('confirm');
    }
  };

  // ─── Track 2: Three-Vector Validation ──────────────────────────────

  const handleRunValidation = async () => {
    if (!preview) return;
    const result = await threeVectorMutation.mutateAsync(preview.records);
    setValidationResults(result.results as typeof validationResults);
    setStep('match');
  };

  // ─── Track 2: Match & Classify ─────────────────────────────────────

  const handleRunMatch = async () => {
    if (!preview) return;
    const mappingsObj: Record<string, string> = {};
    mdaMappings.forEach((v, k) => { mappingsObj[k] = v; });

    const result = await matchMutation.mutateAsync({
      records: preview.records,
      mdaMappings: mappingsObj,
    });
    setMatchResults(result.results as typeof matchResults);
    setStep('confirm');
  };

  // ─── Confirm / Process ─────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!preview || !batchId) return;

    const mappingsObj: Record<string, string> = {};
    mdaMappings.forEach((v, k) => { mappingsObj[k] = v; });

    if (isTrack2) {
      // Track 2 uses processRetireeRecords with per-record transactions
      const result = await processMutation.mutateAsync({
        records: preview.records,
        mdaMappings: mappingsObj,
        batchId,
      });
      setConfirmedCount(result.processed);
    } else {
      // Track 1 uses confirmUpload (bulk insert)
      const result = await confirmMutation.mutateAsync({
        records: preview.records,
        mdaMappings: mappingsObj,
        batchId,
      });
      setConfirmedCount(result.count);
    }

    // Compute per-MDA breakdown
    const mdaCountMap = new Map<string, number>();
    for (const r of preview.records) {
      const raw = r.mdaRaw as string | null;
      const label = raw ?? 'Unknown MDA';
      mdaCountMap.set(label, (mdaCountMap.get(label) ?? 0) + 1);
    }
    setPerMdaCounts([...mdaCountMap.entries()].map(([mda, count]) => ({ mda, count })));

    setStep('success');
  };

  // ─── Derived data ──────────────────────────────────────────────────

  const records = preview?.records ?? [];
  const mdaStrings = [...new Set(
    records.map((r) => r.mdaRaw as string | null).filter(Boolean),
  )] as string[];

  const filteredExistingBatches = (existingBatches ?? []).filter(
    (b) => b.listType === defaultListType,
  );

  const allSteps = isTrack2
    ? [
        { key: 'batch', label: '1. Batch' },
        { key: 'upload', label: '2. Upload' },
        { key: 'preview', label: '3. Preview' },
        { key: 'mda-review', label: '4. MDA Review' },
        { key: 'three-vector', label: '5. Validation' },
        { key: 'match', label: '6. Match' },
        { key: 'confirm', label: '7. Confirm' },
      ]
    : [
        { key: 'batch', label: '1. Batch' },
        { key: 'upload', label: '2. Upload' },
        { key: 'preview', label: '3. Preview' },
        { key: 'mda-review', label: '4. MDA Review' },
        { key: 'confirm', label: '5. Confirm' },
      ];

  const isPending =
    confirmMutation.isPending || processMutation.isPending;

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <h2 className="text-lg font-semibold text-text-primary">
          Upload {defaultListType === 'APPROVAL' ? 'Approval' : 'Retiree/Deceased'} List
        </h2>
      </div>

      {/* Step indicator */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {allSteps.map((s, i) => (
          <span
            key={s.key}
            className={
              step === s.key || allSteps.findIndex((x) => x.key === step) > i
                ? 'font-medium text-teal'
                : 'text-text-muted'
            }
          >
            {i > 0 && <span className="mr-1">&rarr;</span>}
            {s.label}
          </span>
        ))}
      </div>

      {/* ── Batch step ─────────────────────────────────────────────── */}
      {step === 'batch' && (
        <div className="max-w-md space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={batchMode === 'create' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setBatchMode('create')}
            >
              Create New Batch
            </Button>
            {filteredExistingBatches.length > 0 && (
              <Button
                variant={batchMode === 'existing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setBatchMode('existing')}
              >
                Add to Existing Batch
              </Button>
            )}
          </div>

          {batchMode === 'create' ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Batch Label
                </label>
                <input
                  type="text"
                  value={batchLabel}
                  onChange={(e) => setBatchLabel(e.target.value)}
                  placeholder="e.g., 2024 Main Approval"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Year (optional)
                </label>
                <input
                  type="number"
                  value={batchYear}
                  onChange={(e) => setBatchYear(e.target.value)}
                  placeholder="e.g., 2024"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Notes (optional)
                </label>
                <textarea
                  value={batchNotes}
                  onChange={(e) => setBatchNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleCreateBatch}
                  disabled={!batchLabel || createBatchMutation.isPending}
                >
                  {createBatchMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Batch & Continue'
                  )}
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Select Existing Batch
                </label>
                <select
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) handleSelectExistingBatch(e.target.value);
                  }}
                >
                  <option value="" disabled>
                    Choose a batch...
                  </option>
                  {filteredExistingBatches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                      {b.year ? ` (${b.year})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      {/* ── Upload step ────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="max-w-lg space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 px-6 py-12 hover:border-teal"
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.xlsx,.xls';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileUpload(file);
              };
              input.click();
            }}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-teal" />
                <p className="mt-2 text-sm text-text-muted">Parsing file...</p>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-text-muted">
                  Click to upload Excel file (.xlsx)
                </p>
              </>
            )}
          </div>
          {uploadMutation.isError && (
            <p className="text-sm text-red-600">{uploadMutation.error.message}</p>
          )}
        </div>
      )}

      {/* ── Preview step (AC 3: first 10 rows) ────────────────────── */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="font-medium text-text-primary">Parse Preview</h3>
            <div className="mt-2 space-y-1 text-sm text-text-secondary">
              <p>
                Schema detected:{' '}
                <span className="font-medium">
                  {preview.schemaType === 'approval' ? 'Approval (5-column)' : 'Retiree (17-column)'}
                </span>
              </p>
              <p>Total records: {preview.records.length}</p>
              <p>
                Sheets:{' '}
                {preview.sheets
                  .map(
                    (s) =>
                      `${s.sheetName} (${s.skipped ? `skipped — ${s.skipReason}` : `${s.recordCount} rows`})`,
                  )
                  .join(', ')}
              </p>
            </div>
          </div>

          {/* First 10 rows table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Row</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">MDA</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">GL</th>
                  {preview.schemaType === 'approval' ? (
                    <th className="px-3 py-2 text-left font-medium text-text-secondary">Amount</th>
                  ) : (
                    <>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Principal</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Total Loan</th>
                      <th className="px-3 py-2 text-left font-medium text-text-secondary">Type</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.records.slice(0, 10).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-text-muted">{r.sourceRow as number}</td>
                    <td className="px-3 py-1.5 font-medium text-text-primary">
                      {r.name as string}
                    </td>
                    <td className="px-3 py-1.5">{(r.mdaRaw as string) ?? '—'}</td>
                    <td className="px-3 py-1.5">{(r.gradeLevel as string) ?? '—'}</td>
                    {preview.schemaType === 'approval' ? (
                      <td className="px-3 py-1.5">
                        {r.approvedAmount
                          ? Number(r.approvedAmount).toLocaleString()
                          : '—'}
                      </td>
                    ) : (
                      <>
                        <td className="px-3 py-1.5">
                          {r.principal
                            ? Number(r.principal).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          {r.totalLoan
                            ? Number(r.totalLoan).toLocaleString()
                            : '—'}
                        </td>
                        <td className="px-3 py-1.5">
                          <span
                            className={
                              r.listType === 'DECEASED'
                                ? 'text-red-600 font-medium'
                                : 'text-text-secondary'
                            }
                          >
                            {r.listType as string}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.records.length > 10 && (
              <p className="border-t bg-gray-50 px-3 py-2 text-xs text-text-muted">
                Showing first 10 of {preview.records.length} records
              </p>
            )}
          </div>

          {/* Data quality flags */}
          {preview.dataQualityFlags.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h4 className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Data Quality Notes (non-blocking)
              </h4>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                {preview.dataQualityFlags.map((f, i) => (
                  <li key={i}>
                    {f.row > 0 ? `Row ${f.row}: ` : ''}
                    {f.issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handlePreviewContinue}>Continue</Button>
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back
            </Button>
          </div>
        </div>
      )}

      {/* ── MDA Review step ────────────────────────────────────────── */}
      {step === 'mda-review' && (
        <MdaAliasReviewPanel
          rawMdaStrings={mdaStrings}
          onConfirm={handleMdaConfirm}
          onCancel={() => setStep('preview')}
        />
      )}

      {/* ── Track 2: Three-Vector Validation (Step 5) ──────────────── */}
      {step === 'three-vector' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="font-medium text-text-primary">Three-Vector Financial Validation</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Comparing Scheme Expected (P x 13.33% / 60) vs Committee Declared values
              for each retiree/deceased record.
            </p>
          </div>

          {threeVectorMutation.isPending ? (
            <div className="flex items-center gap-2 py-4 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running validation...
            </div>
          ) : validationResults.length > 0 ? (
            <>
              {/* Summary card */}
              <div className="grid grid-cols-3 gap-3">
                {(['clean', 'variance', 'requires_verification'] as const).map((cat) => {
                  const count = validationResults.filter((r) => r.category === cat).length;
                  const colors = {
                    clean: 'border-green-200 bg-green-50 text-green-800',
                    variance: 'border-amber-200 bg-amber-50 text-amber-800',
                    requires_verification: 'border-red-200 bg-red-50 text-red-800',
                  };
                  const labels = {
                    clean: 'Clean',
                    variance: 'Variance',
                    requires_verification: 'Requires Verification',
                  };
                  return (
                    <div key={cat} className={`rounded-lg border p-3 text-center ${colors[cat]}`}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs">{labels[cat]}</p>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep('match')}>Continue to Matching</Button>
                <Button variant="outline" onClick={() => setStep('mda-review')}>
                  Back
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-3">
              <Button onClick={handleRunValidation}>Run Validation</Button>
              <Button variant="outline" onClick={() => setStep('mda-review')}>
                Back
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Track 2: Match & Classify (Step 6) ─────────────────────── */}
      {step === 'match' && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="font-medium text-text-primary">Match & Classify</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Matching retiree/deceased records against existing loans by exact name + MDA.
              Full fuzzy matching will be available in Story 15.2.
            </p>
          </div>

          {matchMutation.isPending ? (
            <div className="flex items-center gap-2 py-4 text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Running match...
            </div>
          ) : matchResults.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center text-green-800">
                  <p className="text-2xl font-bold">
                    {matchResults.filter((r) => r.status === 'matched').length}
                  </p>
                  <p className="text-xs">Matched</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center text-amber-800">
                  <p className="text-2xl font-bold">
                    {matchResults.filter((r) => r.status === 'pending').length}
                  </p>
                  <p className="text-xs">Pending (matching engine not yet active)</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setStep('confirm')}>Continue to Confirm</Button>
                <Button variant="outline" onClick={() => setStep('three-vector')}>
                  Back
                </Button>
              </div>
            </>
          ) : (
            <div className="flex gap-3">
              <Button onClick={handleRunMatch}>Run Matching</Button>
              <Button variant="outline" onClick={() => setStep('three-vector')}>
                Back
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Confirm step ───────────────────────────────────────────── */}
      {step === 'confirm' && preview && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-white p-4">
            <h3 className="font-medium text-text-primary">Confirmation Summary</h3>
            <div className="mt-2 space-y-1 text-sm text-text-secondary">
              <p>Records: {records.length}</p>
              <p>
                Schema:{' '}
                {preview.schemaType === 'approval' ? 'Approval (5-column)' : 'Retiree (17-column)'}
              </p>
              <p>MDA mappings: {mdaMappings.size}</p>
              {isTrack2 && validationResults.length > 0 && (
                <p>
                  Validation: {validationResults.filter((r) => r.category === 'clean').length} clean,{' '}
                  {validationResults.filter((r) => r.category === 'variance').length} variance,{' '}
                  {validationResults.filter((r) => r.category === 'requires_verification').length}{' '}
                  requires verification
                </p>
              )}
            </div>
          </div>

          {/* Data quality flags */}
          {preview.dataQualityFlags.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h4 className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                Data Quality Notes (non-blocking)
              </h4>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
                {preview.dataQualityFlags.map((f, i) => (
                  <li key={i}>
                    {f.row > 0 ? `Row ${f.row}: ` : ''}
                    {f.issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                'Register Beneficiaries'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                setStep(isTrack2 ? 'match' : 'mda-review')
              }
            >
              Back
            </Button>
          </div>
        </div>
      )}

      {/* ── Success step (AC 5: per-MDA breakdown) ─────────────────── */}
      {step === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-6">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
            <h3 className="mt-3 text-lg font-semibold text-green-800">
              {confirmedCount} beneficiaries registered for &ldquo;{batchLabel}&rdquo;
            </h3>
          </div>

          {/* Per-MDA breakdown table */}
          {perMdaCounts.length > 0 && (
            <div className="mx-auto mt-4 max-w-sm">
              <h4 className="mb-2 text-sm font-medium text-green-800">Per-MDA Breakdown</h4>
              <div className="overflow-hidden rounded border border-green-200">
                <table className="w-full text-sm">
                  <thead className="bg-green-100">
                    <tr>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-green-800">
                        MDA
                      </th>
                      <th className="px-3 py-1.5 text-right text-xs font-medium text-green-800">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-green-100">
                    {perMdaCounts.map((row) => (
                      <tr key={row.mda}>
                        <td className="px-3 py-1.5 text-green-700">{row.mda}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-green-800">
                          {row.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {processMutation.data?.errors && processMutation.data.errors.length > 0 && (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <p className="font-medium">
                {processMutation.data.errors.length} record(s) had errors:
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {processMutation.data.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 text-center">
            <Button onClick={onComplete}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
