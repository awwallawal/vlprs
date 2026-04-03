import { CheckCircle2, FileSpreadsheet, Layers } from 'lucide-react';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface MigrationUploadResultProps {
  totalRecords: number;
  recordsPerSheet: Array<{ sheetName: string; count: number; era: number; periodYear: number | null; periodMonth: number | null }>;
  filename: string;
  mdaName?: string;
  skippedRows?: Array<{ row: number; sheet: string; reason: string }>;
  timestamp?: string;
}

export function MigrationUploadResult({
  totalRecords,
  recordsPerSheet,
  filename,
  mdaName,
  skippedRows,
  timestamp,
}: MigrationUploadResultProps) {
  return (
    <div className="rounded-lg border border-success/30 bg-green-50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-success flex-shrink-0" />
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Upload Complete</h3>
          <p className="text-sm text-text-secondary">Records extracted and stored successfully</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-3 border border-border">
          <p className="text-xs text-text-muted uppercase tracking-wide">Total Records</p>
          <p className="text-2xl font-bold text-teal mt-1">{totalRecords.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-border">
          <p className="text-xs text-text-muted uppercase tracking-wide">Sheets Processed</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{recordsPerSheet.length}</p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-border">
          <p className="text-xs text-text-muted uppercase tracking-wide">Era Detected</p>
          <p className="text-2xl font-bold text-text-primary mt-1">
            {[...new Set(recordsPerSheet.map(s => s.era))].sort().join(', ')}
          </p>
        </div>
        <div className="bg-white rounded-lg p-3 border border-border">
          <p className="text-xs text-text-muted uppercase tracking-wide">Skipped Rows</p>
          <p className="text-2xl font-bold text-text-secondary mt-1">{skippedRows?.length ?? 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileSpreadsheet className="h-4 w-4 text-text-secondary" />
          <span className="text-sm font-medium text-text-primary">{filename}</span>
          {mdaName && <span className="text-xs text-text-muted">({mdaName})</span>}
        </div>

        <div className="space-y-1">
          {recordsPerSheet.map(sheet => (
            <div key={sheet.sheetName} className="flex items-center gap-2 text-sm">
              <Layers className="h-3 w-3 text-text-muted" />
              <span className="text-text-secondary">{sheet.sheetName}</span>
              <span className="text-text-muted">&middot;</span>
              <span className="text-text-primary font-medium">{sheet.count} records</span>
              {sheet.periodYear && sheet.periodMonth ? (
                <span className="text-xs text-text-muted">({MONTH_NAMES[sheet.periodMonth - 1]} {sheet.periodYear})</span>
              ) : (
                <span className="text-xs text-text-muted">(Era {sheet.era})</span>
              )}
            </div>
          ))}
        </div>

        {timestamp && (
          <p className="text-xs text-text-muted mt-3">
            Processed at {new Date(timestamp).toLocaleString()}
          </p>
        )}
      </div>

      {skippedRows && skippedRows.length > 0 && (
        <details className="bg-white rounded-lg border border-border p-4">
          <summary className="text-sm font-medium text-text-secondary cursor-pointer">
            {skippedRows.length} skipped rows (click to expand)
          </summary>
          <div className="mt-2 max-h-40 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="pb-1 pr-4">Sheet</th>
                  <th className="pb-1 pr-4">Row</th>
                  <th className="pb-1">Reason</th>
                </tr>
              </thead>
              <tbody>
                {skippedRows.map((sr, i) => (
                  <tr key={i} className="text-text-secondary">
                    <td className="py-0.5 pr-4">{sr.sheet}</td>
                    <td className="py-0.5 pr-4">{sr.row}</td>
                    <td className="py-0.5">{sr.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
