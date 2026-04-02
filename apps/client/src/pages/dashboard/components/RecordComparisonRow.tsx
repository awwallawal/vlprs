import { UI_COPY } from '@vlprs/shared';
import type { ValidationResultRecord, VarianceCategory } from '@vlprs/shared';
import { formatNairaOrDash } from '@/lib/formatters';
import { MetricHelp } from '@/components/shared/MetricHelp';

interface RecordComparisonRowProps {
  record: ValidationResultRecord;
  onBaseline?: (recordId: string) => void;
  isBaselineLoading?: boolean;
  isBaselineCreated?: boolean;
  onRowClick?: (recordId: string) => void;
}

const BADGE_STYLES: Record<VarianceCategory, string> = {
  clean: 'bg-teal/10 text-teal border-teal/20',
  minor_variance: 'bg-gold/10 text-gold border-gold/20',
  significant_variance: 'bg-gold/20 text-gold border-gold/30',
  structural_error: 'bg-amber-50 text-amber-600 border-amber-200',
  anomalous: 'bg-gray-100 text-gray-500 border-gray-200',
};

/**
 * Determine which cell has the largest absolute variance between
 * Scheme Expected and MDA Declared, for amber highlight.
 */
function getLargestVarianceField(record: ValidationResultRecord): 'totalLoan' | 'monthlyDeduction' | null {
  const se = record.schemeExpectedValues;
  const declared = record.declaredValues;
  if (!se.totalLoan && !se.monthlyDeduction) return null;

  const diffs: Array<{ field: 'totalLoan' | 'monthlyDeduction'; diff: number }> = [];

  if (se.totalLoan && declared.totalLoan) {
    diffs.push({ field: 'totalLoan', diff: Math.abs(Number(se.totalLoan) - Number(declared.totalLoan)) });
  }
  if (se.monthlyDeduction && declared.monthlyDeduction) {
    diffs.push({ field: 'monthlyDeduction', diff: Math.abs(Number(se.monthlyDeduction) - Number(declared.monthlyDeduction)) });
  }
  // Total interest: declared interestTotal isn't directly on declaredValues but we can compare
  // Skip totalInterest highlight since declared interest is not in declaredValues shape

  if (diffs.length === 0) return null;
  diffs.sort((a, b) => b.diff - a.diff);
  return diffs[0].diff > 0 ? diffs[0].field : null;
}

function VarianceCell({ value, isHighlighted }: { value: string | null; isHighlighted?: boolean }) {
  const bg = isHighlighted ? 'bg-amber-50' : '';
  return (
    <td className={`py-2 px-3 text-sm text-text-secondary text-right ${bg}`}>
      {formatNairaOrDash(value)}
    </td>
  );
}

function InsufficientDataCell() {
  return (
    <td className="py-2 px-3 text-sm text-text-tertiary text-right italic" title="Insufficient data to compute scheme expected values — tenure could not be determined from installment count or detected rate tier">
      Insufficient data
    </td>
  );
}

export function RecordComparisonRow({ record, onBaseline, isBaselineLoading, isBaselineCreated, onRowClick }: RecordComparisonRowProps) {
  const label = UI_COPY.VARIANCE_CATEGORY_LABELS[record.varianceCategory] ?? record.varianceCategory;
  const highlightField = getLargestVarianceField(record);
  const hasSchemeExpected = record.schemeExpectedValues.totalLoan !== null;

  return (
    <tr
      className={`border-b border-border/50 hover:bg-gray-50/50 ${onRowClick ? 'cursor-pointer' : ''}`}
      onClick={() => onRowClick?.(record.recordId)}
    >
      {/* Staff Name */}
      <td className="py-2 px-3 text-sm text-text-primary font-medium">{record.staffName}</td>

      {/* Variance Category */}
      <td className="py-2 px-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${BADGE_STYLES[record.varianceCategory]}`}>
          {label}
        </span>
      </td>

      {/* Total Loan: Scheme Expected | Reverse Engineered | MDA Declared */}
      {hasSchemeExpected ? (
        <VarianceCell value={record.schemeExpectedValues.totalLoan} isHighlighted={highlightField === 'totalLoan'} />
      ) : (
        <InsufficientDataCell />
      )}
      <VarianceCell value={record.computedValues.totalLoan} />
      <VarianceCell value={record.declaredValues.totalLoan} isHighlighted={highlightField === 'totalLoan'} />

      {/* Monthly Deduction: Scheme Expected | Reverse Engineered | MDA Declared */}
      {hasSchemeExpected ? (
        <VarianceCell value={record.schemeExpectedValues.monthlyDeduction} isHighlighted={highlightField === 'monthlyDeduction'} />
      ) : (
        <InsufficientDataCell />
      )}
      <VarianceCell value={record.computedValues.monthlyDeduction} />
      <VarianceCell value={record.declaredValues.monthlyDeduction} isHighlighted={highlightField === 'monthlyDeduction'} />

      {/* Rate */}
      <td className="py-2 px-3 text-sm text-text-secondary text-right">
        {record.computedRate ? `${record.computedRate}%` : '\u2014'}
        {record.computedRate && Math.abs(Number(record.computedRate) - 13.33) > 0.01 && (
          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-200">
            {UI_COPY.RATE_VARIANCE_DESCRIPTION}
          </span>
        )}
      </td>

      {/* Baseline action */}
      {onBaseline && (
        <td className="py-2 px-3 text-right">
          {isBaselineCreated ? (
            <span className="text-xs text-teal">Established</span>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onBaseline(record.recordId); }}
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

/**
 * Table header row for three-vector comparison layout.
 */
export function RecordComparisonHeader({ showBaseline }: { showBaseline?: boolean }) {
  return (
    <thead>
      {/* Group header row */}
      <tr className="border-b border-border">
        <th className="py-2 px-3" rowSpan={2}>Staff Name</th>
        <th className="py-2 px-3" rowSpan={2}>Category</th>
        <th className="py-1 px-3 text-center text-xs font-medium text-text-secondary border-b border-border/50" colSpan={3}>
          Total Loan
        </th>
        <th className="py-1 px-3 text-center text-xs font-medium text-text-secondary border-b border-border/50" colSpan={3}>
          Monthly Deduction
        </th>
        <th className="py-2 px-3" rowSpan={2}>Rate</th>
        {showBaseline && <th className="py-2 px-3" rowSpan={2}>Baseline</th>}
      </tr>
      {/* Sub-header row with vector labels */}
      <tr className="border-b border-border bg-gray-50/50">
        <th className="py-1 px-3 text-right text-xs font-normal text-text-secondary">
          Scheme <MetricHelp metric="migration.schemeExpected" />
        </th>
        <th className="py-1 px-3 text-right text-xs font-normal text-text-secondary">
          Rev. Eng. <MetricHelp metric="migration.reverseEngineered" />
        </th>
        <th className="py-1 px-3 text-right text-xs font-normal text-text-secondary">
          Declared <MetricHelp metric="migration.mdaDeclared" />
        </th>
        <th className="py-1 px-3 text-right text-xs font-normal text-text-secondary">
          Scheme <MetricHelp metric="migration.schemeExpected" />
        </th>
        <th className="py-1 px-3 text-right text-xs font-normal text-text-secondary">
          Rev. Eng. <MetricHelp metric="migration.reverseEngineered" />
        </th>
        <th className="py-1 px-3 text-right text-xs font-normal text-text-secondary">
          Declared <MetricHelp metric="migration.mdaDeclared" />
        </th>
      </tr>
    </thead>
  );
}
