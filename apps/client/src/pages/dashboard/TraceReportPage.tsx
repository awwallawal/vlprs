import { useParams, useNavigate } from 'react-router';
import { useTraceReport, useDownloadTracePdf } from '@/hooks/useTraceReport';
import {
  IndividualTraceReport,
  TraceReportSkeleton,
} from './components/IndividualTraceReport';
import { ArrowLeft } from 'lucide-react';

export function TraceReportPage() {
  const { personKey } = useParams<{ personKey: string }>();
  const navigate = useNavigate();
  const decodedKey = personKey ? decodeURIComponent(personKey) : undefined;

  const { data, isLoading, error } = useTraceReport(decodedKey);
  const downloadPdf = useDownloadTracePdf(decodedKey);

  return (
    <div className="space-y-4">
      {/* Back navigation */}
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-sm text-teal hover:underline no-print"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {isLoading && (
        <div>
          <p className="text-sm text-text-muted mb-4">Assembling trace report...</p>
          <TraceReportSkeleton />
        </div>
      )}

      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800">{error.message || 'Staff member not found'}</p>
        </div>
      )}

      {data && (
        <IndividualTraceReport
          data={data}
          onDownloadPdf={() => downloadPdf.mutate()}
          isPdfLoading={downloadPdf.isPending}
          isPdfSuccess={downloadPdf.isSuccess}
        />
      )}
    </div>
  );
}

export const Component = TraceReportPage;
