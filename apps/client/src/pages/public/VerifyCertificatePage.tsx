import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '@/lib/apiClient';

interface VerificationResult {
  valid: boolean;
  message: string;
  beneficiaryName?: string;
  mdaName?: string;
  completionDate?: string;
}

export function VerifyCertificatePage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!certificateId) return;
    const controller = new AbortController();

    fetch(`${API_BASE}/public/verify/${encodeURIComponent(certificateId)}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json();
        if (body.success) {
          setResult(body.data);
        } else {
          setError('Unable to verify certificate');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError('Unable to connect to verification service');
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [certificateId]);

  const completionDateStr = result?.completionDate
    ? new Date(result.completionDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="mx-auto max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          {!imgError && (
            <img
              src="/oyo-crest.png"
              alt="Oyo State Government Crest"
              className="mx-auto h-16 w-16 mb-4"
              onError={() => setImgError(true)}
            />
          )}
          <h1 className="text-xl font-bold text-text-primary">
            Certificate Verification
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Vehicle Loan Processing &amp; Receivables System
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-teal" />
          </div>
        ) : error ? (
          <div className="rounded-lg border bg-white p-8 text-center">
            <XCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
            <p className="font-medium text-text-primary">{error}</p>
            <p className="text-sm text-text-secondary mt-2">
              Please try again later or contact support.
            </p>
          </div>
        ) : result?.valid ? (
          <div className="rounded-lg border-2 border-green-200 bg-green-50 p-8">
            <div className="text-center mb-6">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-3" />
              <p className="text-lg font-bold text-green-700">Verified</p>
              <p className="text-sm text-green-600">{result.message}</p>
            </div>
            <div className="space-y-3 border-t border-green-200 pt-4">
              <div>
                <p className="text-xs text-green-600 uppercase tracking-wide">Beneficiary</p>
                <p className="font-medium text-text-primary">{result.beneficiaryName}</p>
              </div>
              <div>
                <p className="text-xs text-green-600 uppercase tracking-wide">MDA</p>
                <p className="font-medium text-text-primary">{result.mdaName}</p>
              </div>
              <div>
                <p className="text-xs text-green-600 uppercase tracking-wide">Completion Date</p>
                <p className="font-medium text-text-primary">{completionDateStr}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-8 text-center">
            <XCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="font-medium text-text-primary">Certificate Not Found</p>
            <p className="text-sm text-text-secondary mt-2">
              The certificate ID provided could not be verified.
              Please check the ID and try again.
            </p>
          </div>
        )}

        {/* Certificate ID display */}
        {certificateId && (
          <p className="text-center text-xs text-text-muted mt-6">
            Certificate ID: {certificateId}
          </p>
        )}
      </div>
    </div>
  );
}

export { VerifyCertificatePage as Component };
