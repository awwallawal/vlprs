import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { UI_COPY } from '@vlprs/shared';
import type { ValidationSummary, MdaBoundary } from '@vlprs/shared';

interface ValidationSummaryCardProps {
  summary: ValidationSummary;
  multiMda: { hasMultiMda: boolean; boundaries: MdaBoundary[] };
  onCategoryFilter: (category: string | undefined) => void;
  activeCategory?: string;
}

const CATEGORY_CONFIG = [
  { key: 'clean', label: 'Clean', color: 'bg-teal', textColor: 'text-teal', bgLight: 'bg-teal/10' },
  { key: 'minorVariance', label: 'Minor Variance', color: 'bg-gold/60', textColor: 'text-gold', bgLight: 'bg-gold/10' },
  { key: 'significantVariance', label: 'Significant Variance', color: 'bg-gold', textColor: 'text-gold', bgLight: 'bg-gold/10' },
  { key: 'structuralError', label: 'Rate Variance', color: 'bg-amber-500', textColor: 'text-amber-600', bgLight: 'bg-amber-50' },
  { key: 'anomalous', label: 'Requires Clarification', color: 'bg-gray-400', textColor: 'text-gray-500', bgLight: 'bg-gray-50' },
] as const;

const CATEGORY_FILTER_KEYS: Record<string, string> = {
  clean: 'clean',
  minorVariance: 'minor_variance',
  significantVariance: 'significant_variance',
  structuralError: 'structural_error',
  anomalous: 'anomalous',
};

export function ValidationSummaryCard({ summary, multiMda, onCategoryFilter, activeCategory }: ValidationSummaryCardProps) {
  const total = summary.clean + summary.minorVariance + summary.significantVariance + summary.structuralError + summary.anomalous;

  return (
    <div className="rounded-lg border border-teal/30 bg-teal/5 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-teal flex-shrink-0" />
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{UI_COPY.COMPARISON_COMPLETE}</h3>
          <p className="text-sm text-text-secondary">
            {total.toLocaleString()} records validated
            {summary.rateVarianceCount > 0 && ` \u00B7 ${summary.rateVarianceCount} with rate observations`}
          </p>
        </div>
      </div>

      {/* Progress bar breakdown */}
      {total > 0 && (
        <div className="h-3 rounded-full overflow-hidden flex">
          {CATEGORY_CONFIG.map(({ key, color }) => {
            const count = summary[key as keyof ValidationSummary] as number;
            const pct = (count / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={key}
                className={`${color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${CATEGORY_CONFIG.find(c => c.key === key)?.label}: ${count} (${pct.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      )}

      {/* Category counts */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {CATEGORY_CONFIG.map(({ key, label, textColor, bgLight }) => {
          const count = summary[key as keyof ValidationSummary] as number;
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
          const filterKey = CATEGORY_FILTER_KEYS[key] ?? key;
          const isActive = activeCategory === filterKey;

          return (
            <button
              key={key}
              type="button"
              onClick={() => onCategoryFilter(isActive ? undefined : filterKey)}
              className={`${bgLight} rounded-lg p-3 border transition-all cursor-pointer hover:shadow-sm ${
                isActive ? 'border-teal ring-1 ring-teal/30' : 'border-border'
              }`}
            >
              <p className="text-xs text-text-muted truncate">{label}</p>
              <p className={`text-xl font-bold ${textColor} mt-1`}>{count}</p>
              <p className="text-xs text-text-muted">{pct}%</p>
            </button>
          );
        })}
      </div>

      {/* Multi-MDA banner */}
      {multiMda.hasMultiMda && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-text-primary">{UI_COPY.MULTI_MDA_BANNER}</p>
            <div className="mt-2 space-y-1">
              {multiMda.boundaries.map((b, i) => (
                <p key={i} className="text-xs text-text-secondary">
                  {b.detectedMda}: rows {b.startRow}\u2013{b.endRow} ({b.recordCount} records, {b.confidence} confidence)
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Rate variance info */}
      {summary.rateVarianceCount > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Info className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-text-secondary">
            {summary.rateVarianceCount} record(s) have interest rates that differ from the standard 13.33%.
            This is an observation for review, not an error.
          </p>
        </div>
      )}
    </div>
  );
}
