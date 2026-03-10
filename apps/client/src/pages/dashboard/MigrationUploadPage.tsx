import { useState, useCallback } from 'react';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { ColumnMappingReview } from './components/ColumnMappingReview';
import { MigrationUploadResult } from './components/MigrationUploadResult';
import { ValidationSummaryCard } from './components/ValidationSummaryCard';
import { RecordComparisonRow } from './components/RecordComparisonRow';
import { StaffProfilePanel } from './components/StaffProfilePanel';
import { useUploadMigration, useConfirmMapping, useValidateUpload, useValidationResults, useMdaList, useCreateBaseline, useCreateBatchBaseline, useBaselineSummary } from '@/hooks/useMigration';
import { BaselineConfirmationDialog } from './components/BaselineConfirmationDialog';
import { BaselineResultSummary } from './components/BaselineResultSummary';
import { usePersonList, useMatchPersons } from '@/hooks/useStaffProfile';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Badge } from '@/components/ui/badge';
import { FileDelineationPreview } from './components/FileDelineationPreview';
import { useTriggerDelineation, useConfirmDelineation } from '@/hooks/useDeduplication';
import type { MigrationUploadPreview, VarianceCategory, BatchBaselineResult, DelineationResult } from '@vlprs/shared';

type Step = 'select-mda' | 'upload' | 'review' | 'processing' | 'complete' | 'delineation' | 'validating' | 'validated';
type Tab = 'upload' | 'profiles';

export function MigrationUploadPage() {
  usePageMeta({ title: 'Legacy Migration', description: 'Upload legacy MDA spreadsheets for data migration' });

  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [selectedPersonKey, setSelectedPersonKey] = useState<string | null>(null);
  const [personPage, setPersonPage] = useState(1);
  const [step, setStep] = useState<Step>('select-mda');
  const [selectedMdaId, setSelectedMdaId] = useState('');
  const [selectedMdaName, setSelectedMdaName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<MigrationUploadPreview | null>(null);
  const [result, setResult] = useState<{
    totalRecords: number;
    recordsPerSheet: Array<{ sheetName: string; count: number; era: number }>;
    skippedRows?: Array<{ row: number; sheet: string; reason: string }>;
  } | null>(null);
  const [isAgricultureSelected, setIsAgricultureSelected] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<VarianceCategory | undefined>();
  const [validationPage, setValidationPage] = useState(1);
  const [showBaselineConfirm, setShowBaselineConfirm] = useState(false);
  const [baselineResult, setBaselineResult] = useState<BatchBaselineResult | null>(null);
  const [baselinedRecordIds, setBaselinedRecordIds] = useState<Set<string>>(new Set());
  const [baselineInProgressId, setBaselineInProgressId] = useState<string | null>(null);
  const [delineationResult, setDelineationResult] = useState<DelineationResult | null>(null);

  const uploadMutation = useUploadMigration();
  const confirmMutation = useConfirmMapping();
  const validateMutation = useValidateUpload();

  const validationResults = useValidationResults(
    preview?.uploadId ?? '',
    { page: validationPage, limit: 50, category: categoryFilter },
  );

  const singleBaselineMutation = useCreateBaseline(preview?.uploadId ?? '');
  const batchBaselineMutation = useCreateBatchBaseline(preview?.uploadId ?? '');
  const baselineSummary = useBaselineSummary(preview?.uploadId ?? '');
  const delineationMutation = useTriggerDelineation(preview?.uploadId ?? '');
  const confirmDelineationMutation = useConfirmDelineation(preview?.uploadId ?? '');
  const { data: mdaList, isLoading: mdaLoading } = useMdaList();
  const personList = usePersonList({ page: personPage, limit: 20 });
  const matchPersonsMutation = useMatchPersons();

  const handleMdaSelect = useCallback((mdaId: string, mdaName: string) => {
    setSelectedMdaId(mdaId);
    setSelectedMdaName(mdaName);
    setIsAgricultureSelected(mdaName.toLowerCase().includes('agriculture'));
    setStep('upload');
  }, []);

  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file);
    try {
      const data = await uploadMutation.mutateAsync({ file, mdaId: selectedMdaId });
      setPreview(data);
      setStep('review');
    } catch {
      // Error is handled by mutation state
    }
  }, [selectedMdaId, uploadMutation]);

  const handleConfirmMapping = useCallback(async (
    mappings: Array<{ sheetName: string; mappings: Array<{ sourceIndex: number; canonicalField: string | null }> }>,
  ) => {
    if (!preview || !selectedFile) return;
    setStep('processing');

    try {
      const data = await confirmMutation.mutateAsync({
        uploadId: preview.uploadId,
        file: selectedFile,
        mdaId: selectedMdaId,
        sheets: mappings,
      });
      setResult(data);
      setStep('complete');
      // Auto-trigger delineation detection
      try {
        const delineation = await delineationMutation.mutateAsync();
        setDelineationResult(delineation);
        if (delineation.delineated) {
          setStep('delineation');
          return;
        }
      } catch {
        // Delineation is optional — if it fails, proceed normally
      }
    } catch {
      setStep('review');
    }
  }, [preview, selectedFile, selectedMdaId, confirmMutation, delineationMutation]);

  const handleValidate = useCallback(async () => {
    if (!preview) return;
    setStep('validating');
    try {
      await validateMutation.mutateAsync({ uploadId: preview.uploadId });
      setStep('validated');
    } catch {
      setStep('complete');
    }
  }, [preview, validateMutation]);

  const handleCategoryFilter = useCallback((category: string | undefined) => {
    setCategoryFilter(category as VarianceCategory | undefined);
    setValidationPage(1);
  }, []);

  const handleBatchBaseline = useCallback(async () => {
    try {
      const data = await batchBaselineMutation.mutateAsync();
      setBaselineResult(data);
      setShowBaselineConfirm(false);
    } catch {
      // Error is handled by mutation state
    }
  }, [batchBaselineMutation]);

  const handleSingleBaseline = useCallback(async (recordId: string) => {
    setBaselineInProgressId(recordId);
    try {
      await singleBaselineMutation.mutateAsync({ recordId });
      setBaselinedRecordIds(prev => new Set(prev).add(recordId));
    } catch {
      // Error handled by mutation state
    } finally {
      setBaselineInProgressId(null);
    }
  }, [singleBaselineMutation]);

  const handleReset = useCallback(() => {
    setStep('select-mda');
    setSelectedMdaId('');
    setSelectedMdaName('');
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setIsAgricultureSelected(false);
    setCategoryFilter(undefined);
    setValidationPage(1);
    setShowBaselineConfirm(false);
    setBaselineResult(null);
    setBaselinedRecordIds(new Set());
    setBaselineInProgressId(null);
    setDelineationResult(null);
  }, []);

  const handleConfirmDelineation = useCallback(async (
    sections: Array<{ sectionIndex: number; mdaId: string }>,
  ) => {
    if (!preview) return;
    try {
      await confirmDelineationMutation.mutateAsync({ sections });
      setStep('complete');
    } catch {
      // Error handled by mutation state
    }
  }, [preview, confirmDelineationMutation]);

  const handleRejectDelineation = useCallback(() => {
    // Reject = skip delineation, proceed to validation as-is
    setStep('complete');
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Legacy Migration</h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload legacy MDA spreadsheets and explore staff profiles
          </p>
        </div>
        {activeTab === 'upload' && step !== 'select-mda' && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-teal hover:text-teal-hover underline"
          >
            Start New Upload
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'upload'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Upload & Comparison
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('profiles'); setSelectedPersonKey(null); }}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profiles'
              ? 'border-teal text-teal'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          Staff Profiles
        </button>
      </div>

      {/* Staff Profiles Tab */}
      {activeTab === 'profiles' && !selectedPersonKey && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-secondary">
              Person-level view of staff loan history across all MDAs
            </p>
            <button
              type="button"
              onClick={() => matchPersonsMutation.mutate()}
              disabled={matchPersonsMutation.isPending}
              className="px-4 py-2 text-xs bg-teal text-white rounded-lg hover:bg-teal-hover disabled:opacity-50"
            >
              {matchPersonsMutation.isPending ? 'Matching...' : 'Run Person Matching'}
            </button>
          </div>

          {matchPersonsMutation.isSuccess && matchPersonsMutation.data && (
            <div className="bg-teal/5 border border-teal/20 rounded-lg p-3 text-xs text-teal">
              Matching complete: {matchPersonsMutation.data.totalPersons} persons found,{' '}
              {matchPersonsMutation.data.multiMdaPersons} multi-MDA,{' '}
              {matchPersonsMutation.data.autoMatched} auto-matched,{' '}
              {matchPersonsMutation.data.pendingReview} pending review
            </div>
          )}

          {personList.isLoading ? (
            <div className="text-sm text-text-muted py-8 text-center">Loading staff profiles...</div>
          ) : personList.data && personList.data.data.length > 0 ? (
            <div className="bg-white rounded-lg border border-border overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Staff Name</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">MDAs</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Records</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Variances</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {personList.data.data.map((person) => (
                    <tr
                      key={person.personKey}
                      className="border-b border-border/50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedPersonKey(person.personKey)}
                    >
                      <td className="py-2 px-3 text-sm text-text-primary">
                        {person.staffName}
                        {person.staffId && (
                          <span className="ml-2 text-xs text-text-muted">({person.staffId})</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex flex-wrap gap-1">
                          {person.mdas.map((mda) => (
                            <Badge key={mda} variant="outline" className="text-[10px]">{mda}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-sm text-right text-text-secondary">{person.recordCount}</td>
                      <td className="py-2 px-3 text-sm text-right">
                        {person.varianceCount > 0 ? (
                          <span className="text-amber-600">{person.varianceCount}</span>
                        ) : (
                          <span className="text-text-muted">0</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {person.profileComplete ? (
                          <Badge className="text-[10px] bg-teal/10 text-teal border-teal/20">Complete</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Incomplete</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {personList.data.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-text-muted">
                    Page {personList.data.pagination.page} of {personList.data.pagination.totalPages}
                    {' '}({personList.data.pagination.total} persons)
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPersonPage((p) => Math.max(1, p - 1))}
                      disabled={personList.data.pagination.page <= 1}
                      className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => setPersonPage((p) => p + 1)}
                      disabled={personList.data.pagination.page >= personList.data.pagination.totalPages}
                      className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-text-muted">
              No staff profiles yet. Upload and validate migration files first, then run person matching.
            </div>
          )}
        </div>
      )}

      {/* Staff Profile Detail */}
      {activeTab === 'profiles' && selectedPersonKey && (
        <StaffProfilePanel
          personKey={selectedPersonKey}
          onBack={() => setSelectedPersonKey(null)}
        />
      )}

      {/* Upload Tab Content */}
      {activeTab === 'upload' && <>
      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        {([
          { key: 'select-mda', label: '1. Select MDA', active: ['select-mda'] as Step[] },
          { key: 'upload', label: '2. Upload File', active: ['upload'] as Step[] },
          { key: 'review', label: '3. Review Mapping', active: ['review'] as Step[] },
          { key: 'complete', label: '4. Extract', active: ['processing', 'complete'] as Step[] },
          { key: 'delineation', label: '5. Delineation', active: ['delineation'] as Step[] },
          { key: 'validated', label: '6. Comparison', active: ['validating', 'validated'] as Step[] },
        ]).map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <span className="text-border">/</span>}
            <span className={s.active.includes(step) ? 'text-teal font-semibold' : ''}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: MDA Selection */}
      {step === 'select-mda' && (
        <div className="bg-white rounded-lg border border-border p-6">
          <h2 className="text-sm font-semibold text-text-primary mb-4">Select Target MDA</h2>
          {mdaLoading ? (
            <p className="text-sm text-text-muted">Loading MDAs...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {mdaList?.filter(mda => !mda.parentMdaId).map(mda => (
                <div key={mda.id}>
                  <button
                    type="button"
                    onClick={() => handleMdaSelect(mda.id, mda.name)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-teal hover:bg-teal/5 transition-colors"
                  >
                    <p className="text-sm font-medium text-text-primary">{mda.name}</p>
                    <p className="text-xs text-text-muted">{mda.code}</p>
                  </button>
                  {mdaList.filter(sub => sub.parentMdaId === mda.id).map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => handleMdaSelect(sub.id, sub.name)}
                      className="w-full text-left pl-8 pr-4 py-2 mt-1 rounded-lg border border-border/50 hover:border-teal hover:bg-teal/5 transition-colors"
                    >
                      <p className="text-sm text-text-primary">{sub.name}</p>
                      <p className="text-xs text-text-muted">{sub.code} (sub-agency)</p>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Agriculture sub-agency notice */}
      {isAgricultureSelected && step === 'upload' && (
        <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
          <p className="text-sm text-text-primary">
            <span className="font-medium">Note:</span> Agriculture files may contain embedded records for sub-agencies
            (e.g., CDU — Cocoa Development Unit). These will be detected during the delineation phase.
          </p>
        </div>
      )}

      {/* Step 2: File Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{selectedMdaName}</span>
          </div>
          <FileUploadZone
            accept=".xlsx,.csv,.xls"
            maxSizeMb={10}
            onFileSelect={handleFileSelect}
            status={uploadMutation.isPending ? 'uploading' : uploadMutation.isError ? 'error' : 'idle'}
            errorMessage={uploadMutation.error?.message}
          />
        </div>
      )}

      {/* Step 3: Column Mapping Review */}
      {step === 'review' && preview && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{selectedMdaName}</span>
            <span>&middot;</span>
            <span>{preview.filename}</span>
            <span>&middot;</span>
            <span>{preview.sheets.length} sheet(s)</span>
          </div>
          <ColumnMappingReview
            sheets={preview.sheets}
            onConfirm={handleConfirmMapping}
            isLoading={confirmMutation.isPending}
          />
          {confirmMutation.isError && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
              <p className="text-sm text-text-primary">{confirmMutation.error?.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 3.5: Processing */}
      {step === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-8 w-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Extracting records...</p>
        </div>
      )}

      {/* Step 4: Complete */}
      {step === 'complete' && result && (
        <div className="space-y-4">
          <MigrationUploadResult
            totalRecords={result.totalRecords}
            recordsPerSheet={result.recordsPerSheet}
            filename={preview?.filename || ''}
            mdaName={selectedMdaName}
            skippedRows={result.skippedRows}
            timestamp={new Date().toISOString()}
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleValidate}
              disabled={validateMutation.isPending}
              className="px-6 py-2 bg-teal text-white rounded-lg hover:bg-teal-hover transition-colors disabled:opacity-50"
            >
              Run Comparison
            </button>
          </div>
          {validateMutation.isError && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
              <p className="text-sm text-text-primary">{validateMutation.error?.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 5: Delineation */}
      {step === 'delineation' && delineationResult && (
        <div className="space-y-4">
          <FileDelineationPreview
            delineationResult={delineationResult}
            mdaList={mdaList ?? []}
            isLoading={false}
            isConfirming={confirmDelineationMutation.isPending}
            onConfirm={handleConfirmDelineation}
            onReject={handleRejectDelineation}
          />
          {confirmDelineationMutation.isError && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
              <p className="text-sm text-text-primary">{confirmDelineationMutation.error?.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Step 5.5: Validating */}
      {step === 'validating' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-8 w-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Running comparison...</p>
        </div>
      )}

      {/* Baseline Confirmation Dialog */}
      {showBaselineConfirm && validationResults.data && (
        <BaselineConfirmationDialog
          recordCount={
            validationResults.data.summary.clean +
            validationResults.data.summary.minorVariance +
            validationResults.data.summary.significantVariance +
            validationResults.data.summary.structuralError +
            validationResults.data.summary.anomalous
          }
          byCategory={{
            ...(validationResults.data.summary.clean > 0 ? { clean: validationResults.data.summary.clean } : {}),
            ...(validationResults.data.summary.minorVariance > 0 ? { minor_variance: validationResults.data.summary.minorVariance } : {}),
            ...(validationResults.data.summary.significantVariance > 0 ? { significant_variance: validationResults.data.summary.significantVariance } : {}),
            ...(validationResults.data.summary.structuralError > 0 ? { structural_error: validationResults.data.summary.structuralError } : {}),
            ...(validationResults.data.summary.anomalous > 0 ? { anomalous: validationResults.data.summary.anomalous } : {}),
          }}
          isLoading={batchBaselineMutation.isPending}
          onConfirm={handleBatchBaseline}
          onCancel={() => setShowBaselineConfirm(false)}
        />
      )}

      {/* Step 6: Validated */}
      {step === 'validated' && validationResults.data && (
        <div className="space-y-4">
          {baselineResult && (
            <BaselineResultSummary
              result={baselineResult}
              onViewLoans={() => window.location.assign('/dashboard/loans')}
            />
          )}

          {!baselineResult && baselineSummary.data && baselineSummary.data.status === 'complete' && (
            <div className="bg-teal/5 border border-teal/20 rounded-lg p-4 text-sm text-teal">
              All baselines established — {baselineSummary.data.baselinesCreated} loan records created.
            </div>
          )}

          <ValidationSummaryCard
            summary={validationResults.data.summary}
            multiMda={validationResults.data.multiMda}
            onCategoryFilter={handleCategoryFilter}
            activeCategory={categoryFilter}
          />

          {!baselineResult && (!baselineSummary.data || baselineSummary.data.status !== 'complete') && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowBaselineConfirm(true)}
                disabled={batchBaselineMutation.isPending}
                className="px-6 py-2 bg-teal text-white rounded-lg hover:bg-teal-hover transition-colors disabled:opacity-50"
              >
                Accept All as Declared — Establish Baselines
              </button>
            </div>
          )}

          {batchBaselineMutation.isError && (
            <div className="bg-gold/10 border border-gold/30 rounded-lg p-4">
              <p className="text-sm text-text-primary">{batchBaselineMutation.error?.message}</p>
            </div>
          )}

          <div className="bg-white rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-border">
                  <tr>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Staff Name</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase">Category</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Variance</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Declared Total</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Computed Total</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Declared Deduction</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Computed Deduction</th>
                    <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Rate</th>
                    {!baselineResult && (!baselineSummary.data || baselineSummary.data.status !== 'complete') && (
                      <th className="py-2 px-3 text-xs font-semibold text-text-muted uppercase text-right">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {validationResults.data.records.map((record) => (
                    <RecordComparisonRow
                      key={record.recordId}
                      record={record}
                      onBaseline={!baselineResult && (!baselineSummary.data || baselineSummary.data.status !== 'complete')
                        ? handleSingleBaseline : undefined}
                      isBaselineLoading={baselineInProgressId === record.recordId}
                      isBaselineCreated={baselinedRecordIds.has(record.recordId)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {validationResults.data.pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-xs text-text-muted">
                  Page {validationResults.data.pagination.page} of {validationResults.data.pagination.totalPages}
                  {' '}({validationResults.data.pagination.total} records)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setValidationPage(p => Math.max(1, p - 1))}
                    disabled={validationResults.data.pagination.page <= 1}
                    className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationPage(p => p + 1)}
                    disabled={validationResults.data.pagination.page >= validationResults.data.pagination.totalPages}
                    className="px-3 py-1 text-xs border border-border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

export { MigrationUploadPage as Component };
