import { UI_COPY } from '@vlprs/shared';
import type { ValidationResultRecord, VarianceCategory } from '@vlprs/shared';
import { formatNaira, formatNairaOrDash } from '@/lib/formatters';

interface RecordComparisonRowProps {
  record: ValidationResultRecord;
  onBaseline?: (recordId: string) => void;
  isBaselineLoading?: boolean;
  isBaselineCreated?: boolean;
}

const BADGE_STYLES: Record<VarianceCategory, string> = {
  clean: 'bg-teal/10 text-teal border-teal/20',
  minor_variance: 'bg-gold/10 text-gold border-gold/20',
  significant_variance: 'bg-gold/20 text-gold border-gold/30',
  structural_error: 'bg-amber-50 text-amber-600 border-amber-200',
  anomalous: 'bg-gray-100 text-gray-500 border-gray-200',
};

export function RecordComparisonRow({ record, onBaseline, isBaselineLoading, isBaselineCreated }: RecordComparisonRowProps) {
  const label = UI_COPY.VARIANCE_CATEGORY_LABELS[record.varianceCategory] ?? record.varianceCategory;

  return (
    <tr className="border-b border-border/50 hover:bg-gray-50/50">
      <td className="py-2 px-3 text-sm text-text-primary font-medium">{record.staffName}</td>
      <td className="py-2 px-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${BADGE_STYLES[record.varianceCategory]}`}>
          {label}
        </span>
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {record.varianceAmount ? formatNaira(record.varianceAmount) : '\u2014'}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatNairaOrDash(record.declaredValues.totalLoan)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatNairaOrDash(record.computedValues.totalLoan)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatNairaOrDash(record.declaredValues.monthlyDeduction)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatNairaOrDash(record.computedValues.monthlyDeduction)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {record.computedRate ? `${record.computedRate}%` : '\u2014'}
        {record.computedRate && Math.abs(Number(record.computedRate) - 13.33) > 0.01 && (
          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-200">
            {UI_COPY.RATE_VARIANCE_DESCRIPTION}
          </span>
        )}
      </td>
      {onBaseline && (
        <td className="py-2 px-3 text-right">
          {isBaselineCreated ? (
            <span className="text-xs text-teal">Established</span>
          ) : (
            <button
              type="button"
              onClick={() => onBaseline(record.recordId)}
              disabled={isBaselineLoading}
              className="px-2 py-1 text-xs bg-teal/10 text-teal border border-teal/20 rounded hover:bg-teal/20 disabled:opacity-50"
            >
              {isBaselineLoading ? 'Processing...' : 'Establish Baseline'}
            </button>
          )}
        </td>
      )}
    </tr>
  );
}
