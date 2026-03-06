import { useState, useCallback } from 'react';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { ColumnMappingReview } from './components/ColumnMappingReview';
import { MigrationUploadResult } from './components/MigrationUploadResult';
import { ValidationSummaryCard } from './components/ValidationSummaryCard';
import { RecordComparisonRow } from './components/RecordComparisonRow';
import { useUploadMigration, useConfirmMapping, useValidateUpload, useValidationResults, useMdaList } from '@/hooks/useMigration';
import { usePageMeta } from '@/hooks/usePageMeta';
import type { MigrationUploadPreview, VarianceCategory } from '@vlprs/shared';

type Step = 'select-mda' | 'upload' | 'review' | 'processing' | 'complete' | 'validating' | 'validated';

export function MigrationPage() {
  usePageMeta({ title: 'Legacy Migration', description: 'Upload legacy MDA spreadsheets for data migration' });

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

  const uploadMutation = useUploadMigration();
  const confirmMutation = useConfirmMapping();
  const validateMutation = useValidateUpload();

  const validationResults = useValidationResults(
    preview?.uploadId ?? '',
    { page: validationPage, limit: 50, category: categoryFilter },
  );

  const { data: mdaList, isLoading: mdaLoading } = useMdaList();

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
    } catch {
      setStep('review');
    }
  }, [preview, selectedFile, selectedMdaId, confirmMutation]);

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
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Legacy Migration Upload</h1>
          <p className="text-sm text-text-secondary mt-1">
            Upload legacy MDA spreadsheets for intelligent column mapping and record extraction
          </p>
        </div>
        {step !== 'select-mda' && (
          <button
            type="button"
            onClick={handleReset}
            className="text-sm text-teal hover:text-teal-hover underline"
          >
            Start New Upload
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        {([
          { key: 'select-mda', label: '1. Select MDA', active: ['select-mda'] as Step[] },
          { key: 'upload', label: '2. Upload File', active: ['upload'] as Step[] },
          { key: 'review', label: '3. Review Mapping', active: ['review'] as Step[] },
          { key: 'complete', label: '4. Extract', active: ['processing', 'complete'] as Step[] },
          { key: 'validated', label: '5. Comparison', active: ['validating', 'validated'] as Step[] },
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
                  {/* Show sub-agencies indented below parent */}
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
            (e.g., CDU — Cocoa Development Unit). These will be detected during the delineation phase (Story 3.8).
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

      {/* Step 4: Complete — show extraction result + validate button */}
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

      {/* Step 4.5: Validating */}
      {step === 'validating' && (
        <div className="flex flex-col items-center gap-4 py-12">
          <div className="h-8 w-8 border-2 border-teal border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-text-secondary">Running comparison...</p>
        </div>
      )}

      {/* Step 5: Validated — show comparison results */}
      {step === 'validated' && validationResults.data && (
        <div className="space-y-4">
          <ValidationSummaryCard
            summary={validationResults.data.summary}
            multiMda={validationResults.data.multiMda}
            onCategoryFilter={handleCategoryFilter}
            activeCategory={categoryFilter}
          />

          {/* Records table */}
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
                  </tr>
                </thead>
                <tbody>
                  {validationResults.data.records.map((record) => (
                    <RecordComparisonRow key={record.recordId} record={record} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
    </div>
  );
}

export { MigrationPage as Component };
