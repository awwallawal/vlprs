import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { UI_COPY } from '@vlprs/shared';

export function useCopyToClipboard(resetDuration = 2000, toastMessage?: string) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copyToClipboard = useCallback(
    (text: string) => {
      const message = toastMessage ?? UI_COPY.SUBMISSION_REFERENCE_COPIED;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          toast.success(message);
          timeoutRef.current = setTimeout(() => setCopied(false), resetDuration);
        })
        .catch(() => {
          // Fallback: select-and-copy via temporary textarea
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          setCopied(true);
          toast.success(message);
          timeoutRef.current = setTimeout(() => setCopied(false), resetDuration);
        });
    },
    [resetDuration, toastMessage],
  );

  return { copied, copyToClipboard };
}
