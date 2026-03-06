import { useState } from 'react';
import type { SheetPreview, CanonicalField } from '@vlprs/shared';

const CANONICAL_FIELD_LABELS: Record<string, string> = {
  serialNumber: 'S/N',
  staffName: 'Staff Name',
  mda: 'MDA',
  principal: 'Principal',
  interestTotal: 'Interest Total',
  totalLoan: 'Total Loan',
  installmentCount: 'No. of Installments',
  monthlyDeduction: 'Monthly Deduction',
  monthlyInterest: 'Monthly Interest',
  monthlyPrincipal: 'Monthly Principal',
  totalInterestPaid: 'Total Interest Paid',
  totalOutstandingInterest: 'Total Outstanding Interest',
  installmentsPaid: 'Installments Paid',
  installmentsOutstanding: 'Installments Outstanding',
  totalLoanPaid: 'Total Loan Paid',
  outstandingBalance: 'Outstanding Balance',
  remarks: 'Remarks',
  startDate: 'Start Date',
  endDate: 'End Date',
  employeeNo: 'Employee No',
  refId: 'Ref ID',
  commencementDate: 'Commencement Date',
  station: 'Station',
  dateOfBirth: 'Date of Birth',
  dateOfFirstAppointment: 'Date of First Appointment',
};

const ALL_CANONICAL_FIELDS: CanonicalField[] = [
  'serialNumber', 'staffName', 'mda', 'principal', 'interestTotal', 'totalLoan',
  'installmentCount', 'monthlyDeduction', 'monthlyInterest', 'monthlyPrincipal',
  'totalInterestPaid', 'totalOutstandingInterest', 'installmentsPaid',
  'installmentsOutstanding', 'totalLoanPaid', 'outstandingBalance', 'remarks',
  'startDate', 'endDate', 'employeeNo', 'refId', 'commencementDate', 'station',
  'dateOfBirth', 'dateOfFirstAppointment',
];

interface ColumnMappingReviewProps {
  sheets: SheetPreview[];
  onConfirm: (mappings: Array<{ sheetName: string; mappings: Array<{ sourceIndex: number; canonicalField: string | null }> }>) => void;
  isLoading: boolean;
}

function ConfidenceBadge({ level }: { level: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-teal/10 text-teal border-teal/20',
    medium: 'bg-gold/10 text-gold border-gold/20',
    low: 'bg-gray-100 text-gray-500 border-gray-200',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full border ${colors[level]}`}>
      {level}
    </span>
  );
}

export function ColumnMappingReview({ sheets, onConfirm, isLoading }: ColumnMappingReviewProps) {
  const [overrides, setOverrides] = useState<Record<string, Record<number, string | null>>>({});

  const handleOverride = (sheetName: string, sourceIndex: number, value: string) => {
    setOverrides(prev => ({
      ...prev,
      [sheetName]: {
        ...prev[sheetName],
        [sourceIndex]: value === '' ? null : value,
      },
    }));
  };

  // Detect duplicate field assignments per sheet
  const getDuplicateFields = (sheetName: string, mappings: typeof sheets[0]['columnMappings']) => {
    const fieldCounts = new Map<string, number>();
    for (const cm of mappings) {
      const field = overrides[sheetName]?.[cm.sourceIndex] !== undefined
        ? overrides[sheetName][cm.sourceIndex]
        : cm.suggestedField;
      if (field) {
        fieldCounts.set(field, (fieldCounts.get(field) || 0) + 1);
      }
    }
    return new Set([...fieldCounts.entries()].filter(([, c]) => c > 1).map(([f]) => f));
  };

  const hasDuplicates = sheets.some(s => getDuplicateFields(s.sheetName, s.columnMappings).size > 0);

  const handleConfirm = () => {
    const result = sheets.map(sheet => ({
      sheetName: sheet.sheetName,
      mappings: sheet.columnMappings.map(cm => ({
        sourceIndex: cm.sourceIndex,
        canonicalField: overrides[sheet.sheetName]?.[cm.sourceIndex] !== undefined
          ? overrides[sheet.sheetName][cm.sourceIndex]
          : cm.suggestedField,
      })),
    }));
    onConfirm(result);
  };

  return (
    <div className="space-y-6">
      {sheets.map(sheet => (
        <div key={sheet.sheetName} className="rounded-lg border border-border bg-white overflow-hidden">
          <div className="px-4 py-3 bg-surface border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{sheet.sheetName}</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Era {sheet.era} &middot; {sheet.dataRowCount} data rows
                {sheet.period && ` \u00b7 ${sheet.period.month}/${sheet.period.year}`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface/50">
                  <th className="text-left px-4 py-2 text-text-secondary font-medium">Source Column</th>
                  <th className="text-left px-4 py-2 text-text-secondary font-medium">Mapped To</th>
                  <th className="text-left px-4 py-2 text-text-secondary font-medium">Confidence</th>
                  <th className="text-left px-4 py-2 text-text-secondary font-medium">Override</th>
                </tr>
              </thead>
              <tbody>
                {sheet.columnMappings.map(cm => (
                  <tr key={cm.sourceIndex} className="border-b border-border/50 hover:bg-surface/30">
                    <td className="px-4 py-2 text-text-primary font-mono text-xs">{cm.sourceHeader}</td>
                    <td className="px-4 py-2 text-text-primary">
                      {cm.suggestedField ? CANONICAL_FIELD_LABELS[cm.suggestedField] || cm.suggestedField : (
                        <span className="text-text-muted italic">Unmapped</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <ConfidenceBadge level={cm.suggestedField ? cm.confidence : 'low'} />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="text-xs border border-border rounded px-2 py-1 bg-white"
                        value={overrides[sheet.sheetName]?.[cm.sourceIndex] ?? cm.suggestedField ?? ''}
                        onChange={(e) => handleOverride(sheet.sheetName, cm.sourceIndex, e.target.value)}
                      >
                        <option value="">(unmapped — capture as metadata)</option>
                        {ALL_CANONICAL_FIELDS.map(f => (
                          <option key={f} value={f}>{CANONICAL_FIELD_LABELS[f] || f}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {getDuplicateFields(sheet.sheetName, sheet.columnMappings).size > 0 && (
            <div className="px-4 py-3 bg-gold/10 border-t border-gold/30">
              <p className="text-xs text-gold-dark">
                <span className="font-medium">Duplicate mapping detected:</span>{' '}
                {[...getDuplicateFields(sheet.sheetName, sheet.columnMappings)]
                  .map(f => CANONICAL_FIELD_LABELS[f] || f).join(', ')}
                {' '}&mdash; only the first source column will be used for each field.
              </p>
            </div>
          )}

          {sheet.unmappedColumns.length > 0 && (
            <div className="px-4 py-3 bg-surface/30 border-t border-border">
              <p className="text-xs text-text-secondary">
                <span className="font-medium">Unmapped columns</span> (will be captured as metadata):{' '}
                {sheet.unmappedColumns.map(u => u.name).join(', ')}
              </p>
            </div>
          )}
        </div>
      ))}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading || hasDuplicates}
          className="px-6 py-2 bg-teal text-white rounded-lg font-medium text-sm hover:bg-teal-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Processing...' : hasDuplicates ? 'Resolve Duplicate Mappings' : 'Confirm Mapping & Extract Records'}
        </button>
      </div>
    </div>
  );
}
