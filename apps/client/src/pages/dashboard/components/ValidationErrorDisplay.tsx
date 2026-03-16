import { Info } from 'lucide-react';
import { UI_COPY, VOCABULARY } from '@vlprs/shared';
import type { SubmissionValidationError } from '@vlprs/shared';

interface ValidationErrorDisplayProps {
  errors: SubmissionValidationError[];
}

export function ValidationErrorDisplay({ errors }: ValidationErrorDisplayProps) {
  const itemCount = errors.length;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-lg border-l-4 border-l-[#D4A017] bg-amber-50 p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Info className="h-5 w-5 text-[#D4A017] shrink-0" aria-hidden="true" />
        <h3 className="text-base font-semibold text-amber-900">
          {UI_COPY.UPLOAD_ERROR_HEADER}
        </h3>
      </div>

      {/* Item count */}
      <p className="text-sm text-amber-800">
        {VOCABULARY.SUBMISSION_ITEMS_NEED_ATTENTION.replace('{count}', String(itemCount))}
      </p>

      {/* Row-level error list */}
      <ul className="space-y-1.5 text-sm text-amber-800">
        {errors.map((err, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-[#D4A017] mt-0.5" aria-hidden="true">
              &#8226;
            </span>
            <span>Row {err.row + 1}: {err.message}</span>
          </li>
        ))}
      </ul>

      {/* Reassurance message */}
      <p className="text-sm text-amber-800 border-t border-amber-200 pt-3">
        {UI_COPY.SUBMISSION_NO_DATA_PROCESSED}
      </p>

      {/* Fix guidance */}
      <p className="text-xs text-amber-700">
        {UI_COPY.SUBMISSION_FIX_AND_REUPLOAD}
      </p>
    </div>
  );
}
