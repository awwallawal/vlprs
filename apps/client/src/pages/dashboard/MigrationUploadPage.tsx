import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { ROLES } from '@vlprs/shared';
import { FileUploadZone } from '@/components/shared/FileUploadZone';
import { ColumnMappingReview } from './components/ColumnMappingReview';
import { MigrationUploadResult } from './components/MigrationUploadResult';
import { ValidationSummaryCard } from './components/ValidationSummaryCard';
import { RecordComparisonRow, RecordComparisonHeader } from './components/RecordComparisonRow';
import { StaffProfilePanel } from './components/StaffProfilePanel';
import { useUploadMigration, useConfirmMapping, useValidateUpload, useValidationResults, useMdaList, useCreateBaseline, useCreateBatchBaseline, useBaselineSummary, useCheckOverlap, useConfirmOverlap } from '@/hooks/useMigration';
import { BaselineConfirmationDialog } from './components/BaselineConfirmationDialog';
import { RecordDetailDrawer } from './components/RecordDetailDrawer';
import { BaselineResultSummary } from './components/BaselineResultSummary';
import { usePersonList, useMatchPersons } from '@/hooks/useStaffProfile';
import { usePageMeta } from '@/hooks/usePageMeta';
import { Badge } from '@/components/ui/badge';
import { FileDelineationPreview } from './components/FileDelineationPreview';
import { useTriggerDelineation, useConfirmDelineation } from '@/hooks/useDeduplication';
import type { MigrationUploadPreview, VarianceCategory, BatchBaselineResult, DelineationResult, MultiSheetOverlapResponse } from '@vlprs/shared';

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
    recordsPerSheet: Array<{ sheetName: string; count: number; era: number; periodYear: number | null; periodMonth: number | null }>;
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
  const [overlapWarning, setOverlapWarning] = useState<MultiSheetOverlapResponse | null>(null);
  const [pendingMappings, setPendingMappings] = useState<Array<{ sheetName: string; mappings: Array<{ sourceIndex: number; canonicalField: string | null }> }> | null>(null);
  const [showPeriodConfirm, setShowPeriodConfirm] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const uploadMutation = useUploadMigration();
  const confirmMutation = useConfirmMapping();
  const validateMutation = useValidateUpload();
  const checkOverlapMutation = useCheckOverlap();
  const confirmOverlapMutation = useConfirmOverlap();

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

  // MDA officer auto-fill: skip MDA selection step (Story 15.0f)
  const user = useAuthStore((s) => s.user);
  const isMdaOfficer = user?.role === ROLES.MDA_OFFICER;
  useEffect(() => {
    if (isMdaOfficer && user?.mdaId && mdaList && step === 'select-mda') {
      const officerMda = mdaList.find((m) => m.id === user.mdaId);
      if (officerMda) {
        setSelectedMdaId(officerMda.id);
        setSelectedMdaName(officerMda.name);
        setStep('upload');
      }
    }
  }, [isMdaOfficer, user?.mdaId, mdaList, step]);

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

  const proceedWithConfirm = useCallback(async (
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

  const handleConfirmMapping = useCallback(async (
    mappings: Array<{ sheetName: string; mappings: Array<{ sourceIndex: number; canonicalField: string | null }> }>,
  ) => {
    if (!preview || !selectedFile) return;

    // Store mappings for the period confirmation gate (Task 7)
    setPendingMappings(mappings);
    setShowPeriodConfirm(true);
  }, [preview, selectedFile]);

  const handlePeriodConfirm = useCallback(async () => {
    if (!preview || !pendingMappings) return;
    setShowPeriodConfirm(false);

    // Collect periods from ALL sheets (Story 8.0d)
    const sheetPeriods = preview.sheets
      .filter(s => s.period !== null)
      .map(s => ({ sheetName: s.sheetName, periodYear: s.period!.year, periodMonth: s.period!.month }));

    // Build skippedSheets from sheets with no detected period (Story 8.0d — AC 7)
    const sheetsWithNoPeriod = preview.sheets
      .filter(s => s.period === null)
      .map(s => ({ sheetName: s.sheetName, reason: 'Period not detected' }));

    if (sheetPeriods.length > 0) {
      try {
        const overlapResult = await checkOverlapMutation.mutateAsync({
          uploadId: preview.uploadId,
          sheetPeriods,
        });

        if (overlapResult.hasOverlap) {
          setOverlapWarning({
            ...overlapResult,
            skippedSheets: [...overlapResult.skippedSheets, ...sheetsWithNoPeriod],
          });
          return; // Show overlap dialog instead of proceeding
        }
      } catch {
        // Overlap check failed — re-show period confirmation so user can retry or cancel
        setShowPeriodConfirm(true);
        return;
      }
    }

    await proceedWithConfirm(pendingMappings);
    setPendingMappings(null);
  }, [preview, pendingMappings, checkOverlapMutation, proceedWithConfirm]);

  const handlePeriodCancel = useCallback(() => {
    setShowPeriodConfirm(false);
    setPendingMappings(null);
  }, []);

  const handleOverlapConfirm = useCallback(async () => {
    if (!preview || !pendingMappings) return;
    try {
      await confirmOverlapMutation.mutateAsync({ uploadId: preview.uploadId });
      setOverlapWarning(null);
      await proceedWithConfirm(pendingMappings);
      setPendingMappings(null);
    } catch {
      // Error handled by mutation state
    }
  }, [preview, pendingMappings, confirmOverlapMutation, proceedWithConfirm]);

  const handleOverlapCancel = useCallback(() => {
    setOverlapWarning(null);
    setPendingMappings(null);
  }, []);

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

  const handleRowClick = useCallback((recordId: string) => {
    setSelectedRecordId(recordId);
    setDrawerOpen(true);
  }, []);

  const handleReset = useCallback(() => {
    if (isMdaOfficer) {
      // MDA officers stay on their MDA — just reset the upload state
      setStep('upload');
    } else {
      setStep('select-mda');
      setSelectedMdaId('');
      setSelectedMdaName('');
    }
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
    setOverlapWarning(null);
    setPendingMappings(null);
    setShowPeriodConfirm(false);
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
          ...(!isMdaOfficer ? [{ key: 'select-mda', label: '1. Select MDA', active: ['select-mda'] as Step[] }] : []),
          { key: 'upload', label: `${isMdaOfficer ? '1' : '2'}. Upload File`, active: ['upload'] as Step[] },
          { key: 'review', label: `${isMdaOfficer ? '2' : '3'}. Review Mapping`, active: ['review'] as Step[] },
          { key: 'complete', label: `${isMdaOfficer ? '3' : '4'}. Extract`, active: ['processing', 'complete'] as Step[] },
          { key: 'delineation', label: `${isMdaOfficer ? '4' : '5'}. Delineation`, active: ['delineation'] as Step[] },
          { key: 'validated', label: `${isMdaOfficer ? '5' : '6'}. Comparison`, active: ['validating', 'validated'] as Step[] },
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

      {/* Period Confirmation Gate (Story 8.0d — Task 7) */}
      {showPeriodConfirm && preview && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Confirm Detected Periods</h3>
            <p className="text-sm text-text-secondary">
              Please verify the detected period for each sheet before processing:
            </p>
            <div className="space-y-2">
              {preview.sheets.map(sheet => (
                <div key={sheet.sheetName} className="flex items-center gap-2 text-sm">
                  {sheet.period ? (
                    <>
                      <span className="text-teal">&#10003;</span>
                      <span className="text-text-primary">
                        Sheet &lsquo;{sheet.sheetName}&rsquo;: <span className="font-semibold">
                          {new Date(sheet.period.year, sheet.period.month - 1).toLocaleString('en', { month: 'long' })} {sheet.period.year}
                        </span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-text-muted">&#9675;</span>
                      <span className="text-text-muted">
                        Sheet &lsquo;{sheet.sheetName}&rsquo;: period not detected
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
            {checkOverlapMutation.isError && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Overlap check could not be completed. Please try again or cancel.
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handlePeriodCancel}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel &mdash; periods are wrong
              </button>
              <button
                type="button"
                onClick={handlePeriodConfirm}
                disabled={checkOverlapMutation.isPending}
                className="px-4 py-2 text-sm bg-teal text-white rounded-lg hover:bg-teal-hover transition-colors disabled:opacity-50"
              >
                {checkOverlapMutation.isPending ? 'Checking...' : 'Confirm Periods & Process'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Period Overlap Warning Dialog (Story 8.0d — multi-sheet) */}
      {overlapWarning && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg border border-border shadow-xl max-w-lg w-full mx-4 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-text-primary">Period Overlap Detected</h3>
            <p className="text-sm text-text-secondary">
              The following sheets conflict with existing uploads:
            </p>
            <div className="space-y-2">
              {overlapWarning.results.map(r => (
                <div key={`${r.periodYear}-${r.periodMonth}`} className="text-sm">
                  {r.overlap ? (
                    <div className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">&#9888;</span>
                      <div>
                        <p className="text-text-primary">
                          <span className="font-medium">{r.sheetNames.map(n => `'${n}'`).join(', ')}</span> &mdash; {r.periodLabel}
                        </p>
                        <p className="text-xs text-text-muted">
                          Overlaps with: {r.existingFilename ?? 'existing upload'} ({r.existingRecordCount} existing records)
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-teal">&#10003;</span>
                      <span className="text-text-secondary">
                        {r.sheetNames.map(n => `'${n}'`).join(', ')} &mdash; {r.periodLabel}: No existing data for this period
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {overlapWarning.skippedSheets.map(s => (
                <div key={s.sheetName} className="flex items-center gap-2 text-sm">
                  <span className="text-text-muted">&#9675;</span>
                  <span className="text-text-muted">
                    Sheet &lsquo;{s.sheetName}&rsquo;: period not detected &mdash; overlap check skipped
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted">
              Proceeding will add new records alongside existing data for the overlapping periods.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleOverlapCancel}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOverlapConfirm}
                disabled={confirmOverlapMutation.isPending}
                className="px-4 py-2 text-sm bg-teal text-white rounded-lg hover:bg-teal-hover transition-colors disabled:opacity-50"
              >
                {confirmOverlapMutation.isPending ? 'Confirming...' : 'Confirm and Proceed'}
              </button>
            </div>
          </div>
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
              onViewRecord={handleRowClick}
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
                <RecordComparisonHeader
                  showBaseline={!baselineResult && (!baselineSummary.data || baselineSummary.data.status !== 'complete')}
                />
                <tbody>
                  {validationResults.data.records.map((record) => (
                    <RecordComparisonRow
                      key={record.recordId}
                      record={record}
                      onBaseline={!baselineResult && (!baselineSummary.data || baselineSummary.data.status !== 'complete')
                        ? handleSingleBaseline : undefined}
                      isBaselineLoading={baselineInProgressId === record.recordId}
                      isBaselineCreated={baselinedRecordIds.has(record.recordId)}
                      onRowClick={handleRowClick}
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

      {/* Record Detail Drawer (Story 8.0b) */}
      {preview?.uploadId && (
        <RecordDetailDrawer
          uploadId={preview.uploadId}
          recordId={selectedRecordId}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}
    </div>
  );
}

export { MigrationUploadPage as Component };
