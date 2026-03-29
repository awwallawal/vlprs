import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share2, Check, Loader2 } from 'lucide-react';
import { useDownloadReportPdf } from '@/hooks/useReportPdf';
import { ShareReportDialog } from './ShareReportDialog';
import type { PdfReportType } from '@vlprs/shared';

interface ReportActionsProps {
  reportType: PdfReportType;
  queryParams: Record<string, string>;
  reportTitle: string;
}

export function ReportActions({ reportType, queryParams, reportTitle }: ReportActionsProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const downloadMutation = useDownloadReportPdf(reportType, queryParams);

  useEffect(() => {
    if (downloadMutation.isSuccess) {
      const timer = setTimeout(() => downloadMutation.reset(), 3000);
      return () => clearTimeout(timer);
    }
  }, [downloadMutation.isSuccess, downloadMutation.reset]);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadMutation.mutate()}
        disabled={downloadMutation.isPending}
      >
        {downloadMutation.isPending ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
        ) : downloadMutation.isSuccess ? (
          <><Check className="mr-2 h-4 w-4 text-teal-600" />PDF Downloaded</>
        ) : (
          <><Download className="mr-2 h-4 w-4" />Download PDF</>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShareOpen(true)}
      >
        <Share2 className="mr-2 h-4 w-4" />
        Share
      </Button>
      <ShareReportDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        reportType={reportType}
        reportParams={queryParams}
        reportTitle={reportTitle}
      />
    </div>
  );
}
