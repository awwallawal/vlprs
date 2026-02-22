import { useRef, useCallback, useState } from 'react';
import { Upload, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UI_COPY } from '@vlprs/shared';

interface FileUploadZoneProps {
  accept?: string;
  maxSizeMb?: number;
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  templateDownloadUrl?: string;
  status?: 'idle' | 'uploading' | 'success' | 'error';
  fileName?: string;
  errorMessage?: string;
  progress?: number;
  className?: string;
}

export function FileUploadZone({
  accept = '.csv',
  maxSizeMb = 5,
  onFileSelect,
  onFileRemove,
  templateDownloadUrl,
  status = 'idle',
  fileName,
  errorMessage,
  progress,
  className,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const effectiveStatus = isDragOver && status === 'idle' ? 'dragover' : status;

  return (
    <div
      className={cn(
        'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors lg:max-w-[600px] lg:mx-auto',
        effectiveStatus === 'idle' && 'border-border hover:border-teal/50',
        effectiveStatus === 'dragover' && 'border-teal bg-teal-50',
        effectiveStatus === 'success' && 'border-success/30 bg-green-50',
        effectiveStatus === 'error' && 'border-gold bg-attention-bg',
        effectiveStatus === 'uploading' && 'border-teal/50',
        className,
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Upload CSV file. Drag and drop or click to browse."
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {status === 'success' ? (
        <div className="flex flex-col items-center gap-2">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="text-sm font-medium text-text-primary">{fileName}</p>
          {onFileRemove && (
            <button
              type="button"
              className="text-xs text-text-secondary underline hover:text-text-primary"
              onClick={(e) => {
                e.stopPropagation();
                onFileRemove();
              }}
            >
              Remove file
            </button>
          )}
        </div>
      ) : status === 'error' ? (
        <div className="flex flex-col items-center gap-2">
          <Info className="h-8 w-8 text-gold" />
          <p className="text-sm font-medium text-text-primary">{UI_COPY.UPLOAD_ERROR_HEADER}</p>
          {errorMessage && <p className="text-xs text-text-secondary">{errorMessage}</p>}
        </div>
      ) : status === 'uploading' ? (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-teal animate-pulse" />
          <p className="text-sm text-text-secondary">Uploading...</p>
          {progress !== undefined && (
            <div className="w-48 h-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-teal rounded-full transition-all"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-8 w-8 text-teal" />
          <p className="text-sm text-text-primary font-medium hidden md:block">
            Drag and drop your CSV file here, or click to browse
          </p>
          <p className="text-sm text-text-primary font-medium md:hidden">
            Tap to browse files
          </p>
          <p className="text-xs text-text-muted">
            {accept} files up to {maxSizeMb}MB
          </p>
        </div>
      )}

      {templateDownloadUrl && status !== 'success' && (
        <a
          href={templateDownloadUrl}
          className="mt-3 inline-block text-xs text-teal underline hover:text-teal-hover"
          onClick={(e) => e.stopPropagation()}
        >
          Download template
        </a>
      )}
    </div>
  );
}
