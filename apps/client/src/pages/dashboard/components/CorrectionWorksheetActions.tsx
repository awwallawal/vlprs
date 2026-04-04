import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { useDownloadWorksheet, useUploadWorksheet, useApplyWorksheet } from '@/hooks/useMigration';
import type { CorrectionWorksheetPreview } from '@vlprs/shared';

interface CorrectionWorksheetActionsProps {
  uploadId: string;
}

function WorksheetPreview({ preview, onApply, isApplying }: {
  preview: CorrectionWorksheetPreview;
  onApply: () => void;
  isApplying: boolean;
}) {
  return (
    <div className="bg-white border border-border rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-semibold text-text-primary">Correction Worksheet Preview</h4>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {preview.readyToApply > 0 && (
          <div className="bg-teal/5 border border-teal/20 rounded-lg p-2">
            <p className="text-lg font-bold text-teal">{preview.readyToApply}</p>
            <p className="text-xs text-text-muted">Corrections ready</p>
          </div>
        )}
        {preview.reviewedNoCorrection > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-lg font-bold text-blue-700">{preview.reviewedNoCorrection}</p>
            <p className="text-xs text-text-muted">Values confirmed correct</p>
          </div>
        )}
        {preview.skipped > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-2">
            <p className="text-lg font-bold text-text-secondary">{preview.skipped}</p>
            <p className="text-xs text-text-muted">Skipped (no reason)</p>
          </div>
        )}
        {preview.alreadyBaselined > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <p className="text-lg font-bold text-amber-700">{preview.alreadyBaselined}</p>
            <p className="text-xs text-text-muted">Already baselined</p>
          </div>
        )}
        {preview.conflicts > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
            <p className="text-lg font-bold text-amber-700">{preview.conflicts}</p>
            <p className="text-xs text-text-muted">Conflicts detected</p>
          </div>
        )}
      </div>

      {preview.conflicts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 font-medium mb-1">Conflict Details</p>
          {preview.records
            .filter((r) => r.category === 'conflict')
            .map((r) => (
              <p key={r.recordId} className="text-xs text-amber-700">
                {r.staffName}: {r.conflictDetail}
              </p>
            ))}
        </div>
      )}

      {(preview.readyToApply > 0 || preview.reviewedNoCorrection > 0) && (
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying}
          className="w-full px-4 py-2 text-sm bg-teal text-white rounded-lg hover:bg-teal/90 disabled:opacity-50"
        >
          {isApplying ? 'Applying...' : `Apply ${preview.readyToApply + preview.reviewedNoCorrection} Record${preview.readyToApply + preview.reviewedNoCorrection !== 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}

export function CorrectionWorksheetActions({ uploadId }: CorrectionWorksheetActionsProps) {
  const [preview, setPreview] = useState<CorrectionWorksheetPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadMutation = useDownloadWorksheet(uploadId);
  const uploadMutation = useUploadWorksheet(uploadId);
  const applyMutation = useApplyWorksheet(uploadId);

  const handleDownload = async () => {
    try {
      const blob = await downloadMutation.mutateAsync();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `correction-worksheet-${uploadId.slice(0, 8)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Correction worksheet downloaded');
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to download worksheet');
    }
  };

  const handleUpload = async (file: File) => {
    try {
      const result = await uploadMutation.mutateAsync({ file });
      setPreview(result);
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to parse worksheet');
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    try {
      const result = await applyMutation.mutateAsync(preview);
      toast.success(`Applied ${result.applied} correction${result.applied !== 1 ? 's' : ''}, ${result.reviewed} reviewed`);
      setPreview(null);
    } catch (e) {
      toast.error((e as Error).message ?? 'Failed to apply corrections');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloadMutation.isPending}
          className="px-3 py-1.5 text-xs border border-teal/30 text-teal rounded hover:bg-teal/5 disabled:opacity-50"
        >
          {downloadMutation.isPending ? 'Preparing...' : 'Download Correction Worksheet'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="px-3 py-1.5 text-xs border border-teal/30 text-teal rounded hover:bg-teal/5 disabled:opacity-50"
        >
          {uploadMutation.isPending ? 'Processing...' : 'Upload Completed Worksheet'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleUpload(file);
              e.target.value = '';
            }
          }}
        />
      </div>

      {preview && (
        <WorksheetPreview
          preview={preview}
          onApply={handleApply}
          isApplying={applyMutation.isPending}
        />
      )}
    </div>
  );
}
