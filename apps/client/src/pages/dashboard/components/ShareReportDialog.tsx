import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';
import { useShareReport } from '@/hooks/useReportPdf';
import type { PdfReportType } from '@vlprs/shared';

interface ShareReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportType: PdfReportType;
  reportParams: Record<string, string>;
  reportTitle: string;
}

export function ShareReportDialog({ open, onOpenChange, reportType, reportParams, reportTitle }: ShareReportDialogProps) {
  const [email, setEmail] = useState('');
  const [coverMessage, setCoverMessage] = useState('');
  const shareMutation = useShareReport();

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleSend() {
    if (!isValidEmail) return;

    shareMutation.mutate(
      { reportType, recipientEmail: email, coverMessage: coverMessage || undefined, reportParams },
      {
        onSuccess: () => {
          toast.success(`Report shared with ${email}`);
          setEmail('');
          setCoverMessage('');
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message || 'Failed to share report');
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Report</DialogTitle>
          <DialogDescription>Send {reportTitle} as a branded PDF via email.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="share-email">Recipient Email</Label>
            <Input
              id="share-email"
              type="email"
              placeholder="recipient@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="share-message">Cover Message (optional)</Label>
            <Textarea
              id="share-message"
              placeholder="Add a message to accompany the report..."
              value={coverMessage}
              onChange={(e) => setCoverMessage(e.target.value)}
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-text-secondary text-right">{coverMessage.length}/500</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!isValidEmail || shareMutation.isPending}
          >
            {shareMutation.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" />Send</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
