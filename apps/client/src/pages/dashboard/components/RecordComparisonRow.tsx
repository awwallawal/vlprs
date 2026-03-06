import { UI_COPY } from '@vlprs/shared';
import type { ValidationResultRecord, VarianceCategory } from '@vlprs/shared';

interface RecordComparisonRowProps {
  record: ValidationResultRecord;
}

const BADGE_STYLES: Record<VarianceCategory, string> = {
  clean: 'bg-teal/10 text-teal border-teal/20',
  minor_variance: 'bg-gold/10 text-gold border-gold/20',
  significant_variance: 'bg-gold/20 text-gold border-gold/30',
  structural_error: 'bg-amber-50 text-amber-600 border-amber-200',
  anomalous: 'bg-gray-100 text-gray-500 border-gray-200',
};

function formatCurrency(value: string | null): string {
  if (!value) return '\u2014';
  const num = Number(value);
  if (isNaN(num)) return value;
  return `\u20A6${num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RecordComparisonRow({ record }: RecordComparisonRowProps) {
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
        {record.varianceAmount ? formatCurrency(record.varianceAmount) : '\u2014'}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatCurrency(record.declaredValues.totalLoan)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatCurrency(record.computedValues.totalLoan)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatCurrency(record.declaredValues.monthlyDeduction)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {formatCurrency(record.computedValues.monthlyDeduction)}
      </td>
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {record.computedRate ? `${record.computedRate}%` : '\u2014'}
        {record.computedRate && Math.abs(Number(record.computedRate) - 13.33) > 0.01 && (
          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-200">
            {UI_COPY.RATE_VARIANCE_DESCRIPTION}
          </span>
        )}
      </td>
    </tr>
  );
}
